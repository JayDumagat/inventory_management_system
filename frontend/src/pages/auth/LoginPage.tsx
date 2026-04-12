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
  email: z.string().email("Invalid email"),
  password: z.string().min(1, "Password required"),
});

type FormData = z.infer<typeof schema>;

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined;

export default function LoginPage() {
  const navigate = useNavigate();
  const login = useAuthStore((s) => s.login);
  const setAuthData = useAuthStore((s) => s.setTokens);
  const setCurrentTenant = useTenantStore((s) => s.setCurrentTenant);
  const [error, setError] = useState("");
  const [oauthLoading, setOauthLoading] = useState(false);
  const googleBtnRef = useRef<HTMLDivElement>(null);

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  const redirectAfterAuth = async () => {
    const { data: tenants } = await api.get("/api/tenants");
    if (tenants.length === 0) {
      navigate("/setup");
    } else {
      setCurrentTenant(tenants[0]);
      navigate("/dashboard");
    }
  };

  const onSubmit = async (data: FormData) => {
    try {
      setError("");
      await login(data.email, data.password);
      await redirectAfterAuth();
    } catch (e: unknown) {
      setError((e as { response?: { data?: { error?: string } } })?.response?.data?.error || "Login failed");
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
      await redirectAfterAuth();
    } catch (e: unknown) {
      setError((e as { response?: { data?: { error?: string } } })?.response?.data?.error || "Google sign-in failed");
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
        text: "signin_with",
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
          <h1 className="text-xl font-bold text-ink">Welcome back</h1>
          <p className="text-muted text-sm mt-1">Sign in to your account</p>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 text-sm text-red-700">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
          <Input label="Email" type="email" {...register("email")} error={errors.email?.message} />
          <div className="flex flex-col gap-1">
            <Input label="Password" type="password" {...register("password")} error={errors.password?.message} />
            <div className="flex justify-end">
              <Link to="/forgot-password" className="text-xs text-primary-600 hover:underline">
                Forgot password?
              </Link>
            </div>
          </div>
          <Button type="submit" loading={isSubmitting} size="lg" className="mt-1 w-full">
            Sign in
          </Button>
        </form>

        {GOOGLE_CLIENT_ID && (
          <>
            <div className="flex items-center gap-3 my-4">
              <div className="flex-1 h-px bg-stroke" />
              <span className="text-xs text-muted">or</span>
              <div className="flex-1 h-px bg-stroke" />
            </div>
            {oauthLoading ? (
              <div className="flex items-center justify-center h-10 text-xs text-muted">Signing in…</div>
            ) : (
              <div ref={googleBtnRef} className="w-full" />
            )}
          </>
        )}

        <p className="text-center text-sm text-muted mt-6">
          Don&apos;t have an account?{" "}
          <Link to="/register" className="text-primary-600 font-medium hover:underline">
            Create one
          </Link>
        </p>
      </div>
    </div>
  );
}

// Extend Window type for Google Identity Services
declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: { client_id: string; callback: (resp: { credential: string }) => void }) => void;
          renderButton: (element: HTMLElement, config: object) => void;
          prompt: () => void;
        };
      };
    };
  }
}
