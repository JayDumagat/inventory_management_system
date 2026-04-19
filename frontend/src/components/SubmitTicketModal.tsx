import { useState } from "react";
import { Modal } from "./ui/Modal";
import { Button } from "./ui/Button";
import { Input } from "./ui/Input";
import { Select } from "./ui/Select";
import { api } from "../api/client";
import { useToast } from "../hooks/useToast";
import type { TicketCategory, TicketPriority } from "../types";

interface SubmitTicketModalProps {
  open: boolean;
  onClose: () => void;
  userEmail: string;
  userName?: string;
  tenantId?: string;
}

export function SubmitTicketModal({
  open,
  onClose,
  userEmail,
  userName,
  tenantId,
}: SubmitTicketModalProps) {
  const toast = useToast();
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [ticketNumber, setTicketNumber] = useState("");
  const [form, setForm] = useState({
    subject: "",
    body: "",
    category: "general" as TicketCategory,
    priority: "medium" as TicketPriority,
    submitterEmail: userEmail,
    submitterName: userName ?? "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.subject.trim() || !form.body.trim()) return;
    setLoading(true);
    try {
      const endpoint = tenantId
        ? `/api/tenants/${tenantId}/tickets`
        : "/api/tickets";
      const { data } = await api.post(endpoint, form);
      setTicketNumber(data.ticketNumber);
      setSubmitted(true);
    } catch {
      toast.error("Failed to submit ticket. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setSubmitted(false);
    setTicketNumber("");
    setForm((f) => ({ ...f, subject: "", body: "", category: "general", priority: "medium" }));
    onClose();
  };

  return (
    <Modal open={open} onClose={handleClose} title="Help & Support" size="md">
      {submitted ? (
        <div className="text-center py-6">
          <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3">
            <svg className="w-6 h-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <p className="text-sm font-semibold text-ink mb-1">Ticket submitted!</p>
          <p className="text-xs text-muted mb-1">
            Your ticket number is <span className="font-mono font-semibold text-ink">{ticketNumber}</span>.
          </p>
          <p className="text-xs text-muted mb-5">We'll get back to you shortly via email.</p>
          <Button onClick={handleClose} size="sm">Close</Button>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <p className="text-xs text-muted">
            Having issues? Submit a support ticket and our team will help you.
          </p>

          <Input
            label="Your email"
            value={form.submitterEmail}
            onChange={(e) => setForm((f) => ({ ...f, submitterEmail: e.target.value }))}
            type="email"
            required
          />

          <div className="grid grid-cols-2 gap-3">
            <Select
              label="Category"
              value={form.category}
              onChange={(e) => setForm((f) => ({ ...f, category: e.target.value as TicketCategory }))}
            >
              <option value="general">General</option>
              <option value="billing">Billing</option>
              <option value="technical">Technical</option>
              <option value="feature_request">Feature Request</option>
              <option value="bug_report">Bug Report</option>
              <option value="account">Account</option>
            </Select>

            <Select
              label="Priority"
              value={form.priority}
              onChange={(e) => setForm((f) => ({ ...f, priority: e.target.value as TicketPriority }))}
            >
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
              <option value="urgent">Urgent</option>
            </Select>
          </div>

          <Input
            label="Subject"
            placeholder="Brief description of your issue"
            value={form.subject}
            onChange={(e) => setForm((f) => ({ ...f, subject: e.target.value }))}
            required
          />

          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-muted">Message</label>
            <textarea
              className="w-full border border-stroke bg-panel text-ink text-sm px-3 py-2 outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500/20 resize-none"
              rows={4}
              placeholder="Describe your issue in detail…"
              value={form.body}
              onChange={(e) => setForm((f) => ({ ...f, body: e.target.value }))}
              required
            />
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="secondary" size="sm" onClick={handleClose}>
              Cancel
            </Button>
            <Button type="submit" size="sm" loading={loading}>
              Submit Ticket
            </Button>
          </div>
        </form>
      )}
    </Modal>
  );
}
