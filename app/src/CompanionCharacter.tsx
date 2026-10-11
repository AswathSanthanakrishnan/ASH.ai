import { memo, useCallback, useEffect, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import type { Palette } from './theme';

export type CompanionState = 'idle' | 'thinking' | 'sleeping' | 'listening' | 'error';
export type CompanionSize = 'standard' | 'large';
export type CompanionMood = 'happy' | 'sympathetic' | 'neutral';

export interface CompanionCharacterProps {
  state: CompanionState;
  colors: Palette;
  name?: string;
  size?: CompanionSize;
  mood?: CompanionMood;
  celebrateTrigger?: number;
  onPress?: () => void;
  onWake?: () => void;
}

const SPIDY_QUIPS = [
  'With great power comes great debugging! 🕸️',
  'Fun fact: Spider silk is 5x stronger than steel! 🕷️',
  'Why did the spider get a computer? To surf the web! 💻',
  'Thwip! Ready for whatever prompt you got!',
  'Did you know? Jumping spiders have 360° vision! 👀',
  "I don't just spin webs, I browse them too! 🌐",
  'My spider-sense tingles when your code compiles! ⚡',
  "Don't worry, I won't drop the bug report! 🐞",
  'No spiders were harmed in making this assistant. ✌️',
  "Need a web search? You're talking to the web expert.",
  'Just swinging by to see how you are doing! 🕷️',
  'A radioactive bug bit my code, now it is blazing fast! 🚀',
  'Remember to take breaks. Even heroes rest! ☕',
  "I'm Spidy, your friendly neighborhood AI copilot!",
  'Spider fact: Spiders exist on every continent except Antarctica! ❄️',
  'Got questions? Ash and I have got your back! 🛡️',
];

const CONFETTI_COLORS = [
  '#FF3B30',
  '#34C759',
  '#007AFF',
  '#FF9500',
  '#AF52DE',
  '#FFD60A',
  '#5AC8FA',
  '#FF2D55',
];

interface ConfettiPiece {
  id: number;
  x: Animated.Value;
  y: Animated.Value;
  rot: Animated.Value;
  opacity: Animated.Value;
  color: string;
  w: number;
  h: number;
}

export const CompanionCharacter = memo(function CompanionCharacter({
  state,
  colors,
  name = 'Spidy',
  size = 'large',
  mood = 'neutral',
  celebrateTrigger = 0,
  onPress,
  onWake,
}: CompanionCharacterProps) {
  const isLarge = size === 'large';

  // 1. Idle bobbing, breathing, and body sway
  const bobAnim = useRef(new Animated.Value(0)).current;
  const breathAnim = useRef(new Animated.Value(1)).current;
  const swayAnim = useRef(new Animated.Value(0)).current;

  // 2. Eye lens animations: glance, Spider-Man squint, wink
  const glanceX = useRef(new Animated.Value(0)).current;
  const glanceY = useRef(new Animated.Value(0)).current;
  const eyeSquintY = useRef(new Animated.Value(1)).current;
  const eyeSquintX = useRef(new Animated.Value(1)).current;
  const rightEyeWink = useRef(new Animated.Value(1)).current;

  // 3. Thinking state: laptop reveal and rapid typing hands
  const laptopScale = useRef(new Animated.Value(0)).current;
  const laptopY = useRef(new Animated.Value(10)).current;
  const typingLeft = useRef(new Animated.Value(0)).current;
  const typingRight = useRef(new Animated.Value(0)).current;
  const headFocusTilt = useRef(new Animated.Value(0)).current;

  // 4. Sleeping state: slump, snore bounce, and floating Zs
  const sleepSlump = useRef(new Animated.Value(0)).current;
  const snoreBounce = useRef(new Animated.Value(0)).current;
  const zAnim1 = useRef(new Animated.Value(0)).current;
  const zAnim2 = useRef(new Animated.Value(0)).current;
  const zAnim3 = useRef(new Animated.Value(0)).current;

  // 5. Wake-up startled jolt
  const wakeJolt = useRef(new Animated.Value(0)).current;
  const tapBounce = useRef(new Animated.Value(1)).current;

  // 6. Voice Listening state: attentive perk & listening pulses
  const listenPerk = useRef(new Animated.Value(0)).current;
  const listenWave1 = useRef(new Animated.Value(0)).current;
  const listenWave2 = useRef(new Animated.Value(0)).current;

  // 7. Victory fist pump
  const victoryFistY = useRef(new Animated.Value(0)).current;
  const victoryBounce = useRef(new Animated.Value(0)).current;

  // 8. Confused Head-Scratch on Error
  const errorTilt = useRef(new Animated.Value(0)).current;
  const errorScratch = useRef(new Animated.Value(0)).current;
  const questionWobble = useRef(new Animated.Value(0)).current;

  // 9. Interactive Tap Tricks (Backflip, Web-Zip, Wave & Wink)
  const trickFlipRotate = useRef(new Animated.Value(0)).current;
  const trickFlipY = useRef(new Animated.Value(0)).current;
  const webLineScaleY = useRef(new Animated.Value(0)).current;
  const webLineOpacity = useRef(new Animated.Value(0)).current;
  const webZipY = useRef(new Animated.Value(0)).current;
  const waveArmRotate = useRef(new Animated.Value(0)).current;
  const waveArmVisible = useRef(new Animated.Value(0)).current;

  // 10. Mood Reactions (Happy Cheer Bounce & Sympathetic Droop)
  const moodBounceY = useRef(new Animated.Value(0)).current;
  const moodTilt = useRef(new Animated.Value(0)).current;
  const moodSparkleAnim = useRef(new Animated.Value(0)).current;

  // 11. Comic Speech Bubble (Tap Surprise)
  const [speechText, setSpeechText] = useState<string | null>(null);
  const speechBubbleAnim = useRef(new Animated.Value(0)).current;
  const speechTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 12. Confetti Celebration System
  const [confettiActive, setConfettiActive] = useState(false);
  const confettiPieces = useRef<ConfettiPiece[]>(
    Array.from({ length: 16 }, (_, i) => ({
      id: i,
      x: new Animated.Value(0),
      y: new Animated.Value(0),
      rot: new Animated.Value(0),
      opacity: new Animated.Value(0),
      color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
      w: (i % 2 === 0 ? 6 : 8) * (isLarge ? 1.2 : 1),
      h: (i % 3 === 0 ? 10 : 6) * (isLarge ? 1.2 : 1),
    }))
  ).current;

  const [activeTrick, setActiveTrick] = useState<'none' | 'flip' | 'web' | 'wave'>('none');
  const trickCounter = useRef(0);
  const isTricking = useRef(false);

  const prevStateRef = useRef<CompanionState>(state);
  const stateRef = useRef(state);
  stateRef.current = state;

  // -------------------------------------------------------------
  // 1. Idle Bobbing, Breathing & Sway
  // -------------------------------------------------------------
  useEffect(() => {
    let bobLoop: Animated.CompositeAnimation | null = null;
    let breathLoop: Animated.CompositeAnimation | null = null;
    let swayLoop: Animated.CompositeAnimation | null = null;

    if (state === 'idle') {
      bobLoop = Animated.loop(
        Animated.sequence([
          Animated.timing(bobAnim, {
            toValue: -3,
            duration: 1400,
            easing: Easing.inOut(Easing.quad),
            useNativeDriver: true,
          }),
          Animated.timing(bobAnim, {
            toValue: 0,
            duration: 1400,
            easing: Easing.inOut(Easing.quad),
            useNativeDriver: true,
          }),
        ])
      );

      breathLoop = Animated.loop(
        Animated.sequence([
          Animated.timing(breathAnim, {
            toValue: 1.025,
            duration: 1400,
            easing: Easing.inOut(Easing.quad),
            useNativeDriver: true,
          }),
          Animated.timing(breathAnim, {
            toValue: 0.985,
            duration: 1400,
            easing: Easing.inOut(Easing.quad),
            useNativeDriver: true,
          }),
        ])
      );

      swayLoop = Animated.loop(
        Animated.sequence([
          Animated.timing(swayAnim, {
            toValue: 1.5,
            duration: 2200,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true,
          }),
          Animated.timing(swayAnim, {
            toValue: -1.5,
            duration: 2200,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true,
          }),
        ])
      );

      bobLoop.start();
      breathLoop.start();
      swayLoop.start();
    } else {
      bobAnim.setValue(0);
      swayAnim.setValue(0);
    }

    return () => {
      if (bobLoop) bobLoop.stop();
      if (breathLoop) breathLoop.stop();
      if (swayLoop) swayLoop.stop();
    };
  }, [state, bobAnim, breathAnim, swayAnim]);

  // -------------------------------------------------------------
  // 2. Eye Glance Scanning
  // -------------------------------------------------------------
  useEffect(() => {
    let isCancelled = false;

    if (state === 'sleeping') {
      eyeSquintY.setValue(0.06);
      eyeSquintX.setValue(0.85);
      glanceX.setValue(0);
      glanceY.setValue(0);
      return;
    }

    if (state === 'listening') {
      Animated.parallel([
        Animated.spring(glanceX, { toValue: 0, friction: 6, useNativeDriver: true }),
        Animated.spring(glanceY, { toValue: -1.5, friction: 6, useNativeDriver: true }),
        Animated.spring(eyeSquintY, { toValue: 1.15, friction: 6, useNativeDriver: true }),
      ]).start();
      return;
    }

    if (state === 'error') {
      Animated.parallel([
        Animated.spring(glanceX, { toValue: 2, friction: 6, useNativeDriver: true }),
        Animated.spring(glanceY, { toValue: -2, friction: 6, useNativeDriver: true }),
      ]).start();
      return;
    }

    function runGlanceCycle() {
      if (isCancelled || stateRef.current !== 'idle') return;

      const pause = 1800 + Math.random() * 2200;
      const targetX = (Math.random() - 0.5) * 5;
      const targetY = (Math.random() - 0.5) * 2;

      const timer = setTimeout(() => {
        if (isCancelled || stateRef.current !== 'idle') return;
        Animated.parallel([
          Animated.timing(glanceX, {
            toValue: targetX,
            duration: 200,
            easing: Easing.out(Easing.quad),
            useNativeDriver: true,
          }),
          Animated.timing(glanceY, {
            toValue: targetY,
            duration: 200,
            easing: Easing.out(Easing.quad),
            useNativeDriver: true,
          }),
        ]).start(() => {
          const hold = 1200 + Math.random() * 1500;
          setTimeout(() => {
            if (isCancelled || stateRef.current !== 'idle') return;
            Animated.parallel([
              Animated.timing(glanceX, {
                toValue: 0,
                duration: 200,
                easing: Easing.inOut(Easing.quad),
                useNativeDriver: true,
              }),
              Animated.timing(glanceY, {
                toValue: 0,
                duration: 200,
                easing: Easing.inOut(Easing.quad),
                useNativeDriver: true,
              }),
            ]).start(() => {
              runGlanceCycle();
            });
          }, hold);
        });
      }, pause);

      return timer;
    }

    const timer = runGlanceCycle();
    return () => {
      isCancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [state, glanceX, glanceY, eyeSquintY, eyeSquintX]);

  // -------------------------------------------------------------
  // 3. Spider-Man Lens Squint & Blink
  // -------------------------------------------------------------
  useEffect(() => {
    let isCancelled = false;
    if (state !== 'idle') return;

    function runEyeSquint() {
      if (isCancelled || stateRef.current !== 'idle' || isTricking.current) return;
      const nextDelay = 2500 + Math.random() * 3000;

      const timer = setTimeout(() => {
        if (isCancelled || stateRef.current !== 'idle' || isTricking.current) return;

        const isPartialSquint = Math.random() < 0.35;
        const closeScale = isPartialSquint ? 0.45 : 0.08;

        Animated.parallel([
          Animated.timing(eyeSquintY, {
            toValue: closeScale,
            duration: 80,
            useNativeDriver: true,
          }),
          Animated.timing(eyeSquintX, {
            toValue: isPartialSquint ? 0.9 : 0.8,
            duration: 80,
            useNativeDriver: true,
          }),
        ]).start(() => {
          Animated.parallel([
            Animated.timing(eyeSquintY, {
              toValue: 1,
              duration: 90,
              useNativeDriver: true,
            }),
            Animated.timing(eyeSquintX, {
              toValue: 1,
              duration: 90,
              useNativeDriver: true,
            }),
          ]).start(() => {
            if (Math.random() < 0.25) {
              setTimeout(() => {
                if (isCancelled || stateRef.current !== 'idle') return;
                Animated.sequence([
                  Animated.timing(eyeSquintY, { toValue: 0.08, duration: 65, useNativeDriver: true }),
                  Animated.timing(eyeSquintY, { toValue: 1, duration: 80, useNativeDriver: true }),
                ]).start(() => runEyeSquint());
              }, 110);
            } else {
              runEyeSquint();
            }
          });
        });
      }, nextDelay);

      return timer;
    }

    const timer = runEyeSquint();
    return () => {
      isCancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [state, eyeSquintY, eyeSquintX]);

  // -------------------------------------------------------------
  // 4. Thinking State: Laptop Reveal & Rapid Typing Hands
  // -------------------------------------------------------------
  useEffect(() => {
    let typingLoop: Animated.CompositeAnimation | null = null;

    if (state === 'thinking') {
      // Dismiss speech bubble if open
      if (speechTimeout.current) clearTimeout(speechTimeout.current);
      setSpeechText(null);
      speechBubbleAnim.setValue(0);

      Animated.parallel([
        Animated.spring(laptopScale, {
          toValue: 1,
          friction: 6,
          tension: 50,
          useNativeDriver: true,
        }),
        Animated.spring(laptopY, {
          toValue: 0,
          friction: 6,
          tension: 50,
          useNativeDriver: true,
        }),
        Animated.spring(headFocusTilt, {
          toValue: 1,
          friction: 6,
          tension: 45,
          useNativeDriver: true,
        }),
        Animated.spring(glanceY, { toValue: 2.5, friction: 6, useNativeDriver: true }),
        Animated.spring(glanceX, { toValue: 0, friction: 6, useNativeDriver: true }),
      ]).start();

      typingLoop = Animated.loop(
        Animated.sequence([
          Animated.parallel([
            Animated.timing(typingLeft, {
              toValue: -2.5,
              duration: 100,
              easing: Easing.inOut(Easing.quad),
              useNativeDriver: true,
            }),
            Animated.timing(typingRight, {
              toValue: 0,
              duration: 100,
              easing: Easing.inOut(Easing.quad),
              useNativeDriver: true,
            }),
          ]),
          Animated.parallel([
            Animated.timing(typingLeft, {
              toValue: 0,
              duration: 100,
              easing: Easing.inOut(Easing.quad),
              useNativeDriver: true,
            }),
            Animated.timing(typingRight, {
              toValue: -2.5,
              duration: 100,
              easing: Easing.inOut(Easing.quad),
              useNativeDriver: true,
            }),
          ]),
        ])
      );
      typingLoop.start();
    } else {
      Animated.parallel([
        Animated.timing(laptopScale, {
          toValue: 0,
          duration: 180,
          easing: Easing.in(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(laptopY, {
          toValue: 10,
          duration: 180,
          useNativeDriver: true,
        }),
        Animated.spring(headFocusTilt, {
          toValue: 0,
          friction: 7,
          tension: 40,
          useNativeDriver: true,
        }),
        Animated.spring(typingLeft, { toValue: 0, useNativeDriver: true }),
        Animated.spring(typingRight, { toValue: 0, useNativeDriver: true }),
      ]).start();
    }

    return () => {
      if (typingLoop) typingLoop.stop();
    };
  }, [state, laptopScale, laptopY, headFocusTilt, typingLeft, typingRight, glanceX, glanceY, speechBubbleAnim]);

  // -------------------------------------------------------------
  // 5. Victory Fist Pump Celebration (Thinking -> Idle)
  // -------------------------------------------------------------
  useEffect(() => {
    if (prevStateRef.current === 'thinking' && state === 'idle') {
      Animated.sequence([
        Animated.parallel([
          Animated.timing(victoryFistY, {
            toValue: -12,
            duration: 180,
            easing: Easing.out(Easing.back(1.5)),
            useNativeDriver: true,
          }),
          Animated.timing(victoryBounce, {
            toValue: -6,
            duration: 180,
            easing: Easing.out(Easing.quad),
            useNativeDriver: true,
          }),
          Animated.timing(eyeSquintY, {
            toValue: 0.3,
            duration: 180,
            useNativeDriver: true,
          }),
        ]),
        Animated.parallel([
          Animated.spring(victoryFistY, {
            toValue: 0,
            friction: 5,
            tension: 50,
            useNativeDriver: true,
          }),
          Animated.spring(victoryBounce, {
            toValue: 0,
            friction: 5,
            tension: 50,
            useNativeDriver: true,
          }),
          Animated.spring(eyeSquintY, {
            toValue: 1,
            friction: 6,
            tension: 50,
            useNativeDriver: true,
          }),
        ]),
      ]).start();
    }
  }, [state, victoryFistY, victoryBounce, eyeSquintY]);

  // -------------------------------------------------------------
  // 6. Voice Listening Mode: Attentive Perk & Concentric Pulses
  // -------------------------------------------------------------
  useEffect(() => {
    let waveLoop1: Animated.CompositeAnimation | null = null;
    let waveLoop2: Animated.CompositeAnimation | null = null;

    if (state === 'listening') {
      Animated.spring(listenPerk, {
        toValue: 1,
        friction: 6,
        tension: 50,
        useNativeDriver: true,
      }).start();

      const makeWave = (val: Animated.Value, delay: number) => {
        return Animated.loop(
          Animated.sequence([
            Animated.delay(delay),
            Animated.timing(val, {
              toValue: 1,
              duration: 1200,
              easing: Easing.out(Easing.sin),
              useNativeDriver: true,
            }),
            Animated.timing(val, {
              toValue: 0,
              duration: 0,
              useNativeDriver: true,
            }),
          ])
        );
      };

      listenWave1.setValue(0);
      listenWave2.setValue(0);
      waveLoop1 = makeWave(listenWave1, 0);
      waveLoop2 = makeWave(listenWave2, 600);
      waveLoop1.start();
      waveLoop2.start();
    } else {
      Animated.timing(listenPerk, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }).start();
      listenWave1.setValue(0);
      listenWave2.setValue(0);
    }

    return () => {
      if (waveLoop1) waveLoop1.stop();
      if (waveLoop2) waveLoop2.stop();
    };
  }, [state, listenPerk, listenWave1, listenWave2]);

  // -------------------------------------------------------------
  // 7. Confused Head-Scratch on Error
  // -------------------------------------------------------------
  useEffect(() => {
    let scratchLoop: Animated.CompositeAnimation | null = null;
    let wobbleLoop: Animated.CompositeAnimation | null = null;

    if (state === 'error') {
      Animated.parallel([
        Animated.spring(errorTilt, {
          toValue: 1,
          friction: 6,
          tension: 40,
          useNativeDriver: true,
        }),
        Animated.timing(eyeSquintY, {
          toValue: 0.35,
          duration: 250,
          useNativeDriver: true,
        }),
      ]).start();

      scratchLoop = Animated.loop(
        Animated.sequence([
          Animated.timing(errorScratch, {
            toValue: -2.5,
            duration: 120,
            easing: Easing.inOut(Easing.quad),
            useNativeDriver: true,
          }),
          Animated.timing(errorScratch, {
            toValue: 2.5,
            duration: 120,
            easing: Easing.inOut(Easing.quad),
            useNativeDriver: true,
          }),
        ])
      );
      scratchLoop.start();

      wobbleLoop = Animated.loop(
        Animated.sequence([
          Animated.timing(questionWobble, {
            toValue: 1,
            duration: 1000,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true,
          }),
          Animated.timing(questionWobble, {
            toValue: -1,
            duration: 1000,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true,
          }),
        ])
      );
      wobbleLoop.start();
    } else {
      Animated.timing(errorTilt, { toValue: 0, duration: 200, useNativeDriver: true }).start();
      errorScratch.setValue(0);
      questionWobble.setValue(0);
    }

    return () => {
      if (scratchLoop) scratchLoop.stop();
      if (wobbleLoop) wobbleLoop.stop();
    };
  }, [state, errorTilt, errorScratch, questionWobble, eyeSquintY]);

  // -------------------------------------------------------------
  // 8. Sleeping State: Slump, Snore Bounce & Floating "Z z z"
  // -------------------------------------------------------------
  useEffect(() => {
    let snoreLoop: Animated.CompositeAnimation | null = null;
    let zLoop1: Animated.CompositeAnimation | null = null;
    let zLoop2: Animated.CompositeAnimation | null = null;
    let zLoop3: Animated.CompositeAnimation | null = null;

    if (state === 'sleeping') {
      // Dismiss speech bubble
      if (speechTimeout.current) clearTimeout(speechTimeout.current);
      setSpeechText(null);
      speechBubbleAnim.setValue(0);

      Animated.parallel([
        Animated.timing(sleepSlump, {
          toValue: 1,
          duration: 700,
          easing: Easing.out(Easing.back(1.2)),
          useNativeDriver: true,
        }),
        Animated.timing(eyeSquintY, {
          toValue: 0.06,
          duration: 350,
          useNativeDriver: true,
        }),
        Animated.timing(eyeSquintX, {
          toValue: 0.85,
          duration: 350,
          useNativeDriver: true,
        }),
      ]).start();

      snoreLoop = Animated.loop(
        Animated.sequence([
          Animated.timing(snoreBounce, {
            toValue: 1,
            duration: 1400,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true,
          }),
          Animated.timing(snoreBounce, {
            toValue: 0,
            duration: 1200,
            easing: Easing.inOut(Easing.quad),
            useNativeDriver: true,
          }),
        ])
      );
      snoreLoop.start();

      const createZLoop = (val: Animated.Value, delay: number, duration: number) => {
        return Animated.loop(
          Animated.sequence([
            Animated.delay(delay),
            Animated.timing(val, {
              toValue: 1,
              duration,
              easing: Easing.out(Easing.quad),
              useNativeDriver: true,
            }),
            Animated.timing(val, {
              toValue: 0,
              duration: 0,
              useNativeDriver: true,
            }),
          ])
        );
      };

      zAnim1.setValue(0);
      zAnim2.setValue(0);
      zAnim3.setValue(0);

      zLoop1 = createZLoop(zAnim1, 0, 2400);
      zLoop2 = createZLoop(zAnim2, 800, 2400);
      zLoop3 = createZLoop(zAnim3, 1600, 2400);

      zLoop1.start();
      zLoop2.start();
      zLoop3.start();
    } else {
      Animated.timing(sleepSlump, {
        toValue: 0,
        duration: 250,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }).start();

      snoreBounce.setValue(0);
      zAnim1.setValue(0);
      zAnim2.setValue(0);
      zAnim3.setValue(0);
    }

    return () => {
      if (snoreLoop) snoreLoop.stop();
      if (zLoop1) zLoop1.stop();
      if (zLoop2) zLoop2.stop();
      if (zLoop3) zLoop3.stop();
    };
  }, [state, sleepSlump, snoreBounce, zAnim1, zAnim2, zAnim3, eyeSquintY, eyeSquintX, speechBubbleAnim]);

  // -------------------------------------------------------------
  // 9. Startled Wake-up Jolt
  // -------------------------------------------------------------
  useEffect(() => {
    if (prevStateRef.current === 'sleeping' && state !== 'sleeping') {
      Animated.sequence([
        Animated.parallel([
          Animated.timing(wakeJolt, {
            toValue: 1,
            duration: 120,
            easing: Easing.out(Easing.quad),
            useNativeDriver: true,
          }),
          Animated.timing(eyeSquintY, {
            toValue: 1.3,
            duration: 120,
            useNativeDriver: true,
          }),
          Animated.timing(eyeSquintX, {
            toValue: 1.1,
            duration: 120,
            useNativeDriver: true,
          }),
        ]),
        Animated.parallel([
          Animated.spring(wakeJolt, {
            toValue: 0,
            friction: 5,
            tension: 80,
            useNativeDriver: true,
          }),
          Animated.spring(eyeSquintY, {
            toValue: 1,
            friction: 6,
            tension: 60,
            useNativeDriver: true,
          }),
          Animated.spring(eyeSquintX, {
            toValue: 1,
            friction: 6,
            tension: 60,
            useNativeDriver: true,
          }),
        ]),
      ]).start();
    }
    prevStateRef.current = state;
  }, [state, wakeJolt, eyeSquintY, eyeSquintX]);

  // -------------------------------------------------------------
  // 10. Mood / Sentiment Reaction Handler
  // -------------------------------------------------------------
  useEffect(() => {
    if (mood === 'happy') {
      // Cheerful double bounce & sparkle
      Animated.sequence([
        Animated.parallel([
          Animated.timing(moodBounceY, { toValue: -8, duration: 160, easing: Easing.out(Easing.quad), useNativeDriver: true }),
          Animated.timing(eyeSquintY, { toValue: 0.35, duration: 160, useNativeDriver: true }),
          Animated.timing(moodSparkleAnim, { toValue: 1, duration: 300, useNativeDriver: true }),
        ]),
        Animated.timing(moodBounceY, { toValue: 0, duration: 140, easing: Easing.in(Easing.quad), useNativeDriver: true }),
        Animated.timing(moodBounceY, { toValue: -5, duration: 140, easing: Easing.out(Easing.quad), useNativeDriver: true }),
        Animated.parallel([
          Animated.spring(moodBounceY, { toValue: 0, friction: 5, tension: 70, useNativeDriver: true }),
          Animated.spring(eyeSquintY, { toValue: 1, friction: 6, tension: 50, useNativeDriver: true }),
          Animated.timing(moodSparkleAnim, { toValue: 0, duration: 400, delay: 1000, useNativeDriver: true }),
        ]),
      ]).start();
    } else if (mood === 'sympathetic') {
      // Comforting droop & tilted head
      Animated.sequence([
        Animated.parallel([
          Animated.timing(moodTilt, { toValue: 1, duration: 250, easing: Easing.out(Easing.quad), useNativeDriver: true }),
          Animated.timing(moodBounceY, { toValue: 4, duration: 250, easing: Easing.out(Easing.quad), useNativeDriver: true }),
          Animated.timing(eyeSquintY, { toValue: 0.65, duration: 250, useNativeDriver: true }),
        ]),
        Animated.delay(2200),
        Animated.parallel([
          Animated.spring(moodTilt, { toValue: 0, friction: 6, tension: 40, useNativeDriver: true }),
          Animated.spring(moodBounceY, { toValue: 0, friction: 6, tension: 40, useNativeDriver: true }),
          Animated.spring(eyeSquintY, { toValue: 1, friction: 6, tension: 50, useNativeDriver: true }),
        ]),
      ]).start();
    } else {
      moodBounceY.setValue(0);
      moodTilt.setValue(0);
      moodSparkleAnim.setValue(0);
    }
  }, [mood, moodBounceY, moodTilt, moodSparkleAnim, eyeSquintY]);

  // -------------------------------------------------------------
  // 11. Confetti Celebration Trigger
  // -------------------------------------------------------------
  const fireCelebration = useCallback(() => {
    setConfettiActive(true);

    // Also trigger victory fist pump and bounce
    Animated.sequence([
      Animated.parallel([
        Animated.timing(victoryFistY, { toValue: -14, duration: 200, easing: Easing.out(Easing.back(1.8)), useNativeDriver: true }),
        Animated.timing(victoryBounce, { toValue: -8, duration: 200, easing: Easing.out(Easing.quad), useNativeDriver: true }),
        Animated.timing(eyeSquintY, { toValue: 0.3, duration: 200, useNativeDriver: true }),
      ]),
      Animated.parallel([
        Animated.spring(victoryFistY, { toValue: 0, friction: 4.5, tension: 50, useNativeDriver: true }),
        Animated.spring(victoryBounce, { toValue: 0, friction: 4.5, tension: 50, useNativeDriver: true }),
        Animated.spring(eyeSquintY, { toValue: 1, friction: 6, tension: 50, useNativeDriver: true }),
      ]),
    ]).start();

    // Animate all confetti particles
    const animations = confettiPieces.map((p, i) => {
      p.x.setValue(0);
      p.y.setValue(0);
      p.rot.setValue(0);
      p.opacity.setValue(1);

      // Angle biased upward and outward (-150 deg to -30 deg)
      const angle = -Math.PI * (0.15 + (i / confettiPieces.length) * 0.7);
      const distance = 42 + Math.random() * 38;
      const targetX = Math.cos(angle) * distance + (Math.random() - 0.5) * 15;
      const targetY = Math.sin(angle) * distance - 8;
      const fallY = targetY + 36 + Math.random() * 24;

      return Animated.sequence([
        // Initial burst outward
        Animated.parallel([
          Animated.timing(p.x, {
            toValue: targetX,
            duration: 380,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          }),
          Animated.timing(p.y, {
            toValue: targetY,
            duration: 380,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          }),
          Animated.timing(p.rot, {
            toValue: (Math.random() - 0.5) * 720,
            duration: 380,
            useNativeDriver: true,
          }),
        ]),
        // Gravity fall & fade
        Animated.parallel([
          Animated.timing(p.y, {
            toValue: fallY,
            duration: 650,
            easing: Easing.in(Easing.quad),
            useNativeDriver: true,
          }),
          Animated.timing(p.opacity, {
            toValue: 0,
            duration: 650,
            easing: Easing.in(Easing.quad),
            useNativeDriver: true,
          }),
          Animated.timing(p.rot, {
            toValue: (Math.random() - 0.5) * 1440,
            duration: 650,
            useNativeDriver: true,
          }),
        ]),
      ]);
    });

    Animated.stagger(15, animations).start(() => {
      setConfettiActive(false);
    });
  }, [confettiPieces, victoryFistY, victoryBounce, eyeSquintY]);

  const celebrateTriggerRef = useRef(celebrateTrigger);
  useEffect(() => {
    if (celebrateTrigger > 0 && celebrateTrigger !== celebrateTriggerRef.current) {
      celebrateTriggerRef.current = celebrateTrigger;
      fireCelebration();
    }
  }, [celebrateTrigger, fireCelebration]);

  // -------------------------------------------------------------
  // 12. Interactive Tap Tricks & Surprise Speech Quip
  // -------------------------------------------------------------
  const showSpeechBubble = () => {
    if (speechTimeout.current) clearTimeout(speechTimeout.current);

    const randomIndex = Math.floor(Math.random() * SPIDY_QUIPS.length);
    setSpeechText(SPIDY_QUIPS[randomIndex]);

    speechBubbleAnim.setValue(0);
    Animated.spring(speechBubbleAnim, {
      toValue: 1,
      friction: 6,
      tension: 60,
      useNativeDriver: true,
    }).start();

    speechTimeout.current = setTimeout(() => {
      Animated.timing(speechBubbleAnim, {
        toValue: 0,
        duration: 200,
        easing: Easing.in(Easing.quad),
        useNativeDriver: true,
      }).start(() => {
        setSpeechText(null);
      });
    }, 3800);
  };

  const performTapTrick = () => {
    if (isTricking.current) return;
    isTricking.current = true;

    // Show speech surprise bubble alongside trick
    showSpeechBubble();

    const tricks: Array<'flip' | 'web' | 'wave'> = ['flip', 'web', 'wave'];
    const chosen = tricks[trickCounter.current % tricks.length];
    trickCounter.current++;
    setActiveTrick(chosen);

    if (chosen === 'flip') {
      trickFlipRotate.setValue(0);
      trickFlipY.setValue(0);
      Animated.parallel([
        Animated.sequence([
          Animated.timing(trickFlipY, {
            toValue: isLarge ? -22 : -18,
            duration: 260,
            easing: Easing.out(Easing.quad),
            useNativeDriver: true,
          }),
          Animated.timing(trickFlipY, {
            toValue: 0,
            duration: 260,
            easing: Easing.in(Easing.quad),
            useNativeDriver: true,
          }),
        ]),
        Animated.timing(trickFlipRotate, {
          toValue: -360,
          duration: 520,
          easing: Easing.inOut(Easing.cubic),
          useNativeDriver: true,
        }),
      ]).start(() => {
        trickFlipRotate.setValue(0);
        isTricking.current = false;
        setActiveTrick('none');
      });
    } else if (chosen === 'web') {
      webLineScaleY.setValue(0);
      webLineOpacity.setValue(1);
      webZipY.setValue(0);

      Animated.sequence([
        Animated.timing(webLineScaleY, {
          toValue: 1,
          duration: 90,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(webZipY, {
          toValue: isLarge ? -18 : -15,
          duration: 140,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.parallel([
          Animated.spring(webZipY, {
            toValue: 0,
            friction: 3.5,
            tension: 70,
            useNativeDriver: true,
          }),
          Animated.timing(webLineOpacity, {
            toValue: 0,
            duration: 250,
            useNativeDriver: true,
          }),
        ]),
      ]).start(() => {
        isTricking.current = false;
        setActiveTrick('none');
      });
    } else if (chosen === 'wave') {
      waveArmVisible.setValue(1);
      waveArmRotate.setValue(0);
      rightEyeWink.setValue(1);

      Animated.sequence([
        Animated.parallel([
          Animated.timing(rightEyeWink, { toValue: 0.1, duration: 100, useNativeDriver: true }),
          Animated.sequence([
            Animated.timing(waveArmRotate, { toValue: -18, duration: 110, useNativeDriver: true }),
            Animated.timing(waveArmRotate, { toValue: 18, duration: 110, useNativeDriver: true }),
            Animated.timing(waveArmRotate, { toValue: -18, duration: 110, useNativeDriver: true }),
            Animated.timing(waveArmRotate, { toValue: 18, duration: 110, useNativeDriver: true }),
            Animated.timing(waveArmRotate, { toValue: 0, duration: 110, useNativeDriver: true }),
          ]),
        ]),
        Animated.parallel([
          Animated.timing(rightEyeWink, { toValue: 1, duration: 100, useNativeDriver: true }),
          Animated.timing(waveArmVisible, { toValue: 0, duration: 100, useNativeDriver: true }),
        ]),
      ]).start(() => {
        isTricking.current = false;
        setActiveTrick('none');
      });
    }
  };

  const handlePress = () => {
    if (state === 'sleeping') {
      onWake?.();
    } else if (state === 'idle') {
      performTapTrick();
    }
    Animated.sequence([
      Animated.timing(tapBounce, { toValue: 0.92, duration: 80, useNativeDriver: true }),
      Animated.spring(tapBounce, { toValue: 1, friction: 4, tension: 80, useNativeDriver: true }),
    ]).start();
    onPress?.();
  };

  // -------------------------------------------------------------
  // Interpolations (No duplicate keys in any transform array)
  // -------------------------------------------------------------
  const headFocusRotation = headFocusTilt.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '3.5deg'],
  });

  const sleepRotation = sleepSlump.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '14deg'],
  });

  const sleepOffsetY = sleepSlump.interpolate({
    inputRange: [0, 1],
    outputRange: [0, isLarge ? 5.5 : 4.5],
  });

  const snoreScale = snoreBounce.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.05],
  });

  const snoreY = snoreBounce.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -3],
  });

  const joltY = wakeJolt.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -8],
  });

  const listenScale = listenPerk.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.07],
  });

  const listenTilt = listenPerk.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '-7deg'],
  });

  const errorRotation = errorTilt.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '-15deg'],
  });

  const flipDeg = trickFlipRotate.interpolate({
    inputRange: [-360, 0],
    outputRange: ['-360deg', '0deg'],
  });

  const waveArmDeg = waveArmRotate.interpolate({
    inputRange: [-18, 18],
    outputRange: ['-18deg', '18deg'],
  });

  const questionDeg = questionWobble.interpolate({
    inputRange: [-1, 1],
    outputRange: ['-10deg', '10deg'],
  });

  const moodTiltDeg = moodTilt.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '-12deg'],
  });

  // Dynamic dimension constants
  const circleSize = isLarge ? 78 : 62;
  const circleRadius = circleSize / 2;
  const charWidth = isLarge ? 72 : 58;
  const charHeight = isLarge ? 76 : 60;
  const hoodSize = isLarge ? 48 : 38;
  const hoodFoldSize = isLarge ? 40 : 32;
  const maskSize = isLarge ? 36 : 28;
  const torsoWidth = isLarge ? 40 : 32;
  const torsoHeight = isLarge ? 32 : 25;
  const chestWidth = isLarge ? 26 : 20;
  const chestHeight = isLarge ? 28 : 22;
  const vestWidth = isLarge ? 8 : 6;
  const vestHeight = isLarge ? 28 : 22;
  const beltWidth = isLarge ? 28 : 22;
  const beltHeight = isLarge ? 4 : 3;
  const eyeBezelW = isLarge ? 11.5 : 9;
  const eyeBezelH = isLarge ? 14 : 11;
  const eyeLensW = isLarge ? 8.5 : 6.5;
  const eyeLensH = isLarge ? 11 : 8.5;
  const eyeGap = isLarge ? 4 : 3;

  return (
    <View style={styles.rootContainer}>
      {/* Floating Comic Speech Bubble (Tap Surprise) */}
      {speechText && (
        <Animated.View
          pointerEvents="box-none"
          style={[
            styles.speechBubbleWrap,
            {
              top: isLarge ? -46 : -40,
              opacity: speechBubbleAnim,
              transform: [
                { scale: speechBubbleAnim },
                {
                  translateY: speechBubbleAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [8, 0],
                  }),
                },
              ],
            },
          ]}
        >
          <View style={[styles.speechBubbleBody, { backgroundColor: colors.surface, borderColor: colors.line }]}>
            <Text style={[styles.speechBubbleText, { color: colors.text }]}>{speechText}</Text>
          </View>
          <View style={[styles.speechBubbleTail, { borderTopColor: colors.surface }]} />
        </Animated.View>
      )}

      {/* Confetti Explosion System */}
      {confettiActive && (
        <View pointerEvents="none" style={styles.confettiContainer}>
          {confettiPieces.map((p) => {
            const rotDeg = p.rot.interpolate({
              inputRange: [-1440, 1440],
              outputRange: ['-1440deg', '1440deg'],
            });
            return (
              <Animated.View
                key={p.id}
                style={[
                  styles.confettiPiece,
                  {
                    width: p.w,
                    height: p.h,
                    backgroundColor: p.color,
                    opacity: p.opacity,
                    transform: [
                      { translateX: p.x },
                      { translateY: p.y },
                      { rotate: rotDeg },
                    ],
                  },
                ]}
              />
            );
          })}
        </View>
      )}

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${name} companion, state: ${state}`}
        onPress={handlePress}
        style={styles.pressableWrap}
      >
        {/* Floating "Z z z" bubbles when sleeping */}
        {state === 'sleeping' && (
          <View pointerEvents="none" style={[styles.zContainer, isLarge && styles.zContainerLarge]}>
            <Animated.Text
              style={[
                styles.zText,
                styles.zLarge,
                {
                  color: colors.accent,
                  opacity: zAnim1.interpolate({ inputRange: [0, 0.2, 0.8, 1], outputRange: [0, 0.95, 0.8, 0] }),
                  transform: [
                    { translateY: zAnim1.interpolate({ inputRange: [0, 1], outputRange: [0, -32] }) },
                    { translateX: zAnim1.interpolate({ inputRange: [0, 1], outputRange: [0, 10] }) },
                    { scale: zAnim1.interpolate({ inputRange: [0, 1], outputRange: [0.65, 1.15] }) },
                  ],
                },
              ]}
            >
              Z
            </Animated.Text>
            <Animated.Text
              style={[
                styles.zText,
                styles.zMedium,
                {
                  color: colors.accent,
                  opacity: zAnim2.interpolate({ inputRange: [0, 0.2, 0.8, 1], outputRange: [0, 0.95, 0.8, 0] }),
                  transform: [
                    { translateY: zAnim2.interpolate({ inputRange: [0, 1], outputRange: [0, -28] }) },
                    { translateX: zAnim2.interpolate({ inputRange: [0, 1], outputRange: [0, 12] }) },
                    { scale: zAnim2.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1.05] }) },
                  ],
                },
              ]}
            >
              z
            </Animated.Text>
            <Animated.Text
              style={[
                styles.zText,
                styles.zSmall,
                {
                  color: colors.accent,
                  opacity: zAnim3.interpolate({ inputRange: [0, 0.2, 0.8, 1], outputRange: [0, 0.95, 0.8, 0] }),
                  transform: [
                    { translateY: zAnim3.interpolate({ inputRange: [0, 1], outputRange: [0, -24] }) },
                    { translateX: zAnim3.interpolate({ inputRange: [0, 1], outputRange: [0, 14] }) },
                    { scale: zAnim3.interpolate({ inputRange: [0, 1], outputRange: [0.55, 0.95] }) },
                  ],
                },
              ]}
            >
              z
            </Animated.Text>
          </View>
        )}

        {/* Floating Confused "?" when Error */}
        {state === 'error' && (
          <Animated.View
            pointerEvents="none"
            style={[
              styles.questionMarkContainer,
              isLarge && styles.questionMarkContainerLarge,
              {
                transform: [
                  { rotate: questionDeg },
                  { translateY: questionWobble.interpolate({ inputRange: [-1, 1], outputRange: [-2, 2] }) },
                ],
              },
            ]}
          >
            <Text style={[styles.questionMarkText, { color: colors.error || '#E57373' }]}>?</Text>
          </Animated.View>
        )}

        {/* Happy Sparkle Reaction Particle */}
        <Animated.View
          pointerEvents="none"
          style={[
            styles.sparkleContainer,
            {
              opacity: moodSparkleAnim,
              transform: [
                {
                  translateY: moodSparkleAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0, -16],
                  }),
                },
                { scale: moodSparkleAnim },
              ],
            },
          ]}
        >
          <Text style={styles.sparkleText}>✨</Text>
        </Animated.View>

        {/* Voice Listening Wave Rings */}
        {state === 'listening' && (
          <View pointerEvents="none" style={[styles.listeningArcsWrap, { width: circleSize, height: circleSize }]}>
            <Animated.View
              style={[
                styles.listenPulseRing,
                {
                  width: circleSize + 6,
                  height: circleSize + 6,
                  borderRadius: (circleSize + 6) / 2,
                  borderColor: colors.accent,
                  opacity: listenWave1.interpolate({ inputRange: [0, 0.3, 1], outputRange: [0.9, 0.6, 0] }),
                  transform: [
                    { scale: listenWave1.interpolate({ inputRange: [0, 1], outputRange: [0.85, 1.4] }) },
                  ],
                },
              ]}
            />
            <Animated.View
              style={[
                styles.listenPulseRing,
                {
                  width: circleSize + 6,
                  height: circleSize + 6,
                  borderRadius: (circleSize + 6) / 2,
                  borderColor: colors.accent,
                  opacity: listenWave2.interpolate({ inputRange: [0, 0.3, 1], outputRange: [0.9, 0.6, 0] }),
                  transform: [
                    { scale: listenWave2.interpolate({ inputRange: [0, 1], outputRange: [0.85, 1.4] }) },
                  ],
                },
              ]}
            />
          </View>
        )}

        {/* The Outer Scaling Circle (Tap & Listen Scale) */}
        <Animated.View
          style={[
            styles.circleScaleWrap,
            {
              transform: [
                { scale: tapBounce },
              ],
            },
          ]}
        >
          {/* Circular Badge */}
          <Animated.View
            style={[
              styles.avatarCircle,
              {
                width: circleSize,
                height: circleSize,
                borderRadius: circleRadius,
                transform: [
                  { scale: listenScale },
                ],
              },
            ]}
          >
            {/* Position Layer 1: Idle Bobbing & Body Sway */}
            <Animated.View
              style={[
                styles.characterWrapper,
                {
                  width: charWidth,
                  height: charHeight,
                  transform: [
                    { translateY: bobAnim },
                    { translateX: swayAnim },
                  ],
                },
              ]}
            >
              {/* Position Layer 2: Tricks, Sleep, Jolt, Victory & Mood Offsets */}
              <Animated.View
                style={[
                  styles.innerLayer,
                  {
                    transform: [
                      { translateY: sleepOffsetY },
                      { translateY: snoreY },
                      { translateY: joltY },
                      { translateY: victoryBounce },
                      { translateY: trickFlipY },
                      { translateY: webZipY },
                      { translateY: moodBounceY },
                    ],
                  },
                ]}
              >
                {/* Rotation Layer: State Tilts & Tricks */}
                <Animated.View
                  style={[
                    styles.innerLayer,
                    {
                      transform: [
                        { rotate: headFocusRotation },
                        { rotate: sleepRotation },
                        { rotate: listenTilt },
                        { rotate: errorRotation },
                        { rotate: flipDeg },
                        { rotate: moodTiltDeg },
                      ],
                    },
                  ]}
                >
                  {/* Scale Layer: Breathing & Snore */}
                  <Animated.View
                    style={[
                      styles.innerLayer,
                      {
                        transform: [
                          { scaleX: breathAnim },
                          { scaleY: breathAnim },
                          { scale: snoreScale },
                        ],
                      },
                    ]}
                  >
                    {/* Web-Zip Line ("Thwip!") */}
                    {activeTrick === 'web' && (
                      <Animated.View
                        style={[
                          styles.webLine,
                          {
                            opacity: webLineOpacity,
                            transform: [{ scaleY: webLineScaleY }],
                          },
                        ]}
                      />
                    )}

                    {/* 1. Black Hood Background & Rim */}
                    <View
                      style={[
                        styles.hoodOuter,
                        {
                          width: hoodSize,
                          height: hoodSize,
                          borderRadius: hoodSize / 2,
                        },
                      ]}
                    >
                      <View
                        style={[
                          styles.hoodInnerFold,
                          {
                            width: hoodFoldSize,
                            height: hoodFoldSize,
                            borderRadius: hoodFoldSize / 2,
                          },
                        ]}
                      />
                    </View>

                    {/* 2. Red Masked Head */}
                    <View
                      style={[
                        styles.maskHead,
                        {
                          width: maskSize,
                          height: maskSize,
                          borderRadius: maskSize / 2,
                          top: isLarge ? 7 : 6,
                        },
                      ]}
                    >
                      {/* Web line accents */}
                      <View style={styles.webLineVertical} />
                      <View style={[styles.webLineBrow, { top: isLarge ? 12 : 10 }]} />
                      <View style={styles.webLineDiagonalLeft} />
                      <View style={styles.webLineDiagonalRight} />

                      {/* Spidy's Expressive Eyes */}
                      <Animated.View
                        style={[
                          styles.eyesRow,
                          {
                            gap: eyeGap,
                            transform: [
                              { translateX: glanceX },
                              { translateY: glanceY },
                              { scaleY: eyeSquintY },
                              { scaleX: eyeSquintX },
                            ],
                          },
                        ]}
                      >
                        {/* Left Eye */}
                        <View
                          style={[
                            styles.eyeBezelLeft,
                            {
                              width: eyeBezelW,
                              height: eyeBezelH,
                            },
                          ]}
                        >
                          <View
                            style={[
                              styles.eyeLensLeft,
                              {
                                width: eyeLensW,
                                height: eyeLensH,
                              },
                            ]}
                          />
                        </View>

                        {/* Right Eye (supports independent wink on wave) */}
                        <Animated.View style={{ transform: [{ scaleY: rightEyeWink }] }}>
                          <View
                            style={[
                              styles.eyeBezelRight,
                              {
                                width: eyeBezelW,
                                height: eyeBezelH,
                              },
                            ]}
                          >
                            <View
                              style={[
                                styles.eyeLensRight,
                                {
                                  width: eyeLensW,
                                  height: eyeLensH,
                                },
                              ]}
                            />
                          </View>
                        </Animated.View>
                      </Animated.View>
                    </View>

                    {/* 3. Black Hoodie Vest & Torso */}
                    <View
                      style={[
                        styles.torsoContainer,
                        {
                          width: torsoWidth,
                          height: torsoHeight,
                        },
                      ]}
                    >
                      <View
                        style={[
                          styles.redChest,
                          {
                            width: chestWidth,
                            height: chestHeight,
                          },
                        ]}
                      >
                        <View
                          style={[
                            styles.spiderEmblemBody,
                            isLarge && { width: 5, height: 9 },
                          ]}
                        />
                        <View
                          style={[
                            styles.spiderEmblemLegs,
                            isLarge && { width: 13, height: 2, top: 6 },
                          ]}
                        />
                      </View>
                      <View
                        style={[
                          styles.vestLeft,
                          {
                            width: vestWidth,
                            height: vestHeight,
                          },
                        ]}
                      />
                      <View
                        style={[
                          styles.vestRight,
                          {
                            width: vestWidth,
                            height: vestHeight,
                          },
                        ]}
                      />
                      <View
                        style={[
                          styles.suitBelt,
                          {
                            width: beltWidth,
                            height: beltHeight,
                          },
                        ]}
                      />
                    </View>

                    {/* Confused Scratching Hand on Error */}
                    {state === 'error' && (
                      <Animated.View
                        style={[
                          styles.scratchHand,
                          isLarge && { width: 8, height: 8, borderRadius: 4, right: 10, top: 7 },
                          {
                            transform: [{ translateX: errorScratch }],
                          },
                        ]}
                      />
                    )}

                    {/* Victory Fist Pump Hand */}
                    <Animated.View
                      style={[
                        styles.victoryHand,
                        isLarge && { width: 9, height: 9, borderRadius: 4.5, right: 7, top: 3 },
                        {
                          transform: [{ translateY: victoryFistY }],
                          opacity: victoryFistY.interpolate({ inputRange: [-10, 0], outputRange: [1, 0] }),
                        },
                      ]}
                    />

                    {/* Friendly Wave Arm */}
                    <Animated.View
                      style={[
                        styles.waveArm,
                        isLarge && { width: 5, height: 17, right: 8, top: 9 },
                        {
                          opacity: waveArmVisible,
                          transform: [{ rotate: waveArmDeg }],
                        },
                      ]}
                    >
                      <View style={[styles.waveHandTip, isLarge && { width: 8.5, height: 8.5, borderRadius: 4.25 }]} />
                    </Animated.View>

                    {/* 4. Laptop (Thinking State) */}
                    <Animated.View
                      style={[
                        styles.laptopWrap,
                        isLarge && { bottom: 3 },
                        {
                          transform: [
                            { scale: laptopScale },
                            { translateY: laptopY },
                          ],
                          opacity: laptopScale.interpolate({
                            inputRange: [0, 0.4, 1],
                            outputRange: [0, 0.9, 1],
                          }),
                        },
                      ]}
                    >
                      <View style={[styles.laptopScreen, isLarge && { width: 32, height: 18 }]}>
                        <View style={[styles.laptopDisplay, isLarge && { width: 26, height: 13 }]}>
                          <View style={[styles.screenCodeLine1, isLarge && { width: 16 }]} />
                          <View style={[styles.screenCodeLine2, isLarge && { width: 11 }]} />
                        </View>
                      </View>
                      <View style={[styles.laptopBase, isLarge && { width: 36, height: 5 }]} />

                      {/* Typing hands */}
                      <View style={[styles.pawsRow, isLarge && { width: 28 }]}>
                        <Animated.View
                          style={[
                            styles.handGlove,
                            isLarge && { width: 7, height: 7, borderRadius: 3.5 },
                            { transform: [{ translateY: typingLeft }] },
                          ]}
                        />
                        <Animated.View
                          style={[
                            styles.handGlove,
                            isLarge && { width: 7, height: 7, borderRadius: 3.5 },
                            { transform: [{ translateY: typingRight }] },
                          ]}
                        />
                      </View>
                    </Animated.View>
                  </Animated.View>
                </Animated.View>
              </Animated.View>
            </Animated.View>
          </Animated.View>
        </Animated.View>

        {/* The Dark Pill Badge with State Indicator */}
        <View
          style={[
            styles.nameBadge,
            isLarge && styles.nameBadgeLarge,
            state === 'sleeping' && styles.nameBadgeSleeping,
            state === 'listening' && styles.nameBadgeListening,
            state === 'error' && styles.nameBadgeError,
          ]}
        >
          <Text style={[styles.nameBadgeText, isLarge && styles.nameBadgeTextLarge]}>
            {state === 'sleeping'
              ? 'Spidy 💤'
              : state === 'listening'
              ? 'Listening… 🎙️'
              : state === 'error'
              ? 'Spidy ?'
              : mood === 'happy'
              ? 'Spidy ✨'
              : mood === 'sympathetic'
              ? 'Spidy 💙'
              : name}
          </Text>
          {state === 'thinking' && <View style={styles.typingDot} />}
        </View>
      </Pressable>
    </View>
  );
});

const styles = StyleSheet.create({
  rootContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'visible',
  },
  pressableWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'visible',
  },
  circleScaleWrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  innerLayer: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'flex-end',
  },

  // Comic Speech Bubble
  speechBubbleWrap: {
    position: 'absolute',
    alignItems: 'center',
    zIndex: 100,
    width: 220,
    maxWidth: '90%',
  },
  speechBubbleBody: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 14,
    borderWidth: 1,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 6,
  },
  speechBubbleText: {
    fontSize: 12.5,
    fontWeight: '600',
    textAlign: 'center',
    lineHeight: 16,
  },
  speechBubbleTail: {
    width: 0,
    height: 0,
    borderLeftWidth: 6,
    borderRightWidth: 6,
    borderTopWidth: 6,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    alignSelf: 'center',
    marginTop: -1,
  },

  // Confetti Explosion
  confettiContainer: {
    position: 'absolute',
    width: 0,
    height: 0,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 90,
  },
  confettiPiece: {
    position: 'absolute',
    borderRadius: 1.5,
  },

  // Floating "Z z z"
  zContainer: {
    position: 'absolute',
    top: -24,
    right: -8,
    width: 36,
    height: 38,
    zIndex: 20,
  },
  zContainerLarge: {
    top: -28,
    right: -12,
  },
  zText: {
    position: 'absolute',
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  zLarge: {
    fontSize: 16,
    bottom: 4,
    left: 4,
  },
  zMedium: {
    fontSize: 13,
    bottom: 2,
    left: 8,
  },
  zSmall: {
    fontSize: 10,
    bottom: 0,
    left: 12,
  },

  // Floating "?" on error
  questionMarkContainer: {
    position: 'absolute',
    top: -20,
    right: -6,
    zIndex: 25,
  },
  questionMarkContainerLarge: {
    top: -24,
    right: -10,
  },
  questionMarkText: {
    fontSize: 20,
    fontWeight: '900',
  },

  // Happy Sparkle Particle
  sparkleContainer: {
    position: 'absolute',
    top: -18,
    left: -4,
    zIndex: 25,
  },
  sparkleText: {
    fontSize: 18,
  },

  // Listening Pulse Rings
  listeningArcsWrap: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 0,
  },
  listenPulseRing: {
    position: 'absolute',
    borderWidth: 2,
  },

  // Circular white badge
  avatarCircle: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#E2E5EB',
    alignItems: 'center',
    justifyContent: 'flex-end',
    overflow: 'hidden',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.16,
    shadowRadius: 5,
    elevation: 4,
    zIndex: 5,
  },
  characterWrapper: {
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingBottom: 1,
  },

  // Web-Zip Line
  webLine: {
    position: 'absolute',
    top: -46,
    width: 2,
    height: 52,
    backgroundColor: 'rgba(255,255,255,0.95)',
    shadowColor: '#FFFFFF',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 3,
    zIndex: 30,
  },

  // Dark Hoodie
  hoodOuter: {
    position: 'absolute',
    top: 2,
    backgroundColor: '#1C1E23',
    alignItems: 'center',
  },
  hoodInnerFold: {
    backgroundColor: '#141619',
    marginTop: 2,
  },

  // Red Mask Head
  maskHead: {
    backgroundColor: '#D62323',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'absolute',
    zIndex: 2,
    overflow: 'hidden',
  },
  webLineVertical: {
    position: 'absolute',
    width: 1,
    height: '100%',
    backgroundColor: 'rgba(0,0,0,0.22)',
  },
  webLineBrow: {
    position: 'absolute',
    width: '100%',
    height: 1,
    backgroundColor: 'rgba(0,0,0,0.18)',
  },
  webLineDiagonalLeft: {
    position: 'absolute',
    width: 1,
    height: '100%',
    transform: [{ rotate: '35deg' }],
    backgroundColor: 'rgba(0,0,0,0.16)',
  },
  webLineDiagonalRight: {
    position: 'absolute',
    width: 1,
    height: '100%',
    transform: [{ rotate: '-35deg' }],
    backgroundColor: 'rgba(0,0,0,0.16)',
  },

  // Iconic Spider-Man Eyes
  eyesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 1,
    zIndex: 3,
  },
  eyeBezelLeft: {
    backgroundColor: '#000000',
    borderTopLeftRadius: 6,
    borderTopRightRadius: 2,
    borderBottomLeftRadius: 4,
    borderBottomRightRadius: 5,
    transform: [{ rotate: '12deg' }],
    alignItems: 'center',
    justifyContent: 'center',
    padding: 1.2,
  },
  eyeLensLeft: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 4.5,
    borderTopRightRadius: 1.5,
    borderBottomLeftRadius: 3,
    borderBottomRightRadius: 3.5,
  },
  eyeBezelRight: {
    backgroundColor: '#000000',
    borderTopRightRadius: 6,
    borderTopLeftRadius: 2,
    borderBottomRightRadius: 4,
    borderBottomLeftRadius: 5,
    transform: [{ rotate: '-12deg' }],
    alignItems: 'center',
    justifyContent: 'center',
    padding: 1.2,
  },
  eyeLensRight: {
    backgroundColor: '#FFFFFF',
    borderTopRightRadius: 4.5,
    borderTopLeftRadius: 1.5,
    borderBottomRightRadius: 3,
    borderBottomLeftRadius: 3.5,
  },

  // Torso / Vest
  torsoContainer: {
    position: 'absolute',
    bottom: 0,
    alignItems: 'center',
    zIndex: 1,
  },
  redChest: {
    backgroundColor: '#C82020',
    borderTopLeftRadius: 6,
    borderTopRightRadius: 6,
    alignItems: 'center',
    paddingTop: 3,
  },
  spiderEmblemBody: {
    width: 4,
    height: 7,
    backgroundColor: '#000000',
    borderRadius: 2,
  },
  spiderEmblemLegs: {
    position: 'absolute',
    top: 5,
    width: 10,
    height: 1.5,
    backgroundColor: '#000000',
    borderRadius: 1,
  },
  vestLeft: {
    position: 'absolute',
    left: 2,
    top: 0,
    backgroundColor: '#181A1D',
    borderTopLeftRadius: 4,
    borderBottomLeftRadius: 2,
  },
  vestRight: {
    position: 'absolute',
    right: 2,
    top: 0,
    backgroundColor: '#181A1D',
    borderTopRightRadius: 4,
    borderBottomRightRadius: 2,
  },
  suitBelt: {
    position: 'absolute',
    bottom: 0,
    backgroundColor: '#192C48',
  },

  // Scratching Hand on Error
  scratchHand: {
    position: 'absolute',
    top: 6,
    right: 8,
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#C82020',
    borderWidth: 0.5,
    borderColor: '#000000',
    zIndex: 12,
  },

  // Victory Hand on Reply
  victoryHand: {
    position: 'absolute',
    top: 2,
    right: 6,
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: '#C82020',
    borderWidth: 0.8,
    borderColor: '#000000',
    zIndex: 15,
  },

  // Wave Arm on Tap Trick
  waveArm: {
    position: 'absolute',
    top: 8,
    right: 6,
    width: 4,
    height: 14,
    backgroundColor: '#181A1D',
    borderRadius: 2,
    zIndex: 12,
  },
  waveHandTip: {
    position: 'absolute',
    top: -3,
    left: -1.5,
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: '#C82020',
    borderWidth: 0.5,
    borderColor: '#000000',
  },

  // Laptop
  laptopWrap: {
    position: 'absolute',
    bottom: 2,
    alignItems: 'center',
    zIndex: 10,
  },
  laptopScreen: {
    width: 26,
    height: 15,
    borderRadius: 3,
    backgroundColor: '#202228',
    borderWidth: 1,
    borderColor: '#363A42',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.35,
    shadowRadius: 2,
  },
  laptopDisplay: {
    width: 21,
    height: 10,
    borderRadius: 1.5,
    backgroundColor: '#0B0D10',
    paddingHorizontal: 2.5,
    justifyContent: 'center',
    gap: 2,
  },
  screenCodeLine1: {
    width: 13,
    height: 1.5,
    borderRadius: 1,
    backgroundColor: '#38D678',
    opacity: 0.9,
  },
  screenCodeLine2: {
    width: 9,
    height: 1.5,
    borderRadius: 1,
    backgroundColor: '#38D678',
    opacity: 0.55,
  },
  laptopBase: {
    width: 30,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#363A42',
    marginTop: 0.5,
  },
  pawsRow: {
    position: 'absolute',
    bottom: 2,
    width: 22,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  handGlove: {
    width: 5.5,
    height: 5.5,
    borderRadius: 2.75,
    backgroundColor: '#C82020',
    borderWidth: 0.5,
    borderColor: '#000000',
  },

  // Name Pill Badge ("Spidy")
  nameBadge: {
    marginTop: -8,
    backgroundColor: '#2E3238',
    paddingHorizontal: 11,
    paddingVertical: 3,
    borderRadius: 11,
    borderWidth: 1,
    borderColor: '#43474F',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.25,
    shadowRadius: 2,
    elevation: 3,
  },
  nameBadgeLarge: {
    marginTop: -10,
    paddingHorizontal: 13,
    paddingVertical: 4,
    borderRadius: 13,
  },
  nameBadgeSleeping: {
    borderColor: '#5A606B',
  },
  nameBadgeListening: {
    borderColor: '#38D678',
    backgroundColor: '#1E2F24',
  },
  nameBadgeError: {
    borderColor: '#E57373',
    backgroundColor: '#2D1F1F',
  },
  nameBadgeText: {
    color: '#FFFFFF',
    fontSize: 11.5,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
  nameBadgeTextLarge: {
    fontSize: 13,
  },
  typingDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#38D678',
  },
});
