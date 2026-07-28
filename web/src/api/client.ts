import {
  AuthResponse,
  ManualProcessPayload,
  Market,
  NfceManualPrefill,
  NfceReviewItem,
  Product,
  ProductClassificationResponse,
  Receipt,
  ReceiptListItem,
  UserShoppingList,
  UserShoppingListItem,
} from './types';

const API_BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:3001';

async function requestJson<T>(
  path: string,
  init: RequestInit,
  token?: string,
): Promise<T> {
  const headers = new Headers(init.headers ?? {});

  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  const response = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers,
  });

  const contentType = response.headers.get('content-type');
  const isJson = contentType?.includes('application/json');
  const payload = isJson ? await response.json() : await response.text();

  if (!response.ok) {
    const message =
      typeof payload === 'string'
        ? payload
        : payload?.message ?? 'Request failed';
    throw new Error(Array.isArray(message) ? message.join(', ') : message);
  }

  return payload as T;
}

export async function login(email: string, password: string): Promise<AuthResponse> {
  return requestJson<AuthResponse>(
    '/auth/login',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email, password }),
    },
  );
}

export async function createUserShoppingList(
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

export async function listUserShoppingLists(token: string): Promise<UserShoppingList[]> {
  return requestJson<UserShoppingList[]>('/user/lists', { method: 'GET' }, token);
}

export async function updateUserShoppingList(
  token: string,
  listId: string,
  payload: { name?: string; status?: 'active' | 'archived' | 'completed' },
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

export async function deleteUserShoppingList(
  token: string,
  listId: string,
): Promise<{ deleted: true }> {
  return requestJson<{ deleted: true }>(
    `/user/lists/${listId}`,
    { method: 'DELETE' },
    token,
  );
}

export async function listUserShoppingListItems(
  token: string,
  listId: string,
): Promise<UserShoppingListItem[]> {
  return requestJson<UserShoppingListItem[]>(
    `/user/lists/${listId}/items`,
    { method: 'GET' },
    token,
  );
}

export async function createUserShoppingListItem(
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

export async function updateUserShoppingListItem(
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

export async function deleteUserShoppingListItem(
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

export async function intakeReceipt(
  token: string,
  formData: FormData,
): Promise<Receipt> {
  return requestJson<Receipt>(
    '/admin/receipts/intake',
    {
      method: 'POST',
      body: formData,
    },
    token,
  );
}

export async function intakeAdminNfce(
  token: string,
  formData: FormData,
): Promise<NfceReviewItem> {
  return requestJson<NfceReviewItem>(
    '/admin/nfce/intake',
    {
      method: 'POST',
      body: formData,
    },
    token,
  );
}

export async function listReceipts(
  token: string,
  query: {
    status?: string;
    search?: string;
    from?: string;
    to?: string;
    limit?: string;
    offset?: string;
  },
): Promise<ReceiptListItem[]> {
  const params = new URLSearchParams();
  Object.entries(query).forEach(([key, value]) => {
    if (value) {
      params.set(key, value);
    }
  });

  const suffix = params.toString() ? `?${params.toString()}` : '';

  return requestJson<ReceiptListItem[]>(
    `/admin/receipts${suffix}`,
    { method: 'GET' },
    token,
  );
}

export async function getReceipt(token: string, id: string): Promise<Receipt> {
  return requestJson<Receipt>(`/admin/receipts/${id}`, { method: 'GET' }, token);
}

export async function claimReceipt(token: string, id: string): Promise<Receipt> {
  return requestJson<Receipt>(
    `/admin/receipts/${id}/claim`,
    { method: 'POST' },
    token,
  );
}

export async function markFailed(token: string, id: string): Promise<Receipt> {
  return requestJson<Receipt>(
    `/admin/receipts/${id}/mark-failed`,
    { method: 'POST' },
    token,
  );
}

export async function markDuplicate(token: string, id: string): Promise<Receipt> {
  return requestJson<Receipt>(
    `/admin/receipts/${id}/mark-duplicate`,
    { method: 'POST' },
    token,
  );
}

export async function manualProcessReceipt(
  token: string,
  id: string,
  payload: ManualProcessPayload,
): Promise<Receipt> {
  return requestJson<Receipt>(
    `/admin/receipts/${id}/manual-process`,
    {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    },
    token,
  );
}

export async function listProducts(
  token: string,
  q?: string,
): Promise<Product[]> {
  const suffix = q ? `?q=${encodeURIComponent(q)}` : '';
  return requestJson<Product[]>(`/admin/products${suffix}`, { method: 'GET' }, token);
}

export async function classifyProduct(
  token: string,
  payload: {
    raw_description: string;
    ncm?: string;
    unit?: string;
    brand?: string;
    top_k?: number;
  },
): Promise<ProductClassificationResponse> {
  return requestJson<ProductClassificationResponse>(
    '/admin/products/classify',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    },
    token,
  );
}

export async function createProduct(
  token: string,
  payload: {
    canonical_name: string;
    category?: string;
    brand?: string;
  },
): Promise<Product> {
  return requestJson<Product>(
    '/admin/products',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    },
    token,
  );
}

export async function listMarkets(token: string, q?: string): Promise<Market[]> {
  const suffix = q ? `?q=${encodeURIComponent(q)}` : '';
  return requestJson<Market[]>(`/admin/markets${suffix}`, { method: 'GET' }, token);
}

export async function createMarket(
  token: string,
  payload: {
    name: string;
    city: string;
    chain_name?: string;
    cnpj?: string;
    state_code?: string;
    neighborhood?: string;
    address_line?: string;
    postal_code?: string;
  },
): Promise<Market> {
  return requestJson<Market>(
    '/admin/markets',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    },
    token,
  );
}

export async function intakeUserNfce(
  token: string,
  formData: FormData,
): Promise<NfceReviewItem> {
  return requestJson<NfceReviewItem>(
    '/user/nfce/intake',
    {
      method: 'POST',
      body: formData,
    },
    token,
  );
}

export async function listUserNfceIntakes(token: string): Promise<NfceReviewItem[]> {
  return requestJson<NfceReviewItem[]>('/user/nfce/intakes', { method: 'GET' }, token);
}

export async function listAdminNfceReviewQueue(
  token: string,
  status?: string,
): Promise<NfceReviewItem[]> {
  const suffix = status ? `?status=${encodeURIComponent(status)}` : '';
  return requestJson<NfceReviewItem[]>(
    `/admin/nfce/review-queue${suffix}`,
    { method: 'GET' },
    token,
  );
}

export async function getAdminNfceManualPrefill(
  token: string,
  queueItemId: string,
): Promise<NfceManualPrefill> {
  return requestJson<NfceManualPrefill>(
    `/admin/nfce/review-queue/${queueItemId}/prefill`,
    { method: 'GET' },
    token,
  );
}

export async function selectAdminNfceReviewItem(
  token: string,
  queueItemId: string,
): Promise<NfceReviewItem> {
  return requestJson<NfceReviewItem>(
    `/admin/nfce/review-queue/${queueItemId}/select`,
    { method: 'POST' },
    token,
  );
}

export async function startAdminNfceAssistedConsultation(
  token: string,
  queueItemId: string,
): Promise<{ consultation_url: string; item: NfceReviewItem }> {
  return requestJson<{ consultation_url: string; item: NfceReviewItem }>(
    `/admin/nfce/review-queue/${queueItemId}/start-consultation`,
    { method: 'POST' },
    token,
  );
}
export async function startAdminNfcePlaywrightSession(
  token: string,
  queueItemId: string,
): Promise<Record<string, unknown>> {
  return requestJson<Record<string, unknown>>(
    `/admin/nfce/review-queue/${queueItemId}/playwright/start`,
    { method: 'POST' },
    token,
  );
}

export async function getAdminNfcePlaywrightState(
  token: string,
  queueItemId: string,
): Promise<Record<string, unknown>> {
  return requestJson<Record<string, unknown>>(
    `/admin/nfce/review-queue/${queueItemId}/playwright/state`,
    { method: 'GET' },
    token,
  );
}

export async function scrapeAdminNfceViaPlaywright(
  token: string,
  queueItemId: string,
): Promise<Record<string, unknown>> {
  return requestJson<Record<string, unknown>>(
    `/admin/nfce/review-queue/${queueItemId}/playwright/scrape`,
    { method: 'POST' },
    token,
  );
}

export async function closeAdminNfcePlaywrightSession(
  token: string,
  queueItemId: string,
): Promise<Record<string, unknown>> {
  return requestJson<Record<string, unknown>>(
    `/admin/nfce/review-queue/${queueItemId}/playwright/close`,
    { method: 'POST' },
    token,
  );
}

export async function scrapeAdminNfceAfterCaptcha(
  token: string,
  queueItemId: string,
  payload?: { page_html?: string },
): Promise<{ item: NfceReviewItem; prefill: Record<string, unknown> }> {
  return requestJson<{ item: NfceReviewItem; prefill: Record<string, unknown> }>(
    `/admin/nfce/review-queue/${queueItemId}/scrape-after-captcha`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload ?? {}),
    },
    token,
  );
}

export async function reprocessAdminNfceReviewItem(
  token: string,
  queueItemId: string,
  ocrHintText?: string,
): Promise<NfceReviewItem> {
  return requestJson<NfceReviewItem>(
    `/admin/nfce/review-queue/${queueItemId}/reprocess`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ ocr_hint_text: ocrHintText }),
    },
    token,
  );
}
