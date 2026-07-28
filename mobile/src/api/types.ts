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

export type AuthSession = {
  token: string;
  user: AuthUser;
};

export type UserShoppingListStatus = 'active' | 'archived' | 'completed';

export type UserShoppingList = {
  id: string;
  user_id: string;
  name: string;
  status: UserShoppingListStatus;
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
  scraping_status:
    | 'not_started'
    | 'pending_manual_captcha'
    | 'running'
    | 'completed'
    | 'failed';
  captcha_status: 'not_started' | 'manual_pending' | 'resolved' | 'expired';
  created_at: string;
  updated_at: string;
  original_filename: string | null;
  storage_path: string | null;
};
