"use client";

import Link from "next/link";
import { use, useState } from "react";
import { useRouter } from "next/navigation";
import {
  useElection,
  useVoters,
  useDeleteElection,
} from "@/hooks/useElections";
import { CsvUploader } from "@/components/CsvUploader";
import { VoterList } from "@/components/VoterList";

export default function ElectionDetailPage({
  params,
}: {
  params: Promise<{ orgSlug: string; electionId: string }>;
}) {
  const { orgSlug, electionId } = use(params);
  const router = useRouter();
  const { election, choices, isLoading, error } = useElection(orgSlug, electionId);
  const { voters, isLoading: votersLoading, refresh: refreshVoters } = useVoters(
    orgSlug,
    electionId
  );
  const { deleteElection, isDeleting, error: deleteError } =
    useDeleteElection(orgSlug);

  const [confirmDelete, setConfirmDelete] = useState(false);

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

  const handleDelete = async () => {
    try {
      await deleteElection(electionId);
      router.push(`/dashboard/organizations/${orgSlug}`);
    } catch {
      // erreur deja geree
    }
  };

  const isDraft = election.status === "draft";

  return (
    <div className="flex flex-col gap-6">
      <Link
        href={`/dashboard/organizations/${orgSlug}`}
        className="text-sm text-text-secondary hover:text-primary"
      >
        ← Retour aux scrutins
      </Link>

      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-primary">{election.title}</h1>
          {election.description && (
            <p className="mt-2 text-text-secondary">{election.description}</p>
          )}
        </div>

        {isDraft && (
          <div className="flex gap-2">
            <Link
              href={`/dashboard/organizations/${orgSlug}/elections/${electionId}/edit`}
              className="rounded border border-border px-3 py-1.5 text-sm hover:bg-surface"
            >
              Modifier
            </Link>
            {!confirmDelete ? (
              <button
                onClick={() => setConfirmDelete(true)}
                className="rounded border border-error/30 px-3 py-1.5 text-sm text-error hover:bg-error/5"
              >
                Supprimer
              </button>
            ) : (
              <>
                <button
                  onClick={handleDelete}
                  disabled={isDeleting}
                  className="rounded bg-error px-3 py-1.5 text-sm text-white disabled:opacity-60"
                >
                  {isDeleting ? "Suppression..." : "Confirmer"}
                </button>
                <button
                  onClick={() => setConfirmDelete(false)}
                  className="rounded border border-border px-3 py-1.5 text-sm hover:bg-surface"
                >
                  Annuler
                </button>
              </>
            )}
          </div>
        )}
      </div>

      {deleteError && (
        <p className="rounded border border-error/30 bg-error/5 p-2 text-sm text-error">
          {deleteError}
        </p>
      )}

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

      {/* Import CSV (uniquement en draft) */}
      {isDraft && (
        <section className="rounded-lg border border-border bg-background p-6 shadow-card">
          <h2 className="mb-1 font-semibold text-primary">Importer une liste electorale</h2>
          <p className="mb-4 text-sm text-text-secondary">
            Les comptes seront crees automatiquement pour les wallets inconnus.
          </p>
          <CsvUploader
            organizationSlug={orgSlug}
            electionId={electionId}
            onImportSuccess={refreshVoters}
          />
        </section>
      )}

      {/* Liste des votants inscrits */}
      <section className="rounded-lg border border-border bg-background p-6 shadow-card">
        <h2 className="mb-4 font-semibold text-primary">
          Votants inscrits ({voters.length})
        </h2>
        {votersLoading ? (
          <p className="text-text-secondary">Chargement...</p>
        ) : (
          <VoterList voters={voters} />
        )}
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
