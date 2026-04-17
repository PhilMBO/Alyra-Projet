"use client";

import { useRef, useState } from "react";
import { useCsvImport } from "@/hooks/useCsvImport";

interface CsvUploaderProps {
  organizationSlug: string;
  electionId: string;
  onImportSuccess?: () => void;
}

export function CsvUploader({
  organizationSlug,
  electionId,
  onImportSuccess,
}: CsvUploaderProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const {
    preview,
    parseErrors,
    fileName,
    selectFile,
    upload,
    isUploading,
    uploadError,
    report,
    reset,
  } = useCsvImport(organizationSlug, electionId);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setSelectedFile(file);
    selectFile(file);
  };

  const handleUpload = async () => {
    if (!selectedFile) return;
    try {
      await upload(selectedFile);
      onImportSuccess?.();
    } catch {
      // erreur geree dans le hook
    }
  };

  const handleReset = () => {
    setSelectedFile(null);
    reset();
    if (inputRef.current) inputRef.current.value = "";
  };

  return (
    <div className="flex flex-col gap-4">
      {!selectedFile && (
        <label className="flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-border bg-surface p-8 cursor-pointer hover:border-secondary">
          <span className="text-4xl">📥</span>
          <span className="font-semibold text-primary">Selectionner un CSV</span>
          <span className="text-xs text-text-secondary">
            Colonnes : nom, prenom, email, club, wallet_address (obligatoire)
          </span>
          <input
            ref={inputRef}
            type="file"
            accept=".csv,text/csv"
            onChange={handleFileChange}
            className="hidden"
          />
        </label>
      )}

      {selectedFile && !report && (
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between rounded border border-border p-3">
            <span className="font-semibold text-primary">{fileName}</span>
            <button
              onClick={handleReset}
              className="text-sm text-error hover:underline"
            >
              Retirer
            </button>
          </div>

          {parseErrors.length > 0 && (
            <div className="rounded border border-error/30 bg-error/5 p-3">
              <p className="mb-1 font-semibold text-error">Erreurs de parsing :</p>
              <ul className="list-disc pl-5 text-sm text-error">
                {parseErrors.map((e, i) => (
                  <li key={i}>{e}</li>
                ))}
              </ul>
            </div>
          )}

          {preview.length > 0 && (
            <div className="overflow-auto rounded border border-border">
              <div className="bg-surface px-3 py-2 text-sm font-semibold text-text-secondary">
                Apercu ({preview.length} lignes)
              </div>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-t border-border bg-surface text-left text-xs uppercase text-text-secondary">
                    <th className="px-3 py-2">#</th>
                    <th className="px-3 py-2">Nom</th>
                    <th className="px-3 py-2">Prenom</th>
                    <th className="px-3 py-2">Wallet</th>
                    <th className="px-3 py-2">Email</th>
                    <th className="px-3 py-2">Club</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.slice(0, 20).map((row, i) => (
                    <tr key={i} className="border-t border-border">
                      <td className="px-3 py-2 text-text-secondary">{i + 1}</td>
                      <td className="px-3 py-2">{row.nom || "—"}</td>
                      <td className="px-3 py-2">{row.prenom || "—"}</td>
                      <td className="px-3 py-2 font-mono text-xs">
                        {row.wallet_address ? (
                          <span
                            className={
                              /^0x[a-fA-F0-9]{40}$/.test(row.wallet_address)
                                ? "text-success"
                                : "text-error"
                            }
                          >
                            {row.wallet_address.slice(0, 10)}...
                          </span>
                        ) : (
                          <span className="text-error">manquant</span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-text-secondary">
                        {row.email || "—"}
                      </td>
                      <td className="px-3 py-2 text-text-secondary">
                        {row.club || "—"}
                      </td>
                    </tr>
                  ))}
                  {preview.length > 20 && (
                    <tr>
                      <td
                        colSpan={6}
                        className="px-3 py-2 text-center text-xs text-text-secondary"
                      >
                        ... et {preview.length - 20} autres lignes
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}

          {uploadError && (
            <p className="text-sm text-error">{uploadError}</p>
          )}

          <button
            onClick={handleUpload}
            disabled={isUploading || preview.length === 0 || parseErrors.length > 0}
            className="rounded bg-primary py-2.5 text-white hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isUploading ? "Import en cours..." : `Importer ${preview.length} lignes`}
          </button>
        </div>
      )}

      {report && (
        <div className="flex flex-col gap-3 rounded border border-success/30 bg-success/5 p-4">
          <p className="font-semibold text-primary">Import termine</p>

          <div className="grid grid-cols-4 gap-2 text-center text-sm">
            <div className="rounded bg-background p-2">
              <p className="text-2xl font-bold text-success">{report.imported}</p>
              <p className="text-xs text-text-secondary">Importes</p>
            </div>
            <div className="rounded bg-background p-2">
              <p className="text-2xl font-bold text-secondary">{report.created}</p>
              <p className="text-xs text-text-secondary">Nouveaux</p>
            </div>
            <div className="rounded bg-background p-2">
              <p className="text-2xl font-bold text-warning">{report.skipped}</p>
              <p className="text-xs text-text-secondary">Ignores</p>
            </div>
            <div className="rounded bg-background p-2">
              <p className="text-2xl font-bold text-error">{report.rejected}</p>
              <p className="text-xs text-text-secondary">Rejetes</p>
            </div>
          </div>

          {report.errors.length > 0 && (
            <div>
              <p className="mb-1 text-sm font-semibold text-text-secondary">
                Erreurs :
              </p>
              <ul className="list-disc pl-5 text-sm text-error">
                {report.errors.slice(0, 10).map((e, i) => (
                  <li key={i}>{e}</li>
                ))}
                {report.errors.length > 10 && (
                  <li>... et {report.errors.length - 10} autres</li>
                )}
              </ul>
            </div>
          )}

          <button
            onClick={handleReset}
            className="self-start rounded border border-border px-3 py-1.5 text-sm hover:bg-surface"
          >
            Importer un autre CSV
          </button>
        </div>
      )}
    </div>
  );
}
