import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // "standalone" : genere un serveur Node.js autonome pour Docker.
  // Sur Vercel (VERCEL=1 auto-set), on laisse undefined car Vercel utilise
  // son propre format de deploiement et standalone casse le routing (404).
  output: process.env.VERCEL ? undefined : "standalone",

  // Proxy : quand le frontend appelle /api/*, Next.js redirige vers le backend
  // Le navigateur ne voit que /api/* (meme origine), pas de probleme CORS
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: `${process.env.BACKEND_URL || "http://localhost:3001"}/api/:path*`,
      },
    ];
  },

  // Autorise le chargement d'images depuis n'importe quel domaine HTTPS
  // (pour les logos d'organisations)
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "**" },
    ],
  },
};

export default nextConfig;