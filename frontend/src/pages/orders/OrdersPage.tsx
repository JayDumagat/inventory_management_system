import React, { useState, useMemo } from "react";
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
import { Pagination } from "../../components/ui/Pagination";
import { Skeleton, SkeletonTable } from "../../components/ui/Skeleton";
import { useToast } from "../../hooks/useToast";
import { useFormatCurrency, formatDate } from "../../lib/utils";
import { Plus, Trash2, Eye, RefreshCw, ShoppingCart, GitBranch, AlertTriangle } from "lucide-react";

interface Product { id: string; name: string; variants: { id: string; name: string; sku: string; price: string }[]; }
interface OrderItem { id: string; productName: string; variantName: string; sku: string; quantity: number; unitPrice: string; totalPrice: string; }
interface Order {
  id: string; orderNumber: string; status: string; totalAmount: string; subtotal: string;
  taxAmount: string; discountAmount: string; customerName?: string; customerEmail?: string;
  createdAt: string; branch?: { id: string; name: string }; items: OrderItem[];
}

const statusColor: Record<string, "default" | "success" | "warning" | "danger" | "info"> = {
  draft: "default", confirmed: "info", processing: "warning",
  shipped: "info", delivered: "success", cancelled: "danger", refunded: "warning",
};

const orderItemSchema = z.object({
  variantId: z.string().min(1),
  productName: z.string(),
  variantName: z.string(),
  sku: z.string(),
  quantity: z.number().int().min(1),
  unitPrice: z.number().min(0),
});

const createOrderSchema = z.object({
  customerName: z.string().optional(),
  customerEmail: z.string().email().optional().or(z.literal("")),
  customerPhone: z.string().optional(),
  discountAmount: z.number().min(0).optional(),
  notes: z.string().optional(),
  items: z.array(orderItemSchema).min(1, "At least one item required"),
});

type CreateOrderForm = z.infer<typeof createOrderSchema>;

