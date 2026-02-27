-- ============================================================================
-- Verivo - Modèle de base de données multi-tenant
-- Architecture : PostgreSQL avec isolation par schéma (un schéma par organisation)
-- ============================================================================

-- ===========================================
-- SCHÉMA SHARED (données globales cross-tenant)
-- ===========================================

CREATE SCHEMA IF NOT EXISTS shared;

-- Types énumérés globaux
CREATE TYPE shared.org_status AS ENUM ('active', 'suspended', 'archived');
CREATE TYPE shared.member_role AS ENUM ('admin', 'organizer', 'member');
CREATE TYPE shared.auth_method AS ENUM ('wallet', 'email');

-- -------------------------------------------
-- Table : organizations
-- Liste de toutes les organisations (tenants)
-- -------------------------------------------
CREATE TABLE shared.organizations (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name            VARCHAR(255) NOT NULL,
    slug            VARCHAR(100) NOT NULL UNIQUE,
    schema_name     VARCHAR(100) NOT NULL UNIQUE,
    logo_url        TEXT,
    status          shared.org_status NOT NULL DEFAULT 'active',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_organizations_status ON shared.organizations (status);

-- -------------------------------------------
-- Table : users
-- Utilisateurs globaux (cross-tenant)
-- Deux modes d'authentification :
--   - wallet : l'utilisateur se connecte avec MetaMask/WalletConnect
--   - email  : l'utilisateur se connecte par email/mot de passe,
--              le backend gère un wallet custodial pour lui
-- -------------------------------------------
CREATE TABLE shared.users (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    auth_method         shared.auth_method NOT NULL,
    wallet_address      VARCHAR(42) UNIQUE,
    email               VARCHAR(255) UNIQUE,
    password_hash       VARCHAR(255),
    display_name        VARCHAR(255),
    identity_verified   BOOLEAN NOT NULL DEFAULT false,
    is_custodial        BOOLEAN NOT NULL DEFAULT false,
    custodial_key_enc   TEXT,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),

    -- Un utilisateur wallet doit avoir une adresse
    CONSTRAINT chk_wallet CHECK (
        auth_method != 'wallet' OR wallet_address IS NOT NULL
    ),
    -- Un utilisateur email doit avoir un email et un mot de passe
    CONSTRAINT chk_email CHECK (
        auth_method != 'email' OR (email IS NOT NULL AND password_hash IS NOT NULL)
    ),
    -- Un wallet custodial doit avoir sa clé chiffrée
    CONSTRAINT chk_custodial CHECK (
        is_custodial = false OR (wallet_address IS NOT NULL AND custodial_key_enc IS NOT NULL)
    )
);

CREATE INDEX idx_users_wallet ON shared.users (wallet_address);
CREATE INDEX idx_users_email ON shared.users (email);

-- -------------------------------------------
-- Table : organization_members
-- Liens utilisateurs <-> organisations avec rôles
-- -------------------------------------------
CREATE TABLE shared.organization_members (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES shared.organizations(id) ON DELETE CASCADE,
    user_id         UUID NOT NULL REFERENCES shared.users(id) ON DELETE CASCADE,
    role            shared.member_role NOT NULL DEFAULT 'member',
    joined_at       TIMESTAMPTZ NOT NULL DEFAULT now(),

    UNIQUE (organization_id, user_id)
);

CREATE INDEX idx_org_members_org ON shared.organization_members (organization_id);
CREATE INDEX idx_org_members_user ON shared.organization_members (user_id);


-- ============================================================================
-- SCHÉMA TENANT (créé dynamiquement pour chaque organisation)
-- ============================================================================

