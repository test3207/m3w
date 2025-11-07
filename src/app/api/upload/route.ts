import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth/config';
import { uploadAudioFile, decrementFileRef } from '@/lib/services/upload.service';
import { createSong } from '@/lib/services/song.service';
import { ERROR_MESSAGES } from '@/locales/messages';
import { logger } from '@/lib/logger';

export const runtime = 'nodejs';
export const maxDuration = 60; // 60 seconds max

/**
 * POST /api/upload
 * Upload audio file
 */
export async function POST(request: NextRequest) {
  try {
    // Check authentication
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json(
        { error: ERROR_MESSAGES.unauthorized },
        { status: 401 }
      );
    }

    // Parse multipart form data
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const libraryId = formData.get('libraryId');

    if (!file) {
      return NextResponse.json(
        { error: ERROR_MESSAGES.noFileProvided },
        { status: 400 }
      );
    }

    if (typeof libraryId !== 'string' || libraryId.trim().length === 0) {
      return NextResponse.json(
        { error: ERROR_MESSAGES.libraryIdRequired },
        { status: 400 }
      );
    }

    // Validate file type
    const allowedTypes = [
      'audio/mpeg',
      'audio/mp3',
      'audio/flac',
      'audio/wav',
      'audio/ogg',
      'audio/m4a',
      'audio/aac',
    ];

    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json(
        { error: ERROR_MESSAGES.invalidFileType },
        { status: 400 }
      );
    }

    // Validate file size (max 100MB)
    const maxSize = 100 * 1024 * 1024; // 100MB
    if (file.size > maxSize) {
      return NextResponse.json(
        { error: ERROR_MESSAGES.fileTooLarge },
        { status: 400 }
      );
    }

    // Convert file to buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    logger.info({
      msg: 'File upload started',
      userId: session.user.id,
      filename: file.name,
      size: file.size,
      type: file.type,
    });

    // Upload file with deduplication
    const result = await uploadAudioFile(buffer, file.name, file.type);

    const fieldOrNull = (value: FormDataEntryValue | null) => {
      if (typeof value !== 'string') {
        return null;
      }
      const trimmed = value.trim();
      return trimmed.length > 0 ? trimmed : null;
    };

    const parseNumberOrNull = (value: FormDataEntryValue | null) => {
      const str = fieldOrNull(value);
      if (!str) {
        return null;
      }
      const parsed = Number(str);
      return Number.isNaN(parsed) ? null : parsed;
    };

    const metadataOverrides = {
      title: fieldOrNull(formData.get('title')),
      artist: fieldOrNull(formData.get('artist')),
      album: fieldOrNull(formData.get('album')),
      albumArtist: fieldOrNull(formData.get('albumArtist')),
      genre: fieldOrNull(formData.get('genre')),
      composer: fieldOrNull(formData.get('composer')),
      year: parseNumberOrNull(formData.get('year')),
      trackNumber: parseNumberOrNull(formData.get('trackNumber')),
      discNumber: parseNumberOrNull(formData.get('discNumber')),
    };

    const mergedMetadata = {
      title:
        metadataOverrides.title ?? result.suggestedMetadata.title ?? 'Untitled Track',
      artist: metadataOverrides.artist ?? result.suggestedMetadata.artist,
      album: metadataOverrides.album ?? result.suggestedMetadata.album,
      albumArtist:
        metadataOverrides.albumArtist ?? result.suggestedMetadata.albumArtist,
      year: metadataOverrides.year ?? result.suggestedMetadata.year,
      genre: metadataOverrides.genre ?? result.suggestedMetadata.genre,
      trackNumber:
        metadataOverrides.trackNumber ?? result.suggestedMetadata.trackNumber,
      discNumber:
        metadataOverrides.discNumber ?? result.suggestedMetadata.discNumber,
      composer: metadataOverrides.composer ?? result.suggestedMetadata.composer,
    };

    const coverUrl = fieldOrNull(formData.get('coverUrl'));

    let song;
    try {
      song = await createSong({
        userId: session.user.id,
        libraryId: libraryId.trim(),
        fileId: result.fileId,
        metadata: mergedMetadata,
        options: {
          coverUrl,
          rawMetadata: {
            suggestedMetadata: result.suggestedMetadata,
            physical: result.metadata,
            originalFilename: file.name,
          },
        },
      });
    } catch (songError) {
      await decrementFileRef(result.fileId);
      throw songError;
    }

    if (!song) {
      await decrementFileRef(result.fileId);
      return NextResponse.json(
        { error: ERROR_MESSAGES.libraryUnavailable },
        { status: 404 }
      );
    }

    logger.info({
      msg: 'File upload completed',
      userId: session.user.id,
      fileId: result.fileId,
      isNewFile: result.isNewFile,
    });

    return NextResponse.json({
      success: true,
      data: {
        upload: result,
        song,
      },
    });
  } catch (error) {
    logger.error({ msg: 'File upload failed', error });

    return NextResponse.json(
      { error: ERROR_MESSAGES.fileUploadFailed },
      { status: 500 }
    );
  }
}
