export const BUSINESS_TIME_ZONE = "Asia/Dhaka";

export function money(amount: number) {
  return `৳${new Intl.NumberFormat("en-BD", {
    minimumFractionDigits: Number.isInteger(amount) ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(amount)}`;
}

export function compactMoney(amount: number) {
  if (Math.abs(amount) >= 100000) return `৳${(amount / 100000).toFixed(1)}L`;
  if (Math.abs(amount) >= 1000) return `৳${(amount / 1000).toFixed(amount % 1000 === 0 ? 0 : 1)}k`;
  return money(amount);
}

export function dayKey(value: string | Date) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: BUSINESS_TIME_ZONE, year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(new Date(value));
  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

export function monthKey(value: string | Date) {
  return dayKey(value).slice(0, 7);
}

export function formatDate(value: string | Date, options?: Intl.DateTimeFormatOptions) {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: BUSINESS_TIME_ZONE,
    month: "short", day: "numeric", year: "numeric", ...options,
  }).format(new Date(value));
}

export function formatTime(value: string | Date) {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: BUSINESS_TIME_ZONE, hour: "numeric", minute: "2-digit", hour12: true,
  }).format(new Date(value));
}

export function dateFromKey(key: string) {
  return new Date(`${key}T12:00:00+06:00`);
}

export function recentDayKeys(count: number) {
  const today = dateFromKey(dayKey(new Date()));
  return Array.from({ length: count }, (_, index) => {
    const date = new Date(today);
    date.setUTCDate(date.getUTCDate() - (count - 1 - index));
    return dayKey(date);
  });
}

export function recentMonthKeys(count: number) {
  const current = dayKey(new Date());
  return Array.from({ length: count }, (_, index) => {
    const offset = count - 1 - index;
    const date = new Date(`${current.slice(0, 7)}-15T12:00:00+06:00`);
    date.setUTCMonth(date.getUTCMonth() - offset);
    return monthKey(date);
  });
}

export function initials(name: string) {
  return name.trim().split(/\s+/).slice(0, 2).map((part) => part[0]?.toUpperCase() ?? "").join("");
}
