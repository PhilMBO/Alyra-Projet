import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Web3Provider } from "@/providers/Web3Provider";
import { AuthProvider } from "@/providers/AuthProvider";

const inter = Inter({ subsets: ["latin"] });

// Metadata pour le SEO (balises <title> et <meta>)
export const metadata: Metadata = {
  title: "Verivo",
  description: "Plateforme de vote decentralise pour organisations",
};

// Le layout racine est un Server Component (pas de "use client")
// Les providers sont des Client Components, mais on peut les utiliser
// comme enfants d'un Server Component — c'est le pattern standard Next.js
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <body className={`${inter.className} bg-surface text-text-primary min-h-screen`}>
        {/* Web3Provider fournit wagmi + RainbowKit */}
        <Web3Provider>
          {/* AuthProvider fournit l'etat d'authentification */}
          <AuthProvider>
            {children}
          </AuthProvider>
        </Web3Provider>
      </body>
    </html>
  );
}