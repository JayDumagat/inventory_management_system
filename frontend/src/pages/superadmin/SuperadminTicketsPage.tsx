import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { superadminApi } from "../../api/superadminClient";
import { Button } from "../../components/ui/Button";
import { Select } from "../../components/ui/Select";
import { Badge } from "../../components/ui/Badge";
import { useToast } from "../../hooks/useToast";
import type { SupportTicket, TicketMessage } from "../../types";
import { Search, Eye, ChevronLeft, SendHorizontal } from "lucide-react";
import { formatDate, relativeTime } from "../../lib/utils";
import { useSuperadminStore } from "../../stores/superadminStore";

const STATUS_COLORS: Record<string, "default" | "success" | "warning" | "danger" | "info"> = {
  open: "danger",
  in_progress: "warning",
  waiting_on_customer: "info",
  resolved: "success",
  closed: "default",
};

const PRIORITY_COLORS: Record<string, string> = {
  low: "text-muted",
  medium: "text-blue-600",
  high: "text-orange-600",
  urgent: "text-red-600",
};

export default function SuperadminTicketsPage() {
  const toast = useToast();
  const qc = useQueryClient();
  const { superadmin } = useSuperadminStore();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [page, setPage] = useState(1);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [replyBody, setReplyBody] = useState("");
  const [isInternal, setIsInternal] = useState(false);

  const { data, isLoading } = useQuery<{ tickets: SupportTicket[]; total: number }>({
    queryKey: ["superadmin-tickets", search, statusFilter, page],
    queryFn: () =>
      superadminApi
        .get("/api/superadmin/tickets", {
          params: { search, status: statusFilter || undefined, page, perPage: 25, showInternal: true },
        })
        .then((r) => r.data),
  });

  const { data: detail } = useQuery<{ ticket: SupportTicket; messages: TicketMessage[] }>({
    queryKey: ["superadmin-ticket-detail", selectedId],
    queryFn: () =>
      superadminApi
        .get(`/api/superadmin/tickets/${selectedId}`, { params: { showInternal: true } })
        .then((r) => r.data),
    enabled: !!selectedId,
    refetchInterval: selectedId ? 10000 : false,
  });

  const updateMut = useMutation({
    mutationFn: (data: { status?: string; assignedTo?: string | null }) =>
      superadminApi.patch(`/api/superadmin/tickets/${selectedId}`, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["superadmin-ticket-detail", selectedId] });
      qc.invalidateQueries({ queryKey: ["superadmin-tickets"] });
      toast.success("Ticket updated");
    },
  });

  const replyMut = useMutation({
    mutationFn: () =>
      superadminApi.post(`/api/superadmin/tickets/${selectedId}/messages`, {
        body: replyBody,
        isInternal,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["superadmin-ticket-detail", selectedId] });
      setReplyBody("");
      setIsInternal(false);
    },
    onError: () => toast.error("Failed to send reply"),
  });

  if (selectedId) {
    const ticket = detail?.ticket;
    const messages = detail?.messages ?? [];

    return (
      <div className="space-y-5 max-w-3xl">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setSelectedId(null)}
            className="p-1.5 text-muted hover:bg-hover transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <div>
            <h1 className="text-base font-bold text-ink">{ticket?.subject}</h1>
            <p className="text-xs text-muted">{ticket?.ticketNumber}</p>
          </div>
        </div>

        {ticket && (
          <div className="flex flex-wrap gap-3 items-center bg-panel border border-stroke px-4 py-3">
            <Badge variant={STATUS_COLORS[ticket.status] ?? "default"}>
              {ticket.status.replace(/_/g, " ")}
            </Badge>
            <span className={`text-xs font-semibold capitalize ${PRIORITY_COLORS[ticket.priority]}`}>
              {ticket.priority} priority
            </span>
            <span className="text-xs text-muted">{ticket.submitterEmail}</span>
            {ticket.tenantName && <span className="text-xs text-muted">{ticket.tenantName}</span>}
            <div className="ml-auto flex gap-2 flex-wrap">
              <Select
                value={ticket.status}
                onChange={(e) => updateMut.mutate({ status: e.target.value })}
                className="text-xs py-1 h-8"
              >
                <option value="open">Open</option>
                <option value="in_progress">In Progress</option>
                <option value="waiting_on_customer">Waiting on Customer</option>
                <option value="resolved">Resolved</option>
                <option value="closed">Closed</option>
              </Select>
              {superadmin && (
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() =>
                    updateMut.mutate({
                      assignedTo: ticket.assignedTo === superadmin.id ? null : superadmin.id,
                    })
                  }
                >
                  {ticket.assignedTo === superadmin.id ? "Unassign" : "Assign to me"}
                </Button>
              )}
            </div>
          </div>
        )}

        <div className="space-y-3">
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`p-4 border ${
                msg.isInternal
                  ? "border-yellow-200 bg-yellow-50"
                  : msg.senderType === "superadmin"
                    ? "border-primary-200 bg-primary-50 ml-6"
                    : "border-stroke bg-panel"
              }`}
            >
              <div className="flex items-center gap-2 mb-1.5">
                <span className="text-xs font-semibold text-ink">
                  {msg.senderName || msg.senderEmail || msg.senderType}
                </span>
                {msg.isInternal && (
                  <span className="text-[10px] bg-yellow-200 text-yellow-800 px-1.5 py-0.5">
                    Internal Note
                  </span>
                )}
                <span className="text-[10px] text-muted ml-auto">{relativeTime(msg.createdAt)}</span>
              </div>
              <p className="text-sm text-ink whitespace-pre-wrap">{msg.body}</p>
            </div>
          ))}
        </div>

        <div className="bg-panel border border-stroke p-4 space-y-3">
          <textarea
            className="w-full border border-stroke bg-page text-ink text-sm px-3 py-2 outline-none focus:border-primary-500 resize-none"
            rows={3}
            placeholder="Write a reply…"
            value={replyBody}
            onChange={(e) => setReplyBody(e.target.value)}
          />
          <div className="flex items-center justify-between">
            <label className="flex items-center gap-2 text-xs text-muted cursor-pointer">
              <input
                type="checkbox"
                checked={isInternal}
                onChange={(e) => setIsInternal(e.target.checked)}
                className="rounded"
              />
              Internal note (not visible to tenant)
            </label>
            <Button
              size="sm"
              loading={replyMut.isPending}
              disabled={!replyBody.trim()}
              onClick={() => replyMut.mutate()}
            >
              <SendHorizontal className="w-3.5 h-3.5" />
              Send
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-lg font-bold text-ink">Support Tickets</h1>
        <p className="text-sm text-muted mt-0.5">Manage customer support requests</p>
      </div>

      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative max-w-xs flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted" />
          <input
            className="w-full pl-9 pr-3 py-2 text-sm bg-panel border border-stroke text-ink outline-none focus:border-primary-500"
            placeholder="Search tickets…"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          />
        </div>
        <Select
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
          className="w-40"
        >
          <option value="">All statuses</option>
          <option value="open">Open</option>
          <option value="in_progress">In Progress</option>
          <option value="waiting_on_customer">Waiting</option>
          <option value="resolved">Resolved</option>
          <option value="closed">Closed</option>
        </Select>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted">Loading…</p>
      ) : (
        <>
          <div className="bg-panel border border-stroke overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-stroke">
                  <th className="px-4 py-3 text-left text-xs font-semibold text-muted">Ticket</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-muted">Category</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-muted">Priority</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-muted">Status</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-muted">Submitted</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {(data?.tickets ?? []).map((t) => (
                  <tr key={t.id} className="border-b border-stroke last:border-0 hover:bg-hover transition-colors">
                    <td className="px-4 py-3">
                      <p className="font-medium text-ink">{t.subject}</p>
                      <p className="text-xs text-muted">
                        {t.ticketNumber} · {t.submitterEmail}
                        {t.tenantName && ` · ${t.tenantName}`}
                      </p>
                    </td>
                    <td className="px-4 py-3 text-xs text-muted capitalize">
                      {t.category.replace(/_/g, " ")}
                    </td>
                    <td className={`px-4 py-3 text-xs font-semibold capitalize ${PRIORITY_COLORS[t.priority]}`}>
                      {t.priority}
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant={STATUS_COLORS[t.status] ?? "default"}>
                        {t.status.replace(/_/g, " ")}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-xs text-muted">{formatDate(t.createdAt)}</td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => setSelectedId(t.id)}
                        className="p-1.5 text-muted hover:text-ink hover:bg-hover transition-colors"
                      >
                        <Eye className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
                {(data?.tickets ?? []).length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-sm text-muted">
                      No tickets found
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {(data?.total ?? 0) > 25 && (
            <div className="flex justify-end gap-2">
              <Button size="sm" variant="secondary" disabled={page === 1} onClick={() => setPage((p) => p - 1)}>
                Previous
              </Button>
              <Button
                size="sm"
                variant="secondary"
                disabled={(page * 25) >= (data?.total ?? 0)}
                onClick={() => setPage((p) => p + 1)}
              >
                Next
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
