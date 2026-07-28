import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, Text, View } from 'react-native';
import {
  createUserShoppingListItem,
  deleteUserShoppingList,
  deleteUserShoppingListItem,
  listUserShoppingListItems,
  listUserShoppingLists,
  updateUserShoppingList,
  updateUserShoppingListItem,
} from '@/api/client';
import {
  UserShoppingList,
  UserShoppingListItem,
  UserShoppingListStatus,
} from '@/api/types';
import { useAuth } from '@/auth/auth-context';
import { colors, spacing } from '@/components/theme';
import {
  Button,
  Field,
  Message,
  ScreenScroll,
  Section,
  SegmentedControl,
} from '@/components/ui';
import { formatQuantity } from '@/utils/format';

type ItemForm = {
  raw_text: string;
  quantity: string;
  unit: string;
};

const emptyItemForm: ItemForm = {
  raw_text: '',
  quantity: '1',
  unit: '',
};

const statusOptions: Array<{ label: string; value: UserShoppingListStatus }> = [
  { label: 'Ativa', value: 'active' },
  { label: 'Concluida', value: 'completed' },
  { label: 'Arquivada', value: 'archived' },
];

export default function ListDetailRoute() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { session } = useAuth();
  const [list, setList] = useState<UserShoppingList | null>(null);
  const [items, setItems] = useState<UserShoppingListItem[]>([]);
  const [listName, setListName] = useState('');
  const [listStatus, setListStatus] = useState<UserShoppingListStatus>('active');
  const [newItem, setNewItem] = useState<ItemForm>(emptyItemForm);
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [editingItem, setEditingItem] = useState<ItemForm>(emptyItemForm);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const listId = Array.isArray(id) ? id[0] : id;

  const checkedCount = useMemo(
    () => items.filter((item) => item.checked).length,
    [items],
  );

  const loadDetail = useCallback(async () => {
    if (!session || !listId) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const [allLists, listItems] = await Promise.all([
        listUserShoppingLists(session.token),
        listUserShoppingListItems(session.token, listId),
      ]);
      const selected = allLists.find((candidate) => candidate.id === listId) ?? null;

      setList(selected);
      setItems(listItems);
      if (selected) {
        setListName(selected.name);
        setListStatus(selected.status);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao carregar lista.');
    } finally {
      setLoading(false);
    }
  }, [listId, session]);

  useEffect(() => {
    void loadDetail();
  }, [loadDetail]);

  async function handleSaveList() {
    if (!session || !listId || !listName.trim()) {
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const updated = await updateUserShoppingList(session.token, listId, {
        name: listName.trim(),
        status: listStatus,
      });
      setList(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao salvar lista.');
    } finally {
      setSaving(false);
    }
  }

  function handleDeleteList() {
    if (!session || !listId) {
      return;
    }

    Alert.alert('Excluir lista', 'Deseja excluir esta lista e seus itens?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Excluir',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteUserShoppingList(session.token, listId);
            router.replace('/(tabs)/lists');
          } catch (err) {
            setError(err instanceof Error ? err.message : 'Falha ao excluir lista.');
          }
        },
      },
    ]);
  }

  async function handleCreateItem() {
    if (!session || !listId || !newItem.raw_text.trim()) {
      return;
    }

    setSaving(true);
    setError(null);

    try {
      await createUserShoppingListItem(session.token, listId, {
        raw_text: newItem.raw_text.trim(),
        quantity: Number(newItem.quantity || 1),
        unit: newItem.unit.trim() || undefined,
      });
      setNewItem(emptyItemForm);
      await loadDetail();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao adicionar item.');
    } finally {
      setSaving(false);
    }
  }

  async function handleToggleItem(item: UserShoppingListItem) {
    if (!session || !listId) {
      return;
    }

    try {
      const updated = await updateUserShoppingListItem(
        session.token,
        listId,
        item.id,
        { checked: !item.checked },
      );
      setItems((current) =>
        current.map((candidate) =>
          candidate.id === updated.id ? updated : candidate,
        ),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao atualizar item.');
    }
  }

  function startEditingItem(item: UserShoppingListItem) {
    setEditingItemId(item.id);
    setEditingItem({
      raw_text: item.raw_text,
      quantity: formatQuantity(item.quantity),
      unit: item.unit ?? '',
    });
  }

  async function handleSaveItem() {
    if (!session || !listId || !editingItemId || !editingItem.raw_text.trim()) {
      return;
    }

    setSaving(true);
    setError(null);

    try {
      await updateUserShoppingListItem(session.token, listId, editingItemId, {
        raw_text: editingItem.raw_text.trim(),
        quantity: Number(editingItem.quantity || 1),
        unit: editingItem.unit.trim() || undefined,
      });
      setEditingItemId(null);
      setEditingItem(emptyItemForm);
      await loadDetail();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao salvar item.');
    } finally {
      setSaving(false);
    }
  }

  function handleDeleteItem(item: UserShoppingListItem) {
    if (!session || !listId) {
      return;
    }

    Alert.alert('Remover item', `Remover "${item.raw_text}" da lista?`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Remover',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteUserShoppingListItem(session.token, listId, item.id);
            setItems((current) =>
              current.filter((candidate) => candidate.id !== item.id),
            );
          } catch (err) {
            setError(err instanceof Error ? err.message : 'Falha ao remover item.');
          }
        },
      },
    ]);
  }

  if (!listId) {
    return (
      <ScreenScroll>
        <Message tone="error">Lista invalida.</Message>
      </ScreenScroll>
    );
  }

  return (
    <ScreenScroll refreshing={loading}>
      {error ? <Message tone="error">{error}</Message> : null}
      {!loading && !list ? <Message tone="error">Lista nao encontrada.</Message> : null}

      {list ? (
        <>
          <Section
            title={list.name}
            subtitle={`${checkedCount}/${items.length} itens marcados`}
          >
            <Field
              label="Nome"
              onChangeText={setListName}
              placeholder="Nome da lista"
              value={listName}
            />
            <SegmentedControl
              onChange={setListStatus}
              options={statusOptions}
              value={listStatus}
            />
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md }}>
              <Button
                disabled={saving || listName.trim().length < 2}
                label={saving ? 'Salvando...' : 'Salvar'}
                onPress={handleSaveList}
              />
              <Button label="Excluir" onPress={handleDeleteList} variant="danger" />
            </View>
          </Section>

          <Section title="Adicionar item">
            <Field
              label="Descricao"
              onChangeText={(value) =>
                setNewItem((current) => ({ ...current, raw_text: value }))
              }
              placeholder="Arroz tipo 1"
              value={newItem.raw_text}
            />
            <Field
              keyboardType="decimal-pad"
              label="Quantidade"
              onChangeText={(value) =>
                setNewItem((current) => ({ ...current, quantity: value }))
              }
              value={newItem.quantity}
            />
            <Field
              label="Unidade"
              onChangeText={(value) =>
                setNewItem((current) => ({ ...current, unit: value }))
              }
              placeholder="kg, un, pct"
              value={newItem.unit}
            />
            <Button
              disabled={saving || !newItem.raw_text.trim()}
              label="Adicionar"
              onPress={handleCreateItem}
            />
          </Section>

          {editingItemId ? (
            <Section title="Editar item">
              <Field
                label="Descricao"
                onChangeText={(value) =>
                  setEditingItem((current) => ({ ...current, raw_text: value }))
                }
                value={editingItem.raw_text}
              />
              <Field
                keyboardType="decimal-pad"
                label="Quantidade"
                onChangeText={(value) =>
                  setEditingItem((current) => ({ ...current, quantity: value }))
                }
                value={editingItem.quantity}
              />
              <Field
                label="Unidade"
                onChangeText={(value) =>
                  setEditingItem((current) => ({ ...current, unit: value }))
                }
                value={editingItem.unit}
              />
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md }}>
                <Button
                  disabled={saving || !editingItem.raw_text.trim()}
                  label="Salvar item"
                  onPress={handleSaveItem}
                />
                <Button
                  label="Cancelar"
                  onPress={() => {
                    setEditingItemId(null);
                    setEditingItem(emptyItemForm);
                  }}
                  variant="secondary"
                />
              </View>
            </Section>
          ) : null}

          {items.length === 0 ? <Message>Nenhum item nesta lista.</Message> : null}

          {items.map((item) => (
            <Section key={item.id} title={item.raw_text}>
              <View style={{ gap: spacing.sm }}>
                <Text selectable style={{ color: colors.textMuted, fontSize: 14 }}>
                  {formatQuantity(item.quantity)} {item.unit ?? ''}
                </Text>
                <View
                  style={{
                    flexDirection: 'row',
                    flexWrap: 'wrap',
                    gap: spacing.md,
                  }}
                >
                  <Pressable
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: item.checked }}
                    onPress={() => void handleToggleItem(item)}
                    style={{
                      minHeight: 44,
                      justifyContent: 'center',
                      borderRadius: 12,
                      backgroundColor: item.checked
                        ? colors.primaryMuted
                        : colors.surfaceMuted,
                      paddingHorizontal: spacing.md,
                    }}
                  >
                    <Text
                      selectable
                      style={{
                        color: item.checked ? colors.primary : colors.textMuted,
                        fontWeight: '800',
                      }}
                    >
                      {item.checked ? 'Marcado' : 'Pendente'}
                    </Text>
                  </Pressable>
                  <Button
                    label="Editar"
                    onPress={() => startEditingItem(item)}
                    variant="secondary"
                  />
                  <Button
                    label="Remover"
                    onPress={() => handleDeleteItem(item)}
                    variant="danger"
                  />
                </View>
              </View>
            </Section>
          ))}
        </>
      ) : null}
    </ScreenScroll>
  );
}
