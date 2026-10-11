import { memo, useRef, useState } from 'react';
import {
  Animated,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import type { Palette } from './theme';

interface Props {
  base64: string;
  caption?: string;
  colors: Palette;
}

export const ChatScreenshot = memo(function ChatScreenshot({ base64, caption, colors }: Props) {
  const [fullScreen, setFullScreen] = useState(false);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();

  const handleLoad = () => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 350,
      useNativeDriver: true,
    }).start();
  };

  const imageUri = base64.startsWith('data:image')
    ? base64
    : `data:image/png;base64,${base64}`;

  return (
    <View style={styles.container}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={caption ? `View screenshot: ${caption}` : 'View screenshot full screen'}
        onPress={() => setFullScreen(true)}
        style={[
          styles.card,
          {
            backgroundColor: colors.surface,
            borderColor: colors.line,
          },
        ]}
      >
        <Animated.Image
          source={{ uri: imageUri }}
          style={[styles.image, { opacity: fadeAnim }]}
          resizeMode="cover"
          onLoad={handleLoad}
        />
      </Pressable>
      {caption ? (
        <Text style={[styles.caption, { color: colors.muted }]}>
          {caption}
        </Text>
      ) : null}

      <Modal
        visible={fullScreen}
        transparent={false}
        animationType="fade"
        onRequestClose={() => setFullScreen(false)}
      >
        <SafeAreaView style={styles.modalScreen}>
          <StatusBar style="light" />
          <View style={styles.modalHeader}>
            <Text style={styles.modalCaption} numberOfLines={1}>
              {caption || 'Screenshot'}
            </Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Close screenshot"
              onPress={() => setFullScreen(false)}
              style={styles.closeBtn}
            >
              <Text style={styles.closeText}>✕</Text>
            </Pressable>
          </View>
          <ScrollView
            style={styles.modalScroll}
            contentContainerStyle={styles.modalScrollContent}
            maximumZoomScale={4}
            minimumZoomScale={1}
            centerContent
            showsHorizontalScrollIndicator={false}
            showsVerticalScrollIndicator={false}
          >
            <Image
              source={{ uri: imageUri }}
              style={{
                width: screenWidth,
                height: screenHeight - 110,
              }}
              resizeMode="contain"
            />
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    marginTop: 10,
    width: '100%',
  },
  card: {
    width: '100%',
    aspectRatio: 16 / 10,
    borderRadius: 16,
    borderWidth: 1,
    overflow: 'hidden',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  caption: {
    fontSize: 12,
    lineHeight: 16,
    letterSpacing: 0.2,
    marginTop: 6,
    paddingHorizontal: 4,
  },
  modalScreen: {
    flex: 1,
    backgroundColor: '#0b0c0e',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#202228',
  },
  modalCaption: {
    color: '#a4a7b2',
    fontSize: 14,
    flex: 1,
    marginRight: 16,
    fontWeight: '500',
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#1b1d22',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#2d3039',
  },
  closeText: {
    color: '#f0f0f2',
    fontSize: 16,
    lineHeight: 18,
    fontWeight: '600',
  },
  modalScroll: {
    flex: 1,
  },
  modalScrollContent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
