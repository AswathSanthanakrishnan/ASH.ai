import { randomUUID } from 'node:crypto';
import type { Message } from 'ollama';
import { APIError } from 'encore.dev/api';
import { db } from './db';

export interface ClientAction {
  actionId: string;
  type: string;
  params: { title?: string; body?: string; at?: string; id?: string };
}
export interface ToolResult { actionId: string; ok: boolean; summary: string }
export interface AgentReply {
  reply: string;
  clientAction?: ClientAction;
  screenshots?: string[];
  screenshotCaptions?: string[];
  approval?: { action: string; description: string };
}
export interface PendingState { messages: Message[]; turn: number }
export const clientToolNames = ['schedule_reminder', 'list_reminders', 'cancel_reminder'];

export async function pauseForClient(type: string, args: Record<string, unknown>, conversationId: string, state: PendingState): Promise<AgentReply> {
  const params: ClientAction['params'] = {};
  if (type === 'schedule_reminder') {
    if (typeof args.title !== 'string' || !args.title.trim() || typeof args.body !== 'string' || typeof args.at !== 'string'
      || !/T.*(Z|[+-]\d{2}:\d{2})$/.test(args.at) || !Number.isFinite(Date.parse(args.at)) || Date.parse(args.at) <= Date.now()) {
      throw APIError.invalidArgument('Reminder needs title, body, and a future ISO datetime with timezone');
    }
    params.title = args.title; params.body = args.body; params.at = args.at;
  } else if (type === 'cancel_reminder') {
    if (typeof args.id !== 'string' || !args.id.trim()) throw APIError.invalidArgument('Reminder id is required');
    params.id = args.id;
  }
  const clientAction: ClientAction = { actionId: randomUUID(), type, params };
  await db.exec`INSERT INTO client_actions (id, conversation_id, action_type, state) VALUES (${clientAction.actionId}, ${conversationId}, ${type}, ${JSON.stringify(state)})`;
  return { reply: '', clientAction };
}
