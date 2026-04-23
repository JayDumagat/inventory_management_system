import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { api } from "../../api/client";
import { useTenantStore } from "../../stores/tenantStore";
import { useAuthStore } from "../../stores/authStore";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { Select } from "../../components/ui/Select";
import { Card, CardContent } from "../../components/ui/Card";
import { Modal } from "../../components/ui/Modal";
import { Badge } from "../../components/ui/Badge";
import { Skeleton, SkeletonTable } from "../../components/ui/Skeleton";
import { Plus, Pencil, Trash2, Users, GitBranch, X, Shield } from "lucide-react";
import { cn } from "../../lib/utils";
import { useToast } from "../../hooks/useToast";

interface StaffMember {
  tenantUserId: string;
  userId: string;
  role: string;
  isActive: boolean;
  email: string;
  firstName: string;
  lastName: string;
  createdAt: string;
  allowedPages: string[];
  branches: { id: string; name: string }[];
}

interface Branch {
  id: string;
  name: string;
  isDefault: boolean;
}

// All navigable pages that staff can be restricted to
const ALL_PAGES = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/pos", label: "POS" },
  { href: "/products", label: "Products" },
  { href: "/categories", label: "Categories" },
  { href: "/customers", label: "Customers" },
  { href: "/inventory", label: "Inventory" },
  { href: "/units", label: "Units" },
  { href: "/orders", label: "Sales Orders" },
  { href: "/invoices", label: "Invoices" },
  { href: "/suppliers", label: "Suppliers" },
  { href: "/purchase-orders", label: "Purchase Orders" },
  { href: "/transactions", label: "Transactions" },
  { href: "/branches", label: "Branches" },
  { href: "/reports", label: "Reports" },
  { href: "/analytics", label: "Analytics" },
  { href: "/audit", label: "Audit Log" },
];

const inviteSchema = z.object({
  email: z.string().email("Invalid email"),
  role: z.enum(["staff", "manager", "admin"]),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  password: z.string().min(8, "Password must be at least 8 characters").optional().or(z.literal("")),
});

type InviteForm = z.infer<typeof inviteSchema>;

const ROLE_COLORS: Record<string, "default" | "info" | "warning" | "success" | "danger"> = {
  owner: "danger",
  admin: "warning",
  manager: "info",
  staff: "default",
};

