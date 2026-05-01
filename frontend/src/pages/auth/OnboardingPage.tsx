import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useTenantStore } from "../../stores/tenantStore";
import { useAuthStore } from "../../stores/authStore";
import { useTheme } from "../../contexts/ThemeContext";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { AuthLayout, AuthBranding } from "../../components/ui/AuthLayout";
import { api } from "../../api/client";
import { cn } from "../../lib/utils";
import {
  Building2, CheckCircle, Sparkles, User, ChevronRight, ChevronLeft,
  ShoppingBag, UtensilsCrossed, HeartPulse, Factory, Warehouse,
  GraduationCap, Cpu, LayoutGrid, MapPin, GitBranch,
  CalendarClock, Layers, Hash, Upload, Plus, Compass,
} from "lucide-react";

// ─── Constants ────────────────────────────────────────────────────────────────

const INDUSTRIES = [
  { id: "retail",        label: "Retail",          icon: ShoppingBag },
  { id: "food",          label: "Food & Beverage",  icon: UtensilsCrossed },
  { id: "healthcare",    label: "Healthcare",       icon: HeartPulse },
  { id: "manufacturing", label: "Manufacturing",    icon: Factory },
  { id: "wholesale",     label: "Wholesale",        icon: Warehouse },
  { id: "education",     label: "Education",        icon: GraduationCap },
  { id: "technology",    label: "Technology",       icon: Cpu },
  { id: "other",         label: "Other",            icon: LayoutGrid },
] as const;

const PHONE_COUNTRIES = [
  { code: "US", dialCode: "+1",   name: "United States" },
  { code: "CA", dialCode: "+1",   name: "Canada" },
  { code: "GB", dialCode: "+44",  name: "United Kingdom" },
  { code: "AU", dialCode: "+61",  name: "Australia" },
  { code: "NZ", dialCode: "+64",  name: "New Zealand" },
  { code: "IE", dialCode: "+353", name: "Ireland" },
  { code: "DE", dialCode: "+49",  name: "Germany" },
  { code: "FR", dialCode: "+33",  name: "France" },
  { code: "ES", dialCode: "+34",  name: "Spain" },
  { code: "IT", dialCode: "+39",  name: "Italy" },
  { code: "NL", dialCode: "+31",  name: "Netherlands" },
  { code: "BE", dialCode: "+32",  name: "Belgium" },
  { code: "PT", dialCode: "+351", name: "Portugal" },
  { code: "CH", dialCode: "+41",  name: "Switzerland" },
  { code: "AT", dialCode: "+43",  name: "Austria" },
  { code: "SE", dialCode: "+46",  name: "Sweden" },
  { code: "NO", dialCode: "+47",  name: "Norway" },
  { code: "DK", dialCode: "+45",  name: "Denmark" },
  { code: "FI", dialCode: "+358", name: "Finland" },
  { code: "PL", dialCode: "+48",  name: "Poland" },
  { code: "RU", dialCode: "+7",   name: "Russia" },
  { code: "UA", dialCode: "+380", name: "Ukraine" },
  { code: "TR", dialCode: "+90",  name: "Turkey" },
  { code: "IL", dialCode: "+972", name: "Israel" },
  { code: "AE", dialCode: "+971", name: "UAE" },
  { code: "SA", dialCode: "+966", name: "Saudi Arabia" },
  { code: "IN", dialCode: "+91",  name: "India" },
  { code: "PK", dialCode: "+92",  name: "Pakistan" },
  { code: "BD", dialCode: "+880", name: "Bangladesh" },
  { code: "LK", dialCode: "+94",  name: "Sri Lanka" },
  { code: "NP", dialCode: "+977", name: "Nepal" },
  { code: "PH", dialCode: "+63",  name: "Philippines" },
  { code: "SG", dialCode: "+65",  name: "Singapore" },
  { code: "MY", dialCode: "+60",  name: "Malaysia" },
  { code: "ID", dialCode: "+62",  name: "Indonesia" },
  { code: "TH", dialCode: "+66",  name: "Thailand" },
  { code: "VN", dialCode: "+84",  name: "Vietnam" },
  { code: "JP", dialCode: "+81",  name: "Japan" },
  { code: "KR", dialCode: "+82",  name: "South Korea" },
  { code: "CN", dialCode: "+86",  name: "China" },
  { code: "HK", dialCode: "+852", name: "Hong Kong" },
  { code: "TW", dialCode: "+886", name: "Taiwan" },
  { code: "MX", dialCode: "+52",  name: "Mexico" },
  { code: "BR", dialCode: "+55",  name: "Brazil" },
  { code: "AR", dialCode: "+54",  name: "Argentina" },
  { code: "CL", dialCode: "+56",  name: "Chile" },
  { code: "CO", dialCode: "+57",  name: "Colombia" },
  { code: "ZA", dialCode: "+27",  name: "South Africa" },
  { code: "NG", dialCode: "+234", name: "Nigeria" },
  { code: "EG", dialCode: "+20",  name: "Egypt" },
];

