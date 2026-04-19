import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { superadminApi } from "../../api/superadminClient";
import { Button } from "../../components/ui/Button";
import { Modal } from "../../components/ui/Modal";
import { Input } from "../../components/ui/Input";
import { Badge } from "../../components/ui/Badge";
import { useToast } from "../../hooks/useToast";
import type { SuperadminUser } from "../../types";
import { Plus, Edit2 } from "lucide-react";
import { formatDate } from "../../lib/utils";
import { useSuperadminStore } from "../../stores/superadminStore";

const ALL_PAGES = [
  "dashboard", "tenants", "subscriptions", "plans", "tickets", "reports", "audit-logs",
];

export default function SuperadminStaffPage() {
  const toast = useToast();
  const qc = useQueryClient();
  const { superadmin } = useSuperadminStore();
  const [modalOpen, setModalOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<SuperadminUser | null>(null);
  const [form, setForm] = useState({
    email: "",
    password: "",
    firstName: "",
    lastName: "",
    allowedPages: [] as string[],
  });

  const { data: staff = [], isLoading } = useQuery<SuperadminUser[]>({
    queryKey: ["superadmin-staff"],
    queryFn: () => superadminApi.get("/api/superadmin/staff").then((r) => r.data),
  });

  const createMut = useMutation({
    mutationFn: () => superadminApi.post("/api/superadmin/staff", form),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["superadmin-staff"] });
      toast.success("Staff member created");
      setModalOpen(false);
      resetForm();
    },
    onError: (e: { response?: { data?: { error?: string } } }) =>
      toast.error(e?.response?.data?.error ?? "Failed to create staff"),
  });

  const updateMut = useMutation({
    mutationFn: (data: Partial<typeof form>) =>
      superadminApi.patch(`/api/superadmin/staff/${editTarget!.id}`, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["superadmin-staff"] });
      toast.success("Staff updated");
      setEditTarget(null);
    },
    onError: () => toast.error("Failed to update"),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => superadminApi.delete(`/api/superadmin/staff/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["superadmin-staff"] });
      toast.success("Staff removed");
    },
    onError: () => toast.error("Cannot delete this account"),
  });

  const resetForm = () =>
    setForm({ email: "", password: "", firstName: "", lastName: "", allowedPages: [] });

  const togglePage = (page: string, current: string[], onChange: (v: string[]) => void) => {
    if (current.includes(page)) {
      onChange(current.filter((p) => p !== page));
    } else {
      onChange([...current, page]);
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-bold text-ink">Superadmin Staff</h1>
          <p className="text-sm text-muted mt-0.5">Manage platform admin accounts</p>
        </div>
        <Button size="sm" onClick={() => { resetForm(); setModalOpen(true); }}>
          <Plus className="w-3.5 h-3.5" />
          Add Staff
        </Button>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted">Loading…</p>
      ) : (
        <div className="bg-panel border border-stroke overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-stroke">
                <th className="px-4 py-3 text-left text-xs font-semibold text-muted">Name</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-muted">Role</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-muted">Status</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-muted">Pages</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-muted">Created</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {staff.map((s) => (
                <tr key={s.id} className="border-b border-stroke last:border-0 hover:bg-hover transition-colors">
                  <td className="px-4 py-3">
                    <p className="font-medium text-ink">
                      {[s.firstName, s.lastName].filter(Boolean).join(" ") || "—"}
                    </p>
                    <p className="text-xs text-muted">{s.email}</p>
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant={s.role === "owner" ? "info" : "default"} className="capitalize">
                      {s.role}
                    </Badge>
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant={s.isActive ? "success" : "danger"}>
                      {s.isActive ? "Active" : "Inactive"}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-xs text-muted">
                    {s.role === "owner" ? "All" : (s.allowedPages?.join(", ") || "None")}
                  </td>
                  <td className="px-4 py-3 text-xs text-muted">
                    {s.createdAt ? formatDate(s.createdAt) : "—"}
                  </td>
                  <td className="px-4 py-3">
                    {s.role !== "owner" && s.id !== superadmin?.id && (
                      <div className="flex gap-1">
                        <button
                          onClick={() => {
                            setEditTarget(s);
                            setForm({
                              email: s.email,
                              password: "",
                              firstName: s.firstName,
                              lastName: s.lastName,
                              allowedPages: s.allowedPages ?? [],
                            });
                          }}
                          className="p-1.5 text-muted hover:text-ink hover:bg-hover transition-colors"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => {
                            if (confirm(`Remove ${s.email}?`)) deleteMut.mutate(s.id);
                          }}
                          className="p-1.5 text-red-500 hover:bg-red-50 transition-colors"
                        >
                          ✕
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Create modal */}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Add Staff Member" size="md">
        <form
          onSubmit={(e) => { e.preventDefault(); createMut.mutate(); }}
          className="flex flex-col gap-4"
        >
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="First Name"
              value={form.firstName}
              onChange={(e) => setForm((f) => ({ ...f, firstName: e.target.value }))}
            />
            <Input
              label="Last Name"
              value={form.lastName}
              onChange={(e) => setForm((f) => ({ ...f, lastName: e.target.value }))}
            />
          </div>
          <Input
            label="Email"
            type="email"
            value={form.email}
            onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
            required
          />
          <Input
            label="Password"
            type="password"
            value={form.password}
            onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
            required
            helperText="Minimum 8 characters"
          />

          <div>
            <p className="text-xs font-medium text-muted mb-2">Allowed Pages</p>
            <div className="flex flex-wrap gap-2">
              {ALL_PAGES.map((page) => (
                <label key={page} className="flex items-center gap-1.5 text-xs cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.allowedPages.includes(page)}
                    onChange={() =>
                      togglePage(page, form.allowedPages, (v) =>
                        setForm((f) => ({ ...f, allowedPages: v })),
                      )
                    }
                  />
                  <span className="capitalize">{page.replace(/-/g, " ")}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="secondary" size="sm" onClick={() => setModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" size="sm" loading={createMut.isPending}>
              Create Staff
            </Button>
          </div>
        </form>
      </Modal>

      {/* Edit modal */}
      <Modal
        open={!!editTarget}
        onClose={() => setEditTarget(null)}
        title={`Edit — ${editTarget?.email}`}
        size="md"
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const payload: Partial<typeof form> = {
              firstName: form.firstName,
              lastName: form.lastName,
              allowedPages: form.allowedPages,
            };
            if (form.password) payload.password = form.password;
            updateMut.mutate(payload);
          }}
          className="flex flex-col gap-4"
        >
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="First Name"
              value={form.firstName}
              onChange={(e) => setForm((f) => ({ ...f, firstName: e.target.value }))}
            />
            <Input
              label="Last Name"
              value={form.lastName}
              onChange={(e) => setForm((f) => ({ ...f, lastName: e.target.value }))}
            />
          </div>
          <Input
            label="New Password (leave blank to keep current)"
            type="password"
            value={form.password}
            onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
            helperText="Minimum 8 characters"
          />
          <div>
            <p className="text-xs font-medium text-muted mb-2">Allowed Pages</p>
            <div className="flex flex-wrap gap-2">
              {ALL_PAGES.map((page) => (
                <label key={page} className="flex items-center gap-1.5 text-xs cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.allowedPages.includes(page)}
                    onChange={() =>
                      togglePage(page, form.allowedPages, (v) =>
                        setForm((f) => ({ ...f, allowedPages: v })),
                      )
                    }
                  />
                  <span className="capitalize">{page.replace(/-/g, " ")}</span>
                </label>
              ))}
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="secondary" size="sm" onClick={() => setEditTarget(null)}>
              Cancel
            </Button>
            <Button type="submit" size="sm" loading={updateMut.isPending}>
              Save Changes
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
