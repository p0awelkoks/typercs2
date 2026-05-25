import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export type Profile = {
  id: string;
  username: string | null;
  avatar_url: string | null;
  points: number;
  onboarded: boolean;
};

type AuthCtx = {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  isAdmin: boolean;
  loading: boolean;
  signInWithDiscord: () => Promise<void>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
};

const AuthContext = createContext<AuthCtx | undefined>(undefined);

function fallbackUsername(id: string) {
  return `user_${id.slice(0, 6)}`;
}

function sanitize(value: any) {
  if (typeof value !== "string") return null;
  const v = value.trim().replace(/[^a-zA-Z0-9_-]/g, "");
  return v.length >= 3 ? v.slice(0, 24) : null;
}

function getUsername(user: User) {
  const m: any = user.user_metadata ?? {};
  return (
    sanitize(
      m.preferred_username ||
        m.global_name ||
        m.name ||
        m.full_name ||
        m.user_name ||
        m.nickname
    ) || fallbackUsername(user.id)
  );
}

function getAvatar(user: User) {
  const m: any = user.user_metadata ?? {};
  return m.avatar_url || m.picture || m.avatar || null;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  const syncProfile = async (u: User) => {
    const metaUsername = getUsername(u);
    const avatar_url = getAvatar(u);
    const fallback = fallbackUsername(u.id);

    const { data: existing } = await supabase
      .from("profiles")
      .select("id, username")
      .eq("id", u.id)
      .maybeSingle();

    const keepExisting =
      existing?.username &&
      existing.username.trim() !== "" &&
      existing.username !== fallback;

    const username = keepExisting ? existing!.username! : metaUsername;

    await supabase.from("profiles").upsert(
      {
        id: u.id,
        username,
        avatar_url,
        onboarded: !!username,
      },
      { onConflict: "id" }
    );
  };

  const loadProfile = async (uid: string) => {
    const [{ data: prof }, { data: role }] = await Promise.all([
      supabase.from("profiles").select("*").eq("id", uid).maybeSingle(),
      supabase.from("user_roles").select("role").eq("user_id", uid).eq("role", "admin").maybeSingle(),
    ]);

    setProfile(prof as Profile | null);
    setIsAdmin(!!role);
  };

  const hydrate = async (sess: Session | null) => {
    setSession(sess);
    const u = sess?.user ?? null;
    setUser(u);

    if (!u) {
      setProfile(null);
      setIsAdmin(false);
      setLoading(false);
      return;
    }

    setLoading(true);

    try {
      await syncProfile(u);

      // 🔥 IMPORTANT: odśwież po upsert (fix “Anonim”)
      const { data } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", u.id)
        .maybeSingle();

      setProfile(data as Profile);

      const { data: role } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", u.id)
        .eq("role", "admin")
        .maybeSingle();

      setIsAdmin(!!role);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      void hydrate(data.session);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_e, sess) => {
      void hydrate(sess);
    });

    return () => sub.subscription.unsubscribe();
  }, []);

  const signInWithDiscord = async () => {
    await supabase.auth.signInWithOAuth({
      provider: "discord",
      options: {
        redirectTo: window.location.origin,
      },
    });
  };

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        profile,
        isAdmin,
        loading,
        signInWithDiscord,
        signOut,
        refreshProfile: async () => {
          if (user) await loadProfile(user.id);
        },
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
