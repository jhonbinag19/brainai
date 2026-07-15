import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { Loader2, CheckCircle, XCircle } from 'lucide-react';

export default function ConfirmPage() {
  const router = useRouter();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('');

  useEffect(() => {
    const confirmEmail = async () => {
      const { email, token } = router.query;

      if (!email || typeof email !== 'string' || !token || typeof token !== 'string') {
        setStatus('error');
        setMessage('Invalid confirmation link. Please use the link from your most recent confirmation email, or reset your password to verify your account.');
        return;
      }

      try {
        const res = await fetch('/api/auth/confirm', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, token }),
        });
        const data = await res.json();

        if (res.ok && data.success) {
          setStatus('success');
          setMessage('Email confirmed successfully! You can now sign in to your account.');
        } else {
          setStatus('error');
          setMessage(data.error || 'Failed to confirm email. The link may have expired.');
        }
      } catch {
        setStatus('error');
        setMessage('Failed to confirm email. Please try again.');
      }
    };

    if (router.isReady) {
      confirmEmail();
    }
  }, [router.isReady, router.query]);

  return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-8 shadow-xl text-center">
          {status === 'loading' && (
            <div className="flex flex-col items-center gap-4">
              <Loader2 className="w-12 h-12 text-violet-500 animate-spin" />
              <p className="text-zinc-400">Confirming your email...</p>
            </div>
          )}

          {status === 'success' && (
            <div className="flex flex-col items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-green-900/40 flex items-center justify-center">
                <CheckCircle className="w-6 h-6 text-green-400" />
              </div>
              <h2 className="text-xl font-bold text-white">Email Confirmed!</h2>
              <p className="text-zinc-400">{message}</p>
              <button
                onClick={() => router.push('/login')}
                className="mt-4 bg-violet-600 hover:bg-violet-500 text-white font-medium py-2.5 px-6 rounded-xl transition-colors"
              >
                Go to Sign In
              </button>
            </div>
          )}

          {status === 'error' && (
            <div className="flex flex-col items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-rose-900/40 flex items-center justify-center">
                <XCircle className="w-6 h-6 text-rose-400" />
              </div>
              <h2 className="text-xl font-bold text-white">Confirmation Failed</h2>
              <p className="text-zinc-400">{message}</p>
              <button
                onClick={() => router.push('/login')}
                className="mt-4 bg-violet-600 hover:bg-violet-500 text-white font-medium py-2.5 px-6 rounded-xl transition-colors"
              >
                Back to Sign In
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