const CURRENCIES = [
  { code: "USD", label: "US Dollar (USD)" },
  { code: "EUR", label: "Euro (EUR)" },
  { code: "GBP", label: "British Pound (GBP)" },
  { code: "JPY", label: "Japanese Yen (JPY)" },
  { code: "CAD", label: "Canadian Dollar (CAD)" },
  { code: "AUD", label: "Australian Dollar (AUD)" },
  { code: "CNY", label: "Chinese Yuan (CNY)" },
  { code: "INR", label: "Indian Rupee (INR)" },
  { code: "PHP", label: "Philippine Peso (PHP)" },
  { code: "SGD", label: "Singapore Dollar (SGD)" },
  { code: "CHF", label: "Swiss Franc (CHF)" },
  { code: "BRL", label: "Brazilian Real (BRL)" },
  { code: "MXN", label: "Mexican Peso (MXN)" },
  { code: "KRW", label: "South Korean Won (KRW)" },
  { code: "IDR", label: "Indonesian Rupiah (IDR)" },
  { code: "MYR", label: "Malaysian Ringgit (MYR)" },
  { code: "THB", label: "Thai Baht (THB)" },
  { code: "HKD", label: "Hong Kong Dollar (HKD)" },
  { code: "AED", label: "UAE Dirham (AED)" },
  { code: "SAR", label: "Saudi Riyal (SAR)" },
  { code: "ZAR", label: "South African Rand (ZAR)" },
];

const START_OPTIONS = [
  { id: "import",  label: "Import my inventory",  desc: "Upload a CSV or spreadsheet",        icon: Upload  },
  { id: "manual",  label: "Add items manually",    desc: "Start adding products one by one",   icon: Plus    },
  { id: "explore", label: "Just explore first",    desc: "Browse the dashboard and features",  icon: Compass },
] as const;

type StartMethod = "import" | "manual" | "explore";

// ─── Stepper ──────────────────────────────────────────────────────────────────

const STEP_LABELS = ["Organization", "Contact", "Preferences", "Get Started"];

