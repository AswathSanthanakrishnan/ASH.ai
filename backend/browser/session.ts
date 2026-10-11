import { chromium, type Browser, type BrowserContext, type Page } from "playwright";

let browser: Browser | null = null;
let context: BrowserContext | null = null;
let page: Page | null = null;

const VIEWPORT_WIDTH = 1280;
const VIEWPORT_HEIGHT = 800;

export interface ElementSnapshot {
  id: string;
  role: string;
  name: string;
  x: number;
  y: number;
}

const currentSnapshot: Map<string, ElementSnapshot> = new Map();

export interface OpenBrowserResult {
  ok: boolean;
  page?: Page;
  error?: string;
  isInvalidUrl?: boolean;
}

export interface ScreenshotResult {
  ok: boolean;
  screenshot?: string;
  error?: string;
}

export interface TitleResult {
  ok: boolean;
  title?: string;
  error?: string;
}

export interface SnapshotResult {
  ok: boolean;
  elements?: ElementSnapshot[];
  error?: string;
}

export interface ClickResult {
  ok: boolean;
  element?: ElementSnapshot;
  error?: string;
}

export interface TypeResult {
  ok: boolean;
  element?: ElementSnapshot;
  error?: string;
}

export interface PageSummaryResult {
  ok: boolean;
  title?: string;
  headings?: string[];
  text?: string;
  error?: string;
}

export interface CloseResult {
  ok: boolean;
  error?: string;
}

function validateHttpUrl(rawUrl: string): { valid: true; url: string } | { valid: false; error: string } {
  if (!rawUrl || typeof rawUrl !== "string") {
    return { valid: false, error: "URL must be a non-empty string" };
  }
  const trimmed = rawUrl.trim();
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return {
        valid: false,
        error: `Only http and https URLs are allowed, got: ${parsed.protocol}`,
      };
    }
    return { valid: true, url: parsed.toString() };
  } catch {
    return {
      valid: false,
      error: `Invalid URL: "${trimmed}". Must be a valid http:// or https:// URL`,
    };
  }
}

