export type ReceiptStatus =
  | 'pending'
  | 'in_review'
  | 'processed'
  | 'failed'
  | 'duplicate';

export type AuthUser = {
  id: string;
  full_name: string;
  email: string;
  role: 'admin' | 'user' | string;
};

export type AuthResponse = {
  access_token: string;
  user: AuthUser;
};

export type UserShoppingList = {
  id: string;
  user_id: string;
  name: string;
  status: 'active' | 'archived' | 'completed';
  created_at: string;
  updated_at: string;
};

export type UserShoppingListItem = {
  id: string;
  list_id: string;
  raw_text: string;
  quantity: string;
  unit: string | null;
  checked: boolean;
  created_at: string;
};

export type NfceReviewItem = {
  id: string;
  user_id: string;
  receipt_id: string;
  receipt_upload_id: string | null;
  status:
    | 'received'
    | 'extracting_reference'
    | 'reference_extracted'
    | 'pending_review'
    | 'in_review'
    | 'extraction_failed';
  extracted_type: 'qrcode' | 'url' | 'access_key' | null;
  extracted_value: string | null;
  extraction_method: 'qr' | 'ocr' | 'heuristic' | 'manual' | null;
  extraction_attempts: number;
  last_error: string | null;
  raw_extraction_json: Record<string, unknown>;
  selected_by: string | null;
  selected_at: string | null;
  consultation_url: string | null;
  consultation_opened_at: string | null;
  captcha_status: 'not_started' | 'manual_pending' | 'resolved' | 'expired';
  captcha_resolved_at: string | null;
  scraping_status:
    | 'not_started'
    | 'pending_manual_captcha'
    | 'running'
    | 'completed'
    | 'failed';
  scraping_attempts: number;
  last_scraped_at: string | null;
  scraped_data_json: Record<string, unknown>;
  mapped_manual_payload_json: Record<string, unknown>;
  processing_events_json: Array<Record<string, unknown>>;
  created_at: string;
  updated_at: string;
  original_filename: string | null;
  storage_path: string | null;
};

export type NfceManualPrefill = {
  queue_item_id: string;
  receipt_id: string;
  prefill: {
    source?: {
      access_key?: string;
      consultation_url?: string;
    };
    market?: {
      name: string;
      city: string;
      state_code?: string;
      neighborhood?: string;
      address_line?: string;
      cnpj?: string;
      postal_code?: string;
    } | null;
    purchase_date?: string;
    total_amount?: number;
    items?: Array<{
      raw_description: string;
      quantity: number;
      unit?: string;
      unit_price?: number;
      total_price?: number;
      alias_text?: string;
    }>;
  };
  scraping_status: NfceReviewItem['scraping_status'];
  captcha_status: NfceReviewItem['captcha_status'];
  last_error: string | null;
  last_scraped_at: string | null;
};

export type ReceiptUpload = {
  id: string;
  storage_path: string;
  original_filename: string | null;
  mime_type: string | null;
  file_size: string | null;
  file_hash: string | null;
  created_at: string;
};

export type ReceiptItem = {
  id: string;
  raw_description: string;
  quantity: string;
  unit: string | null;
  unit_price: string | null;
  total_price: string | null;
  confidence_score: string | null;
  classification_source: 'manual' | 'rag_confirmed' | null;
  canonical_product_id: string | null;
  canonical_name: string | null;
};

export type Receipt = {
  id: string;
  user_id: string;
  market_id: string | null;
  market_name: string | null;
  market_city: string | null;
  source_type: string;
  access_key: string | null;
  raw_payload: Record<string, unknown>;
  purchase_date: string | null;
  total_amount: string | null;
  status: ReceiptStatus;
  payload_hash: string | null;
  created_at: string;
  processed_at: string | null;
  processed_by: string | null;
  uploads: ReceiptUpload[];
  items: ReceiptItem[];
};

export type ReceiptListItem = {
  id: string;
  source_type: string;
  access_key: string | null;
  purchase_date: string | null;
  total_amount: string | null;
  status: ReceiptStatus;
  created_at: string;
  processed_at: string | null;
  market_id: string | null;
  market_name: string | null;
  market_city: string | null;
  upload_count: string;
};

export type Product = {
  id: string;
  slug: string;
  canonical_name: string;
  category: string | null;
  brand: string | null;
};

export type ProductClassificationCandidate = {
  canonical_product_id: string;
  canonical_name: string;
  similarity: number;
  confidence: number;
  reason: string;
  metadata: Record<string, unknown>;
};

export type ProductClassificationResponse = {
  normalized_description: string;
  candidates: ProductClassificationCandidate[];
  needs_human_review: true;
  models: {
    embedding: string;
    chat: string;
  };
};

export type Market = {
  id: string;
  name: string;
  city: string;
  chain_name: string | null;
  cnpj: string | null;
  state_code: string | null;
  neighborhood: string | null;
  address_line: string | null;
  postal_code: string | null;
};

export type ManualProcessPayload = {
  market_id?: string;
  market?: {
    name: string;
    city: string;
    chain_name?: string;
    cnpj?: string;
    state_code?: string;
    neighborhood?: string;
    address_line?: string;
    postal_code?: string;
  };
  purchase_date?: string;
  total_amount?: number;
  items: Array<{
    raw_description: string;
    quantity: number;
    unit?: string;
    unit_price?: number;
    total_price?: number;
    canonical_product_id?: string;
    canonical_product?: {
      canonical_name: string;
      slug?: string;
      category?: string;
      brand?: string;
      package_size?: number;
      package_unit?: string;
      attributes_json?: Record<string, unknown>;
    };
    alias_text?: string;
    classification_source?: 'manual' | 'rag_confirmed';
    classification_confidence?: number;
  }>;
};
