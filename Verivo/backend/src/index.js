const express = require("express");
const cors = require("cors");
const organizationRoutes = require("./routes/organizations");
const authRoutes = require("./routes/auth");
const electionsRoutes = require("./routes/elections");
const meRoutes = require("./routes/me");
const publicRoutes = require("./routes/public");

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

app.use("/api/auth", authRoutes);
app.use("/api/organizations", organizationRoutes);
app.use("/api/organizations/:orgSlug/elections", electionsRoutes);
app.use("/api/me", meRoutes);
app.use("/api/public", publicRoutes);

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
