import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { api } from "../../api/client";
import { useTenantStore } from "../../stores/tenantStore";
import { useAuthStore } from "../../stores/authStore";
import { useTheme } from "../../contexts/ThemeContext";
import { useSearchParams } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/Card";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { Select } from "../../components/ui/Select";
import { Modal } from "../../components/ui/Modal";
import { Badge } from "../../components/ui/Badge";
import { SkeletonTable } from "../../components/ui/Skeleton";
import {
  Building2, Palette, CreditCard, Users, Bell, Shield, Zap, TrendingUp, Clock, FileText,
  CheckCircle, Sun, Moon, Monitor, Plus, Pencil, Trash2,
} from "lucide-react";
import { cn, formatCurrency } from "../../lib/utils";
import type { AccentColor, ThemeMode } from "../../stores/themeStore";
import { useToast } from "../../hooks/useToast";
import type {
  Invoice, PlanDefinition, SubscriptionHistoryEntry, SubscriptionUsage, TenantSubscription,
} from "../../types";

const ACCENT_SWATCHES: { key: AccentColor; label: string; color: string; bg: string; description: string }[] = [
  { key: "olive",   label: "Olive Garden",  color: "#606c38", bg: "#fefae0", description: "Warm earthy tones" },
  { key: "ocean",   label: "Ocean Breeze",  color: "#457b9d", bg: "#f1faee", description: "Crisp cool blues" },
  { key: "coastal", label: "Coastal Vibes", color: "#3d5a80", bg: "#e0fbfc", description: "Aqua & navy" },
  { key: "blue",    label: "Classic Blue",  color: "#3b82f6", bg: "#eff6ff", description: "Professional blue" },
  { key: "violet",  label: "Violet",        color: "#8b5cf6", bg: "#f5f3ff", description: "Modern purple" },
  { key: "emerald", label: "Emerald",       color: "#10b981", bg: "#ecfdf5", description: "Fresh green" },
  { key: "rose",    label: "Rose",          color: "#f43f5e", bg: "#fff1f2", description: "Bold rose" },
  { key: "amber",   label: "Amber",         color: "#f59e0b", bg: "#fffbeb", description: "Golden amber" },
  { key: "teal",    label: "Teal",          color: "#14b8a6", bg: "#f0fdfa", description: "Calm teal" },
];

const ROLE_COLORS: Record<string, "default" | "info" | "warning" | "success" | "danger"> = {
  owner: "danger",
  admin: "warning",
  manager: "info",
  staff: "default",
};

interface StaffMember {
  tenantUserId: string;
  userId: string;
  role: string;
  isActive: boolean;
  email: string;
  firstName: string;
  lastName: string;
  createdAt: string;
  branches: { id: string; name: string }[];
}

interface SubscriptionData {
  subscription: TenantSubscription;
  plan: PlanDefinition;
  usage: SubscriptionUsage;
}

const inviteSchema = z.object({
  email: z.string().email("Invalid email"),
  role: z.enum(["staff", "manager", "admin"]),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
});
type InviteForm = z.infer<typeof inviteSchema>;

type Tab = "general" | "personalization" | "subscriptions" | "team" | "notifications" | "security";
const DEFAULT_RECEIPT_FOOTER = "Thank you for your purchase!";

function sanitizeReceiptTemplate(value: unknown): "compact" | "detailed" {
  return value === "detailed" ? "detailed" : "compact";
}

function sanitizeImageUrl(url: string): string {
  if (!url) return "";
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return "";
    return parsed.href;
  } catch {
    return "";
  }
}

const TABS: { value: Tab; label: string; icon: typeof Building2 }[] = [
  { value: "general",         label: "General",         icon: Building2 },
  { value: "personalization", label: "Personalization", icon: Palette },
  { value: "subscriptions",   label: "Subscriptions",   icon: CreditCard },
  { value: "team",            label: "Team",            icon: Users },
  { value: "notifications",   label: "Notifications",   icon: Bell },
  { value: "security",        label: "Security",        icon: Shield },
];

