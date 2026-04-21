import { useState } from "react";
import { X, Sun, Moon, Monitor, Palette, Globe, DollarSign, CheckCircle } from "lucide-react";
import { useTheme } from "../../contexts/ThemeContext";
import { type AccentColor, type ThemeMode } from "../../stores/themeStore";
import { cn } from "../../lib/utils";

interface PreferencesModalProps {
  open: boolean;
  onClose: () => void;
}

type Tab = "appearance" | "localization" | "display";

const ACCENT_COLORS: { value: AccentColor; label: string; hex: string; bgHex: string; description: string }[] = [
  { value: "olive",   label: "Olive Garden",  hex: "#606c38", bgHex: "#fefae0", description: "Earthy & warm" },
  { value: "ocean",   label: "Ocean Breeze",  hex: "#457b9d", bgHex: "#f1faee", description: "Crisp & cool" },
  { value: "coastal", label: "Coastal Vibes", hex: "#3d5a80", bgHex: "#e0fbfc", description: "Aqua & navy" },
  { value: "blue",    label: "Classic Blue",  hex: "#2563eb", bgHex: "#eff6ff", description: "Clean & professional" },
  { value: "violet",  label: "Violet",        hex: "#7c3aed", bgHex: "#f5f3ff", description: "Bold & modern" },
  { value: "emerald", label: "Emerald",       hex: "#059669", bgHex: "#ecfdf5", description: "Fresh & lively" },
  { value: "rose",    label: "Rose",          hex: "#e11d48", bgHex: "#fff1f2", description: "Vivid & energetic" },
  { value: "amber",   label: "Amber",         hex: "#d97706", bgHex: "#fffbeb", description: "Warm & golden" },
  { value: "teal",    label: "Teal",          hex: "#0d9488", bgHex: "#f0fdfa", description: "Calm & focused" },
  { value: "noir",    label: "Noir",          hex: "#001514", bgHex: "#fbfffe", description: "Sleek monochrome" },
];

const TIMEZONES = [
  "UTC", "America/New_York", "America/Chicago", "America/Denver", "America/Los_Angeles",
  "America/Anchorage", "America/Honolulu", "America/Sao_Paulo", "Europe/London",
  "Europe/Paris", "Europe/Berlin", "Europe/Moscow", "Asia/Dubai", "Asia/Kolkata",
  "Asia/Bangkok", "Asia/Singapore", "Asia/Shanghai", "Asia/Tokyo", "Asia/Seoul",
  "Australia/Sydney", "Pacific/Auckland",
];

const CURRENCIES = [
  { code: "USD", label: "US Dollar (USD)" }, { code: "EUR", label: "Euro (EUR)" },
  { code: "GBP", label: "British Pound (GBP)" }, { code: "JPY", label: "Japanese Yen (JPY)" },
  { code: "CNY", label: "Chinese Yuan (CNY)" }, { code: "INR", label: "Indian Rupee (INR)" },
  { code: "CAD", label: "Canadian Dollar (CAD)" }, { code: "AUD", label: "Australian Dollar (AUD)" },
  { code: "BRL", label: "Brazilian Real (BRL)" }, { code: "MXN", label: "Mexican Peso (MXN)" },
  { code: "KRW", label: "South Korean Won (KRW)" }, { code: "SGD", label: "Singapore Dollar (SGD)" },
  { code: "PHP", label: "Philippine Peso (PHP)" }, { code: "IDR", label: "Indonesian Rupiah (IDR)" },
  { code: "AED", label: "UAE Dirham (AED)" },
];

const DATE_FORMATS: { value: "MM/DD/YYYY" | "DD/MM/YYYY" | "YYYY-MM-DD"; label: string }[] = [
  { value: "MM/DD/YYYY", label: "MM/DD/YYYY (US)" },
  { value: "DD/MM/YYYY", label: "DD/MM/YYYY (EU)" },
  { value: "YYYY-MM-DD", label: "YYYY-MM-DD (ISO)" },
];

const LANGUAGES = [
  { code: "en", label: "English" }, { code: "es", label: "Español" },
  { code: "fr", label: "Français" }, { code: "de", label: "Deutsch" },
  { code: "ja", label: "日本語" }, { code: "zh", label: "中文" },
  { code: "pt", label: "Português" }, { code: "ar", label: "العربية" },
];

