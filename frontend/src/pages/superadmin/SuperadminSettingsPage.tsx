import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ShieldCheck } from "lucide-react";
import { superadminApi } from "../../api/superadminClient";
import { Card } from "../../components/ui/Card";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { useToast } from "../../hooks/useToast";
import type { PlatformSetting } from "../../types";

type SettingsForm = {
  stripe: { secretKey: string };
  smtp: {
    host: string;
    port: string;
    username: string;
    password: string;
    fromEmail: string;
    fromName: string;
  };
  sms: {
    accountSid: string;
    authToken: string;
    fromNumber: string;
  };
};

const EMPTY_FORM: SettingsForm = {
  stripe: { secretKey: "" },
  smtp: { host: "", port: "", username: "", password: "", fromEmail: "", fromName: "" },
  sms: { accountSid: "", authToken: "", fromNumber: "" },
};

export default function SuperadminSettingsPage() {
  const toast = useToast();
  const qc = useQueryClient();
  const [form, setForm] = useState<SettingsForm>(EMPTY_FORM);

  const { data = [], isLoading } = useQuery<PlatformSetting[]>({
    queryKey: ["superadmin-platform-settings"],
    queryFn: () => superadminApi.get("/api/superadmin/settings").then((r) => r.data),
  });

  const settingsMap = useMemo(
    () => new Map(data.map((entry) => [entry.provider, entry])),
    [data],
  );

  const saveMutation = useMutation({
    mutationFn: ({ provider, config }: { provider: "stripe" | "smtp" | "sms"; config: Record<string, unknown> }) =>
      superadminApi.put(`/api/superadmin/settings/${provider}`, { config }),
    onSuccess: (_res, variables) => {
      qc.invalidateQueries({ queryKey: ["superadmin-platform-settings"] });
      const label = variables.provider === "sms" ? "SMS" : variables.provider.toUpperCase();
      toast.success(`${label} settings saved`);
    },
    onError: (e: { response?: { data?: { error?: string } } }) =>
      toast.error(e?.response?.data?.error ?? "Failed to save settings"),
  });

  const testMutation = useMutation({
    mutationFn: (provider: "stripe" | "smtp" | "sms") =>
      superadminApi.post(`/api/superadmin/settings/${provider}/test`).then((r) => r.data),
    onSuccess: (_res, provider) => {
      const label = provider === "sms" ? "SMS" : provider.toUpperCase();
      toast.success(`${label} connection successful`);
    },
    onError: (e: { response?: { data?: { error?: string; message?: string } } }) =>
      toast.error(e?.response?.data?.error ?? e?.response?.data?.message ?? "Connection test failed"),
  });

  if (isLoading) return <p className="text-sm text-muted">Loading…</p>;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-lg font-bold text-ink">Platform Settings</h1>
        <p className="text-sm text-muted mt-0.5">Configure platform-level providers for subscription billing and notifications</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="p-4 space-y-3">
          <div>
            <p className="text-sm font-semibold text-ink">Payment (Stripe)</p>
            <p className="text-xs text-muted mt-0.5">Used for platform subscription billing</p>
          </div>
          <Input
            label="Stripe Secret Key"
            type="password"
            value={form.stripe.secretKey}
            onChange={(e) => setForm((prev) => ({ ...prev, stripe: { ...prev.stripe, secretKey: e.target.value } }))}
            placeholder={(settingsMap.get("stripe")?.config.secretKey as string) || "sk_live_..."}
          />
          <div className="flex gap-2 justify-end">
            <Button
              variant="secondary"
              className="gap-1.5"
              onClick={() => testMutation.mutate("stripe")}
              loading={testMutation.isPending && testMutation.variables === "stripe"}
            >
              <ShieldCheck className="w-3.5 h-3.5" />
              Test
            </Button>
            <Button
              onClick={() => saveMutation.mutate({ provider: "stripe", config: { secretKey: form.stripe.secretKey || undefined } })}
              loading={saveMutation.isPending && saveMutation.variables?.provider === "stripe"}
            >
              Save
            </Button>
          </div>
        </Card>

        <Card className="p-4 space-y-3">
          <div>
            <p className="text-sm font-semibold text-ink">Email (SMTP)</p>
            <p className="text-xs text-muted mt-0.5">Used for subscription invoice and platform emails</p>
          </div>
          <Input label="Host" value={form.smtp.host} onChange={(e) => setForm((prev) => ({ ...prev, smtp: { ...prev.smtp, host: e.target.value } }))} placeholder={(settingsMap.get("smtp")?.config.host as string) || ""} />
          <Input label="Port" value={form.smtp.port} onChange={(e) => setForm((prev) => ({ ...prev, smtp: { ...prev.smtp, port: e.target.value } }))} placeholder={(settingsMap.get("smtp")?.config.port as string) || ""} />
          <Input label="Username" value={form.smtp.username} onChange={(e) => setForm((prev) => ({ ...prev, smtp: { ...prev.smtp, username: e.target.value } }))} placeholder={(settingsMap.get("smtp")?.config.username as string) || ""} />
          <Input label="Password" type="password" value={form.smtp.password} onChange={(e) => setForm((prev) => ({ ...prev, smtp: { ...prev.smtp, password: e.target.value } }))} placeholder={(settingsMap.get("smtp")?.config.password as string) || ""} />
          <Input label="From Email" value={form.smtp.fromEmail} onChange={(e) => setForm((prev) => ({ ...prev, smtp: { ...prev.smtp, fromEmail: e.target.value } }))} placeholder={(settingsMap.get("smtp")?.config.fromEmail as string) || ""} />
          <Input label="From Name" value={form.smtp.fromName} onChange={(e) => setForm((prev) => ({ ...prev, smtp: { ...prev.smtp, fromName: e.target.value } }))} placeholder={(settingsMap.get("smtp")?.config.fromName as string) || ""} />
          <div className="flex gap-2 justify-end">
            <Button
              variant="secondary"
              className="gap-1.5"
              onClick={() => testMutation.mutate("smtp")}
              loading={testMutation.isPending && testMutation.variables === "smtp"}
            >
              <ShieldCheck className="w-3.5 h-3.5" />
              Test
            </Button>
            <Button
              onClick={() => saveMutation.mutate({
                provider: "smtp",
                config: {
                  host: form.smtp.host || undefined,
                  port: form.smtp.port || undefined,
                  username: form.smtp.username || undefined,
                  password: form.smtp.password || undefined,
                  fromEmail: form.smtp.fromEmail || undefined,
                  fromName: form.smtp.fromName || undefined,
                },
              })}
              loading={saveMutation.isPending && saveMutation.variables?.provider === "smtp"}
            >
              Save
            </Button>
          </div>
        </Card>

        <Card className="p-4 space-y-3">
          <div>
            <p className="text-sm font-semibold text-ink">SMS (Twilio)</p>
            <p className="text-xs text-muted mt-0.5">Used for platform SMS notifications</p>
          </div>
          <Input label="Account SID" value={form.sms.accountSid} onChange={(e) => setForm((prev) => ({ ...prev, sms: { ...prev.sms, accountSid: e.target.value } }))} placeholder={(settingsMap.get("sms")?.config.accountSid as string) || ""} />
          <Input label="Auth Token" type="password" value={form.sms.authToken} onChange={(e) => setForm((prev) => ({ ...prev, sms: { ...prev.sms, authToken: e.target.value } }))} placeholder={(settingsMap.get("sms")?.config.authToken as string) || ""} />
          <Input label="From Number" value={form.sms.fromNumber} onChange={(e) => setForm((prev) => ({ ...prev, sms: { ...prev.sms, fromNumber: e.target.value } }))} placeholder={(settingsMap.get("sms")?.config.fromNumber as string) || "+15551234567"} />
          <div className="flex gap-2 justify-end">
            <Button
              variant="secondary"
              className="gap-1.5"
              onClick={() => testMutation.mutate("sms")}
              loading={testMutation.isPending && testMutation.variables === "sms"}
            >
              <ShieldCheck className="w-3.5 h-3.5" />
              Test
            </Button>
            <Button
              onClick={() => saveMutation.mutate({
                provider: "sms",
                config: {
                  accountSid: form.sms.accountSid || undefined,
                  authToken: form.sms.authToken || undefined,
                  fromNumber: form.sms.fromNumber || undefined,
                },
              })}
              loading={saveMutation.isPending && saveMutation.variables?.provider === "sms"}
            >
              Save
            </Button>
          </div>
        </Card>
      </div>
    </div>
  );
}
