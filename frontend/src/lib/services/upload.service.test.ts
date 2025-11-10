import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createMetadataFixture } from '@/test/fixtures/metadata';

const {
  prismaFileMock,
  prismaSongMock,
  uploadFileMock,
  deleteFileMock,
  calculateBufferHashMock,
  extractMetadataFromBufferMock,
  extractPhysicalPropertiesMock,
  extractUserMetadataMock,
  generateFallbackMetadataMock,
} = vi.hoisted(() => {
  const prismaFile = {
    findUnique: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  };

  const prismaSong = {
    create: vi.fn(),
  };

  return {
    prismaFileMock: prismaFile,
    prismaSongMock: prismaSong,
    uploadFileMock: vi.fn(),
    deleteFileMock: vi.fn(),
    calculateBufferHashMock: vi.fn(),
    extractMetadataFromBufferMock: vi.fn(),
    extractPhysicalPropertiesMock: vi.fn(),
    extractUserMetadataMock: vi.fn(),
    generateFallbackMetadataMock: vi.fn(),
  };
});

vi.mock('@/lib/db/prisma', () => ({
  prisma: {
    file: prismaFileMock,
    song: prismaSongMock,
  },
}));

vi.mock('@/lib/storage/minio-client', () => ({
  uploadFile: uploadFileMock,
  deleteFile: deleteFileMock,
}));

vi.mock('@/lib/utils/hash', () => ({
  calculateBufferHash: calculateBufferHashMock,
}));

vi.mock('@/lib/metadata/extractor', () => ({
  extractMetadataFromBuffer: extractMetadataFromBufferMock,
  extractPhysicalProperties: extractPhysicalPropertiesMock,
  extractUserMetadata: extractUserMetadataMock,
  generateFallbackMetadata: generateFallbackMetadataMock,
}));

import { uploadAudioFile, decrementFileRef } from './upload.service';
import { prisma } from '@/lib/db/prisma';
import { uploadFile, deleteFile } from '@/lib/storage/minio-client';
import { calculateBufferHash } from '@/lib/utils/hash';
import {
  extractMetadataFromBuffer,
  extractPhysicalProperties,
  extractUserMetadata,
  generateFallbackMetadata,
} from '@/lib/metadata/extractor';

