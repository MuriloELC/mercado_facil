import { ReceiptStatus } from '../api/types';

type StatusBadgeProps = {
  status: ReceiptStatus;
};

export function StatusBadge({ status }: StatusBadgeProps) {
  return <span className={`badge ${status}`}>{status}</span>;
}