export function PreferencesModal({ open, onClose }: PreferencesModalProps) {
  const [tab, setTab] = useState<Tab>("appearance");
  const {
    mode, accent, timezone, currency, dateFormat, language, compactMode,
    setMode, setAccent, setTimezone, setCurrency, setDateFormat, setLanguage, setCompactMode,
  } = useTheme();

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className="relative bg-panel border border-stroke w-full max-w-lg overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-stroke">
          <h2 className="text-sm font-semibold text-ink">Preferences</h2>
          <button
            onClick={onClose}
            className="p-1 text-muted hover:text-ink hover:bg-hover transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-stroke">
          {(["appearance", "localization", "display"] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={cn(
                "px-4 py-2.5 text-xs font-medium capitalize border-b-2 -mb-px transition-colors",
                tab === t
                  ? "border-primary-600 text-primary-600"
                  : "border-transparent text-muted hover:text-ink"
              )}
            >
              {t}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="px-5 py-5 space-y-6 max-h-[70vh] overflow-y-auto">
          {tab === "appearance" && (
            <>
              {/* Color Mode */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <Monitor className="w-3.5 h-3.5 text-muted" />
                  <p className="text-xs font-semibold text-muted uppercase tracking-wider">Color Mode</p>
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
                        "flex flex-col items-center gap-2 py-3 border transition-colors text-xs font-medium",
                        mode === value
                          ? "border-primary-500 bg-primary-50 text-primary-700"
                          : "border-stroke text-muted hover:bg-hover hover:text-ink"
                      )}
                    >
                      <Icon className="w-4 h-4" />
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Color Palette */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <Palette className="w-3.5 h-3.5 text-muted" />
                  <p className="text-xs font-semibold text-muted uppercase tracking-wider">Color Palette</p>
                </div>
                <div className="grid grid-cols-1 gap-1.5">
                  {ACCENT_COLORS.map(({ value, label, hex, bgHex, description }) => (
                    <button
                      key={value}
                      onClick={() => setAccent(value)}
                      className={cn(
                        "flex items-center gap-3 px-3 py-2.5 border text-left transition-colors",
                        accent === value
                          ? "border-primary-500 bg-primary-50"
                          : "border-stroke hover:bg-hover"
                      )}
                    >
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <div className="w-4 h-4 border border-black/10" style={{ background: hex }} />
                        <div className="w-4 h-4 border border-black/10" style={{ background: bgHex }} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className={cn("text-xs font-medium", accent === value ? "text-primary-700" : "text-ink")}>
                          {label}
                        </p>
                        <p className="text-[10px] text-muted">{description}</p>
                      </div>
                      {accent === value && <CheckCircle className="w-3.5 h-3.5 text-primary-600 flex-shrink-0" />}
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}

          {tab === "localization" && (
            <>
              {/* Language */}
              <div>
                <label className="text-xs font-semibold text-muted uppercase tracking-wider block mb-2">Language</label>
                <select
                  value={language}
                  onChange={(e) => setLanguage(e.target.value)}
                  className="w-full border border-stroke px-3 py-2 text-sm bg-panel text-ink outline-none focus:border-primary-500 transition-colors"
                >
                  {LANGUAGES.map(({ code, label }) => (
                    <option key={code} value={code}>{label}</option>
                  ))}
                </select>
              </div>

              {/* Timezone */}
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <Globe className="w-3.5 h-3.5 text-muted" />
                  <label className="text-xs font-semibold text-muted uppercase tracking-wider">Timezone</label>
                </div>
                <select
                  value={timezone}
                  onChange={(e) => setTimezone(e.target.value)}
                  className="w-full border border-stroke px-3 py-2 text-sm bg-panel text-ink outline-none focus:border-primary-500 transition-colors"
                >
                  {TIMEZONES.map((tz) => (
                    <option key={tz} value={tz}>{tz.replace(/_/g, " ")}</option>
                  ))}
                </select>
              </div>

              {/* Currency */}
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <DollarSign className="w-3.5 h-3.5 text-muted" />
                  <label className="text-xs font-semibold text-muted uppercase tracking-wider">Currency</label>
                </div>
                <select
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value)}
                  className="w-full border border-stroke px-3 py-2 text-sm bg-panel text-ink outline-none focus:border-primary-500 transition-colors"
                >
                  {CURRENCIES.map(({ code, label }) => (
                    <option key={code} value={code}>{label}</option>
                  ))}
                </select>
              </div>

              {/* Date Format */}
              <div>
                <label className="text-xs font-semibold text-muted uppercase tracking-wider block mb-2">Date Format</label>
                <div className="flex flex-col gap-2">
                  {DATE_FORMATS.map(({ value, label }) => (
                    <label key={value} className="flex items-center gap-3 cursor-pointer">
                      <input
                        type="radio"
                        name="dateFormat"
                        value={value}
                        checked={dateFormat === value}
                        onChange={() => setDateFormat(value)}
                        className="accent-primary-600"
                      />
                      <span className="text-sm text-ink">{label}</span>
                    </label>
                  ))}
                </div>
              </div>
            </>
          )}

          {tab === "display" && (
            <>
              {/* Compact mode */}
              <div className="flex items-center justify-between py-2 border-b border-stroke">
                <div>
                  <p className="text-sm font-medium text-ink">Compact mode</p>
                  <p className="text-xs text-muted mt-0.5">Reduce element spacing for denser layouts</p>
                </div>
                <button
                  onClick={() => setCompactMode(!compactMode)}
                  className={cn(
                    "relative w-10 h-5 transition-colors",
                    compactMode ? "bg-primary-600" : "bg-stroke"
                  )}
                  role="switch"
                  aria-checked={compactMode}
                >
                  <span
                    className={cn(
                      "absolute top-0.5 w-4 h-4 bg-white transition-transform",
                      compactMode ? "translate-x-5" : "translate-x-0.5"
                    )}
                  />
                </button>
              </div>

              {/* Sidebar */}
              <div className="flex items-center justify-between py-2 border-b border-stroke">
                <div>
                  <p className="text-sm font-medium text-ink">Show sidebar labels</p>
                  <p className="text-xs text-muted mt-0.5">Display text labels in the navigation sidebar</p>
                </div>
                <button
                  className={cn(
                    "relative w-10 h-5 transition-colors bg-primary-600"
                  )}
                  role="switch"
                  aria-checked
                >
                  <span className="absolute top-0.5 w-4 h-4 bg-white translate-x-5" />
                </button>
              </div>

              {/* Table density */}
              <div>
                <p className="text-sm font-medium text-ink mb-3">Table density</p>
                <div className="grid grid-cols-3 gap-2">
                  {(["Comfortable", "Standard", "Compact"] as const).map((d) => (
                    <button
                      key={d}
                      className={cn(
                        "py-2 border text-xs font-medium transition-colors",
                        d === "Standard"
                          ? "border-primary-500 bg-primary-50 text-primary-700"
                          : "border-stroke text-muted hover:bg-hover hover:text-ink"
                      )}
                    >
                      {d}
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-stroke flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white text-sm font-medium transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
