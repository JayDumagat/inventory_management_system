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
import {
  Truck, Plus, Pencil, Trash2, Search, AlertCircle,
  Mail, Phone, Globe, MapPin,
} from "lucide-react";

interface Supplier {
  id: string;
  name: string;
  contactName?: string;
  email?: string;
  phone?: string;
  website?: string;
  address?: string;
  city?: string;
  country?: string;
  notes?: string;
  isActive: boolean;
  createdAt: string;
}

const schema = z.object({
  name: z.string().min(1, "Name is required"),
  contactName: z.string().optional(),
  email: z.string().email("Invalid email").optional().or(z.literal("")),
  phone: z.string().optional(),
  website: z.string().optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  country: z.string().optional(),
  notes: z.string().optional(),
});

type SupplierForm = z.infer<typeof schema>;

export default function SuppliersPage() {
  const { currentTenant } = useTenantStore();
  const qc = useQueryClient();
  const tid = currentTenant?.id;
  const myRole = currentTenant?.role || "staff";
  const canManage = ["owner", "admin", "manager"].includes(myRole);

  const [search, setSearch] = useState("");
  const [modal, setModal] = useState<{ open: boolean; supplier?: Supplier }>({ open: false });
  const [deleteConfirm, setDeleteConfirm] = useState<Supplier | null>(null);

  const form = useForm<SupplierForm>({ resolver: zodResolver(schema) });

  const { data: suppliers = [], isLoading } = useQuery<Supplier[]>({
    queryKey: ["suppliers", tid],
    queryFn: () => api.get(`/api/tenants/${tid}/suppliers`).then((r) => r.data),
    enabled: !!tid,
  });

  const save = useMutation({
    mutationFn: (data: SupplierForm) =>
      modal.supplier
        ? api.patch(`/api/tenants/${tid}/suppliers/${modal.supplier.id}`, data).then((r) => r.data)
        : api.post(`/api/tenants/${tid}/suppliers`, data).then((r) => r.data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["suppliers", tid] }); closeModal(); },
  });

  const remove = useMutation({
    mutationFn: (id: string) => api.delete(`/api/tenants/${tid}/suppliers/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["suppliers", tid] }); setDeleteConfirm(null); },
  });

  const closeModal = () => { setModal({ open: false }); form.reset(); };

  const openModal = (supplier?: Supplier) => {
    form.reset(supplier ? {
      name: supplier.name,
      contactName: supplier.contactName || "",
      email: supplier.email || "",
      phone: supplier.phone || "",
      website: supplier.website || "",
      address: supplier.address || "",
      city: supplier.city || "",
      country: supplier.country || "",
      notes: supplier.notes || "",
    } : {});
    setModal({ open: true, supplier });
  };

  const filtered = useMemo(
    () => suppliers.filter((s) =>
      s.name.toLowerCase().includes(search.toLowerCase()) ||
      (s.email ?? "").toLowerCase().includes(search.toLowerCase()) ||
      (s.contactName ?? "").toLowerCase().includes(search.toLowerCase()) ||
      (s.city ?? "").toLowerCase().includes(search.toLowerCase())
    ),
    [suppliers, search]
  );

  if (isLoading) return <PageLoader />;

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-ink">Suppliers</h1>
          <p className="text-muted text-sm mt-1">
            {suppliers.length} supplier{suppliers.length !== 1 ? "s" : ""}
          </p>
        </div>
        {canManage && (
          <Button onClick={() => openModal()} className="gap-2 self-start sm:self-auto">
            <Plus className="w-4 h-4" /> Add supplier
          </Button>
        )}
      </div>

      {suppliers.length > 0 && (
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted pointer-events-none" />
          <input
            type="text"
            placeholder="Search suppliers by name, email, contact or city…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-sm border border-stroke bg-panel text-ink placeholder:text-muted focus:outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500/20"
          />
        </div>
      )}

      {/* Summary cards */}
      {suppliers.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <div className="bg-panel border border-stroke p-4">
            <p className="text-2xl font-bold text-ink">{suppliers.length}</p>
            <p className="text-xs text-muted mt-0.5">Total suppliers</p>
          </div>
          <div className="bg-panel border border-stroke p-4">
            <p className="text-2xl font-bold text-ink">{suppliers.filter((s) => s.isActive).length}</p>
            <p className="text-xs text-muted mt-0.5">Active</p>
          </div>
          <div className="bg-panel border border-stroke p-4 col-span-2 sm:col-span-1">
            <p className="text-2xl font-bold text-ink">
              {new Set(suppliers.map((s) => s.country).filter(Boolean)).size}
            </p>
            <p className="text-xs text-muted mt-0.5">Countries</p>
          </div>
        </div>
      )}

      {suppliers.length === 0 ? (
        <div className="bg-panel border border-stroke">
          <div className="flex flex-col items-center justify-center py-20 px-6 text-center">
            <div className="w-14 h-14 bg-primary-50 border border-primary-200 flex items-center justify-center mb-5">
              <Truck className="w-7 h-7 text-primary-500" />
            </div>
            <h3 className="text-base font-semibold text-ink mb-1">No suppliers yet</h3>
            <p className="text-sm text-muted max-w-xs mb-6">
              Add suppliers to manage your purchasing contacts and purchase orders
            </p>
            {canManage && <Button onClick={() => openModal()}>Add your first supplier</Button>}
          </div>
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-panel border border-stroke">
          <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
            <AlertCircle className="w-8 h-8 text-muted mb-3" />
            <p className="text-sm font-medium text-ink mb-1">No results found</p>
            <p className="text-sm text-muted">No suppliers match &ldquo;{search}&rdquo;</p>
          </div>
        </div>
      ) : (
        <div className="bg-panel border border-stroke overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-stroke text-left">
                <th className="px-5 py-3 text-xs font-semibold text-muted uppercase tracking-wider">Supplier</th>
                <th className="px-5 py-3 text-xs font-semibold text-muted uppercase tracking-wider hidden md:table-cell">Contact</th>
                <th className="px-5 py-3 text-xs font-semibold text-muted uppercase tracking-wider hidden lg:table-cell">Location</th>
                <th className="px-5 py-3 text-xs font-semibold text-muted uppercase tracking-wider hidden sm:table-cell">Status</th>
                <th className="px-5 py-3 text-xs font-semibold text-muted uppercase tracking-wider hidden lg:table-cell">Added</th>
                {canManage && <th className="px-5 py-3" />}
              </tr>
            </thead>
            <tbody>
              {filtered.map((s) => (
                <tr key={s.id} className="border-b border-stroke hover:bg-hover transition-colors">
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-primary-50 border border-primary-200 flex items-center justify-center text-primary-700 font-bold text-xs flex-shrink-0">
                        {s.name[0]?.toUpperCase()}
                      </div>
                      <div>
                        <p className="font-medium text-ink">{s.name}</p>
                        {s.website && (
                          <div className="flex items-center gap-1 text-xs text-muted mt-0.5">
                            <Globe className="w-3 h-3" />
                            <span className="truncate max-w-[140px]">{s.website}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-3 hidden md:table-cell">
                    <div className="space-y-0.5">
                      {s.contactName && <p className="text-ink text-sm">{s.contactName}</p>}
                      {s.email && (
                        <div className="flex items-center gap-1.5 text-muted text-xs">
                          <Mail className="w-3 h-3 flex-shrink-0" />
                          <span className="truncate max-w-[160px]">{s.email}</span>
                        </div>
                      )}
                      {s.phone && (
                        <div className="flex items-center gap-1.5 text-muted text-xs">
                          <Phone className="w-3 h-3 flex-shrink-0" />
                          {s.phone}
                        </div>
                      )}
                      {!s.contactName && !s.email && !s.phone && <span className="text-muted text-xs">—</span>}
                    </div>
                  </td>
                  <td className="px-5 py-3 hidden lg:table-cell">
                    {(s.city || s.country) ? (
                      <div className="flex items-center gap-1.5 text-muted text-sm">
                        <MapPin className="w-3 h-3 flex-shrink-0" />
                        {[s.city, s.country].filter(Boolean).join(", ")}
                      </div>
                    ) : <span className="text-muted">—</span>}
                  </td>
                  <td className="px-5 py-3 hidden sm:table-cell">
                    <Badge variant={s.isActive ? "success" : "default"}>{s.isActive ? "Active" : "Inactive"}</Badge>
                  </td>
                  <td className="px-5 py-3 text-muted text-sm hidden lg:table-cell">{formatDate(s.createdAt)}</td>
                  {canManage && (
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-1 justify-end">
                        <Button variant="ghost" size="sm" onClick={() => openModal(s)}>
                          <Pencil className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => setDeleteConfirm(s)}>
                          <Trash2 className="w-4 h-4 text-red-400" />
                        </Button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Add / Edit modal */}
      <Modal
        open={modal.open}
        onClose={closeModal}
        title={modal.supplier ? "Edit supplier" : "Add supplier"}
        size="md"
      >
        <form onSubmit={form.handleSubmit((d) => save.mutate(d))} className="flex flex-col gap-4">
          {save.isError && (
            <div className="p-3 bg-red-50 border border-red-200 text-sm text-red-700">
              {(save.error as { response?: { data?: { error?: string } } })?.response?.data?.error || "Save failed"}
            </div>
          )}
          <Input label="Company name *" placeholder="Acme Supplies" {...form.register("name")} error={form.formState.errors.name?.message} />
          <Input label="Contact person" placeholder="Jane Smith" {...form.register("contactName")} />
          <div className="grid grid-cols-2 gap-3">
            <Input label="Email" type="email" placeholder="supplier@example.com" {...form.register("email")} error={form.formState.errors.email?.message} />
            <Input label="Phone" placeholder="+1 555-000-0000" {...form.register("phone")} />
          </div>
          <Input label="Website" placeholder="https://example.com" {...form.register("website")} />
          <Input label="Address" placeholder="123 Main St" {...form.register("address")} />
          <div className="grid grid-cols-2 gap-3">
            <Input label="City" placeholder="New York" {...form.register("city")} />
            <Input label="Country" placeholder="US" {...form.register("country")} />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-muted">Notes (optional)</label>
            <textarea
              placeholder="Internal notes about this supplier…"
              rows={2}
              {...form.register("notes")}
              className="w-full border border-stroke bg-panel text-ink px-3 py-2 text-sm placeholder:text-muted focus:outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500/20 resize-none"
            />
          </div>
          <div className="flex gap-3 justify-end pt-2">
            <Button type="button" variant="outline" onClick={closeModal}>Cancel</Button>
            <Button type="submit" loading={save.isPending}>{modal.supplier ? "Save" : "Add supplier"}</Button>
          </div>
        </form>
      </Modal>

      {/* Delete confirmation */}
      <Modal open={!!deleteConfirm} onClose={() => setDeleteConfirm(null)} title="Delete supplier" size="sm">
        <div className="flex flex-col gap-4">
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 bg-red-50 border border-red-200 flex items-center justify-center flex-shrink-0">
              <AlertCircle className="w-5 h-5 text-red-500" />
            </div>
            <div>
              <p className="text-sm font-medium text-ink">Delete &ldquo;{deleteConfirm?.name}&rdquo;?</p>
              <p className="text-sm text-muted mt-1">
                This will permanently delete this supplier. Purchase orders linked to this supplier will retain a reference.
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
