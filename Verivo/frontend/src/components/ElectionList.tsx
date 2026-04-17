"use client";

import Link from "next/link";
import type { Election, ElectionStatus } from "@/lib/types";

interface ElectionListProps {
  organizationSlug: string;
  elections: Election[];
}

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

export function ElectionList({
  organizationSlug,
  elections,
}: ElectionListProps) {
  if (elections.length === 0) {
    return (
      <p className="rounded border border-dashed border-border p-6 text-center text-text-secondary">
        Aucun scrutin pour le moment.
      </p>
    );
  }

  return (
    <ul className="flex flex-col gap-3">
      {elections.map((e) => (
        <li key={e.id}>
          <Link
            href={`/dashboard/organizations/${organizationSlug}/elections/${e.id}`}
            className="flex items-center justify-between rounded border border-border p-4 hover:bg-surface transition-colors"
          >
            <div className="flex flex-col gap-1">
              <p className="font-semibold text-primary">{e.title}</p>
              <p className="text-sm text-text-secondary">
                {e.choiceCount} choix · {e.voterCount ?? 0} votants inscrits
              </p>
            </div>
            <span
              className={`rounded-full px-2 py-0.5 text-xs font-semibold ${STATUS_STYLES[e.status]}`}
            >
              {STATUS_LABELS[e.status]}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
