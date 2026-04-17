"use client";

import { useEffect } from "react";
import { useAccount } from "wagmi";
import type { Election } from "@/lib/types";
import {
  useCloseVoting,
  useTallyVotes,
} from "@/hooks/useDeployment";
import { api } from "@/lib/api";

interface TallyActionsProps {
  organizationSlug: string;
  election: Election;
  onStateChange: () => void;
}

/**
 * Actions admin apres l'ouverture du vote :
 *   status = open   → bouton "Cloturer le scrutin"
 *   status = closed → bouton "Depouiller"
 *   status = tallied → rien (les resultats s'affichent ailleurs)
 */
export function TallyActions({
  organizationSlug,
  election,
  onStateChange,
}: TallyActionsProps) {
  const { isConnected } = useAccount();
  const addr = election.contractAddress;

  const {
    closeVoting,
    isSubmitting: isClosing,
    isConfirming: isCloseConfirming,
    isSuccess: isCloseSuccess,
    error: closeError,
  } = useCloseVoting(addr);

  const {
    tallyVotes,
    isSubmitting: isTallying,
    isConfirming: isTallyConfirming,
    isSuccess: isTallySuccess,
    error: tallyError,
  } = useTallyVotes(addr);

  // Apres close ou tally, sync la DB
  useEffect(() => {
    if (isCloseSuccess || isTallySuccess) {
      api
        .post(
          `/api/organizations/${organizationSlug}/elections/${election.id}/sync`,
          {}
        )
        .then(() => onStateChange())
        .catch(() => {});
    }
  }, [isCloseSuccess, isTallySuccess, organizationSlug, election.id, onStateChange]);

  if (!isConnected) {
    return (
      <p className="rounded border border-warning/30 bg-warning/5 p-3 text-sm text-warning">
        Connectez votre wallet pour effectuer les actions administratives.
      </p>
    );
  }

  if (election.status === "open") {
    return (
      <div className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-4">
        <p className="text-sm text-text-secondary">
          Le scrutin est ouvert. Vous pouvez le cloturer a tout moment pour empecher
          tout nouveau vote. Cette action est signee depuis votre wallet.
        </p>
        <button
          onClick={() => closeVoting().catch(() => {})}
          disabled={isClosing || isCloseConfirming}
          className="self-start rounded bg-warning px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isClosing
            ? "Signature..."
            : isCloseConfirming
              ? "Confirmation on-chain..."
              : "Cloturer le scrutin"}
        </button>
        {closeError && <p className="text-sm text-error">{closeError}</p>}
      </div>
    );
  }

  if (election.status === "closed") {
    return (
      <div className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-4">
        <p className="text-sm text-text-secondary">
          Le scrutin est clos. Lancez le depouillement pour rendre les resultats
          officiels et accessibles. Cette action est signee depuis votre wallet.
        </p>
        <button
          onClick={() => tallyVotes().catch(() => {})}
          disabled={isTallying || isTallyConfirming}
          className="self-start rounded bg-secondary px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isTallying
            ? "Signature..."
            : isTallyConfirming
              ? "Confirmation on-chain..."
              : "Depouiller le scrutin"}
        </button>
        {tallyError && <p className="text-sm text-error">{tallyError}</p>}
      </div>
    );
  }

  return null;
}
