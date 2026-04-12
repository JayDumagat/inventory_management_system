import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { api } from "../../api/client";
import { useTenantStore } from "../../stores/tenantStore";
import { useTheme } from "../../contexts/ThemeContext";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/Card";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { Select } from "../../components/ui/Select";
import { Building2, Globe, Bell, Shield, Moon, Sun, Monitor, Palette, CheckCircle, Trash2, AlertCircle } from "lucide-react";
import { cn } from "../../lib/utils";
import type { AccentColor, ThemeMode } from "../../stores/themeStore";

const ACCENT_SWATCHES: { key: AccentColor; label: string; color: string; bg: string; description: string }[] = [
  { key: "olive",   label: "Olive Garden",   color: "#606c38", bg: "#fefae0", description: "Warm earthy tones" },
  { key: "ocean",   label: "Ocean Breeze",   color: "#457b9d", bg: "#f1faee", description: "Crisp cool blues" },
  { key: "coastal", label: "Coastal Vibes",  color: "#3d5a80", bg: "#e0fbfc", description: "Aqua & navy" },
  { key: "blue",    label: "Classic Blue",   color: "#3b82f6", bg: "#eff6ff", description: "Professional blue" },
  { key: "violet",  label: "Violet",         color: "#8b5cf6", bg: "#f5f3ff", description: "Modern purple" },
  { key: "emerald", label: "Emerald",        color: "#10b981", bg: "#ecfdf5", description: "Fresh green" },
  { key: "rose",    label: "Rose",           color: "#f43f5e", bg: "#fff1f2", description: "Bold rose" },
  { key: "amber",   label: "Amber",          color: "#f59e0b", bg: "#fffbeb", description: "Golden amber" },
  { key: "teal",    label: "Teal",           color: "#14b8a6", bg: "#f0fdfa", description: "Calm teal" },
];

const TIMEZONES = [
  "UTC", "America/New_York", "America/Chicago", "America/Denver", "America/Los_Angeles",
  "America/Sao_Paulo", "Europe/London", "Europe/Paris", "Europe/Berlin", "Europe/Moscow",
  "Asia/Dubai", "Asia/Kolkata", "Asia/Bangkok", "Asia/Singapore", "Asia/Shanghai",
  "Asia/Tokyo", "Asia/Seoul", "Australia/Sydney", "Pacific/Auckland",
];

const CURRENCIES = [
  { code: "USD", label: "US Dollar ($)" }, { code: "EUR", label: "Euro (€)" },
  { code: "GBP", label: "British Pound (£)" }, { code: "JPY", label: "Japanese Yen (¥)" },
  { code: "CAD", label: "Canadian Dollar (CA$)" }, { code: "AUD", label: "Australian Dollar (A$)" },
  { code: "CNY", label: "Chinese Yuan (¥)" }, { code: "INR", label: "Indian Rupee (₹)" },
  { code: "PHP", label: "Philippine Peso (₱)" }, { code: "SGD", label: "Singapore Dollar (S$)" },
];

const LANGUAGES = [
  { code: "en", label: "English" }, { code: "es", label: "Español" },
  { code: "fr", label: "Français" }, { code: "de", label: "Deutsch" },
  { code: "ja", label: "日本語" }, { code: "zh", label: "中文" },
  { code: "pt", label: "Português" }, { code: "ar", label: "العربية" },
];

