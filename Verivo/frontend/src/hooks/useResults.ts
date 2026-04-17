"use client";

import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
import type { Election } from "@/lib/types";

export interface ElectionResult {
  choiceId: string;
  label: string;
  description: string | null;
  position: number;
  voteCount: number;
  percentage: number;
  rank: number;
  isWinner: boolean;
}

export interface ResultsSummary {
  totalVotes: number;
  totalRegistered: number;
  participationRate: number;
  quorum: number;
  quorumReached: boolean;
  winningChoiceIndex: number;
  winningChoiceLabel: string | null;
}

export interface ResultsPayload {
  election: Election;
  results: ElectionResult[];
  summary: ResultsSummary;
  explorerUrl: string | null;
}

/**
 * Hook pour recuperer les resultats d'un scrutin depouille.
 * Appelle GET /elections/:id/results.
 */
export function useResults(organizationSlug: string, electionId: string) {
  const [data, setData] = useState<ResultsPayload | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const payload = await api.get<ResultsPayload>(
        `/api/organizations/${organizationSlug}/elections/${electionId}/results`
      );
      setData(payload);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Erreur de chargement";
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }, [organizationSlug, electionId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { data, isLoading, error, refresh };
}
