"use client";

import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
import type { Election } from "@/lib/types";

export interface MyElection extends Election {
  organizationId: string;
  organizationName: string;
  organizationSlug: string;
  participation: {
    eligible: boolean;
    hasVoted: boolean;
    votedAt: string | null;
    voteTxHash: string | null;
    voteExplorerUrl: string | null;
    nft: {
      tokenId: string;
      contractAddress: string;
      status: "pending" | "minted" | "burned";
      mintTxHash: string | null;
      mintExplorerUrl: string | null;
      contractExplorerUrl: string | null;
    } | null;
  };
}

/**
 * Hook pour lister les scrutins ou l'user connecte est inscrit comme votant,
 * toutes organisations confondues.
 */
export function useMyElections() {
  const [elections, setElections] = useState<MyElection[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await api.get<{ elections: MyElection[] }>("/api/me/elections");
      setElections(data.elections);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur de chargement");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { elections, isLoading, error, refresh };
}
