import { useState, useMemo, useRef, useCallback, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../../api/client";
import { useTenantStore } from "../../stores/tenantStore";
import { useBranchStore } from "../../stores/branchStore";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { Skeleton, SkeletonCard } from "../../components/ui/Skeleton";
import { Modal } from "../../components/ui/Modal";
import { formatCurrency } from "../../lib/utils";
import { ShoppingCart, Search, Plus, Minus, Trash2, CreditCard, Receipt, CheckCircle, AlertTriangle, Printer, FileText, Users } from "lucide-react";
import { cn } from "../../lib/utils";
import { useToast } from "../../hooks/useToast";
import type { ProductImage } from "../../types";

interface Product {
  id: string;
  name: string;
  images?: ProductImage[];
  variants: { id: string; name: string; sku: string; price: string }[];
}

interface CartItem {
  variantId: string;
  productName: string;
  variantName: string;
  sku: string;
  price: number;
  quantity: number;
}

interface ReceiptData {
  orderNumber: string;
  items: CartItem[];
  subtotal: number;
  discount: number;
  total: number;
  paymentMethod: string;
  change: number;
  paid: number;
  customerName?: string;
  date: string;
}

interface CustomerResult {
  id: string;
  name: string;
  email?: string;
  phone?: string;
}

function ProductImageThumbnail({ src, alt }: { src?: string; alt: string }) {
  const [error, setError] = useState(false);
  if (!src || error) {
    return (
      <div role="img" aria-label="Product image unavailable">
        <ShoppingCart aria-hidden="true" className="w-6 h-6 text-primary-400" />
      </div>
    );
  }
  return <img src={src} alt={alt} className="w-full h-full object-cover" onError={() => setError(true)} />;
}

function getPrimaryProductImageUrl(product: Product): string | undefined {
  return product.images?.[0]?.url;
}

const PAYMENT_METHODS = ["Cash", "Card", "Mobile Pay", "Other"];

function generateReceiptHTML(receipt: ReceiptData, tenantName: string): string {
  const itemsHTML = receipt.items.map((i) =>
    `<tr>
      <td style="text-align:left;padding:2px 0">${i.productName} (${i.variantName})</td>
      <td style="text-align:center;padding:2px 4px">${i.quantity}</td>
      <td style="text-align:right;padding:2px 0">${Number(i.price * i.quantity).toFixed(2)}</td>
    </tr>`
  ).join("");

  return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Receipt ${receipt.orderNumber}</title>
<style>
  @media print { @page { margin: 0; size: 80mm auto; } body { margin: 4mm; } }
  body { font-family: 'Courier New', monospace; font-size: 12px; max-width: 300px; margin: 0 auto; color: #000; }
  .center { text-align: center; }
  .bold { font-weight: bold; }
  .divider { border-top: 1px dashed #000; margin: 6px 0; }
  table { width: 100%; border-collapse: collapse; }
  .total-row { font-weight: bold; font-size: 14px; }
</style></head><body>
<div class="center bold" style="font-size:16px;margin-bottom:4px">${tenantName}</div>
<div class="divider"></div>
<div><strong>Order:</strong> ${receipt.orderNumber}</div>
<div><strong>Date:</strong> ${receipt.date}</div>
${receipt.customerName ? `<div><strong>Customer:</strong> ${receipt.customerName}</div>` : ""}
<div><strong>Payment:</strong> ${receipt.paymentMethod}</div>
<div class="divider"></div>
<table>
  <tr><th style="text-align:left">Item</th><th style="text-align:center">Qty</th><th style="text-align:right">Total</th></tr>
  ${itemsHTML}
</table>
<div class="divider"></div>
<table>
  <tr><td>Subtotal</td><td style="text-align:right">${Number(receipt.subtotal).toFixed(2)}</td></tr>
  ${receipt.discount > 0 ? `<tr><td>Discount</td><td style="text-align:right">-${Number(receipt.discount).toFixed(2)}</td></tr>` : ""}
  <tr class="total-row"><td>TOTAL</td><td style="text-align:right">${Number(receipt.total).toFixed(2)}</td></tr>
  ${receipt.paymentMethod === "Cash" ? `
    <tr><td>Paid</td><td style="text-align:right">${Number(receipt.paid).toFixed(2)}</td></tr>
    <tr><td>Change</td><td style="text-align:right">${Number(receipt.change).toFixed(2)}</td></tr>
  ` : ""}
</table>
<div class="divider"></div>
<div class="center" style="margin-top:8px">Thank you for your purchase!</div>
</body></html>`;
}

export default function POSPage() {
  const { currentTenant } = useTenantStore();
  const { currentBranch } = useBranchStore();
  const qc = useQueryClient();
  const tid = currentTenant?.id;

  const [cart, setCart] = useState<CartItem[]>([]);
  const [search, setSearch] = useState("");
  const [discountInput, setDiscountInput] = useState("0");
  const [paymentMethod, setPaymentMethod] = useState("Cash");
  const [cashInput, setCashInput] = useState("");
  const [checkoutModal, setCheckoutModal] = useState(false);
  const [receiptModal, setReceiptModal] = useState(false);
  const [lastReceipt, setLastReceipt] = useState<ReceiptData | null>(null);
  const [customerName, setCustomerName] = useState("");
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  const [customerSearch, setCustomerSearch] = useState("");
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false);
  const [checkoutErrors, setCheckoutErrors] = useState<string[]>([]);
  const customerInputRef = useRef<HTMLInputElement>(null);
  const customerDropdownRef = useRef<HTMLDivElement>(null);
  const toast = useToast();

  // Products query
  const { data: products = [], isLoading } = useQuery<Product[]>({
    queryKey: ["products", tid],
    queryFn: () => api.get(`/api/tenants/${tid}/products`).then((r) => r.data),
    enabled: !!tid,
  });

  // Customer search query
  const { data: customerResults = [] } = useQuery<CustomerResult[]>({
    queryKey: ["customers-search", tid, customerSearch],
    queryFn: () => api.get(`/api/tenants/${tid}/customers/search`, { params: { q: customerSearch } }).then((r) => r.data),
    enabled: !!tid && showCustomerDropdown,
  });

  // Close customer dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (customerDropdownRef.current && !customerDropdownRef.current.contains(e.target as Node) &&
          customerInputRef.current && !customerInputRef.current.contains(e.target as Node)) {
        setShowCustomerDropdown(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const checkout = useMutation({
    mutationFn: (data: {
      branchId: string;
      customerName?: string;
      customerId?: string;
      items: { variantId: string; productName: string; variantName: string; sku: string; quantity: number; unitPrice: number }[];
      discountAmount: number;
      notes: string;
      paymentMethod: string;
      status: string;
    }) => api.post(`/api/tenants/${tid}/sales-orders`, data),
    onSuccess: (res) => {
      const data = res.data;
      const sub = cart.reduce((s, i) => s + i.price * i.quantity, 0);
      const disc = parseFloat(discountInput) || 0;
      const tot = Math.max(0, sub - disc);
      const paid = paymentMethod === "Cash" ? (parseFloat(cashInput) || tot) : tot;

      setLastReceipt({
        orderNumber: data.orderNumber,
        items: [...cart],
        subtotal: sub,
        discount: disc,
        total: tot,
        paymentMethod,
        paid,
        change: paymentMethod === "Cash" ? Math.max(0, paid - tot) : 0,
        customerName: customerName || undefined,
        date: new Date().toLocaleString(),
      });

      // If there's a customer name but no selected customer, auto-create the customer
      if (customerName.trim() && !selectedCustomerId) {
        api.post(`/api/tenants/${tid}/customers`, { name: customerName.trim() }).catch((err) => {
          console.warn("Auto-create customer failed:", err?.response?.data?.error || err.message);
        });
      }

      setCart([]);
      setDiscountInput("0");
      setCashInput("");
      setCustomerName("");
      setSelectedCustomerId(null);
      setCustomerSearch("");
      setCheckoutModal(false);
      setReceiptModal(true);
      setCheckoutErrors([]);
      qc.invalidateQueries({ queryKey: ["orders", tid] });
      qc.invalidateQueries({ queryKey: ["customers", tid] });
      qc.invalidateQueries({ queryKey: ["customers-search", tid] });
      toast.success("Order completed");
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error || "Failed to process order";
      toast.error(msg);
    },
  });

  const allVariants = useMemo(
    () => products.flatMap((p) => p.variants.map((v) => ({ ...v, productName: p.name, productId: p.id, imageUrl: getPrimaryProductImageUrl(p) }))),
    [products]
  );

  const filtered = useMemo(() => {
    if (!search) return allVariants;
    const q = search.toLowerCase();
    return allVariants.filter(
      (v) =>
        v.productName.toLowerCase().includes(q) ||
        v.name.toLowerCase().includes(q) ||
        v.sku.toLowerCase().includes(q)
    );
  }, [allVariants, search]);

  const addToCart = (variantId: string) => {
    const v = allVariants.find((x) => x.id === variantId);
    if (!v) return;
    setCart((prev) => {
      const existing = prev.find((i) => i.variantId === variantId);
      if (existing) return prev.map((i) => i.variantId === variantId ? { ...i, quantity: i.quantity + 1 } : i);
      return [...prev, { variantId: v.id, productName: v.productName, variantName: v.name, sku: v.sku, price: parseFloat(v.price), quantity: 1 }];
    });
  };

  const updateQty = (variantId: string, delta: number) => {
    setCart((prev) =>
      prev
        .map((i) => i.variantId === variantId ? { ...i, quantity: i.quantity + delta } : i)
        .filter((i) => i.quantity > 0)
    );
  };

  const removeItem = (variantId: string) => setCart((prev) => prev.filter((i) => i.variantId !== variantId));

  const subtotal = cart.reduce((s, i) => s + i.price * i.quantity, 0);
  const discount = parseFloat(discountInput) || 0;
  const total = Math.max(0, subtotal - discount);
  const cashTendered = parseFloat(cashInput) || 0;
  const change = paymentMethod === "Cash" ? Math.max(0, cashTendered - total) : 0;

  const validateCheckout = useCallback((): string[] => {
    const errors: string[] = [];
    if (cart.length === 0) errors.push("Cart is empty");
    if (!currentBranch) errors.push("No branch selected");
    if (total <= 0) errors.push("Total must be greater than 0");
    if (discount > subtotal) errors.push("Discount cannot exceed subtotal");
    if (paymentMethod === "Cash") {
      if (!cashInput || cashTendered <= 0) {
        errors.push("Enter the cash tendered amount");
      } else if (cashTendered < total) {
        errors.push("Cash tendered must be at least " + formatCurrency(total));
      }
    }
    return errors;
  }, [cart, currentBranch, total, discount, subtotal, paymentMethod, cashInput, cashTendered]);

  const handleCheckout = () => {
    const errors = validateCheckout();
    if (errors.length > 0) {
      setCheckoutErrors(errors);
      return;
    }
    setCheckoutErrors([]);
    if (!currentBranch) return;
    checkout.mutate({
      branchId: currentBranch.id,
      customerName: customerName || undefined,
      customerId: selectedCustomerId || undefined,
      discountAmount: discount,
      notes: `POS sale — ${paymentMethod}`,
      paymentMethod,
      status: "delivered",
      items: cart.map((i) => ({
        variantId: i.variantId,
        productName: i.productName,
        variantName: i.variantName,
        sku: i.sku,
        quantity: i.quantity,
        unitPrice: i.price,
      })),
    });
  };

  const handleCustomerInput = (value: string) => {
    setCustomerName(value);
    setCustomerSearch(value);
    setSelectedCustomerId(null);
    setShowCustomerDropdown(true);
  };

  const selectCustomer = (customer: CustomerResult) => {
    setCustomerName(customer.name);
    setSelectedCustomerId(customer.id);
    setShowCustomerDropdown(false);
  };

  const printReceipt = () => {
    if (!lastReceipt) return;
    const html = generateReceiptHTML(lastReceipt, currentTenant?.name || "Store");
    const printWindow = window.open("", "_blank", "width=350,height=600");
    if (printWindow) {
      printWindow.document.write(html);
      printWindow.document.close();
      printWindow.focus();
      printWindow.print();
    }
  };

  const downloadReceiptPDF = () => {
    if (!lastReceipt) return;
    const html = generateReceiptHTML(lastReceipt, currentTenant?.name || "Store");
    const printWindow = window.open("", "_blank", "width=350,height=600");
    if (printWindow) {
      printWindow.document.write(html);
      printWindow.document.close();
      printWindow.focus();
      // Use print dialog which allows saving as PDF
      setTimeout(() => printWindow.print(), 300);
    }
  };

  if (isLoading) return (
    <div className="space-y-4">
      <Skeleton className="h-7 w-40" />
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
        {Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} />)}
      </div>
    </div>
  );

  return (
    <div className="flex flex-col lg:flex-row gap-5 h-full">
      {/* Product grid */}
      <div className="flex-1 flex flex-col gap-4 min-w-0">
        <div>
          <h1 className="text-2xl font-bold text-ink">Point of Sale</h1>
          <p className="text-muted text-sm mt-1">{currentBranch ? currentBranch.name : "No branch selected"}</p>
        </div>

        {!currentBranch && (
          <div className="flex items-center gap-2 bg-yellow-50 border border-yellow-200 px-4 py-3 text-sm text-yellow-800">
            <AlertTriangle className="w-4 h-4 flex-shrink-0" />
            <span>Select a branch from the sidebar to process sales.</span>
          </div>
        )}

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted pointer-events-none" />
          <input
            type="text"
            placeholder="Search products, variants, SKU…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-sm border border-stroke bg-panel text-ink placeholder:text-muted focus:outline-none focus:border-primary-500"
          />
        </div>

        {/* Product grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3 overflow-y-auto">
          {filtered.length === 0 ? (
            <div className="col-span-full py-16 text-center text-muted text-sm">No products found</div>
          ) : (
            filtered.map((v) => (
              <button
                key={v.id}
                onClick={() => addToCart(v.id)}
                disabled={!currentBranch}
                className="flex flex-col bg-panel border border-stroke p-3 text-left hover:bg-hover hover:border-primary-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:border-primary-500"
              >
                <div className="w-full aspect-square bg-primary-50 border border-primary-100 flex items-center justify-center mb-2">
                  <ProductImageThumbnail src={v.imageUrl} alt={v.productName} />
                </div>
                <p className="text-xs font-semibold text-ink truncate">{v.productName}</p>
                <p className="text-xs text-muted truncate">{v.name}</p>
                <p className="text-xs text-muted font-mono mt-0.5">{v.sku}</p>
                <p className="text-sm font-bold text-primary-600 mt-1">{formatCurrency(v.price)}</p>
              </button>
            ))
          )}
        </div>
      </div>

      {/* Cart */}
      <div className="lg:w-80 flex flex-col bg-panel border border-stroke">
        <div className="px-4 py-3 border-b border-stroke flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShoppingCart className="w-4 h-4 text-muted" />
            <span className="font-semibold text-ink text-sm">Cart</span>
            {cart.length > 0 && (
              <span className="w-5 h-5 bg-primary-600 text-white text-xs font-bold flex items-center justify-center">
                {cart.reduce((s, i) => s + i.quantity, 0)}
              </span>
            )}
          </div>
          {cart.length > 0 && (
            <button onClick={() => setCart([])} className="text-xs text-muted hover:text-red-500 transition-colors">Clear all</button>
          )}
        </div>

        {/* Cart items */}
        <div className="flex-1 overflow-y-auto divide-y divide-stroke">
          {cart.length === 0 ? (
            <div className="py-16 text-center text-muted text-sm px-4">
              <ShoppingCart className="w-8 h-8 mx-auto mb-3 text-stroke" />
              <p>Tap a product to add it to cart</p>
            </div>
          ) : (
            cart.map((item) => (
              <div key={item.variantId} className="px-4 py-3 flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-ink truncate">{item.productName}</p>
                  <p className="text-xs text-muted truncate">{item.variantName}</p>
                  <p className="text-xs font-semibold text-primary-600 mt-0.5">{formatCurrency(item.price)}</p>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  <button
                    onClick={() => updateQty(item.variantId, -1)}
                    className="w-6 h-6 border border-stroke flex items-center justify-center hover:bg-hover transition-colors"
                  >
                    <Minus className="w-3 h-3" />
                  </button>
                  <span className="w-7 text-center text-sm font-medium text-ink">{item.quantity}</span>
                  <button
                    onClick={() => updateQty(item.variantId, 1)}
                    className="w-6 h-6 border border-stroke flex items-center justify-center hover:bg-hover transition-colors"
                  >
                    <Plus className="w-3 h-3" />
                  </button>
                  <button onClick={() => removeItem(item.variantId)} className="ml-1 text-red-400 hover:text-red-600">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Cart totals */}
        <div className="border-t border-stroke p-4 space-y-3">
          {cart.length > 0 && (
            <>
              <div className="flex justify-between text-sm text-muted">
                <span>Subtotal</span>
                <span>{formatCurrency(subtotal)}</span>
              </div>
              <div className="flex items-center gap-2">
                <label className="text-sm text-muted flex-shrink-0">Discount</label>
                <input
                  type="number"
                  min="0"
                  max={subtotal}
                  step="0.01"
                  value={discountInput}
                  onChange={(e) => setDiscountInput(e.target.value)}
                  className="flex-1 border border-stroke bg-page text-ink px-2 py-1 text-sm text-right outline-none focus:border-primary-500"
                />
              </div>
              {discount > subtotal && (
                <p className="text-xs text-red-500">Discount cannot exceed subtotal</p>
              )}
              <div className="flex justify-between text-base font-bold text-ink border-t border-stroke pt-2">
                <span>Total</span>
                <span>{formatCurrency(total)}</span>
              </div>
            </>
          )}
          <Button
            className="w-full gap-2"
            disabled={cart.length === 0 || !currentBranch}
            onClick={() => { setCheckoutErrors([]); setCheckoutModal(true); }}
          >
            <CreditCard className="w-4 h-4" />
            Checkout
          </Button>
        </div>
      </div>

      {/* Checkout modal */}
      <Modal open={checkoutModal} onClose={() => setCheckoutModal(false)} title="Checkout" size="sm">
        <div className="flex flex-col gap-4">
          {/* Customer name with search/autocomplete */}
          <div className="relative">
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-muted">Customer name (optional)</label>
              <div className="relative">
                <Users className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted pointer-events-none" />
                <input
                  ref={customerInputRef}
                  type="text"
                  value={customerName}
                  onChange={(e) => handleCustomerInput(e.target.value)}
                  onFocus={() => setShowCustomerDropdown(true)}
                  placeholder="Search or type new customer name…"
                  className="w-full pl-9 pr-4 py-2 text-sm border border-stroke bg-panel text-ink placeholder:text-muted focus:outline-none focus:border-primary-500"
                />
              </div>
              {selectedCustomerId && (
                <p className="text-xs text-green-600">Linked to existing customer</p>
              )}
              {customerName.trim() && !selectedCustomerId && (
                <p className="text-xs text-muted">New customer will be created automatically</p>
              )}
            </div>
            {showCustomerDropdown && customerResults.length > 0 && (
              <div
                ref={customerDropdownRef}
                className="absolute top-full left-0 right-0 z-10 mt-1 bg-panel border border-stroke shadow-lg max-h-40 overflow-y-auto"
              >
                {customerResults.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => selectCustomer(c)}
                    className="w-full px-3 py-2 text-left text-sm hover:bg-hover flex items-center gap-2 transition-colors"
                  >
                    <div className="w-6 h-6 bg-primary-50 border border-primary-200 flex items-center justify-center text-primary-700 font-bold text-xs flex-shrink-0">
                      {c.name[0]?.toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <p className="text-ink font-medium truncate">{c.name}</p>
                      {(c.email || c.phone) && (
                        <p className="text-xs text-muted truncate">{c.email || c.phone}</p>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div>
            <p className="text-xs font-medium text-muted mb-2">Payment method</p>
            <div className="grid grid-cols-2 gap-2">
              {PAYMENT_METHODS.map((m) => (
                <button
                  key={m}
                  onClick={() => { setPaymentMethod(m); setCheckoutErrors([]); }}
                  className={cn(
                    "px-3 py-2 text-sm font-medium border transition-colors",
                    paymentMethod === m
                      ? "border-primary-600 bg-primary-50 text-primary-700"
                      : "border-stroke bg-panel text-muted hover:bg-hover hover:text-ink"
                  )}
                >
                  {m}
                </button>
              ))}
            </div>
          </div>

          {paymentMethod === "Cash" && (
            <div>
              <Input
                label="Cash tendered *"
                type="number"
                min={0}
                step="0.01"
                value={cashInput}
                onChange={(e) => { setCashInput(e.target.value); setCheckoutErrors([]); }}
                placeholder={formatCurrency(total)}
                error={
                  cashInput && parseFloat(cashInput) < total
                    ? `Must be at least ${formatCurrency(total)}`
                    : undefined
                }
              />
              {cashInput && parseFloat(cashInput) >= total && (
                <p className="text-xs text-green-600 mt-1">
                  Change: {formatCurrency(Math.max(0, parseFloat(cashInput) - total))}
                </p>
              )}
            </div>
          )}

          <div className="bg-page border border-stroke p-3 text-sm space-y-1">
            <div className="flex justify-between text-muted">
              <span>Subtotal</span><span>{formatCurrency(subtotal)}</span>
            </div>
            {discount > 0 && (
              <div className="flex justify-between text-muted">
                <span>Discount</span><span>-{formatCurrency(discount)}</span>
              </div>
            )}
            <div className="flex justify-between font-bold text-ink text-base border-t border-stroke pt-1 mt-1">
              <span>Total</span><span>{formatCurrency(total)}</span>
            </div>
            {paymentMethod === "Cash" && cashInput && parseFloat(cashInput) >= total && (
              <div className="flex justify-between text-green-600 font-semibold">
                <span>Change</span><span>{formatCurrency(change)}</span>
              </div>
            )}
          </div>

          {/* Validation errors */}
          {checkoutErrors.length > 0 && (
            <div className="bg-red-50 border border-red-200 p-3 space-y-1">
              {checkoutErrors.map((err, i) => (
                <div key={i} className="flex items-center gap-2 text-sm text-red-600">
                  <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
                  <span>{err}</span>
                </div>
              ))}
            </div>
          )}

          <div className="flex gap-3 justify-end pt-2">
            <Button variant="outline" onClick={() => setCheckoutModal(false)}>Cancel</Button>
            <Button
              onClick={handleCheckout}
              loading={checkout.isPending}
              disabled={!currentBranch || cart.length === 0}
              className="gap-2"
            >
              <CreditCard className="w-4 h-4" />
              Complete sale
            </Button>
          </div>
        </div>
      </Modal>

      {/* Receipt modal */}
      {lastReceipt && (
        <Modal open={receiptModal} onClose={() => setReceiptModal(false)} title="Sale complete" size="sm">
          <div className="flex flex-col items-center gap-4">
            <div className="w-14 h-14 bg-green-50 border border-green-200 flex items-center justify-center">
              <CheckCircle className="w-7 h-7 text-green-500" />
            </div>
            <div id="receipt-content" className="w-full bg-page border border-stroke p-4 font-mono text-xs space-y-1">
              <div className="text-center font-bold text-sm text-ink mb-3">{currentTenant?.name}</div>
              <div className="flex justify-between text-muted"><span>Order</span><span>{lastReceipt.orderNumber}</span></div>
              <div className="flex justify-between text-muted"><span>Date</span><span>{lastReceipt.date}</span></div>
              {lastReceipt.customerName && (
                <div className="flex justify-between text-muted"><span>Customer</span><span>{lastReceipt.customerName}</span></div>
              )}
              <div className="flex justify-between text-muted"><span>Payment</span><span>{lastReceipt.paymentMethod}</span></div>
              <div className="border-t border-stroke my-2" />
              {lastReceipt.items.map((i) => (
                <div key={i.variantId} className="flex justify-between">
                  <span className="text-ink">{i.productName} × {i.quantity}</span>
                  <span className="text-muted">{formatCurrency(i.price * i.quantity)}</span>
                </div>
              ))}
              <div className="border-t border-stroke my-2" />
              {lastReceipt.discount > 0 && (
                <div className="flex justify-between text-muted"><span>Discount</span><span>-{formatCurrency(lastReceipt.discount)}</span></div>
              )}
              <div className="flex justify-between font-bold text-ink text-sm">
                <span>Total</span><span>{formatCurrency(lastReceipt.total)}</span>
              </div>
              {lastReceipt.paymentMethod === "Cash" && (
                <>
                  <div className="flex justify-between text-muted"><span>Paid</span><span>{formatCurrency(lastReceipt.paid)}</span></div>
                  <div className="flex justify-between text-green-600 font-semibold"><span>Change</span><span>{formatCurrency(lastReceipt.change)}</span></div>
                </>
              )}
              <div className="text-center text-muted mt-3">Thank you!</div>
            </div>
            <div className="flex gap-3 w-full">
              <Button variant="outline" className="flex-1 gap-2" onClick={printReceipt}>
                <Printer className="w-4 h-4" />
                Print
              </Button>
              <Button variant="outline" className="flex-1 gap-2" onClick={downloadReceiptPDF}>
                <FileText className="w-4 h-4" />
                Save PDF
              </Button>
              <Button className="flex-1 gap-2" onClick={() => setReceiptModal(false)}>
                <Receipt className="w-4 h-4" />
                New sale
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
