import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import compression from "compression";
import rateLimit from "express-rate-limit";
import * as dotenv from "dotenv";

dotenv.config();

// Register event handlers (must be imported before routes)
import "./lib/eventHandlers";

import authRouter from "./routes/auth";
import tenantsRouter from "./routes/tenants";
import branchesRouter from "./routes/branches";
import categoriesRouter from "./routes/categories";
import productsRouter from "./routes/products";
import inventoryRouter from "./routes/inventory";
import salesOrdersRouter from "./routes/salesOrders";
import auditLogsRouter from "./routes/auditLogs";
import dashboardRouter from "./routes/dashboard";
import staffRouter from "./routes/staff";
import reportsRouter from "./routes/reports";
import unitsRouter from "./routes/units";
import batchesRouter from "./routes/batches";
import notificationsRouter from "./routes/notifications";
import suppliersRouter from "./routes/suppliers";
import purchaseOrdersRouter from "./routes/purchaseOrders";
import transactionsRouter from "./routes/transactions";
import integrationsRouter from "./routes/integrations";
import invoicesRouter from "./routes/invoices";
import apiKeysRouter from "./routes/apiKeys";
import uploadsRouter from "./routes/uploads";

const app = express();
const PORT = process.env.PORT || 3001;

app.use(helmet());
app.use(cors({
  origin: process.env.FRONTEND_URL || "http://localhost:5173",
  credentials: true,
}));
app.use(compression());
app.use(morgan("dev"));
app.use(express.json({ limit: "15mb" }));
app.use(express.urlencoded({ extended: true }));

// Global rate limiter: 300 requests per 15 minutes per IP
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 300,
  standardHeaders: "draft-8",
  legacyHeaders: false,
});

// Routes
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

app.get("/health", (_req, res) => res.json({ status: "ok", timestamp: new Date().toISOString() }));

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

export default app;

