"use client";

import { useState } from "react";
import { useCastVote } from "@/hooks/useVote";
import type { Choice } from "@/lib/types";

interface VoteFormProps {
  organizationSlug: string;
  electionId: string;
  votingContractAddress: string;
  choices: Choice[];
  onVoted: () => void;
}

export function VoteForm({
  organizationSlug,
  electionId,
  votingContractAddress,
  choices,
  onVoted,
}: VoteFormProps) {
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [hasSubmitted, setHasSubmitted] = useState(false);

  const {
    castVote,
    isSubmitting,
    isConfirming,
    isSuccess,
    error,
  } = useCastVote(organizationSlug, electionId, votingContractAddress);

  const handleVote = async () => {
    if (selectedIndex === null) return;
    try {
      await castVote(selectedIndex);
      setHasSubmitted(true);
    } catch {
      // erreur affichee
    }
  };

  // Quand la tx est confirmee, on previent le parent
  if (isSuccess && hasSubmitted) {
    setTimeout(onVoted, 500);
  }

  if (isSuccess) {
    return (
      <div className="rounded border border-success/30 bg-success/5 p-4">
        <p className="font-semibold text-success">Vote enregistre on-chain</p>
        <p className="mt-1 text-sm text-text-secondary">
          Votre vote a ete confirme sur la blockchain. Merci pour votre participation.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        {choices.map((choice, index) => (
          <label
            key={choice.id}
            className={`flex cursor-pointer items-start gap-3 rounded border p-3 transition-colors ${
              selectedIndex === index
                ? "border-secondary bg-secondary/5"
                : "border-border hover:bg-surface"
            }`}
          >
            <input
              type="radio"
              name="choice"
              value={index}
              checked={selectedIndex === index}
              onChange={() => setSelectedIndex(index)}
              className="mt-1"
              disabled={isSubmitting || isConfirming}
            />
            <div className="flex-1">
              <p className="font-semibold text-primary">
                #{index + 1} — {choice.label}
              </p>
              {choice.description && (
                <p className="text-sm text-text-secondary">
                  {choice.description}
                </p>
              )}
            </div>
          </label>
        ))}
      </div>

      {error && (
        <p className="rounded border border-error/30 bg-error/5 p-2 text-sm text-error">
          {error}
        </p>
      )}

      <button
        onClick={handleVote}
        disabled={selectedIndex === null || isSubmitting || isConfirming}
        className="self-start rounded bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isSubmitting
          ? "Signature..."
          : isConfirming
            ? "Confirmation on-chain..."
            : "Voter"}
      </button>

      <p className="text-xs text-text-secondary">
        Votre vote sera enregistre de maniere immuable sur la blockchain.
        Vous paierez les frais de gas via votre wallet.
      </p>
    </div>
  );
}
