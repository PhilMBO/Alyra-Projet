"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { Header } from "@/components/Header";

// Ce layout protege TOUTES les pages sous /dashboard/*
// Si l'utilisateur n'est pas authentifie, il est redirige vers /register
export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.replace("/register");
    }
  }, [isLoading, isAuthenticated, router]);

  // Pendant la verification
  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-text-secondary">Chargement...</p>
      </div>
    );
  }

  // Pas authentifie → on attend la redirection
  if (!isAuthenticated) {
    return null;
  }

  return (
    <div className="min-h-screen">
      <Header />
      <main className="mx-auto max-w-5xl p-6">{children}</main>
    </div>
  );
}