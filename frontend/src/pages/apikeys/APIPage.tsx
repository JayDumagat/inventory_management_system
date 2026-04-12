import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { api } from "../../api/client";
import { useTenantStore } from "../../stores/tenantStore";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { Modal } from "../../components/ui/Modal";
import { Badge } from "../../components/ui/Badge";
import { PageLoader } from "../../components/ui/Spinner";
import { formatDate } from "../../lib/utils";
import {
  Code, Plus, Trash2, Eye, EyeOff, Copy, CheckCircle, AlertCircle,
  Key, BookOpen, Terminal, Webhook,
} from "lucide-react";

interface ApiKey {
  id: string;
  name: string;
  keyPrefix: string;
  isActive: boolean;
  expiresAt?: string | null;
  lastUsedAt?: string | null;
  createdAt: string;
  createdByEmail?: string;
}

const createSchema = z.object({
  name: z.string().min(1, "Name is required"),
  expiresAt: z.string().optional(),
});
type CreateForm = z.infer<typeof createSchema>;

export default function APIPage() {
  const { currentTenant } = useTenantStore();
  const qc = useQueryClient();
  const tid = currentTenant?.id;
  const myRole = currentTenant?.role || "staff";
  const canManage = ["owner", "admin"].includes(myRole);

  const [createModal, setCreateModal] = useState(false);
  const [newRawKey, setNewRawKey] = useState<string | null>(null);
  const [showKey, setShowKey] = useState(false);
  const [copied, setCopied] = useState(false);
  const [revokeConfirm, setRevokeConfirm] = useState<ApiKey | null>(null);

  const form = useForm<CreateForm>({ resolver: zodResolver(createSchema) });

  const { data: keys = [], isLoading } = useQuery<ApiKey[]>({
    queryKey: ["api-keys", tid],
    queryFn: () => api.get(`/api/tenants/${tid}/api-keys`).then((r) => r.data),
    enabled: !!tid && canManage,
  });

  const create = useMutation({
    mutationFn: (data: CreateForm) => api.post(`/api/tenants/${tid}/api-keys`, data),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ["api-keys", tid] });
      setNewRawKey(res.data.rawKey);
      setCreateModal(false);
      form.reset();
    },
  });

  const revoke = useMutation({
    mutationFn: (id: string) => api.delete(`/api/tenants/${tid}/api-keys/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["api-keys", tid] }); setRevokeConfirm(null); },
  });

  const copyKey = () => {
    if (!newRawKey) return;
    navigator.clipboard.writeText(newRawKey);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const baseUrl = import.meta.env.VITE_API_URL || "http://localhost:3001";

  if (isLoading) return <PageLoader />;

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold text-ink">API</h1>
        <p className="text-muted text-sm mt-1">Manage API keys and access developer documentation</p>
      </div>

      {!canManage && (
        <div className="bg-yellow-50 border border-yellow-200 px-4 py-3 text-sm text-yellow-800">
          Only admins and owners can manage API keys.
        </div>
      )}

      {/* API Keys section */}
      {canManage && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Key className="w-4 h-4 text-muted" />
              <h2 className="text-sm font-semibold text-ink">API Keys</h2>
            </div>
            <Button size="sm" onClick={() => setCreateModal(true)} className="gap-2">
              <Plus className="w-3.5 h-3.5" /> Generate key
            </Button>
          </div>

          {keys.length === 0 ? (
            <div className="bg-panel border border-stroke">
              <div className="flex flex-col items-center justify-center py-12 px-6 text-center">
                <Key className="w-8 h-8 text-muted mb-3" />
                <p className="text-sm font-medium text-ink mb-1">No API keys yet</p>
                <p className="text-sm text-muted max-w-xs mb-4">Generate an API key to authenticate requests from your applications</p>
                <Button size="sm" onClick={() => setCreateModal(true)} className="gap-2">
                  <Plus className="w-3.5 h-3.5" /> Generate first key
                </Button>
              </div>
            </div>
          ) : (
            <div className="bg-panel border border-stroke overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-stroke text-left">
                    <th className="px-5 py-3 text-xs font-semibold text-muted uppercase tracking-wider">Name</th>
                    <th className="px-5 py-3 text-xs font-semibold text-muted uppercase tracking-wider">Key prefix</th>
                    <th className="px-5 py-3 text-xs font-semibold text-muted uppercase tracking-wider">Status</th>
                    <th className="px-5 py-3 text-xs font-semibold text-muted uppercase tracking-wider hidden md:table-cell">Created</th>
                    <th className="px-5 py-3 text-xs font-semibold text-muted uppercase tracking-wider hidden lg:table-cell">Last used</th>
                    <th className="px-5 py-3 text-xs font-semibold text-muted uppercase tracking-wider hidden lg:table-cell">Expires</th>
                    <th className="px-5 py-3" />
                  </tr>
                </thead>
                <tbody>
                  {keys.map((k) => (
                    <tr key={k.id} className="border-b border-stroke hover:bg-hover transition-colors">
                      <td className="px-5 py-3 font-medium text-ink">{k.name}</td>
                      <td className="px-5 py-3 font-mono text-xs text-muted">{k.keyPrefix}…</td>
                      <td className="px-5 py-3">
                        <Badge variant={k.isActive ? "success" : "default"}>{k.isActive ? "Active" : "Revoked"}</Badge>
                      </td>
                      <td className="px-5 py-3 text-muted hidden md:table-cell">{formatDate(k.createdAt)}</td>
                      <td className="px-5 py-3 text-muted hidden lg:table-cell">{k.lastUsedAt ? formatDate(k.lastUsedAt) : "Never"}</td>
                      <td className="px-5 py-3 text-muted hidden lg:table-cell">{k.expiresAt ? formatDate(k.expiresAt) : "Never"}</td>
                      <td className="px-5 py-3">
                        {k.isActive && (
                          <Button variant="ghost" size="sm" onClick={() => setRevokeConfirm(k)}>
                            <Trash2 className="w-4 h-4 text-red-400" />
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* API Overview */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <BookOpen className="w-4 h-4 text-muted" />
          <h2 className="text-sm font-semibold text-ink">API Overview</h2>
        </div>

        <div className="bg-panel border border-stroke p-4 space-y-3">
          <div>
            <p className="text-sm font-medium text-ink mb-1">Base URL</p>
            <code className="block bg-page border border-stroke px-3 py-2 text-xs font-mono text-ink">{baseUrl}</code>
          </div>
          <div>
            <p className="text-sm font-medium text-ink mb-1">Authentication</p>
            <p className="text-xs text-muted">Include your API key or Bearer token in the <code className="bg-page border border-stroke px-1 py-0.5 text-xs font-mono">Authorization</code> header:</p>
            <code className="block bg-page border border-stroke px-3 py-2 text-xs font-mono text-ink mt-1">Authorization: Bearer &lt;your-api-key&gt;</code>
          </div>
        </div>
      </div>

      {/* Example endpoints */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Terminal className="w-4 h-4 text-muted" />
          <h2 className="text-sm font-semibold text-ink">Key Endpoints</h2>
        </div>

        <div className="bg-panel border border-stroke divide-y divide-stroke">
          {[
            { method: "GET",    path: `/api/tenants/${tid ?? ":tenantId"}/products`,       desc: "List all products" },
            { method: "GET",    path: `/api/tenants/${tid ?? ":tenantId"}/inventory`,      desc: "Get inventory levels" },
            { method: "GET",    path: `/api/tenants/${tid ?? ":tenantId"}/sales-orders`,   desc: "List sales orders" },
            { method: "POST",   path: `/api/tenants/${tid ?? ":tenantId"}/sales-orders`,   desc: "Create a sales order" },
            { method: "GET",    path: `/api/tenants/${tid ?? ":tenantId"}/customers`,      desc: "List customers" },
            { method: "GET",    path: `/api/tenants/${tid ?? ":tenantId"}/suppliers`,      desc: "List suppliers" },
            { method: "GET",    path: `/api/tenants/${tid ?? ":tenantId"}/purchase-orders`,desc: "List purchase orders" },
            { method: "GET",    path: `/api/tenants/${tid ?? ":tenantId"}/transactions`,   desc: "List transactions" },
            { method: "GET",    path: `/api/tenants/${tid ?? ":tenantId"}/reports/sales`,  desc: "Sales reports" },
          ].map(({ method, path, desc }) => (
            <div key={path} className="flex items-center gap-3 px-4 py-2.5">
              <span className={`text-xs font-bold font-mono w-12 flex-shrink-0 ${
                method === "GET" ? "text-blue-600" : method === "POST" ? "text-green-600" : "text-orange-600"
              }`}>{method}</span>
              <code className="text-xs font-mono text-muted flex-1 truncate">{path}</code>
              <span className="text-xs text-muted hidden md:block flex-shrink-0">{desc}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Webhooks info */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Webhook className="w-4 h-4 text-muted" />
          <h2 className="text-sm font-semibold text-ink">Webhooks</h2>
        </div>
        <div className="bg-panel border border-stroke p-4">
          <p className="text-sm text-muted mb-3">
            Configure webhook endpoints in the <strong className="text-ink">Integrations</strong> page to receive real-time event notifications.
          </p>
          <p className="text-xs text-muted font-medium mb-2">Available events:</p>
          <div className="grid grid-cols-2 gap-1">
            {[
              "order.created", "order.updated", "order.delivered",
              "inventory.low_stock", "inventory.transfer",
              "product.created", "product.updated",
              "purchase_order.received",
            ].map((e) => (
              <code key={e} className="text-xs bg-page border border-stroke px-2 py-1 font-mono text-muted">{e}</code>
            ))}
          </div>
        </div>
      </div>

      {/* Create API key modal */}
      <Modal open={createModal} onClose={() => { setCreateModal(false); form.reset(); }} title="Generate API key" size="sm">
        <form onSubmit={form.handleSubmit((d) => create.mutate(d))} className="flex flex-col gap-4">
          {create.isError && (
            <div className="p-3 bg-red-50 border border-red-200 text-sm text-red-700">
              {(create.error as { response?: { data?: { error?: string } } })?.response?.data?.error || "Failed to create API key"}
            </div>
          )}
          <Input label="Key name *" placeholder="e.g. Production, Mobile App" {...form.register("name")} error={form.formState.errors.name?.message} />
          <Input label="Expires at (optional)" type="datetime-local" {...form.register("expiresAt")} />
          <p className="text-xs text-muted">
            The raw key will only be shown once after creation. Store it securely.
          </p>
          <div className="flex gap-3 justify-end pt-2">
            <Button type="button" variant="outline" onClick={() => { setCreateModal(false); form.reset(); }}>Cancel</Button>
            <Button type="submit" loading={create.isPending} className="gap-2">
              <Key className="w-3.5 h-3.5" /> Generate
            </Button>
          </div>
        </form>
      </Modal>

      {/* New key reveal modal */}
      {newRawKey && (
        <Modal open={!!newRawKey} onClose={() => { setNewRawKey(null); setShowKey(false); }} title="API key generated" size="sm">
          <div className="flex flex-col gap-4">
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 bg-green-50 border border-green-200 flex items-center justify-center flex-shrink-0">
                <CheckCircle className="w-5 h-5 text-green-500" />
              </div>
              <div>
                <p className="text-sm font-medium text-ink">Your API key has been created</p>
                <p className="text-xs text-muted mt-0.5">Copy and store it securely. It will not be shown again.</p>
              </div>
            </div>
            <div className="relative">
              <code className="block bg-page border border-stroke px-3 py-2 pr-20 text-xs font-mono text-ink break-all">
                {showKey ? newRawKey : newRawKey.replace(/./g, "•")}
              </code>
              <div className="absolute right-2 top-2 flex items-center gap-1">
                <button onClick={() => setShowKey((v) => !v)} className="p-1 text-muted hover:text-ink transition-colors">
                  {showKey ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                </button>
                <button onClick={copyKey} className="p-1 text-muted hover:text-ink transition-colors">
                  {copied ? <CheckCircle className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>
            <div className="flex gap-3 justify-end pt-2">
              <Button onClick={() => { setNewRawKey(null); setShowKey(false); }}>Done</Button>
            </div>
          </div>
        </Modal>
      )}

      {/* Revoke confirmation */}
      <Modal open={!!revokeConfirm} onClose={() => setRevokeConfirm(null)} title="Revoke API key" size="sm">
        <div className="flex flex-col gap-4">
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 bg-red-50 border border-red-200 flex items-center justify-center flex-shrink-0">
              <AlertCircle className="w-5 h-5 text-red-500" />
            </div>
            <div>
              <p className="text-sm font-medium text-ink">Revoke &ldquo;{revokeConfirm?.name}&rdquo;?</p>
              <p className="text-sm text-muted mt-1">
                Any application using this key will immediately lose access. This cannot be undone.
              </p>
            </div>
          </div>
          <div className="flex gap-3 justify-end">
            <Button variant="outline" onClick={() => setRevokeConfirm(null)}>Cancel</Button>
            <Button variant="danger" loading={revoke.isPending} onClick={() => revokeConfirm && revoke.mutate(revokeConfirm.id)}>Revoke</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
