import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuthStore } from "../stores/authStore";
import { useTenantStore } from "../stores/tenantStore";
import { useBranchStore } from "../stores/branchStore";
import { cn, relativeTime } from "../lib/utils";
import {
  LogOut, Menu, GitBranch, ChevronDown, Check,
  Search, Plus, Settings, Bell, User, SlidersHorizontal, X,
  AlertTriangle, ArrowRightLeft, Package, HelpCircle,
} from "lucide-react";
import { useState, useEffect, useRef, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "../api/client";
import { PreferencesModal } from "../components/ui/PreferencesModal";
import { navItems } from "../constants/navigation";
import type { Branch, Notification } from "../types";
import { SubmitTicketModal } from "../components/SubmitTicketModal";
import { useSubscription, useHasFeature } from "../hooks/useEntitlements";

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
  const [notifOpen, setNotifOpen] = useState(false);
  const [ticketOpen, setTicketOpen] = useState(false);
  const branchRef = useRef<HTMLDivElement>(null);
  const profileRef = useRef<HTMLDivElement>(null);
  const notifRef = useRef<HTMLDivElement>(null);
  const tid = currentTenant?.id;
  const { data: subscriptionData } = useSubscription();
  const hasCustomBranding = useHasFeature("custom_branding");

  const { data: branches = [] } = useQuery<Branch[]>({
    queryKey: ["branches", tid],
    queryFn: () => api.get(`/api/tenants/${tid}/branches`).then((r) => r.data),
    enabled: !!tid,
  });

  const { data: notifications = [] } = useQuery<Notification[]>({
    queryKey: ["notifications", tid],
    queryFn: () => api.get(`/api/tenants/${tid}/notifications`).then((r) => r.data),
    enabled: !!tid,
    refetchInterval: 60_000,
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
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setNotifOpen(false);
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
  const myRole = currentTenant?.role || "staff";
  const tenantLogoUrl = (currentTenant as { logoUrl?: string })?.logoUrl;
  const allowedPages = currentTenant?.allowedPages;

  const visibleNavItems = useMemo(() => navItems.filter((item) => {
    if (item.href === "/loyalty" && subscriptionData && !subscriptionData.plan.features.includes("loyalty")) return false;
    if (item.roles && !item.roles.includes(myRole)) return false;
    if (myRole === "staff" && allowedPages && allowedPages.length > 0) {
      return allowedPages.includes(item.href);
    }
    return true;
  }), [myRole, allowedPages, subscriptionData]);

  return (
    <div className="flex h-screen overflow-hidden bg-page">
      {/* Sidebar */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 w-56 bg-panel border-r border-stroke flex flex-col transition-transform duration-200",
          sidebarOpen ? "translate-x-0" : "-translate-x-full",
          "lg:translate-x-0 lg:static lg:flex lg:h-full"
        )}
      >
        {/* Logo / tenant */}
        <div className="px-4 py-4 border-b border-stroke">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 flex items-center justify-center flex-shrink-0 overflow-hidden">
              {hasCustomBranding && tenantLogoUrl && /^https?:\/\//i.test(tenantLogoUrl) ? (
                <img src={tenantLogoUrl} alt={currentTenant?.name} className="w-7 h-7 object-contain" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
              ) : (
                <div className="w-7 h-7 bg-primary-600 flex items-center justify-center">
                  <Package className="w-4 h-4 text-white" />
                </div>
              )}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-bold text-ink truncate">
                {hasCustomBranding ? (currentTenant?.name || "Inventory") : "Inventory"}
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
        <nav className="flex-1 px-2 py-3 overflow-y-auto sidebar-scroll">
          {visibleNavItems.map((item) => {
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
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top Header */}
        <header className="sticky top-0 z-20 flex items-center gap-3 px-4 h-12 bg-panel border-b border-stroke">
          <button
            onClick={() => setSidebarOpen(true)}
            className="lg:hidden p-1.5 text-muted hover:bg-hover transition-colors"
          >
            <Menu className="w-4 h-4" />
          </button>

          <span className="text-sm font-bold text-ink truncate max-w-[45vw] sm:max-w-none">{pageLabel}</span>

          <div className="flex-1" />

          <div className="flex items-center gap-0.5">
            {/* Help / Submit Ticket */}
            <button
              aria-label="Help & Support"
              onClick={() => setTicketOpen(true)}
              className="p-1.5 text-muted hover:bg-hover transition-colors"
              title="Help & Support"
            >
              <HelpCircle className="w-4 h-4" />
            </button>

            {/* Notifications */}
            <div className="relative" ref={notifRef}>
              <button
                aria-label="Notifications"
                onClick={() => setNotifOpen((o) => !o)}
                className="relative p-1.5 text-muted hover:bg-hover transition-colors"
              >
                <Bell className="w-4 h-4" />
                {notifications.length > 0 && (
                  <span className="absolute top-1 right-1 w-1.5 h-1.5 bg-red-500 rounded-full" />
                )}
              </button>
              {notifOpen && (
                <div className="absolute right-0 top-full mt-0 w-80 bg-panel border border-stroke overflow-hidden z-50">
                  <div className="px-4 py-3 border-b border-stroke">
                    <p className="text-sm font-semibold text-ink">Notifications</p>
                  </div>
                  {notifications.length === 0 ? (
                    <div className="px-4 py-6 text-center text-sm text-muted">No notifications</div>
                  ) : (
                    <div className="max-h-80 overflow-y-auto">
                      {notifications.map((n) => {
                        const Icon = n.type === "low_stock" ? AlertTriangle : n.type === "transfer" ? ArrowRightLeft : Bell;
                        const iconColor = n.type === "low_stock" ? "text-yellow-500" : n.type === "transfer" ? "text-blue-500" : "text-muted";
                        return (
                          <div key={n.id} className="flex items-start gap-3 px-4 py-3 border-b border-stroke last:border-0 hover:bg-hover transition-colors">
                            <Icon className={`w-4 h-4 flex-shrink-0 mt-0.5 ${iconColor}`} />
                            <div className="flex-1 min-w-0">
                              <p className="text-xs text-ink leading-snug">{n.message}</p>
                              <p className="text-[10px] text-muted mt-0.5">{relativeTime(n.createdAt)}</p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

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

        <main className="flex-1 p-3 sm:p-5 overflow-y-auto">{children}</main>
      </div>

      <PreferencesModal open={prefsOpen} onClose={() => setPrefsOpen(false)} />
      <SubmitTicketModal
        open={ticketOpen}
        onClose={() => setTicketOpen(false)}
        userEmail={user?.email ?? ""}
        userName={[user?.firstName, user?.lastName].filter(Boolean).join(" ")}
        tenantId={currentTenant?.id}
      />
    </div>
  );
}
