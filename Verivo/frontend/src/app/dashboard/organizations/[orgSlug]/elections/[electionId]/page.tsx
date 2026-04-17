"use client";

import Link from "next/link";
import { use } from "react";
import { useElection } from "@/hooks/useElections";

export default function ElectionDetailPage({
  params,
}: {
  params: Promise<{ orgSlug: string; electionId: string }>;
}) {
  const { orgSlug, electionId } = use(params);
  const { election, choices, isLoading, error } = useElection(orgSlug, electionId);

  if (isLoading) {
    return <p className="text-text-secondary">Chargement...</p>;
  }
  if (error || !election) {
    return (
      <div className="flex flex-col gap-3">
        <Link
          href={`/dashboard/organizations/${orgSlug}`}
          className="text-sm text-text-secondary hover:text-primary"
        >
          ← Retour
        </Link>
        <p className="text-error">{error || "Scrutin introuvable"}</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <Link
        href={`/dashboard/organizations/${orgSlug}`}
        className="text-sm text-text-secondary hover:text-primary"
      >
        ← Retour aux scrutins
      </Link>

      <div>
        <h1 className="text-2xl font-bold text-primary">{election.title}</h1>
        {election.description && (
          <p className="mt-2 text-text-secondary">{election.description}</p>
        )}
      </div>

      <section className="grid grid-cols-2 gap-3 rounded-lg border border-border bg-background p-6 shadow-card">
        <Info label="Statut" value={election.status} />
        <Info label="Systeme" value={election.votingSystem} />
        <Info
          label="Date debut"
          value={election.startDate ? formatDate(election.startDate) : "—"}
        />
        <Info
          label="Date fin"
          value={election.endDate ? formatDate(election.endDate) : "—"}
        />
        <Info label="Quorum" value={String(election.quorum)} />
        <Info label="Contrat on-chain" value={election.contractAddress || "—"} />
      </section>

      <section className="rounded-lg border border-border bg-background p-6 shadow-card">
        <h2 className="mb-4 font-semibold text-primary">
          {election.choiceType === "candidate" ? "Candidats" : "Propositions"} (
          {choices.length})
        </h2>
        <ul className="flex flex-col gap-2">
          {choices.map((c) => (
            <li
              key={c.id}
              className="flex items-center gap-3 rounded border border-border p-3"
            >
              <span className="text-sm font-semibold text-text-secondary">
                #{c.position + 1}
              </span>
              <div>
                <p className="font-semibold text-primary">{c.label}</p>
                {c.description && (
                  <p className="text-sm text-text-secondary">{c.description}</p>
                )}
              </div>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-xs uppercase tracking-wide text-text-secondary">
        {label}
      </span>
      <span className="text-sm text-primary break-all">{value}</span>
    </div>
  );
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString("fr-FR");
}
