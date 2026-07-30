import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

interface MetricCardProps {
  icon: LucideIcon;
  label: string;
  value: string;
  detail: string;
  tone?: "mint" | "sky" | "amber" | "violet";
  footer?: ReactNode;
}

export function MetricCard({
  icon: Icon,
  label,
  value,
  detail,
  tone = "mint",
  footer,
}: MetricCardProps) {
  return (
    <article className={`metric-card metric-card--${tone}`}>
      <div className="metric-card__top">
        <div className="metric-card__icon">
          <Icon size={18} strokeWidth={1.8} />
        </div>
        <span>{label}</span>
      </div>
      <div className="metric-card__value">{value}</div>
      <div className="metric-card__detail">{detail}</div>
      {footer}
    </article>
  );
}
