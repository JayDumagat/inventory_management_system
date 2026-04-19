import { Link, useLocation, useNavigate } from "react-router-dom";
import { useSuperadminStore } from "../stores/superadminStore";
import { cn } from "../lib/utils";
import {
  LayoutDashboard, Users, CreditCard, Tag, TicketCheck,
  ClipboardList, BarChart2, LogOut, ChevronDown, ShieldCheck, Menu, X,
} from "lucide-react";
import { useState } from "react";

const ALL_NAV_ITEMS = [
  { href: "/superadmin/dashboard", label: "Dashboard", page: "dashboard", icon: LayoutDashboard },
  { href: "/superadmin/tenants", label: "Tenants", page: "tenants", icon: Users },
  { href: "/superadmin/subscriptions", label: "Subscriptions", page: "subscriptions", icon: CreditCard },
  { href: "/superadmin/plans", label: "Plans", page: "plans", icon: Tag },
  { href: "/superadmin/tickets", label: "Tickets", page: "tickets", icon: TicketCheck },
  { href: "/superadmin/reports", label: "Reports", page: "reports", icon: BarChart2 },
  { href: "/superadmin/staff", label: "Staff", page: "staff", icon: Users, ownerOnly: true },
  { href: "/superadmin/audit-logs", label: "Audit Logs", page: "audit-logs", icon: ClipboardList },
];

export default function SuperadminLayout({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { superadmin, logout } = useSuperadminStore();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);

  const isOwner = superadmin?.role === "owner";
  const allowedPages = superadmin?.allowedPages ?? [];

  const visibleNavItems = ALL_NAV_ITEMS.filter((item) => {
    if (item.ownerOnly && !isOwner) return false;
    if (isOwner) return true;
    return allowedPages.includes(item.page);
  });

  const handleLogout = () => {
    logout();
    navigate("/superadmin/login");
  };

  const userName =
    [superadmin?.firstName, superadmin?.lastName].filter(Boolean).join(" ") ||
    superadmin?.email ||
    "";
  const initial = (superadmin?.firstName?.[0] || superadmin?.email?.[0] || "S").toUpperCase();

  return (
    <div className="flex h-screen overflow-hidden bg-page">
      {/* Sidebar */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 w-56 bg-panel border-r border-stroke flex flex-col transition-transform duration-200",
          sidebarOpen ? "translate-x-0" : "-translate-x-full",
          "lg:translate-x-0 lg:static lg:flex lg:h-full",
        )}
      >
        <div className="px-4 py-4 border-b border-stroke flex items-center gap-2.5">
          <div className="w-7 h-7 bg-primary-700 flex items-center justify-center flex-shrink-0">
            <ShieldCheck className="w-4 h-4 text-white" />
          </div>
          <div>
            <p className="text-sm font-bold text-ink">SuperAdmin</p>
            <p className="text-xs text-muted capitalize">{superadmin?.role ?? "staff"}</p>
          </div>
        </div>

        <nav className="flex-1 px-2 py-3 overflow-y-auto">
          {visibleNavItems.map((item) => {
            const active = location.pathname === item.href || location.pathname.startsWith(item.href + "/");
            return (
              <Link
                key={item.href}
                to={item.href}
                onClick={() => setSidebarOpen(false)}
                className={cn(
                  "flex items-center gap-2.5 px-3 py-2 text-sm font-medium mb-0.5 transition-colors",
                  active
                    ? "bg-primary-600 text-white"
                    : "text-muted hover:bg-hover hover:text-ink",
                )}
              >
                <item.icon className="w-4 h-4 flex-shrink-0" />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="border-t border-stroke px-2 py-3">
          <button
            onClick={handleLogout}
            className="flex items-center gap-2.5 px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50 transition-colors w-full text-left"
          >
            <LogOut className="w-4 h-4 flex-shrink-0" />
            Sign out
          </button>
        </div>
      </aside>

      {/* Sidebar overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/30 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Header */}
        <header className="sticky top-0 z-20 flex items-center gap-3 px-4 h-12 bg-panel border-b border-stroke">
          <button
            onClick={() => setSidebarOpen(true)}
            className="lg:hidden p-1.5 text-muted hover:bg-hover transition-colors"
          >
            <Menu className="w-4 h-4" />
          </button>

          <ShieldCheck className="w-4 h-4 text-primary-700 hidden lg:block" />
          <span className="text-sm font-bold text-ink">Platform Admin</span>

          <div className="flex-1" />

          <div className="relative">
            <button
              onClick={() => setProfileOpen((o) => !o)}
              className="flex items-center gap-2 pl-2 pr-2.5 py-1.5 hover:bg-hover transition-colors"
            >
              <div className="w-6 h-6 bg-primary-100 flex items-center justify-center text-primary-700 font-bold text-xs">
                {initial}
              </div>
              <span className="hidden sm:block text-sm font-medium text-ink max-w-[120px] truncate">
                {userName}
              </span>
              <ChevronDown
                className={cn("w-3.5 h-3.5 text-muted transition-transform", profileOpen && "rotate-180")}
              />
            </button>

            {profileOpen && (
              <div className="absolute right-0 top-full mt-0 w-52 bg-panel border border-stroke overflow-hidden z-50">
                <div className="px-4 py-3 border-b border-stroke">
                  <p className="text-sm font-semibold text-ink truncate">{userName}</p>
                  <p className="text-xs text-muted truncate">{superadmin?.email}</p>
                  <p className="text-xs text-primary-700 capitalize mt-0.5">{superadmin?.role}</p>
                </div>
                <div className="py-1">
                  <button
                    onClick={() => { handleLogout(); setProfileOpen(false); }}
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
    </div>
  );
}
