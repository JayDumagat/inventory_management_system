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
import { Modal } from "../../components/ui/Modal";
import { Badge } from "../../components/ui/Badge";
import { Skeleton, SkeletonTable } from "../../components/ui/Skeleton";
import { formatCurrency, formatDate } from "../../lib/utils";
import { ArrowLeftRight, Plus, Trash2, TrendingUp, TrendingDown, AlertCircle, Search } from "lucide-react";
import { cn } from "../../lib/utils";
import { useToast } from "../../hooks/useToast";

type TransactionType = "sale" | "purchase" | "expense" | "refund" | "adjustment" | "other";

interface Transaction {
  id: string;
  type: TransactionType;
  amount: string;
  description: string;
  referenceType?: string;
  referenceId?: string;
  notes?: string;
  branchId?: string;
  branchName?: string;
  createdAt: string;
}

const typeColors: Record<TransactionType, "success" | "danger" | "warning" | "info" | "default"> = {
  sale: "success",
  purchase: "danger",
  expense: "danger",
  refund: "warning",
  adjustment: "info",
  other: "default",
};

const typeSign: Record<TransactionType, number> = {
  sale: 1,
  purchase: -1,
  expense: -1,
  refund: -1,
  adjustment: 1,
  other: 1,
};

const schema = z.object({
  type: z.enum(["sale", "purchase", "expense", "refund", "adjustment", "other"]),
  amount: z.number().min(0.01, "Amount must be greater than 0"),
  description: z.string().min(1, "Description is required"),
  branchId: z.string().optional(),
  referenceType: z.string().optional(),
  referenceId: z.string().optional(),
  notes: z.string().optional(),
});

type TxForm = z.infer<typeof schema>;

