import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { api } from "../../api/client";
import { useTenantStore } from "../../stores/tenantStore";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/Card";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { Select } from "../../components/ui/Select";
import { Modal } from "../../components/ui/Modal";
import { Badge } from "../../components/ui/Badge";
import { SkeletonTable } from "../../components/ui/Skeleton";
import { useToast } from "../../hooks/useToast";
import { Gift, Plus, Pencil, Trash2, BarChart2, Percent, DollarSign } from "lucide-react";
import { cn } from "../../lib/utils";
import type { Promotion } from "../../types";

const schema = z.object({
  name: z.string().min(1, "Name is required").max(200),
  description: z.string().max(1000).optional(),
  code: z.string().max(50).optional().or(z.literal("")),
  type: z.enum(["percentage_off", "fixed_amount", "bogo", "free_shipping", "tiered"]),
  discountType: z.enum(["percentage", "fixed"]),
  discountValue: z.number({ error: "Required" }).min(0),
  minimumOrderAmount: z.number().min(0).optional(),
  maximumDiscountAmount: z.number().min(0).optional(),
  scope: z.enum(["order", "category"]).default("order"),
  eligibility: z.enum(["all", "new_customer", "specific_customer"]).default("all"),
  usageLimitTotal: z.number().int().min(1).optional(),
  usageLimitPerCustomer: z.number().int().min(1).optional(),
  startsAt: z.string().optional().or(z.literal("")),
  endsAt: z.string().optional().or(z.literal("")),
  isActive: z.boolean().default(true),
  stackable: z.boolean().default(false),
  priority: z.number().int().min(0).default(0),
});

type PromotionForm = z.input<typeof schema>;
type PromotionFormOutput = z.output<typeof schema>;

function sanitizePromotionPayload(data: PromotionFormOutput): PromotionFormOutput {
  const toOptionalNumber = (value: number | undefined) => (
    value === undefined || Number.isNaN(value) ? undefined : value
  );
  const toOptionalIso = (value: string | undefined) => {
    if (!value) return undefined;
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? undefined : parsed.toISOString();
  };

  return {
    ...data,
    minimumOrderAmount: toOptionalNumber(data.minimumOrderAmount),
    maximumDiscountAmount: toOptionalNumber(data.maximumDiscountAmount),
    usageLimitTotal: toOptionalNumber(data.usageLimitTotal),
    usageLimitPerCustomer: toOptionalNumber(data.usageLimitPerCustomer),
    startsAt: toOptionalIso(data.startsAt),
    endsAt: toOptionalIso(data.endsAt),
  };
}

function getStatusBadge(promo: Promotion) {
  if (!promo.isActive) return <Badge variant="default">Inactive</Badge>;
  const now = new Date();
  if (promo.endsAt && new Date(promo.endsAt) < now) return <Badge variant="warning">Expired</Badge>;
  if (promo.startsAt && new Date(promo.startsAt) > now) return <Badge variant="info">Scheduled</Badge>;
  return <Badge variant="success">Active</Badge>;
}

function getTypeLabel(type: string) {
  const labels: Record<string, string> = {
    percentage_off: "% Off",
    fixed_amount: "Fixed Amount",
    bogo: "BOGO",
    free_shipping: "Free Shipping",
    tiered: "Tiered",
  };
  return labels[type] ?? type;
}

