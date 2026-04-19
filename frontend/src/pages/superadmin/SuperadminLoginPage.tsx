import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useSuperadminStore } from "../../stores/superadminStore";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { ShieldCheck } from "lucide-react";

export default function SuperadminLoginPage() {
  const navigate = useNavigate();
  const { login } = useSuperadminStore();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await login(email, password);
      navigate("/superadmin/dashboard");
    } catch {
      setError("Invalid credentials. Please check your email and password.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-page flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="w-12 h-12 bg-primary-700 flex items-center justify-center mx-auto mb-3">
            <ShieldCheck className="w-6 h-6 text-white" />
          </div>
          <h1 className="text-lg font-bold text-ink">Platform Admin</h1>
          <p className="text-sm text-muted mt-1">Sign in to your superadmin account</p>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4 bg-panel border border-stroke p-6">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-3 py-2">
              {error}
            </div>
          )}
          <Input
            label="Email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoFocus
          />
          <Input
            label="Password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          <Button type="submit" loading={loading} className="w-full">
            Sign In
          </Button>
        </form>
      </div>
    </div>
  );
}
