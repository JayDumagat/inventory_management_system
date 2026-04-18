import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Package, CheckCircle } from "lucide-react";
import { api } from "../../api/client";
import { useAuthStore } from "../../stores/authStore";
import { useTenantStore } from "../../stores/tenantStore";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";

const schema = z
  .object({
    firstName: z.string().min(1, "First name required"),
    lastName: z.string().min(1, "Last name required"),
    password: z.string().min(8, "At least 8 characters"),
    confirmPassword: z.string(),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: "Passwords don't match",
    path: ["confirmPassword"],
  });

type FormData = z.infer<typeof schema>;

interface InviteInfo {
  email: string;
  firstName: string;
  lastName: string;
  tenantName: string;
}

export default function AcceptInvitePage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const inviteToken = searchParams.get("token");

  const setAuthState = useAuthStore((s) => s.setTokens);
  const setCurrentTenant = useTenantStore((s) => s.setCurrentTenant);

  const [info, setInfo] = useState<InviteInfo | null>(null);
  const [loadError, setLoadError] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitError, setSubmitError] = useState("");

  const { register, handleSubmit, formState: { errors, isSubmitting }, setValue } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  useEffect(() => {
    if (!inviteToken) {
      setLoadError("Missing invite token. Please use the link from your invitation email.");
      setLoading(false);
      return;
    }

    api
      .get(`/api/auth/invite-info?token=${encodeURIComponent(inviteToken)}`)
      .then(({ data }) => {
        setInfo(data);
        if (data.firstName) setValue("firstName", data.firstName);
        if (data.lastName) setValue("lastName", data.lastName);
      })
      .catch((e: unknown) => {
        const msg = (e as { response?: { data?: { error?: string } } })?.response?.data?.error;
        setLoadError(msg || "Invalid or expired invite link.");
      })
      .finally(() => setLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inviteToken]);

  const onSubmit = async (data: FormData) => {
    try {
      setSubmitError("");
      const { data: result } = await api.post("/api/auth/complete-invite", {
        inviteToken,
        password: data.password,
        firstName: data.firstName,
        lastName: data.lastName,
      });

      localStorage.setItem("accessToken", result.accessToken);
      localStorage.setItem("refreshToken", result.refreshToken);
      setAuthState(result.accessToken, result.refreshToken);
      useAuthStore.setState({ user: result.user, isAuthenticated: true });

      // Fetch tenant list to select the current tenant and skip onboarding
      const { data: tenantList } = await api.get("/api/tenants");
      if (tenantList.length > 0) {
        setCurrentTenant(tenantList[0]);
        navigate("/dashboard");
      } else {
        navigate("/setup");
      }
    } catch (e: unknown) {
      setSubmitError(
        (e as { response?: { data?: { error?: string } } })?.response?.data?.error ||
          "Failed to complete registration. Please try again."
      );
    }
  };

  return (
    <div className="min-h-screen bg-page flex items-center justify-center p-4">
      <div className="bg-panel border border-stroke p-8 w-full max-w-sm">
        <div className="flex flex-col items-center mb-7">
          <div className="w-10 h-10 bg-primary-600 flex items-center justify-center mb-3">
            <Package className="w-5 h-5 text-white" />
          </div>
          <h1 className="text-xl font-bold text-ink">Accept invitation</h1>
          {info?.tenantName && (
            <p className="text-muted text-sm mt-1 text-center">
              You've been invited to join <span className="font-semibold text-ink">{info.tenantName}</span>
            </p>
          )}
        </div>

        {loading && (
          <p className="text-center text-sm text-muted">Validating invitation…</p>
        )}

        {!loading && loadError && (
          <div className="p-3 bg-red-50 border border-red-200 text-sm text-red-700 text-center">
            {loadError}
          </div>
        )}

        {!loading && info && (
          <>
            <div className="flex items-center gap-2 mb-5 p-3 bg-page border border-stroke">
              <CheckCircle className="w-4 h-4 text-primary-600 flex-shrink-0" />
              <span className="text-sm text-ink truncate">{info.email}</span>
            </div>

            {submitError && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 text-sm text-red-700">
                {submitError}
              </div>
            )}

            <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
              <div className="grid grid-cols-2 gap-3">
                <Input label="First name" {...register("firstName")} error={errors.firstName?.message} />
                <Input label="Last name" {...register("lastName")} error={errors.lastName?.message} />
              </div>
              <Input label="Password" type="password" {...register("password")} error={errors.password?.message} />
              <Input
                label="Confirm password"
                type="password"
                {...register("confirmPassword")}
                error={errors.confirmPassword?.message}
              />
              <Button type="submit" loading={isSubmitting} size="lg" className="mt-1 w-full">
                Set password &amp; continue
              </Button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
