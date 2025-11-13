-- AlterTable
ALTER TABLE "libraries" ADD COLUMN     "canDelete" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "isDefault" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "playlists" ADD COLUMN     "canDelete" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "isDefault" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "songIds" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- CreateIndex
CREATE INDEX "libraries_userId_isDefault_idx" ON "libraries"("userId", "isDefault");

-- CreateIndex
CREATE INDEX "playlists_userId_isDefault_idx" ON "playlists"("userId", "isDefault");
