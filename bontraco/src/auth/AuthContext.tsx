import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type PropsWithChildren,
} from "react";
import type { Session, SupabaseClient, User } from "@supabase/supabase-js";
import { withAuthRequestDeadline } from "../lib/auth-request-deadline";
import { config } from "../lib/config";
import { getSupabase } from "../lib/supabase";

type AuthState = {
  loading: boolean;
  session: Session | null;
  user: User | null;
  configured: boolean;
  demoMode: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, fullName: string) => Promise<void>;
  requestPasswordReset: (email: string) => Promise<void>;
  updatePassword: (password: string) => Promise<void>;
  signOut: () => Promise<void>;
};

export const initialSessionTimeoutMs = 8_000;

const AuthContext = createContext<AuthState | null>(null);

async function runAuthRequest(
  operation: (supabase: SupabaseClient) => PromiseLike<{ error: unknown }>,
  allowMissingClient = false,
) {
  await withAuthRequestDeadline(
    (async () => {
      const supabase = await getSupabase();
      if (!supabase) {
        if (allowMissingClient) return;
        throw new Error("Authentication is not configured yet.");
      }
      const { error } = await operation(supabase);
      if (error) throw error;
    })(),
  );
}

export function AuthProvider({ children }: PropsWithChildren) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(config.supabaseConfigured);

  useEffect(() => {
    let active = true;
    let unsubscribe: (() => void) | undefined;
    let sessionTimer: ReturnType<typeof setTimeout> | undefined;
    void getSupabase()
      .then((supabase) => {
        if (!active) return;
        if (!supabase) {
          setLoading(false);
          return;
        }

        sessionTimer = setTimeout(() => {
          if (!active) return;
          console.error("Unable to restore the session before the safety deadline.");
          setLoading(false);
        }, initialSessionTimeoutMs);

        try {
          const authListener = supabase.auth.onAuthStateChange((_event, nextSession) => {
            if (!active) return;
            if (sessionTimer) clearTimeout(sessionTimer);
            setSession(nextSession);
            setLoading(false);
          });
          unsubscribe = () => authListener.data.subscription.unsubscribe();
        } catch {
          if (sessionTimer) clearTimeout(sessionTimer);
          console.error("Unable to subscribe to authentication state.");
          setLoading(false);
        }
      })
      .catch(() => {
        if (!active) return;
        console.error("Unable to initialize authentication.");
        setLoading(false);
      });

    return () => {
      active = false;
      if (sessionTimer) clearTimeout(sessionTimer);
      unsubscribe?.();
    };
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    await runAuthRequest((supabase) => supabase.auth.signInWithPassword({ email, password }));
  }, []);

  const signUp = useCallback(async (email: string, password: string, fullName: string) => {
    await runAuthRequest((supabase) =>
      supabase.auth.signUp({
        email,
        password,
        options: {
          data: { full_name: fullName },
          emailRedirectTo: `${window.location.origin}/app`,
        },
      }),
    );
  }, []);

  const requestPasswordReset = useCallback(async (email: string) => {
    await runAuthRequest((supabase) =>
      supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      }),
    );
  }, []);

  const updatePassword = useCallback(async (password: string) => {
    await runAuthRequest((supabase) => supabase.auth.updateUser({ password }));
  }, []);

  const signOut = useCallback(async () => {
    await runAuthRequest((supabase) => supabase.auth.signOut(), true);
  }, []);

  const value = useMemo<AuthState>(
    () => ({
      loading,
      session,
      user: session?.user ?? null,
      configured: config.supabaseConfigured,
      demoMode: config.demoMode,
      signIn,
      signUp,
      requestPasswordReset,
      updatePassword,
      signOut,
    }),
    [loading, requestPasswordReset, session, signIn, signOut, signUp, updatePassword],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth must be used inside AuthProvider");
  return value;
}
