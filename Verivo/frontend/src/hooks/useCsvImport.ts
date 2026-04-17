"use client";

import { useCallback, useState } from "react";
import Papa from "papaparse";

// Colonnes reconnues dans le CSV (tout lowercase, trim)
export interface CsvRow {
  nom?: string;
  prenom?: string;
  email?: string;
  club?: string;
  wallet_address?: string;
}

export interface ImportReport {
  imported: number;
  created: number;
  skipped: number;
  rejected: number;
  errors: string[];
  voters: Array<{
    userId: string;
    walletAddress: string;
    displayName: string;
    created: boolean;
  }>;
}

/**
 * Hook pour :
 *   1. Parser un CSV cote client (preview avant envoi)
 *   2. Envoyer le fichier au backend pour validation + import
 */
export function useCsvImport(organizationSlug: string, electionId: string) {
  const [preview, setPreview] = useState<CsvRow[]>([]);
  const [parseErrors, setParseErrors] = useState<string[]>([]);
  const [fileName, setFileName] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [report, setReport] = useState<ImportReport | null>(null);

  const selectFile = useCallback((file: File) => {
    setFileName(file.name);
    setParseErrors([]);
    setPreview([]);
    setReport(null);
    setUploadError(null);

    Papa.parse<CsvRow>(file, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (h) => h.toLowerCase().trim(),
      transform: (v) => (typeof v === "string" ? v.trim() : v),
      complete: (result) => {
        const errors = result.errors
          .filter((e) => e.type === "Quotes" || e.type === "Delimiter")
          .map((e) => `Ligne ${e.row ?? "?"} : ${e.message}`);
        setParseErrors(errors);
        setPreview(result.data);
      },
      error: (error) => {
        setParseErrors([error.message]);
      },
    });
  }, []);

  const upload = useCallback(async (file: File): Promise<ImportReport> => {
    setIsUploading(true);
    setUploadError(null);
    setReport(null);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const token = localStorage.getItem("verivo_token");
      const response = await fetch(
        `/api/organizations/${organizationSlug}/elections/${electionId}/voters/import`,
        {
          method: "POST",
          headers: token ? { Authorization: `Bearer ${token}` } : {},
          body: formData,
        }
      );

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Erreur serveur");
      }

      setReport(data);
      return data;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Erreur inattendue";
      setUploadError(message);
      throw err;
    } finally {
      setIsUploading(false);
    }
  }, [organizationSlug, electionId]);

  const reset = useCallback(() => {
    setPreview([]);
    setParseErrors([]);
    setFileName(null);
    setReport(null);
    setUploadError(null);
  }, []);

  return {
    preview,
    parseErrors,
    fileName,
    selectFile,
    upload,
    isUploading,
    uploadError,
    report,
    reset,
  };
}