export default function StaffPage() {
  const { currentTenant } = useTenantStore();
  const { user: currentUser } = useAuthStore();
  const qc = useQueryClient();
  const tid = currentTenant?.id;
  const myRole = currentTenant?.role || "staff";

  const [inviteOpen, setInviteOpen] = useState(false);
  const [editMember, setEditMember] = useState<StaffMember | null>(null);
  const [branchMember, setBranchMember] = useState<StaffMember | null>(null);
  const [editRole, setEditRole] = useState("staff");
  const [editActive, setEditActive] = useState(true);
  const [savingEdit, setSavingEdit] = useState(false);
  const [editError, setEditError] = useState("");
  const [permissionsMember, setPermissionsMember] = useState<StaffMember | null>(null);
  const [selectedPages, setSelectedPages] = useState<string[]>([]);
  const [inviteLink, setInviteLink] = useState<string | null>(null);
  const [inviteLinkOpen, setInviteLinkOpen] = useState(false);

  const { data: staff = [], isLoading } = useQuery<StaffMember[]>({
    queryKey: ["staff", tid],
    queryFn: () => api.get(`/api/tenants/${tid}/staff`).then((r) => r.data),
    enabled: !!tid,
  });

  const { data: branches = [] } = useQuery<Branch[]>({
    queryKey: ["branches", tid],
    queryFn: () => api.get(`/api/tenants/${tid}/branches`).then((r) => r.data),
    enabled: !!tid,
  });

  const inviteForm = useForm<InviteForm>({
    resolver: zodResolver(inviteSchema),
    defaultValues: { role: "staff" },
  });

  const invite = useMutation({
    mutationFn: (data: InviteForm) =>
      api.post(`/api/tenants/${tid}/staff`, data).then((r) => r.data),
    onSuccess: (data: { inviteToken?: string }) => {
      qc.invalidateQueries({ queryKey: ["staff", tid] });
      setInviteOpen(false);
      inviteForm.reset({ role: "staff", password: "" });
      if (data.inviteToken) {
        setInviteLink(`${window.location.origin}/accept-invite?token=${data.inviteToken}`);
        setInviteLinkOpen(true);
      } else {
        toast.success("Staff member invited");
      }
    },
    onError: () => toast.error("Failed to invite staff member"),
  });

  const remove = useMutation({
    mutationFn: (staffId: string) => api.delete(`/api/tenants/${tid}/staff/${staffId}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["staff", tid] }); toast.success("Staff member removed"); },
    onError: () => toast.error("Failed to remove staff member"),
  });

  const assignBranch = useMutation({
    mutationFn: ({ staffId, branchId }: { staffId: string; branchId: string }) =>
      api.post(`/api/tenants/${tid}/staff/${staffId}/branches`, { branchId }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["staff", tid] }); toast.success("Branch assigned"); },
    onError: () => toast.error("Failed to assign branch"),
  });

  const unassignBranch = useMutation({
    mutationFn: ({ staffId, branchId }: { staffId: string; branchId: string }) =>
      api.delete(`/api/tenants/${tid}/staff/${staffId}/branches/${branchId}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["staff", tid] }); toast.success("Branch unassigned"); },
    onError: () => toast.error("Failed to unassign branch"),
  });

  const updatePagesMutation = useMutation({
    mutationFn: ({ staffId, allowedPages }: { staffId: string; allowedPages: string[] }) =>
      api.patch(`/api/tenants/${tid}/staff/${staffId}`, { allowedPages }).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["staff", tid] });
      setPermissionsMember(null);
      toast.success("Permissions updated");
    },
    onError: () => toast.error("Failed to update permissions"),
  });

  const openPermissions = (member: StaffMember) => {
    setPermissionsMember(member);
    setSelectedPages(member.allowedPages ?? []);
  };

  const togglePage = (href: string) => {
    setSelectedPages((prev) =>
      prev.includes(href) ? prev.filter((p) => p !== href) : [...prev, href]
    );
  };

  const canManage = ["owner", "admin"].includes(myRole);
  const canInvite = ["owner", "admin", "manager"].includes(myRole);
  const toast = useToast();

  const handleCloseInviteLink = () => {
    setInviteLinkOpen(false);
    setInviteLink(null);
  };

  const openEdit = (member: StaffMember) => {
    setEditMember(member);
    setEditRole(member.role);
    setEditActive(member.isActive);
    setEditError("");
  };

  const handleSaveEdit = async () => {
    if (!editMember) return;
    setSavingEdit(true);
    setEditError("");
    try {
      await api.patch(`/api/tenants/${tid}/staff/${editMember.tenantUserId}`, {
        role: editRole,
        isActive: editActive,
      });
      qc.invalidateQueries({ queryKey: ["staff", tid] });
      setEditMember(null);
    } catch (e: unknown) {
      setEditError((e as { response?: { data?: { error?: string } } })?.response?.data?.error || "Save failed");
    } finally {
      setSavingEdit(false);
    }
  };

  const handleDelete = (member: StaffMember) => {
    if (confirm(`Remove ${member.firstName || member.email} from this organization?`)) {
      remove.mutate(member.tenantUserId);
    }
  };

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

  const assignedBranchIds = new Set(branchMember?.branches.map((b) => b.id) || []);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-ink">Staff</h1>
          <p className="text-muted text-sm mt-1">
            {staff.length} {staff.length === 1 ? "member" : "members"}
          </p>
        </div>
        {canInvite && (
          <Button onClick={() => setInviteOpen(true)} className="gap-2">
            <Plus className="w-4 h-4" /> Invite staff
          </Button>
        )}
      </div>

      {staff.length === 0 ? (
        <Card>
          <CardContent className="p-0">
            <div className="flex flex-col items-center justify-center py-20 px-6 text-center">
              <div className="w-14 h-14 bg-primary-50 border border-primary-200 flex items-center justify-center mb-5">
                <Users className="w-7 h-7 text-primary-500" />
              </div>
              <h3 className="text-base font-semibold text-ink mb-1">No staff yet</h3>
              <p className="text-sm text-muted max-w-xs mb-6">Invite staff members to give them access to this organization</p>
              {canInvite && <Button onClick={() => setInviteOpen(true)}>Invite your first staff member</Button>}
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
                  <th className="px-6 py-3 text-xs font-semibold text-muted uppercase tracking-wider">Email</th>
                  <th className="px-6 py-3 text-xs font-semibold text-muted uppercase tracking-wider">Role</th>
                  <th className="px-6 py-3 text-xs font-semibold text-muted uppercase tracking-wider">Status</th>
                  <th className="px-6 py-3 text-xs font-semibold text-muted uppercase tracking-wider">Branches</th>
                  <th className="px-6 py-3" />
                </tr>
              </thead>
              <tbody>
                {staff.map((m) => {
                  const isMe = m.userId === currentUser?.id;
                  const fullName = [m.firstName, m.lastName].filter(Boolean).join(" ") || "—";
                  return (
                    <tr key={m.tenantUserId} className={cn("border-b border-stroke hover:bg-hover transition-colors", isMe && "bg-primary-50")}>
                      <td className="px-6 py-3 font-medium text-ink">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 bg-primary-100 flex items-center justify-center text-primary-700 font-bold text-xs flex-shrink-0">
                            {(m.firstName?.[0] || m.email[0]).toUpperCase()}
                          </div>
                          {fullName}
                          {isMe && <span className="text-[10px] bg-primary-100 text-primary-700 px-1.5 py-0.5 font-medium">you</span>}
                        </div>
                      </td>
                      <td className="px-6 py-3 text-muted">{m.email}</td>
                      <td className="px-6 py-3">
                        <Badge variant={ROLE_COLORS[m.role] || "default"}>{m.role}</Badge>
                      </td>
                      <td className="px-6 py-3">
                        {m.isActive ? (
                          <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 font-medium">Active</span>
                        ) : (
                          <span className="text-xs bg-stroke text-muted px-2 py-0.5">Inactive</span>
                        )}
                      </td>
                      <td className="px-6 py-3">
                        <div className="flex items-center gap-1 flex-wrap">
                          {m.branches.length === 0 ? (
                            <span className="text-muted text-xs">All branches</span>
                          ) : (
                            m.branches.map((b) => (
                              <span key={b.id} className="text-[10px] bg-stroke text-muted px-1.5 py-0.5">{b.name}</span>
                            ))
                          )}
                          {canManage && m.role !== "owner" && (
                            <button
                              onClick={() => setBranchMember(m)}
                              className="text-[10px] text-primary-600 hover:underline ml-1"
                            >
                              <GitBranch className="w-3 h-3" />
                            </button>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-3">
                        {canManage && m.role !== "owner" && !isMe && (
                          <div className="flex items-center gap-1 justify-end">
                            {m.role === "staff" && (
                              <Button
                                variant="ghost" size="sm"
                                title="Manage page permissions"
                                onClick={() => openPermissions(m)}
                              >
                                <Shield className="w-4 h-4 text-blue-500" />
                              </Button>
                            )}
                            <Button variant="ghost" size="sm" onClick={() => openEdit(m)}>
                              <Pencil className="w-4 h-4" />
                            </Button>
                            <Button variant="ghost" size="sm" onClick={() => handleDelete(m)} disabled={remove.isPending}>
                              <Trash2 className="w-4 h-4 text-red-400" />
                            </Button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Invite modal */}
      <Modal open={inviteOpen} onClose={() => { setInviteOpen(false); inviteForm.reset({ role: "staff", password: "" }); }} title="Invite staff member">
        <form onSubmit={inviteForm.handleSubmit((d) => invite.mutate(d))} className="flex flex-col gap-4">
          {invite.isError && (
            <div className="p-3 bg-red-50 border border-red-200 text-sm text-red-700">
              {(invite.error as { response?: { data?: { error?: string } } })?.response?.data?.error || "Invite failed"}
            </div>
          )}
          <Input
            label="Email address"
            type="email"
            {...inviteForm.register("email")}
            error={inviteForm.formState.errors.email?.message}
          />
          <div className="grid grid-cols-2 gap-3">
            <Input label="First name (optional)" {...inviteForm.register("firstName")} />
            <Input label="Last name (optional)" {...inviteForm.register("lastName")} />
          </div>
          <Select label="Role" {...inviteForm.register("role")}>
            <option value="staff">Staff</option>
            <option value="manager">Manager</option>
            {myRole === "owner" && <option value="admin">Admin</option>}
          </Select>
          <Input
            label="Initial password (optional)"
            type="password"
            placeholder="Leave blank to send invite link"
            {...inviteForm.register("password")}
            error={inviteForm.formState.errors.password?.message}
          />
          <div className="flex gap-3 justify-end pt-2">
            <Button type="button" variant="outline" onClick={() => { setInviteOpen(false); inviteForm.reset({ role: "staff", password: "" }); }}>
              Cancel
            </Button>
            <Button type="submit" loading={invite.isPending}>
              Send invite
            </Button>
          </div>
        </form>
      </Modal>

      {/* Edit modal */}
      <Modal open={!!editMember} onClose={() => setEditMember(null)} title="Edit staff member" size="sm">
        <div className="flex flex-col gap-4">
          {editError && (
            <div className="p-3 bg-red-50 border border-red-200 text-sm text-red-700">{editError}</div>
          )}
          <p className="text-sm text-ink font-medium">
            {[editMember?.firstName, editMember?.lastName].filter(Boolean).join(" ") || editMember?.email}
          </p>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-muted">Role</label>
            <select
              value={editRole}
              onChange={(e) => setEditRole(e.target.value)}
              className="w-full border border-stroke px-3 py-2 text-sm bg-panel text-ink outline-none focus:border-primary-500"
            >
              <option value="staff">Staff</option>
              <option value="manager">Manager</option>
              {myRole === "owner" && <option value="admin">Admin</option>}
            </select>
          </div>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={editActive}
              onChange={(e) => setEditActive(e.target.checked)}
              className="w-4 h-4 border-stroke text-primary-600"
            />
            <span className="text-sm text-ink">Active</span>
          </label>
          <div className="flex gap-3 justify-end pt-2">
            <Button type="button" variant="outline" onClick={() => setEditMember(null)}>Cancel</Button>
            <Button onClick={handleSaveEdit} loading={savingEdit}>Save</Button>
          </div>
        </div>
      </Modal>

      {/* Branch assignment modal */}
      <Modal open={!!branchMember} onClose={() => setBranchMember(null)} title="Assign branches" size="sm">
        <div className="flex flex-col gap-3">
          <p className="text-xs text-muted">
            Select which branches <strong className="text-ink">
              {[branchMember?.firstName, branchMember?.lastName].filter(Boolean).join(" ") || branchMember?.email}
            </strong> can access. If none are selected, they can access all branches.
          </p>
          {branches.map((b) => {
            const assigned = assignedBranchIds.has(b.id);
            return (
              <div key={b.id} className="flex items-center justify-between p-2 border border-stroke">
                <span className="text-sm text-ink">{b.name}</span>
                {assigned ? (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => unassignBranch.mutate({ staffId: branchMember!.tenantUserId, branchId: b.id })}
                    disabled={unassignBranch.isPending}
                  >
                    <X className="w-3.5 h-3.5 text-red-400" />
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => assignBranch.mutate({ staffId: branchMember!.tenantUserId, branchId: b.id })}
                    disabled={assignBranch.isPending}
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </Button>
                )}
              </div>
            );
          })}
          <Button variant="outline" className="mt-2" onClick={() => setBranchMember(null)}>Done</Button>
        </div>
      </Modal>

      {/* Page Permissions Modal */}
      <Modal open={!!permissionsMember} onClose={() => setPermissionsMember(null)} title="Page Permissions" size="sm">
        <div className="p-5 space-y-4">
          <p className="text-sm text-muted">
            Select which pages <span className="font-medium text-ink">{permissionsMember?.firstName || permissionsMember?.email}</span> can access.
            Leave all unchecked to allow access to all pages.
          </p>
          <div className="grid grid-cols-2 gap-2 max-h-72 overflow-y-auto pr-1">
            {ALL_PAGES.map((page) => (
              <label key={page.href} className={cn("flex items-center gap-2 p-2 border cursor-pointer transition-colors", selectedPages.includes(page.href) ? "border-primary-400 bg-primary-50" : "border-stroke hover:bg-hover")}>
                <input
                  type="checkbox"
                  checked={selectedPages.includes(page.href)}
                  onChange={() => togglePage(page.href)}
                  className="w-3.5 h-3.5 accent-primary-600"
                />
                <span className="text-sm text-ink">{page.label}</span>
              </label>
            ))}
          </div>
          <div className="flex items-center justify-between pt-2">
            <button
              onClick={() => setSelectedPages([])}
              className="text-xs text-muted hover:text-ink underline"
            >
              Clear all (allow all pages)
            </button>
            <div className="flex gap-2">
              <Button variant="ghost" size="sm" onClick={() => setPermissionsMember(null)}>Cancel</Button>
              <Button
                size="sm"
                onClick={() => updatePagesMutation.mutate({ staffId: permissionsMember!.tenantUserId, allowedPages: selectedPages })}
                disabled={updatePagesMutation.isPending}
              >
                {updatePagesMutation.isPending ? "Saving…" : "Save permissions"}
              </Button>
            </div>
          </div>
        </div>
      </Modal>

      {/* Invite link modal for new (pre-registered) staff members */}
      <Modal open={inviteLinkOpen} onClose={handleCloseInviteLink} title="Staff invited">
        <div className="flex flex-col gap-4">
          <p className="text-sm text-muted">
            Share this invite link with the staff member so they can set their password and join the organization.
          </p>
          <div className="flex items-center gap-2 p-3 bg-page border border-stroke">
            <span className="flex-1 text-xs text-ink break-all font-mono">{inviteLink}</span>
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                if (inviteLink) {
                  navigator.clipboard.writeText(inviteLink)
                    .then(() => toast.success("Copied!"))
                    .catch(() => toast.error("Failed to copy. Please copy the link manually."));
                }
              }}
            >
              Copy
            </Button>
          </div>
          <p className="text-xs text-muted">This link expires in 7 days.</p>
          <Button onClick={handleCloseInviteLink}>Done</Button>
        </div>
      </Modal>
    </div>
  );
}
