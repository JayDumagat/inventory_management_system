import { useState, useMemo } from "react";
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
import { Pagination } from "../../components/ui/Pagination";
import { Skeleton, SkeletonTable } from "../../components/ui/Skeleton";
import { useToast } from "../../hooks/useToast";
import { formatDateTime, formatDate } from "../../lib/utils";
import { ArrowUpDown, GitBranch, AlertTriangle, ArrowRightLeft, Search, Plus, Pencil, Trash2, FlaskConical } from "lucide-react";

interface InventoryItem {
  id: string; quantity: number; reorderPoint: number;
  variant?: { id: string; name: string; sku: string; product?: { name: string } };
  branch?: { id: string; name: string };
}
interface Product { id: string; name: string; variants: { id: string; name: string; sku: string }[]; }
interface Branch { id: string; name: string; isDefault: boolean; }
interface Movement {
  id: string; type: string; quantity: number; previousQuantity: number; newQuantity: number;
  notes?: string; createdAt: string; variantId: string; branchId: string;
  destinationBranchId?: string | null;
}

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

const adjustSchema = z.object({
  variantId: z.string().min(1, "Variant required"),
  type: z.enum(["in", "out", "adjustment", "transfer", "return"]),
  quantity: z.number().int().min(1),
  notes: z.string().optional(),
});
type AdjustForm = z.infer<typeof adjustSchema>;

const transferSchema = z.object({
  variantId: z.string().min(1, "Variant required"),
  fromBranchId: z.string().min(1, "Source branch required"),
  toBranchId: z.string().min(1, "Destination branch required"),
  quantity: z.number().int().min(1),
  notes: z.string().optional(),
});
type TransferForm = z.infer<typeof transferSchema>;

const barcodeSchema = z.object({ code: z.string().min(1) });
type BarcodeForm = z.infer<typeof barcodeSchema>;

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

const movementBadge: Record<string, "success" | "danger" | "warning" | "info" | "default"> = {
  in: "success", out: "danger", adjustment: "warning", transfer: "info", return: "default",
};

function isExpiringSoon(expiryDate?: string | null): boolean {
  if (!expiryDate) return false;
  const diff = new Date(expiryDate).getTime() - Date.now();
  return diff > 0 && diff < 30 * 24 * 60 * 60 * 1000;
}

function isExpired(expiryDate?: string | null): boolean {
  if (!expiryDate) return false;
  return new Date(expiryDate).getTime() < Date.now();
}

