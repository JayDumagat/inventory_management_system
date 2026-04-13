import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../../api/client";
import { useTenantStore } from "../../stores/tenantStore";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { Card, CardContent } from "../../components/ui/Card";
import { Modal } from "../../components/ui/Modal";
import { Badge } from "../../components/ui/Badge";
import { Skeleton, SkeletonTable } from "../../components/ui/Skeleton";
import { formatCurrency, formatDate } from "../../lib/utils";
import { Plus, Trash2, Eye, FileText, X } from "lucide-react";
import { useToast } from "../../hooks/useToast";

interface InvoiceItem {
  id: string;
  description: string;
  quantity: number;
  unitPrice: string;
  totalPrice: string;
}

interface Invoice {
  id: string;
  invoiceNumber: string;
  status: "draft" | "sent" | "paid" | "overdue" | "cancelled";
  customerName: string | null;
  customerEmail: string | null;
  customerPhone: string | null;
  customerAddress: string | null;
  subtotal: string;
  taxAmount: string;
  discountAmount: string;
  totalAmount: string;
  notes: string | null;
  dueDate: string | null;
  paidAt: string | null;
  createdAt: string;
  items: InvoiceItem[];
  order?: { orderNumber: string } | null;
  branch?: { name: string } | null;
}

interface SalesOrder {
  id: string;
  orderNumber: string;
  customerName: string | null;
  totalAmount: string;
  status: string;
}

const STATUS_VARIANT: Record<string, "default" | "success" | "warning" | "danger" | "info"> = {
  draft: "default",
  sent: "info",
  paid: "success",
  overdue: "danger",
  cancelled: "default",
};

type NewItem = { description: string; quantity: number; unitPrice: number; totalPrice: number };

