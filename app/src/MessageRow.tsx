import { memo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { ChatMessage } from './api';
import type { Palette } from './theme';
import { ReplyText } from './ReplyText';
import { ChatScreenshot } from './ChatScreenshot';

interface Props {
  item: ChatMessage;
  colors: Palette;
  onApprove?: (action: string) => void;
  onReject?: (action: string) => void;
}

export const MessageRow = memo(function MessageRow({ item, colors, onApprove, onReject }: Props) {
  if (item.role === 'user') {
    return (
      <View style={[styles.message, styles.user]}>
        <Text style={[styles.author, { color: colors.muted }]}>YOU</Text>
        <View style={[styles.bubble, { backgroundColor: colors.user }]}>
          <Text selectable style={[styles.messageText, { color: colors.text }]}>{item.content}</Text>
        </View>
      </View>
    );
  }

  const hasScreenshots = !!(item.screenshots && item.screenshots.length > 0);
  const hasApproval = !!item.approval;

  return (
    <View style={[styles.message, styles.assistant, (hasScreenshots || hasApproval) && styles.fullWidth]}>
      <Text style={[styles.author, { color: colors.muted }]}>ASH</Text>

      {/* Browsing story: screenshots with narration captions in chronological order */}
      {hasScreenshots && (
        <View style={styles.storyWrap}>
          {item.screenshots?.map((screenshot, idx) => (
            <ChatScreenshot
              key={`${item.id}-screenshot-${idx}`}
              base64={screenshot}
              caption={item.captions?.[idx]}
              colors={colors}
            />
          ))}
        </View>
      )}

      {/* Final summary text rendered after screenshots */}
      {!!item.content && (
        <View style={[styles.summaryWrap, hasScreenshots && styles.summaryAfterScreenshots]}>
          <ReplyText content={item.content} colors={colors} />
        </View>
      )}

      {/* Consequential action approval inline prompt */}
      {hasApproval && item.approval && (
        <View style={[styles.approvalCard, { backgroundColor: colors.surface, borderColor: colors.line }]}>
          <View style={styles.approvalHeader}>
            <View style={[styles.approvalBadge, { backgroundColor: colors.accent }]}>
              <Text style={[styles.approvalBadgeText, { color: colors.onAccent }]}>Approval Needed</Text>
            </View>
            <Text style={[styles.approvalAction, { color: colors.text }]}>{item.approval.action}</Text>
          </View>
          <Text style={[styles.approvalDesc, { color: colors.muted }]}>
            {item.approval.description}
          </Text>
          <View style={styles.approvalActions}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Yes, continue"
              onPress={() => onApprove?.(item.approval!.action)}
              style={[styles.approvalBtn, { backgroundColor: colors.accent }]}
            >
              <Text style={[styles.approvalBtnText, { color: colors.onAccent, fontWeight: '600' }]}>Yes, continue</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="No, stop"
              onPress={() => onReject?.(item.approval!.action)}
              style={[styles.approvalBtn, styles.approvalBtnSecondary, { borderColor: colors.line }]}
            >
              <Text style={[styles.approvalBtnText, { color: colors.text }]}>No, stop</Text>
            </Pressable>
          </View>
        </View>
      )}
    </View>
  );
}, (previous, next) =>
  previous.colors === next.colors
  && previous.item.id === next.item.id
  && previous.item.role === next.item.role
  && previous.item.content === next.item.content
  && previous.item.screenshots === next.item.screenshots
  && previous.item.captions === next.item.captions
  && previous.item.approval?.action === next.item.approval?.action
  && previous.item.approval?.description === next.item.approval?.description
  && previous.onApprove === next.onApprove
  && previous.onReject === next.onReject
);

const styles = StyleSheet.create({
  message: { marginBottom: 28, maxWidth: '92%' },
  user: { alignSelf: 'flex-end', alignItems: 'flex-end' },
  assistant: { alignSelf: 'flex-start' },
  fullWidth: { maxWidth: '100%', width: '100%' },
  author: { fontSize: 10, letterSpacing: 1.6, marginBottom: 9, fontWeight: '600' },
  bubble: { paddingHorizontal: 17, paddingVertical: 12, borderRadius: 20, borderBottomRightRadius: 5 },
  messageText: { fontSize: 16, lineHeight: 25 },
  storyWrap: { width: '100%', marginBottom: 10 },
  summaryWrap: { width: '100%' },
  summaryAfterScreenshots: { marginTop: 4 },
  approvalCard: {
    marginTop: 14,
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    width: '100%',
  },
  approvalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  approvalBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  approvalBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  approvalAction: {
    fontSize: 15,
    fontWeight: '600',
    flex: 1,
  },
  approvalDesc: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 14,
  },
  approvalActions: {
    flexDirection: 'row',
    gap: 10,
  },
  approvalBtn: {
    flex: 1,
    paddingVertical: 11,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  approvalBtnSecondary: {
    borderWidth: 1,
  },
  approvalBtnText: {
    fontSize: 14,
  },
});
