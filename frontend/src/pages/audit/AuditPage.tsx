import { useQuery } from "@tanstack/react-query";
import { api } from "../../api/client";
import { useTenantStore } from "../../stores/tenantStore";
import { Card, CardContent } from "../../components/ui/Card";
import { Badge } from "../../components/ui/Badge";
import { Skeleton, SkeletonTable } from "../../components/ui/Skeleton";
import { formatDateTime } from "../../lib/utils";
import { ClipboardList } from "lucide-react";

interface AuditLog {
  id: string; action: string; resourceType: string; resourceId?: string;
  userId?: string; ipAddress?: string; createdAt: string;
  oldValues?: Record<string, unknown>; newValues?: Record<string, unknown>;
  actorEmail?: string; actorFirstName?: string; actorLastName?: string;
}

const actionColor: Record<string, "success" | "warning" | "danger" | "info" | "default"> = {
  create: "success", update: "info", delete: "danger", login: "default", logout: "default", other: "warning",
};

function actorName(log: AuditLog): string {
  if (log.actorFirstName || log.actorLastName) {
    return [log.actorFirstName, log.actorLastName].filter(Boolean).join(" ");
  }
  if (log.actorEmail) return log.actorEmail;
  return "System";
}

export default function AuditPage() {
  const { currentTenant } = useTenantStore();
  const tid = currentTenant?.id;

  const { data, isLoading } = useQuery<{ data: AuditLog[]; page: number }>({
    queryKey: ["audit", tid],
    queryFn: () => api.get(`/api/tenants/${tid}/audit-logs`).then((r) => r.data),
    enabled: !!tid,
  });

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

  const logs = data?.data ?? [];

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-ink">Audit Log</h1>
        <p className="text-muted text-sm mt-1">Track all activity in your organization</p>
      </div>

      <Card>
        {logs.length === 0 ? (
          <CardContent className="p-0">
            <div className="flex flex-col items-center justify-center py-20 px-6 text-center">
              <div className="w-14 h-14 bg-primary-50 border border-primary-200 flex items-center justify-center mb-5">
                <ClipboardList className="w-7 h-7 text-primary-500" />
              </div>
              <h3 className="text-base font-semibold text-ink mb-1">No audit logs yet</h3>
              <p className="text-sm text-muted max-w-xs">All system activity will be recorded and shown here</p>
            </div>
          </CardContent>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-stroke text-left">
                  <th className="px-6 py-3 text-xs font-semibold text-muted uppercase tracking-wider">Action</th>
                  <th className="px-6 py-3 text-xs font-semibold text-muted uppercase tracking-wider">Actor</th>
                  <th className="px-6 py-3 text-xs font-semibold text-muted uppercase tracking-wider">Resource</th>
                  <th className="px-6 py-3 text-xs font-semibold text-muted uppercase tracking-wider">Resource ID</th>
                  <th className="px-6 py-3 text-xs font-semibold text-muted uppercase tracking-wider">IP Address</th>
                  <th className="px-6 py-3 text-xs font-semibold text-muted uppercase tracking-wider">Date</th>
                  <th className="px-6 py-3 text-xs font-semibold text-muted uppercase tracking-wider">Changes</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => (
                  <tr key={log.id} className="border-b border-stroke hover:bg-hover transition-colors">
                    <td className="px-6 py-3">
                      <Badge variant={actionColor[log.action] || "default"}>{log.action}</Badge>
                    </td>
                    <td className="px-6 py-3">
                      <div className="font-medium text-ink">{actorName(log)}</div>
                      {log.actorEmail && (log.actorFirstName || log.actorLastName) && (
                        <div className="text-xs text-muted">{log.actorEmail}</div>
                      )}
                    </td>
                    <td className="px-6 py-3 text-ink font-medium">{log.resourceType}</td>
                    <td className="px-6 py-3 font-mono text-xs text-muted">{log.resourceId ? log.resourceId.slice(0, 12) + "…" : "—"}</td>
                    <td className="px-6 py-3 text-muted">{log.ipAddress || "—"}</td>
                    <td className="px-6 py-3 text-muted whitespace-nowrap">{formatDateTime(log.createdAt)}</td>
                    <td className="px-6 py-3 text-xs text-muted max-w-xs truncate">
                      {log.newValues ? JSON.stringify(log.newValues).slice(0, 60) + "…" : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
