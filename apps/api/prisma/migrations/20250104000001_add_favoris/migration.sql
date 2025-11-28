-- CreateTable
CREATE TABLE "FavorisProcessus" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "processusId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FavorisProcessus_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FavorisDocument" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FavorisDocument_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "FavorisProcessus_userId_processusId_key" ON "FavorisProcessus"("userId", "processusId");

-- CreateIndex
CREATE INDEX "FavorisProcessus_userId_idx" ON "FavorisProcessus"("userId");

-- CreateIndex
CREATE INDEX "FavorisProcessus_processusId_idx" ON "FavorisProcessus"("processusId");

-- CreateIndex
CREATE UNIQUE INDEX "FavorisDocument_userId_documentId_key" ON "FavorisDocument"("userId", "documentId");

-- CreateIndex
CREATE INDEX "FavorisDocument_userId_idx" ON "FavorisDocument"("userId");

-- CreateIndex
CREATE INDEX "FavorisDocument_documentId_idx" ON "FavorisDocument"("documentId");

-- AddForeignKey
ALTER TABLE "FavorisProcessus" ADD CONSTRAINT "FavorisProcessus_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FavorisProcessus" ADD CONSTRAINT "FavorisProcessus_processusId_fkey" FOREIGN KEY ("processusId") REFERENCES "Processus"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FavorisDocument" ADD CONSTRAINT "FavorisDocument_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FavorisDocument" ADD CONSTRAINT "FavorisDocument_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE CASCADE ON UPDATE CASCADE;

