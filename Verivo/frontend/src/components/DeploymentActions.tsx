"use client";

import { useEffect, useState } from "react";
import { useAccount } from "wagmi";
import type { Election } from "@/lib/types";
import {
  useDeployElection,
  useMintVotingNfts,
  useOpenVoting,
} from "@/hooks/useDeployment";
import { VoterRow } from "@/hooks/useElections";
import { api } from "@/lib/api";

interface DeploymentActionsProps {
  organizationSlug: string;
  election: Election;
  voters: VoterRow[];
  onStateChange: () => void;
}

export function DeploymentActions({
  organizationSlug,
  election,
  voters,
  onStateChange,
}: DeploymentActionsProps) {
  const { isConnected } = useAccount();

  const contractAddress = election.contractAddress;

  // Derivations d'etat
  const isDeployed = Boolean(contractAddress);
  const allMinted =
    voters.length > 0 && voters.every((v) => v.nftStatus === "minted");
  const someNotMinted =
    voters.length > 0 && voters.some((v) => v.nftStatus !== "minted");
  const canOpen = isDeployed && allMinted && election.status === "draft";

  // Hook deploy (backend)
  const { deploy, isDeploying, error: deployError } = useDeployElection(
    organizationSlug,
    election.id
  );

  // Hook mint (wagmi — admin wallet)
  // On cherche l'adresse du contrat NFT via le premier voter_nft
  const nftAddress = voters.find((v) => v.nftStatus)?.nftStatus
    ? // L'adresse est dans voter_nfts.contract_address — mais on ne l'a pas
      // dans VoterRow. On va la recuperer differemment :
      null
    : null;

  // Pour recuperer l'adresse du NFT, on appelle le backend /sync qui renvoie onChain.nftAddress
  const [nftContractAddress, setNftContractAddress] = useState<string | null>(null);

  // On recupere l'adresse NFT au premier rendu si le scrutin est deploye
  useEffect(() => {
    if (!isDeployed) return;
    let cancelled = false;
    api
      .post<{ onChain: { nftAddress: string } }>(
        `/api/organizations/${organizationSlug}/elections/${election.id}/sync`,
        {}
      )
      .then((data) => {
        if (!cancelled) setNftContractAddress(data.onChain.nftAddress);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [isDeployed, organizationSlug, election.id]);

  const {
    mint,
    isSubmitting: isMinting,
    isConfirming: isMintConfirming,
    isSuccess: isMintSuccess,
    error: mintError,
  } = useMintVotingNfts(nftContractAddress);

  const {
    openVoting,
    isSubmitting: isOpening,
    isConfirming: isOpenConfirming,
    isSuccess: isOpenSuccess,
    error: openError,
  } = useOpenVoting(contractAddress);

  // Apres mint confirme, synchroniser la DB
  useEffect(() => {
    if (isMintSuccess) {
      api
        .post(
          `/api/organizations/${organizationSlug}/elections/${election.id}/sync`,
          {}
        )
        .then(() => onStateChange())
        .catch(() => {});
    }
  }, [isMintSuccess, organizationSlug, election.id, onStateChange]);

  // Apres openVoting confirme, synchroniser la DB
  useEffect(() => {
    if (isOpenSuccess) {
      api
        .post(
          `/api/organizations/${organizationSlug}/elections/${election.id}/sync`,
          {}
        )
        .then(() => onStateChange())
        .catch(() => {});
    }
  }, [isOpenSuccess, organizationSlug, election.id, onStateChange]);

  // Handlers
  const handleDeploy = async () => {
    try {
      await deploy();
      onStateChange();
    } catch {
      // erreur affichee
    }
  };

  const handleMint = async () => {
    const notMinted = voters.filter((v) => v.nftStatus !== "minted");
    try {
      await mint(notMinted);
    } catch {
      // erreur affichee
    }
  };

  const handleOpen = async () => {
    try {
      await openVoting();
    } catch {
      // erreur affichee
    }
  };

  if (!isConnected) {
    return (
      <p className="rounded border border-warning/30 bg-warning/5 p-3 text-sm text-warning">
        Connectez votre wallet pour deployer le scrutin.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <Stepper
        current={
          !isDeployed ? 1 : !allMinted ? 2 : election.status === "draft" ? 3 : 4
        }
      />

      {/* Etape 1 : Deployer */}
      {!isDeployed && (
        <div className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-4">
          <p className="text-sm text-text-secondary">
            Verivo deploiera deux contrats on-chain : le registre NFT et le scrutin.
            Verivo paie le gas de ce deploiement.
          </p>
          <button
            onClick={handleDeploy}
            disabled={isDeploying || voters.length === 0}
            className="self-start rounded bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isDeploying ? "Deploiement en cours..." : "Deployer le scrutin"}
          </button>
          {voters.length === 0 && (
            <p className="text-xs text-warning">
              Importez au moins un votant avant de deployer.
            </p>
          )}
          {deployError && <p className="text-sm text-error">{deployError}</p>}
        </div>
      )}

      {/* Etape 2 : Minter les NFTs */}
      {isDeployed && someNotMinted && (
        <div className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-4">
          <p className="text-sm text-text-secondary">
            Les contrats sont deployes. Vous devez maintenant minter les NFTs de vote
            pour les {voters.filter((v) => v.nftStatus !== "minted").length} votants
            inscrits. Cette action est signee depuis votre wallet.
          </p>
          <button
            onClick={handleMint}
            disabled={isMinting || isMintConfirming || !nftContractAddress}
            className="self-start rounded bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isMinting
              ? "Signature..."
              : isMintConfirming
                ? "Confirmation on-chain..."
                : `Minter ${voters.filter((v) => v.nftStatus !== "minted").length} NFTs`}
          </button>
          {mintError && <p className="text-sm text-error">{mintError}</p>}
        </div>
      )}

      {/* Etape 3 : Ouvrir le vote */}
      {canOpen && (
        <div className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-4">
          <p className="text-sm text-text-secondary">
            Tous les NFTs sont mintes. Ouvrez le scrutin pour permettre aux votants
            de voter. Cette action est signee depuis votre wallet.
          </p>
          <button
            onClick={handleOpen}
            disabled={isOpening || isOpenConfirming}
            className="self-start rounded bg-success px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isOpening
              ? "Signature..."
              : isOpenConfirming
                ? "Confirmation on-chain..."
                : "Ouvrir le vote"}
          </button>
          {openError && <p className="text-sm text-error">{openError}</p>}
        </div>
      )}

      {/* Etape 4 : vote ouvert */}
      {election.status === "open" && (
        <div className="rounded-lg border border-success/30 bg-success/5 p-4">
          <p className="font-semibold text-success">Vote ouvert</p>
          <p className="text-sm text-text-secondary">
            Les votants peuvent desormais voter jusqu'a la date de fin.
          </p>
        </div>
      )}
    </div>
  );
}

function Stepper({ current }: { current: number }) {
  const steps = [
    { n: 1, label: "Deploiement" },
    { n: 2, label: "Mint NFTs" },
    { n: 3, label: "Ouverture" },
    { n: 4, label: "Vote en cours" },
  ];

  return (
    <ol className="flex items-center gap-2 text-sm">
      {steps.map((s, i) => {
        const done = s.n < current;
        const active = s.n === current;
        return (
          <li key={s.n} className="flex items-center gap-2">
            <span
              className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold ${
                done
                  ? "bg-success text-white"
                  : active
                    ? "bg-primary text-white"
                    : "bg-border text-text-secondary"
              }`}
            >
              {done ? "✓" : s.n}
            </span>
            <span
              className={
                active ? "font-semibold text-primary" : "text-text-secondary"
              }
            >
              {s.label}
            </span>
            {i < steps.length - 1 && (
              <span className="mx-1 text-text-secondary">→</span>
            )}
          </li>
        );
      })}
    </ol>
  );
}
