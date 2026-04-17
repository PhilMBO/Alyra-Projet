"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAccount } from "wagmi";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { StepIndicator } from "@/components/StepIndicator";
import { useAuth } from "@/hooks/useAuth";
import { useSiwe } from "@/hooks/useSiwe";
import { ApiError } from "@/lib/api";

const STEPS = ["Wallet", "Signature"];

export default function LoginPage() {
  const router = useRouter();
  const { isAuthenticated, isLoading: authLoading, login } = useAuth();
  const { address, isConnected } = useAccount();
  const { signIn, isLoading: siweLoading, error: siweError } = useSiwe();

  const [step, setStep] = useState(1);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Si deja authentifie, rediriger vers le dashboard
  useEffect(() => {
    if (!authLoading && isAuthenticated) {
      router.replace("/dashboard");
    }
  }, [authLoading, isAuthenticated, router]);

  // Wallet connecte → etape 2
  useEffect(() => {
    if (isConnected && step === 1) setStep(2);
    if (!isConnected && step > 1) setStep(1);
  }, [isConnected, step]);

  const handleSignAndLogin = async () => {
    if (!address) return;
    setLoginError(null);
    setIsSubmitting(true);
    try {
      // 1. Signer le message SIWE
      const { message, signature } = await signIn();

      // 2. Envoyer au backend pour obtenir un JWT
      await login({
        walletAddress: address,
        message,
        signature,
      });

      // 3. Redirection (le layout dashboard gere ensuite la redirection specifique)
      router.push("/dashboard");
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.status === 404) {
          setLoginError(
            "Wallet non enregistre. Creez un compte via l'inscription."
          );
        } else if (err.status === 401) {
          setLoginError("Signature invalide. Reessayez.");
        } else {
          setLoginError((err.data.error as string) || "Erreur serveur");
        }
      } else {
        setLoginError("Une erreur est survenue.");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

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
        <div className="mb-8 text-center">
          <img src="/logoverivo.png" alt="Verivo" className="mx-auto h-16 w-16" />
          <h1 className="mt-4 text-2xl font-bold text-primary">Connexion</h1>
          <p className="mt-1 text-text-secondary">
            Connectez-vous avec votre wallet pour acceder a Verivo
          </p>
        </div>

        <div className="mb-8">
          <StepIndicator currentStep={step} steps={STEPS} />
        </div>

        <div className="rounded-lg border border-border bg-background p-6 shadow-card">
          {step === 1 && (
            <div className="flex flex-col items-center gap-4">
              <h2 className="text-lg font-semibold text-primary">
                Connectez votre wallet
              </h2>
              <p className="text-center text-sm text-text-secondary">
                Utilisez le meme wallet que celui avec lequel vous vous etes inscrit.
              </p>
              <ConnectButton />
            </div>
          )}

          {step === 2 && (
            <div className="flex flex-col items-center gap-4">
              <h2 className="text-lg font-semibold text-primary">
                Prouvez votre identite
              </h2>
              <p className="text-center text-sm text-text-secondary">
                Signez un message pour valider votre connexion.
                Aucune transaction, aucun frais.
              </p>
              <p className="rounded bg-surface px-3 py-1 font-mono text-xs text-text-secondary">
                {address?.slice(0, 6)}...{address?.slice(-4)}
              </p>

              {(siweError || loginError) && (
                <p className="w-full rounded border border-error/30 bg-error/5 p-2 text-center text-sm text-error">
                  {siweError || loginError}
                </p>
              )}

              <button
                onClick={handleSignAndLogin}
                disabled={siweLoading || isSubmitting}
                className="w-full rounded bg-primary py-2.5 text-white hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-60"
              >
                {siweLoading
                  ? "Signature en cours..."
                  : isSubmitting
                    ? "Connexion..."
                    : "Se connecter"}
              </button>
            </div>
          )}
        </div>

        <p className="mt-6 text-center text-sm text-text-secondary">
          Pas encore inscrit ?{" "}
          <Link href="/register" className="text-secondary hover:underline">
            Creer un compte
          </Link>
        </p>
      </div>
    </div>
  );
}
