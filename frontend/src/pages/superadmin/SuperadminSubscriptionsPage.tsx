import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { superadminApi } from "../../api/superadminClient";
import { Button } from "../../components/ui/Button";
import { Modal } from "../../components/ui/Modal";
import { Select } from "../../components/ui/Select";
import { Badge } from "../../components/ui/Badge";
import { useToast } from "../../hooks/useToast";
import type { SuperadminTenantRow } from "../../types";
import { Search, Edit2 } from "lucide-react";
import { formatDate } from "../../lib/utils";

interface SubscriptionRow {
  id: string;
  tenantId: string;
  planKey: string;
  status: string;
  currentPeriodEnd?: string;
  createdAt: string;
  tenantName: string;
  tenantSlug: string;
  isActive: boolean;
  plan: string;
}

export default function SuperadminSubscriptionsPage() {
  const toast = useToast();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [editTenant, setEditTenant] = useState<SubscriptionRow | null>(null);
  const [newPlan, setNewPlan] = useState("free");
  const [newStatus, setNewStatus] = useState<string>("active");

  // Use tenants list + subscription data from tenant detail
  const { data, isLoading } = useQuery<{ tenants: SuperadminTenantRow[]; total: number }>({
    queryKey: ["superadmin-tenants-subs", search, page],
    queryFn: () =>
      superadminApi
        .get("/api/superadmin/tenants", { params: { search, page, perPage: 25 } })
        .then((r) => r.data),
  });

  const overrideMut = useMutation({
    mutationFn: ({
      tenantId,
      planKey,
      status,
    }: {
      tenantId: string;
      planKey: string;
      status: string;
    }) =>
      superadminApi.patch(`/api/superadmin/tenants/${tenantId}/subscription`, {
        planKey,
        status,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["superadmin-tenants-subs"] });
      toast.success("Subscription updated");
      setEditTenant(null);
    },
    onError: () => toast.error("Failed to update subscription"),
  });

  const planBadgeClass = (plan: string) => {
    if (plan === "enterprise") return "bg-purple-100 text-purple-700";
    if (plan === "pro") return "bg-blue-100 text-blue-700";
    return "bg-gray-100 text-gray-600";
  };

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-lg font-bold text-ink">Subscriptions</h1>
        <p className="text-sm text-muted mt-0.5">Manage tenant subscriptions and plans</p>
      </div>

      <div className="relative max-w-xs">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted" />
        <input
          className="w-full pl-9 pr-3 py-2 text-sm bg-panel border border-stroke text-ink outline-none focus:border-primary-500"
          placeholder="Search tenants…"
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
        />
      </div>

      {isLoading ? (
        <p className="text-sm text-muted">Loading…</p>
      ) : (
        <>
          <div className="bg-panel border border-stroke overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-stroke">
                  <th className="px-4 py-3 text-left text-xs font-semibold text-muted">Tenant</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-muted">Plan</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-muted">Status</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-muted">Since</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {(data?.tenants ?? []).map((t) => (
                  <tr key={t.id} className="border-b border-stroke last:border-0 hover:bg-hover transition-colors">
                    <td className="px-4 py-3">
                      <p className="font-medium text-ink">{t.name}</p>
                      <p className="text-xs text-muted">{t.slug}</p>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs font-semibold px-2 py-0.5 ${planBadgeClass(t.plan)}`}>
                        {t.plan}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant={t.isActive ? "success" : "danger"}>
                        {t.isActive ? "active" : "suspended"}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-xs text-muted">{formatDate(t.createdAt)}</td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => {
                          setEditTenant({ ...t, tenantId: t.id, tenantName: t.name, tenantSlug: t.slug, status: t.isActive ? "active" : "suspended", planKey: t.plan });
                          setNewPlan(t.plan);
                          setNewStatus("active");
                        }}
                        className="p-1.5 text-muted hover:text-ink hover:bg-hover transition-colors"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {(data?.total ?? 0) > 25 && (
            <div className="flex justify-end gap-2">
              <Button size="sm" variant="secondary" disabled={page === 1} onClick={() => setPage((p) => p - 1)}>
                Previous
              </Button>
              <Button
                size="sm"
                variant="secondary"
                disabled={(page * 25) >= (data?.total ?? 0)}
                onClick={() => setPage((p) => p + 1)}
              >
                Next
              </Button>
            </div>
          )}
        </>
      )}

      <Modal
        open={!!editTenant}
        onClose={() => setEditTenant(null)}
        title={`Edit Subscription — ${editTenant?.tenantName}`}
        size="sm"
      >
        <div className="flex flex-col gap-4">
          <Select
            label="Plan"
            value={newPlan}
            onChange={(e) => setNewPlan(e.target.value)}
          >
            <option value="free">Free</option>
            <option value="pro">Pro</option>
            <option value="enterprise">Enterprise</option>
          </Select>

          <Select
            label="Status"
            value={newStatus}
            onChange={(e) => setNewStatus(e.target.value)}
          >
            <option value="active">Active</option>
            <option value="trialing">Trialing</option>
            <option value="overdue">Overdue</option>
            <option value="paused">Paused</option>
            <option value="canceled">Canceled</option>
          </Select>

          <div className="flex justify-end gap-2 pt-1">
            <Button variant="secondary" size="sm" onClick={() => setEditTenant(null)}>
              Cancel
            </Button>
            <Button
              size="sm"
              loading={overrideMut.isPending}
              onClick={() =>
                editTenant &&
                overrideMut.mutate({
                  tenantId: editTenant.tenantId,
                  planKey: newPlan,
                  status: newStatus,
                })
              }
            >
              Save Changes
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
