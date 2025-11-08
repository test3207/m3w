import { auth } from "@/lib/auth/config";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { getMinioClient } from "@/lib/storage/minio-client";
import { logger } from "@/lib/logger";
import { HttpStatusCode } from "@/lib/constants/http-status";
import { Readable } from "stream";

/**
 * GET /api/songs/[songId]/stream
 * 
 * Stream audio file directly from MinIO through API proxy
 * Supports HTTP Range requests for seeking and partial content delivery
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ songId: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: HttpStatusCode.UNAUTHORIZED }
      );
    }

    const { songId } = await params;

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
        { status: HttpStatusCode.NOT_FOUND }
      );
    }

    const bucketName = process.env.MINIO_BUCKET_NAME || "m3w-music";
    const minioClient = getMinioClient();

    // Get file stat to determine total size
    const stat = await minioClient.statObject(bucketName, song.file.path);
    const fileSize = stat.size;

    // Parse Range header for partial content requests
    const rangeHeader = request.headers.get("range");
    let start = 0;
    let end = fileSize - 1;
    let statusCode = 200;

    if (rangeHeader) {
      const parts = rangeHeader.replace(/bytes=/, "").split("-");
      start = parseInt(parts[0], 10);
      end = parts[1] ? parseInt(parts[1], 10) : end;
      statusCode = 206; // Partial Content

      logger.debug({
        msg: "Range request",
        songId,
        start,
        end,
        fileSize,
      });
    }

    // Get object stream from MinIO
    const dataStream = await minioClient.getObject(bucketName, song.file.path);

    // Convert Node.js stream to Web Stream
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const nodeStream = dataStream as any;
    let webStream = Readable.toWeb(nodeStream) as ReadableStream;

    // For Range requests, transform the stream to slice the content
    if (rangeHeader && (start > 0 || end < fileSize - 1)) {
      let bytesRead = 0;
      webStream = webStream.pipeThrough(
        new TransformStream({
          transform(chunk: Uint8Array, controller) {
            const chunkStart = bytesRead;
            const chunkEnd = chunkStart + chunk.byteLength;
            bytesRead = chunkEnd;

            // Skip bytes before range start
            if (chunkEnd <= start) {
              return;
            }

            // Stop if we've passed range end
            if (chunkStart > end) {
              controller.terminate();
              return;
            }

            // Trim chunk to fit range
            let output = chunk;
            if (chunkStart < start) {
              output = chunk.slice(start - chunkStart);
            }
            if (chunkEnd > end + 1) {
              output = output.slice(0, end + 1 - Math.max(chunkStart, start));
            }

            controller.enqueue(output);

            // Terminate after range end
            if (chunkEnd >= end + 1) {
              controller.terminate();
            }
          },
        })
      );
    }

    // Prepare response headers
    const headers = new Headers({
      "Content-Type": song.file.mimeType || "audio/mpeg",
      "Accept-Ranges": "bytes",
      "Cache-Control": "public, max-age=31536000, immutable", // Cache for 1 year (content-addressed by hash)
    });

    if (statusCode === 206) {
      headers.set("Content-Range", `bytes ${start}-${end}/${fileSize}`);
      headers.set("Content-Length", String(end - start + 1));
    } else {
      headers.set("Content-Length", String(fileSize));
    }

    logger.info({
      msg: "Audio stream started",
      songId,
      userId: session.user.id,
      fileId: song.fileId,
      fileSize,
      range: rangeHeader || "full",
    });

    return new Response(webStream, {
      status: statusCode,
      headers,
    });
  } catch (error) {
    logger.error({
      msg: "Failed to stream audio",
      error,
    });
    return NextResponse.json(
      { error: "Failed to stream audio" },
      { status: HttpStatusCode.INTERNAL_SERVER_ERROR }
    );
  }
}
