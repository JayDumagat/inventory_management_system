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
import { PageLoader } from "../../components/ui/Spinner";
import { Plus, Pencil, Trash2, Tag, Search, FolderTree, AlertCircle } from "lucide-react";

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
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["categories", tid] }); setModal({ open: false }); form.reset(); },
  });

  const remove = useMutation({
    mutationFn: (id: string) => api.delete(`/api/tenants/${tid}/categories/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["categories", tid] }); setDeleteConfirm(null); },
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

  if (isLoading) return <PageLoader />;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Categories</h1>
          <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">
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
              <div className="w-8 h-8 rounded bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center flex-shrink-0">
                <FolderTree className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <p className="text-lg font-bold text-gray-900 dark:text-white">{categories.length}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">Total</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="py-3 flex items-center gap-3">
              <div className="w-8 h-8 rounded bg-purple-50 dark:bg-purple-900/20 flex items-center justify-center flex-shrink-0">
                <Tag className="w-4 h-4 text-purple-600 dark:text-purple-400" />
              </div>
              <div>
                <p className="text-lg font-bold text-gray-900 dark:text-white">{topCount}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">Top-level</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="py-3 flex items-center gap-3">
              <div className="w-8 h-8 rounded bg-green-50 dark:bg-green-900/20 flex items-center justify-center flex-shrink-0">
                <Tag className="w-4 h-4 text-green-600 dark:text-green-400" />
              </div>
              <div>
                <p className="text-lg font-bold text-gray-900 dark:text-white">{subCount}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">Sub-categories</p>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Search bar */}
      {categories.length > 0 && (
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
          <input
            type="text"
            placeholder="Search categories…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-sm rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-white placeholder:text-gray-400 focus:outline-none focus:border-primary-500 dark:focus:border-primary-400 focus:ring-1 focus:ring-primary-500/20"
          />
        </div>
      )}

      {/* Empty state */}
      {categories.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <div className="w-12 h-12 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center mx-auto mb-4">
              <Tag className="w-6 h-6 text-gray-400" />
            </div>
            <p className="text-gray-900 dark:text-white font-medium mb-1">No categories yet</p>
            <p className="text-gray-400 dark:text-gray-500 text-sm mb-4">Organize your products by adding categories</p>
            <Button onClick={() => openModal()}>Add your first category</Button>
          </CardContent>
        </Card>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-gray-500 dark:text-gray-400">No categories match &ldquo;{search}&rdquo;</p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          {/* Desktop table */}
          <div className="hidden sm:block overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 dark:border-gray-800 text-left">
                  <th className="px-5 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">Name</th>
                  <th className="px-5 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">Description</th>
                  <th className="px-5 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">Parent</th>
                  <th className="px-5 py-3" />
                </tr>
              </thead>
              <tbody>
                {topLevel.map((c) => (
                  <tr key={c.id} className="border-b border-gray-50 dark:border-gray-800/50 hover:bg-gray-50 dark:hover:bg-gray-800/40 transition-colors">
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-2.5">
                        <div className="w-6 h-6 rounded bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center flex-shrink-0">
                          <Tag className="w-3 h-3 text-blue-500 dark:text-blue-400" />
                        </div>
                        <span className="font-medium text-gray-900 dark:text-white">{c.name}</span>
                      </div>
                    </td>
                    <td className="px-5 py-3 text-gray-500 dark:text-gray-400">{c.description || "—"}</td>
                    <td className="px-5 py-3">
                      <span className="text-xs bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 px-2 py-0.5 rounded">
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
                    <tr key={c.id} className="border-b border-gray-50 dark:border-gray-800/50 hover:bg-gray-50 dark:hover:bg-gray-800/40 transition-colors">
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-2.5 pl-5">
                          <div className="w-6 h-6 rounded bg-purple-50 dark:bg-purple-900/20 flex items-center justify-center flex-shrink-0">
                            <Tag className="w-3 h-3 text-purple-500 dark:text-purple-400" />
                          </div>
                          <span className="font-medium text-gray-900 dark:text-white">{c.name}</span>
                        </div>
                      </td>
                      <td className="px-5 py-3 text-gray-500 dark:text-gray-400">{c.description || "—"}</td>
                      <td className="px-5 py-3">
                        {parent ? (
                          <div className="flex items-center gap-1.5">
                            <Tag className="w-3 h-3 text-blue-400 flex-shrink-0" />
                            <span className="text-sm text-gray-600 dark:text-gray-300">{parent.name}</span>
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
          <div className="sm:hidden divide-y divide-gray-100 dark:divide-gray-800">
            {filtered.map((c) => {
              const parent = c.parentId ? categories.find((p) => p.id === c.parentId) : null;
              const isTop = !c.parentId;
              return (
                <div key={c.id} className="px-4 py-3 flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3 min-w-0">
                    <div className={`w-8 h-8 rounded flex items-center justify-center flex-shrink-0 mt-0.5 ${isTop ? "bg-blue-50 dark:bg-blue-900/20" : "bg-purple-50 dark:bg-purple-900/20"}`}>
                      <Tag className={`w-3.5 h-3.5 ${isTop ? "text-blue-500 dark:text-blue-400" : "text-purple-500 dark:text-purple-400"}`} />
                    </div>
                    <div className="min-w-0">
                      <p className="font-medium text-gray-900 dark:text-white truncate">{c.name}</p>
                      {c.description && (
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 truncate">{c.description}</p>
                      )}
                      <div className="mt-1">
                        {parent ? (
                          <div className="flex items-center gap-1">
                            <Tag className="w-3 h-3 text-gray-400 flex-shrink-0" />
                            <span className="text-xs text-gray-500 dark:text-gray-400">{parent.name}</span>
                          </div>
                        ) : (
                          <span className="text-[10px] bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 px-1.5 py-0.5 rounded">
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
            <div className="w-9 h-9 rounded-full bg-red-50 dark:bg-red-900/20 flex items-center justify-center flex-shrink-0">
              <AlertCircle className="w-5 h-5 text-red-500" />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-900 dark:text-white">
                Delete &ldquo;{categories.find((c) => c.id === deleteConfirm)?.name}&rdquo;?
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
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
