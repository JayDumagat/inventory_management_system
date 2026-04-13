import { EventEmitter } from "events";

export interface InventoryLowStockEvent {
  tenantId: string;
  variantId: string;
  productName: string;
  variantName: string;
  sku: string;
  branchId: string;
  branchName: string;
  quantity: number;
  reorderPoint: number;
}

export interface StockMovementEvent {
  tenantId: string;
  variantId: string;
  branchId: string;
  type: "in" | "out" | "transfer" | "adjustment" | "return";
  quantity: number;
  referenceId?: string;
}

export interface OrderCreatedEvent {
  tenantId: string;
  orderId: string;
  orderNumber: string;
  totalAmount: number;
  customerId?: string;
}

export interface OrderStatusChangedEvent {
  tenantId: string;
  orderId: string;
  orderNumber: string;
  previousStatus: string;
  newStatus: string;
}

export interface PurchaseOrderReceivedEvent {
  tenantId: string;
  purchaseOrderId: string;
  orderNumber: string;
  supplierId: string;
}

export type AppEvents = {
  "inventory.low_stock": InventoryLowStockEvent;
  "inventory.stock_movement": StockMovementEvent;
  "order.created": OrderCreatedEvent;
  "order.status_changed": OrderStatusChangedEvent;
  "purchase_order.received": PurchaseOrderReceivedEvent;
};

class AppEventEmitter extends EventEmitter {
  emit<K extends keyof AppEvents>(event: K, payload: AppEvents[K]): boolean {
    return super.emit(event as string, payload);
  }

  on<K extends keyof AppEvents>(event: K, listener: (payload: AppEvents[K]) => void): this {
    return super.on(event as string, listener);
  }

  off<K extends keyof AppEvents>(event: K, listener: (payload: AppEvents[K]) => void): this {
    return super.off(event as string, listener);
  }
}

export const appEvents = new AppEventEmitter();
appEvents.setMaxListeners(50);
