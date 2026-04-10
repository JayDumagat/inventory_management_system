import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useNavigate } from "react-router-dom";
import { useTenantStore } from "../../stores/tenantStore";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { useState } from "react";
import { api } from "../../api/client";
import { Building2 } from "lucide-react";

const schema = z.object({
  name: z.string().min(1, "Organization name required"),
  slug: z
    .string()
    .min(1, "Slug required")
    .regex(/^[a-z0-9-]+$/, "Lowercase letters, numbers and dashes only"),
  description: z.string().optional(),
});

type FormData = z.infer<typeof schema>;

export default function SetupPage() {
  const navigate = useNavigate();
  const setCurrentTenant = useTenantStore((s) => s.setCurrentTenant);
  const [error, setError] = useState("");

  const { register, handleSubmit, setValue, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const slug = e.target.value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    setValue("slug", slug);
  };

  const onSubmit = async (data: FormData) => {
    try {
      setError("");
      const { data: tenant } = await api.post("/api/tenants", data);
      setCurrentTenant({ ...tenant, role: "owner" });
      navigate("/dashboard");
    } catch (e: unknown) {
      setError((e as { response?: { data?: { error?: string } } })?.response?.data?.error || "Failed to create organization");
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 p-8 w-full max-w-md">
        <div className="flex flex-col items-center mb-8">
          <div className="w-12 h-12 bg-primary-600 rounded-xl flex items-center justify-center mb-3">
            <Building2 className="w-6 h-6 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Set up your organization</h1>
          <p className="text-gray-500 dark:text-gray-400 text-sm mt-1 text-center">
            Create your first organization to start managing inventory
          </p>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-sm text-red-600 dark:text-red-400">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
          <Input
            label="Organization name"
            placeholder="Acme Corp"
            {...register("name")}
            onChange={(e) => { register("name").onChange(e); handleNameChange(e); }}
            error={errors.name?.message}
          />
          <Input
            label="URL slug"
            placeholder="acme-corp"
            {...register("slug")}
            helperText="Used in URLs. Lowercase letters, numbers and dashes."
            error={errors.slug?.message}
          />
          <Input
            label="Description (optional)"
            placeholder="What does your company do?"
            {...register("description")}
            error={errors.description?.message}
          />
          <Button type="submit" loading={isSubmitting} size="lg" className="mt-2">
            Create organization
          </Button>
        </form>
      </div>
    </div>
  );
}
