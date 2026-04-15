import { Request, Response } from "express";
import { db } from "../db";
import { invoices, invoiceItems, salesOrders } from "../db/schema";
import { eq, and, desc, count } from "drizzle-orm";
import { createAuditLog } from "../services/audit";
import { handleControllerError } from "../utils/errors";
import { invoiceSchema, updateInvoiceSchema } from "../validators/invoice";

export const listInvoices = async (req: Request, res: Response): Promise<void> => {
  try {
    const list = await db.query.invoices.findMany({
      where: eq(invoices.tenantId, req.tenantContext!.tenantId),
      with: { items: true, order: true, branch: true },
      orderBy: [desc(invoices.createdAt)],
    });
    res.json(list);
  } catch {
    res.status(500).json({ error: "Internal server error" });
  }
};

export const getInvoice = async (req: Request, res: Response): Promise<void> => {
  try {
    const invoice = await db.query.invoices.findFirst({
      where: and(
        eq(invoices.id, req.params.invoiceId as string),
        eq(invoices.tenantId, req.tenantContext!.tenantId)
      ),
      with: { items: true, order: { with: { items: true } }, branch: true },
    });
    if (!invoice) { res.status(404).json({ error: "Invoice not found" }); return; }
    res.json(invoice);
  } catch {
    res.status(500).json({ error: "Internal server error" });
  }
};

export const createInvoice = async (req: Request, res: Response): Promise<void> => {
  try {
    const body = invoiceSchema.parse(req.body);
    const tenantId = req.tenantContext!.tenantId;

    const [{ total }] = await db.select({ total: count() }).from(invoices).where(eq(invoices.tenantId, tenantId));
    const invoiceNumber = `INV-${String(Number(total) + 1).padStart(5, "0")}`;

    const subtotal = body.items.reduce((sum, i) => sum + i.totalPrice, 0);
    const totalAmount = subtotal + (body.taxAmount ?? 0) - (body.discountAmount ?? 0);

    const [invoice] = await db.insert(invoices).values({
      tenantId,
      orderId: body.orderId || null,
      branchId: body.branchId || null,
      invoiceNumber,
      customerName: body.customerName || null,
      customerEmail: body.customerEmail || null,
      customerPhone: body.customerPhone || null,
      customerAddress: body.customerAddress || null,
      subtotal: String(subtotal),
      taxAmount: String(body.taxAmount ?? 0),
      discountAmount: String(body.discountAmount ?? 0),
      totalAmount: String(totalAmount),
      notes: body.notes || null,
      dueDate: body.dueDate || null,
      createdBy: req.user!.id,
    }).returning();

    await db.insert(invoiceItems).values(
      body.items.map((item) => ({
        invoiceId: invoice.id,
        description: item.description,
        quantity: item.quantity,
        unitPrice: String(item.unitPrice),
        totalPrice: String(item.totalPrice),
      }))
    );

    await createAuditLog({ tenantId, userId: req.user!.id, action: "create", resourceType: "invoice", resourceId: invoice.id });

    const full = await db.query.invoices.findFirst({
      where: eq(invoices.id, invoice.id),
      with: { items: true, branch: true },
    });
    res.status(201).json(full);
  } catch (error) {
    handleControllerError(error, res);
  }
};

export const createInvoiceFromOrder = async (req: Request, res: Response): Promise<void> => {
  try {
    const tenantId = req.tenantContext!.tenantId;
    const order = await db.query.salesOrders.findFirst({
      where: and(eq(salesOrders.id, req.params.orderId as string), eq(salesOrders.tenantId, tenantId)),
      with: { items: true },
    });
    if (!order) { res.status(404).json({ error: "Order not found" }); return; }

    const [{ total }] = await db.select({ total: count() }).from(invoices).where(eq(invoices.tenantId, tenantId));
    const invoiceNumber = `INV-${String(Number(total) + 1).padStart(5, "0")}`;

    const [invoice] = await db.insert(invoices).values({
      tenantId,
      orderId: order.id,
      branchId: order.branchId,
      invoiceNumber,
      customerName: order.customerName,
      customerEmail: order.customerEmail,
      customerPhone: order.customerPhone,
      subtotal: order.subtotal,
      taxAmount: order.taxAmount,
      discountAmount: order.discountAmount,
      totalAmount: order.totalAmount,
      notes: order.notes,
      createdBy: req.user!.id,
    }).returning();

    if (order.items.length > 0) {
      await db.insert(invoiceItems).values(
        order.items.map((item) => ({
          invoiceId: invoice.id,
          description: `${item.productName} — ${item.variantName}`,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          totalPrice: item.totalPrice,
        }))
      );
    }

    const full = await db.query.invoices.findFirst({
      where: eq(invoices.id, invoice.id),
      with: { items: true, branch: true },
    });
    res.status(201).json(full);
  } catch {
    res.status(500).json({ error: "Internal server error" });
  }
};

export const updateInvoice = async (req: Request, res: Response): Promise<void> => {
  try {
    const body = updateInvoiceSchema.parse(req.body);

    const update: Record<string, unknown> = { ...body, updatedAt: new Date() };
    if (body.status === "paid") update.paidAt = new Date();

    const [invoice] = await db.update(invoices)
      .set(update)
      .where(and(eq(invoices.id, req.params.invoiceId as string), eq(invoices.tenantId, req.tenantContext!.tenantId)))
      .returning();
    if (!invoice) { res.status(404).json({ error: "Invoice not found" }); return; }
    res.json(invoice);
  } catch (error) {
    handleControllerError(error, res);
  }
};

export const deleteInvoice = async (req: Request, res: Response): Promise<void> => {
  try {
    const [invoice] = await db.delete(invoices)
      .where(and(eq(invoices.id, req.params.invoiceId as string), eq(invoices.tenantId, req.tenantContext!.tenantId)))
      .returning();
    if (!invoice) { res.status(404).json({ error: "Invoice not found" }); return; }
    res.json({ success: true });
  } catch {
    res.status(500).json({ error: "Internal server error" });
  }
};
