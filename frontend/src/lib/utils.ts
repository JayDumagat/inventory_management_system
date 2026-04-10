import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { useThemeStore } from "../stores/themeStore";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(amount: number | string, currencyOverride?: string) {
  const currency = currencyOverride ?? useThemeStore.getState().currency;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
  }).format(Number(amount));
}

export function formatDate(date: string | Date, timezoneOverride?: string) {
  const { timezone, dateFormat } = useThemeStore.getState();
  const tz = timezoneOverride ?? timezone;

  const parts: Intl.DateTimeFormatOptions = {
    year: "numeric",
    month: "short",
    day: "numeric",
    timeZone: tz,
  };

  if (dateFormat === "YYYY-MM-DD") {
    return new Intl.DateTimeFormat("sv-SE", { ...parts, month: "2-digit", day: "2-digit" }).format(new Date(date));
  }
  if (dateFormat === "DD/MM/YYYY") {
    return new Intl.DateTimeFormat("en-GB", parts).format(new Date(date));
  }
  return new Intl.DateTimeFormat("en-US", parts).format(new Date(date));
}

export function formatDateTime(date: string | Date, timezoneOverride?: string) {
  const { timezone } = useThemeStore.getState();
  const tz = timezoneOverride ?? timezone;
  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: tz,
  }).format(new Date(date));
}
