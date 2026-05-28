import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

type Restaurant = {
  id: string;
  name: string;
  slug: string;
  logo_url: string | null;
  primary_color: string | null;
  accent_color: string | null;
  phone: string | null;
  address: string | null;
};

interface AuthState {
  session: Session | null;
  user: User | null;
  restaurant: Restaurant | null;
  loading: boolean;
  refreshRestaurant: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthCtx = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session,    setSession]    = useState<Session | null>(null);
  const [restaurant, setRestaurant] = useState<Restaurant | null>(null);
  const [loading,    setLoading]    = useState(true);

  const loadRestaurant = async (userId: string) => {
    const { data } = await supabase
      .from("restaurants")
      .select("id,name,slug,logo_url,primary_color,accent_color,phone,address")
      .eq("owner_id", userId)
      .maybeSingle();
    setRestaurant(data ?? null);
  };

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((_e, sess) => {
      setSession(sess);
      if (sess?.user) setTimeout(() => void loadRestaurant(sess.user.id), 0);
      else setRestaurant(null);
    });
    supabase.auth.getSession().then(async ({ data }) => {
      setSession(data.session);
      if (data.session?.user) await loadRestaurant(data.session.user.id);
      setLoading(false);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const value = useMemo<AuthState>(() => ({
    session,
    user: session?.user ?? null,
    restaurant,
    loading,
    refreshRestaurant: async () => { if (session?.user) await loadRestaurant(session.user.id); },
    signOut: async () => { await supabase.auth.signOut(); },
  }), [session, restaurant, loading]);

  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthCtx);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
