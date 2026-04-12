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
import { PageLoader } from "../../components/ui/Spinner";
import { formatDateTime } from "../../lib/utils";
import { ArrowUpDown, GitBranch, AlertTriangle } from "lucide-react";

interface InventoryItem {
  id: string; quantity: number; reorderPoint: number;
  variant?: { id: string; name: string; sku: string; product?: { name: string } };
  branch?: { id: string; name: string };
}
interface Product { id: string; name: string; variants: { id: string; name: string; sku: string }[]; }
interface Movement {
  id: string; type: string; quantity: number; previousQuantity: number; newQuantity: number;
  notes?: string; createdAt: string; variantId: string; branchId: string;
}

const adjustSchema = z.object({
  variantId: z.string().min(1, "Variant required"),
  type: z.enum(["in", "out", "adjustment", "transfer", "return"]),
  quantity: z.number().int().min(1),
  notes: z.string().optional(),
});
type AdjustForm = z.infer<typeof adjustSchema>;

const movementBadge: Record<string, "success" | "danger" | "warning" | "info" | "default"> = {
  in: "success", out: "danger", adjustment: "warning", transfer: "info", return: "default",
};

export default function InventoryPage() {
  const { currentTenant } = useTenantStore();
  const { currentBranch } = useBranchStore();
  const qc = useQueryClient();
  const tid = currentTenant?.id;
  const [tab, setTab] = useState<"stock" | "movements">("stock");
  const [adjustModal, setAdjustModal] = useState(false);
  const [adjustStep, setAdjustStep] = useState<1 | 2>(1);
  const [selectedProductId, setSelectedProductId] = useState("");

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

  const { data: products = [] } = useQuery<Product[]>({
    queryKey: ["products", tid],
    queryFn: () => api.get(`/api/tenants/${tid}/products`).then((r) => r.data),
    enabled: !!tid,
  });

  const form = useForm<AdjustForm>({ resolver: zodResolver(adjustSchema), defaultValues: { type: "in" } });

  const closeAdjustModal = () => {
    setAdjustModal(false);
    form.reset({ type: "in" });
    setAdjustStep(1);
    setSelectedProductId("");
  };

  const goToAdjustStep2 = async () => {
    const valid = await form.trigger(["variantId"]);
    if (valid) setAdjustStep(2);
  };

  const adjust = useMutation({
    mutationFn: (data: AdjustForm) =>
      api.post(`/api/tenants/${tid}/inventory/adjust`, {
        ...data,
        branchId: currentBranch!.id,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["inventory", tid] });
      qc.invalidateQueries({ queryKey: ["movements", tid] });
      closeAdjustModal();
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
        <Button onClick={() => setAdjustModal(true)} className="gap-2" disabled={!currentBranch}>
          <ArrowUpDown className="w-4 h-4" /> Adjust stock
        </Button>
      </div>

      {!currentBranch && (
        <div className="flex items-center gap-2 bg-yellow-50 border border-yellow-200 px-4 py-3 text-sm text-yellow-800">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" />
          <span>Select a branch from the sidebar to adjust stock.</span>
        </div>
      )}

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
                <Button onClick={() => setAdjustModal(true)} disabled={!currentBranch}>Adjust stock</Button>
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
      <Modal open={adjustModal} onClose={closeAdjustModal} title={adjustStep === 1 ? "Adjust stock — Select variant" : "Adjust stock — Movement details"}>
        {/* Step indicator */}
        <div className="flex items-center gap-1 mb-4">
          <div className={`w-6 h-6 flex items-center justify-center text-xs font-semibold ${adjustStep >= 1 ? "bg-primary-600 text-white" : "bg-stroke text-muted"}`}>1</div>
          <div className="flex-1 h-px bg-stroke" />
          <div className={`w-6 h-6 flex items-center justify-center text-xs font-semibold ${adjustStep >= 2 ? "bg-primary-600 text-white" : "bg-stroke text-muted"}`}>2</div>
        </div>

        {adjustStep === 1 && (
          <div className="flex flex-col gap-4">
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
            <Select
              label="Product variant *"
              {...form.register("variantId")}
              error={form.formState.errors.variantId?.message}
            >
              <option value="">Select a variant</option>
              {(selectedProductId
                ? products.find((p) => p.id === selectedProductId)?.variants ?? []
                : allVariants
              ).map((v) => (
                <option key={v.id} value={v.id}>
                  {("productName" in v ? v.productName + " — " : "") + v.name} ({v.sku})
                </option>
              ))}
            </Select>
            <div className="flex gap-3 justify-end pt-2">
              <Button type="button" variant="outline" onClick={closeAdjustModal}>Cancel</Button>
              <Button type="button" onClick={goToAdjustStep2}>Next →</Button>
            </div>
          </div>
        )}

        {adjustStep === 2 && (
          <form
            onSubmit={form.handleSubmit((d) => adjust.mutate(d))}
            className="flex flex-col gap-4"
          >
            {/* Branch info */}
            <div className="flex items-center gap-2 bg-primary-50 border border-primary-200 px-3 py-2 text-xs text-primary-700">
              <GitBranch className="w-3.5 h-3.5 flex-shrink-0" />
              <span>Branch: <strong>{currentBranch?.name}</strong></span>
            </div>
            <Select label="Movement type" {...form.register("type")}>
              <option value="in">In (receive stock)</option>
              <option value="out">Out (remove stock)</option>
              <option value="adjustment">Adjustment (set manually)</option>
              <option value="transfer">Transfer (outgoing)</option>
              <option value="return">Return (customer return)</option>
            </Select>
            <Input label="Quantity" type="number" min="1" {...form.register("quantity", { valueAsNumber: true })} error={form.formState.errors.quantity?.message} />
            <Input label="Notes (optional)" {...form.register("notes")} />
            <div className="flex gap-3 justify-end pt-2">
              <Button type="button" variant="outline" onClick={() => setAdjustStep(1)}>← Back</Button>
              <Button type="submit" loading={adjust.isPending}>Apply</Button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
}
