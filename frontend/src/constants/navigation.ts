import {
  LayoutDashboard, Package, Tag, Warehouse, ShoppingCart,
  ClipboardList, GitBranch, Users, BarChart2, Ruler, Building2,
  ArrowRightLeft, Truck, ShoppingBag, CreditCard, Plug, Code,
  TrendingUp, FileText,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

export interface NavItem {
  label: string;
  icon: LucideIcon;
  href: string;
  roles: string[] | null;
}

export const navItems: NavItem[] = [
  { label: "Dashboard",       icon: LayoutDashboard, href: "/dashboard",       roles: null },
  { label: "POS",             icon: CreditCard,      href: "/pos",             roles: null },
  { label: "Products",        icon: Package,         href: "/products",        roles: null },
  { label: "Categories",      icon: Tag,             href: "/categories",      roles: null },
  { label: "Customers",       icon: Users,           href: "/customers",       roles: null },
  { label: "Inventory",       icon: Warehouse,       href: "/inventory",       roles: null },
  { label: "Units",           icon: Ruler,           href: "/units",           roles: null },
  { label: "Sales Orders",    icon: ShoppingCart,     href: "/orders",          roles: null },
  { label: "Invoices",        icon: FileText,        href: "/invoices",        roles: null },
  { label: "Suppliers",       icon: Truck,            href: "/suppliers",       roles: null },
  { label: "Purchase Orders", icon: ShoppingBag,     href: "/purchase-orders", roles: null },
  { label: "Transactions",    icon: ArrowRightLeft,  href: "/transactions",    roles: null },
  { label: "Branches",        icon: GitBranch,       href: "/branches",        roles: null },
  { label: "Staff",           icon: Users,           href: "/staff",           roles: ["owner", "admin", "manager"] },
  { label: "Reports",         icon: BarChart2,       href: "/reports",         roles: null },
  { label: "Analytics",       icon: TrendingUp,      href: "/analytics",       roles: null },
  { label: "Audit Log",       icon: ClipboardList,   href: "/audit",           roles: null },
  { label: "Integrations",    icon: Plug,            href: "/integrations",    roles: ["owner", "admin"] },
  { label: "API",             icon: Code,            href: "/api-keys",        roles: ["owner", "admin"] },
  { label: "Organization",    icon: Building2,       href: "/organization",    roles: ["owner", "admin", "manager"] },
];

export const ALL_PAGES = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/pos", label: "POS" },
  { href: "/products", label: "Products" },
  { href: "/categories", label: "Categories" },
  { href: "/customers", label: "Customers" },
  { href: "/inventory", label: "Inventory" },
  { href: "/units", label: "Units" },
  { href: "/orders", label: "Sales Orders" },
  { href: "/invoices", label: "Invoices" },
  { href: "/suppliers", label: "Suppliers" },
  { href: "/purchase-orders", label: "Purchase Orders" },
  { href: "/transactions", label: "Transactions" },
  { href: "/branches", label: "Branches" },
  { href: "/reports", label: "Reports" },
  { href: "/analytics", label: "Analytics" },
  { href: "/audit", label: "Audit Log" },
];
