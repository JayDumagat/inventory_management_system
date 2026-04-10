import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { api } from "../../api/client";
import { useTenantStore } from "../../stores/tenantStore";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { Select } from "../../components/ui/Select";
import { Card, CardContent } from "../../components/ui/Card";import { Modal } from "../../components/ui/Modal";
import { Badge } from "../../components/ui/Badge";
import { PageLoader } from "../../components/ui/Spinner";
import { formatCurrency, formatDate } from "../../lib/utils";
import { Plus, Trash2, Eye, RefreshCw } from "lucide-react";

interface Branch { id: string; name: string; }
interface Product { id: string; name: string; variants: { id: string; name: string; sku: string; price: string }[]; }
interface OrderItem { id: string; productName: string; variantName: string; sku: string; quantity: number; unitPrice: string; totalPrice: string; }
interface Order {
  id: string; orderNumber: string; status: string; totalAmount: string; subtotal: string;
  taxAmount: string; discountAmount: string; customerName?: string; customerEmail?: string;
  createdAt: string; branch?: Branch; items: OrderItem[];
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
  branchId: z.string().min(1, "Branch required"),
  customerName: z.string().optional(),
  customerEmail: z.string().email().optional().or(z.literal("")),
  customerPhone: z.string().optional(),
  taxAmount: z.number().min(0).optional(),
  discountAmount: z.number().min(0).optional(),
  notes: z.string().optional(),
  items: z.array(orderItemSchema).min(1, "At least one item required"),
});

type CreateOrderForm = z.infer<typeof createOrderSchema>;

