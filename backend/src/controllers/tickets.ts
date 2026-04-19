import { Request, Response } from "express";
import { db } from "../db";
import { supportTickets, ticketMessages, tenants } from "../db/schema";
import { eq, desc, ilike, and, count } from "drizzle-orm";
import { handleControllerError } from "../utils/errors";
import { z } from "zod";

const submitTicketSchema = z.object({
  subject: z.string().min(3, "Subject must be at least 3 characters"),
  body: z.string().min(10, "Message must be at least 10 characters"),
  category: z.enum(["general", "billing", "technical", "feature_request", "bug_report", "account"]).default("general"),
  priority: z.enum(["low", "medium", "high", "urgent"]).default("medium"),
  submitterEmail: z.string().email(),
  submitterName: z.string().optional(),
});

const replySchema = z.object({
  body: z.string().min(1),
  isInternal: z.boolean().optional().default(false),
});

const updateTicketSchema = z.object({
  status: z.enum(["open", "in_progress", "waiting_on_customer", "resolved", "closed"]).optional(),
  priority: z.enum(["low", "medium", "high", "urgent"]).optional(),
  assignedTo: z.string().uuid().nullable().optional(),
});

function generateTicketNumber(): string {
  const now = Date.now().toString(36).toUpperCase();
  const rand = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `TKT-${now}-${rand}`;
}

// ─── Tenant: submit ticket ────────────────────────────────────────────────────
export async function submitTicket(req: Request, res: Response): Promise<void> {
  try {
    const body = submitTicketSchema.parse(req.body);
    const tenantId = req.tenantContext?.tenantId;
    const userId = req.user?.id;

    const ticketNumber = generateTicketNumber();
    const [ticket] = await db
      .insert(supportTickets)
      .values({
        ticketNumber,
        tenantId: tenantId ?? null,
        submittedByUserId: userId ?? null,
        submitterEmail: body.submitterEmail,
        submitterName: body.submitterName ?? null,
        category: body.category,
        priority: body.priority,
        subject: body.subject,
        status: "open",
      })
      .returning();

    // Insert first message
    await db.insert(ticketMessages).values({
      ticketId: ticket.id,
      senderType: "tenant_user",
      senderId: userId ?? null,
      senderEmail: body.submitterEmail,
      senderName: body.submitterName ?? null,
      body: body.body,
      isInternal: false,
    });

    res.status(201).json(ticket);
  } catch (error) {
    handleControllerError(error, res);
  }
}

// ─── Tenant: list own tickets ─────────────────────────────────────────────────
export async function listMyTickets(req: Request, res: Response): Promise<void> {
  try {
    const tenantId = req.tenantContext!.tenantId;
    const rows = await db
      .select()
      .from(supportTickets)
      .where(eq(supportTickets.tenantId, tenantId))
      .orderBy(desc(supportTickets.createdAt))
      .limit(50);
    res.json(rows);
  } catch (error) {
    handleControllerError(error, res);
  }
}

// ─── Tenant: get own ticket detail + messages ─────────────────────────────────
export async function getMyTicket(req: Request, res: Response): Promise<void> {
  try {
    const tenantId = req.tenantContext!.tenantId;
    const ticketId = req.params.ticketId as string;

    const [ticket] = await db
      .select()
      .from(supportTickets)
      .where(and(eq(supportTickets.id, ticketId), eq(supportTickets.tenantId, tenantId)));
    if (!ticket) {
      res.status(404).json({ error: "Ticket not found" });
      return;
    }

    const messages = await db
      .select()
      .from(ticketMessages)
      .where(and(eq(ticketMessages.ticketId, ticketId), eq(ticketMessages.isInternal, false)))
      .orderBy(ticketMessages.createdAt);

    res.json({ ticket, messages });
  } catch (error) {
    handleControllerError(error, res);
  }
}

// ─── Tenant: reply to own ticket ─────────────────────────────────────────────
export async function replyToMyTicket(req: Request, res: Response): Promise<void> {
  try {
    const tenantId = req.tenantContext!.tenantId;
    const ticketId = req.params.ticketId as string;
    const body = replySchema.parse(req.body);

    const [ticket] = await db
      .select()
      .from(supportTickets)
      .where(and(eq(supportTickets.id, ticketId), eq(supportTickets.tenantId, tenantId)));
    if (!ticket) {
      res.status(404).json({ error: "Ticket not found" });
      return;
    }

    const [msg] = await db
      .insert(ticketMessages)
      .values({
        ticketId,
        senderType: "tenant_user",
        senderId: req.user?.id ?? null,
        senderEmail: req.user?.email ?? ticket.submitterEmail,
        body: body.body,
        isInternal: false,
      })
      .returning();

    // Update ticket status if it was waiting on customer
    if (ticket.status === "waiting_on_customer") {
      await db
        .update(supportTickets)
        .set({ status: "in_progress", updatedAt: new Date() })
        .where(eq(supportTickets.id, ticketId));
    }

    res.status(201).json(msg);
  } catch (error) {
    handleControllerError(error, res);
  }
}

