import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { api } from "../../api/client";
import { useTenantStore } from "../../stores/tenantStore";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { Select } from "../../components/ui/Select";
import { Card, CardContent } from "../../components/ui/Card";
import { Modal } from "../../components/ui/Modal";
import { Skeleton, SkeletonTable } from "../../components/ui/Skeleton";
import { Plus, Pencil, Trash2, Tag, Search, FolderTree, AlertCircle } from "lucide-react";
import { useToast } from "../../hooks/useToast";

interface Category { id: string; name: string; description?: string; parentId?: string; }

const schema = z.object({
  name: z.string().min(1, "Name is required"),
  description: z.string().optional(),
  parentId: z.string().optional(),
});
type FormData = z.infer<typeof schema>;

function CategoryActions({
  c,
  onEdit,
  onDelete,
}: {
  c: Category;
  onEdit: (c: Category) => void;
  onDelete: (id: string) => void;
}) {
  return (
    <div className="flex items-center gap-1 justify-end">
      <Button variant="ghost" size="sm" onClick={() => onEdit(c)}>
        <Pencil className="w-4 h-4" />
      </Button>
      <Button variant="ghost" size="sm" onClick={() => onDelete(c.id)}>
        <Trash2 className="w-4 h-4 text-red-400" />
      </Button>
    </div>
  );
}

