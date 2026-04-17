"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";

export default function HomePage() {
  const { isAuthenticated, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    // Attendre que l'auth soit verifiee avant de rediriger
    if (isLoading) return;

    if (isAuthenticated) {
      router.replace("/dashboard");
    } else {
      router.replace("/login");
    }
  }, [isAuthenticated, isLoading, router]);

  // Ecran de chargement pendant la verification
  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="text-center">
        <img
          src="/logoverivo.png"
          alt="Verivo"
          className="mx-auto h-16 w-16 animate-pulse"
        />
        <p className="mt-4 text-text-secondary">Chargement...</p>
      </div>
    </div>
  );
}