"use client";

import { createContext, useCallback, useEffect, useState } from "react";
import { useAccount, useDisconnect } from "wagmi";
import { api } from "@/lib/api";
import type {
  AuthState,
  RegisterWalletRequest,
  RegisterResponse,
  WalletLoginRequest,
  WalletLoginResponse,
  User,
} from "@/lib/types";

interface AuthContextValue extends AuthState {
  register: (data: RegisterWalletRequest) => Promise<void>;
  login: (data: WalletLoginRequest) => Promise<void>;
  logout: () => void;
}

export const AuthContext = createContext<AuthContextValue | null>(null);

const TOKEN_KEY = "verivo_token";

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Etat wagmi du wallet
  const { address, isConnected, status: accountStatus } = useAccount();
  const { disconnect } = useDisconnect();

  // Au montage : verifier le JWT existant
  useEffect(() => {
    const savedToken = localStorage.getItem(TOKEN_KEY);
    if (!savedToken) {
      setIsLoading(false);
      return;
    }

    setToken(savedToken);

    api
      .get<{ user: User }>("/api/auth/me")
      .then((data) => {
        setUser(data.user);
      })
      .catch(() => {
        localStorage.removeItem(TOKEN_KEY);
        setToken(null);
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, []);

  // Logout : nettoie le JWT + deconnecte le wallet
  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY);
    setToken(null);
    setUser(null);
    // Deconnecte aussi le wallet pour un logout complet
    if (isConnected) {
      disconnect();
    }
  }, [isConnected, disconnect]);

  // Synchronisation auth ↔ wallet
  // Regles :
  //   - Si user connecte (JWT valide) ET wallet deconnecte → logout auto
  //   - Si user connecte ET wallet change (address ≠ user.walletAddress) → logout auto
  //   - Si pas encore de user (onboarding) → ne rien faire, l'user peut connecter son wallet
  useEffect(() => {
    // Attendre que wagmi ait fini de charger (status = 'reconnecting' au boot)
    if (accountStatus === "connecting" || accountStatus === "reconnecting") return;
    // Attendre que l'auth ait fini de charger le JWT
    if (isLoading) return;

    if (!user) return; // pas encore authentifie, rien a synchroniser

    if (!isConnected) {
      // Wallet deconnecte apres auth → logout
      console.log("[auth] Wallet deconnecte, logout automatique");
      localStorage.removeItem(TOKEN_KEY);
      setToken(null);
      setUser(null);
      return;
    }

    // Verifier que l'adresse connectee correspond a celle du JWT
    if (
      address &&
      user.walletAddress &&
      address.toLowerCase() !== user.walletAddress.toLowerCase()
    ) {
      console.log("[auth] Changement de wallet detecte, logout automatique");
      localStorage.removeItem(TOKEN_KEY);
      setToken(null);
      setUser(null);
    }
  }, [isConnected, address, accountStatus, user, isLoading]);

  // Inscription : envoie les donnees au backend, stocke le JWT
  const register = useCallback(async (data: RegisterWalletRequest) => {
    const response = await api.post<RegisterResponse>("/api/auth/register", data);
    localStorage.setItem(TOKEN_KEY, response.token);
    setToken(response.token);
    setUser(response.user);
  }, []);

  // Connexion : SIWE only, pas de creation d'org
  const login = useCallback(async (data: WalletLoginRequest) => {
    const response = await api.post<WalletLoginResponse>(
      "/api/auth/wallet-login",
      data
    );
    localStorage.setItem(TOKEN_KEY, response.token);
    setToken(response.token);
    setUser(response.user);
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isAuthenticated: user !== null,
        isLoading,
        register,
        login,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
