import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Linking } from 'react-native';
import type {
  ExpoSpeechRecognitionModule,
  ExpoSpeechRecognitionResultEvent,
  ExpoSpeechRecognitionErrorEvent,
} from 'expo-speech-recognition';

let SpeechModule: typeof ExpoSpeechRecognitionModule | null = null;
try {
  // Safe runtime require so the app never crashes if opened in standard Expo Go
  // where third-party native modules are not linked into the client binary.
  SpeechModule = require('expo-speech-recognition').ExpoSpeechRecognitionModule;
} catch {
  SpeechModule = null;
}

interface UseVoiceInputOptions {
  onTranscript: (updatedDraft: string) => void;
  getDraft: () => string;
}

export function useVoiceInput({ onTranscript, getDraft }: UseVoiceInputOptions) {
  const [isListening, setIsListening] = useState(false);
  const [permissionNotice, setPermissionNotice] = useState<string | null>(null);

  // Read fresh UI callbacks without resubscribing on every transcript render.
  const callbacksRef = useRef({ onTranscript, getDraft });
  callbacksRef.current = { onTranscript, getDraft };
  const startingRef = useRef(false);
  const mountedRef = useRef(true);

  // baselineDraft stores text accumulated across previous recognition sessions/pauses
  const baselineDraftRef = useRef('');
  // currentSessionTranscript stores text recognized in the CURRENT active session
  const currentSessionTranscriptRef = useRef('');
  // isListeningRef tracks user's explicit intent (only true if user explicitly started and hasn't stopped)
  const isListeningRef = useRef(false);
  // Timer for scheduling automatic restart if iOS ends a session early (e.g. silence detection)
  const restartTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showPermissionAlert = useCallback(() => {
    const message = 'Ash needs microphone and speech recognition access to transcribe your voice.';
    setPermissionNotice(`${message} Tap to open Settings.`);
    Alert.alert(
      'Microphone Access Required',
      `${message} You can enable access in iOS Settings.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Open Settings',
          onPress: () => {
            void Linking.openSettings().catch(() => {});
          },
        },
      ]
    );
  }, []);

  const openSettings = useCallback(() => {
    void Linking.openSettings().catch(() => {});
  }, []);

  const dismissPermissionNotice = useCallback(() => {
    setPermissionNotice(null);
  }, []);

  // Consolidates transcript from the session that just finished into baselineDraft
  // so the subsequent session appends rather than overwriting.
  const commitSessionToBaseline = useCallback(() => {
    const sessionText = currentSessionTranscriptRef.current.trim();
    if (sessionText) {
      const base = baselineDraftRef.current.trim();
      baselineDraftRef.current = base ? `${base} ${sessionText}` : sessionText;
      currentSessionTranscriptRef.current = '';
    } else {
      const currentDraft = callbacksRef.current.getDraft().trim();
      if (currentDraft) {
        baselineDraftRef.current = currentDraft;
      }
    }
  }, []);

  // Explicit stop by user action (tapping mic button again or sending the message)
  const stopListening = useCallback(() => {
    isListeningRef.current = false;
    setIsListening(false);

    if (restartTimerRef.current) {
      clearTimeout(restartTimerRef.current);
      restartTimerRef.current = null;
    }

    if (SpeechModule) {
      try {
        SpeechModule.stop();
      } catch {
        // In case native recognizer was already inactive
      }
    }

  }, []);

  // Starts a native recognition session
  const startNativeSession = useCallback(() => {
    if (!SpeechModule || !isListeningRef.current) return;
    try {
      currentSessionTranscriptRef.current = '';
      SpeechModule.start({
        lang: 'en-US',
        interimResults: true,
        continuous: true,
        addsPunctuation: true,
        iosTaskHint: 'dictation',
      });
    } catch (error) {
      console.warn('Speech recognition start/restart failed:', error);
      // If recognizer was momentarily busy tearing down previous session, retry after short backoff
      if (isListeningRef.current) {
        if (restartTimerRef.current) clearTimeout(restartTimerRef.current);
        restartTimerRef.current = setTimeout(() => {
          restartTimerRef.current = null;
          if (isListeningRef.current) {
            startNativeSession();
          }
        }, 250);
      }
    }
  }, []);

  // Automatically restart recognition while user's listening state is still active
  const scheduleRestart = useCallback(() => {
    if (!isListeningRef.current) return;
    if (restartTimerRef.current) {
      clearTimeout(restartTimerRef.current);
    }
    // Small 150ms pause to give iOS AVAudioSession / SFSpeechRecognizer time to reset
    restartTimerRef.current = setTimeout(() => {
      restartTimerRef.current = null;
      if (!isListeningRef.current) return;
      startNativeSession();
    }, 150);
  }, [startNativeSession]);

  // Start listening (user initiated)
  const startListening = useCallback(async () => {
    if (startingRef.current || isListeningRef.current) return;
    if (!SpeechModule) {
      Alert.alert(
        'Development Build Required',
        'Voice recognition requires native iOS speech recognition APIs.\n\nExpo Go does not support custom native modules like expo-speech-recognition.\n\nTo use real speech recognition on your iPhone, please run a development build:\nnpx expo run:ios --device',
        [{ text: 'OK' }]
      );
      setPermissionNotice('Voice input requires a development build (npx expo run:ios --device).');
      return;
    }

    startingRef.current = true;
    try {
      const currentPerms = await SpeechModule.getPermissionsAsync();
      if (!currentPerms.granted) {
        if (currentPerms.canAskAgain) {
          const requested = await SpeechModule.requestPermissionsAsync();
          if (!requested.granted) {
            showPermissionAlert();
            return;
          }
        } else {
          showPermissionAlert();
          return;
        }
      }

      if (!mountedRef.current) return;
      setPermissionNotice(null);

      // Record current draft as baseline before appending speech
      const currentDraft = callbacksRef.current.getDraft().trimEnd();
      baselineDraftRef.current = currentDraft;
      currentSessionTranscriptRef.current = '';

      isListeningRef.current = true;
      setIsListening(true);

      startNativeSession();
    } catch (error) {
      console.warn('Failed to start speech recognition:', error);
      isListeningRef.current = false;
      setIsListening(false);
    }
    finally { startingRef.current = false; }
  }, [showPermissionAlert, startNativeSession]);

  // Toggle listening on explicit user tap
  const toggleListening = useCallback(() => {
    if (isListeningRef.current) {
      stopListening();
    } else {
      void startListening();
    }
  }, [startListening, stopListening]);

  // Register native module event listeners
  useEffect(() => {
    mountedRef.current = true;
    if (!SpeechModule) return () => { mountedRef.current = false; };

    const startSub = SpeechModule.addListener('start', () => {
      if (isListeningRef.current) {
        setIsListening(true);
      }
    });

    const endSub = SpeechModule.addListener('end', () => {
      // If user has NOT explicitly stopped, iOS ended session early (silence/pause).
      // Automatically restart recognition while listening remains active!
      if (isListeningRef.current) {
        commitSessionToBaseline();
        scheduleRestart();
      } else {
        setIsListening(false);
      }
    });

    const resultSub = SpeechModule.addListener('result', (event: ExpoSpeechRecognitionResultEvent) => {
      // Ignore late native results after the user stops or sends the draft.
      if (!isListeningRef.current) return;
      const primaryTranscript = event.results[0]?.transcript;
      if (typeof primaryTranscript === 'string') {
        currentSessionTranscriptRef.current = primaryTranscript;
        const baseline = baselineDraftRef.current;
        const newText = baseline ? `${baseline} ${primaryTranscript.trimStart()}` : primaryTranscript;
        callbacksRef.current.onTranscript(newText);
      }

      if (event.isFinal && isListeningRef.current) {
        commitSessionToBaseline();
      }
    });

    const errorSub = SpeechModule.addListener('error', (event: ExpoSpeechRecognitionErrorEvent) => {
      if (event.error === 'not-allowed') {
        isListeningRef.current = false;
        setIsListening(false);
        showPermissionAlert();
        return;
      }
      if (event.error === 'aborted') {
        return;
      }
      if (event.error === 'no-speech') {
        // Silence timeout on iOS. Do not stop listening! Let 'end' handle restart.
        return;
      }

      // If another transient error occurs (e.g. temporary audio-capture busy), keep listening and restart
      if (isListeningRef.current) {
        commitSessionToBaseline();
        scheduleRestart();
      }
    });

    return () => {
      mountedRef.current = false;
      isListeningRef.current = false;
      startSub.remove();
      endSub.remove();
      resultSub.remove();
      errorSub.remove();
      if (restartTimerRef.current) {
        clearTimeout(restartTimerRef.current);
        restartTimerRef.current = null;
      }
      {
        try {
          SpeechModule?.stop();
        } catch {}
      }
    };
  }, [commitSessionToBaseline, scheduleRestart, showPermissionAlert]);

  return {
    isListening,
    isAvailable: !!SpeechModule,
    permissionNotice,
    toggleListening,
    stopListening,
    startListening,
    dismissPermissionNotice,
    openSettings,
  };
}
