-- AlterTable
ALTER TABLE "libraries" ADD COLUMN     "cacheOverride" TEXT NOT NULL DEFAULT 'inherit';

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "cacheAllEnabled" BOOLEAN NOT NULL DEFAULT false;
