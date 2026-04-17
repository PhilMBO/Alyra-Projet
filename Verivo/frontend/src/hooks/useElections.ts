"use client";

import { useCallback, useEffect, useState } from "react";
import { api, ApiError } from "@/lib/api";
import type {
  Election,
  Choice,
  CreateElectionRequest,
  CreateElectionResponse,
} from "@/lib/types";

/**
 * Hook pour lister les scrutins d'une organisation.
 */
export function useElectionList(organizationSlug: string | null) {
  const [elections, setElections] = useState<Election[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!organizationSlug) return;
    setIsLoading(true);
    setError(null);
    try {
      const data = await api.get<Election[]>(
        `/api/organizations/${organizationSlug}/elections`
      );
      setElections(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur de chargement");
    } finally {
      setIsLoading(false);
    }
  }, [organizationSlug]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { elections, isLoading, error, refresh };
}

/**
 * Hook pour charger un scrutin unique avec ses choix.
 */
export function useElection(organizationSlug: string, electionId: string) {
  const [election, setElection] = useState<Election | null>(null);
  const [choices, setChoices] = useState<Choice[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await api.get<{ election: Election; choices: Choice[] }>(
        `/api/organizations/${organizationSlug}/elections/${electionId}`
      );
      setElection(data.election);
      setChoices(data.choices);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur de chargement");
    } finally {
      setIsLoading(false);
    }
  }, [organizationSlug, electionId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { election, choices, isLoading, error, refresh };
}

/**
 * Hook pour creer un scrutin.
 */
export function useCreateElection(organizationSlug: string) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const createElection = useCallback(
    async (data: CreateElectionRequest): Promise<CreateElectionResponse> => {
      setIsSubmitting(true);
      setError(null);
      try {
        const response = await api.post<CreateElectionResponse>(
          `/api/organizations/${organizationSlug}/elections`,
          data
        );
        return response;
      } catch (err) {
        const message =
          err instanceof ApiError
            ? (err.data.error as string) || "Erreur serveur"
            : "Erreur inattendue";
        setError(message);
        throw err;
      } finally {
        setIsSubmitting(false);
      }
    },
    [organizationSlug]
  );

  return { createElection, isSubmitting, error };
}