function Stepper({ current }: { current: number }) {
  // current is 1-indexed (1–4)
  return (
    <div className="flex items-center justify-center gap-1.5 mb-8">
      {STEP_LABELS.map((label, i) => {
        const num = i + 1;
        const done = num < current;
        const active = num === current;
        return (
          <div key={label} className="flex items-center gap-1.5">
            <div
              className={cn(
                "flex items-center justify-center w-6 h-6 text-xs font-bold border transition-colors",
                done   ? "bg-primary-600 border-primary-600 text-white" :
                active ? "border-primary-600 text-primary-600" :
                         "border-stroke text-muted"
              )}
            >
              {done ? <CheckCircle className="w-3.5 h-3.5" /> : num}
            </div>
            <span className={cn(
              "text-xs hidden sm:block",
              active ? "text-ink font-medium" : "text-muted"
            )}>
              {label}
            </span>
            {i < STEP_LABELS.length - 1 && (
              <ChevronRight className="w-3 h-3 text-muted ml-0.5" />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── PhoneInput ───────────────────────────────────────────────────────────────

interface PhoneInputProps {
  dialCode: string;
  onDialCodeChange: (v: string) => void;
  phone: string;
  onPhoneChange: (v: string) => void;
  error?: string;
}

function PhoneInput({ dialCode, onDialCodeChange, phone, onPhoneChange, error }: PhoneInputProps) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs font-medium text-muted">Phone number</label>
      <div className={cn(
        "flex border transition-colors focus-within:ring-1",
        error
          ? "border-red-400 focus-within:border-red-500 focus-within:ring-red-500/30"
          : "border-stroke focus-within:border-primary-500 focus-within:ring-primary-500/20"
      )}>
        <select
          value={dialCode}
          onChange={(e) => onDialCodeChange(e.target.value)}
          className="bg-panel text-ink text-sm px-2 py-2 border-r border-stroke outline-none shrink-0 w-28"
        >
          {PHONE_COUNTRIES.map((c) => (
            <option key={c.code} value={c.dialCode}>
              {c.dialCode} {c.code}
            </option>
          ))}
        </select>
        <input
          type="tel"
          value={phone}
          onChange={(e) => onPhoneChange(e.target.value)}
          placeholder="555 123 4567"
          className="flex-1 min-w-0 bg-panel text-ink text-sm px-3 py-2 outline-none placeholder:text-muted"
        />
      </div>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}

// ─── Left panel per step ──────────────────────────────────────────────────────

const STEP_LEFT: Record<number, { title: string; subtitle: string }> = {
  0: {
    title: "Welcome to Inventra",
    subtitle: "A few quick steps to get your workspace ready.",
  },
  1: {
    title: "Set up your organization",
    subtitle: "Tell us who you are and what industry you're in so we can tailor your experience.",
  },
  2: {
    title: "Who's leading the way?",
    subtitle: "Add representative details so your team knows who to reach.",
  },
  3: {
    title: "Customize your workflow",
    subtitle: "Configure locations, tracking preferences, and currency to match how you operate.",
  },
  4: {
    title: "You're almost ready!",
    subtitle: "Choose how you'd like to start using Inventra and we'll get you there.",
  },
};

// ─── Main Component ───────────────────────────────────────────────────────────

export default function OnboardingPage() {
  const navigate = useNavigate();
  const setCurrentTenant = useTenantStore((s) => s.setCurrentTenant);
  const user = useAuthStore((s) => s.user);
  const theme = useTheme();

  // ── Navigation state ──
  const [step, setStep] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  // ── Step 1: Organization ──
  const [orgName, setOrgName] = useState("");
  const [industry, setIndustry] = useState("");
  const [orgNameError, setOrgNameError] = useState("");
  const [industryError, setIndustryError] = useState("");

  // ── Step 2: Contact ──
  const [repName, setRepName] = useState(
    [user?.firstName, user?.lastName].filter(Boolean).join(" ")
  );
  const [repEmail, setRepEmail] = useState(user?.email ?? "");
  const [repPhone, setRepPhone] = useState("");
  const [dialCode, setDialCode] = useState("+1");
  const [repNameError, setRepNameError] = useState("");

  // ── Step 3: Personalization ──
  const [locationMode, setLocationMode] = useState<"single" | "multiple">("single");
  const [trackExpiry, setTrackExpiry] = useState(false);
  const [trackBatch, setTrackBatch] = useState(false);
  const [trackSerial, setTrackSerial] = useState(false);
  const [selectedCurrency, setSelectedCurrency] = useState("USD");

  // ── Step 4: Starting method ──
  const [startMethod, setStartMethod] = useState<StartMethod | null>(null);
  const [startMethodError, setStartMethodError] = useState("");

  // ── Summary: redirect after submit ──
  const [summaryVisible, setSummaryVisible] = useState(false);

  useEffect(() => {
    if (!summaryVisible) return;
    const t = setTimeout(() => {
      if (startMethod === "manual") navigate("/products");
      else if (startMethod === "import") navigate("/inventory");
      else navigate("/dashboard");
    }, 2800);
    return () => clearTimeout(t);
  }, [summaryVisible, startMethod, navigate]);

  // ── Step 1 validation & advance ──
  const handleStep1Next = () => {
    let valid = true;
    if (!orgName.trim()) { setOrgNameError("Organization name is required"); valid = false; }
    else setOrgNameError("");
    if (!industry) { setIndustryError("Please select an industry"); valid = false; }
    else setIndustryError("");
    if (valid) setStep(2);
  };

  // ── Step 2 validation & advance ──
  const handleStep2Next = () => {
    if (!repName.trim()) { setRepNameError("Representative name is required"); return; }
    setRepNameError("");
    setStep(3);
  };

  // ── Step 4 submit: create tenant + apply prefs ──
  const handleFinish = async () => {
    if (!startMethod) { setStartMethodError("Please choose how you'd like to begin"); return; }
    setStartMethodError("");
    setSubmitting(true);
    setError("");
    try {
      const slug = orgName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
      const { data: tenant } = await api.post("/api/tenants", {
        name: orgName,
        slug,
        description: industry || undefined,
      });
      setCurrentTenant({ ...tenant, role: "owner" });
      theme.setCurrency(selectedCurrency);
      setSummaryVisible(true);
    } catch (e: unknown) {
      setError(
        (e as { response?: { data?: { error?: string } } })?.response?.data?.error ||
        "Failed to create organization. Please try again."
      );
    } finally {
      setSubmitting(false);
    }
  };

  // ── Left panel ──
  const leftData = STEP_LEFT[step] ?? STEP_LEFT[0];
  const leftContent = (
    <AuthBranding title={leftData.title} subtitle={leftData.subtitle} />
  );

  // ── Summary screen ──────────────────────────────────────────────────────────
  if (summaryVisible) {
    const trackingEnabled = [
      trackExpiry && "Expiry date tracking",
      trackBatch  && "Batch / lot tracking",
      trackSerial && "Serial number tracking",
    ].filter(Boolean);
    const startLabel = START_OPTIONS.find((o) => o.id === startMethod)?.label ?? "";

    return (
      <AuthLayout formWidth="md" leftContent={leftContent}>
        <div className="flex flex-col items-center text-center">
          <div className="w-14 h-14 bg-green-50 border border-green-200 flex items-center justify-center mb-4">
            <CheckCircle className="w-7 h-7 text-green-600" />
          </div>
          <h1 className="text-2xl font-bold text-ink mb-1">You&apos;re all set!</h1>
          <p className="text-muted text-sm mb-7">Here&apos;s a summary of your setup.</p>

          <div className="w-full space-y-3 text-left mb-7">
            <SummaryRow label="Organization" value={orgName} />
            <SummaryRow label="Industry"     value={industry || "—"} />
            <SummaryRow
              label="Locations"
              value={locationMode === "multiple" ? "Multiple locations" : "Single location"}
            />
            <SummaryRow
              label="Tracking"
              value={trackingEnabled.length ? trackingEnabled.join(", ") : "None selected"}
            />
            <SummaryRow label="Currency"  value={selectedCurrency} />
            <SummaryRow label="Starting"  value={startLabel} />
          </div>

          <p className="text-xs text-muted">Redirecting you in a moment…</p>
        </div>
      </AuthLayout>
    );
  }

  // ── Step 0: Welcome ─────────────────────────────────────────────────────────
  if (step === 0) {
    return (
      <AuthLayout formWidth="md" leftContent={leftContent}>
        <div className="flex flex-col items-center text-center">
          <div className="w-14 h-14 bg-primary-600 flex items-center justify-center mb-4">
            <User className="w-7 h-7 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-ink mb-2">
            Welcome{user?.firstName ? `, ${user.firstName}` : ""}!
          </h1>
          <p className="text-muted text-sm max-w-xs mb-8">
            You&apos;re just a few steps away from setting up your inventory management system.
          </p>
          <div className="w-full space-y-2 mb-8 text-left">
            {[
              { icon: Building2,   text: "Create your organization" },
              { icon: Sparkles,    text: "Personalize the look & feel" },
              { icon: CheckCircle, text: "Start managing inventory" },
            ].map(({ icon: Icon, text }) => (
              <div key={text} className="flex items-center gap-3 p-3 border border-stroke bg-page">
                <Icon className="w-4 h-4 text-primary-600 flex-shrink-0" />
                <span className="text-sm text-ink">{text}</span>
              </div>
            ))}
          </div>
          <Button size="lg" className="w-full" onClick={() => setStep(1)}>
            Get started <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      </AuthLayout>
    );
  }

  // ── Steps 1–4 (shared stepper) ───────────────────────────────────────────────
  return (
    <AuthLayout formWidth="md" leftContent={leftContent}>
      <Stepper current={step} />

      {/* ── Step 1: Organization Setup ── */}
      {step === 1 && (
        <div className="space-y-5">
          <div className="space-y-1 mb-2">
            <h2 className="text-xl font-bold text-ink">Organization Setup</h2>
            <p className="text-sm text-muted">Start with your organization name and industry.</p>
          </div>

          <div className="flex flex-col gap-1">
            <Input
              label="Organization name *"
              placeholder="Acme Corp"
              value={orgName}
              onChange={(e) => { setOrgName(e.target.value); if (e.target.value.trim()) setOrgNameError(""); }}
              error={orgNameError}
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-muted">Industry *</label>
            <div className="grid grid-cols-2 gap-2">
              {INDUSTRIES.map(({ id, label, icon: Icon }) => {
                const selected = industry === id;
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => { setIndustry(id); setIndustryError(""); }}
                    className={cn(
                      "flex items-center gap-2.5 p-3 border text-left text-sm transition-colors",
                      selected
                        ? "border-primary-600 bg-primary-50 text-primary-700"
                        : "border-stroke bg-panel text-ink hover:bg-hover"
                    )}
                  >
                    <Icon className={cn("w-4 h-4 flex-shrink-0", selected ? "text-primary-600" : "text-muted")} />
                    <span className="font-medium text-xs leading-tight">{label}</span>
                    {selected && <CheckCircle className="w-3.5 h-3.5 text-primary-600 ml-auto flex-shrink-0" />}
                  </button>
                );
              })}
            </div>
            {industryError && <p className="text-xs text-red-600">{industryError}</p>}
          </div>

          <Button size="lg" className="w-full mt-2" onClick={handleStep1Next}>
            Continue <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      )}

      {/* ── Step 2: Representative & Contact ── */}
      {step === 2 && (
        <div className="space-y-5">
          <div className="space-y-1 mb-2">
            <h2 className="text-xl font-bold text-ink">Representative &amp; Contact</h2>
            <p className="text-sm text-muted">Who is the primary contact for this organization?</p>
          </div>

          <Input
            label="Representative name *"
            placeholder="Jane Smith"
            value={repName}
            onChange={(e) => { setRepName(e.target.value); if (e.target.value.trim()) setRepNameError(""); }}
            error={repNameError}
          />
          <Input
            label="Email"
            type="email"
            placeholder="jane@example.com"
            value={repEmail}
            onChange={(e) => setRepEmail(e.target.value)}
          />
          <PhoneInput
            dialCode={dialCode}
            onDialCodeChange={setDialCode}
            phone={repPhone}
            onPhoneChange={setRepPhone}
          />

          <div className="flex gap-3 pt-1">
            <Button variant="outline" className="flex-1" onClick={() => setStep(1)}>
              <ChevronLeft className="w-4 h-4" /> Back
            </Button>
            <Button className="flex-1" onClick={handleStep2Next}>
              Continue <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}

      {/* ── Step 3: Personalization ── */}
      {step === 3 && (
        <div className="space-y-5">
          <div className="space-y-1 mb-2">
            <h2 className="text-xl font-bold text-ink">Personalization</h2>
            <p className="text-sm text-muted">Configure your inventory workflow preferences.</p>
          </div>

          {/* Locations */}
          <div className="space-y-2">
            <label className="text-xs font-medium text-muted">How many locations do you manage?</label>
            <div className="grid grid-cols-2 gap-2">
              {(["single", "multiple"] as const).map((mode) => {
                const Icon = mode === "single" ? MapPin : GitBranch;
                const label = mode === "single" ? "Single location" : "Multiple locations";
                const active = locationMode === mode;
                return (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => setLocationMode(mode)}
                    className={cn(
                      "flex items-center gap-2.5 p-3 border text-left transition-colors",
                      active
                        ? "border-primary-600 bg-primary-50 text-primary-700"
                        : "border-stroke bg-panel text-ink hover:bg-hover"
                    )}
                  >
                    <Icon className={cn("w-4 h-4 flex-shrink-0", active ? "text-primary-600" : "text-muted")} />
                    <span className="text-xs font-medium leading-tight">{label}</span>
                    {active && <CheckCircle className="w-3.5 h-3.5 text-primary-600 ml-auto flex-shrink-0" />}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Tracking preferences */}
          <div className="space-y-2">
            <label className="text-xs font-medium text-muted">Tracking preferences</label>
            <div className="space-y-2">
              {[
                { key: "expiry", label: "Expiry dates",        icon: CalendarClock, value: trackExpiry,  setter: setTrackExpiry  },
                { key: "batch",  label: "Batch / lot numbers", icon: Layers,        value: trackBatch,   setter: setTrackBatch   },
                { key: "serial", label: "Serial numbers",      icon: Hash,          value: trackSerial,  setter: setTrackSerial  },
              ].map(({ key, label, icon: Icon, value, setter }) => (
                <label
                  key={key}
                  className={cn(
                    "flex items-center gap-3 p-3 border cursor-pointer transition-colors",
                    value ? "border-primary-300 bg-primary-50" : "border-stroke bg-panel hover:bg-hover"
                  )}
                >
                  <input
                    type="checkbox"
                    checked={value}
                    onChange={(e) => setter(e.target.checked)}
                    className="accent-primary-600"
                  />
                  <Icon className={cn("w-4 h-4 flex-shrink-0", value ? "text-primary-600" : "text-muted")} />
                  <span className="text-sm text-ink">{label}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Currency */}
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-muted">Preferred currency</label>
            <select
              value={selectedCurrency}
              onChange={(e) => setSelectedCurrency(e.target.value)}
              className="w-full border border-stroke bg-panel text-ink text-sm px-3 py-2 outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500/20"
            >
              {CURRENCIES.map((c) => (
                <option key={c.code} value={c.code}>{c.label}</option>
              ))}
            </select>
          </div>

          <div className="flex gap-3 pt-1">
            <Button variant="outline" className="flex-1" onClick={() => setStep(2)}>
              <ChevronLeft className="w-4 h-4" /> Back
            </Button>
            <Button className="flex-1" onClick={() => setStep(4)}>
              Continue <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}

      {/* ── Step 4: Getting Started ── */}
      {step === 4 && (
        <div className="space-y-5">
          <div className="space-y-1 mb-2">
            <h2 className="text-xl font-bold text-ink">How do you want to begin?</h2>
            <p className="text-sm text-muted">Choose the best way to get your inventory into Inventra.</p>
          </div>

          {error && (
            <div className="p-3 bg-red-50 border border-red-200 text-sm text-red-700">
              {error}
            </div>
          )}

          <div className="space-y-2">
            {START_OPTIONS.map(({ id, label, desc, icon: Icon }) => {
              const selected = startMethod === id;
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => { setStartMethod(id); setStartMethodError(""); }}
                  className={cn(
                    "w-full flex items-start gap-3 p-4 border text-left transition-colors",
                    selected
                      ? "border-primary-600 bg-primary-50"
                      : "border-stroke bg-panel hover:bg-hover"
                  )}
                >
                  <div className={cn(
                    "w-9 h-9 flex items-center justify-center flex-shrink-0 mt-0.5",
                    selected ? "bg-primary-600" : "bg-stroke"
                  )}>
                    <Icon className={cn("w-4 h-4", selected ? "text-white" : "text-muted")} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={cn("text-sm font-semibold", selected ? "text-primary-700" : "text-ink")}>
                      {label}
                    </p>
                    <p className="text-xs text-muted mt-0.5">{desc}</p>
                  </div>
                  {selected && <CheckCircle className="w-4 h-4 text-primary-600 flex-shrink-0 mt-1" />}
                </button>
              );
            })}
          </div>

          {startMethodError && <p className="text-xs text-red-600">{startMethodError}</p>}

          <div className="flex gap-3 pt-1">
            <Button variant="outline" className="flex-1" onClick={() => setStep(3)}>
              <ChevronLeft className="w-4 h-4" /> Back
            </Button>
            <Button className="flex-1" loading={submitting} onClick={handleFinish}>
              Finish setup
            </Button>
          </div>
        </div>
      )}
    </AuthLayout>
  );
}

// ─── Summary row helper ────────────────────────────────────────────────────────

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-3 p-3 border border-stroke bg-page">
      <span className="text-xs text-muted flex-shrink-0 w-24">{label}</span>
      <span className="text-xs font-medium text-ink text-right">{value}</span>
    </div>
  );
}
