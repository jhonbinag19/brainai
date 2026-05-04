import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import dynamic from "next/dynamic";
import { Loader2 } from "lucide-react";
import { getSupabaseClient } from "@/lib/supabase-client";

const ChatLayout = dynamic(() => import("../components/ChatLayout"), { ssr: false });

export default function Home() {
  const router = useRouter();
  const [checking, setChecking] = useState(true);
  const [authed, setAuthed] = useState(false);

  useEffect(() => {
    const supabase = getSupabaseClient();

    supabase.auth.getSession().then(({ data }) => {
      if (data.session) {
        setAuthed(true);
      } else {
        router.replace("/login");
      }
      setChecking(false);
    });

    // Listen for auth changes (logout from another tab, token expiry)
    const { data: listener } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_OUT") router.replace("/login");
    });

    return () => listener.subscription.unsubscribe();
  }, [router]);

  if (checking) {
    return (
      <div className="flex h-screen items-center justify-center bg-zinc-950">
        <Loader2 className="w-5 h-5 text-violet-500 animate-spin" />
      </div>
    );
  }

  if (!authed) return null;

  return <ChatLayout />;
}
