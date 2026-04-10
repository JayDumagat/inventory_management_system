import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Link, useNavigate } from "react-router-dom";
import { useAuthStore } from "../../stores/authStore";
import { useTenantStore } from "../../stores/tenantStore";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { useState } from "react";
import { Package } from "lucide-react";
import { api } from "../../api/client";

const schema = z.object({
  email: z.string().email("Invalid email"),
  password: z.string().min(1, "Password required"),
});

type FormData = z.infer<typeof schema>;

export default function LoginPage() {
  const navigate = useNavigate();
  const login = useAuthStore((s) => s.login);
  const setCurrentTenant = useTenantStore((s) => s.setCurrentTenant);
  const [error, setError] = useState("");

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  const onSubmit = async (data: FormData) => {
    try {
      setError("");
      await login(data.email, data.password);

      // Check if user has any tenants
      const { data: tenants } = await api.get("/api/tenants");
      if (tenants.length === 0) {
        navigate("/setup");
      } else {
        setCurrentTenant(tenants[0]);
        navigate("/dashboard");
      }
    } catch (e: unknown) {
      setError((e as { response?: { data?: { error?: string } } })?.response?.data?.error || "Login failed");
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 p-8 w-full max-w-md">
        <div className="flex flex-col items-center mb-8">
          <div className="w-12 h-12 bg-primary-600 rounded-xl flex items-center justify-center mb-3">
            <Package className="w-6 h-6 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Welcome back</h1>
          <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">Sign in to your account</p>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-sm text-red-600 dark:text-red-400">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
          <Input label="Email" type="email" {...register("email")} error={errors.email?.message} />
          <Input label="Password" type="password" {...register("password")} error={errors.password?.message} />
          <Button type="submit" loading={isSubmitting} size="lg" className="mt-2">
            Sign in
          </Button>
        </form>

        <p className="text-center text-sm text-gray-500 dark:text-gray-400 mt-6">
          Don&apos;t have an account?{" "}
          <Link to="/register" className="text-primary-600 dark:text-primary-400 font-medium hover:underline">
            Create one
          </Link>
        </p>
      </div>
    </div>
  );
}
