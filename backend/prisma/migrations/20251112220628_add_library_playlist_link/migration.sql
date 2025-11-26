/*
  Warnings:

  - A unique constraint covering the columns `[linkedLibraryId]` on the table `playlists` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "playlists" ADD COLUMN     "linkedLibraryId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "playlists_linkedLibraryId_key" ON "playlists"("linkedLibraryId");

-- AddForeignKey
ALTER TABLE "playlists" ADD CONSTRAINT "playlists_linkedLibraryId_fkey" FOREIGN KEY ("linkedLibraryId") REFERENCES "libraries"("id") ON DELETE CASCADE ON UPDATE CASCADE;
