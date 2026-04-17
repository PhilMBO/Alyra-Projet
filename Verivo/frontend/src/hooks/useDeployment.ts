"use client";

import { useCallback, useState } from "react";
import { useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { api, ApiError } from "@/lib/api";
import {
  VERIVO_VOTING_NFT_ABI,
  VERIVO_VOTING_ABI,
} from "@/lib/contracts";
import type { VoterRow } from "@/hooks/useElections";

export interface DeployResponse {
  contractAddress: string;
  nftContractAddress: string;
  deployTxHash: string;
  nftDeployTxHash: string;
  totalVoters: number;
  durationSeconds: number;
  adminWallet: string;
  explorerUrl: string | null;
  nftExplorerUrl: string | null;
  nextStep: "admin_mint";
}

/**
 * Declenche le deploiement on-chain via le backend (Verivo paie le gas).
 */
export function useDeployElection(organizationSlug: string, electionId: string) {
  const [isDeploying, setIsDeploying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const deploy = useCallback(async (): Promise<DeployResponse> => {
    setIsDeploying(true);
    setError(null);
    try {
      return await api.post<DeployResponse>(
        `/api/organizations/${organizationSlug}/elections/${electionId}/deploy`,
        {}
      );
    } catch (err) {
      const message =
        err instanceof ApiError
          ? (err.data.error as string) || "Erreur serveur"
          : "Erreur inattendue";
      setError(message);
      throw err;
    } finally {
      setIsDeploying(false);
    }
  }, [organizationSlug, electionId]);

  return { deploy, isDeploying, error };
}

/**
 * Mint les NFTs de vote via wagmi (l'admin signe depuis son wallet).
 * Appelle VerivoVotingNFT.safeMintBatch(VoterConfig[]).
 */
export function useMintVotingNfts(nftContractAddress: string | null) {
  const { writeContractAsync, data: txHash } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
    hash: txHash,
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const mint = useCallback(
    async (voters: VoterRow[]) => {
      if (!nftContractAddress) {
        throw new Error("Contrat NFT pas deploye");
      }
      setIsSubmitting(true);
      setError(null);
      try {
        // VoterConfig { recipient, weight }
        const voterConfigs = voters.map((v) => ({
          recipient: v.walletAddress as `0x${string}`,
          weight: 1n,
        }));
        const hash = await writeContractAsync({
          address: nftContractAddress as `0x${string}`,
          abi: VERIVO_VOTING_NFT_ABI,
          functionName: "safeMintBatch",
          args: [voterConfigs],
        });
        return hash;
      } catch (err) {
        const message = err instanceof Error ? err.message : "Erreur de signature";
        setError(message);
        throw err;
      } finally {
        setIsSubmitting(false);
      }
    },
    [nftContractAddress, writeContractAsync]
  );

  return {
    mint,
    txHash,
    isSubmitting,
    isConfirming,
    isSuccess,
    error,
  };
}

/**
 * Factory pour creer un hook "admin action" sur VerivoVoting
 * (openVoting, closeVoting, tallyVotes — tous sans args).
 */
function useVotingAction(
  votingContractAddress: string | null | undefined,
  functionName: "openVoting" | "closeVoting" | "tallyVotes"
) {
  const { writeContractAsync, data: txHash } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
    hash: txHash,
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const trigger = useCallback(async () => {
    if (!votingContractAddress) {
      throw new Error("Contrat de vote pas deploye");
    }
    setIsSubmitting(true);
    setError(null);
    try {
      const hash = await writeContractAsync({
        address: votingContractAddress as `0x${string}`,
        abi: VERIVO_VOTING_ABI,
        functionName,
        args: [],
      });
      return hash;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Erreur de signature";
      setError(message);
      throw err;
    } finally {
      setIsSubmitting(false);
    }
  }, [votingContractAddress, writeContractAsync, functionName]);

  return { trigger, txHash, isSubmitting, isConfirming, isSuccess, error };
}

/**
 * Clot le scrutin (admin uniquement, ou n'importe qui apres la deadline).
 */
export function useCloseVoting(votingContractAddress: string | null | undefined) {
  const h = useVotingAction(votingContractAddress, "closeVoting");
  return { closeVoting: h.trigger, ...h };
}

/**
 * Depouille le scrutin (admin uniquement).
 */
export function useTallyVotes(votingContractAddress: string | null | undefined) {
  const h = useVotingAction(votingContractAddress, "tallyVotes");
  return { tallyVotes: h.trigger, ...h };
}

/**
 * Ouvre le scrutin on-chain via wagmi.
 * Appelle VerivoVoting.openVoting() depuis le wallet de l'admin.
 */
export function useOpenVoting(votingContractAddress: string | null) {
  const { writeContractAsync, data: txHash } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
    hash: txHash,
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const openVoting = useCallback(async () => {
    if (!votingContractAddress) {
      throw new Error("Contrat Voting pas deploye");
    }
    setIsSubmitting(true);
    setError(null);
    try {
      const hash = await writeContractAsync({
        address: votingContractAddress as `0x${string}`,
        abi: VERIVO_VOTING_ABI,
        functionName: "openVoting",
        args: [],
      });
      return hash;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Erreur de signature";
      setError(message);
      throw err;
    } finally {
      setIsSubmitting(false);
    }
  }, [votingContractAddress, writeContractAsync]);

  return {
    openVoting,
    txHash,
    isSubmitting,
    isConfirming,
    isSuccess,
    error,
  };
}
