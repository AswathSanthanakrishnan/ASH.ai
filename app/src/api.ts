import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_BASE_URL } from './config';

// Paused: reminders and client actions are on hold, so reminders.ts (which
// needs the missing native notifications module) stays out of the bundle.
// These mirror the backend contract until the feature resumes.
export interface ClientAction { actionId: string; type: string; params: { title?: string; body?: string; at?: string; id?: string } }
export interface ToolResult { actionId: string; ok: boolean; summary: string }
async function executeClientAction(_action: ClientAction, _conversationId: string): Promise<ToolResult> {
  throw new Error('Client actions are paused.');
}

export interface ApprovalRequest {
  action: string;
  description: string;
}

export interface Conversation { id: string; title: string; updated_at: string }
export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  screenshots?: string[];
  captions?: string[];
  approval?: ApprovalRequest;
}
export interface ChatReply {
  reply: string;
  conversationId: string;
  clientAction?: ClientAction;
  screenshots?: string[];
  screenshotCaptions?: string[];
  approval?: ApprovalRequest;
}

async function request(path: string, method = 'GET', body?: object): Promise<unknown> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 240_000);
  try {
    let response: Response;
    try {
      response = await fetch(`${API_BASE_URL}${path}`, {
        method, headers: { 'Content-Type': 'application/json' },
        body: body === undefined ? undefined : JSON.stringify(body), signal: controller.signal,
      });
    } catch { throw new Error("Can't reach the server. Is `encore run` running?"); }
    if (!response.ok) throw new Error(response.status === 404 ? 'Conversation not found.' : 'Ash could not complete the request. Please try again.');
    if (response.status === 204 || method === 'DELETE') return undefined;
    return response.json();
  } finally { clearTimeout(timeout); }
}
function isObject(value: unknown): value is Record<string, unknown> { return !!value && typeof value === 'object'; }
function isConversation(value: unknown): value is Conversation {
  return isObject(value) && typeof value.id === 'string' && typeof value.title === 'string' && typeof value.updated_at === 'string';
}
export async function createConversation(): Promise<Conversation> {
  const data = await request('/conversations', 'POST', {});
  if (!isConversation(data)) throw new Error('Unexpected conversation response.');
  return data;
}
export async function listConversations(): Promise<Conversation[]> {
  const data = await request('/conversations');
  if (!isObject(data) || !Array.isArray(data.conversations) || !data.conversations.every(isConversation)) throw new Error('Unexpected conversation list.');
  return data.conversations;
}
export async function loadMessages(id: string): Promise<ChatMessage[]> {
  const data = await request(`/conversations/${encodeURIComponent(id)}/messages`);
  if (!isObject(data) || !Array.isArray(data.messages)) throw new Error('Unexpected message history.');
  return data.messages.map((item: unknown) => {
    if (!isObject(item) || typeof item.id !== 'number' || (item.role !== 'user' && item.role !== 'assistant') || typeof item.content !== 'string') throw new Error('Unexpected message in history.');
    return { id: `saved-${item.id}`, role: item.role, content: item.content };
  });
}
export async function sendMessage(message: string, conversationId: string): Promise<ChatReply> {
  // Persist the handoff before native execution: a network retry must not reschedule.
  const key = `ash.pending.${conversationId}`;
  const pending = await AsyncStorage.getItem(key);
  let data: unknown;
  if (pending) {
    const action = JSON.parse(pending) as ClientAction;
    const toolResult: ToolResult = await executeClientAction(action, conversationId);
    data = await request('/chat', 'POST', { toolResult, conversationId });
  } else data = await request('/chat', 'POST', { message, conversationId });
  for (let step = 0; step < 11; step++) {
    if (!isObject(data) || typeof data.reply !== 'string' || data.conversationId !== conversationId) throw new Error('Unexpected chat response.');
    if (!data.clientAction) {
      await AsyncStorage.removeItem(key);
      const screenshots = Array.isArray(data.screenshots) ? (data.screenshots as string[]) : undefined;
      const screenshotCaptions = Array.isArray(data.screenshotCaptions) ? (data.screenshotCaptions as string[]) : undefined;
      const approval = isObject(data.approval) && typeof data.approval.action === 'string' && typeof data.approval.description === 'string'
        ? { action: data.approval.action, description: data.approval.description }
        : undefined;
      return { reply: data.reply, conversationId, screenshots, screenshotCaptions, approval };
    }
    const action = data.clientAction;
    if (!isObject(action) || typeof action.actionId !== 'string' || typeof action.type !== 'string' || !isObject(action.params)) throw new Error('Invalid client action.');
    const typed = action as unknown as ClientAction;
    await AsyncStorage.setItem(key, JSON.stringify(typed));
    const toolResult = await executeClientAction(typed, conversationId);
    data = await request('/chat', 'POST', { toolResult, conversationId });
  }
  throw new Error('Too many client actions. Please try again.');
}

export async function deleteConversation(id: string): Promise<void> {
  await request(`/conversations/${encodeURIComponent(id)}`, 'DELETE');
}
