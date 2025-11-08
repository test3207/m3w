import { auth } from "@/lib/auth/config";
import { prisma } from "@/lib/db/prisma";
import { logger } from "@/lib/logger";
import { NextResponse } from "next/server";
import { HttpStatusCode } from "@/lib/constants/http-status";

interface PlaylistTrackResponse {
  id: string;
  title: string;
  artist: string | null;
  album: string | null;
  coverUrl: string | null;
  duration: number | null;
  mimeType: string | null;
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
  return NextResponse.json({ error: "Unauthorized" }, { status: HttpStatusCode.UNAUTHORIZED });
    }

    const { id: playlistId } = await params;

    const playlist = await prisma.playlist.findFirst({
      where: {
        id: playlistId,
        userId: session.user.id,
      },
      include: {
        songs: {
          include: {
            song: {
              include: {
                file: true,
              },
            },
          },
          orderBy: { order: "asc" },
        },
      },
    });

    if (!playlist) {
  return NextResponse.json({ error: "Playlist not found" }, { status: HttpStatusCode.NOT_FOUND });
    }

    const tracks: PlaylistTrackResponse[] = playlist.songs.map(({ song }) => ({
      id: song.id,
      title: song.title,
      artist: song.artist ?? null,
      album: song.album ?? null,
      coverUrl: song.coverUrl ?? null,
      duration: song.file?.duration ?? null,
      mimeType: song.file?.mimeType ?? null,
    }));

    logger.info({
      msg: "Playlist tracks fetched",
      playlistId,
      userId: session.user.id,
      trackCount: tracks.length,
    });

    return NextResponse.json({
      playlist: {
        id: playlist.id,
        name: playlist.name,
      },
      tracks,
    });
  } catch (error) {
    logger.error({ msg: "Failed to fetch playlist tracks", error });
    return NextResponse.json(
      { error: "Failed to fetch playlist tracks" },
      { status: HttpStatusCode.INTERNAL_SERVER_ERROR }
    );
  }
}
