import { useState } from "react";
import { Shield, Loader2, Eye, EyeOff, Lock, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface Props {
  onLogin: (username: string, password: string) => Promise<boolean>;
  onRegister: (username: string, password: string) => Promise<boolean>;
  loading: boolean;
  error: string | null;
}

export default function AuthPage({ onLogin, onRegister, loading, error }: Props) {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);

    if (!username.trim() || !password) return;

    if (mode === "register") {
      if (password !== confirmPassword) {
        setLocalError("Passwords do not match");
        return;
      }
      if (password.length < 6) {
        setLocalError("Password must be at least 6 characters");
        return;
      }
      await onRegister(username.trim(), password);
    } else {
      await onLogin(username.trim(), password);
    }
  };

  const displayError = localError ?? error;

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
      {/* Ambient glow */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[400px] bg-cyan-500/5 rounded-full blur-3xl" />
      </div>

      <div className="relative w-full max-w-sm">
        {/* Logo */}
        <div className="flex flex-col items-center gap-3 mb-8">
          <div className="bg-cyan-500/10 p-3 rounded-xl border border-cyan-500/20 shadow-lg shadow-cyan-500/10">
            <Shield className="w-8 h-8 text-cyan-400" />
          </div>
          <div className="text-center">
            <h1 className="font-bold text-2xl tracking-tight text-white flex items-center gap-2 justify-center">
              SentinAI
              <span className="text-xs font-mono font-normal bg-cyan-500/20 text-cyan-400 px-2 py-0.5 rounded border border-cyan-500/30">v0.1.0</span>
            </h1>
            <p className="text-xs text-slate-400 font-mono mt-1">MULTI-MODEL AI GATEWAY</p>
          </div>
        </div>

        {/* Card */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl shadow-2xl shadow-black/60 backdrop-blur-sm p-6">
          {/* Tab toggle */}
          <div className="flex bg-slate-950 rounded-lg border border-slate-800 p-0.5 mb-6">
            <button
              type="button"
              onClick={() => { setMode("login"); setLocalError(null); }}
              className={`flex-1 py-1.5 rounded text-xs font-mono transition-colors ${mode === "login" ? "bg-cyan-600 text-white shadow" : "text-slate-400 hover:text-slate-200"}`}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => { setMode("register"); setLocalError(null); }}
              className={`flex-1 py-1.5 rounded text-xs font-mono transition-colors ${mode === "register" ? "bg-cyan-600 text-white shadow" : "text-slate-400 hover:text-slate-200"}`}
            >
              Register
            </button>
          </div>

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            {/* Username */}
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="username" className="text-xs font-mono text-slate-400 uppercase tracking-wider">
                Username
              </Label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500 pointer-events-none" />
                <Input
                  id="username"
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="your_username"
                  autoComplete="username"
                  required
                  className="bg-slate-950 border-slate-700 text-slate-200 font-mono text-sm pl-9 focus-visible:ring-cyan-500/50 placeholder:text-slate-600"
                />
              </div>
            </div>

            {/* Password */}
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="password" className="text-xs font-mono text-slate-400 uppercase tracking-wider">
                Password
              </Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500 pointer-events-none" />
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  autoComplete={mode === "register" ? "new-password" : "current-password"}
                  required
                  className="bg-slate-950 border-slate-700 text-slate-200 font-mono text-sm pl-9 pr-10 focus-visible:ring-cyan-500/50 placeholder:text-slate-600"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors"
                >
                  {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>

            {/* Confirm password (register only) */}
            {mode === "register" && (
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="confirm-password" className="text-xs font-mono text-slate-400 uppercase tracking-wider">
                  Confirm Password
                </Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500 pointer-events-none" />
                  <Input
                    id="confirm-password"
                    type={showPassword ? "text" : "password"}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="••••••••"
                    autoComplete="new-password"
                    required
                    className="bg-slate-950 border-slate-700 text-slate-200 font-mono text-sm pl-9 focus-visible:ring-cyan-500/50 placeholder:text-slate-600"
                  />
                </div>
              </div>
            )}

            {/* Error */}
            {displayError && (
              <div className="rounded-lg border border-rose-500/40 bg-rose-950/30 px-3 py-2 text-xs font-mono text-rose-400">
                {displayError}
              </div>
            )}

            <Button
              type="submit"
              disabled={loading || !username.trim() || !password}
              className="bg-cyan-600 hover:bg-cyan-500 text-white font-mono text-sm mt-1 h-9"
            >
              {loading ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> {mode === "register" ? "Creating account…" : "Signing in…"}</>
              ) : (
                mode === "register" ? "Create Account" : "Sign In"
              )}
            </Button>
          </form>

          {mode === "login" && (
            <p className="text-center text-[11px] font-mono text-slate-600 mt-4">
              No account?{" "}
              <button type="button" onClick={() => setMode("register")} className="text-cyan-500 hover:text-cyan-400 transition-colors">
                Register here
              </button>
            </p>
          )}
        </div>

        <p className="text-center text-[10px] font-mono text-slate-700 mt-4">
          Each account has an isolated rate limit, cost tracker &amp; traffic log
        </p>
      </div>
    </div>
  );
}
