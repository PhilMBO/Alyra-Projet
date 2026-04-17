"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { Header } from "@/components/Header";

// Layout qui protege /me/* : redirige vers /register si non authentifie
export default function MeLayout({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.replace("/login");
    }
  }, [isLoading, isAuthenticated, router]);

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-text-secondary">Chargement...</p>
      </div>
    );
  }
  if (!isAuthenticated) return null;

  return (
    <div className="min-h-screen">
      <Header />
      <main className="mx-auto max-w-5xl p-6">{children}</main>
    </div>
  );
}
