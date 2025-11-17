-- Script SQL pour créer la table DocumentPermission
-- Cette table est nécessaire pour gérer les permissions des documents confidentiels

CREATE TABLE IF NOT EXISTS "DocumentPermission" (
  "id" TEXT NOT NULL,
  "documentId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "DocumentPermission_pkey" PRIMARY KEY ("id")
);

-- Créer les index
CREATE INDEX IF NOT EXISTS "DocumentPermission_documentId_idx" ON "DocumentPermission"("documentId");
CREATE INDEX IF NOT EXISTS "DocumentPermission_userId_idx" ON "DocumentPermission"("userId");

-- Créer la contrainte unique
CREATE UNIQUE INDEX IF NOT EXISTS "DocumentPermission_documentId_userId_key" ON "DocumentPermission"("documentId", "userId");

-- Ajouter les clés étrangères
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'DocumentPermission_documentId_fkey'
  ) THEN
    ALTER TABLE "DocumentPermission" 
    ADD CONSTRAINT "DocumentPermission_documentId_fkey" 
    FOREIGN KEY ("documentId") 
    REFERENCES "Document"("id") 
    ON DELETE CASCADE 
    ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'DocumentPermission_userId_fkey'
  ) THEN
    ALTER TABLE "DocumentPermission" 
    ADD CONSTRAINT "DocumentPermission_userId_fkey" 
    FOREIGN KEY ("userId") 
    REFERENCES "User"("id") 
    ON DELETE CASCADE 
    ON UPDATE CASCADE;
  END IF;
END $$;

-- Vérifier que la table a été créée
SELECT 
  table_name, 
  column_name, 
  data_type 
FROM information_schema.columns 
WHERE table_name = 'DocumentPermission'
ORDER BY ordinal_position;

