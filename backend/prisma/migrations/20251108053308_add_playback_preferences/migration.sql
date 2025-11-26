-- CreateTable
CREATE TABLE "playback_preferences" (
    "userId" TEXT NOT NULL,
    "shuffleEnabled" BOOLEAN NOT NULL DEFAULT false,
    "repeatMode" TEXT NOT NULL DEFAULT 'off',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "playback_preferences_pkey" PRIMARY KEY ("userId")
);

-- AddForeignKey
ALTER TABLE "playback_preferences" ADD CONSTRAINT "playback_preferences_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