async function ensureSession(): Promise<{ page: Page } | { error: string }> {
  try {
    if (!browser || !browser.isConnected()) {
      browser = await chromium.launch({
        headless: true,
      });
      context = await browser.newContext({
        viewport: { width: VIEWPORT_WIDTH, height: VIEWPORT_HEIGHT },
      });
      page = await context.newPage();
      return { page };
    }

    if (!context) {
      context = await browser.newContext({
        viewport: { width: VIEWPORT_WIDTH, height: VIEWPORT_HEIGHT },
      });
      page = await context.newPage();
      return { page };
    }

    if (!page || page.isClosed()) {
      page = await context.newPage();
      return { page };
    }

    return { page };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

async function isPageReady(targetPage: Page): Promise<boolean> {
  try {
    return await targetPage.evaluate(() => {
      const doc = (globalThis as any).document;
      if (!doc || !doc.body) return false;
      const ready = doc.readyState === "complete" || doc.readyState === "interactive";
      const hasContent = (doc.body.childElementCount ?? 0) > 0 || (doc.body.innerText ?? "").trim().length > 0;
      return ready && hasContent;
    });
  } catch {
    return false;
  }
}

/**
 * Open a URL in a headed Chromium browser.
 * Reuses the existing session if one is already open.
 */
export async function openBrowser(url: string): Promise<OpenBrowserResult> {
  try {
    const validation = validateHttpUrl(url);
    if (!validation.valid) {
      return {
        ok: false,
        error: validation.error,
        isInvalidUrl: true,
      };
    }

    const session = await ensureSession();
    if ("error" in session) {
      return {
        ok: false,
        error: session.error,
      };
    }

    await session.page.goto(validation.url, {
      waitUntil: "domcontentloaded",
      timeout: 30000,
    });

    try {
      await session.page.waitForLoadState("networkidle", { timeout: 5000 });
    } catch {
      try {
        await session.page.waitForLoadState("load", { timeout: 5000 });
      } catch {
        // Fallback timeout expired; continue with page
      }
    }

    await session.page.waitForTimeout(500);

    return {
      ok: true,
      page: session.page,
    };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Take a base64 PNG screenshot of the current page.
 */
export async function takeScreenshot(): Promise<ScreenshotResult> {
  try {
    if (!page || page.isClosed() || !browser || !browser.isConnected()) {
      return {
        ok: false,
        error: "No active browser session. Open a URL first.",
      };
    }

    const ready = await isPageReady(page);
    if (!ready) {
      try {
        await page.waitForLoadState("load", { timeout: 3000 });
      } catch {
        // Fallback timeout expired
      }
      await page.waitForTimeout(500);
    }

    let buffer = await page.screenshot({ type: "png" });

    // Never return a blank capture: if the capture appears blank, wait briefly and retry once
    if (buffer.length <= 5000) {
      await page.waitForTimeout(500);
      try {
        await page.waitForLoadState("networkidle", { timeout: 3000 });
      } catch {
        await page.waitForLoadState("load", { timeout: 2000 }).catch(() => {});
      }
      await page.waitForTimeout(500);
      buffer = await page.screenshot({ type: "png" });
    }

    return {
      ok: true,
      screenshot: buffer.toString("base64"),
    };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Get the current page title.
 */
export async function getTitle(): Promise<TitleResult> {
  try {
    if (!page || page.isClosed() || !browser || !browser.isConnected()) {
      return {
        ok: false,
        error: "No active browser session. Open a URL first.",
      };
    }
    const title = await page.title();
    return {
      ok: true,
      title,
    };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Get a list of interactive elements (buttons, links, inputs) with center coordinates.
 * Assigns stable ids per snapshot (e.g. e1, e2...).
 */
export async function getSnapshot(): Promise<SnapshotResult> {
  try {
    if (!page || page.isClosed() || !browser || !browser.isConnected()) {
      return {
        ok: false,
        error: "No active browser session. Open a URL first.",
      };
    }

    const rawElements = await page.evaluate(() => {
      const doc = (globalThis as any).document;
      const win = (globalThis as any).window;
      if (!doc) return [];

      const candidates: any[] = Array.from(
        doc.querySelectorAll(
          'a[href], button, input, textarea, select, [role="button"], [role="link"], [role="textbox"], [role="checkbox"], [role="radio"], [role="combobox"], [role="menuitem"], [role="tab"], [tabindex]:not([tabindex="-1"])'
        )
      );

      const list: Array<{ role: string; name: string; x: number; y: number }> = [];

      for (const el of candidates) {
        const rect = el.getBoundingClientRect();
        if (rect.width <= 0 || rect.height <= 0) continue;

        const style = win.getComputedStyle(el);
        if (style.visibility === "hidden" || style.display === "none" || style.opacity === "0") continue;

        if (el.disabled) continue;

        const x = Math.round(rect.left + rect.width / 2);
        const y = Math.round(rect.top + rect.height / 2);

        if (x < 0 || y < 0) continue;

        let role = el.getAttribute("role") || "";
        if (!role) {
          const tag = (el.tagName || "").toLowerCase();
          if (tag === "a") role = "link";
          else if (tag === "button") role = "button";
          else if (tag === "input") {
            const inputType = el.type || "text";
            role = ["button", "submit", "reset"].includes(inputType) ? "button" : `input[${inputType}]`;
          } else if (tag === "textarea") role = "textarea";
          else if (tag === "select") role = "select";
          else role = tag;
        }

        let name =
          el.getAttribute("aria-label") ||
          el.getAttribute("title") ||
          el.placeholder ||
          el.innerText ||
          el.textContent ||
          el.value ||
          "";

        name = String(name).replace(/\s+/g, " ").trim();
        if (name.length > 80) {
          name = name.slice(0, 77) + "...";
        }

        list.push({ role, name, x, y });
      }

      return list;
    });

    currentSnapshot.clear();
    const elements: ElementSnapshot[] = [];

    for (let i = 0; i < rawElements.length; i++) {
      const item = rawElements[i];
      const snapshotItem: ElementSnapshot = {
        id: `e${i + 1}`,
        role: item.role,
        name: item.name,
        x: item.x,
        y: item.y,
      };
      currentSnapshot.set(snapshotItem.id, snapshotItem);
      elements.push(snapshotItem);
    }

    return {
      ok: true,
      elements,
    };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Click an element by its snapshot id.
 */
export async function clickElement(id: string): Promise<ClickResult> {
  try {
    if (!page || page.isClosed() || !browser || !browser.isConnected()) {
      return {
        ok: false,
        error: "No active browser session. Open a URL first.",
      };
    }
    const element = currentSnapshot.get(id);
    if (!element) {
      return {
        ok: false,
        error: `Element "${id}" not found in current snapshot.`,
      };
    }

    await page.mouse.click(element.x, element.y);
    try {
      await page.waitForLoadState("domcontentloaded", { timeout: 3000 }).catch(() => {});
      await page.waitForLoadState("networkidle", { timeout: 2000 }).catch(() => {});
    } catch {
      // Non-navigation click
    }
    await page.waitForTimeout(500).catch(() => {});
    return {
      ok: true,
      element,
    };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Click an element by its snapshot id, then type text into it.
 */
export async function typeInto(id: string, text: string, pressEnter: boolean = false): Promise<TypeResult> {
  try {
    if (!page || page.isClosed() || !browser || !browser.isConnected()) {
      return {
        ok: false,
        error: "No active browser session. Open a URL first.",
      };
    }
    const element = currentSnapshot.get(id);
    if (!element) {
      return {
        ok: false,
        error: `Element "${id}" not found in current snapshot.`,
      };
    }

    await page.mouse.click(element.x, element.y);
    await page.waitForTimeout(100).catch(() => {});
    await page.keyboard.type(text);
    if (pressEnter) {
      await page.keyboard.press("Enter");
      try {
        await page.waitForLoadState("domcontentloaded", { timeout: 3000 }).catch(() => {});
        await page.waitForLoadState("networkidle", { timeout: 2000 }).catch(() => {});
      } catch {
        // Non-navigation enter
      }
    }
    await page.waitForTimeout(500).catch(() => {});
    return {
      ok: true,
      element,
    };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Retrieve current page URL.
 */
export function getUrl(): string {
  if (!page || page.isClosed()) return "";
  return page.url();
}

/**
 * Retrieve an element from the current snapshot by its id.
 */
export function getElementFromSnapshot(id: string): ElementSnapshot | undefined {
  return currentSnapshot.get(id);
}

/**
 * Check whether a browser session and page are currently active.
 */
export function isSessionActive(): boolean {
  return !!(page && !page.isClosed() && browser && browser.isConnected());
}

/**
 * Get textual summary of page including title, headings, and visible text snippet.
 */
export async function getPageSummary(): Promise<PageSummaryResult> {
  try {
    if (!page || page.isClosed() || !browser || !browser.isConnected()) {
      return { ok: false, error: "No active browser session. Open a URL first." };
    }
    const title = await page.title();
    const { headings, text } = await page.evaluate(() => {
      const doc = (globalThis as any).document;
      if (!doc) return { headings: [], text: "" };
      const h = Array.from(doc.querySelectorAll("h1, h2, h3"))
        .map((el: any) => (el.textContent || "").trim())
        .filter(Boolean);
      const bodyText = (doc.body?.innerText || "").slice(0, 2000).trim();
      return { headings: h, text: bodyText };
    });
    return { ok: true, title, headings, text };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) };
  }
}

/**
 * Close the current page and browser, resetting the singleton.
 */
export async function closeBrowser(): Promise<CloseResult> {
  try {
    currentSnapshot.clear();
    if (page && !page.isClosed()) {
      await page.close().catch(() => {});
    }
    if (context) {
      await context.close().catch(() => {});
    }
    if (browser && browser.isConnected()) {
      await browser.close().catch(() => {});
    }
    page = null;
    context = null;
    browser = null;
    return { ok: true };
  } catch (error) {
    currentSnapshot.clear();
    page = null;
    context = null;
    browser = null;
    return {
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
