-- ============================================================
--  SIM MANAGER — Initialisation de la base de données
-- ============================================================

-- Table des utilisateurs
CREATE TABLE IF NOT EXISTS users (
    id            SERIAL PRIMARY KEY,
    username      VARCHAR(50)  UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    full_name     VARCHAR(150) NOT NULL,
    role          VARCHAR(20)  NOT NULL DEFAULT 'user'
                  CHECK (role IN ('admin','stock','livraison','consultation')),
    is_active     BOOLEAN      NOT NULL DEFAULT TRUE,
    last_login    TIMESTAMP,
    created_at    TIMESTAMP    DEFAULT NOW(),
    created_by    VARCHAR(50)
);

CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
CREATE INDEX IF NOT EXISTS idx_users_role     ON users(role);

INSERT INTO users (username, password_hash, full_name, role, created_by)
VALUES ('admin','$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi','Administrateur','admin','system')
ON CONFLICT (username) DO NOTHING;

-- Table des clients
CREATE TABLE IF NOT EXISTS clients (
    id         SERIAL PRIMARY KEY,
    nom        VARCHAR(150) UNIQUE NOT NULL,
    adresse    TEXT,
    is_active  BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT NOW(),
    created_by VARCHAR(50)
);

CREATE INDEX IF NOT EXISTS idx_clients_nom ON clients(nom);

-- Table des puces SIM
CREATE TABLE IF NOT EXISTS sim_cards (
    id            SERIAL PRIMARY KEY,
    iccid         VARCHAR(30) UNIQUE NOT NULL,
    operateur     VARCHAR(50) NOT NULL,
    lot           VARCHAR(100) NOT NULL,
    date_entree   DATE NOT NULL DEFAULT CURRENT_DATE,
    status        VARCHAR(20) NOT NULL DEFAULT 'disponible',
    livraison_ref VARCHAR(50),
    created_at    TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sim_operateur ON sim_cards(operateur);
CREATE INDEX IF NOT EXISTS idx_sim_status    ON sim_cards(status);

-- Table des livraisons
CREATE TABLE IF NOT EXISTS livraisons (
    id             SERIAL PRIMARY KEY,
    ref            VARCHAR(50) UNIQUE NOT NULL,
    client_id      INTEGER REFERENCES clients(id) ON DELETE SET NULL,
    client_nom     VARCHAR(150) NOT NULL,
    operateur      VARCHAR(50) NOT NULL,
    date_livraison DATE NOT NULL,
    quantite       INTEGER NOT NULL DEFAULT 0,
    created_by     VARCHAR(50),
    created_at     TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_liv_ref       ON livraisons(ref);
CREATE INDEX IF NOT EXISTS idx_liv_client_id ON livraisons(client_id);

-- Table de liaison livraison <-> puces
CREATE TABLE IF NOT EXISTS livraison_sims (
    id            SERIAL PRIMARY KEY,
    livraison_ref VARCHAR(50) NOT NULL REFERENCES livraisons(ref) ON DELETE CASCADE,
    iccid         VARCHAR(30) NOT NULL REFERENCES sim_cards(iccid) ON DELETE CASCADE
);

-- Migration si base existante
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='livraisons' AND column_name='client_id') THEN
    ALTER TABLE livraisons ADD COLUMN client_id INTEGER REFERENCES clients(id) ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='livraisons' AND column_name='client_nom') THEN
    ALTER TABLE livraisons ADD COLUMN client_nom VARCHAR(150);
    UPDATE livraisons SET client_nom = client WHERE client_nom IS NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='livraisons' AND column_name='created_by') THEN
    ALTER TABLE livraisons ADD COLUMN created_by VARCHAR(50);
  END IF;
END $$;
