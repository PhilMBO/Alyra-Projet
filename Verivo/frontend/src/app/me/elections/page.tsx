"use client";

import Link from "next/link";
import { useMyElections, type MyElection } from "@/hooks/useMyElections";
import type { ElectionStatus } from "@/lib/types";

const STATUS_STYLES: Record<ElectionStatus, string> = {
  draft: "bg-border text-text-secondary",
  open: "bg-success/10 text-success",
  closed: "bg-warning/10 text-warning",
  tallied: "bg-secondary/10 text-secondary",
  archived: "bg-error/10 text-error",
};

const STATUS_LABELS: Record<ElectionStatus, string> = {
  draft: "Brouillon",
  open: "Ouvert",
  closed: "Clos",
  tallied: "Depouille",
  archived: "Archive",
};

export default function MyElectionsPage() {
  const { elections, isLoading, error } = useMyElections();

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link
          href="/dashboard"
          className="text-sm text-text-secondary hover:text-primary"
        >
          ← Dashboard
        </Link>
        <h1 className="mt-2 text-2xl font-bold text-primary">Mes scrutins</h1>
        <p className="text-text-secondary">
          Les scrutins auxquels vous etes inscrit(e) comme votant(e).
        </p>
      </div>

      <section className="rounded-lg border border-border bg-background p-6 shadow-card">
        {isLoading ? (
          <p className="text-text-secondary">Chargement...</p>
        ) : error ? (
          <p className="text-error">{error}</p>
        ) : elections.length === 0 ? (
          <p className="rounded border border-dashed border-border p-6 text-center text-text-secondary">
            Vous n'etes inscrit a aucun scrutin pour le moment.
          </p>
        ) : (
          <ul className="flex flex-col gap-3">
            {elections.map((e) => (
              <MyElectionCard key={e.id} election={e} />
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function MyElectionCard({ election }: { election: MyElection }) {
  const participationBadge = election.participation.hasVoted
    ? { label: "Vous avez vote", className: "bg-success/10 text-success" }
    : election.status === "open"
      ? { label: "A voter", className: "bg-warning/10 text-warning" }
      : { label: "En attente", className: "bg-border text-text-secondary" };

  return (
    <li>
      <Link
        href={`/me/elections/${election.organizationSlug}/${election.id}`}
        className="flex items-center justify-between rounded border border-border p-4 hover:bg-surface transition-colors"
      >
        <div className="flex flex-col gap-1">
          <p className="font-semibold text-primary">{election.title}</p>
          <p className="text-sm text-text-secondary">
            {election.organizationName}
          </p>
        </div>
        <div className="flex flex-col items-end gap-1">
          <span
            className={`rounded-full px-2 py-0.5 text-xs font-semibold ${STATUS_STYLES[election.status]}`}
          >
            {STATUS_LABELS[election.status]}
          </span>
          <span
            className={`rounded-full px-2 py-0.5 text-xs font-semibold ${participationBadge.className}`}
          >
            {participationBadge.label}
          </span>
        </div>
      </Link>
    </li>
  );
}
