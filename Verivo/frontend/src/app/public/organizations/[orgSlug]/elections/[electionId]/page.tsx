"use client";

import { use, useEffect, useState } from "react";
import type { ResultsPayload } from "@/hooks/useResults";
import { ResultsView } from "@/components/ResultsView";

/**
 * Page publique des resultats d'un scrutin.
 * Aucune authentification requise. URL partageable.
 */
export default function PublicResultsPage({
  params,
}: {
  params: Promise<{ orgSlug: string; electionId: string }>;
}) {
  const { orgSlug, electionId } = use(params);
  const [data, setData] = useState<(ResultsPayload & { organization: { name: string; slug: string; logoUrl: string | null } }) | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copyFeedback, setCopyFeedback] = useState(false);

  useEffect(() => {
    fetch(`/api/public/organizations/${orgSlug}/elections/${electionId}/results`)
      .then(async (r) => {
        const body = await r.json();
        if (!r.ok) throw new Error(body.error || "Erreur serveur");
        return body;
      })
      .then(setData)
      .catch((err) => setError(err.message))
      .finally(() => setIsLoading(false));
  }, [orgSlug, electionId]);

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopyFeedback(true);
      setTimeout(() => setCopyFeedback(false), 2000);
    } catch {
      // ignore
    }
  };

  return (
    <div className="min-h-screen bg-surface">
      {/* Header minimal (pas de ConnectButton) */}
      <header className="bg-background border-b border-border px-6 py-4 shadow-card">
        <div className="mx-auto flex max-w-5xl items-center justify-between">
          <div className="flex items-center gap-3">
            <img src="/logoverivo.png" alt="Verivo" className="h-10 w-10 rounded" />
            <span className="text-xl font-bold text-primary">Verivo</span>
            <span className="text-sm text-text-secondary">— Resultats publics</span>
          </div>
          <button
            onClick={handleCopyLink}
            className="rounded border border-border px-3 py-1.5 text-sm hover:bg-surface"
          >
            {copyFeedback ? "Lien copie" : "Partager"}
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-5xl p-6">
        {isLoading && <p className="text-text-secondary">Chargement...</p>}

        {error && (
          <div className="rounded border border-error/30 bg-error/5 p-4">
            <p className="font-semibold text-error">Resultats indisponibles</p>
            <p className="mt-1 text-sm text-text-secondary">{error}</p>
          </div>
        )}

        {data && (
          <div className="flex flex-col gap-6">
            <div>
              <p className="text-sm text-text-secondary">
                {data.organization.name}
              </p>
              <h1 className="text-2xl font-bold text-primary">
                {data.election.title}
              </h1>
              {data.election.description && (
                <p className="mt-2 text-text-secondary">
                  {data.election.description}
                </p>
              )}
            </div>

            <section className="rounded-lg border border-border bg-background p-6 shadow-card">
              <ResultsView data={data} />
            </section>

            <section className="rounded-lg border border-border bg-background p-6 shadow-card text-sm text-text-secondary">
              <p className="font-semibold text-primary">Verification independante</p>
              <p className="mt-1">
                Ces resultats sont lus directement depuis la blockchain. Toute
                personne peut les verifier via l'explorateur a partir de l'adresse
                du contrat ci-dessus.
              </p>
            </section>
          </div>
        )}
      </main>
    </div>
  );
}
