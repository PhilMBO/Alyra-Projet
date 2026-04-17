"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { OrganizationList } from "@/components/OrganizationList";
import { api } from "@/lib/api";
import type { Organization } from "@/lib/types";

export default function DashboardPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Charger les organisations de l'utilisateur
  useEffect(() => {
    api
      .get<Organization[]>("/api/organizations")
      .then(setOrganizations)
      .catch((err) => console.error("Erreur chargement organisations:", err))
      .finally(() => setIsLoading(false));
  }, []);

  // Si une seule organisation : redirection auto
  useEffect(() => {
    if (!isLoading && organizations.length === 1) {
      router.replace(`/dashboard/organizations/${organizations[0].slug}`);
    }
  }, [isLoading, organizations, router]);

  return (
    <div className="flex flex-col gap-6">
      {/* Message de bienvenue */}
      <div>
        <h1 className="text-2xl font-bold text-primary">
          Bonjour, {user?.displayName}
        </h1>
        <p className="text-text-secondary">
          Wallet : {user?.walletAddress?.slice(0, 6)}...{user?.walletAddress?.slice(-4)}
        </p>
      </div>

      {/* Liste des organisations */}
      <section className="rounded-lg border border-border bg-background p-6 shadow-card">
        <h2 className="mb-4 font-semibold text-primary">Mes organisations</h2>
        {isLoading ? (
          <p className="text-text-secondary">Chargement...</p>
        ) : (
          <OrganizationList organizations={organizations} />
        )}
      </section>
    </div>
  );
}