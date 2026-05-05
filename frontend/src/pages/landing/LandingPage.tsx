import { Link } from "react-router-dom";
import {
  Package, BarChart2, ShoppingCart, Users, GitBranch, CreditCard,
  ArrowRight, Check, Warehouse, TrendingUp, FileText, Shield,
} from "lucide-react";

const features = [
  {
    icon: Warehouse,
    title: "Inventory Tracking",
    description: "Real-time stock levels across all locations with automatic low-stock alerts and reorder points.",
  },
  {
    icon: ShoppingCart,
    title: "Sales Orders",
    description: "Manage customer orders from creation to delivery. Full order lifecycle with status tracking.",
  },
  {
    icon: CreditCard,
    title: "Point of Sale",
    description: "Fast and intuitive POS for in-store sales. Supports multiple payment methods.",
  },
  {
    icon: TrendingUp,
    title: "Analytics & Reports",
    description: "Deep insights into revenue, top products, and inventory performance with beautiful charts.",
  },
  {
    icon: Users,
    title: "Team Management",
    description: "Role-based access control for owners, admins, managers, and staff with page-level permissions.",
  },
  {
    icon: GitBranch,
    title: "Multi-Branch",
    description: "Manage inventory and staff across multiple locations from one unified dashboard.",
  },
  {
    icon: FileText,
    title: "Invoicing",
    description: "Create professional invoices from sales orders. Track payment status and due dates.",
  },
  {
    icon: Shield,
    title: "Audit Trail",
    description: "Every action logged. Full audit trail for compliance and accountability.",
  },
  {
    icon: BarChart2,
    title: "Purchase Orders",
    description: "Manage supplier relationships and track purchase orders from draft to received.",
  },
];

