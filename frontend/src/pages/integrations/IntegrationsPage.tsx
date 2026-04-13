import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { api } from "../../api/client";
import { useTenantStore } from "../../stores/tenantStore";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { Modal } from "../../components/ui/Modal";
import { Badge } from "../../components/ui/Badge";
import { SkeletonCard } from "../../components/ui/Skeleton";
import { useToast } from "../../hooks/useToast";
import { Link2, Link2Off, Settings, Plug } from "lucide-react";
import { cn } from "../../lib/utils";

interface Integration {
  id: string | null;
  provider: string;
  isEnabled: boolean;
  webhookUrl?: string | null;
  config?: Record<string, unknown>;
}

const PROVIDER_META: Record<string, { label: string; description: string; category: string; color: string }> = {
  shopify:     { label: "Shopify",      description: "Sync orders and products with your Shopify store",         category: "E-commerce",  color: "bg-green-50 border-green-200" },
  woocommerce: { label: "WooCommerce",  description: "Connect your WooCommerce store for product and order sync",category: "E-commerce",  color: "bg-violet-50 border-violet-200" },
  quickbooks:  { label: "QuickBooks",   description: "Export transactions and invoices to QuickBooks",           category: "Accounting",  color: "bg-blue-50 border-blue-200" },
  xero:        { label: "Xero",         description: "Sync financial data with your Xero account",              category: "Accounting",  color: "bg-cyan-50 border-cyan-200" },
  stripe:      { label: "Stripe",       description: "Accept payments and sync transactions via Stripe",         category: "Payments",    color: "bg-indigo-50 border-indigo-200" },
  paypal:      { label: "PayPal",       description: "Accept PayPal payments and sync transaction records",      category: "Payments",    color: "bg-yellow-50 border-yellow-200" },
  mailchimp:   { label: "Mailchimp",    description: "Sync customer lists and trigger email campaigns",          category: "Marketing",   color: "bg-yellow-50 border-yellow-200" },
  slack:       { label: "Slack",        description: "Receive notifications about orders and low stock in Slack",category: "Notifications",color: "bg-pink-50 border-pink-200" },
  zapier:      { label: "Zapier",       description: "Automate workflows by connecting to thousands of apps via Zapier",category: "Automation", color: "bg-orange-50 border-orange-200" },
  webhook:     { label: "Webhook",      description: "Send real-time event data to any URL via HTTP webhook",    category: "Developer",   color: "bg-gray-50 border-gray-200" },
  minio:       { label: "MinIO",        description: "Store and serve files (images, documents) via MinIO object storage", category: "Storage", color: "bg-red-50 border-red-200" },
  redis:       { label: "Redis",        description: "High-performance in-memory caching for faster API responses", category: "Infrastructure", color: "bg-rose-50 border-rose-200" },
};

const configSchema = z.object({
  webhookUrl: z.string().url("Must be a valid URL").optional().or(z.literal("")),
  apiKey: z.string().optional(),
  storeName: z.string().optional(),
  endpoint: z.string().optional(),
  port: z.string().optional(),
  bucket: z.string().optional(),
  useSSL: z.boolean().optional(),
  connectionUrl: z.string().optional(),
});
type ConfigForm = z.infer<typeof configSchema>;

