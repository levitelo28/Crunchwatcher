"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { isSupabaseConfigured, supabase } from "./supabaseClient";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setLoading(false);
      return undefined;
    }

    let mounted = true;
    supabase.auth.getSession().then(({ data, error: sessionError }) => {
      if (!mounted) return;
      if (sessionError) setError(sessionError.message);
      setSession(data.session);
      setLoading(false);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      setLoading(false);
    });

    return () => {
      mounted = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  async function signUpWithEmail(email, password) {
    setError("");
    const { data, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/`
      }
    });
    if (signUpError) {
      setError(friendlyAuthError(signUpError.message));
      return { ok: false, needsConfirmation: false };
    }
    return { ok: true, needsConfirmation: !data.session };
  }

  async function signInWithEmail(email, password) {
    setError("");
    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
    if (signInError) {
      setError(friendlyAuthError(signInError.message));
      return false;
    }
    return true;
  }

  async function signOut() {
    await supabase.auth.signOut();
  }

  const value = useMemo(
    () => ({
      user: session?.user || null,
      session,
      loading,
      error,
      configured: isSupabaseConfigured,
      signUpWithEmail,
      signInWithEmail,
      signOut
    }),
    [session, loading, error]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth must be used inside AuthProvider");
  return value;
}

function friendlyAuthError(message = "") {
  const lower = message.toLowerCase();
  if (lower.includes("invalid login") || lower.includes("invalid credentials")) {
    return "Invalid login. Check your email and password.";
  }
  if (lower.includes("already registered") || lower.includes("already been registered") || lower.includes("user already")) {
    return "Email already registered. Try logging in instead.";
  }
  if (lower.includes("password") && (lower.includes("short") || lower.includes("least"))) {
    return "Password too short. Use at least 8 characters.";
  }
  if (lower.includes("confirm") || lower.includes("not confirmed")) {
    return "Email confirmation required. Check your inbox, then log in.";
  }
  if (lower.includes("email") && lower.includes("required")) return "Email is required.";
  return message || "Something went wrong. Please try again.";
}
