/**
 * Cree le schema tenant et ses tables pour une organisation.
 * A appeler dans une transaction.
 *
 * @param {PrismaClient|Prisma.TransactionClient} tx  Client Prisma
 * @param {string} schemaName  Ex: "tenant_federation_xyz"
 */
async function createTenantSchema(tx, schemaName) {
  // Securite : valider le nom du schema pour eviter les injections SQL
  if (!/^tenant_[a-z0-9_]+$/.test(schemaName)) {
    throw new Error(`schemaName invalide : "${schemaName}"`);
  }

  // Prisma.$executeRawUnsafe accepte l'interpolation directe.
  // Guillemets doubles pour les identifiants SQL.
  const s = `"${schemaName}"`;

  // 1. Creer le schema
  await tx.$executeRawUnsafe(`CREATE SCHEMA IF NOT EXISTS ${s}`);

  // 2. Enums du tenant
  await tx.$executeRawUnsafe(`
    CREATE TYPE ${s}.voting_system AS ENUM (
      'uninominal_1tour', 'uninominal_2tours',
      'jugement_majoritaire', 'approbation'
    )
  `);
  await tx.$executeRawUnsafe(`
    CREATE TYPE ${s}.election_status AS ENUM (
      'draft', 'open', 'closed', 'tallied', 'archived'
    )
  `);
  await tx.$executeRawUnsafe(`
    CREATE TYPE ${s}.nft_type AS ENUM ('voting_right', 'participation_proof')
  `);
  await tx.$executeRawUnsafe(`
    CREATE TYPE ${s}.nft_status AS ENUM ('pending', 'minted', 'burned')
  `);
  await tx.$executeRawUnsafe(`
    CREATE TYPE ${s}.choice_type AS ENUM ('candidate', 'proposal')
  `);

  // 3. Table elections
  await tx.$executeRawUnsafe(`
    CREATE TABLE ${s}.elections (
      id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      title               VARCHAR(255) NOT NULL,
      description         TEXT,
      voting_system       ${s}.voting_system NOT NULL,
      choice_type         ${s}.choice_type NOT NULL DEFAULT 'candidate',
      status              ${s}.election_status NOT NULL DEFAULT 'draft',
      start_date          TIMESTAMPTZ,
      end_date            TIMESTAMPTZ,
      contract_address    VARCHAR(42),
      quorum              INTEGER DEFAULT 0,
      created_by          UUID NOT NULL REFERENCES shared.users(id),
      created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
      CONSTRAINT chk_dates CHECK (end_date IS NULL OR end_date > start_date)
    )
  `);

  // 4. Table choices
  await tx.$executeRawUnsafe(`
    CREATE TABLE ${s}.choices (
      id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      election_id     UUID NOT NULL REFERENCES ${s}.elections(id) ON DELETE CASCADE,
      label           VARCHAR(255) NOT NULL,
      description     TEXT,
      position        INTEGER NOT NULL DEFAULT 0,
      created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);

  // 5. Table voter_registry
  await tx.$executeRawUnsafe(`
    CREATE TABLE ${s}.voter_registry (
      id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      election_id     UUID NOT NULL REFERENCES ${s}.elections(id) ON DELETE CASCADE,
      user_id         UUID NOT NULL REFERENCES shared.users(id),
      eligible        BOOLEAN NOT NULL DEFAULT true,
      registered_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
      UNIQUE (election_id, user_id)
    )
  `);

  // 6. Table voter_nfts
  await tx.$executeRawUnsafe(`
    CREATE TABLE ${s}.voter_nfts (
      id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      election_id         UUID NOT NULL REFERENCES ${s}.elections(id) ON DELETE CASCADE,
      user_id             UUID NOT NULL REFERENCES shared.users(id),
      nft_type            ${s}.nft_type NOT NULL,
      nft_status          ${s}.nft_status NOT NULL DEFAULT 'pending',
      token_id            BIGINT,
      contract_address    VARCHAR(42),
      mint_tx_hash        VARCHAR(66),
      burn_tx_hash        VARCHAR(66),
      minted_at           TIMESTAMPTZ,
      burned_at           TIMESTAMPTZ,
      metadata_uri        TEXT,
      created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
      UNIQUE (election_id, user_id, nft_type)
    )
  `);

  // 7. Table participation_log
  await tx.$executeRawUnsafe(`
    CREATE TABLE ${s}.participation_log (
      id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      election_id     UUID NOT NULL REFERENCES ${s}.elections(id) ON DELETE CASCADE,
      user_id         UUID NOT NULL REFERENCES shared.users(id),
      has_voted       BOOLEAN NOT NULL DEFAULT false,
      voted_at        TIMESTAMPTZ,
      tx_hash         VARCHAR(66),
      UNIQUE (election_id, user_id)
    )
  `);

  // 8. Table election_results
  await tx.$executeRawUnsafe(`
    CREATE TABLE ${s}.election_results (
      id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      election_id     UUID NOT NULL REFERENCES ${s}.elections(id) ON DELETE CASCADE,
      choice_id       UUID NOT NULL REFERENCES ${s}.choices(id) ON DELETE CASCADE,
      vote_count      INTEGER NOT NULL DEFAULT 0,
      percentage      DECIMAL(5,2),
      rank            INTEGER,
      tallied_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
      UNIQUE (election_id, choice_id)
    )
  `);

  // 9. Indexes
  await tx.$executeRawUnsafe(`CREATE INDEX idx_elections_status ON ${s}.elections (status)`);
  await tx.$executeRawUnsafe(`CREATE INDEX idx_choices_election ON ${s}.choices (election_id)`);
  await tx.$executeRawUnsafe(`CREATE INDEX idx_voter_registry_election ON ${s}.voter_registry (election_id)`);
  await tx.$executeRawUnsafe(`CREATE INDEX idx_voter_nfts_election ON ${s}.voter_nfts (election_id)`);
  await tx.$executeRawUnsafe(`CREATE INDEX idx_voter_nfts_user ON ${s}.voter_nfts (user_id)`);
  await tx.$executeRawUnsafe(`CREATE INDEX idx_participation_election ON ${s}.participation_log (election_id)`);
  await tx.$executeRawUnsafe(`CREATE INDEX idx_results_election ON ${s}.election_results (election_id)`);
}

function slugToSchemaName(slug) {
  const normalized = slug.toLowerCase().replace(/[^a-z0-9]/g, "_");
  return `tenant_${normalized}`;
}
module.exports = { createTenantSchema, slugToSchemaName };