export default function OrdersPage() {
  const PAGE_SIZE = 10;
  const { currentTenant } = useTenantStore();
  const { currentBranch } = useBranchStore();
  const qc = useQueryClient();
  const tid = currentTenant?.id;
  const taxRate = Number((currentTenant as { taxRate?: string } | null)?.taxRate ?? "0");
  const toast = useToast();
  const formatCurrency = useFormatCurrency();
  const [createModal, setCreateModal] = useState(false);
  const [createStep, setCreateStep] = useState<1 | 2 | 3>(1);
  const [viewOrder, setViewOrder] = useState<Order | null>(null);
  const [refundModal, setRefundModal] = useState<{ open: boolean; order?: Order }>({ open: false });
  const [refundAmount, setRefundAmount] = useState("");
  const [refundReason, setRefundReason] = useState("");
  const [page, setPage] = useState(1);

  const { data: orders = [], isLoading } = useQuery<Order[]>({
    queryKey: ["orders", tid, currentBranch?.id],
    queryFn: () => api.get(`/api/tenants/${tid}/sales-orders`, { params: { branchId: currentBranch?.id } }).then((r) => r.data),
    enabled: !!tid,
  });

  const { data: products = [] } = useQuery<Product[]>({
    queryKey: ["products", tid],
    queryFn: () => api.get(`/api/tenants/${tid}/products`).then((r) => r.data),
    enabled: !!tid,
  });

  const form = useForm<CreateOrderForm>({
    resolver: zodResolver(createOrderSchema),
    defaultValues: { items: [] },
  });
  const { fields, append, remove } = useFieldArray({ control: form.control, name: "items" });

  const closeCreateModal = () => {
    setCreateModal(false);
    form.reset({ items: [] });
    setCreateStep(1);
  };

  const goToOrderStep2 = async () => {
    const valid = await form.trigger(["customerName", "customerEmail", "customerPhone"]);
    if (valid) setCreateStep(2);
  };

  const goToOrderStep3 = () => {
    const items = form.getValues("items");
    if (items.length === 0) {
      form.setError("items", { message: "At least one item is required" });
      return;
    }
    setCreateStep(3);
  };

  const createOrder = useMutation({
    mutationFn: (data: CreateOrderForm & { branchId: string }) =>
      api.post(`/api/tenants/${tid}/sales-orders`, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["orders", tid] });
      closeCreateModal();
      toast.success("Order created");
    },
    onError: () => toast.error("Failed to create order"),
  });

  const updateStatus = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      api.patch(`/api/tenants/${tid}/sales-orders/${id}`, { status }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["orders", tid] });
      toast.success("Order status updated");
    },
    onError: () => toast.error("Failed to update order status"),
  });

  const deleteOrder = useMutation({
    mutationFn: (id: string) => api.delete(`/api/tenants/${tid}/sales-orders/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["orders", tid] });
      toast.success("Order deleted");
    },
    onError: () => toast.error("Failed to delete order"),
  });

  const submitRefund = useMutation({
    mutationFn: ({ id, amount, reason }: { id: string; amount: number; reason: string }) =>
      api.post(`/api/tenants/${tid}/sales-orders/${id}/refund`, { amount, reason }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["orders", tid] });
      setRefundModal({ open: false });
      setRefundAmount("");
      setRefundReason("");
      toast.success("Refund submitted");
    },
    onError: () => toast.error("Failed to submit refund"),
  });

  const allVariants = products.flatMap((p) =>
    p.variants.map((v) => ({ ...v, productName: p.name, productId: p.id }))
  );

  const addItem = (variantId: string) => {
    const v = allVariants.find((x) => x.id === variantId);
    if (!v) return;
    append({ variantId: v.id, productName: v.productName, variantName: v.name, sku: v.sku, quantity: 1, unitPrice: parseFloat(v.price) });
  };

  const nextStatuses: Record<string, string[]> = {
    draft: ["confirmed", "cancelled"],
    confirmed: ["processing", "cancelled"],
    processing: ["shipped", "cancelled"],
    shipped: ["delivered"],
    delivered: [],
    cancelled: [],
    refunded: [],
  };

  const totalPages = Math.max(1, Math.ceil(orders.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pagedOrders = useMemo(
    () => orders.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE),
    [orders, currentPage]
  );

  if (isLoading) return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Skeleton className="h-7 w-28" />
        <Skeleton className="h-9 w-32" />
      </div>
      <div className="border border-stroke">
        <table className="w-full"><SkeletonTable rows={8} cols={6} /></table>
      </div>
    </div>
  );

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-ink">Sales Orders</h1>
          <p className="text-muted text-sm mt-1">{orders.length} orders</p>
        </div>
        <Button onClick={() => setCreateModal(true)} className="gap-2 self-start sm:self-auto" disabled={!currentBranch}>
          <Plus className="w-4 h-4" /> New order
        </Button>
      </div>

      {!currentBranch && (
        <div className="flex items-center gap-2 bg-yellow-50 border border-yellow-200 px-4 py-3 text-sm text-yellow-800">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" />
          <span>Select a branch from the sidebar to create a sales order.</span>
        </div>
      )}

      <Card>
        {orders.length === 0 ? (
          <CardContent className="p-0">
            <div className="flex flex-col items-center justify-center py-20 px-6 text-center">
              <div className="w-14 h-14 bg-primary-50 border border-primary-200 flex items-center justify-center mb-5">
                <ShoppingCart className="w-7 h-7 text-primary-500" />
              </div>
              <h3 className="text-base font-semibold text-ink mb-1">No orders yet</h3>
              <p className="text-sm text-muted max-w-xs mb-6">Create your first sales order to start tracking revenue</p>
              <Button onClick={() => setCreateModal(true)}>Create first order</Button>
            </div>
          </CardContent>
        ) : (
          <>
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-stroke text-left">
                  <th className="px-6 py-3 text-xs font-semibold text-muted uppercase tracking-wider">Order #</th>
                  <th className="px-6 py-3 text-xs font-semibold text-muted uppercase tracking-wider">Customer</th>
                  <th className="px-6 py-3 text-xs font-semibold text-muted uppercase tracking-wider">Branch</th>
                  <th className="px-6 py-3 text-xs font-semibold text-muted uppercase tracking-wider">Status</th>
                  <th className="px-6 py-3 text-xs font-semibold text-muted uppercase tracking-wider">Total</th>
                  <th className="px-6 py-3 text-xs font-semibold text-muted uppercase tracking-wider">Date</th>
                  <th className="px-6 py-3" />
                </tr>
              </thead>
              <tbody>
                {pagedOrders.map((o) => (
                  <tr key={o.id} className="border-b border-stroke hover:bg-hover transition-colors">
                    <td className="px-6 py-3 font-mono text-xs font-medium text-ink">{o.orderNumber}</td>
                    <td className="px-6 py-3 text-muted">{o.customerName || "—"}</td>
                    <td className="px-6 py-3 text-muted">{o.branch?.name || "—"}</td>
                    <td className="px-6 py-3">
                      <Badge variant={statusColor[o.status]}>{o.status}</Badge>
                    </td>
                    <td className="px-6 py-3 font-semibold text-ink">{formatCurrency(o.totalAmount)}</td>
                    <td className="px-6 py-3 text-muted">{formatDate(o.createdAt)}</td>
                    <td className="px-6 py-3">
                      <div className="flex items-center gap-1 justify-end">
                        <Button variant="ghost" size="sm" onClick={() => setViewOrder(o)}>
                          <Eye className="w-4 h-4" />
                        </Button>
                        {nextStatuses[o.status]?.map((s) => (
                          <Button key={s} variant="outline" size="sm" onClick={() => updateStatus.mutate({ id: o.id, status: s })}>
                            {s}
                          </Button>
                        ))}
                        {["delivered", "confirmed", "processing", "shipped"].includes(o.status) && (
                          <Button variant="ghost" size="sm" onClick={() => setRefundModal({ open: true, order: o })}>
                            <RefreshCw className="w-4 h-4 text-yellow-500" />
                          </Button>
                        )}
                        {["draft", "cancelled"].includes(o.status) && (
                          <Button variant="ghost" size="sm" onClick={() => { if (confirm("Delete order?")) deleteOrder.mutate(o.id); }}>
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
          <div className="md:hidden divide-y divide-stroke">
            {pagedOrders.map((o) => (
              <div key={o.id} className="px-4 py-3 space-y-2">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-mono text-xs font-medium text-ink">{o.orderNumber}</p>
                    <p className="text-sm text-ink mt-0.5">{o.customerName || "No customer"}</p>
                    <p className="text-xs text-muted">{o.branch?.name || "—"}</p>
                  </div>
                  <Badge variant={statusColor[o.status]}>{o.status}</Badge>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-ink">{formatCurrency(o.totalAmount)}</p>
                  <p className="text-xs text-muted">{formatDate(o.createdAt)}</p>
                </div>
                <div className="flex flex-wrap items-center gap-1">
                  <Button variant="ghost" size="sm" onClick={() => setViewOrder(o)}>
                    <Eye className="w-4 h-4" />
                  </Button>
                  {nextStatuses[o.status]?.map((s) => (
                    <Button key={s} variant="outline" size="sm" onClick={() => updateStatus.mutate({ id: o.id, status: s })}>
                      {s}
                    </Button>
                  ))}
                  {["delivered", "confirmed", "processing", "shipped"].includes(o.status) && (
                    <Button variant="ghost" size="sm" onClick={() => setRefundModal({ open: true, order: o })}>
                      <RefreshCw className="w-4 h-4 text-yellow-500" />
                    </Button>
                  )}
                  {["draft", "cancelled"].includes(o.status) && (
                    <Button variant="ghost" size="sm" onClick={() => { if (confirm("Delete order?")) deleteOrder.mutate(o.id); }}>
                      <Trash2 className="w-4 h-4 text-red-400" />
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
          </>
        )}
      </Card>
      {orders.length > 0 && (
        <Pagination
          totalItems={orders.length}
          page={currentPage}
          pageSize={PAGE_SIZE}
          onPageChange={setPage}
          itemLabel="orders"
        />
      )}

      {/* Create order modal */}
      <Modal open={createModal} onClose={closeCreateModal} title={`New sales order — Step ${createStep} of 3`} size="lg">
        {/* Step indicator */}
        <div className="flex items-center gap-1 mb-4">
          {([1, 2, 3] as const).map((s, i) => (
            <React.Fragment key={s}>
              <div className={`w-6 h-6 flex items-center justify-center text-xs font-semibold ${createStep >= s ? "bg-primary-600 text-white" : "bg-stroke text-muted"}`}>{s}</div>
              {i < 2 && <div className="flex-1 h-px bg-stroke" />}
            </React.Fragment>
          ))}
        </div>

        {/* Branch context */}
        <div className="flex items-center gap-2 bg-primary-50 border border-primary-200 px-3 py-2 text-xs text-primary-700 mb-4">
          <GitBranch className="w-3.5 h-3.5 flex-shrink-0" />
          <span>Branch: <strong>{currentBranch?.name}</strong></span>
        </div>

        {createStep === 1 && (
          <div className="flex flex-col gap-4">
            <Input label="Customer name" {...form.register("customerName")} />
            <div className="grid grid-cols-2 gap-3">
              <Input label="Customer email" type="email" {...form.register("customerEmail")} error={form.formState.errors.customerEmail?.message} />
              <Input label="Customer phone" {...form.register("customerPhone")} />
            </div>
            <div className="flex gap-3 justify-end pt-2">
              <Button type="button" variant="outline" onClick={closeCreateModal}>Cancel</Button>
              <Button type="button" onClick={goToOrderStep2}>Next →</Button>
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
                <p className="text-sm text-muted border border-dashed border-stroke p-4 text-center">
                  No items added yet. Use the dropdown above to add items.
                </p>
              ) : (
                <div className="space-y-2">
                  {fields.map((field, i) => (
                    <div key={field.id} className="flex items-center gap-2 bg-page border border-stroke px-3 py-2">
                      <div className="flex-1">
                        <p className="text-sm font-medium text-ink">{field.productName} — {field.variantName}</p>
                        <p className="text-xs text-muted">{field.sku}</p>
                      </div>
                      <input type="number" min="1" {...form.register(`items.${i}.quantity`, { valueAsNumber: true })} className="w-16 border border-stroke bg-panel text-ink px-2 py-1 text-sm text-center outline-none focus:border-primary-500" />
                      <p className="text-sm font-medium w-20 text-right text-ink">{formatCurrency((form.watch(`items.${i}.quantity`) || 1) * field.unitPrice)}</p>
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
              <Button type="button" onClick={goToOrderStep3}>Next →</Button>
            </div>
          </div>
        )}

        {createStep === 3 && (
          <form
            onSubmit={form.handleSubmit((d) => createOrder.mutate({
              ...d,
              branchId: currentBranch!.id,
              discountAmount: d.discountAmount !== undefined ? Number(d.discountAmount) : undefined,
              items: d.items.map((i) => ({ ...i, quantity: Number(i.quantity), unitPrice: Number(i.unitPrice) })),
            }))}
            className="flex flex-col gap-4"
          >
            <div className="grid grid-cols-1 gap-3">
              <Input label="Discount amount" type="number" step="0.01" min="0" {...form.register("discountAmount", { valueAsNumber: true })} />
            </div>
            <p className="text-xs text-muted">Tax is auto-applied from Organization Settings ({taxRate.toFixed(2)}%).</p>
            <Input label="Notes" {...form.register("notes")} />
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
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div><span className="text-muted">Status: </span><Badge variant={statusColor[viewOrder.status]}>{viewOrder.status}</Badge></div>
              <div><span className="text-muted">Customer: </span><span className="text-ink">{viewOrder.customerName || "—"}</span></div>
              <div><span className="text-muted">Branch: </span><span className="text-ink">{viewOrder.branch?.name}</span></div>
              <div><span className="text-muted">Date: </span><span className="text-ink">{formatDate(viewOrder.createdAt)}</span></div>
            </div>
            <table className="w-full text-sm border border-stroke overflow-hidden">
              <thead className="bg-page">
                <tr>
                  <th className="text-left px-4 py-2 font-medium text-muted">Item</th>
                  <th className="text-center px-4 py-2 font-medium text-muted">Qty</th>
                  <th className="text-right px-4 py-2 font-medium text-muted">Unit</th>
                  <th className="text-right px-4 py-2 font-medium text-muted">Total</th>
                </tr>
              </thead>
              <tbody>
                {viewOrder.items.map((item) => (
                  <tr key={item.id} className="border-t border-stroke">
                    <td className="px-4 py-2 text-ink">{item.productName} — {item.variantName}<br /><span className="text-xs text-muted">{item.sku}</span></td>
                    <td className="px-4 py-2 text-center text-ink">{item.quantity}</td>
                    <td className="px-4 py-2 text-right text-muted">{formatCurrency(item.unitPrice)}</td>
                    <td className="px-4 py-2 text-right font-medium text-ink">{formatCurrency(item.totalPrice)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="border-t border-stroke bg-page">
                <tr><td colSpan={3} className="px-4 py-2 text-right text-muted">Subtotal</td><td className="px-4 py-2 text-right text-ink">{formatCurrency(viewOrder.subtotal)}</td></tr>
                {Number(viewOrder.taxAmount) > 0 && <tr><td colSpan={3} className="px-4 py-2 text-right text-muted">Tax</td><td className="px-4 py-2 text-right text-ink">{formatCurrency(viewOrder.taxAmount)}</td></tr>}
                {Number(viewOrder.discountAmount) > 0 && <tr><td colSpan={3} className="px-4 py-2 text-right text-muted">Discount</td><td className="px-4 py-2 text-right text-red-600">-{formatCurrency(viewOrder.discountAmount)}</td></tr>}
                <tr><td colSpan={3} className="px-4 py-2 text-right font-semibold text-ink">Total</td><td className="px-4 py-2 text-right font-bold text-lg text-ink">{formatCurrency(viewOrder.totalAmount)}</td></tr>
              </tfoot>
            </table>
          </div>
        </Modal>
      )}

      {/* Refund modal */}
      <Modal open={refundModal.open} onClose={() => setRefundModal({ open: false })} title="Process refund">
        <div className="flex flex-col gap-4">
          <p className="text-sm text-muted">
            Order: <strong className="text-ink">{refundModal.order?.orderNumber}</strong> — Total: {formatCurrency(refundModal.order?.totalAmount || 0)}
          </p>
          <Input label="Refund amount" type="number" step="0.01" min="0.01" value={refundAmount} onChange={(e) => setRefundAmount(e.target.value)} />
          <Input label="Reason (optional)" value={refundReason} onChange={(e) => setRefundReason(e.target.value)} />
          <div className="flex gap-3 justify-end pt-2">
            <Button variant="outline" onClick={() => setRefundModal({ open: false })}>Cancel</Button>
            <Button
              variant="danger"
              loading={submitRefund.isPending}
              onClick={() => refundModal.order && submitRefund.mutate({ id: refundModal.order.id, amount: parseFloat(refundAmount), reason: refundReason })}
            >
              Process refund
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
