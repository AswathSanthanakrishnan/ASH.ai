import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Modal, Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { deleteConversation, listConversations, type Conversation } from './api';
import type { Palette } from './theme';

function relativeTime(date: string): string {
  const minutes = Math.max(0, Math.floor((Date.now() - Date.parse(date)) / 60000));
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  if (minutes < 1440) return `${Math.floor(minutes / 60)}h ago`;
  return `${Math.floor(minutes / 1440)}d ago`;
}
interface Props {
  visible: boolean; colors: Palette; activeId?: string; busy: boolean; error: string | null;
  onDeleted: (id: string) => void;
  onClose: () => void; onNew: () => void; onSelect: (id: string) => void; onAppearance: () => void;
}
export function ConversationDrawer(props: Props) {
  const { visible, colors, busy } = props;
  const [items, setItems] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [retry, setRetry] = useState(0);
  const [deleting, setDeleting] = useState(false);
  const deletingRef = useRef(false);
  const blocked = busy || loading || deleting;

  async function remove(id: string) {
    if (deletingRef.current || busy || loading) return;
    deletingRef.current = true;
    setDeleting(true); setError(null);
    try {
      await deleteConversation(id);
      setItems(previous => previous.filter(item => item.id !== id));
      props.onDeleted(id);
      setRetry(value => value + 1);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not delete conversation. Please try again.');
    } finally { deletingRef.current = false; setDeleting(false); }
  }
  function confirmDelete(id: string) {
    Alert.alert('Delete this chat?', 'This permanently removes all its messages.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => void remove(id) },
    ]);
  }
  function showOptions(item: Conversation) {
    if (blocked) return;
    Alert.alert(item.title, undefined, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => confirmDelete(item.id) },
    ]);
  }
  function close() { if (!deletingRef.current) props.onClose(); }

  useEffect(() => {
    if (!visible) return;
    let active = true;
    setLoading(true); setError(null);
    void listConversations().then(data => { if (active) setItems(data); })
      .catch((err: unknown) => { if (active) setError(err instanceof Error ? err.message : 'Could not load conversations.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [visible, retry]);
  return <Modal visible={visible} transparent animationType="fade" onRequestClose={close}>
    <View style={{ flex: 1, flexDirection: 'row', backgroundColor: '#00000066' }}>
      <SafeAreaView style={{ width: '86%', maxWidth: 380, backgroundColor: colors.background, padding: 24 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
          <Text style={{ color: colors.text, fontSize: 25, fontWeight: '600' }}>Conversations</Text>
          <Pressable accessibilityRole="button" accessibilityLabel="Close conversations" onPress={close} style={{ padding: 12 }}><Text style={{ color: colors.muted }}>✕</Text></Pressable>
        </View>
        <Pressable accessibilityRole="button" disabled={blocked} onPress={props.onNew} style={{ padding: 16, borderRadius: 14, backgroundColor: colors.user, marginBottom: 20 }}><Text style={{ color: colors.text, fontWeight: '600' }}>＋ New chat</Text></Pressable>
        {(loading || busy || deleting) && <ActivityIndicator color={colors.muted} />}
        {(error || props.error) && <Text accessibilityLiveRegion="polite" style={{ color: colors.error, marginVertical: 12 }}>{error ?? props.error}</Text>}
        {error && <Pressable accessibilityRole="button" disabled={blocked} onPress={() => setRetry(value => value + 1)} style={{ padding: 12 }}><Text style={{ color: colors.accent }}>Retry</Text></Pressable>}
        <FlatList data={items} keyExtractor={item => item.id} style={{ flex: 1 }}
          ListEmptyComponent={!loading && !error ? <Text style={{ color: colors.muted }}>Your conversations will appear here.</Text> : null}
          renderItem={({ item }) => <Pressable accessibilityRole="button" accessibilityState={{ selected: item.id === props.activeId, disabled: blocked }} disabled={blocked} onPress={() => props.onSelect(item.id)} onLongPress={() => showOptions(item)} accessibilityHint="Long press for the Delete option"
            style={{ padding: 14, borderRadius: 12, marginBottom: 6, backgroundColor: item.id === props.activeId ? colors.surface : 'transparent' }}>
            <Text numberOfLines={2} style={{ color: colors.text, fontSize: 15, lineHeight: 22 }}>{item.title}</Text>
            <Text style={{ color: colors.muted, fontSize: 11, marginTop: 6 }}>{relativeTime(item.updated_at)}</Text>
          </Pressable>} />
        <Pressable accessibilityRole="button" disabled={blocked} onPress={props.onAppearance} style={{ paddingVertical: 18, borderTopWidth: 1, borderColor: colors.line }}><Text style={{ color: colors.muted }}>Settings</Text></Pressable>
      </SafeAreaView>
      <Pressable accessibilityRole="button" accessibilityLabel="Close drawer" onPress={close} style={{ flex: 1 }} />
    </View>
  </Modal>;
}
