"use client";

import { useMyOrganizations } from "./useMyOrganizations";
import type { MemberRole } from "@/lib/types";

/**
 * Retourne le role de l'utilisateur courant dans une organisation donnee.
 */
export function useOrgRole(orgSlug: string) {
  const { organizations, isLoading } = useMyOrganizations();
  const org = organizations.find((o) => o.slug === orgSlug);
  const role: MemberRole | undefined = org?.role;

  return {
    role,
    isAdmin: role === "admin",
    isOrganizer: role === "organizer",
    isMember: role === "member",
    canManage: role === "admin" || role === "organizer",
    isLoading,
    isKnown: Boolean(org),
  };
}
