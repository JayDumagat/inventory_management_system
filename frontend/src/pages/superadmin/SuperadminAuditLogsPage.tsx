import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { superadminApi } from "../../api/superadminClient";
import type { AuditLog } from "../../types";
import { Input } from "../../components/ui/Input";
import { Button } from "../../components/ui/Button";
import { relativeTime } from "../../lib/utils";
import { Search } from "lucide-react";

interface AuditRow extends AuditLog {
  tenantName?: string;
}

export default function SuperadminAuditLogsPage() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [resourceType, setResourceType] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const { data, isLoading } = useQuery<{ logs: AuditRow[]; page: number; perPage: number }>({
    queryKey: ["superadmin-audit", page, search, resourceType, from, to],
    queryFn: () =>
      superadminApi
        .get("/api/superadmin/audit-logs", {
          params: {
            page,
            perPage: 50,
            search: search || undefined,
            resourceType: resourceType || undefined,
            from: from || undefined,
            to: to || undefined,
          },
        })
        .then((r) => r.data),
  });

  const ACTION_COLORS: Record<string, string> = {
    create: "bg-green-100 text-green-700",
    update: "bg-blue-100 text-blue-700",
    delete: "bg-red-100 text-red-700",
    login: "bg-purple-100 text-purple-700",
    logout: "bg-gray-100 text-gray-600",
    other: "bg-yellow-100 text-yellow-700",
  };

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-lg font-bold text-ink">Audit Logs</h1>
        <p className="text-sm text-muted mt-0.5">Platform-wide activity history</p>
      </div>

      <div className="flex flex-wrap gap-3 items-end">
        <div className="relative flex-1 min-w-[180px] max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted" />
          <input
            className="w-full pl-9 pr-3 py-2 text-sm bg-panel border border-stroke text-ink outline-none focus:border-primary-500"
            placeholder="Resource type…"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          />
        </div>
        <div className="min-w-[140px]">
          <Input
            label="From"
            type="date"
            value={from}
            onChange={(e) => { setFrom(e.target.value); setPage(1); }}
          />
        </div>
        <div className="min-w-[140px]">
          <Input
            label="To"
            type="date"
            value={to}
            onChange={(e) => { setTo(e.target.value); setPage(1); }}
          />
        </div>
        {(search || resourceType || from || to) && (
          <Button
            size="sm"
            variant="secondary"
            onClick={() => { setSearch(""); setResourceType(""); setFrom(""); setTo(""); setPage(1); }}
          >
            Clear
          </Button>
        )}
      </div>

      {isLoading ? (
        <p className="text-sm text-muted">Loading…</p>
      ) : (
        <>
          <div className="bg-panel border border-stroke overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-stroke">
                  <th className="px-4 py-3 text-left text-xs font-semibold text-muted">Action</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-muted">Resource</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-muted">Actor</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-muted">Tenant</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-muted">Time</th>
                </tr>
              </thead>
              <tbody>
                {(data?.logs ?? []).map((log) => (
                  <tr key={log.id} className="border-b border-stroke last:border-0 hover:bg-hover transition-colors">
                    <td className="px-4 py-3">
                      <span
                        className={`text-xs font-semibold px-2 py-0.5 ${ACTION_COLORS[log.action] ?? "bg-gray-100 text-gray-600"}`}
                      >
                        {log.action}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs">
                      <span className="font-medium text-ink">{log.resourceType}</span>
                      {log.resourceId && (
                        <span className="text-muted ml-1 font-mono">{log.resourceId.slice(0, 8)}…</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs text-muted">
                      {log.actorEmail ??
                        [log.actorFirstName, log.actorLastName].filter(Boolean).join(" ") ??
                        log.userId ??
                        "—"}
                    </td>
                    <td className="px-4 py-3 text-xs text-muted">
                      {(log as AuditRow).tenantName ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-xs text-muted">{relativeTime(log.createdAt)}</td>
                  </tr>
                ))}
                {(data?.logs ?? []).length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-sm text-muted">
                      No logs found
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="flex justify-end gap-2">
            <Button size="sm" variant="secondary" disabled={page === 1} onClick={() => setPage((p) => p - 1)}>
              Previous
            </Button>
            <Button
              size="sm"
              variant="secondary"
              disabled={(data?.logs ?? []).length < 50}
              onClick={() => setPage((p) => p + 1)}
            >
              Next
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
