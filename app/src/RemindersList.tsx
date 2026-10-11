import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { cancelReminder, listReminders, type Reminder } from './reminders';
import type { Palette } from './theme';
export function RemindersList({ colors }: { colors: Palette }) {
  const [items, setItems] = useState<Reminder[]>([]);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState('');
  useEffect(() => { void listReminders().then(setItems).catch(() => setError('Could not load reminders.')).finally(() => setBusy(false)); }, []);
  async function remove(id: string) {
    setBusy(true); setError('');
    try { await cancelReminder(id); setItems(await listReminders()); }
    catch { setError('Could not delete reminder.'); }
    finally { setBusy(false); }
  }
  return <ScrollView style={{ maxHeight: 350 }}>
    {busy && <ActivityIndicator color={colors.muted} />}
    {!!error && <Text style={{ color: colors.error }}>{error}</Text>}
    {!busy && items.length === 0 && <Text style={{ color: colors.muted, paddingVertical: 20 }}>No scheduled reminders.</Text>}
    {items.map(item => <View key={item.id} style={{ flexDirection: 'row', paddingVertical: 16, borderBottomWidth: 1, borderColor: colors.line, alignItems: 'center' }}>
      <View style={{ flex: 1 }}><Text style={{ color: colors.text }}>{item.title}</Text><Text style={{ color: colors.muted, marginTop: 6 }}>{new Date(item.at).toLocaleString()}</Text></View>
      <Pressable accessibilityRole="button" accessibilityLabel={`Delete ${item.title}`} disabled={busy} onPress={() => void remove(item.id)} style={{ padding: 12 }}><Text style={{ color: colors.error }}>Delete</Text></Pressable>
    </View>)}
  </ScrollView>;
}
