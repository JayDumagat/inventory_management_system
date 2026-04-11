import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../../api/client";
import { useAuthStore } from "../../stores/authStore";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/Card";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { User, Mail, Lock, Shield, CheckCircle } from "lucide-react";

const profileSchema = z.object({
  firstName: z.string().min(1, "First name required"),
  lastName: z.string().min(1, "Last name required"),
});

const passwordSchema = z.object({
  currentPassword: z.string().min(1, "Current password required"),
  newPassword: z.string().min(8, "At least 8 characters"),
  confirmPassword: z.string(),
}).refine((d) => d.newPassword === d.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});

type ProfileForm = z.infer<typeof profileSchema>;
type PasswordForm = z.infer<typeof passwordSchema>;

export default function ProfilePage() {
  const { user } = useAuthStore();
  const qc = useQueryClient();
  const [profileSuccess, setProfileSuccess] = useState(false);
  const [passwordSuccess, setPasswordSuccess] = useState(false);
  const [profileError, setProfileError] = useState("");
  const [passwordError, setPasswordError] = useState("");

  const profileForm = useForm<ProfileForm>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      firstName: user?.firstName || "",
      lastName: user?.lastName || "",
    },
  });

  const passwordForm = useForm<PasswordForm>({ resolver: zodResolver(passwordSchema) });

  const updateProfile = useMutation({
    mutationFn: (data: ProfileForm) => api.patch("/api/auth/me", data).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["me"] });
      setProfileSuccess(true);
      setProfileError("");
      setTimeout(() => setProfileSuccess(false), 3000);
    },
    onError: (e: unknown) => {
      setProfileError((e as { response?: { data?: { error?: string } } })?.response?.data?.error || "Update failed");
    },
  });

  const updatePassword = useMutation({
    mutationFn: (data: PasswordForm) =>
      api.patch("/api/auth/me/password", {
        currentPassword: data.currentPassword,
        newPassword: data.newPassword,
      }).then((r) => r.data),
    onSuccess: () => {
      setPasswordSuccess(true);
      setPasswordError("");
      passwordForm.reset();
      setTimeout(() => setPasswordSuccess(false), 3000);
    },
    onError: (e: unknown) => {
      setPasswordError((e as { response?: { data?: { error?: string } } })?.response?.data?.error || "Password update failed");
    },
  });

  const userInitial = user?.firstName?.[0]?.toUpperCase() || user?.email?.[0]?.toUpperCase() || "U";
  const fullName = [user?.firstName, user?.lastName].filter(Boolean).join(" ") || "User";

  return (
    <div className="space-y-5 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold text-ink">Profile</h1>
        <p className="text-muted text-sm mt-1">Manage your personal information and account security</p>
      </div>

      {/* Avatar card */}
      <Card>
        <CardContent className="py-5 flex items-center gap-5">
          <div className="w-16 h-16 bg-primary-100 border-2 border-primary-300 flex items-center justify-center text-primary-700 font-bold text-2xl flex-shrink-0">
            {userInitial}
          </div>
          <div>
            <p className="font-semibold text-ink text-lg">{fullName}</p>
            <p className="text-muted text-sm">{user?.email}</p>
            <div className="flex items-center gap-1.5 mt-1.5">
              <Shield className="w-3.5 h-3.5 text-primary-500" />
              <span className="text-xs text-primary-600 font-medium capitalize">{user?.role || "User"}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Personal information */}
      <Card>
        <CardHeader>
          <CardTitle>
            <div className="flex items-center gap-2">
              <User className="w-4 h-4 text-muted" />
              Personal information
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {profileError && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 text-sm text-red-700">
              {profileError}
            </div>
          )}
          {profileSuccess && (
            <div className="mb-4 p-3 bg-green-50 border border-green-200 text-sm text-green-700 flex items-center gap-2">
              <CheckCircle className="w-4 h-4 flex-shrink-0" />
              Profile updated successfully
            </div>
          )}
          <form onSubmit={profileForm.handleSubmit((d) => updateProfile.mutate(d))} className="flex flex-col gap-4">
            <div className="grid grid-cols-2 gap-3">
              <Input
                label="First name"
                {...profileForm.register("firstName")}
                error={profileForm.formState.errors.firstName?.message}
              />
              <Input
                label="Last name"
                {...profileForm.register("lastName")}
                error={profileForm.formState.errors.lastName?.message}
              />
            </div>
            <div>
              <label className="text-xs font-medium text-muted block mb-1">Email address</label>
              <div className="flex items-center gap-2 px-3 py-2 border border-stroke bg-page text-muted text-sm">
                <Mail className="w-4 h-4 flex-shrink-0" />
                {user?.email}
              </div>
              <p className="text-xs text-muted mt-1">Contact support to change your email address</p>
            </div>
            <div className="flex justify-end">
              <Button type="submit" loading={updateProfile.isPending}>Save changes</Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Change password */}
      <Card>
        <CardHeader>
          <CardTitle>
            <div className="flex items-center gap-2">
              <Lock className="w-4 h-4 text-muted" />
              Change password
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {passwordError && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 text-sm text-red-700">
              {passwordError}
            </div>
          )}
          {passwordSuccess && (
            <div className="mb-4 p-3 bg-green-50 border border-green-200 text-sm text-green-700 flex items-center gap-2">
              <CheckCircle className="w-4 h-4 flex-shrink-0" />
              Password updated successfully
            </div>
          )}
          <form onSubmit={passwordForm.handleSubmit((d) => updatePassword.mutate(d))} className="flex flex-col gap-4">
            <Input
              label="Current password"
              type="password"
              {...passwordForm.register("currentPassword")}
              error={passwordForm.formState.errors.currentPassword?.message}
            />
            <Input
              label="New password"
              type="password"
              {...passwordForm.register("newPassword")}
              error={passwordForm.formState.errors.newPassword?.message}
              helperText="Minimum 8 characters"
            />
            <Input
              label="Confirm new password"
              type="password"
              {...passwordForm.register("confirmPassword")}
              error={passwordForm.formState.errors.confirmPassword?.message}
            />
            <div className="flex justify-end">
              <Button type="submit" loading={updatePassword.isPending}>Update password</Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Account info */}
      <Card>
        <CardHeader>
          <CardTitle>
            <div className="flex items-center gap-2">
              <Shield className="w-4 h-4 text-muted" />
              Account details
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="space-y-3">
            <div className="flex items-center justify-between py-2 border-b border-stroke">
              <dt className="text-sm text-muted">Account ID</dt>
              <dd className="font-mono text-xs text-ink">{user?.id?.slice(0, 16)}…</dd>
            </div>
            <div className="flex items-center justify-between py-2 border-b border-stroke">
              <dt className="text-sm text-muted">Role</dt>
              <dd className="text-sm font-medium text-ink capitalize">{user?.role}</dd>
            </div>
            <div className="flex items-center justify-between py-2">
              <dt className="text-sm text-muted">Account status</dt>
              <dd>
                <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 font-medium">Active</span>
              </dd>
            </div>
          </dl>
        </CardContent>
      </Card>
    </div>
  );
}
