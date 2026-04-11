"use client";

import { useState, useCallback } from "react";

// Donnees retournees par le formulaire au parent
export interface OrganizationFormData {
  displayName: string;
  organizationName: string;
  slug: string;
  logoUrl: string;
}

interface OrganizationFormProps {
  onSubmit: (data: OrganizationFormData) => Promise<void>;
  isLoading: boolean;
  error: string | null;
}

export function OrganizationForm({ onSubmit, isLoading, error }: OrganizationFormProps) {
  const [displayName, setDisplayName] = useState("");
  const [organizationName, setOrganizationName] = useState("");
  const [slug, setSlug] = useState("");
  const [logoUrl, setLogoUrl] = useState("");

  // Genere un slug a partir du nom de l'organisation
  // "Federation XYZ de France!" → "federation-xyz-de-france"
  const generateSlug = useCallback((name: string): string => {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")   // Remplace tout ce qui n'est pas alphanum par -
      .replace(/^-|-$/g, "");          // Supprime les - en debut/fin
  }, []);

  // Quand le nom change, on regenere le slug automatiquement
  const handleNameChange = (name: string) => {
    setOrganizationName(name);
    setSlug(generateSlug(name));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onSubmit({ displayName, organizationName, slug, logoUrl });
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      {/* Nom d'affichage de l'utilisateur */}
      <div className="flex flex-col gap-1">
        <label className="text-sm font-semibold text-text-secondary">
          Votre nom d affichage
        </label>
        <input
          type="text"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          placeholder="M. FedeX"
          required
          minLength={2}
          maxLength={255}
          className="rounded border border-border px-3 py-2.5 text-base focus:border-secondary focus:outline-none focus:ring-2 focus:ring-secondary/15"
        />
      </div>

      {/* Nom de l'organisation */}
      <div className="flex flex-col gap-1">
        <label className="text-sm font-semibold text-text-secondary">
          Nom de l organisation
        </label>
        <input
          type="text"
          value={organizationName}
          onChange={(e) => handleNameChange(e.target.value)}
          placeholder="Federation XYZ"
          required
          minLength={1}
          maxLength={255}
          className="rounded border border-border px-3 py-2.5 text-base focus:border-secondary focus:outline-none focus:ring-2 focus:ring-secondary/15"
        />
      </div>

      {/* Slug (auto-genere, modifiable) */}
      <div className="flex flex-col gap-1">
        <label className="text-sm font-semibold text-text-secondary">
          Slug (identifiant URL)
        </label>
        <input
          type="text"
          value={slug}
          onChange={(e) => setSlug(e.target.value)}
          placeholder="federation-xyz"
          required
          pattern="^[a-z0-9-]+$"
          title="Uniquement des lettres minuscules, chiffres et tirets"
          className="rounded border border-border px-3 py-2.5 font-mono text-sm focus:border-secondary focus:outline-none focus:ring-2 focus:ring-secondary/15"
        />
        <span className="text-xs text-text-secondary">
          verivo.io/org/{slug || "..."}
        </span>
      </div>

      {/* Logo URL (optionnel) */}
      <div className="flex flex-col gap-1">
        <label className="text-sm font-semibold text-text-secondary">
          Logo (URL, optionnel)
        </label>
        <input
          type="url"
          value={logoUrl}
          onChange={(e) => setLogoUrl(e.target.value)}
          placeholder="https://example.com/logo.png"
          className="rounded border border-border px-3 py-2.5 text-base focus:border-secondary focus:outline-none focus:ring-2 focus:ring-secondary/15"
        />
      </div>

      {/* Message d'erreur */}
      {error && (
        <p className="text-sm text-error">{error}</p>
      )}

      {/* Bouton de soumission */}
      <button
        type="submit"
        disabled={isLoading || !displayName || !organizationName || !slug}
        className="rounded bg-primary py-2.5 text-base text-white hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isLoading ? "Creation en cours..." : "Creer mon organisation"}
      </button>
    </form>
  );
}