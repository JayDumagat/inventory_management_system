import { Router } from "express";
import { authenticate, requireTenant } from "../middleware/auth";
import {
  submitTicket,
  listMyTickets,
  getMyTicket,
  replyToMyTicket,
} from "../controllers/tickets";

const router = Router({ mergeParams: true });

// Tenant users can submit and manage their own tickets
router.post("/", authenticate, requireTenant(), submitTicket);
router.get("/", authenticate, requireTenant(), listMyTickets);
router.get("/:ticketId", authenticate, requireTenant(), getMyTicket);
router.post("/:ticketId/messages", authenticate, requireTenant(), replyToMyTicket);

export default router;
