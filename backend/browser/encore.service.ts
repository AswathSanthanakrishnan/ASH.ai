import { randomUUID } from "node:crypto";
import { api, APIError } from "encore.dev/api";
import { Service } from "encore.dev/service";
import log from "encore.dev/log";
import { closeBrowser } from "./session";
import { browserOpenTool, browserScreenshotTool, browserCloseTool } from "./tools";
import {
  runAgentStep,
  type AgentStep,
  type ConsequentialDetails,
} from "./agent";

export default new Service("browser");

// --- Interfaces & Types ---

interface OpenBrowserRequest {
  url: string;
}

interface OpenBrowserResponse {
  title: string;
  screenshot: string;
}

interface ScreenshotResponse {
  screenshot: string;
}

interface CloseBrowserResponse {
  closed: true;
}

export type RunStatus = "running" | "done" | "needs_confirmation" | "stopped" | "error";

export interface AgentRun {
  id: string;
  goal: string;
  max_steps: number;
  status: RunStatus;
  steps: AgentStep[];
  cancelled: boolean;
  error?: string;
  confirmationDetails?: ConsequentialDetails;
  pendingExecution?: () => Promise<AgentStep>;
}

const activeRuns: Map<string, AgentRun> = new Map();

// --- Background Agent Loop ---

async function executeRunLoop(run: AgentRun): Promise<void> {
  while (run.steps.length < run.max_steps) {
    if (run.cancelled) {
      run.status = "stopped";
      await closeBrowser();
      return;
    }

    try {
      const result = await runAgentStep(run.goal, run.steps);

      if (run.cancelled) {
        run.status = "stopped";
        await closeBrowser();
        return;
      }

      if (result.status === "needs_confirmation") {
        run.status = "needs_confirmation";
        run.confirmationDetails = result.details;
        run.pendingExecution = result.stepToExecute;
        log.info("Agent run paused: awaiting user confirmation", {
          run_id: run.id,
          details: result.details,
        });
        return;
      }

      if (result.status === "error") {
        run.status = "error";
        run.error = result.error ?? "Unknown agent error";
        log.error("Agent step encountered error", { run_id: run.id, error: run.error });
        return;
      }

      if (result.step) {
        run.steps.push(result.step);
        if (result.step.action === "done") {
          run.status = "done";
          log.info("Agent run completed successfully", {
            run_id: run.id,
            totalSteps: run.steps.length,
          });
          return;
        }
      }
    } catch (err) {
      if (run.cancelled) {
        run.status = "stopped";
        await closeBrowser();
        return;
      }
      run.status = "error";
      run.error = err instanceof Error ? err.message : String(err);
      log.error("Unhandled exception in agent loop", {
        run_id: run.id,
        error: run.error,
      });
      return;
    }
  }

  if (run.status === "running") {
    run.status = "done";
    log.info("Agent run reached maximum step limit", {
      run_id: run.id,
      steps: run.steps.length,
    });
  }
}

// --- Endpoints ---

// Phase 0: Primitives
export const open = api(
  { expose: true, method: "POST", path: "/browser/open" },
  async ({ url }: OpenBrowserRequest): Promise<OpenBrowserResponse> => {
    if (!url || typeof url !== "string" || !url.trim()) {
      throw APIError.invalidArgument("url must be a non-empty string");
    }
    return await browserOpenTool.run({ url });
  },
);

export const screenshot = api(
  { expose: true, method: "POST", path: "/browser/screenshot" },
  async (): Promise<ScreenshotResponse> => {
    return await browserScreenshotTool.run();
  },
);

export const close = api(
  { expose: true, method: "POST", path: "/browser/close" },
  async (): Promise<CloseBrowserResponse> => {
    return await browserCloseTool.run();
  },
);

// Phase 1: Agent Run Endpoints

interface StartAgentRequest {
  goal: string;
  max_steps?: number;
}

interface StartAgentResponse {
  run_id: string;
}

