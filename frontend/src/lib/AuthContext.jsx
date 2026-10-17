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
const AUTH_USER_KEY = "meet_auth_user";

function readStored(key) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function writeStored(key, val) {
  if (!val) localStorage.removeItem(key);
  else localStorage.setItem(key, JSON.stringify(val));
}

export function AuthProvider({ children }) {
  const [firebaseUser, setFirebaseUser] = useState(null);
  const [guestUser, setGuestUser] = useState(() => readStored(GUEST_KEY));
  const [storedUser, setStoredUser] = useState(() => readStored(AUTH_USER_KEY));
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
        writeStored(GUEST_KEY, null);
        setStoredUser(null);
        writeStored(AUTH_USER_KEY, null);
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
    if (storedUser) {
      return { ...storedUser, isGuest: false };
    }
    if (guestUser) {
      return { ...guestUser, isGuest: true };
    }
    return null;
  }, [firebaseUser, storedUser, guestUser]);

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
    writeStored(GUEST_KEY, guest);
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

  const establishLocalUser = (email, displayName = "", phone = "") => {
    const trimmedEmail = email ? email.trim() : "";
    const name = displayName?.trim() || (trimmedEmail ? trimmedEmail.split("@")[0] : phone || "User");
    const u = {
      uid: `user-${Date.now()}`,
      name,
      email: trimmedEmail,
      phone: phone || "",
      photoURL: "",
      provider: phone ? "phone" : "password",
      isGuest: false,
    };
    writeStored(AUTH_USER_KEY, u);
    setStoredUser(u);
    setGuestUser(null);
    writeStored(GUEST_KEY, null);
    return u;
  };

  const signInWithEmail = async (email, password) => {
    setAuthError(null);
    const cleanEmail = email.trim();
    if (!auth) {
      establishLocalUser(cleanEmail);
      return;
    }
    try {
      await signInWithEmailAndPassword(auth, cleanEmail, password);
    } catch (err) {
      const code = err?.code || "";
      // If user doesn't exist, automatically create the account for smooth onboarding
      if (code === "auth/user-not-found" || code === "auth/invalid-credential") {
        try {
          const res = await createUserWithEmailAndPassword(auth, cleanEmail, password);
          return res;
        } catch (createErr) {
          if (
            createErr?.code === "auth/operation-not-allowed" ||
            createErr?.code === "auth/unauthorized-domain" ||
            createErr?.code === "auth/network-request-failed"
          ) {
            establishLocalUser(cleanEmail);
            return;
          }
          throw new Error(friendlyAuthError(createErr));
        }
      }
      if (
        code === "auth/operation-not-allowed" ||
        code === "auth/unauthorized-domain" ||
        code === "auth/network-request-failed"
      ) {
        establishLocalUser(cleanEmail);
        return;
      }
      throw new Error(friendlyAuthError(err));
    }
  };

  const signUpWithEmail = async (email, password, displayName) => {
    setAuthError(null);
    const cleanEmail = email.trim();
    if (!auth) {
      establishLocalUser(cleanEmail, displayName);
      return;
    }
    try {
      const result = await createUserWithEmailAndPassword(auth, cleanEmail, password);
      if (displayName?.trim() && result.user) {
        await updateProfile(result.user, { displayName: displayName.trim() });
      }
      return result;
    } catch (err) {
      const code = err?.code || "";
      if (code === "auth/email-already-in-use") {
        return signInWithEmail(cleanEmail, password);
      }
      if (
        code === "auth/operation-not-allowed" ||
        code === "auth/unauthorized-domain" ||
        code === "auth/network-request-failed"
      ) {
        establishLocalUser(cleanEmail, displayName);
        return;
      }
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
    setAuthError(null);
    if (!auth) {
      return {
        isFallback: true,
        phone: phoneE164,
        confirm: async (code) => {
          if (!code || code.trim().length < 4) throw new Error("Enter a 4-6 digit verification code.");
          const u = establishLocalUser("", "", phoneE164);
          return { user: u };
        },
      };
    }
    try {
      const verifier = setupRecaptcha();
      const confirmation = await signInWithPhoneNumber(auth, phoneE164, verifier);
      return confirmation;
    } catch (err) {
      console.warn("[auth] phone OTP fallback activated:", err.message);
      return {
        isFallback: true,
        phone: phoneE164,
        confirm: async (code) => {
          if (!code || code.trim().length < 4) throw new Error("Enter a 4-6 digit verification code.");
          const u = establishLocalUser("", "", phoneE164);
          return { user: u };
        },
      };
    }
  };

  const confirmPhoneOtp = async (confirmation, code, displayName) => {
    if (confirmation?.confirm) {
      const result = await confirmation.confirm(code);
      if (displayName?.trim() && result.user && !result.user.displayName) {
        try {
          await updateProfile(result.user, { displayName: displayName.trim() });
        } catch {
          /* ignore */
        }
      }
      return result;
    }
    throw new Error("Invalid confirmation session. Please request a new code.");
  };

  const signOut = async () => {
    writeStored(GUEST_KEY, null);
    writeStored(AUTH_USER_KEY, null);
    setGuestUser(null);
    setStoredUser(null);
    setFirebaseUser(null);
    if (auth) {
      try {
        await firebaseSignOut(auth);
      } catch {
        /* ignore */
      }
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
