"use client";

import { createContext, useCallback, useEffect, useState } from "react";
import { api, } from "@/lib/api";
import type { AuthState, RegisterWalletRequest, RegisterResponse, User } from "@/lib/types";

// Ce que le contexte expose a tous les composants enfants
interface AuthContextValue extends AuthState {
  register: (data: RegisterWalletRequest) => Promise<void>;
  logout: () => void;
}

// Valeur par defaut (avant que le provider ne soit monte)
export const AuthContext = createContext<AuthContextValue | null>(null);

// Cle pour stocker le JWT dans localStorage
const TOKEN_KEY = "verivo_token";

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true); // true au demarrage

  // Au montage du composant : verifier si un JWT existe deja
  // Si oui, on le valide en appelant GET /api/auth/me
  useEffect(() => {
    const savedToken = localStorage.getItem(TOKEN_KEY);
    if (!savedToken) {
      setIsLoading(false);
      return;
    }

    setToken(savedToken);

    // Valider le token aupres du backend
    api
      .get<{ user: User }>("/api/auth/me")
      .then((data) => {
        setUser(data.user);
      })
      .catch(() => {
        // Token invalide ou expire → on nettoie
        localStorage.removeItem(TOKEN_KEY);
        setToken(null);
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, []);

  // Inscription : envoie les donnees au backend, stocke le JWT
  const register = useCallback(async (data: RegisterWalletRequest) => {
    const response = await api.post<RegisterResponse>("/api/auth/register", data);

    // Stocker le JWT pour les prochains appels API
    localStorage.setItem(TOKEN_KEY, response.token);
    setToken(response.token);
    setUser(response.user);
  }, []);

  // Deconnexion : nettoie tout
  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY);
    setToken(null);
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isAuthenticated: user !== null,
        isLoading,
        register,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}