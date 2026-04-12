import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Link } from "react-router-dom";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { useState } from "react";
import { Package, ArrowLeft, CheckCircle } from "lucide-react";
import { api } from "../../api/client";

const schema = z.object({
  email: z.string().email("Invalid email"),
});

type FormData = z.infer<typeof schema>;

export default function ForgotPasswordPage() {
  const [submitted, setSubmitted] = useState(false);
  const [devToken, setDevToken] = useState("");
  const [error, setError] = useState("");

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  const onSubmit = async (data: FormData) => {
    try {
      setError("");
      const { data: res } = await api.post("/api/auth/forgot-password", data);
      setSubmitted(true);
      if (res.resetToken) setDevToken(res.resetToken);
    } catch (e: unknown) {
      setError((e as { response?: { data?: { error?: string } } })?.response?.data?.error || "Request failed");
    }
  };

  return (
    <div className="min-h-screen bg-page flex items-center justify-center p-4">
      <div className="bg-panel border border-stroke p-8 w-full max-w-sm">
        <div className="flex flex-col items-center mb-7">
          <div className="w-10 h-10 bg-primary-600 flex items-center justify-center mb-3">
            <Package className="w-5 h-5 text-white" />
          </div>
          <h1 className="text-xl font-bold text-ink">Reset your password</h1>
          <p className="text-muted text-sm mt-1 text-center">
            Enter your email and we'll send a reset link
          </p>
        </div>

        {submitted ? (
          <div className="flex flex-col items-center gap-4 text-center">
            <div className="w-12 h-12 bg-green-50 border border-green-200 flex items-center justify-center">
              <CheckCircle className="w-6 h-6 text-green-600" />
            </div>
            <div>
              <p className="text-sm font-medium text-ink">Check your email</p>
              <p className="text-xs text-muted mt-1">
                If that address is registered, we've sent a reset link.
              </p>
            </div>
            {devToken && (
              <div className="w-full p-3 bg-amber-50 border border-amber-200 text-left">
                <p className="text-xs font-semibold text-amber-700 mb-1">Dev mode — reset token:</p>
                <p className="text-xs font-mono text-amber-800 break-all">{devToken}</p>
                <Link
                  to={`/reset-password?token=${devToken}`}
                  className="text-xs text-primary-600 font-medium hover:underline mt-2 block"
                >
                  → Go to reset page
                </Link>
              </div>
            )}
            <Link to="/login" className="text-sm text-primary-600 font-medium hover:underline flex items-center gap-1">
              <ArrowLeft className="w-3.5 h-3.5" />
              Back to sign in
            </Link>
          </div>
        ) : (
          <>
            {error && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 text-sm text-red-700">
                {error}
              </div>
            )}
            <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
              <Input label="Email" type="email" {...register("email")} error={errors.email?.message} />
              <Button type="submit" loading={isSubmitting} size="lg" className="w-full">
                Send reset link
              </Button>
            </form>
            <p className="text-center text-sm text-muted mt-6">
              <Link to="/login" className="text-primary-600 font-medium hover:underline flex items-center justify-center gap-1">
                <ArrowLeft className="w-3.5 h-3.5" />
                Back to sign in
              </Link>
            </p>
          </>
        )}
      </div>
    </div>
  );
}
