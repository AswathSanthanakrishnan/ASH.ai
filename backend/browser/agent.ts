import { Ollama } from "ollama";
import log from "encore.dev/log";
import {
  isSessionActive,
  getSnapshot,
  takeScreenshot,
  getTitle,
  getPageSummary,
  getElementFromSnapshot,
  type ElementSnapshot,
} from "./session";
import {
  browserOpenTool,
  browserClickTool,
  browserTypeTool,
} from "./tools";

const ollama = new Ollama({ host: "http://localhost:11434" });
const MODEL_NAME = "ornith:9b";

let cachedVisionSupport: boolean | null = null;

async function checkModelVisionSupport(model: string): Promise<boolean> {
  if (cachedVisionSupport !== null) return cachedVisionSupport;
  try {
    const show = await ollama.show({ model });
    const capabilities = show.capabilities ?? [];
    const families = show.details?.families ?? [];
    const hasVisionCapability = capabilities.includes("vision");
    const hasVisionFamily = families.some((f: string) =>
      ["clip", "mllama", "llava", "vision"].includes(f.toLowerCase())
    );
    cachedVisionSupport = hasVisionCapability || hasVisionFamily;
    log.info("Ollama model vision check", {
      model,
      supportsVision: cachedVisionSupport,
      capabilities,
      families,
    });
    return cachedVisionSupport;
  } catch (err) {
    log.warn("Could not determine model vision support; defaulting to snapshot only", {
      error: String(err),
    });
    cachedVisionSupport = false;
    return false;
  }
}

export interface AgentStep {
  step_number: number;
  action: "open" | "click" | "type" | "done";
  element_id?: string;
  element_name?: string;
  text?: string;
  url?: string;
  reason?: string;
  narration?: string;
}

export interface ConsequentialDetails {
  action: string;
  description: string;
  element_id?: string;
  element_name?: string;
  text?: string;
  url?: string;
}

export interface AgentStepResult {
  status: "ok" | "done" | "needs_confirmation" | "error";
  step?: AgentStep;
  details?: ConsequentialDetails;
  error?: string;
  stepToExecute?: () => Promise<AgentStep>;
}

function extractUrlFromGoal(goal: string): string | null {
  const match = goal.match(/https?:\/\/[^\s]+|(?:[a-zA-Z0-9-]+\.)+[a-zA-Z]{2,}(?:\/[^\s]*)?/);
  if (!match) return null;
  let url = match[0];
  if (!url.startsWith("http://") && !url.startsWith("https://")) {
    url = "https://" + url;
  }
  return url;
}

export function checkConsequential(
  action: {
    action: string;
    element_id?: string;
    text?: string;
    url?: string;
    reason?: string;
    is_consequential?: boolean;
    consequential_details?: string;
  },
  element?: ElementSnapshot,
): { isConsequential: boolean; description: string } {
  if (action.is_consequential) {
    return {
      isConsequential: true,
      description: action.consequential_details || action.reason || "Action was marked as consequential by agent.",
    };
  }

  const name = (element?.name || "").toLowerCase();
  const role = (element?.role || "").toLowerCase();

  const consequentialKeywords = [
    "submit",
    "log in",
    "login",
    "sign in",
    "signin",
    "sign up",
    "signup",
    "checkout",
    "buy",
    "purchase",
    "pay",
    "place order",
    "confirm order",
    "send message",
    "send",
    "publish",
    "post",
    "delete",
    "remove",
    "erase",
    "destroy",
    "cancel account",
    "unsubscribe",
  ];

  for (const kw of consequentialKeywords) {
    if (name.includes(kw) || role.includes(kw)) {
      return {
        isConsequential: true,
        description: `This action will perform a consequential operation: "${kw}" on ${element?.name || action.element_id || "element"}.`,
      };
    }
  }

  if (action.action === "type") {
    if (
      role.includes("password") ||
      name.includes("password") ||
      name.includes("credit card") ||
      name.includes("cvv")
    ) {
      return {
        isConsequential: true,
        description: `This action will type sensitive credentials into "${element?.name || action.element_id}".`,
      };
    }
  }

  return { isConsequential: false, description: "" };
}

async function executeAction(
  action: {
    action: "click" | "type" | "done" | "open";
    element_id?: string;
    text?: string;
    url?: string;
    reason?: string;
  },
  element: ElementSnapshot | undefined,
  stepNumber: number,
): Promise<AgentStep> {
  if (action.action === "done") {
    log.info(`Agent goal completed: ${action.reason ?? "Done"}`);
    return {
      step_number: stepNumber,
      action: "done",
      reason: action.reason ?? "Goal completed",
      narration: `Goal completed: ${action.reason ?? "Done"}`,
    };
  }

  if (action.action === "open") {
    if (!action.url) throw new Error("open action requires url");
    await browserOpenTool.run({ url: action.url });
    const hostname = new URL(action.url).hostname;
    return {
      step_number: stepNumber,
      action: "open",
      url: action.url,
      reason: action.reason,
      narration: `Opening ${hostname}…`,
    };
  }

  if (action.action === "click") {
    if (!action.element_id) throw new Error("click action requires element_id");
    await browserClickTool.run({ element_id: action.element_id });
    const name = element?.name ? element.name : action.element_id;
    return {
      step_number: stepNumber,
      action: "click",
      element_id: action.element_id,
      element_name: element?.name,
      reason: action.reason,
      narration: `Clicking ${name}…`,
    };
  }

  if (action.action === "type") {
    if (!action.element_id) throw new Error("type action requires element_id");
    await browserTypeTool.run({ element_id: action.element_id, text: action.text ?? "" });
    const name = element?.name ? element.name : action.element_id;
    return {
      step_number: stepNumber,
      action: "type",
      element_id: action.element_id,
      element_name: element?.name,
      text: action.text,
      reason: action.reason,
      narration: `Typing into ${name}…`,
    };
  }

  throw new Error(`Unknown action: ${(action as any).action}`);
}

