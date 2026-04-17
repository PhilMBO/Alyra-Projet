"use client";

import { use, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ElectionForm } from "@/components/ElectionForm";
import { useCreateElection } from "@/hooks/useElections";
import { useOrgRole } from "@/hooks/useOrgRole";

export default function CreateElectionPage({
  params,
}: {
  params: Promise<{ orgSlug: string }>;
}) {
  const { orgSlug } = use(params);
  const router = useRouter();
  const { createElection, isSubmitting, error } = useCreateElection(orgSlug);
  const { canManage, isLoading: roleLoading } = useOrgRole(orgSlug);

  // Bloquer l'acces aux MEMBERs
  useEffect(() => {
    if (!roleLoading && !canManage) {
      router.replace(`/dashboard/organizations/${orgSlug}`);
    }
  }, [roleLoading, canManage, orgSlug, router]);

  if (roleLoading || !canManage) {
    return <p className="text-text-secondary">Chargement...</p>;
  }

  const handleSubmit = async (data: Parameters<typeof createElection>[0]) => {
    try {
      const result = await createElection(data);
      router.push(
        `/dashboard/organizations/${orgSlug}/elections/${result.election.id}`
      );
    } catch {
      // Erreur deja geree dans le hook
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <Link
        href={`/dashboard/organizations/${orgSlug}`}
        className="text-sm text-text-secondary hover:text-primary"
      >
        ← Retour aux scrutins
      </Link>
      <h1 className="text-2xl font-bold text-primary">Creer un scrutin</h1>

      <section className="rounded-lg border border-border bg-background p-6 shadow-card">
        <ElectionForm
          onSubmit={handleSubmit}
          isSubmitting={isSubmitting}
          error={error}
        />
      </section>
    </div>
  );
}
