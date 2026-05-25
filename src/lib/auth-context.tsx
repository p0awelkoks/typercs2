/**
 * AuthContext — globalny stan autoryzacji.
 */
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

const USERNAME_MIN_LENGTH = 3;
const USERNAME_MAX_LENGTH = 24;

function buildFallbackUsername(userId: string) {
  return `user_${userId.replace(/-/g, "").slice(0, 6)}`;
}

function sanitizeUsername(value: unknown) {
  if (typeof value !== "string") return null;

  const sanitized = value.trim().replace(/[^a-zA-Z0-9_-]/g, "").slice(0, USERNAME_MAX_LENGTH);
  return sanitized.length >= USERNAME_MIN_LENGTH ? sanitized : null;
}

function isGeneratedFallbackUsername(username: string | null | undefined, userId: string) {
  if (!username) return false;

  return username === buildFallbackUsername(userId) || /^user_[a-zA-Z0-9]{6,8}$/.test(username);
}

function getMetadataUsername(user: User) {
  const meta: any = user.user_metadata ?? {};
  return sanitizeUsername(
    meta.preferred_username ??
      meta.global_name ??
      meta.name ??
      meta.full_name ??
      meta.user_name ??
      meta.nickname ??
      meta.custom_claims?.global_name
  );
}

function getMetadataAvatar(user: User) {
  const meta: any = user.user_metadata ?? {};
  const value = meta.avatar_url ?? meta.picture ?? meta.avatar;
  return typeof value === "string" && value.trim() ? value : null;
}

async function getAvailableUsername(baseUsername: string, userId: string) {
  let suffix = 0;

  while (suffix <= 9999) {
    const suffixText = suffix === 0 ? "" : String(suffix);
    const candidate = `${baseUsername.slice(0, USERNAME_MAX_LENGTH - suffixText.length)}${suffixText}`;
    const { data, error } = await supabase
      .from("profiles")
      .select("id")
      .eq("username", candidate)
      .maybeSingle();

    if (error) throw error;
    if (!data || data.id === userId) return candidate;

    suffix += 1;
  }

  return `${buildFallbackUsername(userId)}${Date.now().toString().slice(-2)}`.slice(0, USERNAME_MAX_LENGTH);
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  const syncProfileFromMetadata = async (authUser: User) => {
    const { data: existingProfile, error: profileError } = await supabase
      .from("profiles")
      .select("id, username, avatar_url")
      .eq("id", authUser.id)
      .maybeSingle();

    if (profileError) throw profileError;

    const metadataUsername = getMetadataUsername(authUser);
    const fallbackUsername = buildFallbackUsername(authUser.id);
    const desiredUsernameBase = metadataUsername ?? fallbackUsername;
    const currentUsername = existingProfile?.username?.trim() || null;
    const keepExistingUsername = Boolean(currentUsername) && !isGeneratedFallbackUsername(currentUsername, authUser.id);

    const username = keepExistingUsername
      ? currentUsername
      : await getAvailableUsername(desiredUsernameBase, authUser.id);

    const avatarUrl = existingProfile?.avatar_url || getMetadataAvatar(authUser);

    const { error: upsertError } = await supabase.from("profiles").upsert(
      {
        id: authUser.id,
        username,
        avatar_url: avatarUrl,
        onboarded: Boolean(username),
      },
      { onConflict: "id" }
    );

    if (upsertError) throw upsertError;
  };

  const loadUserData = async (uid: string) => {
    const [{ data: prof, error: profileError }, { data: adminRole, error: roleError }] = await Promise.all([
      supabase.from("profiles").select("*").eq("id", uid).maybeSingle(),
      supabase.from("user_roles").select("role").eq("user_id", uid).eq("role", "admin").maybeSingle(),
    ]);

    if (profileError) throw profileError;
    if (roleError) throw roleError;

    setProfile(prof as Profile | null);
    setIsAdmin(Boolean(adminRole));
  };

  const hydrateUserState = async (sess: Session | null) => {
    setSession(sess);
    setUser(sess?.user ?? null);

    if (!sess?.user) {
      setProfile(null);
      setIsAdmin(false);
      setLoading(false);
      return;
    }

    setLoading(true);

    try {
      await syncProfileFromMetadata(sess.user);
      await loadUserData(sess.user.id);
    } catch (error) {
      console.error("Failed to sync auth profile", error);
      setProfile(null);
      setIsAdmin(false);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((_event, sess) => {
      setTimeout(() => {
        void hydrateUserState(sess);
      }, 0);
    });

    supabase.auth.getSession().then(({ data: { session: sess } }) => {
      void hydrateUserState(sess);
    });

    return () => sub.subscription.unsubscribe();
  }, []);

  const signInWithDiscord = async () => {
    await supabase.auth.signInWithOAuth({
      provider: "discord",
      options: {
        redirectTo: `${window.location.origin}/`,
      },
    });
  };

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  const refreshProfile = async () => {
    if (user) await loadUserData(user.id);
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
        refreshProfile,
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