export default function InventoryPage() {
  const PAGE_SIZE = 10;
  const { currentTenant } = useTenantStore();
  const { currentBranch } = useBranchStore();
  const qc = useQueryClient();
  const tid = currentTenant?.id;
  const myRole = currentTenant?.role || "staff";
  const canManage = ["owner", "admin", "manager"].includes(myRole);
  const toast = useToast();

  const [tab, setTab] = useState<"stock" | "movements" | "batches" | "transfers">("stock");
  const [adjustModal, setAdjustModal] = useState(false);
  const [adjustStep, setAdjustStep] = useState<1 | 2>(1);
  const [selectedProductId, setSelectedProductId] = useState("");
  const [transferModal, setTransferModal] = useState(false);
  const [transferStep, setTransferStep] = useState<1 | 2>(1);
  const [transferProductId, setTransferProductId] = useState("");
  const [barcodeModal, setBarcodeModal] = useState(false);
  const [barcodeResult, setBarcodeResult] = useState<{ name?: string; sku?: string; barcode?: string } | null>(null);
  const [barcodeError, setBarcodeError] = useState("");

  // Batch state
  const [batchModal, setBatchModal] = useState<{ open: boolean; batch?: Batch }>({ open: false });
  const [pendingDeleteBatch, setPendingDeleteBatch] = useState<Batch | null>(null);
  const [batchSelectedProductId, setBatchSelectedProductId] = useState("");
  const [stockPage, setStockPage] = useState(1);
  const [movementPage, setMovementPage] = useState(1);
  const [batchPage, setBatchPage] = useState(1);
  const [transferPage, setTransferPage] = useState(1);

  const { data: inventory = [], isLoading } = useQuery<InventoryItem[]>({
    queryKey: ["inventory", tid, currentBranch?.id],
    queryFn: () => api.get(`/api/tenants/${tid}/inventory`, { params: { branchId: currentBranch?.id } }).then((r) => r.data),
    enabled: !!tid,
  });

  const { data: movements = [] } = useQuery<Movement[]>({
    queryKey: ["movements", tid, currentBranch?.id],
    queryFn: () => api.get(`/api/tenants/${tid}/inventory/movements`, { params: { branchId: currentBranch?.id } }).then((r) => r.data),
    enabled: !!tid && (tab === "movements" || tab === "transfers"),
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

  const { data: batches = [] } = useQuery<Batch[]>({
    queryKey: ["batches", tid, currentBranch?.id],
    queryFn: () => api.get(`/api/tenants/${tid}/batches`, { params: { branchId: currentBranch?.id } }).then((r) => r.data),
    enabled: !!tid && tab === "batches",
  });

  const form = useForm<AdjustForm>({ resolver: zodResolver(adjustSchema), defaultValues: { type: "in" } });
  const tForm = useForm<TransferForm>({ resolver: zodResolver(transferSchema), defaultValues: { quantity: 1 } });
  const bForm = useForm<BarcodeForm>({ resolver: zodResolver(barcodeSchema) });
  const batchForm = useForm<BatchForm>({ resolver: zodResolver(batchSchema), defaultValues: { quantity: 0 } });

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

  const closeTransferModal = () => {
    setTransferModal(false);
    tForm.reset({ quantity: 1 });
    setTransferStep(1);
    setTransferProductId("");
  };

  const goToTransferStep2 = async () => {
    const valid = await tForm.trigger(["variantId"]);
    if (valid) setTransferStep(2);
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
      toast.success("Stock adjusted");
    },
    onError: () => toast.error("Failed to adjust stock"),
  });

  const transfer = useMutation({
    mutationFn: (data: TransferForm) =>
      api.post(`/api/tenants/${tid}/inventory/transfer`, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["inventory", tid] });
      qc.invalidateQueries({ queryKey: ["movements", tid] });
      closeTransferModal();
      toast.success("Stock transferred");
    },
    onError: () => toast.error("Failed to transfer stock"),
  });

  const updateReorder = useMutation({
    mutationFn: (data: { variantId: string; branchId: string; quantity: number; reorderPoint: number }) =>
      api.put(`/api/tenants/${tid}/inventory/set`, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["inventory", tid] });
      toast.success("Reorder alert updated");
    },
    onError: () => toast.error("Failed to update reorder alert"),
  });

  const lookupBarcode = useMutation({
    mutationFn: (code: string) =>
      api.get(`/api/tenants/${tid}/inventory/barcode/${encodeURIComponent(code)}`).then((r) => r.data),
    onSuccess: (data) => {
      setBarcodeResult({ name: data.product?.name + " — " + data.name, sku: data.sku, barcode: data.barcode });
      setBarcodeError("");
    },
    onError: () => {
      setBarcodeResult(null);
      setBarcodeError("No product found with that barcode");
    },
  });

  const saveBatch = useMutation({
    mutationFn: (data: BatchForm) =>
      batchModal.batch
        ? api.patch(`/api/tenants/${tid}/batches/${batchModal.batch.id}`, data)
        : api.post(`/api/tenants/${tid}/batches`, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["batches", tid] });
      setBatchModal({ open: false });
      batchForm.reset({ quantity: 0 });
      setBatchSelectedProductId("");
      toast.success(batchModal.batch ? "Batch updated" : "Batch created");
    },
    onError: () => toast.error("Failed to save batch"),
  });

  const doDeleteBatch = useMutation({
    mutationFn: (id: string) => api.delete(`/api/tenants/${tid}/batches/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["batches", tid] });
      setPendingDeleteBatch(null);
      toast.success("Batch deleted");
    },
    onError: () => toast.error("Failed to delete batch"),
  });

  const openCreateBatch = () => {
    setBatchModal({ open: true });
    batchForm.reset({ quantity: 0 });
    setBatchSelectedProductId("");
  };

  const openEditBatch = (batch: Batch) => {
    setBatchModal({ open: true, batch });
    batchForm.reset({
      variantId: batch.variant?.id ?? "",
      branchId: batch.branch?.id ?? "",
      batchNumber: batch.batchNumber,
      quantity: batch.quantity,
      expiryDate: batch.expiryDate ?? undefined,
      manufacturingDate: batch.manufacturingDate ?? undefined,
      notes: batch.notes ?? undefined,
    });
  };

  const allVariants = products.flatMap((p) => p.variants.map((v) => ({ ...v, productName: p.name })));
  const transferMovements = movements.filter((m) => m.type === "transfer");
  const stockTotalPages = Math.max(1, Math.ceil(inventory.length / PAGE_SIZE));
  const movementTotalPages = Math.max(1, Math.ceil(movements.length / PAGE_SIZE));
  const batchTotalPages = Math.max(1, Math.ceil(batches.length / PAGE_SIZE));
  const transferTotalPages = Math.max(1, Math.ceil(transferMovements.length / PAGE_SIZE));
  const currentStockPage = Math.min(stockPage, stockTotalPages);
  const currentMovementPage = Math.min(movementPage, movementTotalPages);
  const currentBatchPage = Math.min(batchPage, batchTotalPages);
  const currentTransferPage = Math.min(transferPage, transferTotalPages);
  const pagedInventory = useMemo(
    () => inventory.slice((currentStockPage - 1) * PAGE_SIZE, currentStockPage * PAGE_SIZE),
    [inventory, currentStockPage]
  );
  const pagedMovements = useMemo(
    () => movements.slice((currentMovementPage - 1) * PAGE_SIZE, currentMovementPage * PAGE_SIZE),
    [movements, currentMovementPage]
  );
  const pagedBatches = useMemo(
    () => batches.slice((currentBatchPage - 1) * PAGE_SIZE, currentBatchPage * PAGE_SIZE),
    [batches, currentBatchPage]
  );
  const pagedTransferMovements = useMemo(
    () => transferMovements.slice((currentTransferPage - 1) * PAGE_SIZE, currentTransferPage * PAGE_SIZE),
    [transferMovements, currentTransferPage]
  );

  if (isLoading) return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Skeleton className="h-7 w-32" />
        <Skeleton className="h-9 w-32" />
      </div>
      <Skeleton className="h-10 w-full" />
      <div className="border border-stroke">
        <table className="w-full"><SkeletonTable rows={8} cols={5} /></table>
      </div>
    </div>
  );

  return (
    <div className="space-y-5">
      <div className="flex flex-col lg:flex-row lg:items-center gap-3 lg:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-ink">Inventory</h1>
          <p className="text-muted text-sm mt-1">Track stock levels across all branches</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" onClick={() => { setBarcodeModal(true); setBarcodeResult(null); setBarcodeError(""); bForm.reset(); }} className="gap-2">
            <Search className="w-4 h-4" /> Barcode lookup
          </Button>
          <Button variant="outline" onClick={() => setTransferModal(true)} className="gap-2">
            <ArrowRightLeft className="w-4 h-4" /> Transfer
          </Button>
          <Button onClick={() => setAdjustModal(true)} className="gap-2" disabled={!currentBranch}>
            <ArrowUpDown className="w-4 h-4" /> Adjust stock
          </Button>
        </div>
      </div>

      {!currentBranch && (
        <div className="flex items-center gap-2 bg-yellow-50 border border-yellow-200 px-4 py-3 text-sm text-yellow-800">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" />
          <span>Select a branch from the sidebar to adjust stock.</span>
        </div>
      )}

      {/* Tabs */}
      <div className="overflow-x-auto">
      <div className="flex gap-0 border-b border-stroke min-w-max">
        {([
          { value: "stock", label: "Stock levels" },
          { value: "movements", label: "Transactions" },
          { value: "batches", label: "Batches" },
          { value: "transfers", label: "Transfers" },
        ] as const).map((t) => (
          <button
            key={t.value}
            onClick={() => setTab(t.value)}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
              tab === t.value
                ? "border-primary-600 text-primary-600"
                : "border-transparent text-muted hover:text-ink"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>
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
                     {canManage && <th className="px-6 py-3 text-xs font-semibold text-muted uppercase tracking-wider">Alerts</th>}
                     <th className="px-6 py-3 text-xs font-semibold text-muted uppercase tracking-wider">Status</th>
                   </tr>
                </thead>
                <tbody>
                  {pagedInventory.map((item) => {
                    const low = item.reorderPoint > 0 && item.quantity <= item.reorderPoint;
                    return (
                      <tr key={item.id} className="border-b border-stroke hover:bg-hover transition-colors">
                        <td className="px-6 py-3 font-medium text-ink">{item.variant?.product?.name}</td>
                        <td className="px-6 py-3 text-ink">{item.variant?.name}</td>
                        <td className="px-6 py-3 font-mono text-xs text-muted">{item.variant?.sku}</td>
                        <td className="px-6 py-3 text-muted">{item.branch?.name}</td>
                        <td className="px-6 py-3 font-bold text-ink">{item.quantity}</td>
                        <td className="px-6 py-3 text-muted">{item.reorderPoint || "—"}</td>
                        {canManage && (
                          <td className="px-6 py-3">
                            <button
                              type="button"
                              disabled={!item.variant?.id || !item.branch?.id || updateReorder.isPending}
                              onClick={() => {
                                if (!item.variant?.id || !item.branch?.id) return;
                                updateReorder.mutate({
                                  variantId: item.variant.id,
                                  branchId: item.branch.id,
                                  quantity: item.quantity,
                                  reorderPoint: item.reorderPoint > 0 ? 0 : 5,
                                });
                              }}
                              className={`px-2 py-1 text-xs border ${
                                item.reorderPoint > 0
                                  ? "border-green-200 bg-green-50 text-green-700"
                                  : "border-stroke text-muted"
                              }`}
                            >
                              {item.reorderPoint > 0 ? "On" : "Off"}
                            </button>
                          </td>
                        )}
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
      {tab === "stock" && inventory.length > 0 && (
        <Pagination
          totalItems={inventory.length}
          page={currentStockPage}
          pageSize={PAGE_SIZE}
          onPageChange={setStockPage}
          itemLabel="stock records"
        />
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
                  {pagedMovements.map((m) => (
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
      {tab === "movements" && movements.length > 0 && (
        <Pagination
          totalItems={movements.length}
          page={currentMovementPage}
          pageSize={PAGE_SIZE}
          onPageChange={setMovementPage}
          itemLabel="movements"
        />
      )}

      {tab === "batches" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            {canManage && (
              <Button onClick={openCreateBatch} className="gap-2">
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
                  {canManage && <Button onClick={openCreateBatch}>Add your first batch</Button>}
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
                    {pagedBatches.map((b) => {
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
                                <Button variant="ghost" size="sm" onClick={() => openEditBatch(b)}>
                                  <Pencil className="w-4 h-4" />
                                </Button>
                                <Button variant="ghost" size="sm" onClick={() => setPendingDeleteBatch(b)}>
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
        </div>
      )}
      {tab === "batches" && batches.length > 0 && (
        <Pagination
          totalItems={batches.length}
          page={currentBatchPage}
          pageSize={PAGE_SIZE}
          onPageChange={setBatchPage}
          itemLabel="batches"
        />
      )}

      {tab === "transfers" && (
        <Card>
          {transferMovements.length === 0 ? (
            <CardContent className="p-0">
              <div className="flex flex-col items-center justify-center py-20 px-6 text-center">
                <div className="w-14 h-14 bg-primary-50 border border-primary-200 flex items-center justify-center mb-5">
                  <ArrowRightLeft className="w-7 h-7 text-primary-500" />
                </div>
                <h3 className="text-base font-semibold text-ink mb-1">No transfers yet</h3>
                <p className="text-sm text-muted max-w-xs">Inter-branch stock transfers will appear here</p>
              </div>
            </CardContent>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-stroke text-left">
                    <th className="px-6 py-3 text-xs font-semibold text-muted uppercase tracking-wider">Date</th>
                    <th className="px-6 py-3 text-xs font-semibold text-muted uppercase tracking-wider">Product / Variant</th>
                    <th className="px-6 py-3 text-xs font-semibold text-muted uppercase tracking-wider">From Branch</th>
                    <th className="px-6 py-3 text-xs font-semibold text-muted uppercase tracking-wider">To Branch</th>
                    <th className="px-6 py-3 text-xs font-semibold text-muted uppercase tracking-wider">Quantity</th>
                    <th className="px-6 py-3 text-xs font-semibold text-muted uppercase tracking-wider">Notes</th>
                  </tr>
                </thead>
                <tbody>
                  {pagedTransferMovements.map((m) => {
                    const fromBranch = branches.find((b) => b.id === m.branchId);
                    const toBranch = branches.find((b) => b.id === m.destinationBranchId);
                    return (
                      <tr key={m.id} className="border-b border-stroke hover:bg-hover transition-colors">
                        <td className="px-6 py-3 text-muted whitespace-nowrap">{formatDateTime(m.createdAt)}</td>
                        <td className="px-6 py-3 text-muted font-mono text-xs">{m.variantId.slice(0, 8)}…</td>
                        <td className="px-6 py-3 text-muted">{fromBranch?.name ?? m.branchId.slice(0, 8)}</td>
                        <td className="px-6 py-3 text-muted">{toBranch?.name ?? (m.destinationBranchId ? m.destinationBranchId.slice(0, 8) : "—")}</td>
                        <td className="px-6 py-3 font-bold text-ink">{m.quantity}</td>
                        <td className="px-6 py-3 text-muted">{m.notes || "—"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}
      {tab === "transfers" && transferMovements.length > 0 && (
        <Pagination
          totalItems={transferMovements.length}
          page={currentTransferPage}
          pageSize={PAGE_SIZE}
          onPageChange={setTransferPage}
          itemLabel="transfers"
        />
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
            {adjust.isError && (
              <div className="p-3 bg-red-50 border border-red-200 text-sm text-red-700">
                {(adjust.error as { response?: { data?: { error?: string } } })?.response?.data?.error || "Adjustment failed"}
              </div>
            )}
            {/* Branch info */}
            <div className="flex items-center gap-2 bg-primary-50 border border-primary-200 px-3 py-2 text-xs text-primary-700">
              <GitBranch className="w-3.5 h-3.5 flex-shrink-0" />
              <span>Branch: <strong>{currentBranch?.name}</strong></span>
            </div>
            <Select label="Movement type" {...form.register("type")}>
              <option value="in">In (receive stock)</option>
              <option value="out">Out (remove stock)</option>
              <option value="adjustment">Adjustment (set manually)</option>
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

      {/* Transfer modal */}
      <Modal open={transferModal} onClose={closeTransferModal} title={transferStep === 1 ? "Transfer stock — Select variant" : "Transfer stock — Branch & quantity"}>
        <div className="flex items-center gap-1 mb-4">
          <div className={`w-6 h-6 flex items-center justify-center text-xs font-semibold ${transferStep >= 1 ? "bg-primary-600 text-white" : "bg-stroke text-muted"}`}>1</div>
          <div className="flex-1 h-px bg-stroke" />
          <div className={`w-6 h-6 flex items-center justify-center text-xs font-semibold ${transferStep >= 2 ? "bg-primary-600 text-white" : "bg-stroke text-muted"}`}>2</div>
        </div>

        {transferStep === 1 && (
          <div className="flex flex-col gap-4">
            <Select
              label="Filter by product"
              value={transferProductId}
              onChange={(e) => {
                setTransferProductId(e.target.value);
                tForm.setValue("variantId", "");
              }}
            >
              <option value="">All products</option>
              {products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </Select>
            <Select
              label="Product variant *"
              {...tForm.register("variantId")}
              error={tForm.formState.errors.variantId?.message}
            >
              <option value="">Select a variant</option>
              {(transferProductId
                ? products.find((p) => p.id === transferProductId)?.variants ?? []
                : allVariants
              ).map((v) => (
                <option key={v.id} value={v.id}>
                  {("productName" in v ? v.productName + " — " : "") + v.name} ({v.sku})
                </option>
              ))}
            </Select>
            <div className="flex gap-3 justify-end pt-2">
              <Button type="button" variant="outline" onClick={closeTransferModal}>Cancel</Button>
              <Button type="button" onClick={goToTransferStep2}>Next →</Button>
            </div>
          </div>
        )}

        {transferStep === 2 && (
          <form onSubmit={tForm.handleSubmit((d) => transfer.mutate(d))} className="flex flex-col gap-4">
            {transfer.isError && (
              <div className="p-3 bg-red-50 border border-red-200 text-sm text-red-700">
                {(transfer.error as { response?: { data?: { error?: string } } })?.response?.data?.error || "Transfer failed"}
              </div>
            )}
            <Select
              label="From branch *"
              {...tForm.register("fromBranchId")}
              error={tForm.formState.errors.fromBranchId?.message}
            >
              <option value="">Select source branch</option>
              {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </Select>
            <Select
              label="To branch *"
              {...tForm.register("toBranchId")}
              error={tForm.formState.errors.toBranchId?.message}
            >
              <option value="">Select destination branch</option>
              {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </Select>
            <Input label="Quantity" type="number" min="1" {...tForm.register("quantity", { valueAsNumber: true })} error={tForm.formState.errors.quantity?.message} />
            <Input label="Notes (optional)" {...tForm.register("notes")} />
            <div className="flex gap-3 justify-end pt-2">
              <Button type="button" variant="outline" onClick={() => setTransferStep(1)}>← Back</Button>
              <Button type="submit" loading={transfer.isPending}>Transfer</Button>
            </div>
          </form>
        )}
      </Modal>

      {/* Barcode lookup modal */}
      <Modal open={barcodeModal} onClose={() => setBarcodeModal(false)} title="Barcode lookup" size="sm">
        <form onSubmit={bForm.handleSubmit((d) => lookupBarcode.mutate(d.code))} className="flex flex-col gap-4">
          <Input
            label="Barcode / QR code"
            placeholder="Scan or type barcode"
            autoFocus
            {...bForm.register("code")}
          />
          {barcodeError && (
            <div className="p-3 bg-red-50 border border-red-200 text-sm text-red-700">{barcodeError}</div>
          )}
          {barcodeResult && (
            <div className="p-3 bg-green-50 border border-green-200 text-sm text-green-800">
              <div className="font-medium">{barcodeResult.name}</div>
              <div className="text-xs text-green-700 mt-0.5">SKU: {barcodeResult.sku} · Barcode: {barcodeResult.barcode}</div>
            </div>
          )}
          <div className="flex gap-3 justify-end pt-2">
            <Button type="button" variant="outline" onClick={() => setBarcodeModal(false)}>Close</Button>
            <Button type="submit" loading={lookupBarcode.isPending}>
              <Search className="w-4 h-4" /> Lookup
            </Button>
          </div>
        </form>
      </Modal>

      {/* Batch create/edit modal */}
      <Modal
        open={batchModal.open}
        onClose={() => { setBatchModal({ open: false }); batchForm.reset({ quantity: 0 }); setBatchSelectedProductId(""); }}
        title={batchModal.batch ? "Edit batch" : "Add batch"}
      >
        <form onSubmit={batchForm.handleSubmit((d) => saveBatch.mutate(d))} className="flex flex-col gap-4">
          {saveBatch.isError && (
            <div className="p-3 bg-red-50 border border-red-200 text-sm text-red-700">
              {(saveBatch.error as { response?: { data?: { error?: string } } })?.response?.data?.error || "Save failed"}
            </div>
          )}
          {!batchModal.batch && (
            <Select
              label="Filter by product"
              value={batchSelectedProductId}
              onChange={(e) => {
                setBatchSelectedProductId(e.target.value);
                batchForm.setValue("variantId", "");
              }}
            >
              <option value="">All products</option>
              {products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </Select>
          )}
          {!batchModal.batch && (
            <Select
              label="Variant *"
              {...batchForm.register("variantId")}
              error={batchForm.formState.errors.variantId?.message}
            >
              <option value="">Select variant</option>
              {(batchSelectedProductId
                ? products.find((p) => p.id === batchSelectedProductId)?.variants ?? []
                : allVariants
              ).map((v) => (
                <option key={v.id} value={v.id}>
                  {("productName" in v ? v.productName + " — " : "") + v.name} ({v.sku})
                </option>
              ))}
            </Select>
          )}
          {!batchModal.batch && (
            <Select
              label="Branch *"
              {...batchForm.register("branchId")}
              error={batchForm.formState.errors.branchId?.message}
            >
              <option value="">Select branch</option>
              {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </Select>
          )}
          <Input label="Batch number *" placeholder="e.g. BATCH-2024-001" {...batchForm.register("batchNumber")} error={batchForm.formState.errors.batchNumber?.message} />
          <Input label="Quantity" type="number" min="0" {...batchForm.register("quantity", { valueAsNumber: true })} error={batchForm.formState.errors.quantity?.message} />
          <div className="grid grid-cols-2 gap-3">
            <Input label="Manufacturing date" type="date" {...batchForm.register("manufacturingDate")} />
            <Input label="Expiry date" type="date" {...batchForm.register("expiryDate")} />
          </div>
          <Input label="Notes (optional)" {...batchForm.register("notes")} />
          <div className="flex gap-3 justify-end pt-2">
            <Button type="button" variant="outline" onClick={() => { setBatchModal({ open: false }); batchForm.reset({ quantity: 0 }); setBatchSelectedProductId(""); }}>Cancel</Button>
            <Button type="submit" loading={saveBatch.isPending}>{batchModal.batch ? "Save" : "Create"}</Button>
          </div>
        </form>
      </Modal>

      {/* Batch delete confirm */}
      <Modal open={!!pendingDeleteBatch} onClose={() => setPendingDeleteBatch(null)} title="Delete batch" size="sm">
        <div className="flex flex-col gap-4">
          <p className="text-sm text-ink">
            Delete batch <strong>{pendingDeleteBatch?.batchNumber}</strong>? This cannot be undone.
          </p>
          <div className="flex gap-3 justify-end">
            <Button variant="outline" onClick={() => setPendingDeleteBatch(null)}>Cancel</Button>
            <Button variant="danger" loading={doDeleteBatch.isPending} onClick={() => pendingDeleteBatch && doDeleteBatch.mutate(pendingDeleteBatch.id)}>Delete</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
