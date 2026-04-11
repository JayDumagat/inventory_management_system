import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Link, useNavigate } from "react-router-dom";
import { useAuthStore } from "../../stores/authStore";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { useState } from "react";
import { Package } from "lucide-react";

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

export default function RegisterPage() {
  const navigate = useNavigate();
  const register = useAuthStore((s) => s.register);
  const [error, setError] = useState("");

  const { register: rf, handleSubmit, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  const onSubmit = async (data: FormData) => {
    try {
      setError("");
      await register(data.email, data.password, data.confirmPassword, data.firstName, data.lastName);
      navigate("/setup");
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Registration failed";
      setError((e as { response?: { data?: { error?: string } } })?.response?.data?.error || msg);
    }
  };

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
