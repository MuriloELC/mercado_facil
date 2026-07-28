import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { createUserShoppingList, listUserShoppingLists } from '@/api/client';
import { UserShoppingList } from '@/api/types';
import { useAuth } from '@/auth/auth-context';
import { colors, spacing } from '@/components/theme';
import { Button, Field, Message, ScreenScroll, Section } from '@/components/ui';
import { formatDateTime } from '@/utils/format';

export default function ListsRoute() {
  const router = useRouter();
  const { session, signOut } = useAuth();
  const [lists, setLists] = useState<UserShoppingList[]>([]);
  const [newListName, setNewListName] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadLists = useCallback(async () => {
    if (!session) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await listUserShoppingLists(session.token);
      setLists(response);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao carregar listas.');
    } finally {
      setLoading(false);
    }
  }, [session]);

  useEffect(() => {
    void loadLists();
  }, [loadLists]);

  async function handleCreateList() {
    if (!session || !newListName.trim()) {
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const created = await createUserShoppingList(session.token, newListName.trim());
      setNewListName('');
      setLists((current) => [created, ...current]);
      router.push({ pathname: '/list/[id]', params: { id: created.id } });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao criar lista.');
    } finally {
      setSaving(false);
    }
  }

  async function handleLogout() {
    await signOut();
    router.replace('/login');
  }

  return (
    <ScreenScroll refreshing={loading}>
      <Section title="Nova lista">
        <Field
          label="Nome"
          onChangeText={setNewListName}
          placeholder="Compra da semana"
          value={newListName}
        />
        <Button
          disabled={saving || newListName.trim().length < 2}
          label={saving ? 'Criando...' : 'Criar lista'}
          onPress={handleCreateList}
        />
      </Section>

      {error ? <Message tone="error">{error}</Message> : null}

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md }}>
        <Button label="Atualizar" onPress={loadLists} variant="secondary" />
        <Button label="Sair" onPress={handleLogout} variant="ghost" />
      </View>

      {!loading && lists.length === 0 ? (
        <Message>Nenhuma lista criada ainda.</Message>
      ) : null}

      {lists.map((list) => (
        <Pressable
          accessibilityRole="button"
          key={list.id}
          onPress={() =>
            router.push({ pathname: '/list/[id]', params: { id: list.id } })
          }
          style={({ pressed }) => ({
            opacity: pressed ? 0.75 : 1,
          })}
        >
          <Section title={list.name} subtitle={formatDateTime(list.created_at)}>
            <View style={{ flexDirection: 'row', gap: spacing.sm }}>
              <View
                style={{
                  borderRadius: 99,
                  backgroundColor:
                    list.status === 'active'
                      ? colors.primaryMuted
                      : colors.surfaceMuted,
                  paddingHorizontal: spacing.md,
                  paddingVertical: spacing.sm,
                }}
              >
                <Text
                  selectable
                  style={{
                    color:
                      list.status === 'active' ? colors.primary : colors.textMuted,
                    fontWeight: '800',
                  }}
                >
                  {list.status}
                </Text>
              </View>
            </View>
          </Section>
        </Pressable>
      ))}
    </ScreenScroll>
  );
}
