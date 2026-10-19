import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getAuth,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  sendEmailVerification,
  signOut as fbSignOut,
  onAuthStateChanged,
  updateProfile,
} from 'firebase/auth';

// ── Firebase Configuration from Environment ──────────────────────────────────
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || '',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || '',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || '',
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || '',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '',
  appId: import.meta.env.VITE_FIREBASE_APP_ID || '',
};

// Determine if real Firebase config is provided (not empty or dummy)
const isConfigured = Boolean(
  firebaseConfig.apiKey &&
  firebaseConfig.apiKey !== 'placeholder' &&
  !firebaseConfig.apiKey.includes('your-') &&
  firebaseConfig.projectId &&
  firebaseConfig.projectId !== 'placeholder'
);

const devAuthSetting = import.meta.env.VITE_DEV_AUTH;
const forceDevAuth = devAuthSetting === 'true' || (!isConfigured && devAuthSetting !== 'false');

let app = null;
let realAuth = null;

if (!forceDevAuth && isConfigured) {
  try {
    app = getApps().length ? getApp() : initializeApp(firebaseConfig);
    realAuth = getAuth(app);
  } catch {
    console.error('[Firebase] Initialization failed. Check the Firebase environment configuration.');
  }
}

// ── DEV_AUTH Mock State ───────────────────────────────────────────────────────
const DEV_STORAGE_KEY = 'flowml_dev_auth_user';
const DEV_USERS_KEY = 'flowml_registered_users';

const DEFAULT_OFFLINE_DEV_USER = {
  uid: 'desktop_offline_user',
  email: 'desktop.user@flowml.local',
  displayName: 'Desktop User',
  emailVerified: true,
  photoURL: null,
  isDev: true,
  createdAt: new Date().toISOString(),
};

function getStoredDevUser() {
  try {
    const raw = localStorage.getItem(DEV_STORAGE_KEY);
    if (!raw) {
      if (forceDevAuth) {
        localStorage.setItem(DEV_STORAGE_KEY, JSON.stringify(DEFAULT_OFFLINE_DEV_USER));
        return DEFAULT_OFFLINE_DEV_USER;
      }
      return null;
    }
    return JSON.parse(raw);
  } catch {
    return forceDevAuth ? DEFAULT_OFFLINE_DEV_USER : null;
  }
}

function setStoredDevUser(u) {
  if (u) {
    localStorage.setItem(DEV_STORAGE_KEY, JSON.stringify(u));
  } else {
    localStorage.removeItem(DEV_STORAGE_KEY);
  }
}

