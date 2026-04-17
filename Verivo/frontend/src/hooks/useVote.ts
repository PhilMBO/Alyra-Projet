"use client";

import { useCallback, useEffect, useState } from "react";
import { useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { api } from "@/lib/api";
import { VERIVO_VOTING_ABI } from "@/lib/contracts";

/**
 * Hook pour voter on-chain (self-paid : le votant signe et paie son gas).
 * Appelle VerivoVoting.castVote(choiceIndex) depuis le wallet connecte.
 */
export function useCastVote(
  organizationSlug: string,
  electionId: string,
  votingContractAddress: string | null | undefined
) {
  const { writeContractAsync, data: txHash, reset } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
    hash: txHash,
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const castVote = useCallback(
    async (choiceIndex: number) => {
      if (!votingContractAddress) {
        throw new Error("Contrat de vote pas deploye");
      }
      setIsSubmitting(true);
      setError(null);
      try {
        const hash = await writeContractAsync({
          address: votingContractAddress as `0x${string}`,
          abi: VERIVO_VOTING_ABI,
          functionName: "castVote",
          args: [BigInt(choiceIndex)],
        });
        return hash;
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Erreur de signature";
        setError(message);
        throw err;
      } finally {
        setIsSubmitting(false);
      }
    },
    [votingContractAddress, writeContractAsync]
  );

  // Apres confirmation on-chain, sync la DB (participation_log)
  useEffect(() => {
    if (!isSuccess) return;
    api
      .post(
        `/api/organizations/${organizationSlug}/elections/${electionId}/sync`,
        {}
      )
      .catch(() => {});
  }, [isSuccess, organizationSlug, electionId]);

  return {
    castVote,
    txHash,
    isSubmitting,
    isConfirming,
    isSuccess,
    error,
    reset,
  };
}
