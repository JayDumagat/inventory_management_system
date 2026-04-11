import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { api } from "../../api/client";
import { useTenantStore } from "../../stores/tenantStore";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { Modal } from "../../components/ui/Modal";
import { Badge } from "../../components/ui/Badge";
import { PageLoader } from "../../components/ui/Spinner";
import { formatDate } from "../../lib/utils";
import { Users, Plus, Pencil, Trash2, Search, AlertCircle, Mail, Phone, MapPin } from "lucide-react";

interface Customer {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  address?: string;
  city?: string;
  country?: string;
  notes?: string;
  createdAt: string;
  ordersCount?: number;
  totalSpent?: string;
}

const schema = z.object({
  name: z.string().min(1, "Name is required"),
  email: z.string().email("Invalid email").optional().or(z.literal("")),
  phone: z.string().optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  country: z.string().optional(),
  notes: z.string().optional(),
});

type CustomerForm = z.infer<typeof schema>;

export default function CustomersPage() {
  const { currentTenant } = useTenantStore();
  const qc = useQueryClient();
  const tid = currentTenant?.id;

  const [search, setSearch] = useState("");
  const [modal, setModal] = useState<{ open: boolean; customer?: Customer }>({ open: false });
  const [deleteConfirm, setDeleteConfirm] = useState<Customer | null>(null);

  const form = useForm<CustomerForm>({ resolver: zodResolver(schema) });

  const { data: customers = [], isLoading } = useQuery<Customer[]>({
    queryKey: ["customers", tid],
    queryFn: () => api.get(`/api/tenants/${tid}/customers`).then((r) => r.data),
    enabled: !!tid,
  });

  const save = useMutation({
    mutationFn: (data: CustomerForm) =>
      modal.customer
        ? api.patch(`/api/tenants/${tid}/customers/${modal.customer.id}`, data).then((r) => r.data)
        : api.post(`/api/tenants/${tid}/customers`, data).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["customers", tid] });
      setModal({ open: false });
      form.reset();
    },
  });

  const remove = useMutation({
    mutationFn: (id: string) => api.delete(`/api/tenants/${tid}/customers/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["customers", tid] });
      setDeleteConfirm(null);
    },
  });

  const openModal = (customer?: Customer) => {
    form.reset(customer ? {
      name: customer.name,
      email: customer.email || "",
      phone: customer.phone || "",
      address: customer.address || "",
      city: customer.city || "",
      country: customer.country || "",
      notes: customer.notes || "",
    } : {});
    setModal({ open: true, customer });
  };

  const filtered = useMemo(
    () => customers.filter((c) =>
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      (c.email ?? "").toLowerCase().includes(search.toLowerCase()) ||
      (c.phone ?? "").includes(search) ||
      (c.city ?? "").toLowerCase().includes(search.toLowerCase())
    ),
    [customers, search]
  );

  if (isLoading) return <PageLoader />;

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-ink">Customers</h1>
          <p className="text-muted text-sm mt-1">
            {customers.length} customer{customers.length !== 1 ? "s" : ""}
          </p>
        </div>
        <Button onClick={() => openModal()} className="gap-2 self-start sm:self-auto">
          <Plus className="w-4 h-4" /> Add customer
        </Button>
      </div>

      {/* Search */}
      {customers.length > 0 && (
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted pointer-events-none" />
          <input
            type="text"
            placeholder="Search customers by name, email, phone or city…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-sm border border-stroke bg-panel text-ink placeholder:text-muted focus:outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500/20"
          />
        </div>
      )}

      {/* Summary cards */}
      {customers.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <div className="bg-panel border border-stroke p-4">
            <p className="text-2xl font-bold text-ink">{customers.length}</p>
            <p className="text-xs text-muted mt-0.5">Total customers</p>
          </div>
          <div className="bg-panel border border-stroke p-4">
            <p className="text-2xl font-bold text-ink">
              {customers.filter((c) => c.email).length}
            </p>
            <p className="text-xs text-muted mt-0.5">With email</p>
          </div>
          <div className="bg-panel border border-stroke p-4 col-span-2 sm:col-span-1">
            <p className="text-2xl font-bold text-ink">
              {new Set(customers.map((c) => c.country).filter(Boolean)).size}
            </p>
            <p className="text-xs text-muted mt-0.5">Countries</p>
          </div>
        </div>
      )}

      {/* Empty states */}
      {customers.length === 0 ? (
        <div className="bg-panel border border-stroke">
          <div className="flex flex-col items-center justify-center py-20 px-6 text-center">
            <div className="w-14 h-14 bg-primary-50 border border-primary-200 flex items-center justify-center mb-5">
              <Users className="w-7 h-7 text-primary-500" />
            </div>
            <h3 className="text-base font-semibold text-ink mb-1">No customers yet</h3>
            <p className="text-sm text-muted max-w-xs mb-6">
              Record your customers to track orders, history, and build lasting relationships
            </p>
            <Button onClick={() => openModal()}>Add your first customer</Button>
          </div>
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-panel border border-stroke">
          <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
            <AlertCircle className="w-8 h-8 text-muted mb-3" />
            <p className="text-sm font-medium text-ink mb-1">No results found</p>
            <p className="text-sm text-muted">No customers match &ldquo;{search}&rdquo;</p>
          </div>
        </div>
      ) : (
        <>
          {/* Desktop table */}
          <div className="hidden md:block bg-panel border border-stroke overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-stroke text-left">
                  <th className="px-5 py-3 text-xs font-semibold text-muted uppercase tracking-wider">Customer</th>
                  <th className="px-5 py-3 text-xs font-semibold text-muted uppercase tracking-wider">Contact</th>
                  <th className="px-5 py-3 text-xs font-semibold text-muted uppercase tracking-wider">Location</th>
                  <th className="px-5 py-3 text-xs font-semibold text-muted uppercase tracking-wider">Added</th>
                  <th className="px-5 py-3" />
                </tr>
              </thead>
              <tbody>
                {filtered.map((c) => (
                  <tr key={c.id} className="border-b border-stroke hover:bg-hover transition-colors">
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-primary-50 border border-primary-200 flex items-center justify-center text-primary-700 font-bold text-xs flex-shrink-0">
                          {c.name[0]?.toUpperCase()}
                        </div>
                        <div>
                          <p className="font-medium text-ink">{c.name}</p>
                          {c.notes && (
                            <p className="text-xs text-muted truncate max-w-[180px]">{c.notes}</p>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-3">
                      <div className="space-y-0.5">
                        {c.email && (
                          <div className="flex items-center gap-1.5 text-muted text-xs">
                            <Mail className="w-3 h-3 flex-shrink-0" />
                            <span className="truncate max-w-[160px]">{c.email}</span>
                          </div>
                        )}
                        {c.phone && (
                          <div className="flex items-center gap-1.5 text-muted text-xs">
                            <Phone className="w-3 h-3 flex-shrink-0" />
                            {c.phone}
                          </div>
                        )}
                        {!c.email && !c.phone && <span className="text-muted text-xs">—</span>}
                      </div>
                    </td>
                    <td className="px-5 py-3">
                      {(c.city || c.country) ? (
                        <div className="flex items-center gap-1.5 text-muted text-sm">
                          <MapPin className="w-3 h-3 flex-shrink-0" />
                          {[c.city, c.country].filter(Boolean).join(", ")}
                        </div>
                      ) : <span className="text-muted">—</span>}
                    </td>
                    <td className="px-5 py-3 text-muted text-sm">{formatDate(c.createdAt)}</td>
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-1 justify-end">
                        <Button variant="ghost" size="sm" onClick={() => openModal(c)}>
                          <Pencil className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => setDeleteConfirm(c)}>
                          <Trash2 className="w-4 h-4 text-red-400" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="md:hidden bg-panel border border-stroke divide-y divide-stroke">
            {filtered.map((c) => (
              <div key={c.id} className="px-4 py-3 flex items-start justify-between gap-3">
                <div className="flex items-start gap-3 min-w-0">
                  <div className="w-9 h-9 bg-primary-50 border border-primary-200 flex items-center justify-center text-primary-700 font-bold text-sm flex-shrink-0 mt-0.5">
                    {c.name[0]?.toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <p className="font-medium text-ink truncate">{c.name}</p>
                    {c.email && (
                      <p className="text-xs text-muted truncate mt-0.5">{c.email}</p>
                    )}
                    {c.phone && (
                      <p className="text-xs text-muted mt-0.5">{c.phone}</p>
                    )}
                    {(c.city || c.country) && (
                      <div className="flex items-center gap-1 mt-1">
                        <MapPin className="w-3 h-3 text-muted flex-shrink-0" />
                        <span className="text-xs text-muted">{[c.city, c.country].filter(Boolean).join(", ")}</span>
                      </div>
                    )}
                    <Badge variant="default" className="mt-1.5">{formatDate(c.createdAt)}</Badge>
                  </div>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  <Button variant="ghost" size="sm" onClick={() => openModal(c)}>
                    <Pencil className="w-3.5 h-3.5" />
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => setDeleteConfirm(c)}>
                    <Trash2 className="w-3.5 h-3.5 text-red-400" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Add / Edit modal */}
      <Modal
        open={modal.open}
        onClose={() => setModal({ open: false })}
        title={modal.customer ? "Edit customer" : "Add customer"}
        size="md"
      >
        <form onSubmit={form.handleSubmit((d) => save.mutate(d))} className="flex flex-col gap-4">
          <Input
            label="Full name *"
            placeholder="Jane Smith"
            {...form.register("name")}
            error={form.formState.errors.name?.message}
          />
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Email"
              type="email"
              placeholder="jane@example.com"
              {...form.register("email")}
              error={form.formState.errors.email?.message}
            />
            <Input
              label="Phone"
              placeholder="+1 555-000-0000"
              {...form.register("phone")}
            />
          </div>
          <Input
            label="Address"
            placeholder="123 Main St"
            {...form.register("address")}
          />
          <div className="grid grid-cols-2 gap-3">
            <Input label="City" placeholder="New York" {...form.register("city")} />
            <Input label="Country" placeholder="US" {...form.register("country")} />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-muted">Notes (optional)</label>
            <textarea
              placeholder="Internal notes about this customer…"
              rows={2}
              {...form.register("notes")}
              className="w-full border border-stroke bg-panel text-ink px-3 py-2 text-sm placeholder:text-muted focus:outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500/20 resize-none"
            />
          </div>
          <div className="flex gap-3 justify-end pt-2">
            <Button type="button" variant="outline" onClick={() => setModal({ open: false })}>Cancel</Button>
            <Button type="submit" loading={save.isPending}>Save</Button>
          </div>
        </form>
      </Modal>

      {/* Delete confirmation */}
      <Modal open={!!deleteConfirm} onClose={() => setDeleteConfirm(null)} title="Delete customer" size="sm">
        <div className="flex flex-col gap-4">
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 bg-red-50 border border-red-200 flex items-center justify-center flex-shrink-0">
              <AlertCircle className="w-5 h-5 text-red-500" />
            </div>
            <div>
              <p className="text-sm font-medium text-ink">
                Delete &ldquo;{deleteConfirm?.name}&rdquo;?
              </p>
              <p className="text-sm text-muted mt-1">
                This will permanently delete this customer record. Their order history will not be affected.
              </p>
            </div>
          </div>
          <div className="flex gap-3 justify-end">
            <Button type="button" variant="outline" onClick={() => setDeleteConfirm(null)}>Cancel</Button>
            <Button
              variant="danger"
              loading={remove.isPending}
              onClick={() => deleteConfirm && remove.mutate(deleteConfirm.id)}
            >
              Delete
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