const ROLE_PERMISSIONS = [
  { action: "View inventory",      owner: true,  admin: true,  manager: true,  staff: true  },
  { action: "Adjust stock",        owner: true,  admin: true,  manager: true,  staff: false },
  { action: "Create products",     owner: true,  admin: true,  manager: true,  staff: false },
  { action: "Manage branches",     owner: true,  admin: true,  manager: false, staff: false },
  { action: "Manage staff",        owner: true,  admin: true,  manager: false, staff: false },
  { action: "View reports",        owner: true,  admin: true,  manager: true,  staff: false },
  { action: "Delete data",         owner: true,  admin: false, manager: false, staff: false },
  { action: "Organization settings", owner: true, admin: true, manager: true,  staff: false },
];

export default function OrganizationPage() {
  const { currentTenant, setCurrentTenant } = useTenantStore();
  const { user: currentUser } = useAuthStore();
  const [searchParams, setSearchParams] = useSearchParams();
  const qc = useQueryClient();
  const theme = useTheme();
  const tid = currentTenant?.id;
  const myRole = currentTenant?.role || "staff";

  const initialTab = searchParams.get("tab");
  const isTab = (value: string | null): value is Tab => !!value && TABS.some((t) => t.value === value);
  const [tab, setTab] = useState<Tab>(isTab(initialTab) ? initialTab : "general");

  // General tab state
  const [orgName, setOrgName] = useState(currentTenant?.name || "");
  const [orgDesc, setOrgDesc] = useState(currentTenant?.description || "");
  const [orgLogo, setOrgLogo] = useState((currentTenant as { logoUrl?: string })?.logoUrl || "");
  const [receiptTemplate, setReceiptTemplate] = useState<"compact" | "detailed">(sanitizeReceiptTemplate((currentTenant as { receiptTemplate?: string } | null)?.receiptTemplate));
  const [receiptFooterMessage, setReceiptFooterMessage] = useState(
    (currentTenant as { receiptFooterMessage?: string } | null)?.receiptFooterMessage || DEFAULT_RECEIPT_FOOTER
  );
  const [savingOrg, setSavingOrg] = useState(false);
  const [orgSuccess, setOrgSuccess] = useState(false);
  const [orgError, setOrgError] = useState("");

  // Team tab state
  const [inviteOpen, setInviteOpen] = useState(false);
  const [editMember, setEditMember] = useState<StaffMember | null>(null);
  const [editRole, setEditRole] = useState("staff");
  const [editActive, setEditActive] = useState(true);
  const [savingEdit, setSavingEdit] = useState(false);
  const [editError, setEditError] = useState("");

  const { data: staff = [], isLoading: staffLoading } = useQuery<StaffMember[]>({
    queryKey: ["staff", tid],
    queryFn: () => api.get(`/api/tenants/${tid}/staff`).then((r) => r.data),
    enabled: !!tid && tab === "team",
  });

  const inviteForm = useForm<InviteForm>({
    resolver: zodResolver(inviteSchema),
    defaultValues: { role: "staff" },
  });

  const invite = useMutation({
    mutationFn: (data: InviteForm) =>
      api.post(`/api/tenants/${tid}/staff`, data).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["staff", tid] });
      setInviteOpen(false);
      inviteForm.reset({ role: "staff" });
      toast.success("Staff member invited");
    },
    onError: () => toast.error("Failed to invite staff member"),
  });

  const remove = useMutation({
    mutationFn: (staffId: string) => api.delete(`/api/tenants/${tid}/staff/${staffId}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["staff", tid] }); toast.success("Staff member removed"); },
    onError: () => toast.error("Failed to remove staff member"),
  });

  const canManage = ["owner", "admin"].includes(myRole);
  const canInvite = ["owner", "admin", "manager"].includes(myRole);
  const toast = useToast();

  const { data: subscriptionData, isLoading: subLoading } = useQuery<SubscriptionData>({
    queryKey: ["subscription", tid],
    queryFn: () => api.get(`/api/tenants/${tid}/subscription`).then((r) => r.data),
    enabled: !!tid,
  });

  const { data: plans = [] } = useQuery<PlanDefinition[]>({
    queryKey: ["plans"],
    queryFn: () => api.get("/api/subscription/plans").then((r) => r.data),
    enabled: tab === "subscriptions",
  });

  const { data: subscriptionHistory = [] } = useQuery<SubscriptionHistoryEntry[]>({
    queryKey: ["subscription-history", tid],
    queryFn: () => api.get(`/api/tenants/${tid}/subscription/history`).then((r) => r.data),
    enabled: !!tid && tab === "subscriptions" && canManage,
  });

  const { data: invoices = [] } = useQuery<Invoice[]>({
    queryKey: ["invoices", tid, "subscription-tab"],
    queryFn: () => api.get(`/api/tenants/${tid}/invoices`).then((r) => r.data),
    enabled: !!tid && tab === "subscriptions",
  });

  const changePlan = useMutation({
    mutationFn: (planKey: string) => api.patch(`/api/tenants/${tid}/subscription`, { planKey }).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["subscription", tid] });
      qc.invalidateQueries({ queryKey: ["subscription-history", tid] });
      toast.success("Subscription plan updated");
    },
    onError: (err: { response?: { data?: { error?: string } } }) => {
      toast.error(err.response?.data?.error ?? "Failed to update subscription");
    },
  });

  const canEditSidebarBranding = subscriptionData?.subscription.planKey === "enterprise";

  const openEdit = (member: StaffMember) => {
    setEditMember(member);
    setEditRole(member.role);
    setEditActive(member.isActive);
    setEditError("");
  };

  const handleSaveEdit = async () => {
    if (!editMember) return;
    setSavingEdit(true);
    setEditError("");
    try {
      await api.patch(`/api/tenants/${tid}/staff/${editMember.tenantUserId}`, {
        role: editRole,
        isActive: editActive,
      });
      qc.invalidateQueries({ queryKey: ["staff", tid] });
      setEditMember(null);
    } catch (e: unknown) {
      setEditError((e as { response?: { data?: { error?: string } } })?.response?.data?.error || "Save failed");
    } finally {
      setSavingEdit(false);
    }
  };

  const handleDeleteMember = (member: StaffMember) => {
    if (confirm(`Remove ${member.firstName || member.email} from this organization?`)) {
      remove.mutate(member.tenantUserId);
    }
  };

  const handleSaveOrg = async () => {
    if (!currentTenant) return;
    setSavingOrg(true);
    setOrgError("");
    try {
      const payload: Record<string, unknown> = {};
      if (orgDesc !== (currentTenant.description || "")) payload.description = orgDesc;
      if (canEditSidebarBranding) {
        if (orgName !== currentTenant.name) payload.name = orgName;
        const currentLogo = (currentTenant as { logoUrl?: string }).logoUrl || "";
        if (orgLogo !== currentLogo) payload.logoUrl = orgLogo || undefined;
      }
      const currentReceiptTemplate = sanitizeReceiptTemplate((currentTenant as { receiptTemplate?: string } | null)?.receiptTemplate);
      const currentReceiptFooter = ((currentTenant as { receiptFooterMessage?: string } | null)?.receiptFooterMessage || DEFAULT_RECEIPT_FOOTER);
      if (receiptTemplate !== currentReceiptTemplate) payload.receiptTemplate = receiptTemplate;
      if (receiptFooterMessage !== currentReceiptFooter) payload.receiptFooterMessage = receiptFooterMessage;
      if (Object.keys(payload).length === 0) {
        setOrgSuccess(true);
        setTimeout(() => setOrgSuccess(false), 3000);
        toast("No changes to save");
        return;
      }

      const { data: updated } = await api.patch(`/api/tenants/${currentTenant.id}`, payload);
      const nextTenant = {
        ...currentTenant,
        name: updated.name ?? currentTenant.name,
        description: updated.description ?? currentTenant.description,
      } as typeof currentTenant & { logoUrl?: string };
      if (Object.prototype.hasOwnProperty.call(updated, "logoUrl")) {
        nextTenant.logoUrl = updated.logoUrl ?? undefined;
      }
      if (Object.prototype.hasOwnProperty.call(updated, "receiptTemplate")) {
        (nextTenant as { receiptTemplate?: "compact" | "detailed" }).receiptTemplate = sanitizeReceiptTemplate(updated.receiptTemplate);
      }
      if (Object.prototype.hasOwnProperty.call(updated, "receiptFooterMessage")) {
        (nextTenant as { receiptFooterMessage?: string }).receiptFooterMessage = updated.receiptFooterMessage ?? DEFAULT_RECEIPT_FOOTER;
      }
      setCurrentTenant(nextTenant);
      qc.invalidateQueries({ queryKey: ["tenants"] });
      setOrgSuccess(true);
      setTimeout(() => setOrgSuccess(false), 3000);
      toast.success("Organization settings saved");
    } catch (e: unknown) {
      setOrgError((e as { response?: { data?: { error?: string } } })?.response?.data?.error || "Save failed");
      toast.error("Failed to save organization settings");
    } finally {
      setSavingOrg(false);
    }
  };

  const MODE_OPTIONS: { value: ThemeMode; label: string; icon: typeof Sun }[] = [
    { value: "light",  label: "Light",  icon: Sun },
    { value: "dark",   label: "Dark",   icon: Moon },
    { value: "system", label: "System", icon: Monitor },
  ];

  return (
    <div className="space-y-5 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold text-ink">Organization Settings</h1>
        <p className="text-muted text-sm mt-1">Manage your organization, team, and preferences</p>
      </div>

      {/* Tab bar */}
      <div className="flex gap-0 border-b border-stroke flex-wrap">
        {TABS.map((t) => (
          <button
            key={t.value}
            onClick={() => {
              setTab(t.value);
              setSearchParams({ tab: t.value });
            }}
            className={cn(
              "flex items-center gap-1.5 px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors",
              tab === t.value
                ? "border-primary-600 text-primary-600"
                : "border-transparent text-muted hover:text-ink"
            )}
          >
            <t.icon className="w-3.5 h-3.5" />
            {t.label}
          </button>
        ))}
      </div>

      {/* General */}
      {tab === "general" && (
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
            <Input label="Organization name" value={orgName} onChange={(e) => setOrgName(e.target.value)} disabled={!canEditSidebarBranding} />
            {!canEditSidebarBranding && (
              <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 px-3 py-2">
                Name and logo shown in the sidebar can only be changed on the Enterprise tier.
              </p>
            )}
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
                disabled={!canEditSidebarBranding}
              />
              {sanitizeImageUrl(orgLogo) && (
                <div className="flex items-center gap-3 p-3 border border-stroke bg-page">
                  <img
                    src={sanitizeImageUrl(orgLogo)}
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
      )}

      {/* Personalization */}
      {tab === "personalization" && (
        <Card>
          <CardHeader>
            <CardTitle>
              <div className="flex items-center gap-2">
                <Palette className="w-4 h-4 text-muted" />
                Personalization
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-5">
            <div className="flex flex-col gap-2">
              <Input
                label="Logo URL"
                placeholder="https://example.com/logo.png"
                value={orgLogo}
                onChange={(e) => setOrgLogo(e.target.value)}
                disabled={!canEditSidebarBranding}
              />
              {!canEditSidebarBranding && (
                <p className="text-xs text-amber-700">Logo customization requires the Enterprise plan.</p>
              )}
              {sanitizeImageUrl(orgLogo) && (
                <div className="flex items-center gap-3 p-3 border border-stroke bg-page">
                  <img
                    src={sanitizeImageUrl(orgLogo)}
                    alt="Logo preview"
                    className="w-10 h-10 object-contain flex-shrink-0"
                    onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                  />
                  <span className="text-xs text-muted">Logo preview</span>
                </div>
              )}
            </div>

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

            <div className="border-t border-stroke pt-5 space-y-3">
              <p className="text-sm font-medium text-ink">Receipt preferences</p>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setReceiptTemplate("compact")}
                  className={cn(
                    "px-2 py-1.5 text-xs border",
                    receiptTemplate === "compact" ? "border-primary-600 bg-primary-50 text-primary-700" : "border-stroke text-muted"
                  )}
                >
                  Compact
                </button>
                <button
                  type="button"
                  onClick={() => setReceiptTemplate("detailed")}
                  className={cn(
                    "px-2 py-1.5 text-xs border",
                    receiptTemplate === "detailed" ? "border-primary-600 bg-primary-50 text-primary-700" : "border-stroke text-muted"
                  )}
                >
                  Detailed
                </button>
              </div>
              <Input
                label="Receipt footer message"
                value={receiptFooterMessage}
                onChange={(e) => setReceiptFooterMessage(e.target.value)}
                placeholder={DEFAULT_RECEIPT_FOOTER}
              />
              <div className="flex justify-end">
                <Button onClick={handleSaveOrg} loading={savingOrg}>Save personalization</Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Subscriptions */}
      {tab === "subscriptions" && (
        <Card>
          <CardHeader>
            <CardTitle>
              <div className="flex items-center gap-2">
                <CreditCard className="w-4 h-4 text-muted" />
                Subscription
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            {subLoading || !subscriptionData ? (
              <SkeletonTable />
            ) : (
              <>
                <div className="p-4 border border-stroke bg-page flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <Zap className="w-4 h-4 text-primary-500" />
                    <p className="text-sm font-semibold text-ink">{subscriptionData.plan.name}</p>
                    <Badge variant={subscriptionData.subscription.status === "active" ? "success" : "warning"}>
                      {subscriptionData.subscription.status}
                    </Badge>
                  </div>
                  <div className="text-sm text-muted">
                    {subscriptionData.plan.monthlyPrice === 0
                      ? "Free"
                      : `${formatCurrency(subscriptionData.plan.monthlyPrice)}/mo · ${formatCurrency(subscriptionData.plan.annualPrice)}/yr`}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="border border-stroke p-3">
                    <p className="text-xs text-muted">Billing information</p>
                    <p className="text-sm font-medium text-ink mt-1">{currentTenant?.name}</p>
                  </div>
                  <div className="border border-stroke p-3">
                    <p className="text-xs text-muted">Payment method</p>
                    <p className="text-sm font-medium text-ink mt-1">Not configured</p>
                  </div>
                  <div className="border border-stroke p-3">
                    <p className="text-xs text-muted">Expiration / renewal</p>
                    <p className="text-sm font-medium text-ink mt-1">
                      {subscriptionData.subscription.currentPeriodEnd
                        ? new Date(subscriptionData.subscription.currentPeriodEnd).toLocaleDateString()
                        : "No expiration"}
                    </p>
                  </div>
                </div>

                {canManage && (
                  <div className="space-y-2">
                    <p className="text-sm font-medium text-ink flex items-center gap-2">
                      <TrendingUp className="w-4 h-4" />
                      Change plan
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                      {plans.map((p) => {
                        const isCurrent = p.key === subscriptionData.subscription.planKey;
                        return (
                          <div key={p.key} className={cn("border p-3", isCurrent ? "border-primary-400 bg-primary-50" : "border-stroke")}>
                            <p className="text-sm font-semibold text-ink">{p.name}</p>
                            <p className="text-xs text-muted mt-0.5">
                              {p.monthlyPrice === 0 ? "Free" : `${formatCurrency(p.monthlyPrice)}/mo`}
                            </p>
                            <div className="mt-2">
                              <Button
                                size="sm"
                                variant={isCurrent ? "outline" : "primary"}
                                disabled={isCurrent || changePlan.isPending}
                                onClick={() => changePlan.mutate(p.key)}
                              >
                                {isCurrent ? "Current plan" : "Switch"}
                              </Button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                <div className="border border-stroke">
                  <div className="px-4 py-3 border-b border-stroke flex items-center gap-2">
                    <FileText className="w-4 h-4 text-muted" />
                    <p className="text-sm font-medium text-ink">Invoices</p>
                  </div>
                  {invoices.length === 0 ? (
                    <div className="px-4 py-6 text-sm text-muted">No invoices found.</div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-stroke text-left">
                            <th className="px-4 py-2 text-xs text-muted">Invoice</th>
                            <th className="px-4 py-2 text-xs text-muted">Status</th>
                            <th className="px-4 py-2 text-xs text-muted">Total</th>
                            <th className="px-4 py-2 text-xs text-muted">Due</th>
                          </tr>
                        </thead>
                        <tbody>
                          {invoices.slice(0, 10).map((inv) => (
                            <tr key={inv.id} className="border-b border-stroke">
                              <td className="px-4 py-2 text-ink">{inv.invoiceNumber}</td>
                              <td className="px-4 py-2 text-muted capitalize">{inv.status}</td>
                              <td className="px-4 py-2 text-ink">{formatCurrency(inv.totalAmount)}</td>
                              <td className="px-4 py-2 text-muted">{inv.dueDate ? new Date(inv.dueDate).toLocaleDateString() : "—"}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

                {subscriptionData.subscription.cancelAtPeriodEnd && (
                  <div className="flex items-start gap-2 text-sm text-amber-700 bg-amber-50 border border-amber-200 p-3">
                    <Clock className="w-4 h-4 mt-0.5 shrink-0" />
                    <p>Your subscription is set to cancel at period end.</p>
                  </div>
                )}

                {canManage && subscriptionHistory.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-sm font-medium text-ink">Subscription history</p>
                    <div className="space-y-1">
                      {subscriptionHistory.slice(0, 8).map((h) => (
                        <div key={h.id} className="text-xs text-muted border-b border-stroke pb-1">
                          <span className="text-ink">{h.fromPlan} → {h.toPlan}</span> · {new Date(h.effectiveAt).toLocaleDateString()}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
      )}

      {/* Team */}
      {tab === "team" && (
        <div className="space-y-5">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted">{staff.length} {staff.length === 1 ? "member" : "members"}</p>
            {canInvite && (
              <Button onClick={() => setInviteOpen(true)} className="gap-2">
                <Plus className="w-4 h-4" /> Invite staff
              </Button>
            )}
          </div>

          {staffLoading ? (
            <div className="border border-stroke">
              <table className="w-full"><SkeletonTable rows={4} cols={4} /></table>
            </div>
          ) : staff.length === 0 ? (
            <Card>
              <CardContent className="p-0">
                <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
                  <Users className="w-10 h-10 text-muted mb-3" />
                  <h3 className="text-base font-semibold text-ink mb-1">No staff yet</h3>
                  <p className="text-sm text-muted max-w-xs mb-4">Invite staff members to give them access</p>
                  {canInvite && <Button onClick={() => setInviteOpen(true)}>Invite your first staff member</Button>}
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-stroke text-left">
                      <th className="px-6 py-3 text-xs font-semibold text-muted uppercase tracking-wider">Name</th>
                      <th className="px-6 py-3 text-xs font-semibold text-muted uppercase tracking-wider">Email</th>
                      <th className="px-6 py-3 text-xs font-semibold text-muted uppercase tracking-wider">Role</th>
                      <th className="px-6 py-3 text-xs font-semibold text-muted uppercase tracking-wider">Status</th>
                      <th className="px-6 py-3" />
                    </tr>
                  </thead>
                  <tbody>
                    {staff.map((m) => {
                      const isMe = m.userId === currentUser?.id;
                      const fullName = [m.firstName, m.lastName].filter(Boolean).join(" ") || "—";
                      return (
                        <tr key={m.tenantUserId} className={cn("border-b border-stroke hover:bg-hover transition-colors", isMe && "bg-primary-50")}>
                          <td className="px-6 py-3 font-medium text-ink">
                            <div className="flex items-center gap-2">
                              <div className="w-7 h-7 bg-primary-100 flex items-center justify-center text-primary-700 font-bold text-xs flex-shrink-0">
                                {(m.firstName?.[0] || m.email[0]).toUpperCase()}
                              </div>
                              {fullName}
                              {isMe && <span className="text-[10px] bg-primary-100 text-primary-700 px-1.5 py-0.5 font-medium">you</span>}
                            </div>
                          </td>
                          <td className="px-6 py-3 text-muted">{m.email}</td>
                          <td className="px-6 py-3">
                            <Badge variant={ROLE_COLORS[m.role] || "default"}>{m.role}</Badge>
                          </td>
                          <td className="px-6 py-3">
                            {m.isActive ? (
                              <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 font-medium">Active</span>
                            ) : (
                              <span className="text-xs bg-stroke text-muted px-2 py-0.5">Inactive</span>
                            )}
                          </td>
                          <td className="px-6 py-3">
                            {canManage && m.role !== "owner" && !isMe && (
                              <div className="flex items-center gap-1 justify-end">
                                <Button variant="ghost" size="sm" onClick={() => openEdit(m)}>
                                  <Pencil className="w-4 h-4" />
                                </Button>
                                <Button variant="ghost" size="sm" onClick={() => handleDeleteMember(m)} disabled={remove.isPending}>
                                  <Trash2 className="w-4 h-4 text-red-400" />
                                </Button>
                              </div>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </Card>
          )}

          {/* Role Permissions table */}
          <Card>
            <CardHeader>
              <CardTitle>Role Permissions</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-stroke text-left">
                      <th className="px-6 py-3 text-xs font-semibold text-muted uppercase tracking-wider">Action</th>
                      <th className="px-6 py-3 text-xs font-semibold text-muted uppercase tracking-wider text-center">Owner</th>
                      <th className="px-6 py-3 text-xs font-semibold text-muted uppercase tracking-wider text-center">Admin</th>
                      <th className="px-6 py-3 text-xs font-semibold text-muted uppercase tracking-wider text-center">Manager</th>
                      <th className="px-6 py-3 text-xs font-semibold text-muted uppercase tracking-wider text-center">Staff</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ROLE_PERMISSIONS.map((row) => (
                      <tr key={row.action} className="border-b border-stroke last:border-0">
                        <td className="px-6 py-2.5 text-ink">{row.action}</td>
                        {(["owner", "admin", "manager", "staff"] as const).map((role) => (
                          <td key={role} className="px-6 py-2.5 text-center">
                            {row[role] ? (
                              <CheckCircle className="w-4 h-4 text-green-500 mx-auto" />
                            ) : (
                              <span className="w-4 h-px bg-stroke block mx-auto" />
                            )}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          {/* Invite modal */}
          <Modal open={inviteOpen} onClose={() => { setInviteOpen(false); inviteForm.reset({ role: "staff" }); }} title="Invite staff member">
            <form onSubmit={inviteForm.handleSubmit((d) => invite.mutate(d))} className="flex flex-col gap-4">
              {invite.isError && (
                <div className="p-3 bg-red-50 border border-red-200 text-sm text-red-700">
                  {(invite.error as { response?: { data?: { error?: string } } })?.response?.data?.error || "Invite failed"}
                </div>
              )}
              <Input label="Email address" type="email" {...inviteForm.register("email")} error={inviteForm.formState.errors.email?.message} />
              <div className="grid grid-cols-2 gap-3">
                <Input label="First name (optional)" {...inviteForm.register("firstName")} />
                <Input label="Last name (optional)" {...inviteForm.register("lastName")} />
              </div>
              <Select label="Role" {...inviteForm.register("role")}>
                <option value="staff">Staff</option>
                <option value="manager">Manager</option>
                {myRole === "owner" && <option value="admin">Admin</option>}
              </Select>
              <div className="flex gap-3 justify-end pt-2">
                <Button type="button" variant="outline" onClick={() => { setInviteOpen(false); inviteForm.reset({ role: "staff" }); }}>Cancel</Button>
                <Button type="submit" loading={invite.isPending}>Send invite</Button>
              </div>
            </form>
          </Modal>

          {/* Edit modal */}
          <Modal open={!!editMember} onClose={() => setEditMember(null)} title="Edit staff member" size="sm">
            <div className="flex flex-col gap-4">
              {editError && (
                <div className="p-3 bg-red-50 border border-red-200 text-sm text-red-700">{editError}</div>
              )}
              <p className="text-sm font-medium text-ink">
                {[editMember?.firstName, editMember?.lastName].filter(Boolean).join(" ") || editMember?.email}
              </p>
              <Select label="Role" value={editRole} onChange={(e) => setEditRole(e.target.value)}>
                <option value="staff">Staff</option>
                <option value="manager">Manager</option>
                <option value="admin">Admin</option>
              </Select>
              <div className="flex items-center justify-between py-2 border-t border-stroke">
                <div>
                  <p className="text-sm font-medium text-ink">Active</p>
                  <p className="text-xs text-muted">Allow this member to access the organization</p>
                </div>
                <button
                  onClick={() => setEditActive((v) => !v)}
                  className={cn("relative w-10 h-5 transition-colors", editActive ? "bg-primary-600" : "bg-stroke")}
                  role="switch"
                  aria-checked={editActive}
                  type="button"
                >
                  <span className={cn("absolute top-0.5 w-4 h-4 bg-white transition-transform", editActive ? "translate-x-5" : "translate-x-0.5")} />
                </button>
              </div>
              <div className="flex gap-3 justify-end pt-2">
                <Button variant="outline" onClick={() => setEditMember(null)}>Cancel</Button>
                <Button loading={savingEdit} onClick={handleSaveEdit}>Save</Button>
              </div>
            </div>
          </Modal>
        </div>
      )}

      {/* Notifications */}
      {tab === "notifications" && (
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
                { label: "Low stock alerts",         desc: "Get notified when items fall below reorder point",  defaultVal: true  },
                { label: "New order notifications",  desc: "Receive notifications for incoming orders",         defaultVal: true  },
                { label: "Weekly summary",           desc: "Weekly digest of sales and inventory changes",      defaultVal: false },
                { label: "System updates",           desc: "Important updates about the platform",              defaultVal: true  },
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
      )}

      {/* Security */}
      {tab === "security" && (
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
      )}
    </div>
  );
}
