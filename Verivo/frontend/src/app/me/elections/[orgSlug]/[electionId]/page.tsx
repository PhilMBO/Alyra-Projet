"use client";

import Link from "next/link";
import { use } from "react";
import { useAccount, useReadContract } from "wagmi";
import { useElection } from "@/hooks/useElections";
import { useMyElections } from "@/hooks/useMyElections";
import { VERIVO_VOTING_NFT_ABI, VERIVO_VOTING_ABI } from "@/lib/contracts";

export default function VoterElectionDetailPage({
  params,
}: {
  params: Promise<{ orgSlug: string; electionId: string }>;
}) {
  const { orgSlug, electionId } = use(params);
  const { address } = useAccount();

  // Detail du scrutin + choix (meme endpoint que la vue admin, mais on cache les actions)
  const { election, choices, isLoading, error } = useElection(orgSlug, electionId);

  // Info de participation via /me/elections (pour avoir NFT status + hasVoted)
  const { elections: myElections } = useMyElections();
  const myEntry = myElections.find((e) => e.id === electionId);

  // Verification on-chain : balanceOf(monWallet) sur le contrat NFT
  const nftAddress = myEntry?.participation.nft?.contractAddress as
    | `0x${string}`
    | undefined;
  const { data: nftBalance, isLoading: isBalanceLoading } = useReadContract({
    address: nftAddress,
    abi: VERIVO_VOTING_NFT_ABI,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    query: { enabled: Boolean(nftAddress && address) },
  });

  // Verification on-chain : hasVoted sur le contrat Voting
  const votingAddress = election?.contractAddress as `0x${string}` | undefined;
  const { data: hasVotedOnChain } = useReadContract({
    address: votingAddress,
    abi: VERIVO_VOTING_ABI,
    functionName: "hasVoted",
    args: address ? [address] : undefined,
    query: { enabled: Boolean(votingAddress && address) },
  });

  if (isLoading) return <p className="text-text-secondary">Chargement...</p>;
  if (error || !election) {
    return (
      <div>
        <Link href="/me/elections" className="text-sm text-text-secondary hover:text-primary">
          ← Retour
        </Link>
        <p className="mt-2 text-error">{error || "Scrutin introuvable"}</p>
      </div>
    );
  }

  const nftBalanceNum = nftBalance !== undefined ? Number(nftBalance) : null;
  const isNftVerified = nftBalanceNum === 1;
  const nftDbStatus = myEntry?.participation.nft?.status;
  const isConsistent =
    nftDbStatus === "minted" ? nftBalanceNum === 1 : nftDbStatus !== "minted";

  return (
    <div className="flex flex-col gap-6">
      <Link
        href="/me/elections"
        className="text-sm text-text-secondary hover:text-primary"
      >
        ← Mes scrutins
      </Link>

      <div>
        <p className="text-sm text-text-secondary">
          {myEntry?.organizationName}
        </p>
        <h1 className="text-2xl font-bold text-primary">{election.title}</h1>
        {election.description && (
          <p className="mt-2 text-text-secondary">{election.description}</p>
        )}
      </div>

      {/* Verification on-chain */}
      <section className="rounded-lg border border-border bg-background p-6 shadow-card">
        <h2 className="mb-4 font-semibold text-primary">Verification de votre inscription</h2>

        <div className="grid grid-cols-2 gap-4">
          <VerifyRow
            label="Inscrit(e) dans la liste (DB)"
            ok={myEntry?.participation.eligible === true}
            detail={myEntry?.participation.eligible ? "Oui" : "Non"}
          />
          <VerifyRow
            label="NFT de vote en DB"
            ok={nftDbStatus === "minted"}
            detail={
              nftDbStatus === "minted"
                ? `Token #${myEntry?.participation.nft?.tokenId}`
                : nftDbStatus === "pending"
                  ? "En attente de mint"
                  : "Aucun"
            }
          />
          <VerifyRow
            label="NFT possede on-chain (balanceOf)"
            ok={isNftVerified}
            detail={
              isBalanceLoading
                ? "Verification..."
                : nftBalanceNum !== null
                  ? `${nftBalanceNum} NFT`
                  : "Non verifie"
            }
          />
          <VerifyRow
            label="Coherence DB / blockchain"
            ok={isConsistent}
            detail={isConsistent ? "Donnees coherentes" : "Desynchronise"}
          />
        </div>

        {myEntry?.participation.nft?.contractExplorerUrl && (
          <div className="mt-4 flex flex-col gap-1 text-sm">
            <a
              href={myEntry.participation.nft.contractExplorerUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-secondary hover:underline"
            >
              Voir le contrat NFT sur l'explorateur →
            </a>
            {myEntry.participation.nft.mintExplorerUrl && (
              <a
                href={myEntry.participation.nft.mintExplorerUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-secondary hover:underline"
              >
                Voir la transaction de mint →
              </a>
            )}
          </div>
        )}
      </section>

      {/* Statut du vote */}
      {election.status === "open" && (
        <section className="rounded-lg border border-border bg-background p-6 shadow-card">
          <h2 className="mb-2 font-semibold text-primary">Statut du scrutin</h2>
          {hasVotedOnChain === true ? (
            <p className="rounded border border-success/30 bg-success/5 p-3 text-sm text-success">
              Vous avez deja vote. Merci pour votre participation.
            </p>
          ) : isNftVerified ? (
            <p className="rounded border border-secondary/30 bg-secondary/5 p-3 text-sm text-secondary">
              Le scrutin est ouvert. Vous pouvez voter (fonctionnalite UC-5 a venir).
            </p>
          ) : (
            <p className="rounded border border-warning/30 bg-warning/5 p-3 text-sm text-warning">
              Vous n'avez pas de NFT de vote. Contactez l'administrateur.
            </p>
          )}
        </section>
      )}

      {/* Choix */}
      <section className="rounded-lg border border-border bg-background p-6 shadow-card">
        <h2 className="mb-4 font-semibold text-primary">
          {election.choiceType === "candidate" ? "Candidats" : "Propositions"} (
          {choices.length})
        </h2>
        <ul className="flex flex-col gap-2">
          {choices.map((c) => (
            <li
              key={c.id}
              className="flex items-center gap-3 rounded border border-border p-3"
            >
              <span className="text-sm font-semibold text-text-secondary">
                #{c.position + 1}
              </span>
              <div>
                <p className="font-semibold text-primary">{c.label}</p>
                {c.description && (
                  <p className="text-sm text-text-secondary">{c.description}</p>
                )}
              </div>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

function VerifyRow({
  label,
  ok,
  detail,
}: {
  label: string;
  ok: boolean;
  detail: string;
}) {
  return (
    <div className="flex items-start gap-2">
      <span
        className={`mt-1 flex h-5 w-5 items-center justify-center rounded-full text-xs font-bold ${
          ok ? "bg-success text-white" : "bg-border text-text-secondary"
        }`}
      >
        {ok ? "✓" : "—"}
      </span>
      <div>
        <p className="text-sm font-semibold text-primary">{label}</p>
        <p className="text-xs text-text-secondary">{detail}</p>
      </div>
    </div>
  );
}
