import { randomUUID } from "node:crypto";
import { api, APIError } from "encore.dev/api";
import { db } from "./db";

interface ConversationRow {
  id: string;
  title: string;
  created_at: Date;
  updated_at: Date;
}
export interface Conversation {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
}
interface ConversationId { id: string }
interface SavedMessage {
  id: number;
  role: string;
  content: string;
  created_at: string;
}

export function validateConversationId(id: string): void {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
    throw APIError.invalidArgument("Invalid conversation id");
  }
}
export async function requireConversation(id: string): Promise<void> {
  validateConversationId(id);
  const row = await db.queryRow<{ id: string }>`SELECT id FROM conversations WHERE id = ${id}`;
  if (!row) throw APIError.notFound("Conversation not found");
}
export async function createConversation(): Promise<Conversation> {
  const row = await db.queryRow<ConversationRow>`
    INSERT INTO conversations (id) VALUES (${randomUUID()}) RETURNING *
  `;
  if (!row) throw APIError.internal("Could not create conversation");
  return { ...row, created_at: row.created_at.toISOString(), updated_at: row.updated_at.toISOString() };
}

export const create = api({ expose: true, method: "POST", path: "/conversations" },
  async (): Promise<Conversation> => createConversation());

export const list = api({ expose: true, method: "GET", path: "/conversations" },
  async (): Promise<{ conversations: Conversation[] }> => {
    const conversations: Conversation[] = [];
    for await (const row of db.query<ConversationRow>`SELECT * FROM conversations ORDER BY updated_at DESC, id DESC`) {
      conversations.push({ ...row, created_at: row.created_at.toISOString(), updated_at: row.updated_at.toISOString() });
    }
    return { conversations };
  });

export const history = api({ expose: true, method: "GET", path: "/conversations/:id/messages" },
  async ({ id }: ConversationId): Promise<{ messages: SavedMessage[] }> => {
    await requireConversation(id);
    const messages: SavedMessage[] = [];
    for await (const row of db.query<{ id: number; role: string; content: string; created_at: Date }>`
      SELECT id, role, content, created_at FROM messages
      WHERE conversation_id = ${id} ORDER BY created_at ASC, id ASC
    `) {
      messages.push({ ...row, created_at: row.created_at.toISOString() });
    }
    return { messages };
  });

export const remove = api({ expose: true, method: "DELETE", path: "/conversations/:id" },
  async ({ id }: ConversationId): Promise<void> => {
    validateConversationId(id);
    const row = await db.queryRow<{ id: string }>`DELETE FROM conversations WHERE id = ${id} RETURNING id`;
    if (!row) throw APIError.notFound("Conversation not found");
  });

export async function saveMessage(conversationId: string, role: "user" | "assistant", content: string): Promise<void> {
  const title = Array.from(content.replace(/\s+/g, " ").trim()).slice(0, 40).join("");
  // Lock/update the parent and insert the message in one statement.
  const saved = await db.queryRow<{ id: number }>`
    WITH updated AS (
      UPDATE conversations SET updated_at = NOW(),
        title = CASE WHEN ${role} = 'user' AND NOT EXISTS (
          SELECT 1 FROM messages WHERE conversation_id = ${conversationId} AND role = 'user'
        ) THEN ${title} ELSE title END
      WHERE id = ${conversationId} RETURNING id
    )
    INSERT INTO messages (conversation_id, role, content)
    SELECT id, ${role}, ${content} FROM updated RETURNING id
  `;
  if (!saved) throw APIError.notFound("Conversation was deleted");
}
