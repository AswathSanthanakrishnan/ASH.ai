import type { Tool } from "ollama";
import { secret } from "encore.dev/config";
import log from "encore.dev/log";
import {
  browserOpenTool,
  browserScreenshotTool,
  browserCloseTool,
} from "../browser/tools";
import {
  getSnapshot,
  clickElement,
  typeInto,
  getElementFromSnapshot,
  getTitle,
  getUrl,
  getPageSummary,
  type ElementSnapshot,
} from "../browser/session";
import { checkConsequential } from "../browser/agent";

const tavilyApiKey = secret("TavilyApiKey");

interface TavilySearchResult {
  title: string;
  url: string;
  content: string;
}

function isSearchResult(value: unknown): value is TavilySearchResult {
  return typeof value === "object" && value !== null
    && "title" in value && typeof value.title === "string"
    && "url" in value && typeof value.url === "string"
    && "content" in value && typeof value.content === "string";
}

function searchFailed(reason: string): string {
  log.warn("Web search failed", { reason });
  return `Search failed: ${reason}. Current information could not be verified.`;
}

export const tools: Tool[] = [
  {
    type: "function",
    function: {
      name: "get_time",
      description: "Get the current date and time in UTC as an ISO 8601 string.",
      parameters: {
        type: "object",
        properties: {},
        required: [],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "web_search",
      description: "Search the web for real-time information. Use for current events, latest products, facts beyond your training, and anything you do not know or are unsure about. Returns up to five results with title, snippet, and URL. Cite the relevant result URLs in your answer.",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string", description: "The search query to look up on the web." },
        },
        required: ["query"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "read_page",
      description: "Read the text of a specific HTTP or HTTPS page. Use when the user provides a URL or asks about an article, or when web search snippets lack enough detail. Returns up to 8000 characters. Cite the page URL when answering from its content.",
      parameters: {
        type: "object",
        properties: { url: { type: "string", description: "The full HTTP or HTTPS page URL to read." } },
        required: ["url"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "open_browser",
      description: "Open a URL in headless Chromium, capture a live screenshot, and return the interactive elements snapshot (links, buttons, inputs with IDs). Use whenever browsing is needed to look up real-time web pages, listings, prices, or search results.",
      parameters: {
        type: "object",
        properties: {
          url: { type: "string", description: "The full http or https URL to open." },
        },
        required: ["url"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "browser_click",
      description: "Click an interactive element on the page by its snapshot ID (e.g. 'e1', 'e2'). Navigates or activates the element, captures a new screenshot, and returns the updated interactive elements snapshot.",
      parameters: {
        type: "object",
        properties: {
          elementId: { type: "string", description: "The snapshot element ID to click, e.g. 'e1', 'e2'." },
        },
        required: ["elementId"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "browser_type",
      description: "Type text into an input or textarea element on the page by its snapshot ID (e.g. 'e1', 'e2'). Used to type search queries into search boxes. Captures a screenshot and returns the updated interactive elements snapshot.",
      parameters: {
        type: "object",
        properties: {
          elementId: { type: "string", description: "The snapshot element ID to type into, e.g. 'e1', 'e2'." },
          text: { type: "string", description: "The text string to type into the input field." },
          press_enter: { type: "boolean", description: "Optional. Set to true to press Enter after typing to submit." },
        },
        required: ["elementId", "text"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "browser_screenshot",
      description: "Capture a live screenshot of the currently open page and display it in the chat.",
      parameters: {
        type: "object",
        properties: {},
        required: [],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "close_browser",
      description: "Close the browser session when browsing is finished.",
      parameters: {
        type: "object",
        properties: {},
        required: [],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "request_approval",
      description: "Request explicit user approval for a consequential action (booking, buying, paying, submitting forms, logging in, publishing, or deleting). You MUST call this before taking any action that books or purchases something. This displays an inline Yes/No confirmation prompt in the chat.",
      parameters: {
        type: "object",
        properties: {
          action: { type: "string", description: "Short title of the proposed action, e.g. 'Book Room'." },
          description: { type: "string", description: "Clear explanation of what action will be taken, the price, the site, and what will be submitted." },
        },
        required: ["action", "description"],
      },
    },
  },
  ...([
    { name: 'schedule_reminder', description: 'Schedule a local phone reminder ONLY when the user explicitly requests it. Use get_time for relative times. Ask for clarification if time is ambiguous. The at field must be a future ISO datetime with timezone offset. Wait for the phone result before confirming.', properties: { title: { type: 'string' }, body: { type: 'string' }, at: { type: 'string' } }, required: ['title', 'body', 'at'] },
    { name: 'list_reminders', description: 'List pending local reminders on this phone, including their ids and scheduled times.', properties: {}, required: [] },
    { name: 'cancel_reminder', description: 'Cancel a reminder the user asks to cancel. Use the exact id from list_reminders; never guess an id.', properties: { id: { type: 'string' } }, required: ['id'] },
  ] as { name: string; description: string; properties: Record<string, { type: string }>; required: string[] }[]).map(tool => ({ type: 'function' as const, function: { name: tool.name, description: tool.description, parameters: { type: 'object', properties: tool.properties, required: tool.required } } })),
];

export function get_time(): string {
  return new Date().toISOString();
}

export async function web_search(query: string): Promise<string> {
  try {
    const apiKey = tavilyApiKey();
    if (!apiKey.trim()) return searchFailed("TavilyApiKey is not configured");
    if (!query.trim()) return searchFailed("query must not be empty");

    const response = await fetch("https://api.tavily.com/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        api_key: apiKey,
        query: query.trim(),
        search_depth: "basic",
        max_results: 5,
        include_answer: false,
      }),
      signal: AbortSignal.timeout(15000),
    });
    if (!response.ok) {
      const reasons: Record<number, string> = {
        400: "invalid search request",
        401: "invalid API key",
        403: "access denied",
        429: "rate limit exceeded",
        432: "search quota exceeded",
        433: "search quota exceeded",
      };
      return searchFailed(`Tavily HTTP ${response.status} (${reasons[response.status] ?? "provider error"})`);
    }
    const data: unknown = await response.json();
    if (typeof data !== "object" || data === null || !("results" in data)
      || !Array.isArray(data.results)) {
      return searchFailed("unexpected response structure from Tavily");
    }
    const results = data.results.filter(isSearchResult);
    if (results.length === 0) {
      return "No results found. Current information could not be verified.";
    }
    return results.map((r, i) =>
      `[${i + 1}] ${r.title}\nURL: ${r.url}\n${r.content}`
    ).join("\n\n");
  } catch (error) {
    if (error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError")) {
      return searchFailed("search request timed out");
    }
    if (error instanceof SyntaxError) {
      return searchFailed("Tavily returned invalid JSON");
    }
    return searchFailed("could not connect to search provider");
  }
}

function pageFailed(reason: string): string {
  log.warn("Page extraction failed", { reason });
  return `Could not read page: ${reason}. Content could not be verified.`;
}

function normalizeUrl(rawUrl: string): URL | null {
  try {
    const url = new URL(rawUrl.trim());
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    return url;
  } catch {
    return null;
  }
}

export async function read_page(rawUrl: string): Promise<string> {
  const url = normalizeUrl(rawUrl);
  if (!url) return pageFailed("invalid URL; must be an absolute http or https URL");
  try {
    const apiKey = tavilyApiKey();
    if (!apiKey.trim()) return pageFailed("TavilyApiKey is not configured");

    const response = await fetch("https://api.tavily.com/extract", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        api_key: apiKey,
        urls: [url.href],
      }),
      signal: AbortSignal.timeout(15000),
    });
    if (!response.ok) {
      const reasons: Record<number, string> = {
        400: "invalid extract request",
        401: "invalid API key",
        403: "access denied",
        429: "rate limit exceeded",
        432: "extract quota exceeded",
        433: "extract quota exceeded",
      };
      return pageFailed(`Tavily HTTP ${response.status} (${reasons[response.status] ?? "provider error"})`);
    }
    const data: unknown = await response.json();
    if (typeof data !== "object" || data === null || !("results" in data)
      || !Array.isArray(data.results) || data.results.length === 0) {
      return pageFailed("unexpected extraction response structure from Tavily");
    }
    const result = data.results[0];
    if (typeof result !== "object" || result === null || !("raw_content" in result)
      || typeof result.raw_content !== "string" || !result.raw_content.trim()) {
      return pageFailed("page not found, inaccessible, or extraction returned no text");
    }
    const text = result.raw_content.trim();
    log.info("Page extraction completed", { url: url.href, characterCount: Math.min(text.length, 8000), truncated: text.length > 8000 });
    return `URL: ${url.href}\n\n${text.slice(0, 8000)}${text.length > 8000 ? "\n[Page content truncated to 8000 characters.]" : ""}`;
  } catch (error) {
    if (error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError")) return pageFailed("request timed out");
    if (error instanceof SyntaxError) return pageFailed("Tavily returned invalid JSON");
    return pageFailed("could not connect to Tavily or extract the page");
  }
}

export interface ToolExecutionResult {
  content: string;
  screenshot?: string;
  caption?: string;
  approval?: { action: string; description: string };
}

function extractHostname(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
}

function formatSnapshot(elements?: ElementSnapshot[]): string {
  if (!elements || elements.length === 0) {
    return "No interactive elements found on this page.";
  }
  const lines = elements.slice(0, 50).map(el => `[${el.id}] ${el.role}: "${el.name}"`);
  if (elements.length > 50) {
    lines.push(`...and ${elements.length - 50} more elements.`);
  }
  return lines.join("\n");
}

function checkForCaptcha(title?: string, text?: string, elements?: ElementSnapshot[]): boolean {
  const combined = [
    title || "",
    text || "",
    ...(elements ? elements.map(e => e.name) : []),
  ].join(" ").toLowerCase();

  return (
    combined.includes("captcha") ||
    combined.includes("verify you are human") ||
    combined.includes("human verification") ||
    combined.includes("security check to continue") ||
    combined.includes("robot check") ||
    combined.includes("are you a robot") ||
    combined.includes("cloudflare ray id")
  );
}

export async function executeTool(name: string, args: Record<string, unknown>): Promise<ToolExecutionResult> {
  if (args === null || typeof args !== "object" || Array.isArray(args)) {
    return { content: JSON.stringify({ error: "Tool arguments must be an object" }) };
  }
  if (name === "read_page") {
    if (typeof args.url !== "string" || !args.url.trim()) return { content: pageFailed("a non-empty URL is required") };
    return { content: await read_page(args.url) };
  }
  if (name === "web_search") {
    if (typeof args.query !== "string" || !args.query.trim()) {
      return { content: JSON.stringify({ error: "web_search requires a non-empty query string" }) };
    }
    return { content: await web_search(args.query.trim()) };
  }
  if (name === "open_browser") {
    if (typeof args.url !== "string" || !args.url.trim()) {
      return { content: JSON.stringify({ error: "open_browser requires a non-empty url string" }) };
    }
    let url = args.url.trim();
    if (!url.startsWith("http://") && !url.startsWith("https://") && url.includes(".")) {
      url = "https://" + url;
    }
    const hostname = extractHostname(url);
    const caption = `Opening ${hostname}…`;
    try {
      const res = await browserOpenTool.run({ url });
      const snapRes = await getSnapshot();
      const pageSum = await getPageSummary();
      const captchaDetected = checkForCaptcha(res.title, pageSum.text, snapRes.elements);

      let message = `Opened "${res.title || url}". Live screenshot captured and displayed in chat.`;
      if (captchaDetected) {
        message += " WARNING: Page shows a CAPTCHA or human-verification check. Stop and tell the user instead of trying to beat it.";
      }

      return {
        content: JSON.stringify({
          ok: true,
          title: res.title || "Untitled",
          url,
          captcha_detected: captchaDetected,
          message,
          interactive_elements: formatSnapshot(snapRes.elements),
          page_text_sample: pageSum.text ? pageSum.text.slice(0, 1000) : "",
        }),
        screenshot: res.screenshot,
        caption,
      };
    } catch (err) {
      return {
        content: JSON.stringify({
          ok: false,
          error: err instanceof Error ? err.message : String(err),
        }),
      };
    }
  }
  if (name === "browser_click") {
    const rawId = args.elementId ?? args.element_id;
    if (typeof rawId !== "string" || !rawId.trim()) {
      return { content: JSON.stringify({ error: "browser_click requires a non-empty elementId string" }) };
    }
    const elementId = rawId.trim();
    const el = getElementFromSnapshot(elementId);
    const elementName = el?.name || elementId;
    const caption = `Clicking "${elementName}"…`;

    // Consequential action check
    const consequential = checkConsequential({ action: "click", element_id: elementId }, el);
    if (consequential.isConsequential) {
      log.info("Consequential action intercepted in browser_click", { elementId, elementName, description: consequential.description });
      return {
        content: JSON.stringify({
          ok: false,
          needs_approval: true,
          elementId,
          elementName,
          reason: consequential.description,
          instruction: "This action is consequential (such as booking, submitting, buying, or paying). You MUST stop now, inform the user about the action, and ask for their confirmation before executing it.",
        }),
        caption: `Action requires approval…`,
        approval: {
          action: elementName,
          description: consequential.description,
        },
      };
    }

    try {
      const clickRes = await clickElement(elementId);
      if (!clickRes.ok) {
        return {
          content: JSON.stringify({ ok: false, error: clickRes.error ?? "Failed to click element" }),
        };
      }
      const shotRes = await browserScreenshotTool.run();
      const snapRes = await getSnapshot();
      const titleRes = await getTitle();
      const currentUrl = getUrl();
      const pageSum = await getPageSummary();
      const captchaDetected = checkForCaptcha(titleRes.title, pageSum.text, snapRes.elements);

      let message = `Clicked "${elementName}". Live screenshot captured and displayed in chat.`;
      if (captchaDetected) {
        message += " WARNING: Page shows a CAPTCHA or human-verification check. Stop and tell the user instead of trying to beat it.";
      }

      return {
        content: JSON.stringify({
          ok: true,
          clicked: elementName,
          url: currentUrl,
          title: titleRes.title || "Untitled",
          captcha_detected: captchaDetected,
          message,
          interactive_elements: formatSnapshot(snapRes.elements),
          page_text_sample: pageSum.text ? pageSum.text.slice(0, 1000) : "",
        }),
        screenshot: shotRes.screenshot,
        caption,
      };
    } catch (err) {
      return {
        content: JSON.stringify({
          ok: false,
          error: err instanceof Error ? err.message : String(err),
        }),
      };
    }
  }
  if (name === "browser_type") {
    const rawId = args.elementId ?? args.element_id;
    if (typeof rawId !== "string" || !rawId.trim()) {
      return { content: JSON.stringify({ error: "browser_type requires a non-empty elementId string" }) };
    }
    const elementId = rawId.trim();
    const text = typeof args.text === "string" ? args.text : "";
    const pressEnter = args.press_enter === true || args.pressEnter === true;
    const el = getElementFromSnapshot(elementId);
    const elementName = el?.name || elementId;
    const caption = `Typing "${text}"…`;

    // Consequential check
    const consequential = checkConsequential({ action: "type", element_id: elementId, text }, el);
    if (consequential.isConsequential) {
      return {
        content: JSON.stringify({
          ok: false,
          needs_approval: true,
          elementId,
          elementName,
          reason: consequential.description,
          instruction: "This action is consequential. You MUST stop now and ask for user approval.",
        }),
        caption: `Action requires approval…`,
        approval: {
          action: `Type into ${elementName}`,
          description: consequential.description,
        },
      };
    }

    try {
      const typeRes = await typeInto(elementId, text, pressEnter);
      if (!typeRes.ok) {
        return {
          content: JSON.stringify({ ok: false, error: typeRes.error ?? "Failed to type into element" }),
        };
      }
      const shotRes = await browserScreenshotTool.run();
      const snapRes = await getSnapshot();
      const titleRes = await getTitle();
      const currentUrl = getUrl();
      const pageSum = await getPageSummary();

      return {
        content: JSON.stringify({
          ok: true,
          typed: text,
          elementName,
          url: currentUrl,
          title: titleRes.title || "Untitled",
          message: `Typed "${text}" into "${elementName}". Live screenshot captured and displayed in chat.`,
          interactive_elements: formatSnapshot(snapRes.elements),
          page_text_sample: pageSum.text ? pageSum.text.slice(0, 1000) : "",
        }),
        screenshot: shotRes.screenshot,
        caption,
      };
    } catch (err) {
      return {
        content: JSON.stringify({
          ok: false,
          error: err instanceof Error ? err.message : String(err),
        }),
      };
    }
  }
  if (name === "browser_screenshot") {
    const caption = "Viewing page…";
    try {
      const res = await browserScreenshotTool.run();
      return {
        content: JSON.stringify({
          ok: true,
          message: "Live screenshot captured and displayed in chat.",
        }),
        screenshot: res.screenshot,
        caption,
      };
    } catch (err) {
      return {
        content: JSON.stringify({
          ok: false,
          error: err instanceof Error ? err.message : String(err),
        }),
      };
    }
  }
  if (name === "close_browser") {
    try {
      await browserCloseTool.run();
      return {
        content: JSON.stringify({
          ok: true,
          message: "Browser session closed.",
        }),
      };
    } catch (err) {
      return {
        content: JSON.stringify({
          ok: false,
          error: err instanceof Error ? err.message : String(err),
        }),
      };
    }
  }
  if (name === "request_approval") {
    const action = typeof args.action === "string" ? args.action : "Action";
    const description = typeof args.description === "string" ? args.description : action;
    log.info("request_approval called by model", { action, description });
    return {
      content: JSON.stringify({
        ok: true,
        message: "An inline approval prompt with 'Yes, continue' and 'No, stop' has been displayed to the user. Stop browsing and summarize what you are waiting for approval to do.",
      }),
      caption: `Waiting for approval to ${action}…`,
      approval: {
        action,
        description,
      },
    };
  }
  if (name !== "get_time") {
    return { content: JSON.stringify({ error: `Unknown tool: ${name}` }) };
  }
  if (Object.keys(args).length > 0) {
    return { content: JSON.stringify({ error: "get_time takes no arguments" }) };
  }
  return { content: get_time() };
}
