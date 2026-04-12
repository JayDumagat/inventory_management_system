import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useNavigate } from "react-router-dom";
import { useTenantStore } from "../../stores/tenantStore";
import { useAuthStore } from "../../stores/authStore";
import { useTheme } from "../../contexts/ThemeContext";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { useState } from "react";
import { api } from "../../api/client";
import { Building2, CheckCircle, Sparkles, User, ChevronRight } from "lucide-react";
import { cn } from "../../lib/utils";
import type { AccentColor } from "../../stores/themeStore";

const STEPS = ["Welcome", "Organization", "Personalize", "Done"];

const orgSchema = z.object({
  name: z.string().min(1, "Organization name required"),
  slug: z
    .string()
    .min(1, "Slug required")
    .regex(/^[a-z0-9-]+$/, "Lowercase letters, numbers and dashes only"),
  description: z.string().optional(),
  logoUrl: z.string().url("Must be a valid URL").optional().or(z.literal("")),
});

type OrgForm = z.infer<typeof orgSchema>;

const ACCENT_SWATCHES: { key: AccentColor; label: string; color: string; bg: string }[] = [
  { key: "olive",   label: "Olive Garden",  color: "#606c38", bg: "#fefae0" },
  { key: "ocean",   label: "Ocean Breeze",  color: "#457b9d", bg: "#f1faee" },
  { key: "blue",    label: "Classic Blue",  color: "#3b82f6", bg: "#eff6ff" },
  { key: "violet",  label: "Violet",        color: "#8b5cf6", bg: "#f5f3ff" },
  { key: "emerald", label: "Emerald",       color: "#10b981", bg: "#ecfdf5" },
  { key: "rose",    label: "Rose",          color: "#f43f5e", bg: "#fff1f2" },
];

