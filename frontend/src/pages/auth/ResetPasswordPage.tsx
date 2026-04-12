import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { useState } from "react";
import { Package, CheckCircle } from "lucide-react";
import { api } from "../../api/client";

const schema = z.object({
  password: z.string().min(8, "At least 8 characters"),
  confirmPassword: z.string(),
}).refine((d) => d.password === d.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});

type FormData = z.infer<typeof schema>;

export default function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");
  const token = searchParams.get("token") || "";

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  const onSubmit = async (data: FormData) => {
    if (!token) {
      setError("Missing reset token. Please use the link from your email.");
      return;
    }
    try {
      setError("");
      await api.post("/api/auth/reset-password", { token, ...data });
      setDone(true);
      setTimeout(() => navigate("/login"), 3000);
    } catch (e: unknown) {
      setError((e as { response?: { data?: { error?: string } } })?.response?.data?.error || "Reset failed");
    }
  };

  return (
    <div className="min-h-screen bg-page flex items-center justify-center p-4">
      <div className="bg-panel border border-stroke p-8 w-full max-w-sm">
        <div className="flex flex-col items-center mb-7">
          <div className="w-10 h-10 bg-primary-600 flex items-center justify-center mb-3">
            <Package className="w-5 h-5 text-white" />
          </div>
          <h1 className="text-xl font-bold text-ink">Set new password</h1>
          <p className="text-muted text-sm mt-1">Choose a strong password for your account</p>
        </div>

        {done ? (
          <div className="flex flex-col items-center gap-4 text-center">
            <div className="w-12 h-12 bg-green-50 border border-green-200 flex items-center justify-center">
              <CheckCircle className="w-6 h-6 text-green-600" />
            </div>
            <div>
              <p className="text-sm font-medium text-ink">Password updated!</p>
              <p className="text-xs text-muted mt-1">Redirecting you to sign in…</p>
            </div>
          </div>
        ) : (
          <>
            {!token && (
              <div className="mb-4 p-3 bg-amber-50 border border-amber-200 text-sm text-amber-700">
                No reset token found. Please use the link from your email.
              </div>
            )}
            {error && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 text-sm text-red-700">
                {error}
              </div>
            )}
            <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
              <Input
                label="New password"
                type="password"
                {...register("password")}
                error={errors.password?.message}
              />
              <Input
                label="Confirm new password"
                type="password"
                {...register("confirmPassword")}
                error={errors.confirmPassword?.message}
              />
              <Button type="submit" loading={isSubmitting} size="lg" className="w-full" disabled={!token}>
                Set new password
              </Button>
            </form>
            <p className="text-center text-sm text-muted mt-6">
              <Link to="/login" className="text-primary-600 font-medium hover:underline">
                Back to sign in
              </Link>
            </p>
          </>
        )}
      </div>
    </div>
  );
}
