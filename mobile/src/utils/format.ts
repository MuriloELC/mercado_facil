export function formatDateTime(value: string | null): string {
  if (!value) {
    return '-';
  }

  return new Date(value).toLocaleString();
}

export function formatQuantity(value: string): string {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return value;
  }

  return Number.isInteger(parsed) ? String(parsed) : String(parsed).replace(/0+$/, '').replace(/\.$/, '');
}