export default function OnboardingPage() {
  const navigate = useNavigate();
  const setCurrentTenant = useTenantStore((s) => s.setCurrentTenant);
  const user = useAuthStore((s) => s.user);
  const theme = useTheme();
  const [step, setStep] = useState(0);
  const [error, setError] = useState("");
  const [logoPreview, setLogoPreview] = useState("");

  const form = useForm<OrgForm>({
    resolver: zodResolver(orgSchema),
    defaultValues: { logoUrl: "" },
  });

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const slug = e.target.value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    form.setValue("slug", slug);
  };

  const handleOrgSubmit = async (data: OrgForm) => {
    try {
      setError("");
      const payload = { ...data, logoUrl: data.logoUrl || undefined };
      const { data: tenant } = await api.post("/api/tenants", payload);
      setCurrentTenant({ ...tenant, role: "owner" });
      setStep(2);
    } catch (e: unknown) {
      setError((e as { response?: { data?: { error?: string } } })?.response?.data?.error || "Failed to create organization");
    }
  };

  const handleFinish = () => navigate("/dashboard");

  const stepIndicator = (
    <div className="flex items-center justify-center gap-2 mb-8">
      {STEPS.map((label, i) => (
        <div key={label} className="flex items-center gap-2">
          <div className={cn(
            "flex items-center justify-center w-6 h-6 text-xs font-bold border transition-colors",
            i < step ? "bg-primary-600 border-primary-600 text-white" :
            i === step ? "border-primary-600 text-primary-600" :
            "border-stroke text-muted"
          )}>
            {i < step ? <CheckCircle className="w-3.5 h-3.5" /> : i + 1}
          </div>
          <span className={cn("text-xs hidden sm:block", i === step ? "text-ink font-medium" : "text-muted")}>{label}</span>
          {i < STEPS.length - 1 && <ChevronRight className="w-3.5 h-3.5 text-muted" />}
        </div>
      ))}
    </div>
  );

  return (
    <div className="min-h-screen bg-page flex items-center justify-center p-4">
      <div className="bg-panel border border-stroke p-8 w-full max-w-md">
        {stepIndicator}

        {/* Step 0 — Welcome */}
        {step === 0 && (
          <div className="flex flex-col items-center text-center">
            <div className="w-14 h-14 bg-primary-600 flex items-center justify-center mb-4">
              <User className="w-7 h-7 text-white" />
            </div>
            <h1 className="text-2xl font-bold text-ink mb-2">
              Welcome{user?.firstName ? `, ${user.firstName}` : ""}!
            </h1>
            <p className="text-muted text-sm max-w-xs mb-8">
              You're just a few steps away from setting up your inventory management system.
            </p>
            <div className="w-full space-y-2 mb-8 text-left">
              {[
                { icon: Building2, text: "Create your organization" },
                { icon: Sparkles, text: "Personalize the look & feel" },
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
        )}

        {/* Step 1 — Organization */}
        {step === 1 && (
          <div>
            <div className="flex flex-col items-center mb-6">
              <div className="w-10 h-10 bg-primary-600 flex items-center justify-center mb-3">
                <Building2 className="w-5 h-5 text-white" />
              </div>
              <h1 className="text-xl font-bold text-ink">Set up your organization</h1>
              <p className="text-muted text-sm mt-1 text-center">
                Create your workspace to start managing inventory
              </p>
            </div>

            {error && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 text-sm text-red-700">
                {error}
              </div>
            )}

            <form onSubmit={form.handleSubmit(handleOrgSubmit)} className="flex flex-col gap-4">
              <Input
                label="Organization name"
                placeholder="Acme Corp"
                {...form.register("name")}
                onChange={(e) => { form.register("name").onChange(e); handleNameChange(e); }}
                error={form.formState.errors.name?.message}
              />
              <Input
                label="URL slug"
                placeholder="acme-corp"
                {...form.register("slug")}
                helperText="Used in URLs. Lowercase letters, numbers and dashes."
                error={form.formState.errors.slug?.message}
              />
              <Input
                label="Description (optional)"
                placeholder="What does your company do?"
                {...form.register("description")}
              />
              <Input
                label="Logo URL (optional)"
                placeholder="https://example.com/logo.png"
                {...form.register("logoUrl")}
                onChange={(e) => { form.register("logoUrl").onChange(e); setLogoPreview(e.target.value); }}
                error={form.formState.errors.logoUrl?.message}
              />
              {logoPreview && /^https?:\/\//i.test(logoPreview) && (
                <div className="flex items-center gap-3 p-3 border border-stroke bg-page">
                  <img
                    src={logoPreview}
                    alt="Logo preview"
                    className="w-10 h-10 object-contain"
                    onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                  />
                  <span className="text-xs text-muted">Logo preview</span>
                </div>
              )}
              <div className="flex gap-3 pt-2">
                <Button type="button" variant="outline" onClick={() => setStep(0)} className="flex-1">
                  Back
                </Button>
                <Button type="submit" loading={form.formState.isSubmitting} className="flex-1">
                  Continue
                </Button>
              </div>
            </form>
          </div>
        )}

        {/* Step 2 — Personalize */}
        {step === 2 && (
          <div>
            <div className="flex flex-col items-center mb-6">
              <div className="w-10 h-10 bg-primary-600 flex items-center justify-center mb-3">
                <Sparkles className="w-5 h-5 text-white" />
              </div>
              <h1 className="text-xl font-bold text-ink">Personalize your workspace</h1>
              <p className="text-muted text-sm mt-1 text-center">
                Choose a color theme that suits your brand
              </p>
            </div>

            <div className="grid grid-cols-2 gap-2 mb-6">
              {ACCENT_SWATCHES.map((s) => (
                <button
                  key={s.key}
                  onClick={() => theme.setAccent(s.key)}
                  className={cn(
                    "flex items-center gap-2 p-3 border text-left transition-colors",
                    theme.accent === s.key
                      ? "border-primary-600 bg-primary-50"
                      : "border-stroke bg-panel hover:bg-hover"
                  )}
                >
                  <div className="flex gap-1 flex-shrink-0">
                    <div className="w-4 h-4 border border-black/10" style={{ background: s.color }} />
                    <div className="w-4 h-4 border border-black/10" style={{ background: s.bg }} />
                  </div>
                  <span className={cn("text-xs font-medium truncate", theme.accent === s.key ? "text-primary-700" : "text-ink")}>
                    {s.label}
                  </span>
                  {theme.accent === s.key && <CheckCircle className="w-3.5 h-3.5 text-primary-600 ml-auto flex-shrink-0" />}
                </button>
              ))}
            </div>

            <div className="flex gap-3">
              <Button variant="outline" onClick={() => setStep(3)} className="flex-1">
                Skip
              </Button>
              <Button onClick={() => setStep(3)} className="flex-1">
                Continue
              </Button>
            </div>
          </div>
        )}

        {/* Step 3 — Done */}
        {step === 3 && (
          <div className="flex flex-col items-center text-center">
            <div className="w-14 h-14 bg-green-50 border border-green-200 flex items-center justify-center mb-4">
              <CheckCircle className="w-7 h-7 text-green-600" />
            </div>
            <h1 className="text-2xl font-bold text-ink mb-2">You're all set!</h1>
            <p className="text-muted text-sm max-w-xs mb-8">
              Your organization has been created. Start adding products, managing inventory and tracking orders.
            </p>
            <Button size="lg" className="w-full" onClick={handleFinish}>
              Go to dashboard
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
