import { useCallback, useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { listUserNfceIntakes } from '@/api/client';
import { NfceReviewItem } from '@/api/types';
import { useAuth } from '@/auth/auth-context';
import { colors, spacing } from '@/components/theme';
import { Button, Message, ScreenScroll, Section } from '@/components/ui';
import { formatDateTime } from '@/utils/format';

export default function HistoryRoute() {
  const { session } = useAuth();
  const [items, setItems] = useState<NfceReviewItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadItems = useCallback(async () => {
    if (!session) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await listUserNfceIntakes(session.token);
      setItems(response);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao carregar NFC-e.');
    } finally {
      setLoading(false);
    }
  }, [session]);

  useEffect(() => {
    void loadItems();
  }, [loadItems]);

  return (
    <ScreenScroll refreshing={loading}>
      <View style={{ flexDirection: 'row', justifyContent: 'flex-end' }}>
        <Button label="Atualizar" onPress={loadItems} variant="secondary" />
      </View>

      {error ? <Message tone="error">{error}</Message> : null}
      {!loading && items.length === 0 ? (
        <Message>Nenhuma NFC-e enviada ainda.</Message>
      ) : null}

      {items.map((item) => (
        <Section
          key={item.id}
          title={item.status}
          subtitle={formatDateTime(item.created_at)}
        >
          <View style={{ gap: spacing.sm }}>
            <Text selectable style={{ color: colors.text, fontSize: 14 }}>
              Tipo: {item.extracted_type ?? '-'}
            </Text>
            <Text selectable style={{ color: colors.textMuted, fontSize: 13 }}>
              {item.extracted_value ?? item.original_filename ?? item.id}
            </Text>
            {item.last_error ? <Message tone="error">{item.last_error}</Message> : null}
          </View>
        </Section>
      ))}
    </ScreenScroll>
  );
}
