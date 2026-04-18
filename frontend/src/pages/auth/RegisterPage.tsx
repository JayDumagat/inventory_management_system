import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Link, useNavigate } from "react-router-dom";
import { useAuthStore } from "../../stores/authStore";
import { useTenantStore } from "../../stores/tenantStore";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { useState, useEffect, useRef } from "react";
import { Package } from "lucide-react";
import { api } from "../../api/client";

const schema = z.object({
  firstName: z.string().min(1, "First name required"),
  lastName: z.string().min(1, "Last name required"),
  email: z.string().email("Invalid email"),
  password: z.string().min(8, "At least 8 characters"),
  confirmPassword: z.string(),
}).refine((d) => d.password === d.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});

type FormData = z.infer<typeof schema>;

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined;

export default function RegisterPage() {
  const navigate = useNavigate();
  const register = useAuthStore((s) => s.register);
  const setAuthData = useAuthStore((s) => s.setTokens);
  const setCurrentTenant = useTenantStore((s) => s.setCurrentTenant);
  const [error, setError] = useState("");
  const [oauthLoading, setOauthLoading] = useState(false);
  const googleBtnRef = useRef<HTMLDivElement>(null);

  const { register: rf, handleSubmit, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  const redirectAfterRegister = async () => {
    const { data: tenantList } = await api.get("/api/tenants");
    if (tenantList.length > 0) {
      setCurrentTenant(tenantList[0]);
      navigate("/dashboard");
    } else {
      navigate("/setup");
    }
  };

  const onSubmit = async (data: FormData) => {
    try {
      setError("");
      await register(data.email, data.password, data.confirmPassword, data.firstName, data.lastName);
      await redirectAfterRegister();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Registration failed";
      setError((e as { response?: { data?: { error?: string } } })?.response?.data?.error || msg);
    }
  };

  const handleGoogleCredential = async (credential: string) => {
    try {
      setOauthLoading(true);
      setError("");
      const { data } = await api.post("/api/auth/oauth/google", { credential });
      localStorage.setItem("accessToken", data.accessToken);
      localStorage.setItem("refreshToken", data.refreshToken);
      setAuthData(data.accessToken, data.refreshToken);
      useAuthStore.setState({ user: data.user, isAuthenticated: true });
      await redirectAfterRegister();
    } catch (e: unknown) {
      setError((e as { response?: { data?: { error?: string } } })?.response?.data?.error || "Google sign-up failed");
    } finally {
      setOauthLoading(false);
    }
  };

  useEffect(() => {
    if (!GOOGLE_CLIENT_ID || !googleBtnRef.current) return;
    const script = document.createElement("script");
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.onload = () => {
      window.google?.accounts.id.initialize({
        client_id: GOOGLE_CLIENT_ID,
        callback: (resp: { credential: string }) => handleGoogleCredential(resp.credential),
      });
      window.google?.accounts.id.renderButton(googleBtnRef.current!, {
        theme: "outline",
        size: "large",
        width: googleBtnRef.current!.offsetWidth,
        text: "signup_with",
      });
    };
    document.body.appendChild(script);
    return () => { document.body.removeChild(script); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="min-h-screen bg-page flex items-center justify-center p-4">
      <div className="bg-panel border border-stroke p-8 w-full max-w-sm">
        <div className="flex flex-col items-center mb-7">
          <div className="w-10 h-10 bg-primary-600 flex items-center justify-center mb-3">
            <Package className="w-5 h-5 text-white" />
          </div>
          <h1 className="text-xl font-bold text-ink">Create account</h1>
          <p className="text-muted text-sm mt-1">Start managing your inventory today</p>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 text-sm text-red-700">
            {error}
          </div>
        )}

        {GOOGLE_CLIENT_ID && (
          <>
            {oauthLoading ? (
              <div className="flex items-center justify-center h-10 text-xs text-muted mb-4">Signing up…</div>
            ) : (
              <div ref={googleBtnRef} className="w-full mb-4" />
            )}
            <div className="flex items-center gap-3 mb-4">
              <div className="flex-1 h-px bg-stroke" />
              <span className="text-xs text-muted">or sign up with email</span>
              <div className="flex-1 h-px bg-stroke" />
            </div>
          </>
        )}

        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-3">
            <Input label="First name" {...rf("firstName")} error={errors.firstName?.message} />
            <Input label="Last name" {...rf("lastName")} error={errors.lastName?.message} />
          </div>
          <Input label="Email" type="email" {...rf("email")} error={errors.email?.message} />
          <Input label="Password" type="password" {...rf("password")} error={errors.password?.message} />
          <Input label="Confirm password" type="password" {...rf("confirmPassword")} error={errors.confirmPassword?.message} />
          <Button type="submit" loading={isSubmitting} size="lg" className="mt-1 w-full">
            Create account
          </Button>
        </form>

        <p className="text-center text-sm text-muted mt-6">
          Already have an account?{" "}
          <Link to="/login" className="text-primary-600 font-medium hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
