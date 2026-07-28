import { Link } from 'expo-router';
import { Text, View } from 'react-native';
import { colors, spacing } from '@/components/theme';
import { ScreenScroll } from '@/components/ui';

export default function NotFoundRoute() {
  return (
    <ScreenScroll>
      <View style={{ gap: spacing.md }}>
        <Text
          selectable
          style={{ color: colors.text, fontSize: 24, fontWeight: '900' }}
        >
          Pagina nao encontrada
        </Text>
        <Link href="/">
          <Text selectable style={{ color: colors.primary, fontWeight: '800' }}>
            Voltar ao inicio
          </Text>
        </Link>
      </View>
    </ScreenScroll>
  );
}
