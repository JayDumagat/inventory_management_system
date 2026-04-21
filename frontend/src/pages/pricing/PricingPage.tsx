import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Check, Package, X, ArrowLeft } from "lucide-react";
import { useAuthStore } from "../../stores/authStore";
import { useTenantStore } from "../../stores/tenantStore";
import { api } from "../../api/client";

const PLANS = [
  {
    key: "free",
    name: "Free",
    price: "$0",
    period: "forever",
    description: "Perfect for getting started",
    features: [
      { text: "1 location / branch", included: true },
      { text: "Up to 100 products", included: true },
      { text: "Basic reports", included: true },
      { text: "POS included", included: true },
      { text: "Sales orders", included: true },
      { text: "Advanced analytics", included: false },
      { text: "Invoicing", included: false },
      { text: "API access", included: false },
      { text: "Priority support", included: false },
      { text: "Unlimited branches", included: false },
    ],
  },
  {
    key: "pro",
    name: "Pro",
    price: "$29",
    period: "per month",
    description: "For growing businesses",
    popular: true,
    features: [
      { text: "Up to 5 locations", included: true },
      { text: "Unlimited products", included: true },
      { text: "Advanced analytics", included: true },
      { text: "Invoicing", included: true },
      { text: "API access", included: true },
      { text: "POS included", included: true },
      { text: "Sales orders", included: true },
      { text: "Purchase orders", included: true },
      { text: "Priority email support", included: true },
      { text: "Unlimited branches", included: false },
    ],
  },
  {
    key: "enterprise",
    name: "Enterprise",
    price: "$99",
    period: "per month",
    description: "For large organisations",
    features: [
      { text: "Unlimited locations", included: true },
      { text: "Unlimited products", included: true },
      { text: "Advanced analytics", included: true },
      { text: "Invoicing", included: true },
      { text: "Full API access", included: true },
      { text: "White label", included: true },
      { text: "Custom integrations", included: true },
      { text: "Dedicated support", included: true },
      { text: "SLA guarantee", included: true },
      { text: "Custom onboarding", included: true },
    ],
  },
];

