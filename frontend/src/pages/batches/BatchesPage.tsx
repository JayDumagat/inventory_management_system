import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { api } from "../../api/client";
import { useTenantStore } from "../../stores/tenantStore";
import { useBranchStore } from "../../stores/branchStore";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { Select } from "../../components/ui/Select";
import { Card, CardContent } from "../../components/ui/Card";
import { Modal } from "../../components/ui/Modal";
import { Badge } from "../../components/ui/Badge";
import { Skeleton, SkeletonTable } from "../../components/ui/Skeleton";
import { Plus, Pencil, Trash2, FlaskConical, AlertTriangle } from "lucide-react";
import { formatDate } from "../../lib/utils";
import { useToast } from "../../hooks/useToast";

interface Batch {
  id: string;
  batchNumber: string;
  quantity: number;
  expiryDate?: string | null;
  manufacturingDate?: string | null;
  notes?: string | null;
  variant?: { id: string; name: string; sku: string; product?: { name: string } };
  branch?: { id: string; name: string };
}

interface Product { id: string; name: string; variants: { id: string; name: string; sku: string }[]; }
interface Branch { id: string; name: string; }

const batchSchema = z.object({
  variantId: z.string().min(1, "Variant required"),
  branchId: z.string().min(1, "Branch required"),
  batchNumber: z.string().min(1, "Batch number required"),
  quantity: z.number().int().min(0),
  expiryDate: z.string().optional(),
  manufacturingDate: z.string().optional(),
  notes: z.string().optional(),
});
type BatchForm = z.infer<typeof batchSchema>;

function isExpiringSoon(expiryDate?: string | null): boolean {
  if (!expiryDate) return false;
  const diff = new Date(expiryDate).getTime() - Date.now();
  return diff > 0 && diff < 30 * 24 * 60 * 60 * 1000;
}

function isExpired(expiryDate?: string | null): boolean {
  if (!expiryDate) return false;
  return new Date(expiryDate).getTime() < Date.now();
}

