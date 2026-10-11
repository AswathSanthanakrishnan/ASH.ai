import { APIError } from "encore.dev/api";
import log from "encore.dev/log";
import {
  openBrowser,
  takeScreenshot,
  getTitle,
  closeBrowser,
  clickElement,
  typeInto,
  getElementFromSnapshot,
  type ElementSnapshot,
} from "./session";

export interface Tool<Args = any, Result = any> {
  name: string;
  description: string;
  run(args: Args): Promise<Result>;
  narrate(args: Args): string[];
}

function extractHostname(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
}

export const browserOpenTool: Tool<{ url: string }, { title: string; screenshot: string }> = {
  name: "browser_open",
  description: "Open a URL in the browser, wait for the page to load, and capture a screenshot.",
  narrate(args: { url: string }): string[] {
    const hostname = extractHostname(args.url);
    return [
      `Opening ${hostname}…`,
      "Page loaded. Taking a screenshot…",
    ];
  },
  async run(args: { url: string }): Promise<{ title: string; screenshot: string }> {
    const [openingLine, loadedLine] = browserOpenTool.narrate(args);
    log.info(openingLine);

    const openRes = await openBrowser(args.url);
    if (!openRes.ok) {
      if (openRes.isInvalidUrl) {
        throw APIError.invalidArgument(openRes.error ?? "Invalid URL");
      }
      throw APIError.internal(openRes.error ?? "Failed to open browser");
    }

    const titleRes = await getTitle();
    const title = titleRes.ok && titleRes.title ? titleRes.title : "";

    log.info(loadedLine);

    const screenshotRes = await takeScreenshot();
    if (!screenshotRes.ok || !screenshotRes.screenshot) {
      throw APIError.internal(screenshotRes.error ?? "Failed to capture screenshot");
    }

    return { title, screenshot: screenshotRes.screenshot };
  },
};

export const browserScreenshotTool: Tool<Record<string, never> | void, { screenshot: string }> = {
  name: "browser_screenshot",
  description: "Capture a screenshot of the current browser page.",
  narrate(): string[] {
    return ["Taking a screenshot…"];
  },
  async run(): Promise<{ screenshot: string }> {
    const [line] = browserScreenshotTool.narrate();
    log.info(line);

    const screenshotRes = await takeScreenshot();
    if (!screenshotRes.ok || !screenshotRes.screenshot) {
      throw APIError.internal(screenshotRes.error ?? "Failed to capture screenshot");
    }

    return { screenshot: screenshotRes.screenshot };
  },
};

export const browserCloseTool: Tool<Record<string, never> | void, { closed: true }> = {
  name: "browser_close",
  description: "Close the browser session.",
  narrate(): string[] {
    return ["Closing the browser…"];
  },
  async run(): Promise<{ closed: true }> {
    const [line] = browserCloseTool.narrate();
    log.info(line);

    const closeRes = await closeBrowser();
    if (!closeRes.ok) {
      throw APIError.internal(closeRes.error ?? "Failed to close browser");
    }

    return { closed: true };
  },
};

export const browserClickTool: Tool<{ element_id: string }, { clicked: true; element?: ElementSnapshot }> = {
  name: "browser_click",
  description: "Click an interactive element on the page by its snapshot id.",
  narrate(args: { element_id: string }): string[] {
    const el = getElementFromSnapshot(args.element_id);
    const name = el?.name ? el.name : args.element_id;
    return [`Clicking ${name}…`];
  },
  async run(args: { element_id: string }): Promise<{ clicked: true; element?: ElementSnapshot }> {
    if (!args || !args.element_id) {
      throw APIError.invalidArgument("element_id must be provided");
    }
    const [line] = browserClickTool.narrate(args);
    log.info(line);

    const clickRes = await clickElement(args.element_id);
    if (!clickRes.ok) {
      throw APIError.internal(clickRes.error ?? "Failed to click element");
    }

    return { clicked: true, element: clickRes.element };
  },
};

export const browserTypeTool: Tool<{ element_id: string; text: string }, { typed: true; element?: ElementSnapshot }> = {
  name: "browser_type",
  description: "Click an interactive element and type text into it.",
  narrate(args: { element_id: string; text: string }): string[] {
    const el = getElementFromSnapshot(args.element_id);
    const name = el?.name ? el.name : args.element_id;
    return [`Typing into ${name}…`];
  },
  async run(args: { element_id: string; text: string }): Promise<{ typed: true; element?: ElementSnapshot }> {
    if (!args || !args.element_id) {
      throw APIError.invalidArgument("element_id must be provided");
    }
    const [line] = browserTypeTool.narrate(args);
    log.info(line);

    const typeRes = await typeInto(args.element_id, args.text ?? "");
    if (!typeRes.ok) {
      throw APIError.internal(typeRes.error ?? "Failed to type into element");
    }

    return { typed: true, element: typeRes.element };
  },
};

export const toolRegistry = {
  browser_open: browserOpenTool,
  browser_screenshot: browserScreenshotTool,
  browser_close: browserCloseTool,
  browser_click: browserClickTool,
  browser_type: browserTypeTool,
};

export const tools = [
  browserOpenTool,
  browserScreenshotTool,
  browserCloseTool,
  browserClickTool,
  browserTypeTool,
];
