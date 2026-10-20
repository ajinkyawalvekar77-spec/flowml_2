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

function getStoredDevUser() {
  try {
    const raw = localStorage.getItem(DEV_STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
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
  return sessionUser;
}

/**
 * Reset password
 */
export async function sendPasswordReset(email) {
  if (!forceDevAuth) {
    return sendPasswordResetEmail(requireFirebaseAuth(), email);
  }
  // Dev Mock — simulates sending email
  await new Promise((r) => setTimeout(r, 600));
  return { success: true, email };
}

/**
 * Resend email verification
 */
export async function sendVerification() {
  if (!forceDevAuth) {
    const auth = requireFirebaseAuth();
    if (!auth.currentUser) throw new Error('Sign in before requesting email verification.');
    return sendEmailVerification(auth.currentUser);
  }
  // Dev Mock — marks verified or sends mock email
  if (currentDevUser) {
    currentDevUser.emailVerified = true;
    notifyDevListeners({ ...currentDevUser });
  }
  return { success: true };
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
  return currentDevUser?.uid ?? null;
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
