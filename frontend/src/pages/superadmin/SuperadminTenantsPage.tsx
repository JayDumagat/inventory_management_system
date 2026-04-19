import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { superadminApi } from "../../api/superadminClient";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { Badge } from "../../components/ui/Badge";
import { useToast } from "../../hooks/useToast";
import type { SuperadminTenantRow, SuperadminTenantDetail } from "../../types";
import { Search, Eye, ChevronLeft } from "lucide-react";
import { formatDate } from "../../lib/utils";

export default function SuperadminTenantsPage() {
  const toast = useToast();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const { data, isLoading } = useQuery<{ tenants: SuperadminTenantRow[]; total: number; page: number }>({
    queryKey: ["superadmin-tenants", search, page],
    queryFn: () =>
      superadminApi
        .get("/api/superadmin/tenants", { params: { search, page, perPage: 25 } })
        .then((r) => r.data),
  });

  const { data: detail, isLoading: detailLoading } = useQuery<SuperadminTenantDetail>({
    queryKey: ["superadmin-tenant-detail", selectedId],
    queryFn: () =>
      superadminApi.get(`/api/superadmin/tenants/${selectedId}`).then((r) => r.data),
    enabled: !!selectedId,
  });

  const toggleMut = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      superadminApi.patch(`/api/superadmin/tenants/${id}/status`, { isActive }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["superadmin-tenants"] });
      qc.invalidateQueries({ queryKey: ["superadmin-tenant-detail", selectedId] });
      toast.success("Tenant status updated");
    },
    onError: () => toast.error("Failed to update tenant status"),
  });

  const planBadgeClass = (plan: string) => {
    if (plan === "enterprise") return "bg-purple-100 text-purple-700";
    if (plan === "pro") return "bg-blue-100 text-blue-700";
    return "bg-gray-100 text-gray-600";
  };

  if (selectedId) {
    return (
      <div className="space-y-5">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setSelectedId(null)}
            className="p-1.5 text-muted hover:bg-hover transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <h1 className="text-lg font-bold text-ink">Tenant Detail</h1>
        </div>

        {detailLoading ? (
          <p className="text-sm text-muted">Loading…</p>
        ) : detail ? (
          <div className="space-y-4">
            <div className="bg-panel border border-stroke p-5 space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-base font-semibold text-ink">{detail.tenant.name}</p>
                  <p className="text-sm text-muted">{detail.tenant.slug}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`text-xs font-semibold px-2 py-0.5 ${planBadgeClass(detail.tenant.plan)}`}>
                    {detail.tenant.plan}
                  </span>
                  <Badge variant={detail.tenant.isActive ? "success" : "danger"}>
                    {detail.tenant.isActive ? "Active" : "Suspended"}
                  </Badge>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4 pt-2 border-t border-stroke">
                <div>
                  <p className="text-xs text-muted">Members</p>
                  <p className="text-sm font-semibold text-ink">{detail.memberCount}</p>
                </div>
                <div>
                  <p className="text-xs text-muted">Subscription</p>
                  <p className="text-sm font-semibold text-ink capitalize">
                    {detail.subscription?.status ?? "none"}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted">Created</p>
                  <p className="text-sm font-semibold text-ink">
                    {formatDate(detail.tenant.createdAt)}
                  </p>
                </div>
              </div>

              <div className="pt-2 border-t border-stroke flex gap-2">
                <Button
                  size="sm"
                  variant={detail.tenant.isActive ? "danger" : "primary"}
                  loading={toggleMut.isPending}
                  onClick={() =>
                    toggleMut.mutate({ id: detail.tenant.id, isActive: !detail.tenant.isActive })
                  }
                >
                  {detail.tenant.isActive ? "Suspend Tenant" : "Reactivate Tenant"}
                </Button>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-bold text-ink">Tenants</h1>
          <p className="text-sm text-muted mt-0.5">All registered organizations</p>
        </div>
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
          <div className="bg-panel border border-stroke overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-stroke">
                  <th className="px-4 py-3 text-left text-xs font-semibold text-muted">Name</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-muted">Plan</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-muted">Status</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-muted">Created</th>
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
                        {t.isActive ? "Active" : "Suspended"}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-xs text-muted">{formatDate(t.createdAt)}</td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => setSelectedId(t.id)}
                        className="p-1.5 text-muted hover:text-ink hover:bg-hover transition-colors"
                      >
                        <Eye className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {(data?.total ?? 0) > 25 && (
            <div className="flex items-center justify-between text-sm text-muted">
              <span>{data?.total} total</span>
              <div className="flex gap-2">
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
            </div>
          )}
        </>
      )}
    </div>
  );
}