function getStoredUsers() {
  try {
    const raw = localStorage.getItem(DEV_USERS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveStoredUsers(users) {
  localStorage.setItem(DEV_USERS_KEY, JSON.stringify(users));
}

// Dev subscribers
const devAuthListeners = new Set();
let currentDevUser = getStoredDevUser();

function notifyDevListeners(user) {
  currentDevUser = user;
  setStoredDevUser(user);
  devAuthListeners.forEach((cb) => cb(user));
}

// ── Public Auth Methods ───────────────────────────────────────────────────────

export const isDevMode = forceDevAuth;

export function getCurrentUserId() {
  return forceDevAuth ? currentDevUser?.uid ?? null : realAuth?.currentUser?.uid ?? null;
}

function requireFirebaseAuth() {
  if (!realAuth) {
    throw new Error('Firebase authentication is unavailable. Check your Firebase environment configuration.');
  }
  return realAuth;
}

export const getFirebaseConfigStatus = () => ({
  isConfigured,
  isDevMode: forceDevAuth,
  projectId: firebaseConfig.projectId || 'dev-local-project',
  hasApiKey: Boolean(firebaseConfig.apiKey),
});

/**
 * Sign in with email & password
 */
export async function loginWithEmail(email, password) {
  if (!forceDevAuth) {
    const cred = await signInWithEmailAndPassword(requireFirebaseAuth(), email, password);
    return cred.user;
  }

  // Dev Mock
  const users = getStoredUsers();
  const existing = users.find((u) => u.email.toLowerCase() === email.toLowerCase());

  if (!existing) {
    throw new Error('No account exists for this email. Create an account first.');
  }
  if (existing && existing.password !== password) {
    throw new Error('Invalid credentials. Password does not match.');
  }

  const user = {
    uid: existing?.uid || `dev-user-${email.replace(/[^a-zA-Z0-9]/g, '_')}`,
    email,
    displayName: existing?.displayName || email.split('@')[0],
    emailVerified: existing?.emailVerified ?? true,
    photoURL: null,
    isDev: true,
    createdAt: existing?.createdAt || new Date().toISOString(),
  };

  notifyDevListeners(user);
  return user;
}

/**
 * Register a new user
 */
export async function registerWithEmail(email, password, displayName = '') {
  if (!forceDevAuth) {
    const cred = await createUserWithEmailAndPassword(requireFirebaseAuth(), email, password);
    if (displayName) {
      await updateProfile(cred.user, { displayName });
    }
    await sendEmailVerification(cred.user);
    return cred.user;
  }

  // Dev Mock
  const users = getStoredUsers();
  if (users.some((u) => u.email.toLowerCase() === email.toLowerCase())) {
    throw new Error('An account with this email already exists.');
  }

  const newUser = {
    uid: `user_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    email,
    password,
    displayName: displayName || email.split('@')[0],
    emailVerified: false,
    createdAt: new Date().toISOString(),
    isDev: true,
  };

  users.push(newUser);
  saveStoredUsers(users);

  const sessionUser = {
    uid: newUser.uid,
    email: newUser.email,
    displayName: newUser.displayName,
    emailVerified: false,
    isDev: true,
  };

  notifyDevListeners(sessionUser);

  // Send branded verification email from flowmlstudio@gmail.com
  try {
    const apiBase = import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000';
    fetch(`${apiBase}/api/auth/send-verification`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: newUser.email, user_id: newUser.uid, app_url: window.location.origin }),
    }).catch((err) => console.warn('Email verification dispatch:', err));
  } catch (err) {
    console.warn('Email dispatch failed:', err);
  }

  return sessionUser;
}

/**
 * Reset password — dispatches reset instructions from flowmlstudio@gmail.com
 */
export async function sendPasswordReset(email) {
  try {
    const apiBase = import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000';
    await fetch(`${apiBase}/api/auth/send-password-reset`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, app_url: window.location.origin }),
    });
  } catch (err) {
    console.warn('Backend password reset email warning:', err);
  }

  if (!forceDevAuth) {
    return sendPasswordResetEmail(requireFirebaseAuth(), email);
  }
  return { success: true, email, sender: 'flowmlstudio@gmail.com' };
}

/**
 * Resend email verification — dispatches link from flowmlstudio@gmail.com
 */
export async function sendVerification(targetEmail = null) {
  const email = targetEmail || currentDevUser?.email || realAuth?.currentUser?.email;
  const uid = currentDevUser?.uid || realAuth?.currentUser?.uid || 'user';
  let emailResult = null;

  if (email) {
    try {
      const apiBase = import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000';
      const resp = await fetch(`${apiBase}/api/auth/send-verification`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, user_id: uid, app_url: window.location.origin }),
      });
      emailResult = await resp.json();
    } catch (err) {
      console.warn('Backend verification dispatch warning:', err);
    }
  }

  if (!forceDevAuth) {
    const auth = requireFirebaseAuth();
    if (!auth.currentUser) throw new Error('Sign in before requesting email verification.');
    return sendEmailVerification(auth.currentUser);
  }

  return { success: true, sender: 'flowmlstudio@gmail.com', ...emailResult };
}

/**
 * Mark user email as verified upon token confirmation
 */
export function markUserEmailVerified(email = null) {
  if (currentDevUser && (!email || currentDevUser.email.toLowerCase() === email.toLowerCase())) {
    currentDevUser.emailVerified = true;
    const users = getStoredUsers();
    const idx = users.findIndex((u) => u.email.toLowerCase() === currentDevUser.email.toLowerCase());
    if (idx !== -1) {
      users[idx].emailVerified = true;
      saveStoredUsers(users);
    }
    notifyDevListeners({ ...currentDevUser });
  }
}

/**
 * Sign out
 */
export async function logoutUser() {
  if (!forceDevAuth) {
    return fbSignOut(requireFirebaseAuth());
  }
  notifyDevListeners(null);
}

/**
 * Get current Auth ID token for API calls
 */
export async function getCurrentIdToken() {
  if (!forceDevAuth) {
    return realAuth?.currentUser ? realAuth.currentUser.getIdToken() : null;
  }
  return currentDevUser?.uid || 'desktop_offline_user';
}

/**
 * Subscribe to auth state changes
 */
export function subscribeToAuthState(callback) {
  if (!forceDevAuth && realAuth) {
    return onAuthStateChanged(realAuth, (user) => {
      callback(user);
    });
  }

  if (!forceDevAuth) {
    callback(null);
    return () => {};
  }

  // Dev mock subscription
  devAuthListeners.add(callback);
  callback(currentDevUser);
  return () => {
    devAuthListeners.delete(callback);
  };
}
