import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import path from "path";
import * as dotenv from "dotenv";

dotenv.config({ path: path.join(process.cwd(), '.env') });

import authRouter from "./routes/auth";
import tenantsRouter from "./routes/tenants";
import branchesRouter from "./routes/branches";
import categoriesRouter from "./routes/categories";
import productsRouter from "./routes/products";
import inventoryRouter from "./routes/inventory";
import salesOrdersRouter from "./routes/salesOrders";
import auditLogsRouter from "./routes/auditLogs";
import dashboardRouter from "./routes/dashboard";

const app = express();
const PORT = process.env.PORT || 3001;

app.use(helmet());
app.use(cors({
  origin: process.env.FRONTEND_URL || "http://localhost:5173",
  credentials: true,
  methods: ["GET", "POST", "PATCH", "DELETE"],
}));
app.use(morgan("dev"));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes
app.use("/api/auth", authRouter);
app.use("/api/tenants", tenantsRouter);
app.use("/api/tenants/:tenantId/branches", branchesRouter);
app.use("/api/tenants/:tenantId/categories", categoriesRouter);
app.use("/api/tenants/:tenantId/products", productsRouter);
app.use("/api/tenants/:tenantId/inventory", inventoryRouter);
app.use("/api/tenants/:tenantId/sales-orders", salesOrdersRouter);
app.use("/api/tenants/:tenantId/audit-logs", auditLogsRouter);
app.use("/api/tenants/:tenantId/dashboard", dashboardRouter);

app.get("/health", (_req, res) => res.json({ status: "ok", timestamp: new Date().toISOString() }));

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

export default app;
