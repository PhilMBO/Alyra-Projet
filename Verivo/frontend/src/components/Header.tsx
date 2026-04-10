"use client";

import { ConnectButton } from "@rainbow-me/rainbowkit";
import Image from "next/image";

export function Header() {
  return (
    <header className="bg-background border-b border-border px-6 py-4 shadow-card">
      <div className="mx-auto flex max-w-5xl items-center justify-between">
        {/* Logo + titre */}
        <div className="flex items-center gap-3">
          <Image
            src="/logoverivo.png"
            alt="Verivo"
            width={40}
            height={40}
            className="rounded"
          />
          <h1 className="text-xl font-bold text-primary">Verivo</h1>
        </div>

        {/* Bouton de connexion RainbowKit */}
        {/* ConnectButton gere tout : connexion, deconnexion, changement de chain */}
        <ConnectButton />
      </div>
    </header>
  );
}