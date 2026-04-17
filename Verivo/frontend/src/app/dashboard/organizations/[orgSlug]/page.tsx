"use client";

import Link from "next/link";
import { use } from "react";
import { useElectionList } from "@/hooks/useElections";
import { useMyOrganizations } from "@/hooks/useMyOrganizations";
import { useOrgRole } from "@/hooks/useOrgRole";
import { ElectionList } from "@/components/ElectionList";

export default function OrganizationDashboardPage({
  params,
}: {
  params: Promise<{ orgSlug: string }>;
}) {
  const { orgSlug } = use(params);
  const { elections, isLoading, error, refresh } = useElectionList(orgSlug);
  const { count: orgCount } = useMyOrganizations();
  const { canManage } = useOrgRole(orgSlug);

  // Lien "Retour au dashboard" utile seulement si l'user a plusieurs orgs
  const showDashboardLink = orgCount > 1;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          {showDashboardLink && (
            <Link
              href="/dashboard"
              className="text-sm text-text-secondary hover:text-primary"
            >
              ← Retour au dashboard
            </Link>
          )}
          <h1 className="mt-2 text-2xl font-bold text-primary">
            Organisation : {orgSlug}
          </h1>
        </div>
        {canManage && (
          <Link
            href={`/dashboard/organizations/${orgSlug}/elections/create`}
            className="rounded bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary-hover"
          >
            + Creer un scrutin
          </Link>
        )}
      </div>

      <section className="rounded-lg border border-border bg-background p-6 shadow-card">
        <h2 className="mb-4 font-semibold text-primary">Scrutins</h2>
        {isLoading ? (
          <p className="text-text-secondary">Chargement...</p>
        ) : error ? (
          <div className="flex flex-col gap-2">
            <p className="text-sm text-error">{error}</p>
            <button
              onClick={refresh}
              className="self-start text-sm text-secondary hover:underline"
            >
              Reessayer
            </button>
          </div>
        ) : (
          <ElectionList organizationSlug={orgSlug} elections={elections} />
        )}
      </section>
    </div>
  );
}
