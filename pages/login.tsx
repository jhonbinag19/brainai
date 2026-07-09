import { useState, useEffect, FormEvent, useCallback } from "react";
import { useRouter } from "next/router";
import { Loader2, Eye, EyeOff, BrainCircuit, AlertCircle } from "lucide-react";
import { getSupabaseClient } from "@/lib/supabase-client";

type Mode = "signin" | "signup" | "forgot";

// Rate limit config: 30 requests per 5 minutes = ~1 request every 10 seconds
const RATE_LIMIT_MS = 5 * 60 * 1000; // 5 minutes
const COOLDOWN_MS = 10000; // 10 seconds between attempts

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [cooldown, setCooldown] = useState(0);
  const [isRateLimited, setIsRateLimited] = useState(false);
  const [rateLimitCountdown, setRateLimitCountdown] = useState(0);

  // If already logged in, go straight to chat
  useEffect(() => {
    const supabase = getSupabaseClient();
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        router.replace("/");
      } else {
        setCheckingAuth(false);
      }
    }).catch(() => {
      setCheckingAuth(false);
    });
  }, [router]);

  // Check for mode in URL query params
  useEffect(() => {
    if (router.query.mode === 'forgot') {
      setMode('forgot');
    }
  }, [router.query]);

  // Cooldown countdown
  useEffect(() => {
    if (cooldown > 0) {
      const timer = setTimeout(() => setCooldown(cooldown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [cooldown]);

  // Rate limit countdown
  useEffect(() => {
    if (rateLimitCountdown > 0) {
      const timer = setTimeout(() => setRateLimitCountdown(rateLimitCountdown - 1), 1000);
      return () => clearTimeout(timer);
    } else if (rateLimitCountdown === 0 && isRateLimited) {
      setIsRateLimited(false);
    }
  }, [rateLimitCountdown, isRateLimited]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();

    // Check cooldown
    if (cooldown > 0) {
      setError(`Please wait ${cooldown} seconds before trying again.`);
      return;
    }

    // Check rate limit
    if (isRateLimited) {
      const minutes = Math.ceil(rateLimitCountdown / 60);
      setError(`Too many attempts. Please wait ${minutes} minute${minutes > 1 ? 's' : ''}.`);
      return;
    }

    setError(null);
    setLoading(true);

    const supabase = getSupabaseClient();

    if (mode === "signup") {
      // Use custom API route that sends Mailgun confirmation email
      const response = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });

      const result = await response.json();

      if (!response.ok) {
        if (result.error?.includes("rate limit") || result.error?.includes("exceeded")) {
          setIsRateLimited(true);
          setRateLimitCountdown(RATE_LIMIT_MS / 1000);
          setError("Too many sign-up attempts. Please wait a few minutes.");
        } else if (result.error?.includes("already") || result.error?.includes("registered")) {
          setError("An account with this email already exists. Please sign in instead.");
        } else {
          setError(result.error || "Sign-up failed. Please try again.");
        }
        setCooldown(COOLDOWN_MS / 1000);
      } else {
        // Success - show message about email confirmation
        setError(null);
        setMode("signin");
        // Show success message
        setEmail(""); // Clear email for security
        setPassword(""); // Clear password
        // Use a timeout to show success message
        setTimeout(() => {
          alert("Account created! Please check your email to confirm your account.");
        }, 100);
      }
    } else if (mode === "forgot") {
      // Request password reset
      const response = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      });

      const result = await response.json();

      if (!response.ok) {
        if (result.error?.includes("rate limit") || result.error?.includes("exceeded")) {
          setIsRateLimited(true);
          setRateLimitCountdown(RATE_LIMIT_MS / 1000);
          setError("Too many attempts. Please wait a few minutes.");
        } else {
          setError(result.error || "Failed to send reset email. Please try again.");
        }
        setCooldown(COOLDOWN_MS / 1000);
      } else {
        // Success - show message about email
        setError(null);
        setEmail("");
        setTimeout(() => {
          alert("Password reset email sent! Please check your inbox to reset your password.");
          setMode("signin");
        }, 100);
      }
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        if (error.message.includes("rate limit") || error.message.includes("exceeded") || error.message.includes("over limit")) {
          setIsRateLimited(true);
          setRateLimitCountdown(RATE_LIMIT_MS / 1000);
          setError("Too many sign-in attempts. Please wait a few minutes.");
        } else if (error.message.includes("Invalid") || error.message.includes("credentials")) {
          setError("Incorrect email or password.");
          setCooldown(COOLDOWN_MS / 1000);
        } else {
          setError(error.message);
          setCooldown(COOLDOWN_MS / 1000);
        }
      } else {
        router.replace("/");
      }
    }

    setLoading(false);
  }

  if (checkingAuth) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center px-4">
        <Loader2 className="w-6 h-6 text-violet-500 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="flex flex-col items-center mb-8 gap-3">
          <div className="w-12 h-12 rounded-2xl bg-violet-600 flex items-center justify-center shadow-lg shadow-violet-900/40">
            <BrainCircuit className="w-6 h-6 text-white" />
          </div>
          <div className="text-center">
            <h1 className="text-xl font-bold text-white tracking-tight">Nuno AI</h1>
            <p className="text-sm text-zinc-500 mt-0.5">
              {mode === "signin" ? "Sign in to your account" :
               mode === "signup" ? "Create your account" :
               "Reset your password"}
            </p>
          </div>
        </div>

        {/* Card */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 shadow-xl">
          {/* Rate limit warning */}
          {isRateLimited && (
            <div className="mb-4 bg-amber-950/50 border border-amber-800/50 rounded-xl px-3.5 py-2.5 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
              <div className="text-xs text-amber-300">
                <span className="font-medium">Rate limit active:</span> Please wait{" "}
                {Math.ceil(rateLimitCountdown / 60)} minute{Math.ceil(rateLimitCountdown / 60) > 1 ? 's' : ''} before trying again.
              </div>
            </div>
          )}
          {/* Tab switcher */}
          {mode !== "forgot" && (
            <div className="flex bg-zinc-800/60 rounded-xl p-1 mb-6 gap-1">
              {(["signin", "signup"] as Mode[]).map((m) => (
                <button
                  key={m}
                  onClick={() => { setMode(m); setError(null); }}
                  className={`flex-1 py-1.5 rounded-lg text-sm font-medium transition-colors
                    ${mode === m
                      ? "bg-violet-600 text-white shadow-sm"
                      : "text-zinc-400 hover:text-zinc-200"}`}
                >
                  {m === "signin" ? "Sign In" : "Sign Up"}
                </button>
              ))}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Email */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-zinc-400">Email</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-zinc-500 outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500/30 transition-colors"
              />
            </div>

            {/* Password - only show for signin/signup */}
            {mode !== "forgot" && (
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-zinc-400">Password</label>
                <div className="relative">
                  <input
                    type={showPass ? "text" : "password"}
                    required
                    minLength={6}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-3.5 py-2.5 pr-10 text-sm text-white placeholder-zinc-500 outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500/30 transition-colors"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPass((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300 transition-colors"
                  >
                    {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                {mode === "signup" && (
                  <p className="text-[11px] text-zinc-600">Minimum 6 characters</p>
                )}
              </div>
            )}

            {/* Feedback */}
            {error && !isRateLimited && (
              <div className="bg-rose-950/50 border border-rose-800/50 rounded-xl px-3.5 py-2.5 text-xs text-rose-300">
                {error}
              </div>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={loading || cooldown > 0 || isRateLimited}
              className="w-full bg-violet-600 hover:bg-violet-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium text-sm py-2.5 rounded-xl transition-colors flex items-center justify-center gap-2 mt-2"
            >
              {loading && <Loader2 className="w-4 h-4 animate-spin" />}
              {cooldown > 0 ? `Wait ${cooldown}s...` :
               mode === "signin" ? "Sign In" :
               mode === "signup" ? "Create Account" :
               "Send Reset Link"}
            </button>
          </form>

          {/* Forgot password link */}
          {mode === "signin" && (
            <div className="text-center mt-4">
              <button
                type="button"
                onClick={() => { setMode("forgot"); setError(null); setEmail(""); setPassword(""); }}
                className="text-xs text-violet-400 hover:text-violet-300 transition-colors"
              >
                Forgot your password?
              </button>
            </div>
          )}

          {/* Back to signin link */}
          {mode === "forgot" && (
            <div className="text-center mt-4">
              <button
                type="button"
                onClick={() => { setMode("signin"); setError(null); setEmail(""); setPassword(""); }}
                className="text-xs text-violet-400 hover:text-violet-300 transition-colors"
              >
                ← Back to sign in
              </button>
            </div>
          )}
        </div>

        <p className="text-center text-xs text-zinc-600 mt-4">
          Powered by YouTube Brain RAG
        </p>
      </div>
    </div>
  );
}