export default function IntegrationsPage() {
  const { currentTenant } = useTenantStore();
  const qc = useQueryClient();
  const tid = currentTenant?.id;
  const myRole = currentTenant?.role || "staff";
  const canManage = ["owner", "admin"].includes(myRole);
  const toast = useToast();

  const [configModal, setConfigModal] = useState<Integration | null>(null);

  const form = useForm<ConfigForm>({ resolver: zodResolver(configSchema) });

  const { data: integrations = [], isLoading } = useQuery<Integration[]>({
    queryKey: ["integrations", tid],
    queryFn: () => api.get(`/api/tenants/${tid}/integrations`).then((r) => r.data),
    enabled: !!tid,
  });

  const update = useMutation({
    mutationFn: ({ provider, data }: { provider: string; data: Partial<Integration> & { apiKey?: string; storeName?: string } }) =>
      api.put(`/api/tenants/${tid}/integrations/${provider}`, data),
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: ["integrations", tid] });
      setConfigModal(null);
      form.reset();
      const label = PROVIDER_META[variables.provider]?.label ?? variables.provider;
      const enabling = variables.data.isEnabled;
      if (enabling !== undefined) {
        toast.success(enabling ? `${label} connected` : `${label} disconnected`);
      } else {
        toast.success(`${label} configuration saved`);
      }
    },
    onError: () => toast.error("Failed to update integration"),
  });

  const toggle = (integration: Integration) => {
    if (!canManage) return;
    update.mutate({ provider: integration.provider, data: { isEnabled: !integration.isEnabled } });
  };

  const openConfig = (integration: Integration) => {
    form.reset({
      webhookUrl: integration.webhookUrl || "",
      apiKey: (integration.config?.apiKey as string) || "",
      storeName: (integration.config?.storeName as string) || "",
      endpoint: (integration.config?.endpoint as string) || "",
      port: (integration.config?.port as string) || "",
      bucket: (integration.config?.bucket as string) || "",
      useSSL: (integration.config?.useSSL as boolean) || false,
      connectionUrl: (integration.config?.connectionUrl as string) || "",
    });
    setConfigModal(integration);
  };

  const saveConfig = (data: ConfigForm) => {
    if (!configModal) return;
    update.mutate({
      provider: configModal.provider,
      data: {
        webhookUrl: data.webhookUrl || undefined,
        config: {
          ...(configModal.config ?? {}),
          apiKey: data.apiKey || undefined,
          storeName: data.storeName || undefined,
          endpoint: data.endpoint || undefined,
          port: data.port || undefined,
          bucket: data.bucket || undefined,
          useSSL: data.useSSL,
          connectionUrl: data.connectionUrl || undefined,
        },
      },
    });
  };

  const grouped = Object.entries(
    integrations.reduce<Record<string, Integration[]>>((acc, i) => {
      const cat = PROVIDER_META[i.provider]?.category ?? "Other";
      if (!acc[cat]) acc[cat] = [];
      acc[cat].push(i);
      return acc;
    }, {})
  );

  if (isLoading) return (
    <div className="space-y-6">
      <div>
        <SkeletonCard className="h-6 w-40 mb-1" />
        <SkeletonCard className="h-4 w-64" />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} />)}
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-ink">Integrations</h1>
        <p className="text-muted text-sm mt-1">Connect your account with third-party tools and services</p>
      </div>

      {!canManage && (
        <div className="bg-yellow-50 border border-yellow-200 px-4 py-3 text-sm text-yellow-800">
          Only admins and owners can enable or configure integrations.
        </div>
      )}

      <div className="space-y-6">
        {grouped.map(([category, items]) => (
          <div key={category}>
            <h2 className="text-xs font-semibold text-muted uppercase tracking-wider mb-3">{category}</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {items.map((integration) => {
                const meta = PROVIDER_META[integration.provider];
                return (
                  <div
                    key={integration.provider}
                    className={cn(
                      "flex items-start gap-4 p-4 border",
                      integration.isEnabled ? meta?.color ?? "bg-primary-50 border-primary-200" : "bg-panel border-stroke"
                    )}
                  >
                    <div className={cn(
                      "w-10 h-10 flex items-center justify-center flex-shrink-0 border",
                      integration.isEnabled ? "bg-white border-current" : "bg-page border-stroke"
                    )}>
                      <Plug className={cn("w-5 h-5", integration.isEnabled ? "text-primary-600" : "text-muted")} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <p className="text-sm font-semibold text-ink">{meta?.label ?? integration.provider}</p>
                        {integration.isEnabled && <Badge variant="success">Connected</Badge>}
                      </div>
                      <p className="text-xs text-muted leading-relaxed">{meta?.description}</p>
                    </div>
                    {canManage && (
                      <div className="flex flex-col gap-1.5 flex-shrink-0">
                        <Button
                          size="sm"
                          variant={integration.isEnabled ? "danger" : "outline"}
                          onClick={() => toggle(integration)}
                          loading={update.isPending && update.variables?.provider === integration.provider}
                          className="gap-1.5"
                        >
                          {integration.isEnabled ? (
                            <><Link2Off className="w-3.5 h-3.5" /> Disconnect</>
                          ) : (
                            <><Link2 className="w-3.5 h-3.5" /> Connect</>
                          )}
                        </Button>
                        {integration.isEnabled && (
                          <Button size="sm" variant="ghost" onClick={() => openConfig(integration)} className="gap-1.5">
                            <Settings className="w-3.5 h-3.5" /> Configure
                          </Button>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Config modal */}
      <Modal
        open={!!configModal}
        onClose={() => { setConfigModal(null); form.reset(); }}
        title={`Configure ${PROVIDER_META[configModal?.provider ?? ""]?.label ?? configModal?.provider}`}
        size="sm"
      >
        <form onSubmit={form.handleSubmit(saveConfig)} className="flex flex-col gap-4">
          {update.isError && (
            <div className="p-3 bg-red-50 border border-red-200 text-sm text-red-700">
              {(update.error as { response?: { data?: { error?: string } } })?.response?.data?.error || "Save failed"}
            </div>
          )}

          {/* MinIO-specific fields */}
          {configModal?.provider === "minio" ? (
            <>
              <Input
                label="MinIO Endpoint"
                placeholder="localhost or minio.example.com"
                {...form.register("endpoint")}
              />
              <Input
                label="Port"
                placeholder="9000"
                {...form.register("port")}
              />
              <Input
                label="Access Key"
                placeholder="minioadmin"
                {...form.register("apiKey")}
              />
              <Input
                label="Secret Key"
                type="password"
                placeholder="minioadmin123"
                {...form.register("storeName")}
              />
              <Input
                label="Bucket Name"
                placeholder="inventory-files"
                {...form.register("bucket")}
              />
            </>
          ) : configModal?.provider === "redis" ? (
            <>
              <Input
                label="Redis Connection URL"
                placeholder="redis://localhost:6379"
                {...form.register("connectionUrl")}
              />
            </>
          ) : (
            <>
              <Input
                label="Webhook URL"
                placeholder="https://your-app.com/webhook"
                {...form.register("webhookUrl")}
                error={form.formState.errors.webhookUrl?.message}
              />
              <Input
                label="API Key / Secret"
                type="password"
                placeholder="sk_live_…"
                {...form.register("apiKey")}
              />
              {["shopify", "woocommerce"].includes(configModal?.provider ?? "") && (
                <Input
                  label="Store name / URL"
                  placeholder="mystore.myshopify.com"
                  {...form.register("storeName")}
                />
              )}
            </>
          )}

          <p className="text-xs text-muted">
            API keys and secrets are stored securely and are only used to communicate with the external service.
          </p>
          <div className="flex gap-3 justify-end pt-2">
            <Button type="button" variant="outline" onClick={() => { setConfigModal(null); form.reset(); }}>Cancel</Button>
            <Button type="submit" loading={update.isPending}>Save configuration</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
