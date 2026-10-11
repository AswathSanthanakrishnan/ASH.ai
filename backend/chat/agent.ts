import { Ollama, type Message } from "ollama";
import { executeTool, tools } from "./tools";
import { clientToolNames, pauseForClient, type AgentReply, type PendingState } from "./client-actions";
import { browserCloseTool } from "../browser/tools";
import log from "encore.dev/log";

const ollama = new Ollama({ host: "http://localhost:11434" });
const maxTurns = 15;

interface ActiveRun {
  abortController: AbortController;
}
const activeRuns = new Map<string, ActiveRun>();

/**
 * Stop any active browsing/agent run for the given conversation.
 */
export function abortConversation(conversationId: string): void {
  const existing = activeRuns.get(conversationId);
  if (existing) {
    log.info("Aborting active browsing run for conversation", { conversationId });
    existing.abortController.abort();
    activeRuns.delete(conversationId);
  }
}

export async function runAgent(message: string, history: Message[], conversationId: string, resume?: PendingState): Promise<AgentReply> {
  const systemPrompt = `Current time is ${new Date().toISOString()} (UTC). You are Ash, an intelligent, autonomous, and thoughtful personal assistant.

INTENT DETECTION RULE:
You decide on your own when to browse the web. If the user's message needs fresh, real-time web info (such as prices, apartment/room listings, news, availability, local events, "find me", "cheapest", "what is the status", product comparisons), DO NOT ask "should I look that up?" or wait for trigger words — immediately start browsing autonomously using your browser tools.
If the question needs no web info (general knowledge, coding, creative writing, greetings, casual talk), answer directly without browsing.

MULTI-STEP BROWSING:
When browsing is needed, you operate multi-step across multiple pages:
1. Start with open_browser on a search engine or relevant site (e.g. https://www.google.com, https://newyork.craigslist.org, https://www.zillow.com, or direct URLs).
2. After open_browser, browser_click, or browser_type, inspect the returned interactive elements snapshot ([e1], [e2]...) and page text.
3. Use browser_type to enter search terms into search boxes (use press_enter: true to submit if applicable).
4. Use browser_click with element IDs (e.g. "e1", "e2") to click search buttons or follow the most relevant result links.
5. You can browse multiple pages, click result links, and take screenshots as you progress.
6. When you find the listings, prices, or answers, summarize your findings in clear, plain words with key facts, prices, and locations.

SAFETY & CONSEQUENTIAL ACTIONS:
Only browse what directly serves the user's request. Only http and https URLs are allowed.
NEVER log in, submit forms, buy, book, pay, send, publish, or delete anything without first showing the user the exact action and getting their explicit confirmation.
When the user asks to "book it", buy, or take a consequential action, call request_approval to present an inline Yes/No confirmation prompt to the user and explain what will be done.
If a page shows a CAPTCHA, Cloudflare check, or human-verification check, STOP and tell the user instead of trying to beat it.

NARRATION:
Every browser tool call automatically captures screenshots and plain-words narration ("Opening Google…", "Clicking the first result…") so the user can watch the story unfold in the chat. Close the browser with close_browser once your research is done.`;

  const messages: Message[] = resume?.messages ?? [
    {
      role: "system",
      content: systemPrompt,
    },
    ...history,
    { role: "user", content: message },
  ];

  log.info("Sending conversation to Ollama", {
    conversationId,
    historyCount: history.length,
    messageCount: messages.length,
  });

  const abortController = new AbortController();
  activeRuns.set(conversationId, { abortController });

  const collectedScreenshots: string[] = [];
  const collectedCaptions: string[] = [];
  let pendingApproval: { action: string; description: string } | undefined;

  try {
    for (let turn = resume?.turn ?? 0; turn < maxTurns; turn++) {
      if (abortController.signal.aborted) {
        log.info("Browsing loop aborted by newer message", { conversationId, turn });
        await browserCloseTool.run().catch(() => {});
        return {
          reply: "Browsing was stopped because a new message was received.",
          screenshots: collectedScreenshots,
          screenshotCaptions: collectedCaptions,
        };
      }

      const response = await ollama.chat({
        model: "ornith:9b",
        messages,
        tools,
        think: false,
        stream: false,
      });
      messages.push(response.message);

      const calls = response.message.tool_calls ?? [];
      if (calls.length === 0) {
        const reply = response.message.content.trim();
        if (!reply) throw new Error("Ollama returned an empty reply");
        return {
          reply,
          ...(collectedScreenshots.length > 0 ? {
            screenshots: collectedScreenshots,
            screenshotCaptions: collectedCaptions,
          } : {}),
          ...(pendingApproval ? { approval: pendingApproval } : {}),
        };
      }

      if (calls.some(call => clientToolNames.includes(call.function.name))) {
        if (calls.length !== 1) {
          for (const call of calls) messages.push({ role: 'tool', tool_name: call.function.name, content: 'No tools executed. Request one tool at a time for client actions.' });
          continue;
        }
        const call = calls[0];
        try {
          return await pauseForClient(call.function.name, call.function.arguments, conversationId, { messages, turn: turn + 1 });
        } catch (error) {
          messages.push({ role: 'tool', tool_name: call.function.name, content: error instanceof Error ? error.message : 'Invalid client action' });
          continue;
        }
      }

      for (const call of calls) {
        if (abortController.signal.aborted) {
          log.info("Tool execution aborted by newer message", { conversationId, tool: call.function.name });
          await browserCloseTool.run().catch(() => {});
          return {
            reply: "Browsing was stopped because a new message was received.",
            screenshots: collectedScreenshots,
            screenshotCaptions: collectedCaptions,
          };
        }

        log.info("Executing agent tool", { tool: call.function.name });
        const toolRes = await executeTool(call.function.name, call.function.arguments);
        const content = typeof toolRes === "string" ? toolRes : toolRes.content;

        if (typeof toolRes !== "string") {
          if (toolRes.screenshot) {
            collectedScreenshots.push(toolRes.screenshot);
            if (toolRes.caption) collectedCaptions.push(toolRes.caption);
          }
          if (toolRes.approval) {
            pendingApproval = toolRes.approval;
          }
        }

        messages.push({
          role: "tool",
          tool_name: call.function.name,
          content,
        });
      }
    }

    throw new Error("Ash reached the agent turn limit without a final answer");
  } finally {
    activeRuns.delete(conversationId);
  }
}
