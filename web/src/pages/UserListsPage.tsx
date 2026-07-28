import { FormEvent, useEffect, useMemo, useState } from 'react';
import {
  createUserShoppingList,
  createUserShoppingListItem,
  deleteUserShoppingList,
  deleteUserShoppingListItem,
  intakeUserNfce,
  listUserNfceIntakes,
  listUserShoppingListItems,
  listUserShoppingLists,
  updateUserShoppingList,
  updateUserShoppingListItem,
} from '../api/client';
import { NfceReviewItem, UserShoppingList, UserShoppingListItem } from '../api/types';

type UserListsPageProps = {
  token: string;
};

export function UserListsPage({ token }: UserListsPageProps) {
  const [newListName, setNewListName] = useState('');
  const [lists, setLists] = useState<UserShoppingList[]>([]);
  const [selectedListId, setSelectedListId] = useState<string>('');
  const [items, setItems] = useState<UserShoppingListItem[]>([]);

  const [nfceFile, setNfceFile] = useState<File | null>(null);
  const [nfceHint, setNfceHint] = useState('');
  const [nfceQueue, setNfceQueue] = useState<NfceReviewItem[]>([]);

  const [newItemText, setNewItemText] = useState('');
  const [newItemQty, setNewItemQty] = useState('1');
  const [newItemUnit, setNewItemUnit] = useState('');

  const [editingListName, setEditingListName] = useState('');
  const [editingListStatus, setEditingListStatus] = useState<'active' | 'archived' | 'completed'>('active');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const selectedList = useMemo(
    () => lists.find((list) => list.id === selectedListId) ?? null,
    [lists, selectedListId],
  );

  async function loadLists(): Promise<void> {
    setLoading(true);
    setError(null);

    try {
      const response = await listUserShoppingLists(token);
      setLists(response);

      if (!selectedListId && response.length > 0) {
        setSelectedListId(response[0].id);
      }

      if (selectedListId && !response.some((r) => r.id === selectedListId)) {
        setSelectedListId(response[0]?.id ?? '');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao carregar listas.');
    } finally {
      setLoading(false);
    }
  }

  async function loadNfceQueue(): Promise<void> {
    try {
      const response = await listUserNfceIntakes(token);
      setNfceQueue(response);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao carregar fila NFC-e.');
    }
  }

  async function loadItems(listId: string): Promise<void> {
    if (!listId) {
      setItems([]);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await listUserShoppingListItems(token, listId);
      setItems(response);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao carregar itens.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadLists();
    void loadNfceQueue();
  }, []);

  useEffect(() => {
    if (selectedListId) {
      void loadItems(selectedListId);
    } else {
      setItems([]);
    }

    const current = lists.find((l) => l.id === selectedListId);
    if (current) {
      setEditingListName(current.name);
      setEditingListStatus(current.status);
    }
  }, [selectedListId, lists]);

  async function handleNfceUpload(event: FormEvent): Promise<void> {
    event.preventDefault();
    if (!nfceFile) {
      setError('Selecione uma imagem da NFC-e.');
      return;
    }

    setError(null);
    setSuccess(null);

    try {
      const form = new FormData();
      form.append('image', nfceFile);
      if (nfceHint.trim()) {
        form.append('ocr_hint_text', nfceHint.trim());
      }

      const created = await intakeUserNfce(token, form);
      setNfceFile(null);
      setNfceHint('');
      setSuccess(`NFC-e enviada para fila: ${created.status}`);
      await loadNfceQueue();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao enviar NFC-e.');
    }
  }

  async function handleCreateList(event: FormEvent): Promise<void> {
    event.preventDefault();
    setError(null);
    setSuccess(null);

    try {
      const created = await createUserShoppingList(token, newListName.trim());
      setNewListName('');
      setSuccess(`Lista criada: ${created.name}`);
      await loadLists();
      setSelectedListId(created.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao criar lista.');
    }
  }

  async function handleUpdateList(): Promise<void> {
    if (!selectedListId) return;
    setError(null);
    setSuccess(null);

    try {
      await updateUserShoppingList(token, selectedListId, {
        name: editingListName,
        status: editingListStatus,
      });
      setSuccess('Lista atualizada.');
      await loadLists();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao atualizar lista.');
    }
  }

  async function handleDeleteList(): Promise<void> {
    if (!selectedListId) return;

    const confirmed = window.confirm('Deseja realmente excluir esta lista e seus itens?');
    if (!confirmed) return;

    setError(null);
    setSuccess(null);

    try {
      await deleteUserShoppingList(token, selectedListId);
      setSuccess('Lista excluida.');
      setSelectedListId('');
      await loadLists();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao excluir lista.');
    }
  }

  async function handleCreateItem(event: FormEvent): Promise<void> {
    event.preventDefault();
    if (!selectedListId) {
      setError('Selecione uma lista antes de adicionar itens.');
      return;
    }

    setError(null);
    setSuccess(null);

    try {
      await createUserShoppingListItem(token, selectedListId, {
        raw_text: newItemText.trim(),
        quantity: Number(newItemQty),
        unit: newItemUnit || undefined,
      });
      setNewItemText('');
      setNewItemQty('1');
      setNewItemUnit('');
      setSuccess('Item adicionado.');
      await loadItems(selectedListId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao criar item.');
    }
  }

  async function toggleItemChecked(item: UserShoppingListItem): Promise<void> {
    if (!selectedListId) return;

    try {
      await updateUserShoppingListItem(token, selectedListId, item.id, {
        checked: !item.checked,
      });
      await loadItems(selectedListId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao atualizar item.');
    }
  }

  async function quickEditItem(item: UserShoppingListItem): Promise<void> {
    if (!selectedListId) return;

    const rawText = window.prompt('Descricao do item', item.raw_text);
    if (rawText === null) return;

    const quantityInput = window.prompt('Quantidade', item.quantity);
    if (quantityInput === null) return;

    const unitInput = window.prompt('Unidade', item.unit ?? '') ?? '';

    try {
      await updateUserShoppingListItem(token, selectedListId, item.id, {
        raw_text: rawText.trim(),
        quantity: Number(quantityInput),
        unit: unitInput.trim() || undefined,
      });
      await loadItems(selectedListId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao editar item.');
    }
  }

  async function removeItem(itemId: string): Promise<void> {
    if (!selectedListId) return;

    const confirmed = window.confirm('Remover este item da lista?');
    if (!confirmed) return;

    try {
      await deleteUserShoppingListItem(token, selectedListId, itemId);
      await loadItems(selectedListId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao excluir item.');
    }
  }

  return (
    <section className="card">
      <h1 className="title">Minhas listas de compras</h1>
      <p className="subtitle">Fluxo simples: NFC-e para fila + CRUD de listas e itens.</p>

      <h2 style={{ marginTop: 8 }}>Enviar foto de NFC-e</h2>
      <form onSubmit={handleNfceUpload}>
        <div className="form-grid">
          <div className="field">
            <label>Imagem da NFC-e</label>
            <input
              type="file"
              accept="image/*"
              capture="environment"
              onChange={(event) => setNfceFile(event.target.files?.[0] ?? null)}
              required
            />
          </div>
          <div className="field">
            <label>Dica de texto (opcional)</label>
            <input
              value={nfceHint}
              onChange={(event) => setNfceHint(event.target.value)}
              placeholder="URL/chave se quiser ajudar a extração"
            />
          </div>
        </div>
        <div className="button-row">
          <button className="primary" type="submit" disabled={!nfceFile}>
            Enviar para fila de revisão
          </button>
          <button className="secondary" type="button" onClick={() => void loadNfceQueue()}>
            Atualizar fila NFC-e
          </button>
        </div>
      </form>

      <table className="table" style={{ marginTop: 12 }}>
        <thead>
          <tr>
            <th>Arquivo</th>
            <th>Status</th>
            <th>Extração</th>
            <th>Tentativas</th>
          </tr>
        </thead>
        <tbody>
          {nfceQueue.map((row) => (
            <tr key={row.id}>
              <td>{row.original_filename ?? row.id}</td>
              <td>{row.status}</td>
              <td>
                {row.extracted_type ? `${row.extracted_type}: ${row.extracted_value}` : '-'}
              </td>
              <td>{row.extraction_attempts}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <h2 style={{ marginTop: 20 }}>Criar lista</h2>
      <form onSubmit={handleCreateList}>
        <div className="form-grid">
          <div className="field">
            <label htmlFor="list_name">Nova lista</label>
            <input
              id="list_name"
              value={newListName}
              onChange={(event) => setNewListName(event.target.value)}
              placeholder="Ex.: Compra da semana"
              required
            />
          </div>
        </div>

        <div className="button-row">
          <button className="primary" type="submit" disabled={!newListName.trim()}>
            Criar lista
          </button>
          <button className="secondary" type="button" onClick={() => void loadLists()}>
            Atualizar listas
          </button>
        </div>
      </form>

      {error ? <p className="error" style={{ marginTop: 12 }}>{error}</p> : null}
      {success ? <p className="success" style={{ marginTop: 12 }}>{success}</p> : null}
      {loading ? <p className="muted">Carregando...</p> : null}

      <h2 style={{ marginTop: 20 }}>Listas existentes</h2>
      <table className="table">
        <thead>
          <tr>
            <th>Nome</th>
            <th>Status</th>
            <th>Criada em</th>
            <th>Selecionar</th>
          </tr>
        </thead>
        <tbody>
          {lists.map((list) => (
            <tr key={list.id}>
              <td>{list.name}</td>
              <td>{list.status}</td>
              <td>{new Date(list.created_at).toLocaleString()}</td>
              <td>
                <button
                  className="secondary"
                  type="button"
                  onClick={() => setSelectedListId(list.id)}
                >
                  {selectedListId === list.id ? 'Selecionada' : 'Selecionar'}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {!selectedList ? (
        <p className="muted" style={{ marginTop: 12 }}>
          Selecione uma lista para editar e gerenciar itens.
        </p>
      ) : (
        <>
          <h2 style={{ marginTop: 24 }}>Editar lista selecionada</h2>
          <div className="form-grid">
            <div className="field">
              <label>Nome</label>
              <input
                value={editingListName}
                onChange={(event) => setEditingListName(event.target.value)}
              />
            </div>
            <div className="field">
              <label>Status</label>
              <select
                value={editingListStatus}
                onChange={(event) =>
                  setEditingListStatus(
                    event.target.value as 'active' | 'archived' | 'completed',
                  )
                }
              >
                <option value="active">active</option>
                <option value="archived">archived</option>
                <option value="completed">completed</option>
              </select>
            </div>
          </div>

          <div className="button-row">
            <button className="primary" type="button" onClick={() => void handleUpdateList()}>
              Salvar lista
            </button>
            <button className="danger" type="button" onClick={() => void handleDeleteList()}>
              Excluir lista
            </button>
          </div>

          <h2 style={{ marginTop: 24 }}>Itens da lista</h2>

          <form onSubmit={handleCreateItem}>
            <div className="form-grid">
              <div className="field">
                <label>Descricao</label>
                <input
                  value={newItemText}
                  onChange={(event) => setNewItemText(event.target.value)}
                  required
                />
              </div>
              <div className="field">
                <label>Quantidade</label>
                <input
                  value={newItemQty}
                  onChange={(event) => setNewItemQty(event.target.value)}
                />
              </div>
              <div className="field">
                <label>Unidade</label>
                <input
                  value={newItemUnit}
                  onChange={(event) => setNewItemUnit(event.target.value)}
                />
              </div>
            </div>
            <div className="button-row">
              <button className="primary" type="submit">Adicionar item</button>
            </div>
          </form>

          <table className="table" style={{ marginTop: 12 }}>
            <thead>
              <tr>
                <th>Item</th>
                <th>Qtd</th>
                <th>Unidade</th>
                <th>Feito</th>
                <th>Acoes</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id}>
                  <td>{item.raw_text}</td>
                  <td>{item.quantity}</td>
                  <td>{item.unit ?? '-'}</td>
                  <td>
                    <input
                      type="checkbox"
                      checked={item.checked}
                      onChange={() => void toggleItemChecked(item)}
                    />
                  </td>
                  <td>
                    <div className="button-row">
                      <button
                        className="secondary"
                        type="button"
                        onClick={() => void quickEditItem(item)}
                      >
                        Editar
                      </button>
                      <button
                        className="danger"
                        type="button"
                        onClick={() => void removeItem(item.id)}
                      >
                        Excluir
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {items.length === 0 ? (
            <p className="muted">Nenhum item nessa lista ainda.</p>
          ) : null}
        </>
      )}
    </section>
  );
}
