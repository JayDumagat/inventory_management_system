import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../../api/client";
import { useTenantStore } from "../../stores/tenantStore";
import { useBranchStore } from "../../stores/branchStore";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { PageLoader } from "../../components/ui/Spinner";
import { Modal } from "../../components/ui/Modal";
import { formatCurrency } from "../../lib/utils";
import { ShoppingCart, Search, Plus, Minus, Trash2, CreditCard, Receipt, CheckCircle, AlertTriangle } from "lucide-react";
import { cn } from "../../lib/utils";

interface Product {
  id: string;
  name: string;
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

interface Receipt {
  orderNumber: string;
  items: CartItem[];
  subtotal: number;
  discount: number;
  total: number;
  paymentMethod: string;
  change: number;
  paid: number;
}

const PAYMENT_METHODS = ["Cash", "Card", "Mobile Pay", "Other"];

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
  const [lastReceipt, setLastReceipt] = useState<Receipt | null>(null);
  const [customerName, setCustomerName] = useState("");

  const { data: products = [], isLoading } = useQuery<Product[]>({
    queryKey: ["products", tid],
    queryFn: () => api.get(`/api/tenants/${tid}/products`).then((r) => r.data),
    enabled: !!tid,
  });

  const checkout = useMutation({
    mutationFn: (data: {
      branchId: string;
      customerName?: string;
      items: { variantId: string; productName: string; variantName: string; sku: string; quantity: number; unitPrice: number }[];
      discountAmount: number;
      notes: string;
    }) => api.post(`/api/tenants/${tid}/sales-orders`, {
      ...data,
      status: "delivered",
    }),
    onSuccess: (res) => {
      const data = res.data;
      const subtotal = cart.reduce((s, i) => s + i.price * i.quantity, 0);
      const discount = parseFloat(discountInput) || 0;
      const total = Math.max(0, subtotal - discount);
      const paid = parseFloat(cashInput) || total;

      setLastReceipt({
        orderNumber: data.orderNumber,
        items: [...cart],
        subtotal,
        discount,
        total,
        paymentMethod,
        paid,
        change: Math.max(0, paid - total),
      });

      setCart([]);
      setDiscountInput("0");
      setCashInput("");
      setCustomerName("");
      setCheckoutModal(false);
      setReceiptModal(true);
      qc.invalidateQueries({ queryKey: ["orders", tid] });
    },
  });

  const allVariants = useMemo(
    () => products.flatMap((p) => p.variants.map((v) => ({ ...v, productName: p.name, productId: p.id }))),
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
  const change = paymentMethod === "Cash" ? Math.max(0, (parseFloat(cashInput) || 0) - total) : 0;

  const handleCheckout = () => {
    if (!currentBranch) return;
    checkout.mutate({
      branchId: currentBranch.id,
      customerName: customerName || undefined,
      discountAmount: discount,
      notes: `POS sale — ${paymentMethod}`,
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

  if (isLoading) return <PageLoader />;

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
                  <ShoppingCart className="w-6 h-6 text-primary-400" />
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
                  step="0.01"
                  value={discountInput}
                  onChange={(e) => setDiscountInput(e.target.value)}
                  className="flex-1 border border-stroke bg-page text-ink px-2 py-1 text-sm text-right outline-none focus:border-primary-500"
                />
              </div>
              <div className="flex justify-between text-base font-bold text-ink border-t border-stroke pt-2">
                <span>Total</span>
                <span>{formatCurrency(total)}</span>
              </div>
            </>
          )}
          <Button
            className="w-full gap-2"
            disabled={cart.length === 0 || !currentBranch}
            onClick={() => setCheckoutModal(true)}
          >
            <CreditCard className="w-4 h-4" />
            Checkout
          </Button>
        </div>
      </div>

      {/* Checkout modal */}
      <Modal open={checkoutModal} onClose={() => setCheckoutModal(false)} title="Checkout" size="sm">
        <div className="flex flex-col gap-4">
          <Input label="Customer name (optional)" value={customerName} onChange={(e) => setCustomerName(e.target.value)} placeholder="Walk-in customer" />

          <div>
            <p className="text-xs font-medium text-muted mb-2">Payment method</p>
            <div className="grid grid-cols-2 gap-2">
              {PAYMENT_METHODS.map((m) => (
                <button
                  key={m}
                  onClick={() => setPaymentMethod(m)}
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
            <Input
              label="Cash tendered"
              type="number"
              min={total}
              step="0.01"
              value={cashInput}
              onChange={(e) => setCashInput(e.target.value)}
              placeholder={formatCurrency(total)}
            />
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
            {paymentMethod === "Cash" && cashInput && (
              <div className="flex justify-between text-green-600 font-semibold">
                <span>Change</span><span>{formatCurrency(change)}</span>
              </div>
            )}
          </div>

          <div className="flex gap-3 justify-end pt-2">
            <Button variant="outline" onClick={() => setCheckoutModal(false)}>Cancel</Button>
            <Button
              onClick={handleCheckout}
              loading={checkout.isPending}
              disabled={!currentBranch}
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
            <div className="w-full bg-page border border-stroke p-4 font-mono text-xs space-y-1">
              <div className="text-center font-bold text-sm text-ink mb-3">{currentTenant?.name}</div>
              <div className="flex justify-between text-muted"><span>Order</span><span>{lastReceipt.orderNumber}</span></div>
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
              <Button variant="outline" className="flex-1 gap-2" onClick={() => setReceiptModal(false)}>
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
