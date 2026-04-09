import { useQuery } from "@tanstack/react-query";
import { api } from "../../api/client";
import { useTenantStore } from "../../stores/tenantStore";
import { Card, CardContent } from "../../components/ui/Card";
import { Badge } from "../../components/ui/Badge";
import { PageLoader } from "../../components/ui/Spinner";
import { formatDateTime } from "../../lib/utils";

interface AuditLog {
  id: string; action: string; resourceType: string; resourceId?: string;
  userId?: string; ipAddress?: string; createdAt: string;
  oldValues?: Record<string, unknown>; newValues?: Record<string, unknown>;
}

const actionColor: Record<string, "success" | "warning" | "danger" | "info" | "default"> = {
  create: "success", update: "info", delete: "danger", login: "default", logout: "default", other: "warning",
};

export default function AuditPage() {
  const { currentTenant } = useTenantStore();
  const tid = currentTenant?.id;

  const { data, isLoading } = useQuery<{ data: AuditLog[]; page: number }>({
    queryKey: ["audit", tid],
    queryFn: () => api.get(`/api/tenants/${tid}/audit-logs`).then((r) => r.data),
    enabled: !!tid,
  });

  if (isLoading) return <PageLoader />;

  const logs = data?.data ?? [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Audit Log</h1>
        <p className="text-gray-500 text-sm mt-1">Track all activity in your organization</p>
      </div>

      <Card>
        {logs.length === 0 ? (
          <CardContent className="py-16 text-center">
            <p className="text-gray-400">No audit log entries yet.</p>
          </CardContent>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 text-left">
                  <th className="px-6 py-3 font-medium text-gray-500">Action</th>
                  <th className="px-6 py-3 font-medium text-gray-500">Resource</th>
                  <th className="px-6 py-3 font-medium text-gray-500">Resource ID</th>
                  <th className="px-6 py-3 font-medium text-gray-500">IP Address</th>
                  <th className="px-6 py-3 font-medium text-gray-500">Date</th>
                  <th className="px-6 py-3 font-medium text-gray-500">Changes</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => (
                  <tr key={log.id} className="border-b border-gray-50 hover:bg-gray-50">
                    <td className="px-6 py-3">
                      <Badge variant={actionColor[log.action] || "default"}>{log.action}</Badge>
                    </td>
                    <td className="px-6 py-3 text-gray-700 font-medium">{log.resourceType}</td>
                    <td className="px-6 py-3 font-mono text-xs text-gray-400">{log.resourceId ? log.resourceId.slice(0, 12) + "…" : "—"}</td>
                    <td className="px-6 py-3 text-gray-500">{log.ipAddress || "—"}</td>
                    <td className="px-6 py-3 text-gray-500 whitespace-nowrap">{formatDateTime(log.createdAt)}</td>
                    <td className="px-6 py-3 text-xs text-gray-400 max-w-xs truncate">
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