export default function SettingsPage() {
  const { currentTenant, setCurrentTenant } = useTenantStore();
  const qc = useQueryClient();
  const theme = useTheme();
  const [orgSuccess, setOrgSuccess] = useState(false);
  const [orgError, setOrgError] = useState("");
  const [orgName, setOrgName] = useState(currentTenant?.name || "");
  const [orgDesc, setOrgDesc] = useState(currentTenant?.description || "");
  const [orgLogo, setOrgLogo] = useState((currentTenant as { logoUrl?: string })?.logoUrl || "");
  const [savingOrg, setSavingOrg] = useState(false);
  const [dangerConfirm, setDangerConfirm] = useState("");

  const handleSaveOrg = async () => {
    if (!currentTenant) return;
    setSavingOrg(true);
    setOrgError("");
    try {
      const { data: updated } = await api.patch(`/api/tenants/${currentTenant.id}`, {
        name: orgName,
        description: orgDesc,
        logoUrl: orgLogo || undefined,
      });
      setCurrentTenant({ ...currentTenant, name: updated.name, ...(updated.logoUrl && { logoUrl: updated.logoUrl }) });
      qc.invalidateQueries({ queryKey: ["tenants"] });
      setOrgSuccess(true);
      setTimeout(() => setOrgSuccess(false), 3000);
    } catch (e: unknown) {
      setOrgError((e as { response?: { data?: { error?: string } } })?.response?.data?.error || "Save failed");
    } finally {
      setSavingOrg(false);
    }
  };

  const MODE_OPTIONS: { value: ThemeMode; label: string; icon: typeof Sun }[] = [
    { value: "light", label: "Light", icon: Sun },
    { value: "dark",  label: "Dark",  icon: Moon },
    { value: "system",label: "System", icon: Monitor },
  ];

  return (
    <div className="space-y-5 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold text-ink">Settings</h1>
        <p className="text-muted text-sm mt-1">Configure your organization and application preferences</p>
      </div>

      {/* Organization settings */}
      <Card>
        <CardHeader>
          <CardTitle>
            <div className="flex items-center gap-2">
              <Building2 className="w-4 h-4 text-muted" />
              Organization
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {orgError && (
            <div className="p-3 bg-red-50 border border-red-200 text-sm text-red-700">{orgError}</div>
          )}
          {orgSuccess && (
            <div className="p-3 bg-green-50 border border-green-200 text-sm text-green-700 flex items-center gap-2">
              <CheckCircle className="w-4 h-4 flex-shrink-0" />
              Organization saved
            </div>
          )}
          <Input label="Organization name" value={orgName} onChange={(e) => setOrgName(e.target.value)} />
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-muted">URL slug</label>
            <div className="px-3 py-2 border border-stroke bg-page text-muted text-sm font-mono">
              {currentTenant?.slug}
            </div>
            <p className="text-xs text-muted">Slugs cannot be changed after creation</p>
          </div>
          <Input
            label="Description (optional)"
            value={orgDesc}
            onChange={(e) => setOrgDesc(e.target.value)}
          />
          <div className="flex flex-col gap-2">
            <Input
              label="Logo URL (optional)"
              placeholder="https://example.com/logo.png"
              value={orgLogo}
              onChange={(e) => setOrgLogo(e.target.value)}
            />
            {orgLogo && /^https?:\/\//i.test(orgLogo) && (
              <div className="flex items-center gap-3 p-3 border border-stroke bg-page">
                <img
                  src={orgLogo}
                  alt="Logo preview"
                  className="w-10 h-10 object-contain flex-shrink-0"
                  onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                />
                <span className="text-xs text-muted">Logo preview</span>
              </div>
            )}
          </div>
          <div className="flex justify-end">
            <Button onClick={handleSaveOrg} loading={savingOrg}>Save organization</Button>
          </div>
        </CardContent>
      </Card>

      {/* Appearance */}
      <Card>
        <CardHeader>
          <CardTitle>
            <div className="flex items-center gap-2">
              <Palette className="w-4 h-4 text-muted" />
              Appearance
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-5">
          {/* Color mode */}
          <div>
            <p className="text-sm font-medium text-ink mb-3">Color mode</p>
            <div className="grid grid-cols-3 gap-2">
              {MODE_OPTIONS.map(({ value, label, icon: Icon }) => (
                <button
                  key={value}
                  onClick={() => theme.setMode(value)}
                  className={cn(
                    "flex flex-col items-center gap-2 p-3 border text-sm font-medium transition-colors",
                    theme.mode === value
                      ? "border-primary-600 bg-primary-50 text-primary-700"
                      : "border-stroke bg-panel text-muted hover:bg-hover hover:text-ink"
                  )}
                >
                  <Icon className="w-5 h-5" />
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Color palette */}
          <div>
            <p className="text-sm font-medium text-ink mb-3">Color palette</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {ACCENT_SWATCHES.map((s) => (
                <button
                  key={s.key}
                  onClick={() => theme.setAccent(s.key)}
                  className={cn(
                    "flex items-center gap-3 p-3 border text-left transition-colors",
                    theme.accent === s.key
                      ? "border-primary-600 bg-primary-50"
                      : "border-stroke bg-panel hover:bg-hover"
                  )}
                >
                  <div className="flex flex-shrink-0 items-center gap-1">
                    <div className="w-5 h-5 border border-black/10" style={{ background: s.color }} />
                    <div className="w-5 h-5 border border-black/10" style={{ background: s.bg }} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className={cn("text-sm font-medium truncate", theme.accent === s.key ? "text-primary-700" : "text-ink")}>
                      {s.label}
                    </p>
                    <p className="text-xs text-muted truncate">{s.description}</p>
                  </div>
                  {theme.accent === s.key && <CheckCircle className="w-4 h-4 text-primary-600 flex-shrink-0" />}
                </button>
              ))}
            </div>
          </div>

          {/* Compact mode */}
          <div className="flex items-center justify-between py-2 border-t border-stroke">
            <div>
              <p className="text-sm font-medium text-ink">Compact mode</p>
              <p className="text-xs text-muted mt-0.5">Reduce spacing for denser layouts</p>
            </div>
            <button
              onClick={() => theme.setCompactMode(!theme.compactMode)}
              className={cn(
                "relative w-10 h-5 transition-colors",
                theme.compactMode ? "bg-primary-600" : "bg-stroke"
              )}
              role="switch"
              aria-checked={theme.compactMode}
            >
              <span
                className={cn(
                  "absolute top-0.5 w-4 h-4 bg-white transition-transform",
                  theme.compactMode ? "translate-x-5" : "translate-x-0.5"
                )}
              />
            </button>
          </div>
        </CardContent>
      </Card>

      {/* Locale & Regional */}
      <Card>
        <CardHeader>
          <CardTitle>
            <div className="flex items-center gap-2">
              <Globe className="w-4 h-4 text-muted" />
              Regional settings
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <Select
            label="Language"
            value={theme.language}
            onChange={(e) => theme.setLanguage(e.target.value)}
          >
            {LANGUAGES.map((l) => <option key={l.code} value={l.code}>{l.label}</option>)}
          </Select>
          <Select
            label="Timezone"
            value={theme.timezone}
            onChange={(e) => theme.setTimezone(e.target.value)}
          >
            {TIMEZONES.map((tz) => <option key={tz} value={tz}>{tz}</option>)}
          </Select>
          <Select
            label="Currency"
            value={theme.currency}
            onChange={(e) => theme.setCurrency(e.target.value)}
          >
            {CURRENCIES.map((c) => <option key={c.code} value={c.code}>{c.label}</option>)}
          </Select>
          <Select
            label="Date format"
            value={theme.dateFormat}
            onChange={(e) => theme.setDateFormat(e.target.value as "MM/DD/YYYY" | "DD/MM/YYYY" | "YYYY-MM-DD")}
          >
            <option value="MM/DD/YYYY">MM/DD/YYYY</option>
            <option value="DD/MM/YYYY">DD/MM/YYYY</option>
            <option value="YYYY-MM-DD">YYYY-MM-DD (ISO)</option>
          </Select>
        </CardContent>
      </Card>

      {/* Notifications */}
      <Card>
        <CardHeader>
          <CardTitle>
            <div className="flex items-center gap-2">
              <Bell className="w-4 h-4 text-muted" />
              Notifications
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[
              { label: "Low stock alerts", desc: "Get notified when items fall below reorder point", defaultVal: true },
              { label: "New order notifications", desc: "Receive notifications for incoming orders", defaultVal: true },
              { label: "Weekly summary", desc: "Weekly digest of sales and inventory changes", defaultVal: false },
              { label: "System updates", desc: "Important updates about the platform", defaultVal: true },
            ].map((item) => (
              <div key={item.label} className="flex items-center justify-between py-2 border-b border-stroke last:border-0">
                <div>
                  <p className="text-sm font-medium text-ink">{item.label}</p>
                  <p className="text-xs text-muted mt-0.5">{item.desc}</p>
                </div>
                <input
                  type="checkbox"
                  defaultChecked={item.defaultVal}
                  className="w-4 h-4 border-stroke text-primary-600 focus:ring-primary-500"
                />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Security */}
      <Card>
        <CardHeader>
          <CardTitle>
            <div className="flex items-center gap-2">
              <Shield className="w-4 h-4 text-muted" />
              Security
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="flex items-center justify-between py-2 border-b border-stroke">
              <div>
                <p className="text-sm font-medium text-ink">Two-factor authentication</p>
                <p className="text-xs text-muted mt-0.5">Add an extra layer of security to your account</p>
              </div>
              <span className="text-xs bg-stroke text-muted px-2 py-0.5">Coming soon</span>
            </div>
            <div className="flex items-center justify-between py-2 border-b border-stroke">
              <div>
                <p className="text-sm font-medium text-ink">Active sessions</p>
                <p className="text-xs text-muted mt-0.5">Manage where you're signed in</p>
              </div>
              <span className="text-xs bg-stroke text-muted px-2 py-0.5">Coming soon</span>
            </div>
            <div className="flex items-center justify-between py-2">
              <div>
                <p className="text-sm font-medium text-ink">Audit log access</p>
                <p className="text-xs text-muted mt-0.5">Full activity history in the Audit Log page</p>
              </div>
              <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 font-medium">Enabled</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Danger zone */}
      <Card className="border-red-200">
        <CardHeader>
          <CardTitle>
            <div className="flex items-center gap-2 text-red-600">
              <AlertCircle className="w-4 h-4" />
              Danger zone
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex items-center justify-between py-3 border border-red-200 bg-red-50 px-4">
            <div>
              <p className="text-sm font-medium text-ink">Delete organization</p>
              <p className="text-xs text-muted mt-0.5">
                Permanently remove this organization and all its data
              </p>
            </div>
            <Button
              variant="danger"
              size="sm"
              onClick={() => setDangerConfirm("delete-org")}
            >
              <Trash2 className="w-3.5 h-3.5 mr-1.5" />
              Delete
            </Button>
          </div>
          {dangerConfirm === "delete-org" && (
            <div className="p-4 bg-red-50 border border-red-200">
              <p className="text-sm font-medium text-red-700 mb-1">This action is irreversible!</p>
              <p className="text-xs text-red-600 mb-3">
                All products, inventory, orders and data will be permanently deleted. Type the organization slug to confirm.
              </p>
              <div className="flex gap-2">
                <Input placeholder={currentTenant?.slug} className="flex-1 text-sm" />
                <Button variant="outline" size="sm" onClick={() => setDangerConfirm("")}>Cancel</Button>
                <Button variant="danger" size="sm" disabled>Confirm delete</Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
