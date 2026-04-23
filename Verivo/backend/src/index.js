const express = require("express");
const cors = require("cors");
const organizationRoutes = require("./routes/organizations");
const authRoutes = require("./routes/auth");
const electionsRoutes = require("./routes/elections");
const meRoutes = require("./routes/me");
const publicRoutes = require("./routes/public");
const { ensureFactoryDeployed } = require("./lib/factory");

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// Healthcheck — repond avant meme l'init factory, utile pour Railway/Vercel/uptime monitoring
app.get("/api/health", (req, res) => res.json({ status: "ok" }));

app.use("/api/auth", authRoutes);
app.use("/api/organizations", organizationRoutes);
app.use("/api/organizations/:orgSlug/elections", electionsRoutes);
app.use("/api/me", meRoutes);
app.use("/api/public", publicRoutes);

// 1. Demarrer le serveur IMMEDIATEMENT pour que la plateforme (Railway)
//    detecte le port ouvert et ne timeout pas. 0.0.0.0 est obligatoire en
//    container (127.0.0.1 n'est pas joignable depuis le proxy).
app.listen(PORT, "0.0.0.0", () => {
  console.log(`Server running on http://0.0.0.0:${PORT}`);
});

// 2. Init factory EN BACKGROUND : n'empeche pas le serveur de demarrer,
//    mais log une erreur claire si l'RPC est injoignable.
ensureFactoryDeployed()
  .then((addr) => console.log(`[factory] Prete a ${addr}`))
  .catch((err) => console.error("[factory] Echec init :", err.message));
