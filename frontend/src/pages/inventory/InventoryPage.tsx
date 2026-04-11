import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { api } from "../../api/client";
import { useTenantStore } from "../../stores/tenantStore";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { Select } from "../../components/ui/Select";
import { Card, CardContent } from "../../components/ui/Card";
import { Modal } from "../../components/ui/Modal";
import { Badge } from "../../components/ui/Badge";
import { PageLoader } from "../../components/ui/Spinner";
import { formatDateTime } from "../../lib/utils";
import { ArrowUpDown } from "lucide-react";

interface InventoryItem {
  id: string; quantity: number; reorderPoint: number;
  variant?: { id: string; name: string; sku: string; product?: { name: string } };
  branch?: { id: string; name: string };
}
interface Branch { id: string; name: string; }
interface Product { id: string; name: string; variants: { id: string; name: string; sku: string }[]; }
interface Movement {
  id: string; type: string; quantity: number; previousQuantity: number; newQuantity: number;
  notes?: string; createdAt: string; variantId: string; branchId: string;
}

const adjustSchema = z.object({
  variantId: z.string().min(1, "Variant required"),
  branchId: z.string().min(1, "Branch required"),
  type: z.enum(["in", "out", "adjustment", "transfer", "return"]),
  quantity: z.number().min(1, "Quantity must be at least 1"),
  notes: z.string().optional(),
});
type AdjustForm = z.infer<typeof adjustSchema>;

const movementBadge: Record<string, "success" | "danger" | "warning" | "info" | "default"> = {
  in: "success", out: "danger", adjustment: "warning", transfer: "info", return: "default",
};

