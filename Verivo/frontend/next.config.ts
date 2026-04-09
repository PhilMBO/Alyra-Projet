import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // "standalone" genere un serveur Node.js autonome pour Docker
  // Au lieu de copier tout node_modules, Next.js bundle uniquement ce qui est necessaire
  output: "standalone",

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