const pricingTeaser = [
  {
    plan: "Free",
    price: "$0",
    features: ["1 location", "Up to 100 products", "Basic reports", "POS included"],
  },
  {
    plan: "Pro",
    price: "$29/mo",
    popular: true,
    features: ["5 locations", "Unlimited products", "Advanced analytics", "API access", "Invoicing"],
  },
  {
    plan: "Enterprise",
    price: "$99/mo",
    features: ["Unlimited locations", "White label", "Priority support", "Custom integrations", "SLA guarantee"],
  },
];

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-white text-gray-900">
      {/* Nav */}
      <nav className="sticky top-0 z-10 bg-white/90 backdrop-blur-sm border-b border-gray-100">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 bg-blue-600 flex items-center justify-center">
              <Package className="w-5 h-5 text-white" />
            </div>
            <span className="text-lg font-bold text-gray-900">Inventra</span>
          </div>
          <div className="flex items-center gap-6">
            <Link to="/pricing" className="hidden sm:block text-sm text-gray-500 hover:text-gray-900 transition-colors">
              Pricing
            </Link>
            <Link to="/login" className="text-sm text-gray-600 hover:text-gray-900 transition-colors">
              Sign in
            </Link>
            <Link
              to="/register"
              className="px-4 py-2 bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 transition-colors"
            >
              Get started free
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="max-w-5xl mx-auto px-6 pt-24 pb-20 text-center">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-blue-50 border border-blue-200 text-blue-700 text-xs font-medium mb-8">
          <span className="w-1.5 h-1.5 bg-blue-600 rounded-full" />
          Multi-tenant inventory management
        </div>
        <h1 className="text-5xl sm:text-6xl font-bold text-gray-900 mb-6 leading-tight tracking-tight">
          Manage your inventory<br />
          <span className="text-blue-600">with confidence</span>
        </h1>
        <p className="text-xl text-gray-500 mb-10 max-w-2xl mx-auto leading-relaxed">
          A complete inventory platform for modern businesses. Track stock, manage orders,
          run POS, invoice customers, and grow with powerful analytics.
        </p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <Link
            to="/register"
            className="px-8 py-3.5 bg-blue-600 text-white font-semibold hover:bg-blue-700 transition-colors flex items-center gap-2 text-sm"
          >
            Start for free <ArrowRight className="w-4 h-4" />
          </Link>
          <Link
            to="/login"
            className="px-8 py-3.5 border border-gray-300 text-gray-700 font-semibold hover:bg-gray-50 transition-colors text-sm"
          >
            Sign in to your account
          </Link>
        </div>
        <p className="text-xs text-gray-400 mt-4">No credit card required · Free forever plan available</p>
      </section>

      {/* Features */}
      <section className="bg-gray-50 py-20">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-14">
            <h2 className="text-3xl font-bold text-gray-900 mb-3">Everything you need to run your business</h2>
            <p className="text-gray-500 max-w-xl mx-auto">
              From inventory tracking to invoicing, we've got all the tools modern businesses need.
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((f) => (
              <div key={f.title} className="bg-white border border-gray-200 p-6 hover:shadow-sm transition-shadow">
                <div className="w-10 h-10 bg-blue-50 border border-blue-200 flex items-center justify-center mb-4">
                  <f.icon className="w-5 h-5 text-blue-600" />
                </div>
                <h3 className="text-base font-semibold text-gray-900 mb-2">{f.title}</h3>
                <p className="text-sm text-gray-500 leading-relaxed">{f.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing teaser */}
      <section className="py-20 max-w-5xl mx-auto px-6">
        <div className="text-center mb-14">
          <h2 className="text-3xl font-bold text-gray-900 mb-3">Simple, transparent pricing</h2>
          <p className="text-gray-500">Start free. Upgrade as you grow.</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
          {pricingTeaser.map((p) => (
            <div
              key={p.plan}
              className={`border p-6 relative ${p.popular ? "border-blue-500 ring-2 ring-blue-500" : "border-gray-200"}`}
            >
              {p.popular && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-0.5 bg-blue-600 text-white text-xs font-semibold">
                  Most popular
                </div>
              )}
              <p className="text-sm font-semibold text-gray-500 mb-1">{p.plan}</p>
              <p className="text-3xl font-bold text-gray-900 mb-4">{p.price}</p>
              <ul className="space-y-2 mb-6">
                {p.features.map((feat) => (
                  <li key={feat} className="flex items-center gap-2 text-sm text-gray-600">
                    <Check className="w-3.5 h-3.5 text-blue-600 flex-shrink-0" />
                    {feat}
                  </li>
                ))}
              </ul>
              <Link
                to="/register"
                className={`block w-full py-2.5 text-center text-sm font-semibold transition-colors ${
                  p.popular
                    ? "bg-blue-600 text-white hover:bg-blue-700"
                    : "border border-gray-300 text-gray-700 hover:bg-gray-50"
                }`}
              >
                Get started
              </Link>
            </div>
          ))}
        </div>
        <div className="text-center mt-8">
          <Link to="/pricing" className="text-sm text-blue-600 hover:underline">
            See full pricing details →
          </Link>
        </div>
      </section>

      {/* CTA */}
      <section className="bg-blue-600 py-16">
        <div className="max-w-2xl mx-auto px-6 text-center">
          <h2 className="text-3xl font-bold text-white mb-4">Ready to take control?</h2>
          <p className="text-blue-100 mb-8">Join thousands of businesses managing their inventory with Inventra.</p>
          <Link
            to="/register"
            className="inline-flex items-center gap-2 px-8 py-3.5 bg-white text-blue-600 font-semibold hover:bg-blue-50 transition-colors text-sm"
          >
            Start for free <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-gray-100 py-8">
        <div className="max-w-6xl mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 bg-blue-600 flex items-center justify-center">
              <Package className="w-4 h-4 text-white" />
            </div>
            <span className="text-sm font-semibold text-gray-700">Inventra</span>
          </div>
          <div className="flex items-center gap-6 text-sm text-gray-400">
            <Link to="/pricing" className="hover:text-gray-600">Pricing</Link>
            <Link to="/login" className="hover:text-gray-600">Sign in</Link>
            <Link to="/register" className="hover:text-gray-600">Register</Link>
            <Link to="/privacy-policy" className="hover:text-gray-600">Privacy Policy</Link>
            <Link to="/terms" className="hover:text-gray-600">Terms</Link>
          </div>
          <p className="text-xs text-gray-400">© {new Date().getFullYear()} Inventra. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
