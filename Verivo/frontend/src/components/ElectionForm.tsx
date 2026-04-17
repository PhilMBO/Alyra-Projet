"use client";

import { useState } from "react";
import { ChoiceEditor, type ChoiceDraft } from "./ChoiceEditor";
import type {
  CreateElectionRequest,
  VotingSystem,
  ChoiceType,
} from "@/lib/types";

interface ElectionFormProps {
  onSubmit: (data: CreateElectionRequest) => Promise<void>;
  isSubmitting: boolean;
  error: string | null;
}

const VOTING_SYSTEM_LABELS: Record<VotingSystem, string> = {
  uninominal_1tour: "Uninominal a un tour",
  uninominal_2tours: "Uninominal a deux tours",
  jugement_majoritaire: "Jugement majoritaire",
  approbation: "Approbation (cocher plusieurs)",
};

const CHOICE_TYPE_LABELS: Record<ChoiceType, string> = {
  candidate: "Candidats",
  proposal: "Propositions",
};

export function ElectionForm({
  onSubmit,
  isSubmitting,
  error,
}: ElectionFormProps) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [votingSystem, setVotingSystem] =
    useState<VotingSystem>("uninominal_1tour");
  const [choiceType, setChoiceType] = useState<ChoiceType>("candidate");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [quorum, setQuorum] = useState("0");
  const [choices, setChoices] = useState<ChoiceDraft[]>([
    { label: "", description: "" },
    { label: "", description: "" },
  ]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const payload: CreateElectionRequest = {
      title: title.trim(),
      description: description.trim() || undefined,
      votingSystem,
      choiceType,
      startDate: startDate ? new Date(startDate).toISOString() : undefined,
      endDate: endDate ? new Date(endDate).toISOString() : undefined,
      quorum: quorum ? parseInt(quorum, 10) : 0,
      choices: choices
        .filter((c) => c.label.trim())
        .map((c) => ({
          label: c.label.trim(),
          description: c.description.trim() || undefined,
        })),
    };

    await onSubmit(payload);
  };

  const choiceTypeLabel = choiceType === "candidate" ? "candidat" : "proposition";

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5">
      {/* Titre */}
      <div className="flex flex-col gap-1">
        <label className="text-sm font-semibold text-text-secondary">
          Titre du scrutin
        </label>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Election du president 2026"
          required
          minLength={1}
          maxLength={255}
          className="rounded border border-border px-3 py-2.5 text-base focus:border-secondary focus:outline-none focus:ring-2 focus:ring-secondary/15"
        />
      </div>

      {/* Description */}
      <div className="flex flex-col gap-1">
        <label className="text-sm font-semibold text-text-secondary">
          Description
        </label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Contexte, regles particulieres..."
          rows={3}
          className="rounded border border-border px-3 py-2.5 text-base focus:border-secondary focus:outline-none focus:ring-2 focus:ring-secondary/15"
        />
      </div>

      {/* Voting system */}
      <div className="flex flex-col gap-1">
        <label className="text-sm font-semibold text-text-secondary">
          Systeme de vote
        </label>
        <select
          value={votingSystem}
          onChange={(e) => setVotingSystem(e.target.value as VotingSystem)}
          className="rounded border border-border px-3 py-2.5 text-base focus:border-secondary focus:outline-none focus:ring-2 focus:ring-secondary/15"
        >
          {Object.entries(VOTING_SYSTEM_LABELS).map(([key, label]) => (
            <option key={key} value={key}>
              {label}
            </option>
          ))}
        </select>
      </div>

      {/* Choice type */}
      <div className="flex flex-col gap-1">
        <label className="text-sm font-semibold text-text-secondary">
          Type de choix
        </label>
        <select
          value={choiceType}
          onChange={(e) => setChoiceType(e.target.value as ChoiceType)}
          className="rounded border border-border px-3 py-2.5 text-base focus:border-secondary focus:outline-none focus:ring-2 focus:ring-secondary/15"
        >
          {Object.entries(CHOICE_TYPE_LABELS).map(([key, label]) => (
            <option key={key} value={key}>
              {label}
            </option>
          ))}
        </select>
      </div>

      {/* Dates */}
      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1">
          <label className="text-sm font-semibold text-text-secondary">
            Date de debut
          </label>
          <input
            type="datetime-local"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="rounded border border-border px-3 py-2.5 text-base focus:border-secondary focus:outline-none focus:ring-2 focus:ring-secondary/15"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-sm font-semibold text-text-secondary">
            Date de fin
          </label>
          <input
            type="datetime-local"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="rounded border border-border px-3 py-2.5 text-base focus:border-secondary focus:outline-none focus:ring-2 focus:ring-secondary/15"
          />
        </div>
      </div>

      {/* Quorum */}
      <div className="flex flex-col gap-1">
        <label className="text-sm font-semibold text-text-secondary">
          Quorum (nombre minimum de votes)
        </label>
        <input
          type="number"
          min={0}
          value={quorum}
          onChange={(e) => setQuorum(e.target.value)}
          className="rounded border border-border px-3 py-2.5 text-base focus:border-secondary focus:outline-none focus:ring-2 focus:ring-secondary/15"
        />
      </div>

      {/* Choices */}
      <div className="flex flex-col gap-2">
        <label className="text-sm font-semibold text-text-secondary">
          {CHOICE_TYPE_LABELS[choiceType]} (minimum 2)
        </label>
        <ChoiceEditor
          choices={choices}
          onChange={setChoices}
          choiceTypeLabel={choiceTypeLabel}
        />
      </div>

      {/* Error */}
      {error && <p className="text-sm text-error">{error}</p>}

      {/* Submit */}
      <button
        type="submit"
        disabled={
          isSubmitting ||
          !title.trim() ||
          choices.filter((c) => c.label.trim()).length < 2
        }
        className="rounded bg-primary py-2.5 text-base text-white hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isSubmitting ? "Creation en cours..." : "Creer le scrutin"}
      </button>
    </form>
  );
}
