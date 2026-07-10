import { riskLevel } from '../format';

interface Props {
  probability: number;
  confirmations: number;
  isCoinbase: boolean;
}

export function RiskBadge({ probability, confirmations, isCoinbase }: Props) {
  const { label, className } = riskLevel(probability, confirmations, isCoinbase);
  return <span className={`risk-badge ${className}`}>{label}</span>;
}