export default function PricingPage() {
  const { user } = useAuthStore();
  const { currentTenant } = useTenantStore();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [upgrading, setUpgrading] = useState<string | null>(null);
  const [successPlan, setSuccessPlan] = useState<string | null>(null);

  const currentPlan = (currentTenant as { plan?: string })?.plan ?? "free";

  const upgradeMutation = useMutation({
    mutationFn: (plan: string) =>
      api.patch(`/api/tenants/${currentTenant!.id}/subscription`, { planKey: plan }).then((r) => r.data),
    onSuccess: (_, plan) => {
      qc.invalidateQueries({ queryKey: ["tenants"] });
      qc.invalidateQueries({ queryKey: ["subscription", currentTenant!.id] });
      setUpgrading(null);
      setSuccessPlan(plan);
    },
    onError: () => setUpgrading(null),
  });

  const handleSelectPlan = (planKey: string) => {
    if (!user) {
      navigate("/register");
      return;
    }
    if (!currentTenant) {
      navigate("/setup");
      return;
    }
    if (planKey === currentPlan) return;
    setUpgrading(planKey);
    upgradeMutation.mutate(planKey);
  };

  return (
    <div className="min-h-screen bg-white text-gray-900">
      {/* Nav */}
      <nav className="sticky top-0 z-10 bg-white/90 backdrop-blur-sm border-b border-gray-100">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2.5">
            <div className="w-8 h-8 bg-blue-600 flex items-center justify-center">
              <Package className="w-5 h-5 text-white" />
            </div>
            <span className="text-lg font-bold text-gray-900">Inventra</span>
          </Link>
          <div className="flex items-center gap-4">
            {user ? (
              <Link to="/dashboard" className="flex items-center gap-1.5 text-sm text-gray-600 hover:text-gray-900">
                <ArrowLeft className="w-3.5 h-3.5" /> Back to dashboard
              </Link>
            ) : (
              <>
                <Link to="/login" className="text-sm text-gray-600 hover:text-gray-900">Sign in</Link>
                <Link to="/register" className="px-4 py-2 bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 transition-colors">
                  Get started
                </Link>
              </>
            )}
          </div>
        </div>
      </nav>

      {/* Header */}
      <section className="max-w-3xl mx-auto px-6 pt-16 pb-12 text-center">
        <h1 className="text-4xl font-bold text-gray-900 mb-4">Simple, transparent pricing</h1>
        <p className="text-lg text-gray-500">
          Start free. No credit card required. Upgrade as your business grows.
        </p>
        {successPlan && (
          <div className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-green-50 border border-green-200 text-green-700 text-sm">
            <Check className="w-4 h-4" />
            Plan updated to <strong>{successPlan}</strong>!
          </div>
        )}
      </section>

      {/* Plans */}
      <section className="max-w-5xl mx-auto px-6 pb-20">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {PLANS.map((plan) => {
            const isCurrent = currentPlan === plan.key;
            const isUpgrading = upgrading === plan.key;
            return (
              <div
                key={plan.key}
                className={`border relative flex flex-col ${
                  plan.popular
                    ? "border-blue-500 ring-2 ring-blue-500"
                    : isCurrent
                    ? "border-green-400"
                    : "border-gray-200"
                }`}
              >
                {plan.popular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-0.5 bg-blue-600 text-white text-xs font-semibold whitespace-nowrap">
                    Most popular
                  </div>
                )}
                {isCurrent && !plan.popular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-0.5 bg-green-600 text-white text-xs font-semibold whitespace-nowrap">
                    Current plan
                  </div>
                )}

                <div className="p-6 border-b border-gray-100">
                  <p className="text-sm font-semibold text-gray-500 mb-1">{plan.name}</p>
                  <div className="flex items-end gap-1 mb-1">
                    <span className="text-4xl font-bold text-gray-900">{plan.price}</span>
                    <span className="text-sm text-gray-400 mb-1.5">/{plan.period}</span>
                  </div>
                  <p className="text-sm text-gray-500">{plan.description}</p>
                </div>

                <div className="p-6 flex-1">
                  <ul className="space-y-3">
                    {plan.features.map((feat) => (
                      <li key={feat.text} className="flex items-start gap-2 text-sm">
                        {feat.included ? (
                          <Check className="w-3.5 h-3.5 text-blue-600 flex-shrink-0 mt-0.5" />
                        ) : (
                          <X className="w-3.5 h-3.5 text-gray-300 flex-shrink-0 mt-0.5" />
                        )}
                        <span className={feat.included ? "text-gray-700" : "text-gray-400"}>{feat.text}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="p-6 pt-0">
                  {isCurrent ? (
                    <div className="w-full py-2.5 text-center text-sm font-semibold bg-gray-100 text-gray-500">
                      Current plan
                    </div>
                  ) : (
                    <button
                      onClick={() => handleSelectPlan(plan.key)}
                      disabled={isUpgrading}
                      className={`w-full py-2.5 text-center text-sm font-semibold transition-colors disabled:opacity-60 ${
                        plan.popular
                          ? "bg-blue-600 text-white hover:bg-blue-700"
                          : "border border-gray-300 text-gray-700 hover:bg-gray-50"
                      }`}
                    >
                      {isUpgrading ? "Updating…" : user ? (plan.key === "free" ? "Downgrade to Free" : `Upgrade to ${plan.name}`) : "Get started"}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* FAQ */}
        <div className="mt-16 max-w-2xl mx-auto">
          <h2 className="text-xl font-bold text-gray-900 mb-6 text-center">Frequently asked questions</h2>
          <div className="space-y-4">
            {[
              { q: "Can I change plans later?", a: "Yes, you can upgrade or downgrade your plan at any time from the Pricing page." },
              { q: "What happens to my data if I downgrade?", a: "Your data is always safe. Downgrading may restrict access to certain features, but your data remains intact." },
              { q: "Is there a free trial?", a: "Yes — the Free plan is free forever. Pro and Enterprise plans can be upgraded at any time." },
              { q: "Do you offer refunds?", a: "We offer a 30-day money-back guarantee on all paid plans." },
            ].map(({ q, a }) => (
              <div key={q} className="border border-gray-200 p-4">
                <p className="text-sm font-semibold text-gray-900 mb-1">{q}</p>
                <p className="text-sm text-gray-500">{a}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
