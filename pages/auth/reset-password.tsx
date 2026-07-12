import { useState, useEffect, FormEvent } from 'react';
import { useRouter } from 'next/router';
import { Loader2, Eye, EyeOff, BrainCircuit, CheckCircle, XCircle, Lock, AlertTriangle } from 'lucide-react';
import { getSupabaseClient } from '@/lib/supabase-client';

export default function ResetPasswordPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPass, setShowPass] = useState(false);
  const [showConfirmPass, setShowConfirmPass] = useState(false);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [checkingToken, setCheckingToken] = useState(true);
  const [hasValidToken, setHasValidToken] = useState(false);
  const [email, setEmail] = useState('');

  useEffect(() => {
    const verifyToken = async () => {
      const { token } = router.query;

      if (!token || typeof token !== 'string') {
        setError('Invalid or expired reset link. Please request a new password reset.');
        setCheckingToken(false);
        return;
      }

      try {
        // Verify token with backend
        const response = await fetch('/api/auth/verify-reset-token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token }),
        });

        const result = await response.json();

        if (!response.ok || !result.valid) {
          setError('Invalid or expired reset link. Please request a new password reset.');
        } else {
          setHasValidToken(true);
          setEmail(result.email || '');
        }
      } catch (err) {
        setError('Failed to verify reset link. Please request a new password reset.');
      }

      setCheckingToken(false);
    };

    if (router.isReady) {
      verifyToken();
    }
  }, [router.isReady, router.query]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();

    if (!hasValidToken) {
      setError('Invalid session. Please request a new password reset link.');
      return;
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters long.');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setError(null);
    setLoading(true);

    const supabase = getSupabaseClient();

    try {
      // Update the user's password using admin API
      const { token } = router.query;

      const response = await fetch('/api/auth/update-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password }),
      });

      const result = await response.json();

      if (!response.ok) {
        setError(result.error || 'Failed to update password. Please try again.');
      } else {
        setSuccess(true);
        // Redirect to login after 2 seconds
        setTimeout(() => {
          router.push('/login');
        }, 2000);
      }
    } catch (err) {
      setError('An error occurred while updating your password. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  if (checkingToken) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center px-4">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-6 h-6 text-violet-500 animate-spin" />
          <p className="text-sm text-zinc-500">Verifying reset link...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="flex flex-col items-center mb-8 gap-3">
          <div className="w-12 h-12 rounded-2xl bg-violet-600 flex items-center justify-center shadow-lg shadow-violet-900/40">
            {success ? (
              <CheckCircle className="w-6 h-6 text-white" />
            ) : error && !hasValidToken ? (
              <AlertTriangle className="w-6 h-6 text-white" />
            ) : (
              <Lock className="w-6 h-6 text-white" />
            )}
          </div>
          <div className="text-center">
            <h1 className="text-xl font-bold text-white tracking-tight">Nuno AI</h1>
            <p className="text-sm text-zinc-500 mt-0.5">
              {success ? 'Password Updated!' :
               error && !hasValidToken ? 'Reset Link Invalid' :
               'Reset Your Password'}
            </p>
          </div>
        </div>

        {/* Card */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 shadow-xl">
          {success ? (
            <div className="text-center space-y-4">
              <div className="w-12 h-12 rounded-full bg-green-900/40 flex items-center justify-center mx-auto">
                <CheckCircle className="w-6 h-6 text-green-400" />
              </div>
              <p className="text-sm text-zinc-300">
                Your password has been successfully updated. Redirecting to login...
              </p>
            </div>
          ) : error && !hasValidToken ? (
            <div className="text-center space-y-4">
              <div className="w-12 h-12 rounded-full bg-rose-900/40 flex items-center justify-center mx-auto">
                <XCircle className="w-6 h-6 text-rose-400" />
              </div>
              <p className="text-sm text-rose-300">{error}</p>
              <div className="flex flex-col gap-2">
                <button
                  onClick={() => router.push('/login')}
                  className="text-xs text-violet-400 hover:text-violet-300 transition-colors"
                >
                  Return to Sign In
                </button>
                <button
                  onClick={() => router.push('/login?mode=forgot')}
                  className="text-xs text-zinc-500 hover:text-zinc-400 transition-colors"
                >
                  Request New Reset Link
                </button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* New Password */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-zinc-400">New Password</label>
                <div className="relative">
                  <input
                    type={showPass ? 'text' : 'password'}
                    required
                    minLength={6}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter new password"
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
                <p className="text-[11px] text-zinc-600">Minimum 6 characters</p>
              </div>

              {/* Confirm Password */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-zinc-400">Confirm New Password</label>
                <div className="relative">
                  <input
                    type={showConfirmPass ? 'text' : 'password'}
                    required
                    minLength={6}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Confirm new password"
                    className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-3.5 py-2.5 pr-10 text-sm text-white placeholder-zinc-500 outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500/30 transition-colors"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPass((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300 transition-colors"
                  >
                    {showConfirmPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Error Message */}
              {error && (
                <div className="bg-rose-950/50 border border-rose-800/50 rounded-xl px-3.5 py-2.5 text-xs text-rose-300">
                  {error}
                </div>
              )}

              {/* Submit */}
              <button
                type="submit"
                disabled={loading || !password || !confirmPassword}
                className="w-full bg-violet-600 hover:bg-violet-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium text-sm py-2.5 rounded-xl transition-colors flex items-center justify-center gap-2 mt-2"
              >
                {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                Update Password
              </button>
            </form>
          )}
        </div>

        <p className="text-center text-xs text-zinc-600 mt-4">
          Powered by YouTube Brain RAG
        </p>
      </div>
    </div>
  );
}
