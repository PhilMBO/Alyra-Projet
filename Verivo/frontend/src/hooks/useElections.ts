"use client";

import { useCallback, useEffect, useState } from "react";
import { api, ApiError } from "@/lib/api";
import type {
  Election,
  Choice,
  CreateElectionRequest,
  CreateElectionResponse,
} from "@/lib/types";

export interface VoterRow {
  userId: string;
  walletAddress: string;
  displayName: string | null;
  eligible: boolean;
  registeredAt: string;
  nftStatus: "pending" | "minted" | "burned" | null;
  tokenId: string | null;
}

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
 * Hook pour lister les votants inscrits.
 */
export function useVoters(organizationSlug: string, electionId: string) {
  const [voters, setVoters] = useState<VoterRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await api.get<{ voters: VoterRow[]; count: number }>(
        `/api/organizations/${organizationSlug}/elections/${electionId}/voters`
      );
      setVoters(data.voters);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur de chargement");
    } finally {
      setIsLoading(false);
    }
  }, [organizationSlug, electionId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { voters, isLoading, error, refresh };
}

/**
 * Hook pour supprimer un scrutin (draft uniquement).
 */
export function useDeleteElection(organizationSlug: string) {
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const deleteElection = useCallback(
    async (electionId: string): Promise<void> => {
      setIsDeleting(true);
      setError(null);
      try {
        await fetch(
          `/api/organizations/${organizationSlug}/elections/${electionId}`,
          {
            method: "DELETE",
            headers: {
              Authorization: `Bearer ${localStorage.getItem("verivo_token")}`,
            },
          }
        ).then(async (r) => {
          if (!r.ok) {
            const data = await r.json().catch(() => ({}));
            throw new ApiError(r.status, data);
          }
        });
      } catch (err) {
        const message =
          err instanceof ApiError
            ? (err.data.error as string) || "Erreur serveur"
            : "Erreur inattendue";
        setError(message);
        throw err;
      } finally {
        setIsDeleting(false);
      }
    },
    [organizationSlug]
  );

  return { deleteElection, isDeleting, error };
}

/**
 * Hook pour mettre a jour un scrutin (titre, dates, quorum — draft uniquement).
 */
export function useUpdateElection(
  organizationSlug: string,
  electionId: string
) {
  const [isUpdating, setIsUpdating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const updateElection = useCallback(
    async (patch: Partial<CreateElectionRequest>): Promise<Election> => {
      setIsUpdating(true);
      setError(null);
      try {
        const token = localStorage.getItem("verivo_token");
        const response = await fetch(
          `/api/organizations/${organizationSlug}/elections/${electionId}`,
          {
            method: "PATCH",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify(patch),
          }
        );
        const data = await response.json();
        if (!response.ok) throw new ApiError(response.status, data);
        return data;
      } catch (err) {
        const message =
          err instanceof ApiError
            ? (err.data.error as string) || "Erreur serveur"
            : "Erreur inattendue";
        setError(message);
        throw err;
      } finally {
        setIsUpdating(false);
      }
    },
    [organizationSlug, electionId]
  );

  return { updateElection, isUpdating, error };
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