export default function BatchesPage() {
  const { currentTenant } = useTenantStore();
  const { currentBranch } = useBranchStore();
  const qc = useQueryClient();
  const tid = currentTenant?.id;
  const myRole = currentTenant?.role || "staff";
  const canManage = ["owner", "admin", "manager"].includes(myRole);
  const toast = useToast();

  const [modal, setModal] = useState<{ open: boolean; batch?: Batch }>({ open: false });
  const [pendingDelete, setPendingDelete] = useState<Batch | null>(null);
  const [selectedProductId, setSelectedProductId] = useState("");

  const { data: batches = [], isLoading } = useQuery<Batch[]>({
    queryKey: ["batches", tid, currentBranch?.id],
    queryFn: () => api.get(`/api/tenants/${tid}/batches`, { params: { branchId: currentBranch?.id } }).then((r) => r.data),
    enabled: !!tid,
  });

  const { data: products = [] } = useQuery<Product[]>({
    queryKey: ["products", tid],
    queryFn: () => api.get(`/api/tenants/${tid}/products`).then((r) => r.data),
    enabled: !!tid,
  });

  const { data: branches = [] } = useQuery<Branch[]>({
    queryKey: ["branches", tid],
    queryFn: () => api.get(`/api/tenants/${tid}/branches`).then((r) => r.data),
    enabled: !!tid,
  });

  const form = useForm<BatchForm>({ resolver: zodResolver(batchSchema), defaultValues: { quantity: 0 } });

  const save = useMutation({
    mutationFn: (data: BatchForm) =>
      modal.batch
        ? api.patch(`/api/tenants/${tid}/batches/${modal.batch.id}`, data)
        : api.post(`/api/tenants/${tid}/batches`, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["batches", tid] });
      setModal({ open: false });
      form.reset({ quantity: 0 });
      setSelectedProductId("");
      toast.success("Batch saved");
    },
    onError: () => toast.error("Failed to save batch"),
  });

  const doDelete = useMutation({
    mutationFn: (id: string) => api.delete(`/api/tenants/${tid}/batches/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["batches", tid] });
      setPendingDelete(null);
      toast.success("Batch deleted");
    },
    onError: () => toast.error("Failed to delete batch"),
  });

  const openCreate = () => {
    setModal({ open: true });
    form.reset({ quantity: 0 });
    setSelectedProductId("");
  };

  const openEdit = (batch: Batch) => {
    setModal({ open: true, batch });
    form.reset({
      variantId: batch.variant?.id ?? "",
      branchId: batch.branch?.id ?? "",
      batchNumber: batch.batchNumber,
      quantity: batch.quantity,
      expiryDate: batch.expiryDate ?? undefined,
      manufacturingDate: batch.manufacturingDate ?? undefined,
      notes: batch.notes ?? undefined,
    });
  };

  const allVariants = products.flatMap((p) => p.variants.map((v) => ({ ...v, productName: p.name, productId: p.id })));

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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-ink">Batch & Expiry Tracking</h1>
          <p className="text-muted text-sm mt-1">Manage product batches and track expiry dates</p>
        </div>
        {canManage && (
          <Button onClick={openCreate} className="gap-2">
            <Plus className="w-4 h-4" /> Add batch
          </Button>
        )}
      </div>

      <Card>
        {batches.length === 0 ? (
          <CardContent className="p-0">
            <div className="flex flex-col items-center justify-center py-20 px-6 text-center">
              <div className="w-14 h-14 bg-primary-50 border border-primary-200 flex items-center justify-center mb-5">
                <FlaskConical className="w-7 h-7 text-primary-500" />
              </div>
              <h3 className="text-base font-semibold text-ink mb-1">No batches yet</h3>
              <p className="text-sm text-muted max-w-xs mb-6">Track product batches and expiry dates to manage perishable inventory</p>
              {canManage && <Button onClick={openCreate}>Add your first batch</Button>}
            </div>
          </CardContent>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-stroke text-left">
                  <th className="px-6 py-3 text-xs font-semibold text-muted uppercase tracking-wider">Batch #</th>
                  <th className="px-6 py-3 text-xs font-semibold text-muted uppercase tracking-wider">Product / Variant</th>
                  <th className="px-6 py-3 text-xs font-semibold text-muted uppercase tracking-wider">Branch</th>
                  <th className="px-6 py-3 text-xs font-semibold text-muted uppercase tracking-wider">Qty</th>
                  <th className="px-6 py-3 text-xs font-semibold text-muted uppercase tracking-wider">Mfg Date</th>
                  <th className="px-6 py-3 text-xs font-semibold text-muted uppercase tracking-wider">Expiry Date</th>
                  <th className="px-6 py-3 text-xs font-semibold text-muted uppercase tracking-wider">Status</th>
                  {canManage && <th className="px-6 py-3" />}
                </tr>
              </thead>
              <tbody>
                {batches.map((b) => {
                  const expired = isExpired(b.expiryDate);
                  const expiringSoon = !expired && isExpiringSoon(b.expiryDate);
                  return (
                    <tr key={b.id} className="border-b border-stroke hover:bg-hover transition-colors">
                      <td className="px-6 py-3 font-mono text-xs text-ink font-medium">{b.batchNumber}</td>
                      <td className="px-6 py-3">
                        <div className="text-ink font-medium">{b.variant?.product?.name}</div>
                        <div className="text-xs text-muted">{b.variant?.name} · {b.variant?.sku}</div>
                      </td>
                      <td className="px-6 py-3 text-muted">{b.branch?.name}</td>
                      <td className="px-6 py-3 font-bold text-ink">{b.quantity}</td>
                      <td className="px-6 py-3 text-muted">{b.manufacturingDate ? formatDate(b.manufacturingDate) : "—"}</td>
                      <td className="px-6 py-3 text-muted">{b.expiryDate ? formatDate(b.expiryDate) : "—"}</td>
                      <td className="px-6 py-3">
                        {expired ? (
                          <Badge variant="danger">Expired</Badge>
                        ) : expiringSoon ? (
                          <span className="inline-flex items-center gap-1 text-xs text-yellow-700 bg-yellow-50 border border-yellow-200 px-2 py-0.5">
                            <AlertTriangle className="w-3 h-3" /> Expiring soon
                          </span>
                        ) : b.expiryDate ? (
                          <Badge variant="success">OK</Badge>
                        ) : (
                          <span className="text-xs text-muted">—</span>
                        )}
                      </td>
                      {canManage && (
                        <td className="px-6 py-3">
                          <div className="flex items-center gap-1 justify-end">
                            <Button variant="ghost" size="sm" onClick={() => openEdit(b)}>
                              <Pencil className="w-4 h-4" />
                            </Button>
                            <Button variant="ghost" size="sm" onClick={() => setPendingDelete(b)}>
                              <Trash2 className="w-4 h-4 text-red-400" />
                            </Button>
                          </div>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Create / Edit modal */}
      <Modal
        open={modal.open}
        onClose={() => { setModal({ open: false }); form.reset({ quantity: 0 }); setSelectedProductId(""); }}
        title={modal.batch ? "Edit batch" : "Add batch"}
      >
        <form onSubmit={form.handleSubmit((d) => save.mutate(d))} className="flex flex-col gap-4">
          {save.isError && (
            <div className="p-3 bg-red-50 border border-red-200 text-sm text-red-700">
              {(save.error as { response?: { data?: { error?: string } } })?.response?.data?.error || "Save failed"}
            </div>
          )}
          {!modal.batch && (
            <Select
              label="Filter by product"
              value={selectedProductId}
              onChange={(e) => {
                setSelectedProductId(e.target.value);
                form.setValue("variantId", "");
              }}
            >
              <option value="">All products</option>
              {products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </Select>
          )}
          {!modal.batch && (
            <Select
              label="Variant *"
              {...form.register("variantId")}
              error={form.formState.errors.variantId?.message}
            >
              <option value="">Select variant</option>
              {(selectedProductId
                ? products.find((p) => p.id === selectedProductId)?.variants ?? []
                : allVariants
              ).map((v) => (
                <option key={v.id} value={v.id}>
                  {("productName" in v ? v.productName + " — " : "") + v.name} ({v.sku})
                </option>
              ))}
            </Select>
          )}
          {!modal.batch && (
            <Select
              label="Branch *"
              {...form.register("branchId")}
              error={form.formState.errors.branchId?.message}
            >
              <option value="">Select branch</option>
              {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </Select>
          )}
          <Input label="Batch number *" placeholder="e.g. BATCH-2024-001" {...form.register("batchNumber")} error={form.formState.errors.batchNumber?.message} />
          <Input label="Quantity" type="number" min="0" {...form.register("quantity", { valueAsNumber: true })} error={form.formState.errors.quantity?.message} />
          <div className="grid grid-cols-2 gap-3">
            <Input label="Manufacturing date" type="date" {...form.register("manufacturingDate")} />
            <Input label="Expiry date" type="date" {...form.register("expiryDate")} />
          </div>
          <Input label="Notes (optional)" {...form.register("notes")} />
          <div className="flex gap-3 justify-end pt-2">
            <Button type="button" variant="outline" onClick={() => { setModal({ open: false }); form.reset({ quantity: 0 }); setSelectedProductId(""); }}>Cancel</Button>
            <Button type="submit" loading={save.isPending}>{modal.batch ? "Save" : "Create"}</Button>
          </div>
        </form>
      </Modal>

      {/* Delete confirm */}
      <Modal open={!!pendingDelete} onClose={() => setPendingDelete(null)} title="Delete batch" size="sm">
        <div className="flex flex-col gap-4">
          <p className="text-sm text-ink">
            Delete batch <strong>{pendingDelete?.batchNumber}</strong>? This cannot be undone.
          </p>
          <div className="flex gap-3 justify-end">
            <Button variant="outline" onClick={() => setPendingDelete(null)}>Cancel</Button>
            <Button variant="danger" loading={doDelete.isPending} onClick={() => pendingDelete && doDelete.mutate(pendingDelete.id)}>Delete</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
