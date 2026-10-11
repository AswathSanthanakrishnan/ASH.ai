import { api, APIError } from "encore.dev/api";
import { Service } from "encore.dev/service";
import { runAgent, abortConversation } from "./agent";
import { type ClientAction, type ToolResult, type PendingState } from "./client-actions";
import { db } from "./db";
import log from "encore.dev/log";
import { createConversation, requireConversation, saveMessage, validateConversationId } from "./conversations";

export default new Service("chat");

interface ChatRequest {
  message?: string;
  toolResult?: ToolResult;
  conversationId?: string;
}

interface ChatResponse {
  reply: string;
  clientAction?: ClientAction;
  conversationId: string;
  screenshots?: string[];
  screenshotCaptions?: string[];
  approval?: { action: string; description: string };
}

interface MessageRow {
  role: string;
  content: string;
}

export const chat = api(
  { expose: true, method: "POST", path: "/chat" },
  async ({ message, conversationId, toolResult }: ChatRequest): Promise<ChatResponse> => {
    if (toolResult) {
      if (message !== undefined || !conversationId || toolResult.summary.length > 20000) throw APIError.invalidArgument('Tool result requires conversationId and no message');
      await requireConversation(conversationId);
      validateConversationId(toolResult.actionId);
      const action = await db.queryRow<{ state: string; action_type: string; response: string | null }>`
        SELECT state, action_type, response FROM client_actions WHERE id = ${toolResult.actionId} AND conversation_id = ${conversationId}
      `;
      if (!action) throw APIError.notFound('Client action not found');
      if (action.response) return JSON.parse(action.response) as ChatResponse;
      const claimed = await db.queryRow<{ id: string }>`UPDATE client_actions SET processing = TRUE WHERE id = ${toolResult.actionId} AND processing = FALSE AND response IS NULL RETURNING id`;
      if (!claimed) throw APIError.aborted('Client action is already processing; retry shortly');
      try {
        const state = JSON.parse(action.state) as PendingState;
        state.messages.push({ role: 'tool', tool_name: action.action_type, content: JSON.stringify({ ok: toolResult.ok, summary: toolResult.summary }) });
        const result = await runAgent('', [], conversationId, state);
        const response = { ...result, conversationId };
        if (result.reply) await saveMessage(conversationId, 'assistant', result.reply);
        await db.exec`UPDATE client_actions SET response = ${JSON.stringify(response)}, processing = FALSE WHERE id = ${toolResult.actionId}`;
        return response;
      } catch (error) {
        await db.exec`UPDATE client_actions SET processing = FALSE WHERE id = ${toolResult.actionId}`;
        throw error;
      }
    }
    const content = message?.trim();
    if (!content) {
      throw APIError.invalidArgument("message must not be empty");
    }

    if (conversationId !== undefined) await requireConversation(conversationId);
    const id = conversationId ?? (await createConversation()).id;
    abortConversation(id);

    // Select the newest 20 first, then present them oldest to newest.
    // Load before saving this turn so the new message appears only once.
    const rows = db.query<MessageRow>`
      SELECT role, content
      FROM (
        SELECT id, role, content, created_at
        FROM messages
        WHERE conversation_id = ${id}
        ORDER BY created_at DESC, id DESC
        LIMIT 20
      ) AS recent_messages
      ORDER BY created_at ASC, id ASC
    `;
    const history: MessageRow[] = [];
    for await (const row of rows) {
      history.push(row);
    }
    // Temporary diagnostic: do not log private message contents.
    log.info("Chat history loaded", { historyCount: history.length });

    await saveMessage(id, "user", content);
    const result = await runAgent(content, history, id);
    if (result.reply) await saveMessage(id, "assistant", result.reply);
    return { ...result, conversationId: id };
  },
);
