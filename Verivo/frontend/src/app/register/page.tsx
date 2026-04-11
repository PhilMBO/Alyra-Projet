"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useConnection } from "wagmi";            // ancien useAccount (deprecie wagmi v3)
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { StepIndicator } from "@/components/StepIndicator";
import { OrganizationForm, type OrganizationFormData } from "@/components/OrganizationForm";
import { useAuth } from "@/hooks/useAuth";
import { useSiwe, type SiweResult } from "@/hooks/useSiwe";
import { ApiError } from "@/lib/api";

const STEPS = ["Wallet", "Signature", "Organisation"];

export default function RegisterPage() {
  const router = useRouter();
  const { isAuthenticated, isLoading: authLoading, register } = useAuth();
  const { address, isConnected } = useConnection();  // Etat du wallet via wagmi
  const { signIn, isLoading: siweLoading, error: siweError } = useSiwe();

  const [step, setStep] = useState(1);
  const [siweData, setSiweData] = useState<SiweResult | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Si deja authentifie, rediriger vers le dashboard
  useEffect(() => {
    if (!authLoading && isAuthenticated) {
      router.replace("/dashboard");
    }
  }, [authLoading, isAuthenticated, router]);

  // Quand le wallet se connecte, avancer a l'etape 2
  useEffect(() => {
    if (isConnected && step === 1) {
      setStep(2);
    }
    // Si le wallet se deconnecte, revenir a l'etape 1
    if (!isConnected && step > 1) {
      setStep(1);
      setSiweData(null);
    }
  }, [isConnected, step]);

  // Etape 2 : signer le message SIWE
  const handleSign = async () => {
    try {
      const result = await signIn();
      setSiweData(result);
      setStep(3);
    } catch {
      // L'erreur est deja geree dans useSiwe
    }
  };

  // Etape 3 : soumettre le formulaire d'organisation
  const handleOrganizationSubmit = async (formData: OrganizationFormData) => {
    if (!address || !siweData) return;

    setIsSubmitting(true);
    setSubmitError(null);

    try {
      await register({
        authMethod: "wallet",
        walletAddress: address,
        signature: siweData.signature,
        message: siweData.message,
        displayName: formData.displayName,
        organization: {
          name: formData.organizationName,
          slug: formData.slug,
          logoUrl: formData.logoUrl || undefined,
        },
      });

      // Succes ! Redirection vers le dashboard
      router.push("/dashboard");
    } catch (err) {
      if (err instanceof ApiError) {
        // Erreurs metier connues
        if (err.status === 409) {
          setSubmitError(
            (err.data.error as string) || "Ce wallet ou slug est deja utilise"
          );
        } else if (err.status === 400) {
          setSubmitError("Donnees invalides. Verifiez le formulaire.");
        } else {
          setSubmitError("Erreur serveur. Reessayez plus tard.");
        }
      } else {
        setSubmitError("Une erreur inattendue est survenue.");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  // Ne rien afficher pendant la verification de l'auth
  if (authLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-text-secondary">Chargement...</p>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo et titre */}
        <div className="mb-8 text-center">
          <img
            src="/logoverivo.png"
            alt="Verivo"
            className="mx-auto h-16 w-16"
          />
          <h1 className="mt-4 text-2xl font-bold text-primary">
            Bienvenue sur Verivo
          </h1>
          <p className="mt-1 text-text-secondary">
            Creez votre espace de vote decentralise
          </p>
        </div>

        {/* Indicateur d'etapes */}
        <div className="mb-8">
          <StepIndicator currentStep={step} steps={STEPS} />
        </div>

        {/* Contenu selon l'etape */}
        <div className="rounded-lg border border-border bg-background p-6 shadow-card">

          {/* ETAPE 1 : Connecter le wallet */}
          {step === 1 && (
            <div className="flex flex-col items-center gap-4">
              <h2 className="text-lg font-semibold text-primary">
                Connectez votre wallet
              </h2>
              <p className="text-center text-sm text-text-secondary">
                Votre wallet Ethereum servira d identifiant pour acceder a Verivo.
                Aucun mot de passe necessaire.
              </p>
              <ConnectButton />
            </div>
          )}

          {/* ETAPE 2 : Signer le message SIWE */}
          {step === 2 && (
            <div className="flex flex-col items-center gap-4">
              <h2 className="text-lg font-semibold text-primary">
                Prouvez votre identite
              </h2>
              <p className="text-center text-sm text-text-secondary">
                Signez un message pour prouver que vous possedez ce wallet.
                Aucune transaction, aucun frais.
              </p>
              <p className="rounded bg-surface px-3 py-1 font-mono text-xs text-text-secondary">
                {address?.slice(0, 6)}...{address?.slice(-4)}
              </p>
              {siweError && (
                <p className="text-sm text-error">{siweError}</p>
              )}
              <button
                onClick={handleSign}
                disabled={siweLoading}
                className="w-full rounded bg-primary py-2.5 text-white hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-60"
              >
                {siweLoading ? "Signature en cours..." : "Signer le message"}
              </button>
            </div>
          )}

          {/* ETAPE 3 : Formulaire organisation */}
          {step === 3 && (
            <div className="flex flex-col gap-4">
              <h2 className="text-lg font-semibold text-primary">
                Creez votre organisation
              </h2>
              <p className="text-sm text-text-secondary">
                Renseignez les informations de votre federation, association
                ou collectivite.
              </p>
              <OrganizationForm
                onSubmit={handleOrganizationSubmit}
                isLoading={isSubmitting}
                error={submitError}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}