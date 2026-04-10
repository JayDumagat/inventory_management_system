import { useState } from "react";
import { X, Sun, Moon, Monitor, Palette, Globe, DollarSign } from "lucide-react";
import { useThemeStore, type AccentColor, type ThemeMode } from "../../stores/themeStore";
import { cn } from "../../lib/utils";

interface PreferencesModalProps {
  open: boolean;
  onClose: () => void;
}

type Tab = "appearance" | "localization";

const ACCENT_COLORS: { value: AccentColor; label: string; hex: string }[] = [
  { value: "blue",    label: "Blue",    hex: "#2563eb" },
  { value: "violet",  label: "Violet",  hex: "#7c3aed" },
  { value: "emerald", label: "Emerald", hex: "#059669" },
  { value: "rose",    label: "Rose",    hex: "#e11d48" },
  { value: "amber",   label: "Amber",   hex: "#d97706" },
  { value: "teal",    label: "Teal",    hex: "#0d9488" },
];

const TIMEZONES = [
  "UTC",
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "America/Anchorage",
  "America/Honolulu",
  "America/Sao_Paulo",
  "Europe/London",
  "Europe/Paris",
  "Europe/Berlin",
  "Europe/Moscow",
  "Asia/Dubai",
  "Asia/Kolkata",
  "Asia/Bangkok",
  "Asia/Singapore",
  "Asia/Shanghai",
  "Asia/Tokyo",
  "Asia/Seoul",
  "Australia/Sydney",
  "Pacific/Auckland",
];

const CURRENCIES = [
  { code: "USD", label: "US Dollar (USD)" },
  { code: "EUR", label: "Euro (EUR)" },
  { code: "GBP", label: "British Pound (GBP)" },
  { code: "JPY", label: "Japanese Yen (JPY)" },
  { code: "CNY", label: "Chinese Yuan (CNY)" },
  { code: "INR", label: "Indian Rupee (INR)" },
  { code: "CAD", label: "Canadian Dollar (CAD)" },
  { code: "AUD", label: "Australian Dollar (AUD)" },
  { code: "BRL", label: "Brazilian Real (BRL)" },
  { code: "MXN", label: "Mexican Peso (MXN)" },
  { code: "KRW", label: "South Korean Won (KRW)" },
  { code: "SGD", label: "Singapore Dollar (SGD)" },
  { code: "PHP", label: "Philippine Peso (PHP)" },
  { code: "IDR", label: "Indonesian Rupiah (IDR)" },
  { code: "THB", label: "Thai Baht (THB)" },
  { code: "AED", label: "UAE Dirham (AED)" },
];

const DATE_FORMATS: { value: "MM/DD/YYYY" | "DD/MM/YYYY" | "YYYY-MM-DD"; label: string }[] = [
  { value: "MM/DD/YYYY", label: "MM/DD/YYYY (US)" },
  { value: "DD/MM/YYYY", label: "DD/MM/YYYY (EU)" },
  { value: "YYYY-MM-DD", label: "YYYY-MM-DD (ISO)" },
];

export function PreferencesModal({ open, onClose }: PreferencesModalProps) {
  const [tab, setTab] = useState<Tab>("appearance");
  const { mode, accent, timezone, currency, dateFormat, setMode, setAccent, setTimezone, setCurrency, setDateFormat } = useThemeStore();

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 dark:bg-black/60" onClick={onClose} />
      <div className="relative bg-white dark:bg-gray-900 rounded-2xl w-full max-w-lg overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-gray-800">
          <h2 className="text-base font-semibold text-gray-900 dark:text-white">Preferences</h2>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 px-6 pt-4">
          {(["appearance", "localization"] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={cn(
                "px-3 py-1.5 rounded-lg text-sm font-medium capitalize transition-colors",
                tab === t
                  ? "bg-primary-50 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300"
                  : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800"
              )}
            >
              {t}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="px-6 py-5 space-y-6">
          {tab === "appearance" && (
            <>
              {/* Color Mode */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <Monitor className="w-4 h-4 text-gray-400" />
                  <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Color Mode</p>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {([
                    { value: "light" as ThemeMode, label: "Light",  Icon: Sun },
                    { value: "dark"  as ThemeMode, label: "Dark",   Icon: Moon },
                    { value: "system" as ThemeMode, label: "System", Icon: Monitor },
                  ]).map(({ value, label, Icon }) => (
                    <button
                      key={value}
                      onClick={() => setMode(value)}
                      className={cn(
                        "flex flex-col items-center gap-2 py-3 rounded-xl border transition-colors text-sm font-medium",
                        mode === value
                          ? "border-primary-500 bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300"
                          : "border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 hover:border-gray-300 dark:hover:border-gray-600"
                      )}
                    >
                      <Icon className="w-4 h-4" />
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Accent Color */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <Palette className="w-4 h-4 text-gray-400" />
                  <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Accent Color</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {ACCENT_COLORS.map(({ value, label, hex }) => (
                    <button
                      key={value}
                      onClick={() => setAccent(value)}
                      title={label}
                      className={cn(
                        "w-8 h-8 rounded-full transition-all",
                        accent === value ? "ring-2 ring-offset-2 ring-gray-400 dark:ring-offset-gray-900 scale-110" : "hover:scale-105"
                      )}
                      style={{ backgroundColor: hex }}
                    />
                  ))}
                </div>
                <p className="mt-2 text-xs text-gray-400 dark:text-gray-500">
                  Current: <span className="font-medium capitalize">{accent}</span>
                </p>
              </div>
            </>
          )}

          {tab === "localization" && (
            <>
              {/* Timezone */}
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <Globe className="w-4 h-4 text-gray-400" />
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Timezone</label>
                </div>
                <select
                  value={timezone}
                  onChange={(e) => setTimezone(e.target.value)}
                  className="w-full rounded-lg border border-gray-200 dark:border-gray-700 px-3 py-2 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white outline-none focus:border-primary-500 dark:focus:border-primary-400 transition-colors"
                >
                  {TIMEZONES.map((tz) => (
                    <option key={tz} value={tz}>{tz.replace(/_/g, " ")}</option>
                  ))}
                </select>
              </div>

              {/* Currency */}
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <DollarSign className="w-4 h-4 text-gray-400" />
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Currency</label>
                </div>
                <select
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value)}
                  className="w-full rounded-lg border border-gray-200 dark:border-gray-700 px-3 py-2 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white outline-none focus:border-primary-500 dark:focus:border-primary-400 transition-colors"
                >
                  {CURRENCIES.map(({ code, label }) => (
                    <option key={code} value={code}>{label}</option>
                  ))}
                </select>
              </div>

              {/* Date Format */}
              <div>
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300 block mb-2">Date Format</label>
                <div className="flex flex-col gap-2">
                  {DATE_FORMATS.map(({ value, label }) => (
                    <label key={value} className="flex items-center gap-3 cursor-pointer">
                      <input
                        type="radio"
                        name="dateFormat"
                        value={value}
                        checked={dateFormat === value}
                        onChange={() => setDateFormat(value)}
                        className="accent-blue-600"
                      />
                      <span className="text-sm text-gray-700 dark:text-gray-300">{label}</span>
                    </label>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-100 dark:border-gray-800 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg bg-primary-600 hover:bg-primary-700 text-white text-sm font-medium transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
