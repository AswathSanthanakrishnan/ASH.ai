import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Alert, Linking, Platform } from 'react-native';

export interface ClientAction { actionId: string; type: string; params: { title?: string; body?: string; at?: string; id?: string } }
export interface ToolResult { actionId: string; ok: boolean; summary: string }
export interface Reminder { id: string; title: string; body: string; at: string }
Notifications.setNotificationHandler({ handleNotification: async () => ({ shouldPlaySound: true, shouldSetBadge: false, shouldShowBanner: true, shouldShowList: true }) });

export async function listReminders(): Promise<Reminder[]> {
  const items = await Notifications.getAllScheduledNotificationsAsync();
  return items.filter(item => item.content.data?.ashReminder === true).map(item => ({
    id: item.identifier, title: item.content.title ?? '', body: item.content.body ?? '', at: String(item.content.data?.at),
  })).sort((a, b) => Date.parse(a.at) - Date.parse(b.at));
}
export async function cancelReminder(id: string): Promise<void> {
  const items = await listReminders();
  if (!items.some(item => item.id === id)) throw new Error('Reminder not found or already delivered.');
  await Notifications.cancelScheduledNotificationAsync(id);
}
async function permission(): Promise<boolean> {
  if (Platform.OS === 'android') await Notifications.setNotificationChannelAsync('reminders', { name: 'Reminders', importance: Notifications.AndroidImportance.HIGH });
  let status = await Notifications.getPermissionsAsync();
  if (status.granted) return true;
  if (status.canAskAgain) {
    const proceed = await new Promise<boolean>(resolve => Alert.alert('Enable reminders', 'Ash needs notification permission to show reminders at the time you choose.', [
      { text: 'Not now', style: 'cancel', onPress: () => resolve(false) },
      { text: 'Continue', onPress: () => resolve(true) },
    ], { cancelable: false }));
    if (!proceed) return false;
    status = await Notifications.requestPermissionsAsync();
  }
  if (status.granted) return true;
  Alert.alert('Notifications are disabled', 'Enable notifications for Ash in Settings to receive reminders.', [
    { text: 'Cancel', style: 'cancel' }, { text: 'Settings', onPress: () => { void Linking.openSettings(); } },
  ]);
  return false;
}
export async function executeClientAction(action: ClientAction, conversationId: string): Promise<ToolResult> {
  const key = `ash.action.${action.actionId}`;
  const cached = await AsyncStorage.getItem(key);
  if (cached) return JSON.parse(cached) as ToolResult;
  let result: ToolResult;
  try {
    let summary: string;
    const p = action.params;
    if (action.type === 'schedule_reminder') {
      if (!p.title?.trim() || typeof p.body !== 'string' || !p.at || !/T.*(Z|[+-]\d{2}:\d{2})$/.test(p.at) || !Number.isFinite(Date.parse(p.at))) throw new Error('Invalid reminder title, body, or timezone-qualified time.');
      const id = `ash-${action.actionId}`;
      const existing = (await listReminders()).find(item => item.id === id);
      if (!existing) {
        if (!await permission()) throw new Error('Permission denied. Reminders are unavailable until notifications are enabled in Settings.');
        if (Date.parse(p.at) <= Date.now()) throw new Error('Reminder time has passed. Please choose a future time.');
        await Notifications.scheduleNotificationAsync({ identifier: id,
          content: { title: p.title, body: p.body, sound: 'default', data: { ashReminder: true, at: p.at, conversationId } },
          trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: new Date(p.at), channelId: 'reminders' },
        });
      }
      summary = JSON.stringify({ id, title: p.title, body: p.body, at: p.at });
    } else if (action.type === 'list_reminders') {
      summary = JSON.stringify(await listReminders());
    } else if (action.type === 'cancel_reminder') {
      if (!p.id) throw new Error('Reminder id is required.');
      await cancelReminder(p.id); summary = `Cancelled reminder ${p.id}.`;
    } else throw new Error('Unsupported client action.');
    result = { actionId: action.actionId, ok: true, summary };
  } catch (error) { result = { actionId: action.actionId, ok: false, summary: error instanceof Error ? error.message : 'Reminder action failed.' }; }
  await AsyncStorage.setItem(key, JSON.stringify(result));
  return result;
}
