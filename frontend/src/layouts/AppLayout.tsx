import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuthStore } from "../stores/authStore";
import { useTenantStore } from "../stores/tenantStore";
import { useBranchStore } from "../stores/branchStore";
import { cn } from "../lib/utils";
import {
  LayoutDashboard, Package, Tag, Warehouse, ShoppingCart,
  ClipboardList, LogOut, Menu, GitBranch, ChevronDown, Check,
  Search, Plus, Settings, Bell, LifeBuoy, User, SlidersHorizontal, X,
} from "lucide-react";
import { useState, useEffect, useRef, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "../api/client";
import { PreferencesModal } from "../components/ui/PreferencesModal";

interface Branch { id: string; name: string; isDefault: boolean; }

const navItems = [
  { label: "Dashboard", icon: LayoutDashboard, href: "/dashboard" },
  { label: "Products", icon: Package, href: "/products" },
  { label: "Categories", icon: Tag, href: "/categories" },
  { label: "Inventory", icon: Warehouse, href: "/inventory" },
  { label: "Sales Orders", icon: ShoppingCart, href: "/orders" },
  { label: "Branches", icon: GitBranch, href: "/branches" },
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
  const [branchSearch, setBranchSearch] = useState("");
  const [profileOpen, setProfileOpen] = useState(false);
  const [prefsOpen, setPrefsOpen] = useState(false);
  const branchRef = useRef<HTMLDivElement>(null);
  const profileRef = useRef<HTMLDivElement>(null);
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

  // Close dropdowns when clicking outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (branchRef.current && !branchRef.current.contains(e.target as Node)) {
        setBranchDropdownOpen(false);
      }
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) {
        setProfileOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const filteredBranches = useMemo(
    () => branches.filter((b) => b.name.toLowerCase().includes(branchSearch.toLowerCase())),
    [branches, branchSearch]
  );

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  const userInitial = user?.firstName?.[0]?.toUpperCase() || user?.email?.[0]?.toUpperCase() || "U";
  const userName = [user?.firstName, user?.lastName].filter(Boolean).join(" ") || user?.email || "";

  // Current page label for header
  const pageLabel = navItems.find((n) => n.href === location.pathname)?.label ?? currentTenant?.name;

  return (
    <div className="flex min-h-screen bg-gray-50 dark:bg-gray-950">
      {/* Sidebar */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 w-60 bg-white dark:bg-gray-900 border-r border-gray-100 dark:border-gray-800 flex flex-col transition-transform duration-200",
          sidebarOpen ? "translate-x-0" : "-translate-x-full",
          "lg:translate-x-0 lg:static lg:flex"
        )}
      >
        {/* Logo */}
        <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-800">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-primary-600 rounded-lg flex items-center justify-center flex-shrink-0">
              <Package className="w-4 h-4 text-white" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">
                {currentTenant?.name || "Inventory"}
              </p>
              <p className="text-xs text-gray-400 dark:text-gray-500 truncate capitalize">{currentTenant?.role}</p>
            </div>
          </div>

          {/* Branch switcher */}
          {branches.length > 0 && (
            <div className="relative mt-3" ref={branchRef}>
              <button
                onClick={() => { setBranchDropdownOpen((o) => !o); setBranchSearch(""); }}
                className="flex items-center gap-2 w-full px-3 py-2 rounded-lg bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700/60 transition-colors text-left"
              >
                <GitBranch className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                <span className="flex-1 text-xs font-medium text-gray-700 dark:text-gray-300 truncate">
                  {currentBranch?.name ?? "Select branch"}
                </span>
                <ChevronDown className={cn("w-3.5 h-3.5 text-gray-400 flex-shrink-0 transition-transform", branchDropdownOpen && "rotate-180")} />
              </button>

              {branchDropdownOpen && (
                <div className="absolute left-0 right-0 top-full mt-1 z-50 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
                  {/* Search */}
                  <div className="p-2 border-b border-gray-100 dark:border-gray-800">
                    <div className="flex items-center gap-1.5 px-2 py-1.5 rounded-md bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
                      <Search className="w-3 h-3 text-gray-400 flex-shrink-0" />
                      <input
                        autoFocus
                        type="text"
                        placeholder="Search branches…"
                        value={branchSearch}
                        onChange={(e) => setBranchSearch(e.target.value)}
                        className="flex-1 text-xs bg-transparent outline-none text-gray-700 dark:text-gray-300 placeholder:text-gray-400"
                      />
                    </div>
                  </div>

                  {/* Branch list */}
                  <div className="max-h-40 overflow-y-auto">
                    {filteredBranches.length === 0 ? (
                      <p className="px-3 py-3 text-xs text-gray-400 text-center">No branches found</p>
                    ) : (
                      filteredBranches.map((branch) => (
                        <button
                          key={branch.id}
                          onClick={() => { setCurrentBranch(branch); setBranchDropdownOpen(false); setBranchSearch(""); }}
                          className="flex items-center gap-2 w-full px-3 py-2 text-xs text-left hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                        >
                          <Check className={cn("w-3.5 h-3.5 flex-shrink-0", currentBranch?.id === branch.id ? "text-primary-600" : "text-transparent")} />
                          <span className={cn("flex-1 truncate", currentBranch?.id === branch.id ? "font-semibold text-primary-700 dark:text-primary-400" : "text-gray-700 dark:text-gray-300")}>
                            {branch.name}
                          </span>
                          {branch.isDefault && (
                            <span className="text-[10px] text-gray-400 flex-shrink-0">default</span>
                          )}
                        </button>
                      ))
                    )}
                  </div>

                  {/* Footer actions */}
                  <div className="border-t border-gray-100 dark:border-gray-800">
                    <button
                      onClick={() => { navigate("/branches?create=true"); setBranchDropdownOpen(false); setBranchSearch(""); }}
                      className="flex items-center gap-2 w-full px-3 py-2 text-xs text-left hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors text-primary-600 dark:text-primary-400 font-medium"
                    >
                      <Plus className="w-3.5 h-3.5 flex-shrink-0" />
                      Create branch
                    </button>
                    <button
                      onClick={() => { navigate("/branches"); setBranchDropdownOpen(false); setBranchSearch(""); }}
                      className="flex items-center gap-2 w-full px-3 py-2 text-xs text-left hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors text-gray-500 dark:text-gray-400"
                    >
                      <Settings className="w-3.5 h-3.5 flex-shrink-0" />
                      Manage branches
                    </button>
                  </div>
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
                  "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium mb-0.5 transition-colors",
                  active
                    ? "bg-primary-50 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300"
                    : "text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-white"
                )}
              >
                <item.icon className={cn("w-4 h-4 flex-shrink-0", active ? "text-primary-600 dark:text-primary-400" : "text-gray-400 dark:text-gray-500")} />
                {item.label}
              </Link>
            );
          })}
        </nav>
      </aside>

      {/* Sidebar overlay (mobile) */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-30 bg-black/30 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* ── Top Header ── */}
        <header className="sticky top-0 z-20 flex items-center gap-3 px-4 h-14 bg-white dark:bg-gray-900 border-b border-gray-100 dark:border-gray-800">
          {/* Hamburger (mobile) */}
          <button
            onClick={() => setSidebarOpen(true)}
            className="lg:hidden p-1.5 rounded-lg text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          >
            <Menu className="w-5 h-5" />
          </button>

          {/* Page title */}
          <span className="text-sm font-semibold text-gray-900 dark:text-white">{pageLabel}</span>

          {/* Spacer */}
          <div className="flex-1" />

          {/* Notification bell */}
          <button
            aria-label="Notifications"
            className="relative p-2 rounded-lg text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          >
            <Bell className="w-4.5 h-4.5 w-[18px] h-[18px]" />
            {/* Badge placeholder */}
            <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-primary-500" />
          </button>

          {/* Help / Lifeguoy */}
          <button
            aria-label="Help & Support"
            className="p-2 rounded-lg text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          >
            <LifeBuoy className="w-[18px] h-[18px]" />
          </button>

          {/* Profile dropdown */}
          <div className="relative" ref={profileRef}>
            <button
              onClick={() => setProfileOpen((o) => !o)}
              className="flex items-center gap-2 pl-2 pr-3 py-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            >
              <div className="w-7 h-7 bg-primary-100 dark:bg-primary-900/40 rounded-full flex items-center justify-center text-primary-700 dark:text-primary-300 font-semibold text-xs flex-shrink-0">
                {userInitial}
              </div>
              <span className="hidden sm:block text-sm font-medium text-gray-700 dark:text-gray-300 max-w-[120px] truncate">
                {userName}
              </span>
              <ChevronDown className={cn("w-3.5 h-3.5 text-gray-400 transition-transform", profileOpen && "rotate-180")} />
            </button>

            {profileOpen && (
              <div className="absolute right-0 top-full mt-1.5 w-52 bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-xl overflow-hidden z-50">
                {/* User info */}
                <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-800">
                  <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{userName}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{user?.email}</p>
                </div>

                {/* Menu items */}
                <div className="py-1">
                  <button
                    onClick={() => setProfileOpen(false)}
                    className="flex items-center gap-3 w-full px-4 py-2.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors text-left"
                  >
                    <User className="w-4 h-4 text-gray-400 flex-shrink-0" />
                    Profile
                  </button>
                  <button
                    onClick={() => { setPrefsOpen(true); setProfileOpen(false); }}
                    className="flex items-center gap-3 w-full px-4 py-2.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors text-left"
                  >
                    <SlidersHorizontal className="w-4 h-4 text-gray-400 flex-shrink-0" />
                    Preferences
                  </button>
                  <button
                    onClick={() => { navigate("/branches"); setProfileOpen(false); }}
                    className="flex items-center gap-3 w-full px-4 py-2.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors text-left"
                  >
                    <Settings className="w-4 h-4 text-gray-400 flex-shrink-0" />
                    Settings
                  </button>
                </div>

                <div className="border-t border-gray-100 dark:border-gray-800 py-1">
                  <button
                    onClick={handleLogout}
                    className="flex items-center gap-3 w-full px-4 py-2.5 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors text-left"
                  >
                    <LogOut className="w-4 h-4 flex-shrink-0" />
                    Sign out
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Mobile close sidebar button (shown inside sidebar overlay) */}
          {sidebarOpen && (
            <button
              onClick={() => setSidebarOpen(false)}
              className="lg:hidden fixed top-3 left-[16.5rem] z-50 p-1.5 rounded-lg bg-white dark:bg-gray-900 text-gray-500 dark:text-gray-400"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </header>

        <main className="flex-1 p-6 overflow-auto">{children}</main>
      </div>

      {/* Preferences modal */}
      <PreferencesModal open={prefsOpen} onClose={() => setPrefsOpen(false)} />
    </div>
  );
}

