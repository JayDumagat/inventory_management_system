import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm, useFieldArray } from "react-hook-form";
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
import { useFormatCurrency, formatDate } from "../../lib/utils";
import { ShoppingBag, Plus, Eye, Trash2 } from "lucide-react";
import { useToast } from "../../hooks/useToast";

interface Supplier { id: string; name: string; }
interface Product { id: string; name: string; variants: { id: string; name: string; sku: string; costPrice: string }[]; }
interface PurchaseOrderItem {
  id: string;
  productName: string;
  variantName: string;
  sku: string;
  quantity: number;
  receivedQuantity: number;
  unitCost: string;
  totalCost: string;
}
interface PurchaseOrder {
  id: string;
  orderNumber: string;
  status: string;
  subtotal: string;
  taxAmount: string;
  totalAmount: string;
  notes?: string;
  expectedDate?: string;
  receivedAt?: string;
  createdAt: string;
  supplierName?: string;
  supplierId?: string;
  branchName?: string;
  branchId?: string;
  items?: PurchaseOrderItem[];
}

const statusColor: Record<string, "default" | "success" | "warning" | "danger" | "info"> = {
  draft: "default",
  ordered: "info",
  partial: "warning",
  received: "success",
  cancelled: "danger",
};

const itemSchema = z.object({
  variantId: z.string().optional(),
  productName: z.string().min(1),
  variantName: z.string().min(1),
  sku: z.string().min(1),
  quantity: z.number().int().min(1),
  unitCost: z.number().min(0),
});

const createSchema = z.object({
  supplierId: z.string().optional(),
  notes: z.string().optional(),
  taxAmount: z.number().min(0).optional(),
  expectedDate: z.string().optional(),
  items: z.array(itemSchema).min(1, "At least one item required"),
});

type CreateForm = z.infer<typeof createSchema>;

const nextStatuses: Record<string, string[]> = {
  draft: ["ordered", "cancelled"],
  ordered: ["partial", "received", "cancelled"],
  partial: ["received", "cancelled"],
  received: [],
  cancelled: [],
};

