import React, { createContext, useContext, useEffect, useState } from 'react';
import {
  subscribeToAuthState,
  loginWithEmail,
  registerWithEmail,
  sendPasswordReset,
  sendVerification,
  logoutUser,
  getCurrentIdToken,
  isDevMode,
  getFirebaseConfigStatus,
} from '../services/firebase';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [firebaseStatus] = useState(getFirebaseConfigStatus());

  useEffect(() => {
    const unsubscribe = subscribeToAuthState((currentUser) => {
      setUser(currentUser);
      setLoading(false);
    });
    return () => {
      if (typeof unsubscribe === 'function') unsubscribe();
    };
  }, []);

  const signIn = async (email, password) => {
    const loggedUser = await loginWithEmail(email, password);
    setUser(loggedUser);
    return loggedUser;
  };

  const signUp = async (email, password, displayName) => {
    const newUser = await registerWithEmail(email, password, displayName);
    setUser(newUser);
    return newUser;
  };

  const signOut = async () => {
    await logoutUser();
    setUser(null);
  };

  const resetPassword = async (email) => {
    return sendPasswordReset(email);
  };

  const resendVerification = async () => {
    return sendVerification();
  };

  const getIdToken = async () => {
    return getCurrentIdToken();
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        signIn,
        signUp,
        signOut,
        resetPassword,
        resendVerification,
        getIdToken,
        isDevMode,
        firebaseStatus,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
