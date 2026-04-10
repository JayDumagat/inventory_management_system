import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuthStore } from "../stores/authStore";
import { useTenantStore } from "../stores/tenantStore";
import { useBranchStore } from "../stores/branchStore";
import { cn } from "../lib/utils";
import {
  LayoutDashboard, Package, Tag, Warehouse, ShoppingCart,
  ClipboardList, LogOut, Menu, GitBranch, ChevronDown, Check,
} from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "../api/client";

interface Branch { id: string; name: string; isDefault: boolean; }

const navItems = [
  { label: "Dashboard", icon: LayoutDashboard, href: "/dashboard" },
  { label: "Products", icon: Package, href: "/products" },
  { label: "Categories", icon: Tag, href: "/categories" },
  { label: "Inventory", icon: Warehouse, href: "/inventory" },
  { label: "Sales Orders", icon: ShoppingCart, href: "/orders" },
  { label: "Audit Log", icon: ClipboardList, href: "/audit" },
];

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();
  const { currentTenant } = useTenantStore();
  const { currentBranch, setCurrentBranch } = useBranchStore();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [branchDropdownOpen, setBranchDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const tid = currentTenant?.id;

  const { data: branches = [] } = useQuery<Branch[]>({
    queryKey: ["branches", tid],
    queryFn: () => api.get(`/api/tenants/${tid}/branches`).then((r) => r.data),
    enabled: !!tid,
  });

  // Auto-select default (or first) branch when branches load or tenant changes
  useEffect(() => {
    if (branches.length === 0) return;
    const isCurrentValid = currentBranch && branches.some((b) => b.id === currentBranch.id);
    if (!isCurrentValid) {
      const defaultBranch = branches.find((b) => b.isDefault) ?? branches[0];
      setCurrentBranch(defaultBranch);
    }
  }, [branches, currentBranch, setCurrentBranch]);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setBranchDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  return (
    <div className="flex min-h-screen bg-gray-50">
      {/* Sidebar */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 w-64 bg-white border-r border-gray-200 flex flex-col transition-transform duration-200",
          sidebarOpen ? "translate-x-0" : "-translate-x-full",
          "lg:translate-x-0 lg:static lg:flex"
        )}
      >
        {/* Logo */}
        <div className="px-6 py-5 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-primary-600 rounded-lg flex items-center justify-center flex-shrink-0">
              <Package className="w-4 h-4 text-white" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-gray-900 truncate">
                {currentTenant?.name || "Inventory"}
              </p>
              <p className="text-xs text-gray-500 truncate">{currentTenant?.role}</p>
            </div>
          </div>

          {/* Branch switcher */}
          {branches.length > 0 && (
            <div className="relative mt-3" ref={dropdownRef}>
              <button
                onClick={() => setBranchDropdownOpen((o) => !o)}
                className="flex items-center gap-2 w-full px-3 py-2 rounded-lg bg-gray-50 hover:bg-gray-100 transition-colors text-left"
              >
                <GitBranch className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                <span className="flex-1 text-xs font-medium text-gray-700 truncate">
                  {currentBranch?.name ?? "Select branch"}
                </span>
                <ChevronDown className={cn("w-3.5 h-3.5 text-gray-400 flex-shrink-0 transition-transform", branchDropdownOpen && "rotate-180")} />
              </button>

              {branchDropdownOpen && (
                <div className="absolute left-0 right-0 top-full mt-1 z-50 bg-white border border-gray-200 rounded-lg shadow-lg py-1 max-h-48 overflow-y-auto">
                  {branches.map((branch) => (
                    <button
                      key={branch.id}
                      onClick={() => { setCurrentBranch(branch); setBranchDropdownOpen(false); }}
                      className="flex items-center gap-2 w-full px-3 py-2 text-xs text-left hover:bg-gray-50 transition-colors"
                    >
                      <Check className={cn("w-3.5 h-3.5 flex-shrink-0", currentBranch?.id === branch.id ? "text-primary-600" : "text-transparent")} />
                      <span className={cn("flex-1 truncate", currentBranch?.id === branch.id ? "font-semibold text-primary-700" : "text-gray-700")}>
                        {branch.name}
                      </span>
                      {branch.isDefault && (
                        <span className="text-[10px] text-gray-400 flex-shrink-0">default</span>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 overflow-y-auto">
          {navItems.map((item) => {
            const active = location.pathname === item.href;
            return (
              <Link
                key={item.href}
                to={item.href}
                onClick={() => setSidebarOpen(false)}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium mb-1 transition-colors",
                  active
                    ? "bg-primary-50 text-primary-700"
                    : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
                )}
              >
                <item.icon className={cn("w-4 h-4", active ? "text-primary-600" : "text-gray-400")} />
                {item.label}
              </Link>
            );
          })}
        </nav>

        {/* User */}
        <div className="px-3 py-4 border-t border-gray-100">
          <div className="flex items-center gap-3 px-3 py-2 rounded-lg">
            <div className="w-8 h-8 bg-primary-100 rounded-full flex items-center justify-center text-primary-700 font-semibold text-sm flex-shrink-0">
              {user?.firstName?.[0]?.toUpperCase() || user?.email?.[0]?.toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900 truncate">
                {user?.firstName} {user?.lastName}
              </p>
              <p className="text-xs text-gray-500 truncate">{user?.email}</p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="flex items-center gap-2 w-full px-3 py-2 text-sm text-red-600 hover:bg-red-50 rounded-lg transition-colors mt-1"
          >
            <LogOut className="w-4 h-4" />
            Sign out
          </button>
        </div>
      </aside>

      {/* Overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-30 bg-black/30 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top bar (mobile) */}
        <header className="lg:hidden flex items-center gap-3 px-4 py-3 bg-white border-b border-gray-200">
          <button onClick={() => setSidebarOpen(true)} className="text-gray-600">
            <Menu className="w-5 h-5" />
          </button>
          <span className="text-sm font-semibold text-gray-900">{currentTenant?.name}</span>
        </header>

        <main className="flex-1 p-6 overflow-auto">{children}</main>
      </div>
    </div>
  );
}
