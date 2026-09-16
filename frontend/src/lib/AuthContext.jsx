import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import {
  onAuthStateChanged,
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithPhoneNumber,
  RecaptchaVerifier,
  signOut as firebaseSignOut,
  updateProfile,
} from "firebase/auth";
import {
  auth,
  isFirebaseConfigured,
  googleProvider,
  githubProvider,
  microsoftProvider,
} from "./firebase.js";

const AuthContext = createContext(null);

const GUEST_KEY = "meet_guest_user";

function readGuest() {
  try {
    const raw = localStorage.getItem(GUEST_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function writeGuest(guest) {
  if (!guest) localStorage.removeItem(GUEST_KEY);
  else localStorage.setItem(GUEST_KEY, JSON.stringify(guest));
}

export function AuthProvider({ children }) {
  const [firebaseUser, setFirebaseUser] = useState(null);
  const [guestUser, setGuestUser] = useState(() => readGuest());
  const [loading, setLoading] = useState(isFirebaseConfigured);
  const [authError, setAuthError] = useState(null);

  useEffect(() => {
    if (!isFirebaseConfigured || !auth) {
      setLoading(false);
      return undefined;
    }
    let settled = false;
    const finish = (user) => {
      if (settled) return;
      settled = true;
      setFirebaseUser(user);
      if (user) {
        setGuestUser(null);
        writeGuest(null);
      }
      setLoading(false);
    };
    const unsub = onAuthStateChanged(auth, (user) => finish(user));
    // Don't leave the boot screen hanging if Firebase is slow/blocked.
    const timeout = setTimeout(() => finish(auth.currentUser || null), 8000);
    return () => {
      clearTimeout(timeout);
      unsub();
    };
  }, []);

  const user = useMemo(() => {
    if (firebaseUser) {
      return {
        uid: firebaseUser.uid,
        name:
          firebaseUser.displayName ||
          firebaseUser.email?.split("@")[0] ||
          firebaseUser.phoneNumber ||
          "User",
        email: firebaseUser.email || "",
        phone: firebaseUser.phoneNumber || "",
        photoURL: firebaseUser.photoURL || "",
        provider: firebaseUser.providerData?.[0]?.providerId || "firebase",
        isGuest: false,
      };
    }
    if (guestUser) {
      return { ...guestUser, isGuest: true };
    }
    return null;
  }, [firebaseUser, guestUser]);

  const clearError = () => setAuthError(null);

  const continueAsGuest = (name) => {
    const trimmed = name.trim();
    if (!trimmed) throw new Error("Enter a display name");
    const guest = {
      uid: `guest-${Date.now()}`,
      name: trimmed,
      email: "",
      phone: "",
      photoURL: "",
      provider: "guest",
    };
    writeGuest(guest);
    setGuestUser(guest);
    setAuthError(null);
  };

  const friendlyAuthError = (err) => {
    const code = err?.code || "";
    const map = {
      "auth/invalid-email": "Enter a valid email address.",
      "auth/user-disabled": "This account has been disabled.",
      "auth/user-not-found": "No account found with that email.",
      "auth/wrong-password": "Incorrect password.",
      "auth/invalid-credential": "Incorrect email or password.",
      "auth/email-already-in-use": "An account already exists with that email.",
      "auth/weak-password": "Password must be at least 6 characters.",
      "auth/too-many-requests": "Too many attempts. Try again later.",
      "auth/operation-not-allowed": "Email/password sign-in is not enabled in Firebase.",
      "auth/network-request-failed": "Network error. Check your connection.",
    };
    return map[code] || err?.message || "Authentication failed";
  };

  const signInWithEmail = async (email, password) => {
    if (!auth) throw new Error("Firebase is not configured");
    setAuthError(null);
    try {
      await signInWithEmailAndPassword(auth, email.trim(), password);
    } catch (err) {
      throw new Error(friendlyAuthError(err));
    }
  };

  const signUpWithEmail = async (email, password, displayName) => {
    if (!auth) throw new Error("Firebase is not configured");
    setAuthError(null);
    try {
      const result = await createUserWithEmailAndPassword(auth, email.trim(), password);
      if (displayName?.trim() && result.user) {
        await updateProfile(result.user, { displayName: displayName.trim() });
      }
      return result;
    } catch (err) {
      throw new Error(friendlyAuthError(err));
    }
  };

  const signInWithGoogle = async () => {
    if (!auth) throw new Error("Firebase is not configured");
    setAuthError(null);
    await signInWithPopup(auth, googleProvider);
  };

  const signInWithGithub = async () => {
    if (!auth) throw new Error("Firebase is not configured");
    setAuthError(null);
    await signInWithPopup(auth, githubProvider);
  };

  const signInWithMicrosoft = async () => {
    if (!auth) throw new Error("Firebase is not configured");
    setAuthError(null);
    await signInWithPopup(auth, microsoftProvider);
  };

  const setupRecaptcha = (containerId = "recaptcha-container") => {
    if (!auth) throw new Error("Firebase is not configured");
    if (window.__meetRecaptcha) {
      try {
        window.__meetRecaptcha.clear();
      } catch {
        /* ignore */
      }
      window.__meetRecaptcha = null;
    }
    window.__meetRecaptcha = new RecaptchaVerifier(auth, containerId, {
      size: "invisible",
      callback: () => {},
    });
    return window.__meetRecaptcha;
  };

  const sendPhoneOtp = async (phoneE164) => {
    if (!auth) throw new Error("Firebase is not configured");
    setAuthError(null);
    const verifier = setupRecaptcha();
    const confirmation = await signInWithPhoneNumber(auth, phoneE164, verifier);
    return confirmation;
  };

  const confirmPhoneOtp = async (confirmation, code, displayName) => {
    const result = await confirmation.confirm(code);
    if (displayName?.trim() && result.user && !result.user.displayName) {
      await updateProfile(result.user, { displayName: displayName.trim() });
    }
    return result;
  };

  const signOut = async () => {
    writeGuest(null);
    setGuestUser(null);
    if (auth && firebaseUser) {
      await firebaseSignOut(auth);
    }
  };

  const value = {
    user,
    loading,
    authError,
    setAuthError,
    clearError,
    isFirebaseConfigured,
    continueAsGuest,
    signInWithEmail,
    signUpWithEmail,
    signInWithGoogle,
    signInWithGithub,
    signInWithMicrosoft,
    sendPhoneOtp,
    confirmPhoneOtp,
    signOut,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
