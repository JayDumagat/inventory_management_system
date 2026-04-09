import { useState } from "react";
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
import { Plus, Pencil, Trash2 } from "lucide-react";

interface Category { id: string; name: string; description?: string; parentId?: string; }

const schema = z.object({
  name: z.string().min(1, "Name required"),
  description: z.string().optional(),
  parentId: z.string().optional(),
});
type FormData = z.infer<typeof schema>;

export default function CategoriesPage() {
  const { currentTenant } = useTenantStore();
  const qc = useQueryClient();
  const tid = currentTenant?.id;
  const [modal, setModal] = useState<{ open: boolean; category?: Category }>({ open: false });

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
    onSuccess: () => qc.invalidateQueries({ queryKey: ["categories", tid] }),
  });

  const openModal = (category?: Category) => {
    form.reset(category ? { name: category.name, description: category.description, parentId: category.parentId ?? "" } : {});
    setModal({ open: true, category });
  };

  if (isLoading) return <PageLoader />;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Categories</h1>
          <p className="text-gray-500 text-sm mt-1">{categories.length} categories</p>
        </div>
        <Button onClick={() => openModal()} className="gap-2">
          <Plus className="w-4 h-4" /> Add category
        </Button>
      </div>

      {categories.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <p className="text-gray-400 mb-4">No categories yet</p>
            <Button onClick={() => openModal()}>Add your first category</Button>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 text-left">
                  <th className="px-6 py-3 font-medium text-gray-500">Name</th>
                  <th className="px-6 py-3 font-medium text-gray-500">Description</th>
                  <th className="px-6 py-3 font-medium text-gray-500">Parent</th>
                  <th className="px-6 py-3" />
                </tr>
              </thead>
              <tbody>
                {categories.map((c) => (
                  <tr key={c.id} className="border-b border-gray-50 hover:bg-gray-50">
                    <td className="px-6 py-3 font-medium text-gray-900">{c.name}</td>
                    <td className="px-6 py-3 text-gray-500">{c.description || "—"}</td>
                    <td className="px-6 py-3 text-gray-500">
                      {c.parentId ? categories.find((p) => p.id === c.parentId)?.name || "—" : "—"}
                    </td>
                    <td className="px-6 py-3">
                      <div className="flex items-center gap-1 justify-end">
                        <Button variant="ghost" size="sm" onClick={() => openModal(c)}>
                          <Pencil className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => { if (confirm("Delete this category?")) remove.mutate(c.id); }}>
                          <Trash2 className="w-4 h-4 text-red-400" />
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

      <Modal open={modal.open} onClose={() => setModal({ open: false })} title={modal.category ? "Edit category" : "Add category"}>
        <form onSubmit={form.handleSubmit((d) => save.mutate(d))} className="flex flex-col gap-4">
          <Input label="Name" {...form.register("name")} error={form.formState.errors.name?.message} />
          <Input label="Description" {...form.register("description")} />
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
    </div>
  );
}
