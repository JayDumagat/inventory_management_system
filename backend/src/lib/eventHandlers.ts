import { appEvents } from "../lib/events";
import { cacheDelPattern } from "../lib/redis";

// Invalidate dashboard/reports cache when stock changes
appEvents.on("inventory.stock_movement", async ({ tenantId }) => {
  await cacheDelPattern(`dashboard:${tenantId}:*`);
  await cacheDelPattern(`reports:${tenantId}:*`);
  await cacheDelPattern(`inventory:${tenantId}:*`);
});

// Invalidate dashboard/reports cache on order changes
appEvents.on("order.created", async ({ tenantId }) => {
  await cacheDelPattern(`dashboard:${tenantId}:*`);
  await cacheDelPattern(`reports:${tenantId}:*`);
});

appEvents.on("order.status_changed", async ({ tenantId }) => {
  await cacheDelPattern(`dashboard:${tenantId}:*`);
  await cacheDelPattern(`reports:${tenantId}:*`);
});

// Log low stock events (placeholder — notifications route already handles DB notifications)
appEvents.on("inventory.low_stock", ({ tenantId, productName, variantName, sku, quantity, reorderPoint }) => {
  console.log(
    `[Event] Low stock: tenant=${tenantId} product="${productName}" variant="${variantName}" sku=${sku} qty=${quantity} reorder=${reorderPoint}`
  );
});

appEvents.on("purchase_order.received", async ({ tenantId }) => {
  await cacheDelPattern(`inventory:${tenantId}:*`);
  await cacheDelPattern(`purchase_orders:${tenantId}:*`);
});