export default function PurchaseOrdersPage() {
  const { currentTenant } = useTenantStore();
  const { currentBranch } = useBranchStore();
  const qc = useQueryClient();
  const tid = currentTenant?.id;
  const myRole = currentTenant?.role || "staff";
  const canManage = ["owner", "admin", "manager"].includes(myRole);
  const formatCurrency = useFormatCurrency();

  const [createModal, setCreateModal] = useState(false);
  const [createStep, setCreateStep] = useState<1 | 2 | 3>(1);
  const [viewOrder, setViewOrder] = useState<PurchaseOrder | null>(null);
  const [viewLoading, setViewLoading] = useState(false);
  const toast = useToast();

  const form = useForm<CreateForm>({
    resolver: zodResolver(createSchema),
    defaultValues: { items: [] },
  });
  const { fields, append, remove } = useFieldArray({ control: form.control, name: "items" });

  const { data: orders = [], isLoading } = useQuery<PurchaseOrder[]>({
    queryKey: ["purchase-orders", tid, currentBranch?.id],
    queryFn: () => api.get(`/api/tenants/${tid}/purchase-orders`, { params: { branchId: currentBranch?.id } }).then((r) => r.data),
    enabled: !!tid,
  });

  const { data: suppliers = [] } = useQuery<Supplier[]>({
    queryKey: ["suppliers", tid],
    queryFn: () => api.get(`/api/tenants/${tid}/suppliers`).then((r) => r.data),
    enabled: !!tid,
  });

  const { data: products = [] } = useQuery<Product[]>({
    queryKey: ["products", tid],
    queryFn: () => api.get(`/api/tenants/${tid}/products`).then((r) => r.data),
    enabled: !!tid,
  });

  const closeCreateModal = () => {
    setCreateModal(false);
    form.reset({ items: [] });
    setCreateStep(1);
  };

  const createOrder = useMutation({
    mutationFn: (data: CreateForm & { branchId?: string }) =>
      api.post(`/api/tenants/${tid}/purchase-orders`, {
        ...data,
        taxAmount: data.taxAmount ? Number(data.taxAmount) : 0,
        items: data.items.map((i) => ({ ...i, quantity: Number(i.quantity), unitCost: Number(i.unitCost) })),
      }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["purchase-orders", tid] }); toast.success("Purchase order created"); closeCreateModal(); },
    onError: () => toast.error("Failed to create purchase order"),
  });

  const updateStatus = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      api.patch(`/api/tenants/${tid}/purchase-orders/${id}`, { status }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["purchase-orders", tid] }); toast.success("Order status updated"); },
    onError: () => toast.error("Failed to update order status"),
  });

  const deleteOrder = useMutation({
    mutationFn: (id: string) => api.delete(`/api/tenants/${tid}/purchase-orders/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["purchase-orders", tid] }); toast.success("Purchase order deleted"); },
    onError: () => toast.error("Failed to delete purchase order"),
  });

  const allVariants = products.flatMap((p) =>
    p.variants.map((v) => ({ ...v, productName: p.name, productId: p.id }))
  );

  const addItem = (variantId: string) => {
    const v = allVariants.find((x) => x.id === variantId);
    if (!v) return;
    append({ variantId: v.id, productName: v.productName, variantName: v.name, sku: v.sku, quantity: 1, unitCost: parseFloat(v.costPrice) });
  };

  const openView = async (order: PurchaseOrder) => {
    setViewLoading(true);
    setViewOrder(order);
    try {
      const { data } = await api.get(`/api/tenants/${tid}/purchase-orders/${order.id}`);
      setViewOrder(data);
    } finally {
      setViewLoading(false);
    }
  };

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
          <h1 className="text-2xl font-bold text-ink">Purchase Orders</h1>
          <p className="text-muted text-sm mt-1">{orders.length} order{orders.length !== 1 ? "s" : ""}</p>
        </div>
        {canManage && (
          <Button onClick={() => setCreateModal(true)} className="gap-2">
            <Plus className="w-4 h-4" /> New order
          </Button>
        )}
      </div>

      <Card>
        {orders.length === 0 ? (
          <CardContent className="p-0">
            <div className="flex flex-col items-center justify-center py-20 px-6 text-center">
              <div className="w-14 h-14 bg-primary-50 border border-primary-200 flex items-center justify-center mb-5">
                <ShoppingBag className="w-7 h-7 text-primary-500" />
              </div>
              <h3 className="text-base font-semibold text-ink mb-1">No purchase orders yet</h3>
              <p className="text-sm text-muted max-w-xs mb-6">Create purchase orders to track inventory restocking from suppliers</p>
              {canManage && <Button onClick={() => setCreateModal(true)}>Create first order</Button>}
            </div>
          </CardContent>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-stroke text-left">
                  <th className="px-6 py-3 text-xs font-semibold text-muted uppercase tracking-wider">Order #</th>
                  <th className="px-6 py-3 text-xs font-semibold text-muted uppercase tracking-wider">Supplier</th>
                  <th className="px-6 py-3 text-xs font-semibold text-muted uppercase tracking-wider">Status</th>
                  <th className="px-6 py-3 text-xs font-semibold text-muted uppercase tracking-wider">Total</th>
                  <th className="px-6 py-3 text-xs font-semibold text-muted uppercase tracking-wider hidden md:table-cell">Expected</th>
                  <th className="px-6 py-3 text-xs font-semibold text-muted uppercase tracking-wider hidden lg:table-cell">Date</th>
                  <th className="px-6 py-3" />
                </tr>
              </thead>
              <tbody>
                {orders.map((o) => (
                  <tr key={o.id} className="border-b border-stroke hover:bg-hover transition-colors">
                    <td className="px-6 py-3 font-mono text-xs font-medium text-ink">{o.orderNumber}</td>
                    <td className="px-6 py-3 text-muted">{o.supplierName || "—"}</td>
                    <td className="px-6 py-3">
                      <Badge variant={statusColor[o.status]}>{o.status}</Badge>
                    </td>
                    <td className="px-6 py-3 font-semibold text-ink">{formatCurrency(o.totalAmount)}</td>
                    <td className="px-6 py-3 text-muted hidden md:table-cell">{o.expectedDate ? formatDate(o.expectedDate) : "—"}</td>
                    <td className="px-6 py-3 text-muted hidden lg:table-cell">{formatDate(o.createdAt)}</td>
                    <td className="px-6 py-3">
                      <div className="flex items-center gap-1 justify-end">
                        <Button variant="ghost" size="sm" onClick={() => openView(o)}>
                          <Eye className="w-4 h-4" />
                        </Button>
                        {canManage && nextStatuses[o.status]?.map((s) => (
                          <Button key={s} variant="outline" size="sm" onClick={() => updateStatus.mutate({ id: o.id, status: s })}>
                            {s}
                          </Button>
                        ))}
                        {canManage && ["draft", "cancelled"].includes(o.status) && (
                          <Button variant="ghost" size="sm" onClick={() => { if (confirm("Delete this purchase order?")) deleteOrder.mutate(o.id); }}>
                            <Trash2 className="w-4 h-4 text-red-400" />
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Create modal */}
      <Modal open={createModal} onClose={closeCreateModal} title={`New purchase order — Step ${createStep} of 3`} size="lg">
        {/* Step indicator */}
        <div className="flex items-center gap-1 mb-4">
          {([1, 2, 3] as const).map((s, i) => (
            <React.Fragment key={s}>
              <div className={`w-6 h-6 flex items-center justify-center text-xs font-semibold ${createStep >= s ? "bg-primary-600 text-white" : "bg-stroke text-muted"}`}>{s}</div>
              {i < 2 && <div className="flex-1 h-px bg-stroke" />}
            </React.Fragment>
          ))}
        </div>

        {createStep === 1 && (
          <div className="flex flex-col gap-4">
            <Select label="Supplier (optional)" {...form.register("supplierId")}>
              <option value="">— No supplier —</option>
              {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </Select>
            <Input label="Expected delivery date" type="date" {...form.register("expectedDate")} />
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-muted">Notes</label>
              <textarea rows={2} {...form.register("notes")} className="w-full border border-stroke bg-panel text-ink px-3 py-2 text-sm placeholder:text-muted focus:outline-none focus:border-primary-500 resize-none" placeholder="Order notes…" />
            </div>
            <div className="flex gap-3 justify-end pt-2">
              <Button type="button" variant="outline" onClick={closeCreateModal}>Cancel</Button>
              <Button type="button" onClick={() => setCreateStep(2)}>Next →</Button>
            </div>
          </div>
        )}

        {createStep === 2 && (
          <div className="flex flex-col gap-4">
            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-medium text-ink">Items</p>
                <Select className="w-auto text-sm" onChange={(e) => { if (e.target.value) addItem(e.target.value); e.target.value = ""; }}>
                  <option value="">+ Add item</option>
                  {allVariants.map((v) => <option key={v.id} value={v.id}>{v.productName} — {v.name}</option>)}
                </Select>
              </div>
              {fields.length === 0 ? (
                <p className="text-sm text-muted border border-dashed border-stroke p-4 text-center">No items added. Use the dropdown to add items.</p>
              ) : (
                <div className="space-y-2">
                  {fields.map((field, i) => (
                    <div key={field.id} className="flex items-center gap-2 bg-page border border-stroke px-3 py-2">
                      <div className="flex-1">
                        <p className="text-sm font-medium text-ink">{field.productName} — {field.variantName}</p>
                        <p className="text-xs text-muted">{field.sku}</p>
                      </div>
                      <div className="flex items-center gap-1">
                        <span className="text-xs text-muted">Qty</span>
                        <input type="number" min="1" {...form.register(`items.${i}.quantity`, { valueAsNumber: true })} className="w-14 border border-stroke bg-panel text-ink px-2 py-1 text-sm text-center outline-none focus:border-primary-500" />
                      </div>
                      <div className="flex items-center gap-1">
                        <span className="text-xs text-muted">Cost</span>
                        <input type="number" min="0" step="0.01" {...form.register(`items.${i}.unitCost`, { valueAsNumber: true })} className="w-20 border border-stroke bg-panel text-ink px-2 py-1 text-sm text-center outline-none focus:border-primary-500" />
                      </div>
                      <button type="button" onClick={() => remove(i)} className="text-red-400 hover:text-red-600">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
              {form.formState.errors.items && (
                <p className="text-xs text-red-600 mt-1">{form.formState.errors.items.message || form.formState.errors.items.root?.message}</p>
              )}
            </div>
            <div className="flex gap-3 justify-end pt-2">
              <Button type="button" variant="outline" onClick={() => setCreateStep(1)}>← Back</Button>
              <Button type="button" onClick={() => {
                if (fields.length === 0) { form.setError("items", { message: "At least one item required" }); return; }
                setCreateStep(3);
              }}>Next →</Button>
            </div>
          </div>
        )}

        {createStep === 3 && (
          <form
            onSubmit={form.handleSubmit((d) => createOrder.mutate({ ...d, branchId: currentBranch?.id }))}
            className="flex flex-col gap-4"
          >
            <Input label="Tax amount" type="number" step="0.01" min="0" {...form.register("taxAmount", { valueAsNumber: true })} />
            <div className="bg-page border border-stroke p-4">
              <p className="text-sm font-medium text-ink mb-2">Order summary</p>
              <div className="space-y-1 text-sm">
                {fields.map((f, i) => (
                  <div key={f.id} className="flex justify-between text-muted">
                    <span>{f.productName} — {f.variantName} × {form.watch(`items.${i}.quantity`)}</span>
                    <span>{formatCurrency((form.watch(`items.${i}.quantity`) || 1) * (form.watch(`items.${i}.unitCost`) || 0))}</span>
                  </div>
                ))}
                <div className="flex justify-between font-semibold text-ink border-t border-stroke pt-1 mt-1">
                  <span>Total</span>
                  <span>{formatCurrency(fields.reduce((s, _, i) => s + (form.watch(`items.${i}.quantity`) || 1) * (form.watch(`items.${i}.unitCost`) || 0), 0) + (form.watch("taxAmount") || 0))}</span>
                </div>
              </div>
            </div>
            <div className="flex gap-3 justify-end pt-2">
              <Button type="button" variant="outline" onClick={() => setCreateStep(2)}>← Back</Button>
              <Button type="submit" loading={createOrder.isPending}>Create order</Button>
            </div>
          </form>
        )}
      </Modal>

      {/* View order modal */}
      {viewOrder && (
        <Modal open={!!viewOrder} onClose={() => setViewOrder(null)} title={`Order ${viewOrder.orderNumber}`} size="lg">
          {viewLoading ? (
            <div className="py-12 text-center text-muted text-sm">Loading…</div>
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div><span className="text-muted">Status: </span><Badge variant={statusColor[viewOrder.status]}>{viewOrder.status}</Badge></div>
                <div><span className="text-muted">Supplier: </span><span className="text-ink">{viewOrder.supplierName || "—"}</span></div>
                <div><span className="text-muted">Branch: </span><span className="text-ink">{viewOrder.branchName || "—"}</span></div>
                <div><span className="text-muted">Date: </span><span className="text-ink">{formatDate(viewOrder.createdAt)}</span></div>
                {viewOrder.expectedDate && <div><span className="text-muted">Expected: </span><span className="text-ink">{formatDate(viewOrder.expectedDate)}</span></div>}
                {viewOrder.receivedAt && <div><span className="text-muted">Received: </span><span className="text-ink">{formatDate(viewOrder.receivedAt)}</span></div>}
              </div>
              {viewOrder.items && viewOrder.items.length > 0 && (
                <table className="w-full text-sm border border-stroke">
                  <thead className="bg-page">
                    <tr>
                      <th className="text-left px-4 py-2 font-medium text-muted">Item</th>
                      <th className="text-center px-4 py-2 font-medium text-muted">Ordered</th>
                      <th className="text-center px-4 py-2 font-medium text-muted">Received</th>
                      <th className="text-right px-4 py-2 font-medium text-muted">Unit Cost</th>
                      <th className="text-right px-4 py-2 font-medium text-muted">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {viewOrder.items.map((item) => (
                      <tr key={item.id} className="border-t border-stroke">
                        <td className="px-4 py-2 text-ink">{item.productName} — {item.variantName}<br /><span className="text-xs text-muted">{item.sku}</span></td>
                        <td className="px-4 py-2 text-center text-ink">{item.quantity}</td>
                        <td className="px-4 py-2 text-center text-ink">{item.receivedQuantity}</td>
                        <td className="px-4 py-2 text-right text-muted">{formatCurrency(item.unitCost)}</td>
                        <td className="px-4 py-2 text-right font-medium text-ink">{formatCurrency(item.totalCost)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="border-t border-stroke bg-page">
                    <tr><td colSpan={4} className="px-4 py-2 text-right text-muted">Subtotal</td><td className="px-4 py-2 text-right text-ink">{formatCurrency(viewOrder.subtotal)}</td></tr>
                    {Number(viewOrder.taxAmount) > 0 && <tr><td colSpan={4} className="px-4 py-2 text-right text-muted">Tax</td><td className="px-4 py-2 text-right text-ink">{formatCurrency(viewOrder.taxAmount)}</td></tr>}
                    <tr><td colSpan={4} className="px-4 py-2 text-right font-semibold text-ink">Total</td><td className="px-4 py-2 text-right font-bold text-lg text-ink">{formatCurrency(viewOrder.totalAmount)}</td></tr>
                  </tfoot>
                </table>
              )}
              {viewOrder.notes && (
                <div className="bg-page border border-stroke p-3">
                  <p className="text-xs text-muted font-medium mb-1">Notes</p>
                  <p className="text-sm text-ink">{viewOrder.notes}</p>
                </div>
              )}
              {canManage && nextStatuses[viewOrder.status]?.length > 0 && (
                <div className="flex gap-2 justify-end pt-2">
                  {nextStatuses[viewOrder.status].map((s) => (
                    <Button key={s} variant="outline" size="sm" onClick={() => { updateStatus.mutate({ id: viewOrder.id, status: s }); setViewOrder({ ...viewOrder, status: s }); }}>
                      Mark as {s}
                    </Button>
                  ))}
                </div>
              )}
            </div>
          )}
        </Modal>
      )}
    </div>
  );
}
