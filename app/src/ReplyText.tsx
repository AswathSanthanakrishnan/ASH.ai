import { Alert, Linking, Text } from 'react-native';
import type { Palette } from './theme';

// Render only text, bold, and HTTP(S) links. Never execute HTML from a model.
export function ReplyText({ content, colors }: { content: string; colors: Palette }) {
  const parts = content.split(/(\[[^\]]+\]\(https?:\/\/[^\s]+\)|https?:\/\/[^\s<>]+|\*\*[^*]+\*\*)/g);
  return <Text selectable style={{ color: colors.text, fontSize: 16, lineHeight: 26 }}>
    {parts.map((part, index) => {
      const markdown = part.match(/^\[([^\]]+)\]\((https?:\/\/[^\s]+)\)$/);
      const url = markdown?.[2] ?? (/^https?:\/\//.test(part) ? part.replace(/[.,;!?]+$/, '') : undefined);
      if (url) return <Text key={index} accessibilityRole="link" accessibilityLabel={markdown?.[1] ?? url}
        style={{ color: colors.accent, textDecorationLine: 'underline' }}
        onPress={() => void Linking.openURL(url).catch(() => Alert.alert('Could not open link', url))}>
        {markdown?.[1] ?? part}
      </Text>;
      if (part.startsWith('**') && part.endsWith('**')) return <Text key={index} style={{ fontWeight: '600' }}>{part.slice(2, -2)}</Text>;
      return part;
    })}
  </Text>;
}
