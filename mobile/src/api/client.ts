import {
  AuthResponse,
  NfceReviewItem,
  UserShoppingList,
  UserShoppingListItem,
  UserShoppingListStatus,
} from './types';

const apiBase = process.env.EXPO_PUBLIC_API_URL?.replace(/\/$/, '');

function getApiBase(): string {
  if (!apiBase) {
    throw new Error(
      'Configure EXPO_PUBLIC_API_URL no mobile/.env. Em celular fisico, use o IP da maquina do backend, nao localhost.',
    );
  }

  return apiBase;
}

async function requestJson<T>(
  path: string,
  init: RequestInit,
  token?: string,
): Promise<T> {
  const headers = new Headers(init.headers ?? {});

  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  const response = await fetch(`${getApiBase()}${path}`, {
    ...init,
    headers,
  });

  const contentType = response.headers.get('content-type');
  const payload = contentType?.includes('application/json')
    ? await response.json()
    : await response.text();

  if (!response.ok) {
    const message =
      typeof payload === 'string'
        ? payload
        : payload?.message ?? 'Falha na requisicao.';

    throw new Error(Array.isArray(message) ? message.join(', ') : message);
  }

  return payload as T;
}

export function login(email: string, password: string): Promise<AuthResponse> {
  return requestJson<AuthResponse>('/auth/login', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ email, password }),
  });
}

export function sendNfceQrText(
  token: string,
  qrText: string,
): Promise<NfceReviewItem> {
  return requestJson<NfceReviewItem>(
    '/user/nfce/intake',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ qr_text: qrText }),
    },
    token,
  );
}

export function listUserNfceIntakes(token: string): Promise<NfceReviewItem[]> {
  return requestJson<NfceReviewItem[]>(
    '/user/nfce/intakes',
    { method: 'GET' },
    token,
  );
}

export function createUserShoppingList(
  token: string,
  name: string,
): Promise<UserShoppingList> {
  return requestJson<UserShoppingList>(
    '/user/lists',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ name }),
    },
    token,
  );
}

export function listUserShoppingLists(
  token: string,
): Promise<UserShoppingList[]> {
  return requestJson<UserShoppingList[]>(
    '/user/lists',
    { method: 'GET' },
    token,
  );
}

export function updateUserShoppingList(
  token: string,
  listId: string,
  payload: { name?: string; status?: UserShoppingListStatus },
): Promise<UserShoppingList> {
  return requestJson<UserShoppingList>(
    `/user/lists/${listId}`,
    {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    },
    token,
  );
}

export function deleteUserShoppingList(
  token: string,
  listId: string,
): Promise<{ deleted: true }> {
  return requestJson<{ deleted: true }>(
    `/user/lists/${listId}`,
    { method: 'DELETE' },
    token,
  );
}

export function listUserShoppingListItems(
  token: string,
  listId: string,
): Promise<UserShoppingListItem[]> {
  return requestJson<UserShoppingListItem[]>(
    `/user/lists/${listId}/items`,
    { method: 'GET' },
    token,
  );
}

export function createUserShoppingListItem(
  token: string,
  listId: string,
  payload: { raw_text: string; quantity?: number; unit?: string },
): Promise<UserShoppingListItem> {
  return requestJson<UserShoppingListItem>(
    `/user/lists/${listId}/items`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    },
    token,
  );
}

export function updateUserShoppingListItem(
  token: string,
  listId: string,
  itemId: string,
  payload: {
    raw_text?: string;
    quantity?: number;
    unit?: string;
    checked?: boolean;
  },
): Promise<UserShoppingListItem> {
  return requestJson<UserShoppingListItem>(
    `/user/lists/${listId}/items/${itemId}`,
    {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    },
    token,
  );
}

export function deleteUserShoppingListItem(
  token: string,
  listId: string,
  itemId: string,
): Promise<{ deleted: true }> {
  return requestJson<{ deleted: true }>(
    `/user/lists/${listId}/items/${itemId}`,
    { method: 'DELETE' },
    token,
  );
}
