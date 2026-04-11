import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuthStore } from "../stores/authStore";
import { useTenantStore } from "../stores/tenantStore";
import { useBranchStore } from "../stores/branchStore";
import { cn } from "../lib/utils";
import {
  LayoutDashboard, Package, Tag, Warehouse, ShoppingCart,
  ClipboardList, LogOut, Menu, GitBranch, ChevronDown, Check,
  Search, Plus, Settings, Bell, User, SlidersHorizontal, X,
  Users,
} from "lucide-react";
import { useState, useEffect, useRef, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "../api/client";
import { PreferencesModal } from "../components/ui/PreferencesModal";

interface Branch { id: string; name: string; isDefault: boolean; }

const navItems = [
  { label: "Dashboard",    icon: LayoutDashboard, href: "/dashboard" },
  { label: "Products",     icon: Package,         href: "/products" },
  { label: "Categories",   icon: Tag,             href: "/categories" },
  { label: "Customers",    icon: Users,           href: "/customers" },
  { label: "Inventory",    icon: Warehouse,       href: "/inventory" },
  { label: "Sales Orders", icon: ShoppingCart,    href: "/orders" },
  { label: "Branches",     icon: GitBranch,       href: "/branches" },
  { label: "Audit Log",    icon: ClipboardList,   href: "/audit" },
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

  useEffect(() => {
    if (branches.length === 0) return;
    const isCurrentValid = currentBranch && branches.some((b) => b.id === currentBranch.id);
    if (!isCurrentValid) {
      const defaultBranch = branches.find((b) => b.isDefault) ?? branches[0];
      setCurrentBranch(defaultBranch);
    }
  }, [branches, currentBranch, setCurrentBranch]);

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
  const pageLabel = navItems.find((n) => n.href === location.pathname)?.label ?? currentTenant?.name;

  return (
    <div className="flex min-h-screen bg-page">
      {/* Sidebar */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 w-56 bg-panel border-r border-stroke flex flex-col transition-transform duration-200",
          sidebarOpen ? "translate-x-0" : "-translate-x-full",
          "lg:translate-x-0 lg:static lg:flex"
        )}
      >
        {/* Logo / tenant */}
        <div className="px-4 py-4 border-b border-stroke">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 bg-primary-600 flex items-center justify-center flex-shrink-0">
              <Package className="w-4 h-4 text-white" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-bold text-ink truncate">
                {currentTenant?.name || "Inventory"}
              </p>
              <p className="text-xs text-muted truncate capitalize">{currentTenant?.role}</p>
            </div>
          </div>

          {/* Branch switcher */}
          {branches.length > 0 && (
            <div className="relative mt-3" ref={branchRef}>
              <button
                onClick={() => { setBranchDropdownOpen((o) => !o); setBranchSearch(""); }}
                className="flex items-center gap-2 w-full px-2.5 py-1.5 border border-stroke bg-page hover:bg-hover transition-colors text-left"
              >
                <GitBranch className="w-3.5 h-3.5 text-muted flex-shrink-0" />
                <span className="flex-1 text-xs font-medium text-ink truncate">
                  {currentBranch?.name ?? "Select branch"}
                </span>
                <ChevronDown className={cn("w-3.5 h-3.5 text-muted flex-shrink-0 transition-transform", branchDropdownOpen && "rotate-180")} />
              </button>

              {branchDropdownOpen && (
                <div className="absolute left-0 right-0 top-full mt-0 z-50 bg-panel border border-stroke overflow-hidden">
                  <div className="p-2 border-b border-stroke">
                    <div className="flex items-center gap-1.5 px-2 py-1.5 border border-stroke bg-page">
                      <Search className="w-3 h-3 text-muted flex-shrink-0" />
                      <input
                        autoFocus
                        type="text"
                        placeholder="Search branches…"
                        value={branchSearch}
                        onChange={(e) => setBranchSearch(e.target.value)}
                        className="flex-1 text-xs bg-transparent outline-none text-ink placeholder:text-muted"
                      />
                    </div>
                  </div>

                  <div className="max-h-40 overflow-y-auto">
                    {filteredBranches.length === 0 ? (
                      <p className="px-3 py-3 text-xs text-muted text-center">No branches found</p>
                    ) : (
                      filteredBranches.map((branch) => (
                        <button
                          key={branch.id}
                          onClick={() => { setCurrentBranch(branch); setBranchDropdownOpen(false); setBranchSearch(""); }}
                          className="flex items-center gap-2 w-full px-3 py-2 text-xs text-left hover:bg-hover transition-colors"
                        >
                          <Check className={cn("w-3.5 h-3.5 flex-shrink-0", currentBranch?.id === branch.id ? "text-primary-600" : "text-transparent")} />
                          <span className={cn("flex-1 truncate", currentBranch?.id === branch.id ? "font-semibold text-primary-700" : "text-ink")}>
                            {branch.name}
                          </span>
                          {branch.isDefault && (
                            <span className="text-[10px] text-muted flex-shrink-0">default</span>
                          )}
                        </button>
                      ))
                    )}
                  </div>

                  <div className="border-t border-stroke">
                    <button
                      onClick={() => { navigate("/branches?create=true"); setBranchDropdownOpen(false); setBranchSearch(""); }}
                      className="flex items-center gap-2 w-full px-3 py-2 text-xs text-left hover:bg-hover transition-colors text-primary-600 font-medium"
                    >
                      <Plus className="w-3.5 h-3.5 flex-shrink-0" />
                      Create branch
                    </button>
                    <button
                      onClick={() => { navigate("/branches"); setBranchDropdownOpen(false); setBranchSearch(""); }}
                      className="flex items-center gap-2 w-full px-3 py-2 text-xs text-left hover:bg-hover transition-colors text-muted"
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
        <nav className="flex-1 px-2 py-3 overflow-y-auto">
          {navItems.map((item) => {
            const active = location.pathname === item.href;
            return (
              <Link
                key={item.href}
                to={item.href}
                onClick={() => setSidebarOpen(false)}
                className={cn(
                  "flex items-center gap-2.5 px-3 py-2 text-sm font-medium mb-0.5 transition-colors",
                  active
                    ? "bg-primary-600 text-white"
                    : "text-muted hover:bg-hover hover:text-ink"
                )}
              >
                <item.icon className="w-4 h-4 flex-shrink-0" />
                {item.label}
              </Link>
            );
          })}
        </nav>

        {/* Bottom user section */}
        <div className="border-t border-stroke px-2 py-3">
          <Link
            to="/settings"
            className="flex items-center gap-2.5 px-3 py-2 text-sm font-medium text-muted hover:bg-hover hover:text-ink transition-colors mb-0.5"
          >
            <Settings className="w-4 h-4 flex-shrink-0" />
            Settings
          </Link>
        </div>
      </aside>

      {/* Sidebar overlay (mobile) */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-30 bg-black/30 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Header */}
        <header className="sticky top-0 z-20 flex items-center gap-3 px-4 h-12 bg-panel border-b border-stroke">
          <button
            onClick={() => setSidebarOpen(true)}
            className="lg:hidden p-1.5 text-muted hover:bg-hover transition-colors"
          >
            <Menu className="w-4 h-4" />
          </button>

          <span className="text-sm font-bold text-ink">{pageLabel}</span>

          <div className="flex-1" />

          <button
            aria-label="Notifications"
            className="relative p-1.5 text-muted hover:bg-hover transition-colors"
          >
            <Bell className="w-4 h-4" />
            <span className="absolute top-1 right-1 w-1.5 h-1.5 bg-primary-500" />
          </button>

          {/* Profile dropdown */}
          <div className="relative" ref={profileRef}>
            <button
              onClick={() => setProfileOpen((o) => !o)}
              className="flex items-center gap-2 pl-2 pr-2.5 py-1.5 hover:bg-hover transition-colors"
            >
              <div className="w-6 h-6 bg-primary-100 flex items-center justify-center text-primary-700 font-bold text-xs flex-shrink-0">
                {userInitial}
              </div>
              <span className="hidden sm:block text-sm font-medium text-ink max-w-[120px] truncate">
                {userName}
              </span>
              <ChevronDown className={cn("w-3.5 h-3.5 text-muted transition-transform", profileOpen && "rotate-180")} />
            </button>

            {profileOpen && (
              <div className="absolute right-0 top-full mt-0 w-52 bg-panel border border-stroke overflow-hidden z-50">
                <div className="px-4 py-3 border-b border-stroke">
                  <p className="text-sm font-semibold text-ink truncate">{userName}</p>
                  <p className="text-xs text-muted truncate">{user?.email}</p>
                </div>

                <div className="py-1">
                  <button
                    onClick={() => { navigate("/profile"); setProfileOpen(false); }}
                    className="flex items-center gap-2.5 w-full px-4 py-2 text-sm text-ink hover:bg-hover transition-colors text-left"
                  >
                    <User className="w-3.5 h-3.5 text-muted flex-shrink-0" />
                    Profile
                  </button>
                  <button
                    onClick={() => { setPrefsOpen(true); setProfileOpen(false); }}
                    className="flex items-center gap-2.5 w-full px-4 py-2 text-sm text-ink hover:bg-hover transition-colors text-left"
                  >
                    <SlidersHorizontal className="w-3.5 h-3.5 text-muted flex-shrink-0" />
                    Preferences
                  </button>
                  <button
                    onClick={() => { navigate("/settings"); setProfileOpen(false); }}
                    className="flex items-center gap-2.5 w-full px-4 py-2 text-sm text-ink hover:bg-hover transition-colors text-left"
                  >
                    <Settings className="w-3.5 h-3.5 text-muted flex-shrink-0" />
                    Settings
                  </button>
                </div>

                <div className="border-t border-stroke py-1">
                  <button
                    onClick={handleLogout}
                    className="flex items-center gap-2.5 w-full px-4 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors text-left"
                  >
                    <LogOut className="w-3.5 h-3.5 flex-shrink-0" />
                    Sign out
                  </button>
                </div>
              </div>
            )}
          </div>

          {sidebarOpen && (
            <button
              onClick={() => setSidebarOpen(false)}
              className="lg:hidden fixed top-3 left-[14.5rem] z-50 p-1.5 bg-panel border border-stroke text-muted"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </header>

        <main className="flex-1 p-5 overflow-auto">{children}</main>
      </div>

      <PreferencesModal open={prefsOpen} onClose={() => setPrefsOpen(false)} />
    </div>
  );
}

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
          "fixed inset-y-0 left-0 z-40 w-56 bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-700 flex flex-col transition-transform duration-200",
          sidebarOpen ? "translate-x-0" : "-translate-x-full",
          "lg:translate-x-0 lg:static lg:flex"
        )}
      >
        {/* Logo */}
        <div className="px-4 py-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 bg-primary-600 rounded flex items-center justify-center flex-shrink-0">
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
                className="flex items-center gap-2 w-full px-2.5 py-1.5 rounded border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700/60 transition-colors text-left"
              >
                <GitBranch className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                <span className="flex-1 text-xs font-medium text-gray-700 dark:text-gray-300 truncate">
                  {currentBranch?.name ?? "Select branch"}
                </span>
                <ChevronDown className={cn("w-3.5 h-3.5 text-gray-400 flex-shrink-0 transition-transform", branchDropdownOpen && "rotate-180")} />
              </button>

              {branchDropdownOpen && (
                <div className="absolute left-0 right-0 top-full mt-1 z-50 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-md overflow-hidden">
                  {/* Search */}
                  <div className="p-2 border-b border-gray-100 dark:border-gray-800">
                    <div className="flex items-center gap-1.5 px-2 py-1.5 rounded border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
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
        <nav className="flex-1 px-3 py-3 overflow-y-auto">
          {navItems.map((item) => {
            const active = location.pathname === item.href;
            return (
              <Link
                key={item.href}
                to={item.href}
                onClick={() => setSidebarOpen(false)}
                className={cn(
                  "flex items-center gap-2.5 px-2.5 py-2 rounded text-sm font-medium mb-0.5 transition-colors",
                  active
                    ? "bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300"
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
        <div className="fixed inset-0 z-30 bg-black/20 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* ── Top Header ── */}
        <header className="sticky top-0 z-20 flex items-center gap-3 px-4 h-12 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700">
          {/* Hamburger (mobile) */}
          <button
            onClick={() => setSidebarOpen(true)}
            className="lg:hidden p-1.5 rounded text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          >
            <Menu className="w-4 h-4" />
          </button>

          {/* Page title */}
          <span className="text-sm font-semibold text-gray-900 dark:text-white">{pageLabel}</span>

          {/* Spacer */}
          <div className="flex-1" />

          {/* Notification bell */}
          <button
            aria-label="Notifications"
            className="relative p-1.5 rounded text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          >
            <Bell className="w-4 h-4" />
            <span className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-primary-500" />
          </button>

          {/* Help */}
          <button
            aria-label="Help & Support"
            className="p-1.5 rounded text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          >
            <LifeBuoy className="w-4 h-4" />
          </button>

          {/* Profile dropdown */}
          <div className="relative" ref={profileRef}>
            <button
              onClick={() => setProfileOpen((o) => !o)}
              className="flex items-center gap-2 pl-2 pr-2.5 py-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            >
              <div className="w-6 h-6 bg-primary-100 dark:bg-primary-900/40 rounded-full flex items-center justify-center text-primary-700 dark:text-primary-300 font-semibold text-xs flex-shrink-0">
                {userInitial}
              </div>
              <span className="hidden sm:block text-sm font-medium text-gray-700 dark:text-gray-300 max-w-[120px] truncate">
                {userName}
              </span>
              <ChevronDown className={cn("w-3.5 h-3.5 text-gray-400 transition-transform", profileOpen && "rotate-180")} />
            </button>

            {profileOpen && (
              <div className="absolute right-0 top-full mt-1.5 w-48 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-md overflow-hidden z-50">
                {/* User info */}
                <div className="px-3 py-3 border-b border-gray-100 dark:border-gray-800">
                  <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{userName}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{user?.email}</p>
                </div>

                {/* Menu items */}
                <div className="py-1">
                  <button
                    onClick={() => setProfileOpen(false)}
                    className="flex items-center gap-2.5 w-full px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors text-left"
                  >
                    <User className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                    Profile
                  </button>
                  <button
                    onClick={() => { setPrefsOpen(true); setProfileOpen(false); }}
                    className="flex items-center gap-2.5 w-full px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors text-left"
                  >
                    <SlidersHorizontal className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                    Preferences
                  </button>
                  <button
                    onClick={() => { navigate("/branches"); setProfileOpen(false); }}
                    className="flex items-center gap-2.5 w-full px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors text-left"
                  >
                    <Settings className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                    Settings
                  </button>
                </div>

                <div className="border-t border-gray-100 dark:border-gray-800 py-1">
                  <button
                    onClick={handleLogout}
                    className="flex items-center gap-2.5 w-full px-3 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors text-left"
                  >
                    <LogOut className="w-3.5 h-3.5 flex-shrink-0" />
                    Sign out
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Mobile close sidebar button */}
          {sidebarOpen && (
            <button
              onClick={() => setSidebarOpen(false)}
              className="lg:hidden fixed top-3 left-[14.5rem] z-50 p-1.5 rounded bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </header>

        <main className="flex-1 p-5 overflow-auto">{children}</main>
      </div>

      {/* Preferences modal */}
      <PreferencesModal open={prefsOpen} onClose={() => setPrefsOpen(false)} />
    </div>
  );
}

