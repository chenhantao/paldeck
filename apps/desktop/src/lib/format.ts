import type { AppLocale } from "../i18n/I18nContext";

export function formatUptime(totalSeconds: number, locale: AppLocale): string {
  if (totalSeconds <= 0) return "—";
  const days = Math.floor(totalSeconds / 86_400);
  const hours = Math.floor((totalSeconds % 86_400) / 3_600);
  const minutes = Math.floor((totalSeconds % 3_600) / 60);

  if (locale === "en") {
    if (days > 0) return `${days}d ${hours}h`;
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m`;
  }
  if (days > 0) return `${days} 天 ${hours} 小时`;
  if (hours > 0) return `${hours} 小时 ${minutes} 分`;
  return `${minutes} 分钟`;
}

export function formatDateTime(value: string | null, locale: AppLocale): string {
  if (!value) return locale === "en" ? "No backups yet" : "尚无备份";
  return new Intl.DateTimeFormat(locale, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(value));
}

export function formatTime(value: string, locale: AppLocale): string {
  return new Intl.DateTimeFormat(locale, {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(new Date(value));
}

export function formatBytes(value: number | null, locale: AppLocale): string {
  if (value === null) return "—";
  return new Intl.NumberFormat(locale, {
    style: "unit",
    unit: value >= 1024 ** 3 ? "gigabyte" : "megabyte",
    maximumFractionDigits: 1,
  }).format(value / (value >= 1024 ** 3 ? 1024 ** 3 : 1024 ** 2));
}
