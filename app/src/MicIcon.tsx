import { StyleSheet, View } from 'react-native';

interface MicIconProps {
  color: string;
  size?: number;
  listening?: boolean;
}

export function MicIcon({ color, size = 18 }: MicIconProps) {
  // Proportional scaling based on base width 18, height 22
  const scale = size / 18;

  return (
    <View style={[styles.container, { transform: [{ scale }] }]}>
      {/* Microphone capsule */}
      <View style={[styles.capsule, { backgroundColor: color }]} />
      {/* Cradle arc */}
      <View style={[styles.cradle, { borderColor: color }]} />
      {/* Vertical stem */}
      <View style={[styles.stem, { backgroundColor: color }]} />
      {/* Horizontal base foot */}
      <View style={[styles.base, { backgroundColor: color }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: 18,
    height: 22,
    alignItems: 'center',
    justifyContent: 'flex-start',
  },
  capsule: {
    width: 7,
    height: 11,
    borderRadius: 3.5,
    position: 'absolute',
    top: 0,
  },
  cradle: {
    width: 13,
    height: 8,
    borderBottomLeftRadius: 6.5,
    borderBottomRightRadius: 6.5,
    borderWidth: 1.5,
    borderTopWidth: 0,
    position: 'absolute',
    top: 5,
  },
  stem: {
    width: 1.5,
    height: 4,
    position: 'absolute',
    top: 13,
  },
  base: {
    width: 9,
    height: 1.5,
    borderRadius: 0.75,
    position: 'absolute',
    top: 17,
  },
});
