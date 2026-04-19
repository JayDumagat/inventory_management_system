import { Router } from "express";
import { requireSuperadmin, requireSuperadminOwner, requireSuperadminPage } from "../middleware/superadmin";
import {
  superadminLogin,
  superadminMe,
  listSuperadminStaff,
  createSuperadminStaff,
  updateSuperadminStaff,
  deleteSuperadminStaff,
} from "../controllers/superadminAuth";
import {
  listAllTenants,
  getTenantDetail,
  setTenantActive,
  overrideTenantSubscription,
  platformReports,
} from "../controllers/superadminTenants";
import {
  superadminListTickets,
  superadminGetTicket,
  superadminUpdateTicket,
  superadminReplyToTicket,
} from "../controllers/tickets";
import { superadminAuditLogs } from "../controllers/superadminAudit";
import { listPlans } from "../controllers/subscription";

const router = Router();

// ─── Auth (public) ────────────────────────────────────────────────────────────
router.post("/auth/login", superadminLogin);

// ─── Me ───────────────────────────────────────────────────────────────────────
router.get("/auth/me", requireSuperadmin, superadminMe);

// ─── Staff management (owner only) ───────────────────────────────────────────
router.get("/staff", requireSuperadminOwner, listSuperadminStaff);
router.post("/staff", requireSuperadminOwner, createSuperadminStaff);
router.patch("/staff/:staffId", requireSuperadminOwner, updateSuperadminStaff);
router.delete("/staff/:staffId", requireSuperadminOwner, deleteSuperadminStaff);

// ─── Tenants ──────────────────────────────────────────────────────────────────
router.get("/tenants", requireSuperadminPage("tenants"), listAllTenants);
router.get("/tenants/:tenantId", requireSuperadminPage("tenants"), getTenantDetail);
router.patch("/tenants/:tenantId/status", requireSuperadminPage("tenants"), setTenantActive);
router.patch(
  "/tenants/:tenantId/subscription",
  requireSuperadminPage("subscriptions"),
  overrideTenantSubscription,
);

// ─── Plans ────────────────────────────────────────────────────────────────────
router.get("/plans", requireSuperadminPage("plans"), listPlans);

// ─── Tickets ──────────────────────────────────────────────────────────────────
router.get("/tickets", requireSuperadminPage("tickets"), superadminListTickets);
router.get("/tickets/:ticketId", requireSuperadminPage("tickets"), superadminGetTicket);
router.patch("/tickets/:ticketId", requireSuperadminPage("tickets"), superadminUpdateTicket);
router.post(
  "/tickets/:ticketId/messages",
  requireSuperadminPage("tickets"),
  superadminReplyToTicket,
);

// ─── Reports ──────────────────────────────────────────────────────────────────
router.get("/reports", requireSuperadminPage("reports"), platformReports);

// ─── Audit logs ───────────────────────────────────────────────────────────────
router.get("/audit-logs", requireSuperadminPage("audit-logs"), superadminAuditLogs);

export default router;