CREATE OR REPLACE FUNCTION shared.create_tenant_schema(org_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
    schema TEXT;
BEGIN
    SELECT schema_name INTO schema
    FROM shared.organizations
    WHERE id = org_id;

    IF schema IS NULL THEN
        RAISE EXCEPTION 'Organisation % introuvable', org_id;
    END IF;

    EXECUTE format('CREATE SCHEMA IF NOT EXISTS %I', schema);

    -- Types énumérés du tenant
    EXECUTE format('CREATE TYPE %I.voting_system AS ENUM (
        ''uninominal_1tour'',
        ''uninominal_2tours'',
        ''jugement_majoritaire'',
        ''approbation''
    )', schema);

    EXECUTE format('CREATE TYPE %I.election_status AS ENUM (
        ''draft'',
        ''open'',
        ''closed'',
        ''tallied'',
        ''archived''
    )', schema);

    EXECUTE format('CREATE TYPE %I.nft_type AS ENUM (
        ''voting_right'',
        ''participation_proof''
    )', schema);

    EXECUTE format('CREATE TYPE %I.nft_status AS ENUM (
        ''pending'',
        ''minted'',
        ''burned''
    )', schema);

    EXECUTE format('CREATE TYPE %I.choice_type AS ENUM (
        ''candidate'',
        ''proposal''
    )', schema);

    -- -----------------------------------------------
    -- Table : elections
    -- Instances de vote créées par l'organisation
    -- -----------------------------------------------
    EXECUTE format('
        CREATE TABLE %I.elections (
            id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            title               VARCHAR(255) NOT NULL,
            description         TEXT,
            voting_system       %I.voting_system NOT NULL,
            choice_type         %I.choice_type NOT NULL DEFAULT ''candidate'',
            status              %I.election_status NOT NULL DEFAULT ''draft'',
            start_date          TIMESTAMPTZ,
            end_date            TIMESTAMPTZ,
            contract_address    VARCHAR(42),
            quorum              INTEGER DEFAULT 0,
            created_by          UUID NOT NULL REFERENCES shared.users(id),
            created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
            updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),

            CONSTRAINT chk_dates CHECK (end_date IS NULL OR end_date > start_date)
        )
    ', schema, schema, schema);

    EXECUTE format('CREATE INDEX idx_elections_status ON %I.elections (status)', schema);
    EXECUTE format('CREATE INDEX idx_elections_dates ON %I.elections (start_date, end_date)', schema);

    -- -----------------------------------------------
    -- Table : choices
    -- Options de vote : candidats OU propositions
    -- -----------------------------------------------
    EXECUTE format('
        CREATE TABLE %I.choices (
            id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            election_id     UUID NOT NULL REFERENCES %I.elections(id) ON DELETE CASCADE,
            label           VARCHAR(255) NOT NULL,
            description     TEXT,
            position        INTEGER NOT NULL DEFAULT 0,
            created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
        )
    ', schema, schema);

    EXECUTE format('CREATE INDEX idx_choices_election ON %I.choices (election_id)', schema);

    -- -----------------------------------------------
    -- Table : voter_registry
    -- Votants éligibles par élection
    -- -----------------------------------------------
    EXECUTE format('
        CREATE TABLE %I.voter_registry (
            id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            election_id     UUID NOT NULL REFERENCES %I.elections(id) ON DELETE CASCADE,
            user_id         UUID NOT NULL REFERENCES shared.users(id),
            eligible        BOOLEAN NOT NULL DEFAULT true,
            registered_at   TIMESTAMPTZ NOT NULL DEFAULT now(),

            UNIQUE (election_id, user_id)
        )
    ', schema, schema);

    EXECUTE format('CREATE INDEX idx_voter_registry_election ON %I.voter_registry (election_id)', schema);

    -- -----------------------------------------------
    -- Table : voter_nfts
    -- NFTs associés aux votants :
    --   voting_right       : soul-bound, minté à l'inscription, brûlé au vote
    --   participation_proof : minté après le vote comme attestation
    -- -----------------------------------------------
    EXECUTE format('
        CREATE TABLE %I.voter_nfts (
            id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            election_id         UUID NOT NULL REFERENCES %I.elections(id) ON DELETE CASCADE,
            user_id             UUID NOT NULL REFERENCES shared.users(id),
            nft_type            %I.nft_type NOT NULL,
            nft_status          %I.nft_status NOT NULL DEFAULT ''pending'',
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
    ', schema, schema, schema);

    EXECUTE format('CREATE INDEX idx_voter_nfts_election ON %I.voter_nfts (election_id)', schema);
    EXECUTE format('CREATE INDEX idx_voter_nfts_user ON %I.voter_nfts (user_id)', schema);
    EXECUTE format('CREATE INDEX idx_voter_nfts_status ON %I.voter_nfts (nft_status)', schema);

    -- -----------------------------------------------
    -- Table : participation_log
    -- Suivi de participation (sans contenu du vote = anonymat)
    -- -----------------------------------------------
    EXECUTE format('
        CREATE TABLE %I.participation_log (
            id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            election_id     UUID NOT NULL REFERENCES %I.elections(id) ON DELETE CASCADE,
            user_id         UUID NOT NULL REFERENCES shared.users(id),
            has_voted       BOOLEAN NOT NULL DEFAULT false,
            voted_at        TIMESTAMPTZ,
            tx_hash         VARCHAR(66),

            UNIQUE (election_id, user_id)
        )
    ', schema, schema);

    EXECUTE format('CREATE INDEX idx_participation_election ON %I.participation_log (election_id)', schema);

    -- -----------------------------------------------
    -- Table : election_results
    -- Résultats agrégés par choix
    -- -----------------------------------------------
    EXECUTE format('
        CREATE TABLE %I.election_results (
            id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            election_id     UUID NOT NULL REFERENCES %I.elections(id) ON DELETE CASCADE,
            choice_id       UUID NOT NULL REFERENCES %I.choices(id) ON DELETE CASCADE,
            vote_count      INTEGER NOT NULL DEFAULT 0,
            percentage      DECIMAL(5,2),
            rank            INTEGER,
            tallied_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

            UNIQUE (election_id, choice_id)
        )
    ', schema, schema, schema);

    EXECUTE format('CREATE INDEX idx_results_election ON %I.election_results (election_id)', schema);

    RETURN schema;
END;
$$;


-- ============================================================================
-- EXEMPLE D'UTILISATION
-- ============================================================================
--
-- 1. Créer un utilisateur (wallet direct) :
--    INSERT INTO shared.users (auth_method, wallet_address, display_name)
--    VALUES ('wallet', '0xABC...', 'Alice');
--
-- 2. Créer un utilisateur (email, wallet custodial) :
--    INSERT INTO shared.users (auth_method, email, password_hash, display_name,
--                              is_custodial, wallet_address, custodial_key_enc)
--    VALUES ('email', 'bob@mail.com', '$2b$...', 'Bob',
--            true, '0xDEF...', 'encrypted_private_key...');
--
-- 3. Créer une organisation :
--    INSERT INTO shared.organizations (name, slug, schema_name)
--    VALUES ('Mairie de Paris', 'mairie-paris', 'tenant_mairie_paris')
--    RETURNING id;
--
-- 4. Créer le schéma tenant :
--    SELECT shared.create_tenant_schema('<org_id>');
--
-- 5. Créer une élection avec des propositions :
--    INSERT INTO tenant_mairie_paris.elections
--      (title, voting_system, choice_type, created_by)
--    VALUES ('Budget participatif 2026', 'jugement_majoritaire', 'proposal', '<user_id>');
--
-- 6. Ajouter des choix :
--    INSERT INTO tenant_mairie_paris.choices (election_id, label, position)
--    VALUES ('<election_id>', 'Rénovation du parc', 1),
--           ('<election_id>', 'Piste cyclable rue de Rivoli', 2);
--
-- 7. Inscrire un votant et minter son NFT droit de vote :
--    INSERT INTO tenant_mairie_paris.voter_registry (election_id, user_id)
--    VALUES ('<election_id>', '<user_id>');
--
--    INSERT INTO tenant_mairie_paris.voter_nfts
--      (election_id, user_id, nft_type, nft_status)
--    VALUES ('<election_id>', '<user_id>', 'voting_right', 'pending');
--
-- 8. Après mint on-chain :
--    UPDATE tenant_mairie_paris.voter_nfts
--    SET nft_status = 'minted', token_id = 1, mint_tx_hash = '0x...', minted_at = now()
--    WHERE election_id = '<election_id>' AND user_id = '<user_id>'
--      AND nft_type = 'voting_right';
--
-- 9. Après le vote :
--    -- Brûler le NFT droit de vote
--    UPDATE tenant_mairie_paris.voter_nfts
--    SET nft_status = 'burned', burn_tx_hash = '0x...', burned_at = now()
--    WHERE election_id = '<election_id>' AND user_id = '<user_id>'
--      AND nft_type = 'voting_right';
--
--    -- Minter le NFT preuve de participation
--    INSERT INTO tenant_mairie_paris.voter_nfts
--      (election_id, user_id, nft_type, nft_status, token_id, mint_tx_hash, minted_at)
--    VALUES ('<election_id>', '<user_id>', 'participation_proof', 'minted', 2, '0x...', now());
--
--    -- Enregistrer la participation
--    INSERT INTO tenant_mairie_paris.participation_log
--      (election_id, user_id, has_voted, voted_at, tx_hash)
--    VALUES ('<election_id>', '<user_id>', true, now(), '0x...');
--
