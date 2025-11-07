import { auth } from "@/lib/auth/config";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { getMinioClient } from "@/lib/storage/minio-client";
import { logger } from "@/lib/logger";

/**
 * GET /api/songs/[songId]/stream
 * 
 * Get presigned URL for audio streaming
 */
export async function GET(
  request: Request,
  { params }: { params: { songId: string } }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const { songId } = params;

    // Get song and verify ownership through library
    const song = await prisma.song.findFirst({
      where: {
        id: songId,
        library: {
          userId: session.user.id,
        },
      },
      include: {
        file: true,
      },
    });

    if (!song) {
      return NextResponse.json(
        { error: "Song not found" },
        { status: 404 }
      );
    }

    // Generate presigned URL (valid for 1 hour)
    const minioClient = getMinioClient();
    const presignedUrl = await minioClient.presignedGetObject(
      process.env.MINIO_BUCKET_NAME || "m3w-audio",
      song.file.path,
      60 * 60 // 1 hour
    );

    logger.info({
      msg: "Audio stream URL generated",
      songId,
      userId: session.user.id,
      fileId: song.fileId,
    });

    return NextResponse.json({
      url: presignedUrl,
      expiresIn: 3600,
    });
  } catch (error) {
    logger.error({
      msg: "Failed to generate stream URL",
      error,
    });
    return NextResponse.json(
      { error: "Failed to generate stream URL" },
      { status: 500 }
    );
  }
}
