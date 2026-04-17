"use client";

import type { VoterRow } from "@/hooks/useElections";

interface VoterListProps {
  voters: VoterRow[];
}

const NFT_STATUS_LABELS: Record<string, { label: string; className: string }> = {
  pending: { label: "En attente", className: "bg-border text-text-secondary" },
  minted: { label: "Mint", className: "bg-success/10 text-success" },
  burned: { label: "Brule", className: "bg-error/10 text-error" },
};

export function VoterList({ voters }: VoterListProps) {
  if (voters.length === 0) {
    return (
      <p className="rounded border border-dashed border-border p-6 text-center text-text-secondary">
        Aucun votant inscrit. Importez un CSV ci-dessus.
      </p>
    );
  }

  return (
    <div className="overflow-auto rounded border border-border">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-surface text-left text-xs uppercase text-text-secondary">
            <th className="px-3 py-2">Nom</th>
            <th className="px-3 py-2">Wallet</th>
            <th className="px-3 py-2">Statut NFT</th>
            <th className="px-3 py-2">Token ID</th>
          </tr>
        </thead>
        <tbody>
          {voters.map((v) => {
            const nftBadge = v.nftStatus
              ? NFT_STATUS_LABELS[v.nftStatus]
              : { label: "—", className: "text-text-secondary" };
            return (
              <tr key={v.userId} className="border-t border-border">
                <td className="px-3 py-2 font-semibold text-primary">
                  {v.displayName || "—"}
                </td>
                <td className="px-3 py-2 font-mono text-xs text-text-secondary">
                  {v.walletAddress.slice(0, 6)}...{v.walletAddress.slice(-4)}
                </td>
                <td className="px-3 py-2">
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-semibold ${nftBadge.className}`}
                  >
                    {nftBadge.label}
                  </span>
                </td>
                <td className="px-3 py-2 font-mono text-xs text-text-secondary">
                  {v.tokenId || "—"}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
