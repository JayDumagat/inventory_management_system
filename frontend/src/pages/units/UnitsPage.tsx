import { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { api } from "../../api/client";
import { useTenantStore } from "../../stores/tenantStore";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { Card, CardContent } from "../../components/ui/Card";
import { Modal } from "../../components/ui/Modal";
import { Pagination } from "../../components/ui/Pagination";
import { Skeleton, SkeletonTable } from "../../components/ui/Skeleton";
import { Plus, Pencil, Trash2, Ruler, Search, AlertCircle } from "lucide-react";
import { useToast } from "../../hooks/useToast";

interface Unit { id: string; name: string; abbreviation: string; createdAt: string; }

const unitSchema = z.object({
  name: z.string().min(1, "Name is required"),
  abbreviation: z.string().min(1, "Abbreviation is required"),
});
type UnitForm = z.infer<typeof unitSchema>;

export default function UnitsPage() {
  const PAGE_SIZE = 10;
  const { currentTenant } = useTenantStore();
  const qc = useQueryClient();
  const tid = currentTenant?.id;
  const myRole = currentTenant?.role || "staff";
  const canManage = ["owner", "admin", "manager"].includes(myRole);
  const toast = useToast();

  const [modal, setModal] = useState<{ open: boolean; unit?: Unit }>({ open: false });
  const [pendingDelete, setPendingDelete] = useState<Unit | null>(null);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  const { data: units = [], isLoading } = useQuery<Unit[]>({
    queryKey: ["units", tid],
    queryFn: () => api.get(`/api/tenants/${tid}/units`).then((r) => r.data),
    enabled: !!tid,
  });

  const form = useForm<UnitForm>({ resolver: zodResolver(unitSchema) });

  const save = useMutation({
    mutationFn: (data: UnitForm) =>
      modal.unit
        ? api.patch(`/api/tenants/${tid}/units/${modal.unit.id}`, data)
        : api.post(`/api/tenants/${tid}/units`, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["units", tid] });
      setModal({ open: false });
      form.reset();
      toast.success("Unit saved");
    },
    onError: () => toast.error("Failed to save unit"),
  });

  const doDelete = useMutation({
    mutationFn: (id: string) => api.delete(`/api/tenants/${tid}/units/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["units", tid] });
      setPendingDelete(null);
      toast.success("Unit deleted");
    },
    onError: () => toast.error("Failed to delete unit"),
  });

  const openEdit = (unit: Unit) => {
    setModal({ open: true, unit });
    form.reset({ name: unit.name, abbreviation: unit.abbreviation });
  };

  const openCreate = () => {
    setModal({ open: true });
    form.reset({ name: "", abbreviation: "" });
  };

  const filtered = useMemo(
    () => units.filter((u) =>
      u.name.toLowerCase().includes(search.toLowerCase()) ||
      u.abbreviation.toLowerCase().includes(search.toLowerCase())
    ),
    [units, search]
  );
  const pagedFiltered = useMemo(
    () => filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE),
    [filtered, page]
  );
  useEffect(() => { setPage(1); }, [search]);
  useEffect(() => {
    const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
    if (page > totalPages) setPage(totalPages);
  }, [filtered.length, page, PAGE_SIZE]);

  if (isLoading) return (
  <div className="space-y-4">
    <div className="flex items-center justify-between">
      <Skeleton className="h-7 w-32" />
      <Skeleton className="h-9 w-32" />
    </div>
    <div className="border border-stroke">
      <table className="w-full"><SkeletonTable rows={6} cols={4} /></table>
    </div>
  </div>
);

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-ink">Units of Measurement</h1>
          <p className="text-muted text-sm mt-1">Define units used across products (e.g. kg, pcs, litre)</p>
        </div>
        {canManage && (
          <Button onClick={openCreate} className="gap-2 self-start sm:self-auto">
            <Plus className="w-4 h-4" /> Add unit
          </Button>
        )}
      </div>

      <Card>
        {units.length === 0 ? (
          <CardContent className="p-0">
            <div className="flex flex-col items-center justify-center py-20 px-6 text-center">
              <div className="w-14 h-14 bg-primary-50 border border-primary-200 flex items-center justify-center mb-5">
                <Ruler className="w-7 h-7 text-primary-500" />
              </div>
              <h3 className="text-base font-semibold text-ink mb-1">No units yet</h3>
              <p className="text-sm text-muted max-w-xs mb-6">Create units of measurement to assign to your products</p>
              {canManage && <Button onClick={openCreate}>Add your first unit</Button>}
            </div>
          </CardContent>
        ) : (
          <div className="space-y-3 p-3 sm:p-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted pointer-events-none" />
              <input
                type="text"
                placeholder="Search units by name or abbreviation…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-9 pr-4 py-2 text-sm border border-stroke bg-panel text-ink placeholder:text-muted focus:outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500/20"
              />
            </div>
            {filtered.length === 0 ? (
              <div className="py-10 text-center">
                <AlertCircle className="w-8 h-8 text-muted mx-auto mb-2" />
                <p className="text-sm font-medium text-ink mb-1">No results found</p>
                <p className="text-sm text-muted">No units match &ldquo;{search}&rdquo;</p>
              </div>
            ) : (
              <>
                <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-stroke text-left">
                  <th className="px-6 py-3 text-xs font-semibold text-muted uppercase tracking-wider">Name</th>
                  <th className="px-6 py-3 text-xs font-semibold text-muted uppercase tracking-wider">Abbreviation</th>
                  {canManage && <th className="px-6 py-3" />}
                </tr>
              </thead>
              <tbody>
                {pagedFiltered.map((u) => (
                  <tr key={u.id} className="border-b border-stroke hover:bg-hover transition-colors">
                    <td className="px-6 py-3 font-medium text-ink">{u.name}</td>
                    <td className="px-6 py-3 text-muted font-mono">{u.abbreviation}</td>
                    {canManage && (
                      <td className="px-6 py-3">
                        <div className="flex items-center gap-1 justify-end">
                          <Button variant="ghost" size="sm" onClick={() => openEdit(u)}>
                            <Pencil className="w-4 h-4" />
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => setPendingDelete(u)}>
                            <Trash2 className="w-4 h-4 text-red-400" />
                          </Button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
                </div>
                <div className="md:hidden divide-y divide-stroke border border-stroke">
                  {pagedFiltered.map((u) => (
                    <div key={u.id} className="px-4 py-3 flex items-start justify-between gap-3">
                      <div>
                        <p className="font-medium text-ink">{u.name}</p>
                        <p className="text-xs text-muted font-mono mt-0.5">{u.abbreviation}</p>
                      </div>
                      {canManage && (
                        <div className="flex items-center gap-1">
                          <Button variant="ghost" size="sm" onClick={() => openEdit(u)}>
                            <Pencil className="w-4 h-4" />
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => setPendingDelete(u)}>
                            <Trash2 className="w-4 h-4 text-red-400" />
                          </Button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
                <Pagination
                  totalItems={filtered.length}
                  page={page}
                  pageSize={PAGE_SIZE}
                  onPageChange={setPage}
                  itemLabel="units"
                />
              </>
            )}
          </div>
        )}
      </Card>

      {/* Create / Edit modal */}
      <Modal
        open={modal.open}
        onClose={() => { setModal({ open: false }); form.reset(); }}
        title={modal.unit ? "Edit unit" : "Add unit"}
        size="sm"
      >
        <form onSubmit={form.handleSubmit((d) => save.mutate(d))} className="flex flex-col gap-4">
          {save.isError && (
            <div className="p-3 bg-red-50 border border-red-200 text-sm text-red-700">
              {(save.error as { response?: { data?: { error?: string } } })?.response?.data?.error || "Save failed"}
            </div>
          )}
          <Input label="Name" placeholder="e.g. Kilogram" {...form.register("name")} error={form.formState.errors.name?.message} />
          <Input label="Abbreviation" placeholder="e.g. kg" {...form.register("abbreviation")} error={form.formState.errors.abbreviation?.message} />
          <div className="flex gap-3 justify-end pt-2">
            <Button type="button" variant="outline" onClick={() => { setModal({ open: false }); form.reset(); }}>Cancel</Button>
            <Button type="submit" loading={save.isPending}>{modal.unit ? "Save" : "Create"}</Button>
          </div>
        </form>
      </Modal>

      {/* Delete confirm modal */}
      <Modal open={!!pendingDelete} onClose={() => setPendingDelete(null)} title="Delete unit" size="sm">
        <div className="flex flex-col gap-4">
          <p className="text-sm text-ink">
            Are you sure you want to delete <strong>{pendingDelete?.name}</strong>? Products using this unit will have it removed.
          </p>
          <div className="flex gap-3 justify-end">
            <Button variant="outline" onClick={() => setPendingDelete(null)}>Cancel</Button>
            <Button
              variant="danger"
              loading={doDelete.isPending}
              onClick={() => pendingDelete && doDelete.mutate(pendingDelete.id)}
            >
              Delete
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