export default function InventoryPage() {
  const { currentTenant } = useTenantStore();
  const qc = useQueryClient();
  const tid = currentTenant?.id;
  const [tab, setTab] = useState<"stock" | "movements">("stock");
  const [adjustModal, setAdjustModal] = useState(false);

  const { data: inventory = [], isLoading } = useQuery<InventoryItem[]>({
    queryKey: ["inventory", tid],
    queryFn: () => api.get(`/api/tenants/${tid}/inventory`).then((r) => r.data),
    enabled: !!tid,
  });

  const { data: movements = [] } = useQuery<Movement[]>({
    queryKey: ["movements", tid],
    queryFn: () => api.get(`/api/tenants/${tid}/inventory/movements`).then((r) => r.data),
    enabled: !!tid && tab === "movements",
  });

  const { data: branches = [] } = useQuery<Branch[]>({
    queryKey: ["branches", tid],
    queryFn: () => api.get(`/api/tenants/${tid}/branches`).then((r) => r.data),
    enabled: !!tid,
  });

  const { data: products = [] } = useQuery<Product[]>({
    queryKey: ["products", tid],
    queryFn: () => api.get(`/api/tenants/${tid}/products`).then((r) => r.data),
    enabled: !!tid,
  });

  const form = useForm<AdjustForm>({ resolver: zodResolver(adjustSchema), defaultValues: { type: "in" } });

  const adjust = useMutation({
    mutationFn: (data: AdjustForm) => api.post(`/api/tenants/${tid}/inventory/adjust`, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["inventory", tid] });
      qc.invalidateQueries({ queryKey: ["movements", tid] });
      setAdjustModal(false);
      form.reset();
    },
  });

  const allVariants = products.flatMap((p) => p.variants.map((v) => ({ ...v, productName: p.name })));

  if (isLoading) return <PageLoader />;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-ink">Inventory</h1>
          <p className="text-muted text-sm mt-1">Track stock levels across all branches</p>
        </div>
        <Button onClick={() => setAdjustModal(true)} className="gap-2">
          <ArrowUpDown className="w-4 h-4" /> Adjust stock
        </Button>
      </div>

      {/* Tabs */}
      <div className="flex gap-0 border-b border-stroke">
        {(["stock", "movements"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors capitalize ${
              tab === t
                ? "border-primary-600 text-primary-600"
                : "border-transparent text-muted hover:text-ink"
            }`}
          >
            {t === "stock" ? "Stock levels" : "Stock movements"}
          </button>
        ))}
      </div>

      {tab === "stock" && (
        <Card>
          {inventory.length === 0 ? (
            <CardContent className="p-0">
              <div className="flex flex-col items-center justify-center py-20 px-6 text-center">
                <div className="w-14 h-14 bg-primary-50 border border-primary-200 flex items-center justify-center mb-5">
                  <ArrowUpDown className="w-7 h-7 text-primary-500" />
                </div>
                <h3 className="text-base font-semibold text-ink mb-1">No inventory records yet</h3>
                <p className="text-sm text-muted max-w-xs mb-6">Use the "Adjust stock" button to add your first inventory records</p>
                <Button onClick={() => setAdjustModal(true)}>Adjust stock</Button>
              </div>
            </CardContent>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-stroke text-left">
                    <th className="px-6 py-3 text-xs font-semibold text-muted uppercase tracking-wider">Product</th>
                    <th className="px-6 py-3 text-xs font-semibold text-muted uppercase tracking-wider">Variant</th>
                    <th className="px-6 py-3 text-xs font-semibold text-muted uppercase tracking-wider">SKU</th>
                    <th className="px-6 py-3 text-xs font-semibold text-muted uppercase tracking-wider">Branch</th>
                    <th className="px-6 py-3 text-xs font-semibold text-muted uppercase tracking-wider">Qty</th>
                    <th className="px-6 py-3 text-xs font-semibold text-muted uppercase tracking-wider">Reorder at</th>
                    <th className="px-6 py-3 text-xs font-semibold text-muted uppercase tracking-wider">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {inventory.map((item) => {
                    const low = item.reorderPoint > 0 && item.quantity <= item.reorderPoint;
                    return (
                      <tr key={item.id} className="border-b border-stroke hover:bg-hover transition-colors">
                        <td className="px-6 py-3 font-medium text-ink">{item.variant?.product?.name}</td>
                        <td className="px-6 py-3 text-ink">{item.variant?.name}</td>
                        <td className="px-6 py-3 font-mono text-xs text-muted">{item.variant?.sku}</td>
                        <td className="px-6 py-3 text-muted">{item.branch?.name}</td>
                        <td className="px-6 py-3 font-bold text-ink">{item.quantity}</td>
                        <td className="px-6 py-3 text-muted">{item.reorderPoint || "—"}</td>
                        <td className="px-6 py-3">
                          {low ? <Badge variant="danger">Low stock</Badge> : <Badge variant="success">OK</Badge>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}

      {tab === "movements" && (
        <Card>
          {movements.length === 0 ? (
            <CardContent className="p-0">
              <div className="flex flex-col items-center justify-center py-20 px-6 text-center">
                <div className="w-14 h-14 bg-primary-50 border border-primary-200 flex items-center justify-center mb-5">
                  <ArrowUpDown className="w-7 h-7 text-primary-500" />
                </div>
                <h3 className="text-base font-semibold text-ink mb-1">No stock movements yet</h3>
                <p className="text-sm text-muted max-w-xs">Stock adjustments, transfers and returns will appear here</p>
              </div>
            </CardContent>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-stroke text-left">
                    <th className="px-6 py-3 text-xs font-semibold text-muted uppercase tracking-wider">Type</th>
                    <th className="px-6 py-3 text-xs font-semibold text-muted uppercase tracking-wider">Variant</th>
                    <th className="px-6 py-3 text-xs font-semibold text-muted uppercase tracking-wider">Branch</th>
                    <th className="px-6 py-3 text-xs font-semibold text-muted uppercase tracking-wider">Qty</th>
                    <th className="px-6 py-3 text-xs font-semibold text-muted uppercase tracking-wider">Before → After</th>
                    <th className="px-6 py-3 text-xs font-semibold text-muted uppercase tracking-wider">Notes</th>
                    <th className="px-6 py-3 text-xs font-semibold text-muted uppercase tracking-wider">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {movements.map((m) => (
                    <tr key={m.id} className="border-b border-stroke hover:bg-hover transition-colors">
                      <td className="px-6 py-3">
                        <Badge variant={movementBadge[m.type]}>{m.type}</Badge>
                      </td>
                      <td className="px-6 py-3 text-muted">{m.variantId.slice(0, 8)}…</td>
                      <td className="px-6 py-3 text-muted">{m.branchId.slice(0, 8)}…</td>
                      <td className="px-6 py-3 font-bold text-ink">{m.quantity}</td>
                      <td className="px-6 py-3 text-muted">{m.previousQuantity} → {m.newQuantity}</td>
                      <td className="px-6 py-3 text-muted">{m.notes || "—"}</td>
                      <td className="px-6 py-3 text-muted whitespace-nowrap">{formatDateTime(m.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}

      {/* Adjust modal */}
      <Modal open={adjustModal} onClose={() => setAdjustModal(false)} title="Adjust stock">
        <form onSubmit={form.handleSubmit((d) => adjust.mutate({ ...d, quantity: Number(d.quantity) }))} className="flex flex-col gap-4">
          <Select label="Product variant" {...form.register("variantId")} error={form.formState.errors.variantId?.message}>
            <option value="">Select a variant</option>
            {allVariants.map((v) => (
              <option key={v.id} value={v.id}>{v.productName} — {v.name} ({v.sku})</option>
            ))}
          </Select>
          <Select label="Branch" {...form.register("branchId")} error={form.formState.errors.branchId?.message}>
            <option value="">Select a branch</option>
            {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
          </Select>
          <Select label="Movement type" {...form.register("type")}>
            <option value="in">In (receive stock)</option>
            <option value="out">Out (remove stock)</option>
            <option value="adjustment">Adjustment (set manually)</option>
            <option value="transfer">Transfer (outgoing)</option>
            <option value="return">Return (customer return)</option>
          </Select>
          <Input label="Quantity" type={"number"} min={1} {...form.register("quantity")} error={form.formState.errors.quantity?.message} />
          <Input label="Notes (optional)" {...form.register("notes")} />
          <div className="flex gap-3 justify-end pt-2">
            <Button type="button" variant="outline" onClick={() => setAdjustModal(false)}>Cancel</Button>
            <Button type="submit" loading={adjust.isPending}>Apply</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
