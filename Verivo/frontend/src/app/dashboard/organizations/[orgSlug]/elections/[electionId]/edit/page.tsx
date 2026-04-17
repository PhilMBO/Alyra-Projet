"use client";

import Link from "next/link";
import { use, useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  useElection,
  useUpdateElection,
} from "@/hooks/useElections";
import { useOrgRole } from "@/hooks/useOrgRole";
import type { CreateElectionRequest } from "@/lib/types";

export default function EditElectionPage({
  params,
}: {
  params: Promise<{ orgSlug: string; electionId: string }>;
}) {
  const { orgSlug, electionId } = use(params);
  const router = useRouter();
  const { election, isLoading } = useElection(orgSlug, electionId);
  const { updateElection, isUpdating, error } = useUpdateElection(
    orgSlug,
    electionId
  );
  const { canManage, isLoading: roleLoading } = useOrgRole(orgSlug);

  useEffect(() => {
    if (!roleLoading && !canManage) {
      router.replace(`/dashboard/organizations/${orgSlug}/elections/${electionId}`);
    }
  }, [roleLoading, canManage, orgSlug, electionId, router]);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [quorum, setQuorum] = useState("0");

  useEffect(() => {
    if (!election) return;
    setTitle(election.title);
    setDescription(election.description || "");
    setStartDate(election.startDate ? toDatetimeLocal(election.startDate) : "");
    setEndDate(election.endDate ? toDatetimeLocal(election.endDate) : "");
    setQuorum(String(election.quorum));
  }, [election]);

  if (isLoading || !election) {
    return <p className="text-text-secondary">Chargement...</p>;
  }

  if (election.status !== "draft") {
    return (
      <div className="flex flex-col gap-3">
        <Link
          href={`/dashboard/organizations/${orgSlug}/elections/${electionId}`}
          className="text-sm text-text-secondary hover:text-primary"
        >
          ← Retour
        </Link>
        <p className="text-error">
          Seuls les scrutins en draft peuvent etre modifies.
        </p>
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const patch: Partial<CreateElectionRequest> = {
      title: title.trim(),
      description: description.trim() || undefined,
      startDate: startDate ? new Date(startDate).toISOString() : undefined,
      endDate: endDate ? new Date(endDate).toISOString() : undefined,
      quorum: parseInt(quorum, 10) || 0,
    };
    try {
      await updateElection(patch);
      router.push(
        `/dashboard/organizations/${orgSlug}/elections/${electionId}`
      );
    } catch {
      // erreur affichee
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <Link
        href={`/dashboard/organizations/${orgSlug}/elections/${electionId}`}
        className="text-sm text-text-secondary hover:text-primary"
      >
        ← Retour au scrutin
      </Link>
      <h1 className="text-2xl font-bold text-primary">Modifier le scrutin</h1>

      <section className="rounded-lg border border-border bg-background p-6 shadow-card">
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <Field label="Titre">
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              maxLength={255}
              className="rounded border border-border px-3 py-2.5 text-base focus:border-secondary focus:outline-none focus:ring-2 focus:ring-secondary/15"
            />
          </Field>

          <Field label="Description">
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="rounded border border-border px-3 py-2.5 text-base focus:border-secondary focus:outline-none focus:ring-2 focus:ring-secondary/15"
            />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Date de debut">
              <input
                type="datetime-local"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="rounded border border-border px-3 py-2.5 text-base focus:border-secondary focus:outline-none focus:ring-2 focus:ring-secondary/15"
              />
            </Field>
            <Field label="Date de fin">
              <input
                type="datetime-local"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="rounded border border-border px-3 py-2.5 text-base focus:border-secondary focus:outline-none focus:ring-2 focus:ring-secondary/15"
              />
            </Field>
          </div>

          <Field label="Quorum">
            <input
              type="number"
              min={0}
              value={quorum}
              onChange={(e) => setQuorum(e.target.value)}
              className="rounded border border-border px-3 py-2.5 text-base focus:border-secondary focus:outline-none focus:ring-2 focus:ring-secondary/15"
            />
          </Field>

          <p className="text-xs text-text-secondary">
            Les choix ne sont pas modifiables depuis cet ecran. Pour les changer,
            supprimez le scrutin et recreez-le.
          </p>

          {error && <p className="text-sm text-error">{error}</p>}

          <button
            type="submit"
            disabled={isUpdating || !title.trim()}
            className="rounded bg-primary py-2.5 text-base text-white hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isUpdating ? "Enregistrement..." : "Enregistrer"}
          </button>
        </form>
      </section>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-sm font-semibold text-text-secondary">
        {label}
      </label>
      {children}
    </div>
  );
}

function toDatetimeLocal(iso: string): string {
  // Convertir ISO UTC → yyyy-MM-ddTHH:mm pour l'input datetime-local
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
