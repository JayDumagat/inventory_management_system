import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Package, ArrowLeft } from "lucide-react";
import { useAuthStore } from "../../stores/authStore";
import { useTenantStore } from "../../stores/tenantStore";
import { api } from "../../api/client";
import type { PlanDefinition } from "../../types";

export default function PricingPage() {
  const { user } = useAuthStore();
  const { currentTenant } = useTenantStore();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [upgrading, setUpgrading] = useState<string | null>(null);
  const [successPlan, setSuccessPlan] = useState<string | null>(null);
  const { data: plans = [] } = useQuery<PlanDefinition[]>({
    queryKey: ["pricing-plans"],
    queryFn: () => api.get("/api/subscription/plans").then((r) => r.data),
  });

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
          {plans.map((plan) => {
            const isCurrent = currentPlan === plan.key;
            const isUpgrading = upgrading === plan.key;
            const isPopular = plan.key === "pro";
            return (
              <div
                key={plan.key}
                className={`border relative flex flex-col ${
                  isPopular
                    ? "border-blue-500 ring-2 ring-blue-500"
                    : isCurrent
                    ? "border-green-400"
                    : "border-gray-200"
                }`}
              >
                {isPopular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-0.5 bg-blue-600 text-white text-xs font-semibold whitespace-nowrap">
                    Most popular
                  </div>
                )}
                {isCurrent && !isPopular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-0.5 bg-green-600 text-white text-xs font-semibold whitespace-nowrap">
                    Current plan
                  </div>
                )}

                <div className="p-6 border-b border-gray-100">
                  <p className="text-sm font-semibold text-gray-500 mb-1">{plan.name}</p>
                  <div className="flex items-end gap-1 mb-1">
                    <span className="text-4xl font-bold text-gray-900">${plan.monthlyPrice}</span>
                    <span className="text-sm text-gray-400 mb-1.5">/{plan.monthlyPrice > 0 ? "month" : "forever"}</span>
                  </div>
                  <p className="text-sm text-gray-500">
                    {plan.monthlyPrice === 0 ? "Perfect for getting started" : `Billed monthly · $${plan.annualPrice}/year option`}
                  </p>
                </div>

                <div className="p-6 flex-1">
                  <ul className="space-y-3">
                    {plan.features.slice(0, 10).map((feature) => (
                      <li key={feature} className="flex items-start gap-2 text-sm">
                        <Check className="w-3.5 h-3.5 text-blue-600 flex-shrink-0 mt-0.5" />
                        <span className="text-gray-700">{feature.replace(/_/g, " ")}</span>
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
                        isPopular
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
