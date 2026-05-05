import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../../api/client";
import { useTenantStore } from "../../stores/tenantStore";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { Card, CardContent } from "../../components/ui/Card";
import { Modal } from "../../components/ui/Modal";
import { Badge } from "../../components/ui/Badge";
import { Pagination } from "../../components/ui/Pagination";
import { Skeleton, SkeletonTable } from "../../components/ui/Skeleton";
import { useFormatCurrency, formatDate, escapeHtml } from "../../lib/utils";
import { Plus, Trash2, Eye, FileText, X, Search, AlertCircle, Printer } from "lucide-react";
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
  const PAGE_SIZE = 10;
  const { currentTenant } = useTenantStore();
  const qc = useQueryClient();
  const tid = currentTenant?.id;
  const isVatRegistered = currentTenant?.isVatRegistered ?? false;
  const formatCurrency = useFormatCurrency();
  const taxLabel = isVatRegistered ? "VAT (12%)" : "Tax";

  const [createOpen, setCreateOpen] = useState(false);
  const [viewInvoice, setViewInvoice] = useState<Invoice | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Invoice | null>(null);
  const [fromOrderId, setFromOrderId] = useState("");
  const [items, setItems] = useState<NewItem[]>([{ description: "", quantity: 1, unitPrice: 0, totalPrice: 0 }]);
  const [form, setForm] = useState({ customerName: "", customerEmail: "", customerPhone: "", customerAddress: "", taxAmount: "0", discountAmount: "0", notes: "", dueDate: "" });
  const [createError, setCreateError] = useState("");
  const [statusUpdating, setStatusUpdating] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
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

  function printInvoice(inv: Invoice) {
    const heading = isVatRegistered ? "OFFICIAL RECEIPT / INVOICE" : "SALES INVOICE";
    const tenantTin = currentTenant?.tinNumber ? `TIN: ${currentTenant.tinNumber}` : "";
    const tenantAddr = [currentTenant?.businessAddress, currentTenant?.businessCity, currentTenant?.businessCountry].filter(Boolean).join(", ");
    const itemRows = inv.items.map((item) => `
      <tr>
        <td style="padding:4px 6px;border-bottom:1px solid #eee">${escapeHtml(item.description)}</td>
        <td style="padding:4px 6px;border-bottom:1px solid #eee;text-align:right">${item.quantity}</td>
        <td style="padding:4px 6px;border-bottom:1px solid #eee;text-align:right">${Number(item.unitPrice).toFixed(2)}</td>
        <td style="padding:4px 6px;border-bottom:1px solid #eee;text-align:right">${Number(item.totalPrice).toFixed(2)}</td>
      </tr>`).join("");
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${escapeHtml(inv.invoiceNumber)}</title>
<style>
  @media print { @page { margin: 15mm; } }
  body { font-family: Arial, sans-serif; font-size: 12px; color: #000; max-width: 700px; margin: 0 auto; padding: 20px; }
  h1 { font-size: 18px; text-align: center; margin: 0 0 4px; }
  .subtitle { text-align: center; font-size: 11px; color: #555; margin-bottom: 16px; }
  .meta { display: flex; justify-content: space-between; margin-bottom: 16px; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 12px; }
  th { background: #f4f4f4; padding: 6px; text-align: left; font-size: 11px; }
  .total-row { font-weight: bold; font-size: 14px; }
  .footer { margin-top: 20px; font-size: 10px; color: #777; text-align: center; }
</style></head><body>
<h1>${escapeHtml(currentTenant?.name ?? "")}</h1>
<div class="subtitle">${escapeHtml(tenantAddr)}${tenantTin ? ` | ${tenantTin}` : ""}</div>
<div style="text-align:center;font-weight:bold;font-size:14px;margin-bottom:12px;text-transform:uppercase">${heading}</div>
<div class="meta">
  <div><strong>Invoice #:</strong> ${escapeHtml(inv.invoiceNumber)}<br>
    <strong>Date:</strong> ${formatDate(inv.createdAt)}<br>
    ${inv.dueDate ? `<strong>Due:</strong> ${formatDate(inv.dueDate)}` : ""}
  </div>
  <div style="text-align:right">
    ${escapeHtml(inv.customerName ?? "")}<br>
    ${escapeHtml(inv.customerEmail ?? "")}<br>
    ${escapeHtml(inv.customerAddress ?? "")}
  </div>
</div>
<table>
  <thead><tr>
    <th>Description</th><th style="text-align:right">Qty</th>
    <th style="text-align:right">Unit Price</th><th style="text-align:right">Total</th>
  </tr></thead>
  <tbody>${itemRows}</tbody>
</table>
<table style="width:40%;margin-left:auto">
  <tr><td>Subtotal</td><td style="text-align:right">${Number(inv.subtotal).toFixed(2)}</td></tr>
  ${isVatRegistered && parseFloat(inv.taxAmount) > 0
    ? `<tr><td>VATable Sales</td><td style="text-align:right">${Number(inv.subtotal).toFixed(2)}</td></tr>
       <tr><td>VAT (12%)</td><td style="text-align:right">+${Number(inv.taxAmount).toFixed(2)}</td></tr>`
    : parseFloat(inv.taxAmount) > 0
      ? `<tr><td>Tax</td><td style="text-align:right">+${Number(inv.taxAmount).toFixed(2)}</td></tr>`
      : ""}
  ${parseFloat(inv.discountAmount) > 0 ? `<tr><td>Discount</td><td style="text-align:right">-${Number(inv.discountAmount).toFixed(2)}</td></tr>` : ""}
  <tr class="total-row" style="border-top:2px solid #000"><td>TOTAL</td><td style="text-align:right">${Number(inv.totalAmount).toFixed(2)}</td></tr>
</table>
${isVatRegistered ? `<div style="font-size:10px;color:#555;margin-top:8px">This document is an Official Receipt pursuant to BIR requirements. ${tenantTin}</div>` : ""}
<div class="footer">Thank you for your business!</div>
</body></html>`;
    const w = window.open("", "_blank");
    if (w) { w.document.write(html); w.document.close(); w.focus(); w.print(); }
  }

  const confirmedOrders = orders.filter((o) => o.status !== "draft" && o.status !== "cancelled");
  const filteredInvoices = useMemo(
    () => invoices.filter((inv) =>
      inv.invoiceNumber.toLowerCase().includes(search.toLowerCase()) ||
      (inv.customerName ?? "").toLowerCase().includes(search.toLowerCase()) ||
      (inv.customerEmail ?? "").toLowerCase().includes(search.toLowerCase())
    ),
    [invoices, search]
  );
  const totalPages = Math.max(1, Math.ceil(filteredInvoices.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pagedInvoices = useMemo(
    () => filteredInvoices.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE),
    [filteredInvoices, currentPage]
  );

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
          <h1 className="text-2xl font-bold text-ink">Invoices</h1>
          <p className="text-muted text-sm mt-0.5">{invoices.length} invoice{invoices.length !== 1 ? "s" : ""}</p>
        </div>
        <Button onClick={() => { resetForm(); setCreateOpen(true); }} size="sm" className="self-start sm:self-auto">
          <Plus className="w-3.5 h-3.5 mr-1.5" /> New Invoice
        </Button>
      </div>
      {invoices.length > 0 && (
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted pointer-events-none" />
          <input
            type="text"
            placeholder="Search invoices by number, customer, or email…"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="w-full pl-9 pr-4 py-2 text-sm border border-stroke bg-panel text-ink placeholder:text-muted focus:outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500/20"
          />
        </div>
      )}

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
      ) : filteredInvoices.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <AlertCircle className="w-8 h-8 text-muted mx-auto mb-3" />
            <p className="text-sm font-medium text-ink mb-1">No results found</p>
            <p className="text-sm text-muted">No invoices match &ldquo;{search}&rdquo;</p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <div className="hidden md:block overflow-x-auto">
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
                {pagedInvoices.map((inv) => (
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
          <div className="md:hidden divide-y divide-stroke">
            {pagedInvoices.map((inv) => (
              <div key={inv.id} className="px-4 py-3 space-y-2">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-mono font-medium text-ink text-sm">{inv.invoiceNumber}</p>
                    <p className="text-sm text-ink mt-0.5">{inv.customerName || "No customer"}</p>
                  </div>
                  <Badge variant={STATUS_VARIANT[inv.status]}>{inv.status}</Badge>
                </div>
                <div className="flex items-center justify-between">
                  <p className="font-semibold text-ink">{formatCurrency(inv.totalAmount)}</p>
                  <p className="text-xs text-muted">{inv.dueDate ? formatDate(inv.dueDate) : "No due date"}</p>
                </div>
                <div className="flex items-center justify-between">
                  <p className="text-xs text-muted">{formatDate(inv.createdAt)}</p>
                  <div className="flex items-center gap-2">
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
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}
      {filteredInvoices.length > 0 && (
        <Pagination
          totalItems={filteredInvoices.length}
          page={currentPage}
          pageSize={PAGE_SIZE}
          onPageChange={setPage}
          itemLabel="invoices"
        />
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
               <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
                    <div key={idx} className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-end border border-stroke p-2 sm:p-0 sm:border-0">
                      <div className="sm:col-span-5">
                        <input
                          placeholder="Description"
                          value={item.description}
                          onChange={(e) => updateItem(idx, "description", e.target.value)}
                          className="w-full text-sm border border-stroke bg-page text-ink px-2.5 py-2 focus:outline-none focus:ring-1 focus:ring-primary-400 placeholder:text-muted"
                        />
                      </div>
                      <div className="sm:col-span-2">
                        <input
                          type="number"
                          min="1"
                          placeholder="Qty"
                          value={item.quantity}
                          onChange={(e) => updateItem(idx, "quantity", e.target.value)}
                          className="w-full text-sm border border-stroke bg-page text-ink px-2.5 py-2 focus:outline-none focus:ring-1 focus:ring-primary-400"
                        />
                      </div>
                      <div className="sm:col-span-2">
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
                      <div className="sm:col-span-2 text-sm text-muted sm:text-right">
                        {formatCurrency(item.totalPrice)}
                      </div>
                      <div className="sm:col-span-1 flex justify-start sm:justify-center">
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

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Input label={`${taxLabel} Amount`} type="number" min="0" step="0.01" value={form.taxAmount} onChange={(e) => setForm((f) => ({ ...f, taxAmount: e.target.value }))} />
                <Input label="Discount" type="number" min="0" step="0.01" value={form.discountAmount} onChange={(e) => setForm((f) => ({ ...f, discountAmount: e.target.value }))} />
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
            {/* BIR / business header */}
            {(currentTenant?.tinNumber || currentTenant?.businessAddress) && (
              <div className="p-3 bg-blue-50 border border-blue-200 text-xs text-blue-800 space-y-0.5">
                {currentTenant.tinNumber && <p><strong>TIN:</strong> {currentTenant.tinNumber}</p>}
                {currentTenant.businessAddress && (
                  <p><strong>Address:</strong> {[currentTenant.businessAddress, currentTenant.businessCity, currentTenant.businessCountry].filter(Boolean).join(", ")}</p>
                )}
                {isVatRegistered && <p className="font-semibold">VAT-Registered — Official Receipt</p>}
              </div>
            )}
            <div className="flex items-center justify-between">
              <Badge variant={STATUS_VARIANT[viewInvoice.status]}>{viewInvoice.status}</Badge>
              <div className="flex items-center gap-3">
                <p className="text-muted text-xs">Created {formatDate(viewInvoice.createdAt)}</p>
                <Button size="sm" variant="outline" onClick={() => printInvoice(viewInvoice)}>
                  <Printer className="w-3.5 h-3.5 mr-1.5" /> Print
                </Button>
              </div>
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
              {parseFloat(viewInvoice.taxAmount) > 0 && isVatRegistered && (
                <>
                  <p className="text-muted">VATable Sales: <span className="text-ink">{formatCurrency(viewInvoice.subtotal)}</span></p>
                  <p className="text-muted">VAT (12%): <span className="text-ink">+{formatCurrency(viewInvoice.taxAmount)}</span></p>
                </>
              )}
              {parseFloat(viewInvoice.taxAmount) > 0 && !isVatRegistered && <p className="text-muted">Tax: <span className="text-ink">{formatCurrency(viewInvoice.taxAmount)}</span></p>}
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
          <p className="text-sm text-ink mb-3">
            Delete invoice <span className="font-mono font-medium">{deleteTarget?.invoiceNumber}</span>? This cannot be undone.
          </p>
          {/* BIR data retention warning */}
          <div className="mb-4 p-3 bg-amber-50 border border-amber-200 flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-amber-700 leading-relaxed">
              <strong>BIR Notice:</strong> Philippine law (NIRC / Revenue Regulations) requires businesses to keep official receipts and records for at least <strong>10 years</strong>. Only delete records you are certain are not needed for tax compliance.
            </p>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={() => setDeleteTarget(null)}>Cancel</Button>
            <Button variant="danger" size="sm" onClick={() => deleteMutation.mutate(deleteTarget!.id)} disabled={deleteMutation.isPending}>
              {deleteMutation.isPending ? "Deleting…" : "Delete anyway"}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
