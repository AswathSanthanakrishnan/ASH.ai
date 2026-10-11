import { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, KeyboardAvoidingView, Modal, Platform, Pressable, StyleSheet, Text, TextInput, useColorScheme, useWindowDimensions, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { StatusBar } from 'expo-status-bar';
import { sendMessage, createConversation, loadMessages, type ChatMessage } from './src/api';
import { ConversationDrawer } from './src/ConversationDrawer';
import { MicIcon } from './src/MicIcon';
import { MessageList } from './src/MessageList';
import { CompanionCharacter, type CompanionState, type CompanionSize, type CompanionMood } from './src/CompanionCharacter';
import { themes, type ThemeMode } from './src/theme';
import { useVoiceInput } from './src/useVoiceInput';

interface FailedMessage { message: string; reason: string }

export default function App() { return <SafeAreaProvider><Chat /></SafeAreaProvider>; }

function Chat() {
  const system = useColorScheme();
  const [mode, setMode] = useState<ThemeMode>('dark');
  const [settings, setSettings] = useState(false);
  const [drawer, setDrawer] = useState(false);
  const [conversationId, setConversationId] = useState<string>();
  const conversationRef = useRef<string | undefined>(undefined);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState('');
  const [loading, setLoading] = useState(false);
  const [failure, setFailure] = useState<FailedMessage | null>(null);
  const inFlight = useRef(false);
  const sequence = useRef(0);
  const dark = mode === 'system' ? system !== 'light' : mode === 'dark';
  const colors = themes[dark ? 'dark' : 'light'];
  const draftRef = useRef(draft);
  draftRef.current = draft;

  const resetInactivityRef = useRef<() => void>(() => {});

  const {
    isListening,
    permissionNotice,
    toggleListening,
    stopListening,
    openSettings,
    dismissPermissionNotice,
  } = useVoiceInput({
    onTranscript: (updated) => {
      resetInactivityRef.current();
      setDraft(updated);
    },
    getDraft: () => draftRef.current,
  });

  const { width: screenWidth } = useWindowDimensions();
  const companionX = useRef(new Animated.Value(0)).current;
  const [isSleeping, setIsSleeping] = useState(false);
  const [companionMode, setCompanionMode] = useState<CompanionSize | 'hidden'>('large');
  const [companionMood, setCompanionMood] = useState<CompanionMood>('neutral');
  const moodTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [celebrateCount, setCelebrateCount] = useState(0);

  const companionState: CompanionState = failure
    ? 'error'
    : loading
    ? 'thinking'
    : isListening
    ? 'listening'
    : isSleeping
    ? 'sleeping'
    : 'idle';
  const inactivityTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const resetInactivity = useCallback(() => {
    if (inactivityTimer.current) {
      clearTimeout(inactivityTimer.current);
      inactivityTimer.current = null;
    }
    setIsSleeping(false);
    if (!loading && !isListening) {
      inactivityTimer.current = setTimeout(() => {
        setIsSleeping(true);
      }, 45_000);
    }
  }, [loading, isListening]);
  resetInactivityRef.current = resetInactivity;

  useEffect(() => {
    if (loading || isListening) {
      if (inactivityTimer.current) {
        clearTimeout(inactivityTimer.current);
        inactivityTimer.current = null;
      }
      setIsSleeping(false);
    } else {
      resetInactivity();
    }
    return () => {
      if (inactivityTimer.current) {
        clearTimeout(inactivityTimer.current);
        inactivityTimer.current = null;
      }
    };
  }, [loading, isListening, resetInactivity]);

  const isLarge = companionMode === 'large';
  const sidebarOffset = isLarge ? 70 : 58;
  const sidebarTarget = -Math.max(10, screenWidth / 2 - sidebarOffset);

  useEffect(() => {
    Animated.spring(companionX, {
      toValue: companionState === 'thinking' ? sidebarTarget : 0,
      friction: 7,
      tension: 40,
      useNativeDriver: true,
    }).start();
  }, [companionState, sidebarTarget, companionX]);

  const companionRotate = companionX.interpolate({
    inputRange: [sidebarTarget, 0],
    outputRange: ['-4deg', '0deg'],
    extrapolate: 'clamp',
  });

  useEffect(() => {
    void AsyncStorage.getItem('ash.theme').then(value => {
      if (value === 'dark' || value === 'light' || value === 'system') setMode(value);
    }).catch(() => {});
    void AsyncStorage.getItem('ash.companion_mode').then(val => {
      if (val === 'large' || val === 'standard' || val === 'hidden') {
        setCompanionMode(val);
      }
    }).catch(() => {});
  }, []);

  function chooseTheme(value: ThemeMode) {
    setMode(value);
    void AsyncStorage.setItem('ash.theme', value).catch(() => {});
  }

  function chooseCompanionMode(value: CompanionSize | 'hidden') {
    setCompanionMode(value);
    void AsyncStorage.setItem('ash.companion_mode', value).catch(() => {});
  }

  function newChat() {
    resetInactivity();
    if (inFlight.current) return;
    stopListening();
    conversationRef.current = undefined;
    setConversationId(undefined); setMessages([]); setDraft(''); setFailure(null);
    setHistoryError(null); setDrawer(false);
  }

  async function selectConversation(id: string) {
    resetInactivity();
    if (inFlight.current) return;
    inFlight.current = true;
    stopListening(); setHistoryLoading(true); setHistoryError(null);
    try {
      const history = await loadMessages(id);
      conversationRef.current = id;
      setConversationId(id); setMessages(history); setDraft(''); setFailure(null); setDrawer(false);
    } catch (error) {
      setHistoryError(error instanceof Error ? error.message : 'Could not load conversation.');
    } finally { inFlight.current = false; setHistoryLoading(false); }
  }

  const send = useCallback(async (retry?: string) => {
    resetInactivity();
    stopListening();
    const message = (retry ?? draftRef.current).trim();
    if (!message || inFlight.current) return;
    inFlight.current = true;
    setLoading(true); setFailure(null);
    if (!retry) {
      setMessages(previous => [...previous, { id: String(++sequence.current), role: 'user', content: message }]);
      setDraft('');
    }

    // Sentiment analysis for companion mood reaction
    const positiveWords = /\b(great|awesome|good|happy|yay|congrats|hooray|love|fixed|solved|perfect|working|success|thank|thanks|nice|cool|won|win)\b/i;
    const sadWords = /\b(sad|bad|sucks|terrible|broken|error|fail|failed|crying|upset|hurts|pain|hate|hard|stuck|lost|depressed|unhappy|sick)\b/i;
    if (positiveWords.test(message)) {
      setCompanionMood('happy');
    } else if (sadWords.test(message)) {
      setCompanionMood('sympathetic');
    }
    if (moodTimer.current) clearTimeout(moodTimer.current);
    moodTimer.current = setTimeout(() => {
      setCompanionMood('neutral');
    }, 3200);

    try {
      // Keep the id before model inference so retry stays in this conversation.
      let id = conversationRef.current;
      if (!id) {
        id = (await createConversation()).id;
        conversationRef.current = id;
        setConversationId(id);
      }
      const { reply, screenshots, screenshotCaptions, approval } = await sendMessage(message, id);
      setMessages(previous => [
        ...previous,
        {
          id: String(++sequence.current),
          role: 'assistant',
          content: reply,
          screenshots,
          captions: screenshotCaptions,
          approval,
        },
      ]);
      // Trigger confetti celebration on browser screenshot tasks or completed reply
      if (screenshots && screenshots.length > 0) {
        setCelebrateCount(c => c + 1);
      }
    } catch (error) {
      setFailure({ message, reason: error instanceof Error ? error.message : 'Something went wrong. Please try again.' });
    } finally { inFlight.current = false; setLoading(false); }
  }, [stopListening, resetInactivity]);

  const handleApprove = useCallback((action: string) => {
    void send(`Yes, proceed with ${action}`);
  }, [send]);

  const handleReject = useCallback((_action: string) => {
    void send('No, do not proceed.');
  }, [send]);

  const retryMessage = useCallback(() => {
    if (failure) void send(failure.message);
  }, [failure, send]);

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: colors.background }]}>
      <StatusBar style={dark ? 'light' : 'dark'} />
      <View style={[styles.header, { borderColor: colors.line }]}>
        <View>
          <Text style={[styles.brand, { color: colors.text }]}>Ash<Text style={{ color: colors.accent }}>.</Text></Text>
          <Text style={[styles.subtitle, { color: colors.muted }]}>A little clarity, whenever you need it.</Text>
        </View>
        <Pressable accessibilityRole="button" accessibilityLabel="Conversations" disabled={loading || historyLoading} onPress={() => { stopListening(); setHistoryError(null); setDrawer(true); }} style={[styles.settings, { borderColor: colors.line }]}>
          <Text style={{ color: colors.muted, fontSize: 20 }}>☷</Text>
        </Pressable>
      </View>
      <KeyboardAvoidingView style={styles.body} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        {companionMode !== 'hidden' && (
          <View style={[styles.companionBar, { height: isLarge ? 104 : 86 }]}>
            <Animated.View
              style={[
                styles.companionWrapper,
                {
                  width: isLarge ? 88 : 72,
                  height: isLarge ? 98 : 82,
                  transform: [
                    { translateX: companionX },
                    { rotate: companionRotate },
                  ],
                },
              ]}
            >
              <CompanionCharacter
                state={companionState}
                colors={colors}
                size={companionMode}
                mood={companionMood}
                celebrateTrigger={celebrateCount}
                onPress={resetInactivity}
                onWake={resetInactivity}
              />
            </Animated.View>
          </View>
        )}
        <MessageList
          messages={messages}
          colors={colors}
          loading={loading}
          failure={failure}
          onRetry={retryMessage}
          onApprove={handleApprove}
          onReject={handleReject}
        />
        <View style={styles.composerWrap}>
          {permissionNotice && (
            <View style={[styles.notice, { backgroundColor: colors.surface, borderColor: colors.line }]}>
              <Text style={[styles.noticeText, { color: colors.muted }]}>{permissionNotice}</Text>
              <View style={styles.noticeActions}>
                <Pressable accessibilityRole="button" accessibilityLabel="Open Settings" onPress={openSettings} style={styles.noticeLink}>
                  <Text style={{ color: colors.accent, fontWeight: '600', fontSize: 13 }}>Settings</Text>
                </Pressable>
                <Pressable accessibilityRole="button" accessibilityLabel="Dismiss notice" onPress={dismissPermissionNotice} style={styles.noticeLink}>
                  <Text style={{ color: colors.muted, fontSize: 13 }}>Dismiss</Text>
                </Pressable>
              </View>
            </View>
          )}
          {isListening && (
            <View accessibilityLiveRegion="polite" style={styles.listeningHint}>
              <View style={[styles.listeningDot, { backgroundColor: colors.accent }]} />
              <Text style={[styles.listeningText, { color: colors.muted }]}>Listening… speak now or tap mic to stop</Text>
            </View>
          )}
          <View style={[styles.composer, { backgroundColor: colors.surface, borderColor: colors.line }]}>
            <TextInput accessibilityLabel="Message Ash" placeholder={isListening ? "Listening…" : "Message Ash…"} placeholderTextColor={colors.muted}
              value={draft} onChangeText={(text) => { setDraft(text); resetInactivity(); }} multiline editable={!loading && !failure}
              style={[styles.input, { color: colors.text }]} />
            <View style={styles.actions}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={isListening ? "Stop listening" : "Start voice input"}
                accessibilityState={{ selected: isListening, disabled: loading || !!failure }}
                disabled={loading || !!failure}
                onPress={() => { resetInactivity(); toggleListening(); }}
                style={[
                  styles.actionBtn,
                  styles.micBtn,
                  isListening
                    ? { backgroundColor: colors.accent, borderColor: colors.accent }
                    : { borderColor: colors.line },
                  (loading || failure) && { opacity: 0.4 },
                ]}
              >
                <MicIcon color={isListening ? colors.onAccent : colors.muted} size={18} listening={isListening} />
              </Pressable>
              <Pressable accessibilityRole="button" accessibilityLabel="Send message" accessibilityState={{ disabled: loading || !draft.trim() || !!failure }}
                disabled={loading || !draft.trim() || !!failure} onPress={() => void send()}
                style={[styles.actionBtn, styles.send, { backgroundColor: colors.accent, opacity: loading || !draft.trim() || failure ? 0.4 : 1 }]}>
                <Text style={{ color: colors.onAccent, fontSize: 24, lineHeight: 28 }}>↑</Text>
              </Pressable>
            </View>
          </View>
          <Text style={[styles.footnote, { color: colors.muted }]}>
            {isListening ? "Listening… tap microphone again when finished." : "A conversation, at your pace."}
          </Text>
        </View>
      </KeyboardAvoidingView>
      <ConversationDrawer visible={drawer} colors={colors} activeId={conversationId} busy={loading || historyLoading} error={historyError}
        onDeleted={id => { if (conversationRef.current === id) newChat(); }}
        onClose={() => { if (!historyLoading) setDrawer(false); }} onNew={newChat} onSelect={id => void selectConversation(id)}
        onAppearance={() => { if (!historyLoading) { setDrawer(false); setSettings(true); } }} />
      <Modal visible={settings} transparent animationType="slide" onRequestClose={() => setSettings(false)}>
        <View style={styles.overlay}><View style={[styles.sheet, { backgroundColor: colors.background }]}>
          <View style={styles.sheetHeader}><Text style={[styles.sheetTitle, { color: colors.text }]}>Settings</Text><Pressable accessibilityRole="button" onPress={() => setSettings(false)} style={styles.retry}><Text style={{ color: colors.accent }}>Done</Text></Pressable></View>
          <View>
            <Text style={{ color: colors.muted, marginBottom: 18 }}>Appearance</Text>
            {(['dark', 'light', 'system'] as const).map(value => <Pressable key={value} accessibilityRole="radio" accessibilityState={{ checked: mode === value }} onPress={() => chooseTheme(value)} style={[styles.option, { borderColor: colors.line }]}>
              <Text style={{ color: colors.text, fontSize: 16 }}>{value === 'system' ? 'Follow system' : value === 'dark' ? 'Dark' : 'Light'}</Text><Text style={{ color: colors.accent }}>{mode === value ? '●' : '○'}</Text>
            </Pressable>)}
          </View>
          <View style={{ marginTop: 24 }}>
            <Text style={{ color: colors.muted, marginBottom: 18 }}>Spidy Companion</Text>
            {(['large', 'standard', 'hidden'] as const).map(value => (
              <Pressable
                key={value}
                accessibilityRole="radio"
                accessibilityState={{ checked: companionMode === value }}
                onPress={() => chooseCompanionMode(value)}
                style={[styles.option, { borderColor: colors.line }]}
              >
                <Text style={{ color: colors.text, fontSize: 16 }}>
                  {value === 'large' ? 'Large (Prominent)' : value === 'standard' ? 'Standard (Compact)' : 'Hidden'}
                </Text>
                <Text style={{ color: colors.accent }}>{companionMode === value ? '●' : '○'}</Text>
              </Pressable>
            ))}
          </View>
        </View></View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  retry: { padding: 12 },
  screen: { flex: 1 },
  body: { flex: 1 },
  companionBar: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 50,
    elevation: 10,
    flexShrink: 0,
    overflow: 'visible',
    paddingTop: 2,
  },
  companionWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'visible',
  },
  header: { paddingHorizontal: 24, paddingTop: 18, paddingBottom: 23, borderBottomWidth: StyleSheet.hairlineWidth, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  brand: { fontSize: 32, fontWeight: '600', letterSpacing: -1.5 },
  subtitle: { marginTop: 5, fontSize: 12 },
  settings: { width: 44, height: 44, borderWidth: 1, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  composerWrap: { paddingHorizontal: 18, paddingTop: 10, paddingBottom: 8 },
  composer: { flexDirection: 'row', alignItems: 'flex-end', borderRadius: 25, borderWidth: 1, padding: 7 },
  input: { flex: 1, fontSize: 16, lineHeight: 23, paddingHorizontal: 12, paddingTop: 10, paddingBottom: 10, maxHeight: 130, minHeight: 44 },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  actionBtn: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  micBtn: { borderWidth: 1 },
  send: {},
  footnote: { fontSize: 10, textAlign: 'center', marginTop: 10 },
  listeningHint: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, paddingBottom: 8 },
  listeningDot: { width: 8, height: 8, borderRadius: 4 },
  listeningText: { fontSize: 13, letterSpacing: -0.2 },
  notice: { borderRadius: 14, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 10, marginBottom: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  noticeText: { fontSize: 12, lineHeight: 17, flex: 1 },
  noticeActions: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  noticeLink: { paddingVertical: 4, paddingHorizontal: 6 },
  overlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: '#00000066' },
  sheet: { borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 28, paddingBottom: 50 },
  sheetHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  sheetTitle: { fontSize: 24, fontWeight: '600' },
  option: { paddingVertical: 20, borderBottomWidth: StyleSheet.hairlineWidth, flexDirection: 'row', justifyContent: 'space-between' },
});
