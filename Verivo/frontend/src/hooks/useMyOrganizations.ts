"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import type { Organization } from "@/lib/types";

/**
 * Hook pour recuperer la liste des organisations dont l'utilisateur est membre.
 */
export function useMyOrganizations() {
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    api
      .get<Organization[]>("/api/organizations")
      .then(setOrganizations)
      .catch(() => setOrganizations([]))
      .finally(() => setIsLoading(false));
  }, []);

  return { organizations, isLoading, count: organizations.length };
}
