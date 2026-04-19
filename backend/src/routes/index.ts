import type { Express } from "express";
import { limiter } from "../config/rateLimiter";

import authRouter from "./auth";
import tenantsRouter from "./tenants";
import branchesRouter from "./branches";
import categoriesRouter from "./categories";
import productsRouter from "./products";
import inventoryRouter from "./inventory";
import salesOrdersRouter from "./salesOrders";
import auditLogsRouter from "./auditLogs";
import dashboardRouter from "./dashboard";
import staffRouter from "./staff";
import reportsRouter from "./reports";
import unitsRouter from "./units";
import batchesRouter from "./batches";
import notificationsRouter from "./notifications";
import suppliersRouter from "./suppliers";
import purchaseOrdersRouter from "./purchaseOrders";
import transactionsRouter from "./transactions";
import integrationsRouter from "./integrations";
import apiKeysRouter from "./apiKeys";
import uploadsRouter from "./uploads";
import invoicesRouter from "./invoices";
import customersRouter from "./customers";
import subscriptionsRouter from "./subscriptions";
import promotionsRouter from "./promotions";
import loyaltyRouter from "./loyalty";
import ticketsRouter from "./tickets";
import superadminRouter from "./superadmin";

export function registerRoutes(app: Express): void {
  app.use("/api/auth", limiter, authRouter);
  app.use("/api/tenants", limiter, tenantsRouter);
  app.use("/api/tenants/:tenantId/branches", limiter, branchesRouter);
  app.use("/api/tenants/:tenantId/categories", limiter, categoriesRouter);
  app.use("/api/tenants/:tenantId/products", limiter, productsRouter);
  app.use("/api/tenants/:tenantId/inventory", limiter, inventoryRouter);
  app.use("/api/tenants/:tenantId/sales-orders", limiter, salesOrdersRouter);
  app.use("/api/tenants/:tenantId/audit-logs", limiter, auditLogsRouter);
  app.use("/api/tenants/:tenantId/dashboard", limiter, dashboardRouter);
  app.use("/api/tenants/:tenantId/staff", limiter, staffRouter);
  app.use("/api/tenants/:tenantId/reports", limiter, reportsRouter);
  app.use("/api/tenants/:tenantId/units", limiter, unitsRouter);
  app.use("/api/tenants/:tenantId/batches", limiter, batchesRouter);
  app.use("/api/tenants/:tenantId/notifications", limiter, notificationsRouter);
  app.use("/api/tenants/:tenantId/suppliers", limiter, suppliersRouter);
  app.use("/api/tenants/:tenantId/purchase-orders", limiter, purchaseOrdersRouter);
  app.use("/api/tenants/:tenantId/transactions", limiter, transactionsRouter);
  app.use("/api/tenants/:tenantId/integrations", limiter, integrationsRouter);
  app.use("/api/tenants/:tenantId/api-keys", limiter, apiKeysRouter);
  app.use("/api/tenants/:tenantId/invoices", limiter, invoicesRouter);
  app.use("/api/tenants/:tenantId/uploads", limiter, uploadsRouter);
  app.use("/api/tenants/:tenantId/customers", limiter, customersRouter);
  app.use("/api/tenants/:tenantId/subscription", limiter, subscriptionsRouter);
  app.use("/api/tenants/:tenantId/promotions", limiter, promotionsRouter);
  app.use("/api/tenants/:tenantId/loyalty", limiter, loyaltyRouter);
  app.use("/api/tenants/:tenantId/tickets", limiter, ticketsRouter);
  // Public plans listing (no tenant required)
  app.use("/api/subscription", limiter, subscriptionsRouter);
  // Superadmin panel
  app.use("/api/superadmin", limiter, superadminRouter);
}