export default function TransactionsPage() {
  const { currentTenant } = useTenantStore();
  const { currentBranch } = useBranchStore();
  const qc = useQueryClient();
  const tid = currentTenant?.id;
  const myRole = currentTenant?.role || "staff";
  const canManage = ["owner", "admin", "manager"].includes(myRole);
  const canDelete = ["owner", "admin"].includes(myRole);
  const toast = useToast();

  const [modal, setModal] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<Transaction | null>(null);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");

  const form = useForm<TxForm>({
    resolver: zodResolver(schema),
    defaultValues: { type: "expense", branchId: currentBranch?.id },
  });

  const { data: txList = [], isLoading } = useQuery<Transaction[]>({
    queryKey: ["transactions", tid, currentBranch?.id],
    queryFn: () => api.get(`/api/tenants/${tid}/transactions`, { params: { branchId: currentBranch?.id } }).then((r) => r.data),
    enabled: !!tid && !!currentBranch?.id,
  });

  const save = useMutation({
    mutationFn: (data: TxForm) =>
      api.post(`/api/tenants/${tid}/transactions`, {
        ...data,
        amount: Number(data.amount),
        branchId: data.branchId || currentBranch?.id || undefined,
      }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["transactions", tid] }); setModal(false); form.reset({ type: "expense" }); toast.success("Transaction saved"); },
    onError: () => toast.error("Failed to save transaction"),
  });

  const remove = useMutation({
    mutationFn: (id: string) => api.delete(`/api/tenants/${tid}/transactions/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["transactions", tid] }); setDeleteConfirm(null); toast.success("Transaction deleted"); },
    onError: () => toast.error("Failed to delete transaction"),
  });

  const filtered = useMemo(() => {
    let list = txList;
    if (typeFilter !== "all") list = list.filter((t) => t.type === typeFilter);
    if (search) list = list.filter((t) =>
      t.description.toLowerCase().includes(search.toLowerCase()) ||
      (t.referenceType ?? "").toLowerCase().includes(search.toLowerCase())
    );
    return list;
  }, [txList, typeFilter, search]);

  const totalIncome = txList.filter((t) => typeSign[t.type] > 0).reduce((s, t) => s + Number(t.amount), 0);
  const totalExpense = txList.filter((t) => typeSign[t.type] < 0).reduce((s, t) => s + Number(t.amount), 0);
  const netBalance = totalIncome - totalExpense;

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
          <h1 className="text-2xl font-bold text-ink">Transactions</h1>
          <p className="text-muted text-sm mt-1">{txList.length} transaction{txList.length !== 1 ? "s" : ""}</p>
        </div>
        {canManage && (
          <Button onClick={() => setModal(true)} className="gap-2">
            <Plus className="w-4 h-4" /> Record transaction
          </Button>
        )}
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-panel border border-stroke p-4">
          <div className="flex items-center gap-2 mb-1">
            <TrendingUp className="w-4 h-4 text-green-500" />
            <p className="text-xs text-muted">Total income</p>
          </div>
          <p className="text-xl font-bold text-green-600">{formatCurrency(totalIncome)}</p>
        </div>
        <div className="bg-panel border border-stroke p-4">
          <div className="flex items-center gap-2 mb-1">
            <TrendingDown className="w-4 h-4 text-red-500" />
            <p className="text-xs text-muted">Total expenses</p>
          </div>
          <p className="text-xl font-bold text-red-600">{formatCurrency(totalExpense)}</p>
        </div>
        <div className="bg-panel border border-stroke p-4">
          <div className="flex items-center gap-2 mb-1">
            <ArrowLeftRight className="w-4 h-4 text-muted" />
            <p className="text-xs text-muted">Net balance</p>
          </div>
          <p className={cn("text-xl font-bold", netBalance >= 0 ? "text-green-600" : "text-red-600")}>
            {netBalance >= 0 ? "+" : ""}{formatCurrency(Math.abs(netBalance))}
          </p>
        </div>
      </div>

      {/* Filters */}
      {txList.length > 0 && (
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted pointer-events-none" />
            <input
              type="text"
              placeholder="Search transactions…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-sm border border-stroke bg-panel text-ink placeholder:text-muted focus:outline-none focus:border-primary-500"
            />
          </div>
          <Select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} className="sm:w-44">
            <option value="all">All types</option>
            <option value="sale">Sale</option>
            <option value="purchase">Purchase</option>
            <option value="expense">Expense</option>
            <option value="refund">Refund</option>
            <option value="adjustment">Adjustment</option>
            <option value="other">Other</option>
          </Select>
        </div>
      )}

      {txList.length === 0 ? (
        <div className="bg-panel border border-stroke">
          <div className="flex flex-col items-center justify-center py-20 px-6 text-center">
            <div className="w-14 h-14 bg-primary-50 border border-primary-200 flex items-center justify-center mb-5">
              <ArrowLeftRight className="w-7 h-7 text-primary-500" />
            </div>
            <h3 className="text-base font-semibold text-ink mb-1">No transactions yet</h3>
            <p className="text-sm text-muted max-w-xs mb-6">Record financial transactions to track your business cash flow</p>
            {canManage && <Button onClick={() => setModal(true)}>Record first transaction</Button>}
          </div>
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-panel border border-stroke">
          <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
            <AlertCircle className="w-8 h-8 text-muted mb-3" />
            <p className="text-sm font-medium text-ink mb-1">No results found</p>
            <p className="text-sm text-muted">Try changing your search or filter</p>
          </div>
        </div>
      ) : (
        <div className="bg-panel border border-stroke overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-stroke text-left">
                <th className="px-5 py-3 text-xs font-semibold text-muted uppercase tracking-wider">Type</th>
                <th className="px-5 py-3 text-xs font-semibold text-muted uppercase tracking-wider">Description</th>
                <th className="px-5 py-3 text-xs font-semibold text-muted uppercase tracking-wider hidden md:table-cell">Branch</th>
                <th className="px-5 py-3 text-xs font-semibold text-muted uppercase tracking-wider">Amount</th>
                <th className="px-5 py-3 text-xs font-semibold text-muted uppercase tracking-wider hidden lg:table-cell">Date</th>
                {canDelete && <th className="px-5 py-3" />}
              </tr>
            </thead>
            <tbody>
              {filtered.map((t) => (
                <tr key={t.id} className="border-b border-stroke hover:bg-hover transition-colors">
                  <td className="px-5 py-3">
                    <Badge variant={typeColors[t.type]}>{t.type}</Badge>
                  </td>
                  <td className="px-5 py-3">
                    <p className="font-medium text-ink">{t.description}</p>
                    {t.notes && <p className="text-xs text-muted mt-0.5 truncate max-w-[200px]">{t.notes}</p>}
                  </td>
                  <td className="px-5 py-3 text-muted hidden md:table-cell">{t.branchName || "—"}</td>
                  <td className="px-5 py-3">
                    <span className={cn("font-semibold", typeSign[t.type] > 0 ? "text-green-600" : "text-red-600")}>
                      {typeSign[t.type] > 0 ? "+" : "-"}{formatCurrency(Math.abs(Number(t.amount)))}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-muted hidden lg:table-cell">{formatDate(t.createdAt)}</td>
                  {canDelete && (
                    <td className="px-5 py-3">
                      <Button variant="ghost" size="sm" onClick={() => setDeleteConfirm(t)}>
                        <Trash2 className="w-4 h-4 text-red-400" />
                      </Button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Record transaction modal */}
      <Modal open={modal} onClose={() => { setModal(false); form.reset({ type: "expense" }); }} title="Record transaction" size="sm">
        <form onSubmit={form.handleSubmit((d) => save.mutate(d))} className="flex flex-col gap-4">
          {save.isError && (
            <div className="p-3 bg-red-50 border border-red-200 text-sm text-red-700">
              {(save.error as { response?: { data?: { error?: string } } })?.response?.data?.error || "Save failed"}
            </div>
          )}
          <Select label="Type *" {...form.register("type")}>
            <option value="sale">Sale</option>
            <option value="purchase">Purchase</option>
            <option value="expense">Expense</option>
            <option value="refund">Refund</option>
            <option value="adjustment">Adjustment</option>
            <option value="other">Other</option>
          </Select>
          <Input label="Amount *" type="number" step="0.01" min="0.01" placeholder="0.00" {...form.register("amount", { valueAsNumber: true })} error={form.formState.errors.amount?.message} />
          <Input label="Description *" placeholder="Describe the transaction…" {...form.register("description")} error={form.formState.errors.description?.message} />
          <Input label="Reference type" placeholder="e.g. order, invoice" {...form.register("referenceType")} />
          <Input label="Reference ID" placeholder="e.g. ORD-001" {...form.register("referenceId")} />
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-muted">Notes</label>
            <textarea rows={2} {...form.register("notes")} className="w-full border border-stroke bg-panel text-ink px-3 py-2 text-sm placeholder:text-muted focus:outline-none focus:border-primary-500 resize-none" placeholder="Optional notes…" />
          </div>
          <div className="flex gap-3 justify-end pt-2">
            <Button type="button" variant="outline" onClick={() => { setModal(false); form.reset({ type: "expense" }); }}>Cancel</Button>
            <Button type="submit" loading={save.isPending}>Record</Button>
          </div>
        </form>
      </Modal>

      {/* Delete confirmation */}
      <Modal open={!!deleteConfirm} onClose={() => setDeleteConfirm(null)} title="Delete transaction" size="sm">
        <div className="flex flex-col gap-4">
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 bg-red-50 border border-red-200 flex items-center justify-center flex-shrink-0">
              <AlertCircle className="w-5 h-5 text-red-500" />
            </div>
            <div>
              <p className="text-sm font-medium text-ink">Delete this transaction?</p>
              <p className="text-sm text-muted mt-1">
                &ldquo;{deleteConfirm?.description}&rdquo; — {deleteConfirm && formatCurrency(deleteConfirm.amount)}. This action cannot be undone.
              </p>
            </div>
          </div>
          <div className="flex gap-3 justify-end">
            <Button variant="outline" onClick={() => setDeleteConfirm(null)}>Cancel</Button>
            <Button variant="danger" loading={remove.isPending} onClick={() => deleteConfirm && remove.mutate(deleteConfirm.id)}>Delete</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
