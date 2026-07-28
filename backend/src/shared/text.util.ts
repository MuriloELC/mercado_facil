export function normalizeText(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function slugify(value: string): string {
  return normalizeText(value)
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

export function parseAccessKeyFromQr(qrText?: string): string | null {
  if (!qrText) {
    return null;
  }

  const digits = qrText.replace(/\D/g, '');
  if (digits.length >= 44) {
    return digits.slice(0, 44);
  }

  return null;
}