describe('Upload Service', () => {
  const buffer = Buffer.from('mock-audio-data');
  const filename = 'test-track.mp3';
  const mimeType = 'audio/mpeg';
  const fileHash = 'abcdef123456';

  beforeEach(() => {
    vi.clearAllMocks();

    prismaFileMock.findUnique.mockReset();
    prismaFileMock.create.mockReset();
    prismaFileMock.update.mockReset();
    prismaFileMock.delete.mockReset();
    prismaSongMock.create.mockReset();

    uploadFileMock.mockReset();
    deleteFileMock.mockReset();

    calculateBufferHashMock.mockReset();

    extractMetadataFromBufferMock.mockReset();
    extractPhysicalPropertiesMock.mockReset();
    extractUserMetadataMock.mockReset();
    generateFallbackMetadataMock.mockReset();
  });

  describe('uploadAudioFile', () => {
    it('uploads new file to MinIO and creates DB record when hash is new', async () => {
      calculateBufferHashMock.mockReturnValue(fileHash);
      prismaFileMock.findUnique.mockResolvedValueOnce(null);

      const metadata = createMetadataFixture({
        title: 'Test Song',
        artist: 'Test Artist',
        duration: 180,
        bitrate: 320000,
        sampleRate: 44100,
        channels: 2,
      });

      extractMetadataFromBufferMock.mockResolvedValue(metadata);
      extractPhysicalPropertiesMock.mockReturnValue({
        duration: 180,
        bitrate: 320,
        sampleRate: 44100,
        channels: 2,
      });
      extractUserMetadataMock.mockReturnValue({
        title: 'Test Song',
        artist: 'Test Artist',
        album: null,
        albumArtist: null,
        year: null,
        genre: null,
        trackNumber: null,
        discNumber: null,
        composer: null,
      });
      uploadFileMock.mockResolvedValue({ etag: 'etag-1' });

      const createdFile = {
        id: 'file-1',
        hash: fileHash,
        path: `files/${fileHash}.mp3`,
        size: buffer.length,
        mimeType,
        duration: 180,
        bitrate: 320,
        sampleRate: 44100,
        channels: 2,
        refCount: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      prismaFileMock.create.mockResolvedValue(createdFile);

      const result = await uploadAudioFile(buffer, filename, mimeType);

      expect(calculateBufferHash).toHaveBeenCalledWith(buffer);
      expect(prisma.file.findUnique).toHaveBeenCalledWith({ where: { hash: fileHash } });
      expect(uploadFile).toHaveBeenCalledWith(
        expect.any(String),
        `files/${fileHash}.mp3`,
        buffer,
        buffer.length,
        expect.objectContaining({ 'Content-Type': mimeType })
      );
      expect(prisma.file.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ hash: fileHash, mimeType }),
      });
      expect(result).toEqual({
        fileId: 'file-1',
        hash: fileHash,
        isNewFile: true,
        metadata: {
          duration: 180,
          bitrate: 320,
          sampleRate: 44100,
          channels: 2,
        },
        suggestedMetadata: expect.objectContaining({ title: 'Test Song', artist: 'Test Artist' }),
      });
      expect(extractMetadataFromBuffer).toHaveBeenCalledWith(buffer, mimeType);
      expect(extractPhysicalProperties).toHaveBeenCalledWith(metadata);
      expect(extractUserMetadata).toHaveBeenCalledWith(metadata);
    });

    it('reuses existing file by incrementing ref count when hash matches', async () => {
      calculateBufferHashMock.mockReturnValue(fileHash);

      const existingFile = {
        id: 'file-1',
        hash: fileHash,
        path: `files/${fileHash}.mp3`,
        size: buffer.length,
        mimeType,
        duration: 200,
        bitrate: 256,
        sampleRate: 48000,
        channels: 2,
        refCount: 3,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      prismaFileMock.findUnique.mockResolvedValueOnce(existingFile);
      prismaFileMock.update.mockResolvedValue({ ...existingFile, refCount: 4 });

      extractMetadataFromBufferMock.mockResolvedValueOnce(
        createMetadataFixture({
          title: 'Existing Song',
          artist: 'Existing Artist',
          duration: 100,
          bitrate: 192000,
          sampleRate: 44100,
          channels: 2,
        })
      );
      extractUserMetadataMock.mockReturnValueOnce({
        title: 'Existing Song',
        artist: 'Existing Artist',
        album: null,
        albumArtist: null,
        year: null,
        genre: null,
        trackNumber: null,
        discNumber: null,
        composer: null,
      });

      const result = await uploadAudioFile(buffer, filename, mimeType);

      expect(uploadFile).not.toHaveBeenCalled();
      expect(prisma.file.update).toHaveBeenCalledWith({
        where: { id: 'file-1' },
        data: { refCount: { increment: 1 } },
      });
      expect(result.isNewFile).toBe(false);
      expect(result.hash).toBe(fileHash);
      expect(result.metadata).toEqual({
        duration: 200,
        bitrate: 256,
        sampleRate: 48000,
        channels: 2,
      });
    });

    it('falls back to filename metadata when parsing fails', async () => {
      calculateBufferHashMock.mockReturnValue(fileHash);
      prismaFileMock.findUnique.mockResolvedValueOnce(null);

      extractMetadataFromBufferMock
        .mockResolvedValueOnce(
          createMetadataFixture({
            title: 'Fallback Source',
            artist: 'Artist From Metadata',
            duration: null,
            bitrate: null,
            sampleRate: null,
            channels: null,
          })
        )
        .mockRejectedValueOnce(new Error('metadata failed'));

      extractPhysicalPropertiesMock.mockReturnValue({
        duration: null,
        bitrate: null,
        sampleRate: null,
        channels: null,
      });

      uploadFileMock.mockResolvedValue({ etag: 'etag-2' });

      prismaFileMock.create.mockResolvedValue({
        id: 'file-2',
        hash: fileHash,
        path: `files/${fileHash}.mp3`,
        size: buffer.length,
        mimeType,
        duration: null,
        bitrate: null,
        sampleRate: null,
        channels: null,
        refCount: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      generateFallbackMetadataMock.mockReturnValue({
        title: 'test-track',
        artist: null,
        album: null,
        albumArtist: null,
        year: null,
        genre: null,
        trackNumber: null,
        discNumber: null,
        composer: null,
      });

      const result = await uploadAudioFile(buffer, filename, mimeType);

      expect(generateFallbackMetadata).toHaveBeenCalledWith(filename);
      expect(result.suggestedMetadata.title).toBe('test-track');
      expect(result.suggestedMetadata.artist).toBeNull();
    });
  });

  describe('decrementFileRef', () => {
    it('deletes file from storage and DB when refCount reaches zero', async () => {
      prismaFileMock.findUnique.mockResolvedValueOnce({
        id: 'file-1',
        path: 'files/test.mp3',
        hash: 'hash-1',
        refCount: 1,
      });
      prismaFileMock.delete.mockResolvedValueOnce({});
      deleteFileMock.mockResolvedValueOnce(undefined);

      await decrementFileRef('file-1');

      expect(prisma.file.update).not.toHaveBeenCalled();
      expect(deleteFile).toHaveBeenCalledWith('m3w-music', 'files/test.mp3');
      expect(prisma.file.delete).toHaveBeenCalledWith({ where: { id: 'file-1' } });
    });

    it('only decrements refCount when still referenced elsewhere', async () => {
      prismaFileMock.findUnique.mockResolvedValueOnce({
        id: 'file-2',
        path: 'files/test.mp3',
        hash: 'hash-2',
        refCount: 3,
      });
      prismaFileMock.update.mockResolvedValueOnce({
        id: 'file-2',
        path: 'files/test.mp3',
        refCount: 2,
      });

      await decrementFileRef('file-2');

      expect(prisma.file.delete).not.toHaveBeenCalled();
      expect(deleteFile).not.toHaveBeenCalled();
    });

    it('returns silently when file does not exist', async () => {
      prismaFileMock.findUnique.mockResolvedValueOnce(null);

      await expect(decrementFileRef('missing')).resolves.toBeUndefined();
    });

    it('continues cleanup when MinIO object is already missing', async () => {
      prismaFileMock.findUnique.mockResolvedValueOnce({
        id: 'file-3',
        path: 'files/missing.mp3',
        hash: 'hash-3',
        refCount: 1,
      });
      deleteFileMock.mockRejectedValueOnce({ code: 'NoSuchKey' });
      prismaFileMock.delete.mockResolvedValueOnce({});

      await expect(decrementFileRef('file-3')).resolves.toBeUndefined();

      expect(deleteFile).toHaveBeenCalledWith('m3w-music', 'files/missing.mp3');
      expect(prisma.file.delete).toHaveBeenCalledWith({ where: { id: 'file-3' } });
    });

    it('propagates unexpected MinIO deletion errors', async () => {
      const error = new Error('MinIO unavailable');
      prismaFileMock.findUnique.mockResolvedValueOnce({
        id: 'file-4',
        path: 'files/error.mp3',
        hash: 'hash-4',
        refCount: 1,
      });
      deleteFileMock.mockRejectedValueOnce(error);

      await expect(decrementFileRef('file-4')).rejects.toThrow(error);
      expect(prisma.file.delete).not.toHaveBeenCalled();
    });
  });
});