export default function CategoriesPage() {
  const { currentTenant } = useTenantStore();
  const qc = useQueryClient();
  const tid = currentTenant?.id;
  const [modal, setModal] = useState<{ open: boolean; category?: Category }>({ open: false });
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const toast = useToast();

  const { data: categories = [], isLoading } = useQuery<Category[]>({
    queryKey: ["categories", tid],
    queryFn: () => api.get(`/api/tenants/${tid}/categories`).then((r) => r.data),
    enabled: !!tid,
  });

  const form = useForm<FormData>({ resolver: zodResolver(schema) });

  const save = useMutation({
    mutationFn: (data: FormData) => modal.category
      ? api.patch(`/api/tenants/${tid}/categories/${modal.category.id}`, data)
      : api.post(`/api/tenants/${tid}/categories`, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["categories", tid] }); setModal({ open: false }); form.reset(); toast.success("Category saved"); },
    onError: () => toast.error("Failed to save category"),
  });

  const remove = useMutation({
    mutationFn: (id: string) => api.delete(`/api/tenants/${tid}/categories/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["categories", tid] }); setDeleteConfirm(null); toast.success("Category deleted"); },
    onError: () => toast.error("Failed to delete category"),
  });

  const openModal = (category?: Category) => {
    form.reset(category ? { name: category.name, description: category.description, parentId: category.parentId ?? "" } : {});
    setModal({ open: true, category });
  };

  const filtered = useMemo(
    () => categories.filter((c) =>
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      (c.description ?? "").toLowerCase().includes(search.toLowerCase())
    ),
    [categories, search]
  );

  const topLevel = filtered.filter((c) => !c.parentId);
  const subCategories = filtered.filter((c) => !!c.parentId);
  const topCount = categories.filter((c) => !c.parentId).length;
  const subCount = categories.filter((c) => !!c.parentId).length;

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
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-ink">Categories</h1>
          <p className="text-muted text-sm mt-1">
            {topCount} top-level · {subCount} sub-categor{subCount === 1 ? "y" : "ies"}
          </p>
        </div>
        <Button onClick={() => openModal()} className="gap-2 self-start sm:self-auto">
          <Plus className="w-4 h-4" /> Add category
        </Button>
      </div>

      {/* Stat cards */}
      {categories.length > 0 && (
        <div className="grid grid-cols-3 gap-3">
          <Card>
            <CardContent className="py-3 flex items-center gap-3">
              <div className="w-8 h-8 bg-primary-50 border border-primary-200 flex items-center justify-center flex-shrink-0">
                <FolderTree className="w-4 h-4 text-primary-600" />
              </div>
              <div>
                <p className="text-lg font-bold text-ink">{categories.length}</p>
                <p className="text-xs text-muted">Total</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="py-3 flex items-center gap-3">
              <div className="w-8 h-8 bg-blue-50 border border-blue-200 flex items-center justify-center flex-shrink-0">
                <Tag className="w-4 h-4 text-blue-600" />
              </div>
              <div>
                <p className="text-lg font-bold text-ink">{topCount}</p>
                <p className="text-xs text-muted">Top-level</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="py-3 flex items-center gap-3">
              <div className="w-8 h-8 bg-green-50 border border-green-200 flex items-center justify-center flex-shrink-0">
                <Tag className="w-4 h-4 text-green-600" />
              </div>
              <div>
                <p className="text-lg font-bold text-ink">{subCount}</p>
                <p className="text-xs text-muted">Sub-categories</p>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Search bar */}
      {categories.length > 0 && (
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted pointer-events-none" />
          <input
            type="text"
            placeholder="Search categories…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-sm border border-stroke bg-panel text-ink placeholder:text-muted focus:outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500/20"
          />
        </div>
      )}

      {/* Empty state */}
      {categories.length === 0 ? (
        <Card>
          <CardContent className="p-0">
            <div className="flex flex-col items-center justify-center py-20 px-6 text-center">
              <div className="w-14 h-14 bg-primary-50 border border-primary-200 flex items-center justify-center mb-5">
                <Tag className="w-7 h-7 text-primary-500" />
              </div>
              <h3 className="text-base font-semibold text-ink mb-1">No categories yet</h3>
              <p className="text-sm text-muted max-w-xs mb-6">Organize your products by adding categories and subcategories</p>
              <Button onClick={() => openModal()}>Add your first category</Button>
            </div>
          </CardContent>
        </Card>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <AlertCircle className="w-8 h-8 text-muted mx-auto mb-3" />
            <p className="text-sm font-medium text-ink mb-1">No results found</p>
            <p className="text-sm text-muted">No categories match &ldquo;{search}&rdquo;</p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          {/* Desktop table */}
          <div className="hidden sm:block overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-stroke text-left">
                  <th className="px-5 py-3 text-xs font-semibold text-muted uppercase tracking-wider">Name</th>
                  <th className="px-5 py-3 text-xs font-semibold text-muted uppercase tracking-wider">Description</th>
                  <th className="px-5 py-3 text-xs font-semibold text-muted uppercase tracking-wider">Parent</th>
                  <th className="px-5 py-3" />
                </tr>
              </thead>
              <tbody>
                {topLevel.map((c) => (
                  <tr key={c.id} className="border-b border-stroke hover:bg-hover transition-colors">
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-2.5">
                        <div className="w-6 h-6 bg-primary-50 border border-primary-200 flex items-center justify-center flex-shrink-0">
                          <Tag className="w-3 h-3 text-primary-600" />
                        </div>
                        <span className="font-medium text-ink">{c.name}</span>
                      </div>
                    </td>
                    <td className="px-5 py-3 text-muted">{c.description || "—"}</td>
                    <td className="px-5 py-3">
                      <span className="text-xs bg-stroke text-ink px-2 py-0.5">
                        Top level
                      </span>
                    </td>
                    <td className="px-5 py-3">
                      <CategoryActions c={c} onEdit={openModal} onDelete={setDeleteConfirm} />
                    </td>
                  </tr>
                ))}
                {subCategories.map((c) => {
                  const parent = categories.find((p) => p.id === c.parentId);
                  return (
                    <tr key={c.id} className="border-b border-stroke hover:bg-hover transition-colors">
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-2.5 pl-5">
                          <div className="w-6 h-6 bg-blue-50 border border-blue-200 flex items-center justify-center flex-shrink-0">
                            <Tag className="w-3 h-3 text-blue-600" />
                          </div>
                          <span className="font-medium text-ink">{c.name}</span>
                        </div>
                      </td>
                      <td className="px-5 py-3 text-muted">{c.description || "—"}</td>
                      <td className="px-5 py-3">
                        {parent ? (
                          <div className="flex items-center gap-1.5">
                            <Tag className="w-3 h-3 text-muted flex-shrink-0" />
                            <span className="text-sm text-ink">{parent.name}</span>
                          </div>
                        ) : "—"}
                      </td>
                      <td className="px-5 py-3">
                        <CategoryActions c={c} onEdit={openModal} onDelete={setDeleteConfirm} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile card list */}
          <div className="sm:hidden divide-y divide-stroke">
            {filtered.map((c) => {
              const parent = c.parentId ? categories.find((p) => p.id === c.parentId) : null;
              const isTop = !c.parentId;
              return (
                <div key={c.id} className="px-4 py-3 flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3 min-w-0">
                    <div className={`w-8 h-8 border flex items-center justify-center flex-shrink-0 mt-0.5 ${isTop ? "bg-primary-50 border-primary-200" : "bg-blue-50 border-blue-200"}`}>
                      <Tag className={`w-3.5 h-3.5 ${isTop ? "text-primary-600" : "text-blue-600"}`} />
                    </div>
                    <div className="min-w-0">
                      <p className="font-medium text-ink truncate">{c.name}</p>
                      {c.description && (
                        <p className="text-xs text-muted mt-0.5 truncate">{c.description}</p>
                      )}
                      <div className="mt-1">
                        {parent ? (
                          <div className="flex items-center gap-1">
                            <Tag className="w-3 h-3 text-muted flex-shrink-0" />
                            <span className="text-xs text-muted">{parent.name}</span>
                          </div>
                        ) : (
                          <span className="text-[10px] bg-stroke text-ink px-1.5 py-0.5">
                            Top level
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <CategoryActions c={c} onEdit={openModal} onDelete={setDeleteConfirm} />
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {/* Add / Edit modal */}
      <Modal open={modal.open} onClose={() => setModal({ open: false })} title={modal.category ? "Edit category" : "Add category"}>
        <form onSubmit={form.handleSubmit((d) => save.mutate(d))} className="flex flex-col gap-4">
          <Input label="Name" placeholder="e.g. Electronics" {...form.register("name")} error={form.formState.errors.name?.message} />
          <Input label="Description" placeholder="Optional description" {...form.register("description")} />
          <Select label="Parent category" {...form.register("parentId")}>
            <option value="">None (top-level)</option>
            {categories.filter((c) => c.id !== modal.category?.id).map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </Select>
          <div className="flex gap-3 justify-end pt-2">
            <Button type="button" variant="outline" onClick={() => setModal({ open: false })}>Cancel</Button>
            <Button type="submit" loading={save.isPending}>Save</Button>
          </div>
        </form>
      </Modal>

      {/* Delete confirmation modal */}
      <Modal open={!!deleteConfirm} onClose={() => setDeleteConfirm(null)} title="Delete category" size="sm">
        <div className="flex flex-col gap-4">
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 bg-red-50 border border-red-200 flex items-center justify-center flex-shrink-0">
              <AlertCircle className="w-5 h-5 text-red-500" />
            </div>
            <div>
              <p className="text-sm font-medium text-ink">
                Delete &ldquo;{categories.find((c) => c.id === deleteConfirm)?.name}&rdquo;?
              </p>
              <p className="text-sm text-muted mt-1">
                This action cannot be undone. Products in this category will become uncategorized.
              </p>
            </div>
          </div>
          <div className="flex gap-3 justify-end">
            <Button type="button" variant="outline" onClick={() => setDeleteConfirm(null)}>Cancel</Button>
            <Button variant="danger" loading={remove.isPending} onClick={() => deleteConfirm && remove.mutate(deleteConfirm)}>
              Delete
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