export default function PromotionsPage() {
  const { currentTenant } = useTenantStore();
  const tid = currentTenant?.id;
  const role = currentTenant?.role;
  const qc = useQueryClient();
  const toast = useToast();
  const canManage = ["owner", "admin", "manager"].includes(role ?? "");

  const [modal, setModal] = useState<{ open: boolean; promo?: Promotion }>({ open: false });
  const [deleteConfirm, setDeleteConfirm] = useState<Promotion | null>(null);
  const [usagePromo, setUsagePromo] = useState<Promotion | null>(null);

  const form = useForm<PromotionForm, unknown, PromotionFormOutput>({ resolver: zodResolver(schema) });

  const { data: promotions = [], isLoading } = useQuery<Promotion[]>({
    queryKey: ["promotions", tid],
    queryFn: () => api.get(`/api/tenants/${tid}/promotions`).then((r) => r.data),
    enabled: !!tid,
  });

  const save = useMutation({
    mutationFn: (data: PromotionFormOutput) =>
      modal.promo
        ? api.patch(`/api/tenants/${tid}/promotions/${modal.promo.id}`, sanitizePromotionPayload(data)).then((r) => r.data)
        : api.post(`/api/tenants/${tid}/promotions`, sanitizePromotionPayload(data)).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["promotions", tid] });
      closeModal();
      toast.success("Promotion saved");
    },
    onError: (err: { response?: { data?: { error?: string } } }) =>
      toast.error(err.response?.data?.error ?? "Failed to save promotion"),
  });

  const remove = useMutation({
    mutationFn: (id: string) => api.delete(`/api/tenants/${tid}/promotions/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["promotions", tid] });
      setDeleteConfirm(null);
      toast.success("Promotion deleted");
    },
    onError: () => toast.error("Failed to delete promotion"),
  });

  function openCreate() {
    form.reset({
      name: "", description: "", code: "", type: "percentage_off",
      discountType: "percentage", discountValue: 0, scope: "order",
      eligibility: "all", isActive: true, stackable: false, priority: 0,
    });
    setModal({ open: true });
  }

  function openEdit(promo: Promotion) {
    form.reset({
      name: promo.name,
      description: promo.description ?? "",
      code: promo.code ?? "",
      type: promo.type,
      discountType: promo.discountType,
      discountValue: Number(promo.discountValue),
      minimumOrderAmount: promo.minimumOrderAmount ? Number(promo.minimumOrderAmount) : undefined,
      maximumDiscountAmount: promo.maximumDiscountAmount ? Number(promo.maximumDiscountAmount) : undefined,
      scope: promo.scope as "order" | "category",
      eligibility: promo.eligibility as "all" | "new_customer" | "specific_customer",
      usageLimitTotal: promo.usageLimitTotal ?? undefined,
      usageLimitPerCustomer: promo.usageLimitPerCustomer ?? undefined,
      startsAt: promo.startsAt ? promo.startsAt.slice(0, 16) : "",
      endsAt: promo.endsAt ? promo.endsAt.slice(0, 16) : "",
      isActive: promo.isActive,
      stackable: promo.stackable,
      priority: promo.priority,
    });
    setModal({ open: true, promo });
  }

  function closeModal() {
    setModal({ open: false });
    form.reset();
  }

  const type = form.watch("type");

  if (!canManage) {
    return (
      <div className="p-6 text-center text-muted">
        <Gift className="w-12 h-12 mx-auto mb-3 opacity-30" />
        <p>You don't have permission to manage promotions.</p>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Gift className="w-5 h-5 text-primary-500" />
          <div>
            <h1 className="text-xl font-semibold text-ink">Promotions & Discounts</h1>
            <p className="text-sm text-muted">Create and manage promotional offers</p>
          </div>
        </div>
        <Button onClick={openCreate}>
          <Plus className="w-4 h-4 mr-1.5" /> New Promotion
        </Button>
      </div>

      {/* List */}
      {isLoading ? (
        <SkeletonTable />
      ) : promotions.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <Gift className="w-12 h-12 mx-auto mb-4 text-muted opacity-40" />
            <p className="text-muted mb-4">No promotions yet</p>
            <Button onClick={openCreate}>Create your first promotion</Button>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>All Promotions ({promotions.length})</CardTitle>
          </CardHeader>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-stroke">
                  {["Name", "Code", "Type", "Discount", "Usage", "Validity", "Status", ""].map((h) => (
                    <th key={h} className="text-left px-4 py-3 text-xs font-medium text-muted">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {promotions.map((p) => (
                  <tr key={p.id} className="border-b border-stroke hover:bg-hover">
                    <td className="px-4 py-3">
                      <div className="font-medium text-ink">{p.name}</div>
                      {p.description && <div className="text-xs text-muted">{p.description}</div>}
                    </td>
                    <td className="px-4 py-3">
                      {p.code ? (
                        <code className="bg-stroke px-2 py-0.5 text-xs font-mono">{p.code}</code>
                      ) : (
                        <span className="text-xs text-muted italic">Auto-applied</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant="info">{getTypeLabel(p.type)}</Badge>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1 text-ink">
                        {p.discountType === "percentage" ? (
                          <><Percent className="w-3 h-3" />{p.discountValue}%</>
                        ) : (
                          <><DollarSign className="w-3 h-3" />{Number(p.discountValue).toFixed(2)}</>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-muted text-xs">
                      {p.usageCount}{p.usageLimitTotal ? `/${p.usageLimitTotal}` : ""}
                    </td>
                    <td className="px-4 py-3 text-xs text-muted">
                      {p.startsAt && <div>From: {new Date(p.startsAt).toLocaleDateString()}</div>}
                      {p.endsAt && <div>Until: {new Date(p.endsAt).toLocaleDateString()}</div>}
                      {!p.startsAt && !p.endsAt && <span>No limit</span>}
                    </td>
                    <td className="px-4 py-3">{getStatusBadge(p)}</td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1">
                        <Button size="sm" variant="ghost" onClick={() => setUsagePromo(p)} title="View usage">
                          <BarChart2 className="w-4 h-4" />
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => openEdit(p)}>
                          <Pencil className="w-4 h-4" />
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => setDeleteConfirm(p)}>
                          <Trash2 className="w-4 h-4 text-red-500" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Create / Edit modal */}
      <Modal
        open={modal.open}
        onClose={closeModal}
        title={modal.promo ? "Edit Promotion" : "New Promotion"}
        size="lg"
      >
        <form
          onSubmit={form.handleSubmit((d) => save.mutate(d))}
          className="space-y-4 max-h-[70vh] overflow-y-auto"
        >
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <Input label="Name *" error={form.formState.errors.name?.message} {...form.register("name")} />
            </div>
            <div className="col-span-2">
              <Input label="Description" {...form.register("description")} />
            </div>
            <Input
              label="Coupon code (optional)"
              placeholder="e.g. SUMMER20"
              {...form.register("code")}
              helperText="Leave blank for auto-applied promotions"
            />
            <div>
              <Select label="Type *" error={form.formState.errors.type?.message} {...form.register("type")}>
                <option value="percentage_off">Percentage Off</option>
                <option value="fixed_amount">Fixed Amount Off</option>
                <option value="bogo">Buy X Get Y (BOGO)</option>
                <option value="free_shipping">Free Shipping</option>
                <option value="tiered">Tiered</option>
              </Select>
            </div>
            {type !== "free_shipping" && (
              <>
                <div>
                  <Select label="Discount type *" {...form.register("discountType")}>
                    <option value="percentage">Percentage (%)</option>
                    <option value="fixed">Fixed Amount ($)</option>
                  </Select>
                </div>
                <Input
                  label="Discount value *"
                  type="number"
                  step="0.01"
                  error={form.formState.errors.discountValue?.message}
                  {...form.register("discountValue", { valueAsNumber: true })}
                />
              </>
            )}
            <Input
              label="Minimum order amount"
              type="number"
              step="0.01"
              {...form.register("minimumOrderAmount", { valueAsNumber: true })}
            />
            <Input
              label="Maximum discount amount"
              type="number"
              step="0.01"
              {...form.register("maximumDiscountAmount", { valueAsNumber: true })}
            />
            <div>
              <Select label="Eligibility" {...form.register("eligibility")}>
                <option value="all">All customers</option>
                <option value="new_customer">New customers only</option>
                <option value="specific_customer">Specific customer</option>
              </Select>
            </div>
            <div>
              <Select label="Scope" {...form.register("scope")}>
                <option value="order">Whole order</option>
                <option value="category">Category</option>
              </Select>
            </div>
            <Input
              label="Total usage limit"
              type="number"
              {...form.register("usageLimitTotal", { valueAsNumber: true })}
              helperText="Blank = unlimited"
            />
            <Input
              label="Per-customer limit"
              type="number"
              {...form.register("usageLimitPerCustomer", { valueAsNumber: true })}
              helperText="Blank = unlimited"
            />
            <Input
              label="Starts at"
              type="datetime-local"
              {...form.register("startsAt")}
            />
            <Input
              label="Ends at"
              type="datetime-local"
              {...form.register("endsAt")}
            />
            <Input
              label="Priority"
              type="number"
              {...form.register("priority", { valueAsNumber: true })}
              helperText="Higher = applied first"
            />
            <div className="flex items-center gap-4 pt-5">
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input type="checkbox" {...form.register("isActive")} />
                <span>Active</span>
              </label>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input type="checkbox" {...form.register("stackable")} />
                <span>Stackable</span>
              </label>
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2 border-t border-stroke">
            <Button type="button" variant="outline" onClick={closeModal}>Cancel</Button>
            <Button type="submit" disabled={save.isPending}>
              {save.isPending ? "Saving..." : "Save"}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Usage modal */}
      <Modal
        open={!!usagePromo}
        onClose={() => setUsagePromo(null)}
        title={`Usage — ${usagePromo?.name}`}
        size="lg"
      >
        {usagePromo && <PromotionUsagePanel promotionId={usagePromo.id} tid={tid!} />}
      </Modal>

      {/* Delete confirm */}
      <Modal open={!!deleteConfirm} onClose={() => setDeleteConfirm(null)} title="Delete Promotion" size="sm">
        <p className="text-sm text-muted mb-4">
          Delete <strong>{deleteConfirm?.name}</strong>? This cannot be undone.
        </p>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => setDeleteConfirm(null)}>Cancel</Button>
          <Button
            className={cn("bg-red-600 hover:bg-red-700 text-white border-0")}
            onClick={() => deleteConfirm && remove.mutate(deleteConfirm.id)}
            disabled={remove.isPending}
          >
            {remove.isPending ? "Deleting..." : "Delete"}
          </Button>
        </div>
      </Modal>
    </div>
  );
}

// ─── Usage panel (nested component) ──────────────────────────────────────────
interface UsageEntry {
  id: string;
  orderId?: string;
  customerId?: string;
  customerName?: string;
  discountApplied: string;
  createdAt: string;
}

interface UsageData {
  promotion: Promotion;
  usages: UsageEntry[];
}

function PromotionUsagePanel({ promotionId, tid }: { promotionId: string; tid: string }) {
  const { data, isLoading } = useQuery<UsageData>({
    queryKey: ["promotion-usage", promotionId],
    queryFn: () => api.get(`/api/tenants/${tid}/promotions/${promotionId}/usage`).then((r) => r.data),
  });

  if (isLoading) return <SkeletonTable />;
  if (!data || data.usages.length === 0) return <p className="text-sm text-muted py-4">No usages yet.</p>;

  const totalDiscount = data.usages.reduce((s, u) => s + Number(u.discountApplied), 0);

  return (
    <div className="space-y-3">
      <div className="flex gap-4 text-sm">
        <div className="bg-panel border border-stroke p-3 flex-1 text-center">
          <p className="text-2xl font-bold text-ink">{data.usages.length}</p>
          <p className="text-xs text-muted">Total uses</p>
        </div>
        <div className="bg-panel border border-stroke p-3 flex-1 text-center">
          <p className="text-2xl font-bold text-ink">${totalDiscount.toFixed(2)}</p>
          <p className="text-xs text-muted">Total discounted</p>
        </div>
      </div>
      <div className="overflow-x-auto max-h-72">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-stroke">
              <th className="text-left py-2 px-3 text-muted">Customer</th>
              <th className="text-left py-2 px-3 text-muted">Discount</th>
              <th className="text-left py-2 px-3 text-muted">Date</th>
            </tr>
          </thead>
          <tbody>
            {data.usages.map((u) => (
              <tr key={u.id} className="border-b border-stroke">
                <td className="py-2 px-3 text-ink">{u.customerName ?? "Guest"}</td>
                <td className="py-2 px-3 text-ink">${Number(u.discountApplied).toFixed(2)}</td>
                <td className="py-2 px-3 text-muted">{new Date(u.createdAt).toLocaleDateString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
