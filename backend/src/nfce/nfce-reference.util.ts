export type NfceReference = {
  type: 'qrcode' | 'url' | 'access_key';
  value: string;
  method: 'qr' | 'ocr' | 'heuristic' | 'manual';
  raw?: string;
};

export function parseNfceReference(input: string): NfceReference | null {
  const text = input.trim();
  if (!text) {
    return null;
  }

  const urlMatch = text.match(/https?:\/\/[^\s"'<>]+/i);
  if (urlMatch?.[0]) {
    return {
      type: 'url',
      value: urlMatch[0],
      method: 'heuristic',
      raw: text,
    };
  }

  const digits = text.replace(/\D/g, '');
  if (digits.length >= 44) {
    return {
      type: 'access_key',
      value: digits.slice(0, 44),
      method: 'heuristic',
      raw: text,
    };
  }

  return null;
}
