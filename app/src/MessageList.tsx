import { memo, useCallback, useRef } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View, type ListRenderItemInfo } from 'react-native';
import type { ChatMessage } from './api';
import type { Palette } from './theme';
import { MessageRow } from './MessageRow';

interface Props {
  messages: ChatMessage[];
  colors: Palette;
  loading: boolean;
  failure: { message: string; reason: string } | null;
  onRetry: () => void;
  onApprove?: (action: string) => void;
  onReject?: (action: string) => void;
}
const messageKey = (item: ChatMessage): string => item.id;

// Draft and voice transcription updates never enter this memoized subtree.
export const MessageList = memo(function MessageList({ messages, colors, loading, failure, onRetry, onApprove, onReject }: Props) {
  const list = useRef<FlatList<ChatMessage>>(null);
  const renderItem = useCallback(({ item }: ListRenderItemInfo<ChatMessage>) => (
    <MessageRow item={item} colors={colors} onApprove={onApprove} onReject={onReject} />
  ), [colors, onApprove, onReject]);
  const scrollToEnd = useCallback(() => list.current?.scrollToEnd({ animated: true }), []);
  return <FlatList ref={list} data={messages} keyExtractor={messageKey} style={styles.body}
        contentContainerStyle={[styles.history, messages.length === 0 && styles.emptyList]}
        windowSize={7} maxToRenderPerBatch={8} initialNumToRender={12}
        updateCellsBatchingPeriod={50}
        keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag"
        onContentSizeChange={scrollToEnd}
        onLayout={scrollToEnd}
        ListEmptyComponent={<View style={styles.welcome}>
          <Text style={[styles.eyebrow, { color: colors.muted }]}>YOUR PERSONAL ASSISTANT</Text>
          <Text style={[styles.welcomeTitle, { color: colors.text }]}>Room to think.</Text>
          <Text style={[styles.welcomeBody, { color: colors.muted }]}>Ask a question. Follow a curiosity.{ '\n' }Let’s take it from there.</Text>
        </View>}
        renderItem={renderItem}
        ListFooterComponent={failure ? (
          <View accessibilityLiveRegion="polite" style={[styles.error, { backgroundColor: colors.surface }]}>
            <Text style={{ color: colors.error, lineHeight: 22, flex: 1 }}>{failure.reason}</Text>
            <Pressable accessibilityRole="button" onPress={onRetry} style={styles.retry}><Text style={{ color: colors.accent, fontWeight: '600' }}>Retry</Text></Pressable>
          </View>
        ) : null}
      />;
});

const styles = StyleSheet.create({
  body: { flex: 1 },
  history: { padding: 24, paddingBottom: 12 }, emptyList: { flexGrow: 1, justifyContent: 'center' },
  welcome: { marginBottom: 70 }, eyebrow: { fontSize: 10, letterSpacing: 2, marginBottom: 20 },
  welcomeTitle: { fontSize: 39, letterSpacing: -1.5, fontWeight: '500', marginBottom: 15 }, welcomeBody: { fontSize: 16, lineHeight: 27 },
  error: { borderRadius: 14, padding: 14, flexDirection: 'row', alignItems: 'center', marginBottom: 16 }, retry: { padding: 12 },
});