/**
 * Execute one step of the agent.
 */
export async function runAgentStep(goal: string, history: AgentStep[]): Promise<AgentStepResult> {
  // If no browser session is active, open the initial URL from the goal if present
  if (!isSessionActive()) {
    const url = extractUrlFromGoal(goal);
    if (!url) {
      return {
        status: "error",
        error: "No active browser session and no valid URL found in goal to open.",
      };
    }

    try {
      const step = await executeAction(
        { action: "open", url, reason: `Open initial URL from goal: ${url}` },
        undefined,
        history.length + 1,
      );
      return {
        status: "ok",
        step,
      };
    } catch (err) {
      return {
        status: "error",
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }

  // Session is active: capture screenshot + snapshot + page summary
  const [snapshotRes, screenshotRes, pageSummaryRes] = await Promise.all([
    getSnapshot(),
    takeScreenshot(),
    getPageSummary(),
  ]);

  if (!snapshotRes.ok) {
    return {
      status: "error",
      error: snapshotRes.error ?? "Failed to capture snapshot",
    };
  }

  const elements = snapshotRes.elements ?? [];
  const screenshot = screenshotRes.ok ? screenshotRes.screenshot : undefined;
  const title = pageSummaryRes.ok && pageSummaryRes.title ? pageSummaryRes.title : "";
  const headings = pageSummaryRes.ok && pageSummaryRes.headings ? pageSummaryRes.headings : [];
  const textSnippet = pageSummaryRes.ok && pageSummaryRes.text ? pageSummaryRes.text : "";

  // Check if Ollama model supports vision
  const supportsVision = await checkModelVisionSupport(MODEL_NAME);

  const systemPrompt = `You are an AI browser-control agent.
You are given a user goal, steps performed so far, and the current web page context.

Interactive elements are provided with their unique id: [id] role "name" at (x, y).

You must select exactly ONE next action as valid JSON:
1. To click an element:
   {"action": "click", "element_id": "<id>", "reason": "<why>"}
2. To type into an element:
   {"action": "type", "element_id": "<id>", "text": "<text>", "reason": "<why>"}
3. If the goal is satisfied or finished:
   {"action": "done", "reason": "<your summary or answer to the goal>"}

SAFETY RULE:
If this action is consequential (submit a form, log in, purchase, send a message, publish, or delete anything), include "is_consequential": true and explain in "consequential_details".

Output JSON only.`;

  const userPrompt = `Goal: ${goal}

Steps so far:
${history.length === 0 ? "None" : history.map((s) => `- Step ${s.step_number}: ${s.action} ${s.element_name ?? s.element_id ?? s.url ?? ""} (${s.reason ?? s.narration ?? ""})`).join("\n")}

Current Page:
Title: ${title}
${headings.length > 0 ? `Headings: ${headings.join(" | ")}\n` : ""}
${textSnippet ? `Text Content: ${textSnippet.slice(0, 1000)}\n` : ""}

Interactive elements:
${elements.length === 0 ? "(None)" : elements.slice(0, 40).map((e) => `- [${e.id}] ${e.role} "${e.name}" at (${e.x}, ${e.y})`).join("\n")}

Respond with exactly ONE action JSON.`;

  let parsedAction: {
    action: "click" | "type" | "done" | "open";
    element_id?: string;
    text?: string;
    url?: string;
    reason?: string;
    is_consequential?: boolean;
    consequential_details?: string;
  };

  try {
    const response = await ollama.chat({
      model: MODEL_NAME,
      messages: [
        { role: "system", content: systemPrompt },
        {
          role: "user",
          content: userPrompt,
          ...(supportsVision && screenshot ? { images: [screenshot] } : {}),
        },
      ],
      format: "json",
      stream: false,
    });

    let content = response.message.content.trim();
    if (content.startsWith("```")) {
      content = content.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
    }
    parsedAction = JSON.parse(content);
  } catch (err) {
    log.error("Failed to query Ollama model or parse response", {
      error: err instanceof Error ? err.message : String(err),
    });
    return {
      status: "error",
      error: `Model query failed: ${err instanceof Error ? err.message : String(err)}`,
    };
  }

  const targetElement = parsedAction.element_id
    ? getElementFromSnapshot(parsedAction.element_id)
    : undefined;

  // Check if the proposed action is consequential
  const consequential = checkConsequential(parsedAction, targetElement);
  if (consequential.isConsequential) {
    const details: ConsequentialDetails = {
      action: parsedAction.action,
      description: consequential.description,
      element_id: parsedAction.element_id,
      element_name: targetElement?.name,
      text: parsedAction.text,
      url: parsedAction.url,
    };

    const stepToExecute = async (): Promise<AgentStep> => {
      return await executeAction(parsedAction, targetElement, history.length + 1);
    };

    log.warn("Action requires user confirmation", { details });
    return {
      status: "needs_confirmation",
      details,
      stepToExecute,
    };
  }

  try {
    const step = await executeAction(parsedAction, targetElement, history.length + 1);
    return {
      status: parsedAction.action === "done" ? "done" : "ok",
      step,
    };
  } catch (err) {
    return {
      status: "error",
      error: err instanceof Error ? err.message : String(err),
    };
  }
}
