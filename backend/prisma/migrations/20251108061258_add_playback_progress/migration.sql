-- CreateTable
CREATE TABLE "playback_progress" (
    "userId" TEXT NOT NULL,
    "songId" TEXT NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "contextType" TEXT,
    "contextId" TEXT,
    "contextName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "playback_progress_pkey" PRIMARY KEY ("userId")
);

-- CreateIndex
CREATE INDEX "playback_progress_songId_idx" ON "playback_progress"("songId");

-- AddForeignKey
ALTER TABLE "playback_progress" ADD CONSTRAINT "playback_progress_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "playback_progress" ADD CONSTRAINT "playback_progress_songId_fkey" FOREIGN KEY ("songId") REFERENCES "songs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
