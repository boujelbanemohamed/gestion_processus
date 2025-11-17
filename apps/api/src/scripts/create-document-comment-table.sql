-- Script SQL pour créer la table DocumentComment
-- Cette table est nécessaire pour stocker les commentaires sur les documents

CREATE TABLE IF NOT EXISTS "DocumentComment" (
  "id" TEXT NOT NULL,
  "documentId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "contenu" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "DocumentComment_pkey" PRIMARY KEY ("id")
);

-- Créer les index
CREATE INDEX IF NOT EXISTS "DocumentComment_documentId_idx" ON "DocumentComment"("documentId");
CREATE INDEX IF NOT EXISTS "DocumentComment_userId_idx" ON "DocumentComment"("userId");

-- Ajouter les clés étrangères
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'DocumentComment_documentId_fkey'
  ) THEN
    ALTER TABLE "DocumentComment" 
    ADD CONSTRAINT "DocumentComment_documentId_fkey" 
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
    WHERE conname = 'DocumentComment_userId_fkey'
  ) THEN
    ALTER TABLE "DocumentComment" 
    ADD CONSTRAINT "DocumentComment_userId_fkey" 
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
WHERE table_name = 'DocumentComment'
ORDER BY ordinal_position;

