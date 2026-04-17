"use client";

import { useState } from "react";
import type { ResultsPayload } from "@/hooks/useResults";

interface ResultsViewProps {
  data: ResultsPayload;
  organizationSlug?: string;   // si present, affiche le bouton "Lien public"
}

export function ResultsView({ data, organizationSlug }: ResultsViewProps) {
  const { results, summary, explorerUrl } = data;
  const [copyFeedback, setCopyFeedback] = useState(false);

  const publicUrl = organizationSlug
    ? `${typeof window !== "undefined" ? window.location.origin : ""}/public/organizations/${organizationSlug}/elections/${data.election.id}`
    : null;

  const handleCopyLink = async () => {
    if (!publicUrl) return;
    try {
      await navigator.clipboard.writeText(publicUrl);
      setCopyFeedback(true);
      setTimeout(() => setCopyFeedback(false), 2000);
    } catch {
      // ignore
    }
  };

  const sortedByRank = [...results].sort((a, b) => a.rank - b.rank);
  const maxVotes = Math.max(...results.map((r) => r.voteCount), 1);

  return (
    <div className="flex flex-col gap-6">
      {/* Gagnant */}
      {summary.winningChoiceLabel && (
        <div className="rounded-lg border border-success/30 bg-success/5 p-4">
          <p className="text-xs uppercase tracking-wide text-success">
            Choix gagnant
          </p>
          <p className="mt-1 text-2xl font-bold text-success">
            {summary.winningChoiceLabel}
          </p>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Votes exprimes" value={summary.totalVotes} />
        <Stat label="Inscrits" value={summary.totalRegistered} />
        <Stat
          label="Participation"
          value={`${summary.participationRate}%`}
        />
        <Stat
          label="Quorum"
          value={summary.quorumReached ? "Atteint" : "Non atteint"}
          valueClass={
            summary.quorumReached ? "text-success" : "text-error"
          }
        />
      </div>

      {/* Tableau des resultats */}
      <div className="overflow-auto rounded border border-border">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-surface text-left text-xs uppercase text-text-secondary">
              <th className="px-3 py-2">Rang</th>
              <th className="px-3 py-2">Choix</th>
              <th className="px-3 py-2">Votes</th>
              <th className="px-3 py-2">%</th>
              <th className="px-3 py-2 w-64">Repartition</th>
            </tr>
          </thead>
          <tbody>
            {sortedByRank.map((r) => (
              <tr
                key={r.choiceId}
                className={
                  r.isWinner ? "border-t border-border bg-success/5" : "border-t border-border"
                }
              >
                <td className="px-3 py-2 font-semibold text-primary">#{r.rank}</td>
                <td className="px-3 py-2">
                  <p className="font-semibold text-primary">{r.label}</p>
                  {r.description && (
                    <p className="text-xs text-text-secondary">{r.description}</p>
                  )}
                </td>
                <td className="px-3 py-2 font-mono">{r.voteCount}</td>
                <td className="px-3 py-2 font-mono">{r.percentage}%</td>
                <td className="px-3 py-2">
                  <div className="h-2 w-full rounded bg-border">
                    <div
                      className={`h-2 rounded ${r.isWinner ? "bg-success" : "bg-secondary"}`}
                      style={{ width: `${(r.voteCount / maxVotes) * 100}%` }}
                    />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {explorerUrl && (
        <p className="text-xs text-text-secondary">
          Contrat on-chain :{" "}
          <a
            href={explorerUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-secondary hover:underline break-all"
          >
            {explorerUrl}
          </a>
        </p>
      )}

      {publicUrl && (
        <div className="flex items-center gap-3 rounded border border-border bg-surface p-3">
          <div className="flex-1">
            <p className="text-xs font-semibold uppercase text-text-secondary">
              Lien public
            </p>
            <p className="text-xs text-primary break-all">{publicUrl}</p>
          </div>
          <button
            onClick={handleCopyLink}
            className="rounded border border-border bg-background px-3 py-1.5 text-sm hover:bg-surface"
          >
            {copyFeedback ? "Copie" : "Copier"}
          </button>
        </div>
      )}
    </div>
  );
}

function Stat({
  label,
  value,
  valueClass,
}: {
  label: string;
  value: string | number;
  valueClass?: string;
}) {
  return (
    <div className="rounded border border-border bg-surface p-3">
      <p className="text-xs uppercase tracking-wide text-text-secondary">{label}</p>
      <p
        className={`mt-1 text-xl font-bold ${valueClass || "text-primary"}`}
      >
        {value}
      </p>
    </div>
  );
}