export default function InvoicesPage() {
  const { currentTenant } = useTenantStore();
  const qc = useQueryClient();
  const tid = currentTenant?.id;

  const [createOpen, setCreateOpen] = useState(false);
  const [viewInvoice, setViewInvoice] = useState<Invoice | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Invoice | null>(null);
  const [fromOrderId, setFromOrderId] = useState("");
  const [items, setItems] = useState<NewItem[]>([{ description: "", quantity: 1, unitPrice: 0, totalPrice: 0 }]);
  const [form, setForm] = useState({ customerName: "", customerEmail: "", customerPhone: "", customerAddress: "", taxAmount: "0", discountAmount: "0", notes: "", dueDate: "" });
  const [createError, setCreateError] = useState("");
  const [statusUpdating, setStatusUpdating] = useState<string | null>(null);
  const toast = useToast();

  const { data: invoices = [], isLoading } = useQuery<Invoice[]>({
    queryKey: ["invoices", tid],
    queryFn: () => api.get(`/api/tenants/${tid}/invoices`).then((r) => r.data),
    enabled: !!tid,
  });

  const { data: orders = [] } = useQuery<SalesOrder[]>({
    queryKey: ["sales-orders", tid],
    queryFn: () => api.get(`/api/tenants/${tid}/sales-orders`).then((r) => r.data),
    enabled: !!tid,
  });

  const createMutation = useMutation({
    mutationFn: (data: object) => api.post(`/api/tenants/${tid}/invoices`, data).then((r) => r.data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["invoices", tid] }); setCreateOpen(false); resetForm(); toast.success("Invoice created"); },
    onError: (e: unknown) => setCreateError((e as { response?: { data?: { error?: string } } })?.response?.data?.error ?? "Failed to create invoice"),
  });

  const fromOrderMutation = useMutation({
    mutationFn: (orderId: string) => api.post(`/api/tenants/${tid}/invoices/from-order/${orderId}`).then((r) => r.data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["invoices", tid] }); setCreateOpen(false); resetForm(); toast.success("Invoice created from order"); },
    onError: (e: unknown) => setCreateError((e as { response?: { data?: { error?: string } } })?.response?.data?.error ?? "Failed to create invoice from order"),
  });

  const updateStatusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      api.patch(`/api/tenants/${tid}/invoices/${id}`, { status }).then((r) => r.data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["invoices", tid] }); setStatusUpdating(null); toast.success("Invoice status updated"); },
    onError: () => toast.error("Failed to update invoice status"),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/api/tenants/${tid}/invoices/${id}`).then((r) => r.data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["invoices", tid] }); setDeleteTarget(null); toast.success("Invoice deleted"); },
    onError: () => toast.error("Failed to delete invoice"),
  });

  function resetForm() {
    setForm({ customerName: "", customerEmail: "", customerPhone: "", customerAddress: "", taxAmount: "0", discountAmount: "0", notes: "", dueDate: "" });
    setItems([{ description: "", quantity: 1, unitPrice: 0, totalPrice: 0 }]);
    setFromOrderId("");
    setCreateError("");
  }

  function updateItem(idx: number, field: keyof NewItem, val: string) {
    setItems((prev) => {
      const next = [...prev];
      const item = { ...next[idx] };
      if (field === "description") item.description = val;
      else {
        (item[field] as number) = parseFloat(val) || 0;
      }
      if (field === "quantity" || field === "unitPrice") {
        item.totalPrice = item.quantity * item.unitPrice;
      }
      next[idx] = item;
      return next;
    });
  }

  function handleCreate() {
    setCreateError("");
    if (fromOrderId) {
      fromOrderMutation.mutate(fromOrderId);
      return;
    }
    const validItems = items.filter((i) => i.description.trim());
    if (validItems.length === 0) { setCreateError("Add at least one item"); return; }
    createMutation.mutate({
      customerName: form.customerName || null,
      customerEmail: form.customerEmail || null,
      customerPhone: form.customerPhone || null,
      customerAddress: form.customerAddress || null,
      taxAmount: parseFloat(form.taxAmount) || 0,
      discountAmount: parseFloat(form.discountAmount) || 0,
      notes: form.notes || null,
      dueDate: form.dueDate || null,
      items: validItems,
    });
  }

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

  const confirmedOrders = orders.filter((o) => o.status !== "draft" && o.status !== "cancelled");

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-ink">Invoices</h1>
          <p className="text-muted text-sm mt-0.5">{invoices.length} invoice{invoices.length !== 1 ? "s" : ""}</p>
        </div>
        <Button onClick={() => { resetForm(); setCreateOpen(true); }} size="sm">
          <Plus className="w-3.5 h-3.5 mr-1.5" /> New Invoice
        </Button>
      </div>

      {invoices.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <FileText className="w-10 h-10 text-muted mx-auto mb-3" />
            <p className="text-ink font-medium">No invoices yet</p>
            <p className="text-muted text-sm mt-1">Create your first invoice or generate one from a sales order</p>
            <Button size="sm" className="mt-4" onClick={() => { resetForm(); setCreateOpen(true); }}>
              <Plus className="w-3.5 h-3.5 mr-1.5" /> Create invoice
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-stroke">
                  <th className="px-4 py-3 text-left text-xs font-semibold text-muted uppercase tracking-wider">Invoice #</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-muted uppercase tracking-wider">Customer</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-muted uppercase tracking-wider">Status</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-muted uppercase tracking-wider">Total</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-muted uppercase tracking-wider">Due Date</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-muted uppercase tracking-wider">Created</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {invoices.map((inv) => (
                  <tr key={inv.id} className="border-b border-stroke hover:bg-hover transition-colors">
                    <td className="px-4 py-3 font-mono font-medium text-ink">{inv.invoiceNumber}</td>
                    <td className="px-4 py-3 text-ink">{inv.customerName ?? <span className="text-muted">—</span>}</td>
                    <td className="px-4 py-3">
                      <Badge variant={STATUS_VARIANT[inv.status]}>{inv.status}</Badge>
                    </td>
                    <td className="px-4 py-3 font-semibold text-ink">{formatCurrency(inv.totalAmount)}</td>
                    <td className="px-4 py-3 text-muted">{inv.dueDate ? formatDate(inv.dueDate) : "—"}</td>
                    <td className="px-4 py-3 text-muted">{formatDate(inv.createdAt)}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2 justify-end">
                        <select
                          value={inv.status}
                          onChange={(e) => { setStatusUpdating(inv.id); updateStatusMutation.mutate({ id: inv.id, status: e.target.value }); }}
                          disabled={statusUpdating === inv.id}
                          className="text-xs border border-stroke bg-page text-ink px-1.5 py-1 focus:outline-none focus:ring-1 focus:ring-primary-400"
                        >
                          {["draft", "sent", "paid", "overdue", "cancelled"].map((s) => (
                            <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
                          ))}
                        </select>
                        <button onClick={() => setViewInvoice(inv)} className="p-1.5 text-muted hover:text-ink hover:bg-hover transition-colors">
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                        {inv.status === "draft" && (
                          <button onClick={() => setDeleteTarget(inv)} className="p-1.5 text-muted hover:text-red-600 hover:bg-red-50 transition-colors">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Create Modal */}
      <Modal open={createOpen} onClose={() => setCreateOpen(false)} title="New Invoice" size="lg">
        <div className="p-5 space-y-4">
          {/* From order shortcut */}
          {confirmedOrders.length > 0 && (
            <div className="p-3 bg-page border border-stroke space-y-2">
              <p className="text-xs font-semibold text-muted uppercase tracking-wider">Quick create from sales order</p>
              <div className="flex gap-2">
                <select
                  value={fromOrderId}
                  onChange={(e) => setFromOrderId(e.target.value)}
                  className="flex-1 text-sm border border-stroke bg-page text-ink px-2.5 py-2 focus:outline-none focus:ring-1 focus:ring-primary-400"
                >
                  <option value="">Select order…</option>
                  {confirmedOrders.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.orderNumber} — {o.customerName ?? "No customer"} ({formatCurrency(o.totalAmount)})
                    </option>
                  ))}
                </select>
              </div>
              {fromOrderId && (
                <p className="text-xs text-muted">Invoice will be auto-filled from the selected order.</p>
              )}
            </div>
          )}

          {!fromOrderId && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <Input label="Customer Name" value={form.customerName} onChange={(e) => setForm((f) => ({ ...f, customerName: e.target.value }))} />
                <Input label="Customer Email" type="email" value={form.customerEmail} onChange={(e) => setForm((f) => ({ ...f, customerEmail: e.target.value }))} />
                <Input label="Phone" value={form.customerPhone} onChange={(e) => setForm((f) => ({ ...f, customerPhone: e.target.value }))} />
                <Input label="Due Date" type="date" value={form.dueDate} onChange={(e) => setForm((f) => ({ ...f, dueDate: e.target.value }))} />
              </div>
              <Input label="Address" value={form.customerAddress} onChange={(e) => setForm((f) => ({ ...f, customerAddress: e.target.value }))} />

              {/* Line items */}
              <div>
                <p className="text-xs font-semibold text-muted uppercase tracking-wider mb-2">Line Items</p>
                <div className="space-y-2">
                  {items.map((item, idx) => (
                    <div key={idx} className="grid grid-cols-12 gap-2 items-end">
                      <div className="col-span-5">
                        <input
                          placeholder="Description"
                          value={item.description}
                          onChange={(e) => updateItem(idx, "description", e.target.value)}
                          className="w-full text-sm border border-stroke bg-page text-ink px-2.5 py-2 focus:outline-none focus:ring-1 focus:ring-primary-400 placeholder:text-muted"
                        />
                      </div>
                      <div className="col-span-2">
                        <input
                          type="number"
                          min="1"
                          placeholder="Qty"
                          value={item.quantity}
                          onChange={(e) => updateItem(idx, "quantity", e.target.value)}
                          className="w-full text-sm border border-stroke bg-page text-ink px-2.5 py-2 focus:outline-none focus:ring-1 focus:ring-primary-400"
                        />
                      </div>
                      <div className="col-span-2">
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          placeholder="Price"
                          value={item.unitPrice}
                          onChange={(e) => updateItem(idx, "unitPrice", e.target.value)}
                          className="w-full text-sm border border-stroke bg-page text-ink px-2.5 py-2 focus:outline-none focus:ring-1 focus:ring-primary-400"
                        />
                      </div>
                      <div className="col-span-2 text-sm text-muted text-right">
                        {formatCurrency(item.totalPrice)}
                      </div>
                      <div className="col-span-1 flex justify-center">
                        {items.length > 1 && (
                          <button onClick={() => setItems((p) => p.filter((_, i) => i !== idx))} className="p-1 text-muted hover:text-red-600">
                            <X className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
                <button
                  onClick={() => setItems((p) => [...p, { description: "", quantity: 1, unitPrice: 0, totalPrice: 0 }])}
                  className="mt-2 text-xs text-primary-600 hover:underline flex items-center gap-1"
                >
                  <Plus className="w-3 h-3" /> Add item
                </button>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <Input label="Tax Amount ($)" type="number" min="0" step="0.01" value={form.taxAmount} onChange={(e) => setForm((f) => ({ ...f, taxAmount: e.target.value }))} />
                <Input label="Discount ($)" type="number" min="0" step="0.01" value={form.discountAmount} onChange={(e) => setForm((f) => ({ ...f, discountAmount: e.target.value }))} />
              </div>
              <Input label="Notes" value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} />
            </>
          )}

          {createError && <p className="text-sm text-red-600">{createError}</p>}
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" size="sm" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button size="sm" onClick={handleCreate} disabled={createMutation.isPending || fromOrderMutation.isPending}>
              {createMutation.isPending || fromOrderMutation.isPending ? "Creating…" : "Create Invoice"}
            </Button>
          </div>
        </div>
      </Modal>

      {/* View Invoice Modal */}
      {viewInvoice && (
        <Modal open={!!viewInvoice} onClose={() => setViewInvoice(null)} title={`Invoice ${viewInvoice.invoiceNumber}`} size="lg">
          <div className="p-5 space-y-4 text-sm">
            <div className="flex items-center justify-between">
              <Badge variant={STATUS_VARIANT[viewInvoice.status]}>{viewInvoice.status}</Badge>
              <p className="text-muted text-xs">Created {formatDate(viewInvoice.createdAt)}</p>
            </div>
            {(viewInvoice.customerName || viewInvoice.customerEmail) && (
              <div className="p-3 border border-stroke">
                <p className="text-xs font-semibold text-muted uppercase tracking-wider mb-1.5">Bill To</p>
                {viewInvoice.customerName && <p className="font-medium text-ink">{viewInvoice.customerName}</p>}
                {viewInvoice.customerEmail && <p className="text-muted">{viewInvoice.customerEmail}</p>}
                {viewInvoice.customerPhone && <p className="text-muted">{viewInvoice.customerPhone}</p>}
                {viewInvoice.customerAddress && <p className="text-muted">{viewInvoice.customerAddress}</p>}
              </div>
            )}
            {viewInvoice.order && (
              <p className="text-muted">Sales order: <span className="text-ink font-mono">{viewInvoice.order.orderNumber}</span></p>
            )}
            <table className="w-full">
              <thead>
                <tr className="border-b border-stroke text-left">
                  <th className="py-1.5 text-xs font-semibold text-muted uppercase">Description</th>
                  <th className="py-1.5 text-xs font-semibold text-muted uppercase text-right">Qty</th>
                  <th className="py-1.5 text-xs font-semibold text-muted uppercase text-right">Unit Price</th>
                  <th className="py-1.5 text-xs font-semibold text-muted uppercase text-right">Total</th>
                </tr>
              </thead>
              <tbody>
                {viewInvoice.items.map((item) => (
                  <tr key={item.id} className="border-b border-stroke">
                    <td className="py-1.5 text-ink">{item.description}</td>
                    <td className="py-1.5 text-muted text-right">{item.quantity}</td>
                    <td className="py-1.5 text-muted text-right">{formatCurrency(item.unitPrice)}</td>
                    <td className="py-1.5 text-ink font-medium text-right">{formatCurrency(item.totalPrice)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="space-y-1 text-right">
              <p className="text-muted">Subtotal: <span className="text-ink font-medium">{formatCurrency(viewInvoice.subtotal)}</span></p>
              {parseFloat(viewInvoice.taxAmount) > 0 && <p className="text-muted">Tax: <span className="text-ink">{formatCurrency(viewInvoice.taxAmount)}</span></p>}
              {parseFloat(viewInvoice.discountAmount) > 0 && <p className="text-muted">Discount: <span className="text-red-600">−{formatCurrency(viewInvoice.discountAmount)}</span></p>}
              <p className="text-base font-bold text-ink">Total: {formatCurrency(viewInvoice.totalAmount)}</p>
            </div>
            {viewInvoice.dueDate && <p className="text-muted">Due: {formatDate(viewInvoice.dueDate)}</p>}
            {viewInvoice.paidAt && <p className="text-green-600">Paid on: {formatDate(viewInvoice.paidAt)}</p>}
            {viewInvoice.notes && <p className="text-muted italic">{viewInvoice.notes}</p>}
          </div>
        </Modal>
      )}

      {/* Delete Confirm */}
      <Modal open={!!deleteTarget} onClose={() => setDeleteTarget(null)} title="Delete Invoice" size="sm">
        <div className="p-5">
          <p className="text-sm text-ink mb-4">
            Delete invoice <span className="font-mono font-medium">{deleteTarget?.invoiceNumber}</span>? This cannot be undone.
          </p>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={() => setDeleteTarget(null)}>Cancel</Button>
            <Button variant="danger" size="sm" onClick={() => deleteMutation.mutate(deleteTarget!.id)} disabled={deleteMutation.isPending}>
              {deleteMutation.isPending ? "Deleting…" : "Delete"}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