export const start = api(
  { expose: true, method: "POST", path: "/browser/agent/start" },
  async ({ goal, max_steps }: StartAgentRequest): Promise<StartAgentResponse> => {
    if (!goal || typeof goal !== "string" || !goal.trim()) {
      throw APIError.invalidArgument("goal must be a non-empty string");
    }

    const run_id = randomUUID();
    const run: AgentRun = {
      id: run_id,
      goal: goal.trim(),
      max_steps: typeof max_steps === "number" && max_steps > 0 ? max_steps : 20,
      status: "running",
      steps: [],
      cancelled: false,
    };

    activeRuns.set(run_id, run);
    log.info("Started browser agent run", {
      run_id,
      goal: run.goal,
      max_steps: run.max_steps,
    });

    // Launch background loop so stop can be invoked mid-run
    void executeRunLoop(run);

    return { run_id };
  },
);

interface AgentStatusRequest {
  run_id: string;
}

interface AgentStatusResponse {
  status: RunStatus;
  steps: AgentStep[];
  error?: string;
  details?: ConsequentialDetails;
}

export const status = api(
  { expose: true, method: "GET", path: "/browser/agent/status" },
  async ({ run_id }: AgentStatusRequest): Promise<AgentStatusResponse> => {
    if (!run_id) {
      throw APIError.invalidArgument("run_id is required");
    }
    const run = activeRuns.get(run_id);
    if (!run) {
      throw APIError.notFound(`Run "${run_id}" not found`);
    }

    return {
      status: run.status,
      steps: run.steps,
      error: run.error,
      details: run.confirmationDetails,
    };
  },
);

interface StopRequest {
  run_id: string;
}

interface StopResponse {
  stopped: true;
}

export const stop = api(
  { expose: true, method: "POST", path: "/browser/stop" },
  async ({ run_id }: StopRequest): Promise<StopResponse> => {
    if (!run_id) {
      throw APIError.invalidArgument("run_id is required");
    }
    const run = activeRuns.get(run_id);
    if (!run) {
      throw APIError.notFound(`Run "${run_id}" not found`);
    }
    run.cancelled = true;
    run.status = "stopped";
    // Takes effect immediately
    await closeBrowser();
    log.info("Browser agent run stopped", { run_id });
    return { stopped: true };
  },
);

interface ApproveRequest {
  run_id: string;
  approved: boolean;
}

interface ApproveResponse {
  approved: boolean;
  status: RunStatus;
}

export const approve = api(
  { expose: true, method: "POST", path: "/browser/approve" },
  async ({ run_id, approved }: ApproveRequest): Promise<ApproveResponse> => {
    if (!run_id) {
      throw APIError.invalidArgument("run_id is required");
    }
    const run = activeRuns.get(run_id);
    if (!run) {
      throw APIError.notFound(`Run "${run_id}" not found`);
    }
    if (run.status !== "needs_confirmation") {
      throw APIError.failedPrecondition("Run is not waiting for confirmation");
    }

    if (!approved) {
      run.cancelled = true;
      run.status = "stopped";
      run.confirmationDetails = undefined;
      run.pendingExecution = undefined;
      await closeBrowser();
      log.info("Agent run confirmation denied; stopped run and closed browser", { run_id });
      return { approved: false, status: "stopped" };
    }

    log.info("Agent run confirmation approved; executing pending step and resuming", { run_id });
    run.status = "running";
    const executeStep = run.pendingExecution;
    run.confirmationDetails = undefined;
    run.pendingExecution = undefined;

    void (async () => {
      try {
        if (executeStep) {
          const step = await executeStep();
          run.steps.push(step);
          if (step.action === "done") {
            run.status = "done";
            return;
          }
        }
        await executeRunLoop(run);
      } catch (err) {
        if (run.cancelled) {
          run.status = "stopped";
          await closeBrowser();
          return;
        }
        run.status = "error";
        run.error = err instanceof Error ? err.message : String(err);
        log.error("Error executing approved step in agent run", {
          run_id: run.id,
          error: run.error,
        });
      }
    })();

    return { approved: true, status: "running" };
  },
);
