import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useSearchParams } from "react-router-dom";
import { api } from "../../api/client";
import { useTenantStore } from "../../stores/tenantStore";
import { useBranchStore } from "../../stores/branchStore";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { Card, CardContent } from "../../components/ui/Card";
import { Modal } from "../../components/ui/Modal";
import { PageLoader } from "../../components/ui/Spinner";
import { Plus, Pencil, Trash2, GitBranch } from "lucide-react";
import { cn } from "../../lib/utils";

interface Branch {
  id: string;
  name: string;
  address?: string;
  city?: string;
  country?: string;
  phone?: string;
  isDefault: boolean;
}

const schema = z.object({
  name: z.string().min(1, "Name is required"),
  address: z.string().optional(),
  city: z.string().optional(),
  country: z.string().optional(),
  phone: z.string().optional(),
  isDefault: z.boolean().optional(),
});
type FormData = z.infer<typeof schema>;

export default function BranchesPage() {
  const { currentTenant } = useTenantStore();
  const { currentBranch, setCurrentBranch } = useBranchStore();
  const qc = useQueryClient();
  const tid = currentTenant?.id;
  const [searchParams, setSearchParams] = useSearchParams();
  const [modal, setModal] = useState<{ open: boolean; branch?: Branch }>({ open: false });

  const { data: branches = [], isLoading } = useQuery<Branch[]>({
    queryKey: ["branches", tid],
    queryFn: () => api.get(`/api/tenants/${tid}/branches`).then((r) => r.data),
    enabled: !!tid,
  });

  // Auto-open create modal when navigated with ?create=true
  useEffect(() => {
    if (searchParams.get("create") === "true") {
      form.reset({ isDefault: false });
      setModal({ open: true });
      setSearchParams({}, { replace: true });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const form = useForm<FormData>({ resolver: zodResolver(schema) });

  const save = useMutation({
    mutationFn: (data: FormData) =>
      modal.branch
        ? api.patch(`/api/tenants/${tid}/branches/${modal.branch.id}`, data).then((r) => r.data)
        : api.post(`/api/tenants/${tid}/branches`, data).then((r) => r.data),
    onSuccess: (saved: Branch) => {
      qc.invalidateQueries({ queryKey: ["branches", tid] });
      // If the updated branch is the currently selected one, refresh it
      if (currentBranch && modal.branch && currentBranch.id === modal.branch.id) {
        setCurrentBranch(saved);
      }
      setModal({ open: false });
      form.reset();
    },
  });

  const remove = useMutation({
    mutationFn: (id: string) => api.delete(`/api/tenants/${tid}/branches/${id}`),
    onSuccess: (_data, id) => {
      qc.invalidateQueries({ queryKey: ["branches", tid] });
      // If deleted branch was active, clear selection
      if (currentBranch?.id === id) {
        setCurrentBranch(null);
      }
    },
  });

  const openModal = (branch?: Branch) => {
    form.reset(
      branch
        ? {
            name: branch.name,
            address: branch.address ?? "",
            city: branch.city ?? "",
            country: branch.country ?? "",
            phone: branch.phone ?? "",
            isDefault: branch.isDefault,
          }
        : { isDefault: false }
    );
    setModal({ open: true, branch });
  };

  const handleDelete = (branch: Branch) => {
    if (confirm(`Delete branch "${branch.name}"? This action cannot be undone.`)) {
      remove.mutate(branch.id);
    }
  };

  if (isLoading) return <PageLoader />;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-ink">Branches</h1>
          <p className="text-muted text-sm mt-1">
            {branches.length} {branches.length === 1 ? "branch" : "branches"}
          </p>
        </div>
        <Button onClick={() => openModal()} className="gap-2">
          <Plus className="w-4 h-4" /> Add branch
        </Button>
      </div>

      {branches.length === 0 ? (
        <Card>
          <CardContent className="p-0">
            <div className="flex flex-col items-center justify-center py-20 px-6 text-center">
              <div className="w-14 h-14 bg-primary-50 border border-primary-200 flex items-center justify-center mb-5">
                <GitBranch className="w-7 h-7 text-primary-500" />
              </div>
              <h3 className="text-base font-semibold text-ink mb-1">No branches yet</h3>
              <p className="text-sm text-muted max-w-xs mb-6">Add branches to organize your inventory by location</p>
              <Button onClick={() => openModal()}>Add your first branch</Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-stroke text-left">
                  <th className="px-6 py-3 text-xs font-semibold text-muted uppercase tracking-wider">Name</th>
                  <th className="px-6 py-3 text-xs font-semibold text-muted uppercase tracking-wider">Address</th>
                  <th className="px-6 py-3 text-xs font-semibold text-muted uppercase tracking-wider">City</th>
                  <th className="px-6 py-3 text-xs font-semibold text-muted uppercase tracking-wider">Country</th>
                  <th className="px-6 py-3 text-xs font-semibold text-muted uppercase tracking-wider">Phone</th>
                  <th className="px-6 py-3 text-xs font-semibold text-muted uppercase tracking-wider">Default</th>
                  <th className="px-6 py-3" />
                </tr>
              </thead>
              <tbody>
                {branches.map((b) => (
                  <tr
                    key={b.id}
                    className={cn(
                      "border-b border-stroke hover:bg-hover transition-colors",
                      currentBranch?.id === b.id && "bg-primary-50"
                    )}
                  >
                    <td className="px-6 py-3 font-medium text-ink">
                      <div className="flex items-center gap-2">
                        {b.name}
                        {currentBranch?.id === b.id && (
                          <span className="text-[10px] bg-primary-100 text-primary-700 px-1.5 py-0.5 font-medium">
                            active
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-3 text-muted">{b.address || "—"}</td>
                    <td className="px-6 py-3 text-muted">{b.city || "—"}</td>
                    <td className="px-6 py-3 text-muted">{b.country || "—"}</td>
                    <td className="px-6 py-3 text-muted">{b.phone || "—"}</td>
                    <td className="px-6 py-3">
                      {b.isDefault ? (
                        <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 font-medium">
                          Default
                        </span>
                      ) : (
                        <span className="text-muted">—</span>
                      )}
                    </td>
                    <td className="px-6 py-3">
                      <div className="flex items-center gap-1 justify-end">
                        <Button variant="ghost" size="sm" onClick={() => openModal(b)}>
                          <Pencil className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDelete(b)}
                          disabled={remove.isPending}
                        >
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

      <Modal
        open={modal.open}
        onClose={() => setModal({ open: false })}
        title={modal.branch ? "Edit branch" : "Add branch"}
      >
        <form onSubmit={form.handleSubmit((d) => save.mutate(d))} className="flex flex-col gap-4">
          <Input
            label="Name"
            {...form.register("name")}
            error={form.formState.errors.name?.message}
          />
          <Input label="Address" {...form.register("address")} />
          <div className="grid grid-cols-2 gap-3">
            <Input label="City" {...form.register("city")} />
            <Input label="Country" {...form.register("country")} />
          </div>
          <Input label="Phone" {...form.register("phone")} />
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              className="w-4 h-4 border-stroke text-primary-600 focus:ring-primary-500"
              {...form.register("isDefault")}
            />
            <span className="text-sm font-medium text-ink">Set as default branch</span>
          </label>
          <div className="flex gap-3 justify-end pt-2">
            <Button type="button" variant="outline" onClick={() => setModal({ open: false })}>
              Cancel
            </Button>
            <Button type="submit" loading={save.isPending}>
              Save
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