// ─── Superadmin: list all tickets ─────────────────────────────────────────────
export async function superadminListTickets(req: Request, res: Response): Promise<void> {
  try {
    const search = typeof req.query.search === "string" ? req.query.search : undefined;
    const status = typeof req.query.status === "string" ? req.query.status : undefined;
    const page = parseInt(typeof req.query.page === "string" ? req.query.page : "1", 10);
    const perPage = Math.min(
      parseInt(typeof req.query.perPage === "string" ? req.query.perPage : "25", 10),
      100,
    );
    const offset = (page - 1) * perPage;

    const conditions: ReturnType<typeof eq>[] = [];
    if (status) conditions.push(eq(supportTickets.status, status as "open"));
    if (search) conditions.push(ilike(supportTickets.subject, `%${search}%`));

    const rows = await db
      .select({
        id: supportTickets.id,
        ticketNumber: supportTickets.ticketNumber,
        tenantId: supportTickets.tenantId,
        submitterEmail: supportTickets.submitterEmail,
        submitterName: supportTickets.submitterName,
        category: supportTickets.category,
        priority: supportTickets.priority,
        subject: supportTickets.subject,
        status: supportTickets.status,
        assignedTo: supportTickets.assignedTo,
        createdAt: supportTickets.createdAt,
        updatedAt: supportTickets.updatedAt,
        tenantName: tenants.name,
      })
      .from(supportTickets)
      .leftJoin(tenants, eq(supportTickets.tenantId, tenants.id))
      .where(conditions.length ? and(...conditions) : undefined)
      .orderBy(desc(supportTickets.createdAt))
      .limit(perPage)
      .offset(offset);

    const [{ total }] = await db
      .select({ total: count() })
      .from(supportTickets)
      .where(conditions.length ? and(...conditions) : undefined);

    res.json({ tickets: rows, total, page, perPage });
  } catch (error) {
    handleControllerError(error, res);
  }
}

// ─── Superadmin: get ticket detail ────────────────────────────────────────────
export async function superadminGetTicket(req: Request, res: Response): Promise<void> {
  try {
    const ticketId = req.params.ticketId as string;
    const showInternal = req.query.showInternal === "true";

    const [ticket] = await db
      .select()
      .from(supportTickets)
      .where(eq(supportTickets.id, ticketId));
    if (!ticket) {
      res.status(404).json({ error: "Ticket not found" });
      return;
    }

    const msgQuery = db
      .select()
      .from(ticketMessages)
      .where(
        showInternal
          ? eq(ticketMessages.ticketId, ticketId)
          : and(eq(ticketMessages.ticketId, ticketId), eq(ticketMessages.isInternal, false)),
      )
      .orderBy(ticketMessages.createdAt);

    const messages = await msgQuery;

    res.json({ ticket, messages });
  } catch (error) {
    handleControllerError(error, res);
  }
}

// ─── Superadmin: update ticket ────────────────────────────────────────────────
export async function superadminUpdateTicket(req: Request, res: Response): Promise<void> {
  try {
    const ticketId = req.params.ticketId as string;
    const body = updateTicketSchema.parse(req.body);

    const updates: Record<string, unknown> = { updatedAt: new Date() };
    if (body.status !== undefined) {
      updates.status = body.status;
      if (body.status === "resolved") updates.resolvedAt = new Date();
      if (body.status === "closed") updates.closedAt = new Date();
    }
    if (body.priority !== undefined) updates.priority = body.priority;
    if (body.assignedTo !== undefined) updates.assignedTo = body.assignedTo;

    const [updated] = await db
      .update(supportTickets)
      .set(updates)
      .where(eq(supportTickets.id, ticketId))
      .returning();

    if (!updated) {
      res.status(404).json({ error: "Ticket not found" });
      return;
    }

    res.json(updated);
  } catch (error) {
    handleControllerError(error, res);
  }
}

// ─── Superadmin: reply to ticket ──────────────────────────────────────────────
export async function superadminReplyToTicket(req: Request, res: Response): Promise<void> {
  try {
    const ticketId = req.params.ticketId as string;
    const body = replySchema.parse(req.body);

    const [ticket] = await db.select().from(supportTickets).where(eq(supportTickets.id, ticketId));
    if (!ticket) {
      res.status(404).json({ error: "Ticket not found" });
      return;
    }

    const [msg] = await db
      .insert(ticketMessages)
      .values({
        ticketId,
        senderType: "superadmin",
        senderId: req.superadmin?.id ?? null,
        senderEmail: req.superadmin?.email ?? null,
        body: body.body,
        isInternal: body.isInternal,
      })
      .returning();

    // If not internal, mark ticket as waiting on customer
    if (!body.isInternal && ticket.status !== "resolved" && ticket.status !== "closed") {
      await db
        .update(supportTickets)
        .set({ status: "waiting_on_customer", updatedAt: new Date() })
        .where(eq(supportTickets.id, ticketId));
    }

    res.status(201).json(msg);
  } catch (error) {
    handleControllerError(error, res);
  }
}