export default function OrdersPage() {
  const { currentTenant } = useTenantStore();
  const qc = useQueryClient();
  const tid = currentTenant?.id;
  const [createModal, setCreateModal] = useState(false);
  const [viewOrder, setViewOrder] = useState<Order | null>(null);
  const [refundModal, setRefundModal] = useState<{ open: boolean; order?: Order }>({ open: false });
  const [refundAmount, setRefundAmount] = useState("");
  const [refundReason, setRefundReason] = useState("");

  const { data: orders = [], isLoading } = useQuery<Order[]>({
    queryKey: ["orders", tid],
    queryFn: () => api.get(`/api/tenants/${tid}/sales-orders`).then((r) => r.data),
    enabled: !!tid,
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

  const form = useForm<CreateOrderForm>({
    resolver: zodResolver(createOrderSchema),
    defaultValues: { items: [] },
  });
  const { fields, append, remove } = useFieldArray({ control: form.control, name: "items" });

  const createOrder = useMutation({
    mutationFn: (data: CreateOrderForm) => api.post(`/api/tenants/${tid}/sales-orders`, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["orders", tid] }); setCreateModal(false); form.reset(); },
  });

  const updateStatus = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      api.patch(`/api/tenants/${tid}/sales-orders/${id}`, { status }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["orders", tid] }),
  });

  const deleteOrder = useMutation({
    mutationFn: (id: string) => api.delete(`/api/tenants/${tid}/sales-orders/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["orders", tid] }),
  });

  const submitRefund = useMutation({
    mutationFn: ({ id, amount, reason }: { id: string; amount: number; reason: string }) =>
      api.post(`/api/tenants/${tid}/sales-orders/${id}/refund`, { amount, reason }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["orders", tid] }); setRefundModal({ open: false }); setRefundAmount(""); setRefundReason(""); },
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

  if (isLoading) return <PageLoader />;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Sales Orders</h1>
          <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">{orders.length} orders</p>
        </div>
        <Button onClick={() => setCreateModal(true)} className="gap-2">
          <Plus className="w-4 h-4" /> New order
        </Button>
      </div>

      <Card>
        {orders.length === 0 ? (
          <CardContent className="py-16 text-center">
            <p className="text-gray-400 mb-4">No orders yet</p>
            <Button onClick={() => setCreateModal(true)}>Create first order</Button>
          </CardContent>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 dark:border-gray-800 text-left">
                  <th className="px-6 py-3 font-medium text-gray-500 dark:text-gray-400">Order #</th>
                  <th className="px-6 py-3 font-medium text-gray-500 dark:text-gray-400">Customer</th>
                  <th className="px-6 py-3 font-medium text-gray-500 dark:text-gray-400">Branch</th>
                  <th className="px-6 py-3 font-medium text-gray-500 dark:text-gray-400">Status</th>
                  <th className="px-6 py-3 font-medium text-gray-500 dark:text-gray-400">Total</th>
                  <th className="px-6 py-3 font-medium text-gray-500 dark:text-gray-400">Date</th>
                  <th className="px-6 py-3" />
                </tr>
              </thead>
              <tbody>
                {orders.map((o) => (
                  <tr key={o.id} className="border-b border-gray-50 dark:border-gray-800/50 hover:bg-gray-50 dark:hover:bg-gray-800/40">
                    <td className="px-6 py-3 font-mono text-xs font-medium text-gray-900 dark:text-white">{o.orderNumber}</td>
                    <td className="px-6 py-3 text-gray-600 dark:text-gray-400">{o.customerName || "—"}</td>
                    <td className="px-6 py-3 text-gray-600 dark:text-gray-400">{o.branch?.name || "—"}</td>
                    <td className="px-6 py-3">
                      <Badge variant={statusColor[o.status]}>{o.status}</Badge>
                    </td>
                    <td className="px-6 py-3 font-semibold text-gray-900 dark:text-white">{formatCurrency(o.totalAmount)}</td>
                    <td className="px-6 py-3 text-gray-500 dark:text-gray-400">{formatDate(o.createdAt)}</td>
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
        )}
      </Card>

      {/* Create order modal */}
      <Modal open={createModal} onClose={() => setCreateModal(false)} title="New sales order" size="lg">
        <form onSubmit={form.handleSubmit((d) => createOrder.mutate({
            ...d,
            taxAmount: d.taxAmount !== undefined ? Number(d.taxAmount) : undefined,
            discountAmount: d.discountAmount !== undefined ? Number(d.discountAmount) : undefined,
            items: d.items.map((i) => ({ ...i, quantity: Number(i.quantity), unitPrice: Number(i.unitPrice) })),
          }))} className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-3">
            <Select label="Branch *" {...form.register("branchId")} error={form.formState.errors.branchId?.message}>
              <option value="">Select branch</option>
              {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </Select>
            <Input label="Customer name" {...form.register("customerName")} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input label="Customer email" type="email" {...form.register("customerEmail")} />
            <Input label="Customer phone" {...form.register("customerPhone")} />
          </div>

          {/* Items */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Items</p>
              <Select className="w-auto text-sm" onChange={(e) => { if (e.target.value) addItem(e.target.value); e.target.value = ""; }}>
                <option value="">+ Add item</option>
                {allVariants.map((v) => <option key={v.id} value={v.id}>{v.productName} — {v.name}</option>)}
              </Select>
            </div>
            {fields.length === 0 ? (
              <p className="text-sm text-gray-400 dark:text-gray-500 border border-dashed border-gray-200 dark:border-gray-700 rounded-lg p-4 text-center">
                No items added yet
              </p>
            ) : (
              <div className="space-y-2">
                {fields.map((field, i) => (
                  <div key={field.id} className="flex items-center gap-2 bg-gray-50 dark:bg-gray-800 rounded-lg px-3 py-2">
                    <div className="flex-1">
                      <p className="text-sm font-medium text-gray-900 dark:text-white">{field.productName} — {field.variantName}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">{field.sku}</p>
                    </div>
                    <input type="number" min="1" {...form.register(`items.${i}.quantity`)} className="w-16 border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-white rounded px-2 py-1 text-sm text-center" />
                    <p className="text-sm font-medium w-20 text-right text-gray-900 dark:text-white">{formatCurrency((form.watch(`items.${i}.quantity`) || 1) * field.unitPrice)}</p>
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

          <div className="grid grid-cols-2 gap-3">
            <Input label="Tax amount" type="number" step="0.01" min="0" {...form.register("taxAmount")} />
            <Input label="Discount amount" type="number" step="0.01" min="0" {...form.register("discountAmount")} />
          </div>
          <Input label="Notes" {...form.register("notes")} />

          <div className="flex gap-3 justify-end pt-2">
            <Button type="button" variant="outline" onClick={() => setCreateModal(false)}>Cancel</Button>
            <Button type="submit" loading={createOrder.isPending}>Create order</Button>
          </div>
        </form>
      </Modal>

      {/* View order modal */}
      {viewOrder && (
        <Modal open={!!viewOrder} onClose={() => setViewOrder(null)} title={`Order ${viewOrder.orderNumber}`} size="lg">
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div><span className="text-gray-500 dark:text-gray-400">Status: </span><Badge variant={statusColor[viewOrder.status]}>{viewOrder.status}</Badge></div>
              <div><span className="text-gray-500 dark:text-gray-400">Customer: </span><span className="text-gray-900 dark:text-white">{viewOrder.customerName || "—"}</span></div>
              <div><span className="text-gray-500 dark:text-gray-400">Branch: </span><span className="text-gray-900 dark:text-white">{viewOrder.branch?.name}</span></div>
              <div><span className="text-gray-500 dark:text-gray-400">Date: </span><span className="text-gray-900 dark:text-white">{formatDate(viewOrder.createdAt)}</span></div>
            </div>
            <table className="w-full text-sm border border-gray-100 dark:border-gray-800 rounded-lg overflow-hidden">
              <thead className="bg-gray-50 dark:bg-gray-800">
                <tr>
                  <th className="text-left px-4 py-2 font-medium text-gray-600 dark:text-gray-300">Item</th>
                  <th className="text-center px-4 py-2 font-medium text-gray-600 dark:text-gray-300">Qty</th>
                  <th className="text-right px-4 py-2 font-medium text-gray-600 dark:text-gray-300">Unit</th>
                  <th className="text-right px-4 py-2 font-medium text-gray-600 dark:text-gray-300">Total</th>
                </tr>
              </thead>
              <tbody>
                {viewOrder.items.map((item) => (
                  <tr key={item.id} className="border-t border-gray-100 dark:border-gray-800">
                    <td className="px-4 py-2 text-gray-900 dark:text-white">{item.productName} — {item.variantName}<br /><span className="text-xs text-gray-400 dark:text-gray-500">{item.sku}</span></td>
                    <td className="px-4 py-2 text-center text-gray-900 dark:text-white">{item.quantity}</td>
                    <td className="px-4 py-2 text-right">{formatCurrency(item.unitPrice)}</td>
                    <td className="px-4 py-2 text-right font-medium">{formatCurrency(item.totalPrice)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="border-t border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-800">
                <tr><td colSpan={3} className="px-4 py-2 text-right text-gray-500 dark:text-gray-400">Subtotal</td><td className="px-4 py-2 text-right text-gray-900 dark:text-white">{formatCurrency(viewOrder.subtotal)}</td></tr>
                {Number(viewOrder.taxAmount) > 0 && <tr><td colSpan={3} className="px-4 py-2 text-right text-gray-500 dark:text-gray-400">Tax</td><td className="px-4 py-2 text-right text-gray-900 dark:text-white">{formatCurrency(viewOrder.taxAmount)}</td></tr>}
                {Number(viewOrder.discountAmount) > 0 && <tr><td colSpan={3} className="px-4 py-2 text-right text-gray-500 dark:text-gray-400">Discount</td><td className="px-4 py-2 text-right text-red-600 dark:text-red-400">-{formatCurrency(viewOrder.discountAmount)}</td></tr>}
                <tr><td colSpan={3} className="px-4 py-2 text-right font-semibold text-gray-900 dark:text-white">Total</td><td className="px-4 py-2 text-right font-bold text-lg text-gray-900 dark:text-white">{formatCurrency(viewOrder.totalAmount)}</td></tr>
              </tfoot>
            </table>
          </div>
        </Modal>
      )}

      {/* Refund modal */}
      <Modal open={refundModal.open} onClose={() => setRefundModal({ open: false })} title="Process refund">
        <div className="flex flex-col gap-4">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Order: <strong>{refundModal.order?.orderNumber}</strong> — Total: {formatCurrency(refundModal.order?.totalAmount || 0)}
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
