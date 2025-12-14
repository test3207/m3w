/**
 * Audio filter utilities tests
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  AUDIO_EXTENSIONS,
  AUDIO_MIME_TYPES,
  isAudioFile,
  filterAudioFiles,
  isFolderSelectionSupported,
  getFileName,
} from "./audio-filter";

// Helper to create a mock File
function createMockFile(name: string, type: string = ""): File {
  return new File(["test content"], name, { type });
}

describe("audio-filter", () => {
  describe("AUDIO_EXTENSIONS", () => {
    it("should include common audio extensions", () => {
      expect(AUDIO_EXTENSIONS).toContain(".mp3");
      expect(AUDIO_EXTENSIONS).toContain(".flac");
      expect(AUDIO_EXTENSIONS).toContain(".wav");
      expect(AUDIO_EXTENSIONS).toContain(".ogg");
      expect(AUDIO_EXTENSIONS).toContain(".m4a");
      expect(AUDIO_EXTENSIONS).toContain(".aac");
    });

    it("should include lossless formats", () => {
      expect(AUDIO_EXTENSIONS).toContain(".flac");
      expect(AUDIO_EXTENSIONS).toContain(".wav");
      expect(AUDIO_EXTENSIONS).toContain(".aiff");
      expect(AUDIO_EXTENSIONS).toContain(".ape");
      expect(AUDIO_EXTENSIONS).toContain(".alac");
    });

    it("should include modern formats", () => {
      expect(AUDIO_EXTENSIONS).toContain(".opus");
      expect(AUDIO_EXTENSIONS).toContain(".webm");
    });

    it("should have extensions with leading dot", () => {
      AUDIO_EXTENSIONS.forEach((ext) => {
        expect(ext.startsWith(".")).toBe(true);
      });
    });
  });

  describe("AUDIO_MIME_TYPES", () => {
    it("should include common MIME types", () => {
      expect(AUDIO_MIME_TYPES).toContain("audio/mpeg");
      expect(AUDIO_MIME_TYPES).toContain("audio/flac");
      expect(AUDIO_MIME_TYPES).toContain("audio/wav");
      expect(AUDIO_MIME_TYPES).toContain("audio/ogg");
    });

    it("should include alternative MIME type variants", () => {
      // WAV has multiple MIME types
      expect(AUDIO_MIME_TYPES).toContain("audio/wav");
      expect(AUDIO_MIME_TYPES).toContain("audio/wave");
      expect(AUDIO_MIME_TYPES).toContain("audio/x-wav");
      
      // MP3 variants
      expect(AUDIO_MIME_TYPES).toContain("audio/mpeg");
      expect(AUDIO_MIME_TYPES).toContain("audio/mp3");
    });

    it("should all start with audio/", () => {
      AUDIO_MIME_TYPES.forEach((type) => {
        expect(type.startsWith("audio/")).toBe(true);
      });
    });
  });

  describe("isAudioFile", () => {
    describe("MIME type detection", () => {
      it("should return true for audio MIME types", () => {
        expect(isAudioFile(createMockFile("song.mp3", "audio/mpeg"))).toBe(true);
        expect(isAudioFile(createMockFile("song.flac", "audio/flac"))).toBe(true);
        expect(isAudioFile(createMockFile("song.wav", "audio/wav"))).toBe(true);
      });

      it("should return true for any audio/* MIME type", () => {
        expect(isAudioFile(createMockFile("unknown.xyz", "audio/unknown"))).toBe(true);
        expect(isAudioFile(createMockFile("custom.ext", "audio/x-custom"))).toBe(true);
      });

      it("should return false for non-audio MIME types", () => {
        expect(isAudioFile(createMockFile("image.png", "image/png"))).toBe(false);
        expect(isAudioFile(createMockFile("video.mp4", "video/mp4"))).toBe(false);
        expect(isAudioFile(createMockFile("doc.pdf", "application/pdf"))).toBe(false);
      });
    });

    describe("extension fallback detection", () => {
      it("should detect audio files by extension when no MIME type", () => {
        expect(isAudioFile(createMockFile("song.mp3"))).toBe(true);
        expect(isAudioFile(createMockFile("song.flac"))).toBe(true);
        expect(isAudioFile(createMockFile("song.wav"))).toBe(true);
        expect(isAudioFile(createMockFile("song.ogg"))).toBe(true);
        expect(isAudioFile(createMockFile("song.m4a"))).toBe(true);
      });

      it("should be case-insensitive for extensions", () => {
        expect(isAudioFile(createMockFile("song.MP3"))).toBe(true);
        expect(isAudioFile(createMockFile("song.FLAC"))).toBe(true);
        expect(isAudioFile(createMockFile("song.Wav"))).toBe(true);
      });

      it("should return false for non-audio extensions", () => {
        expect(isAudioFile(createMockFile("image.png"))).toBe(false);
        expect(isAudioFile(createMockFile("document.txt"))).toBe(false);
        expect(isAudioFile(createMockFile("data.json"))).toBe(false);
      });

      it("should return false for files without extension", () => {
        expect(isAudioFile(createMockFile("noextension"))).toBe(false);
      });

      it("should handle filenames with multiple dots", () => {
        expect(isAudioFile(createMockFile("song.backup.mp3"))).toBe(true);
        expect(isAudioFile(createMockFile("song.v2.final.flac"))).toBe(true);
        expect(isAudioFile(createMockFile("song.mp3.bak"))).toBe(false);
      });

      it("should handle hidden files (starting with dot)", () => {
        expect(isAudioFile(createMockFile(".hidden.mp3"))).toBe(true);
        expect(isAudioFile(createMockFile(".hidden"))).toBe(false);
      });
    });
  });

  describe("filterAudioFiles", () => {
    it("should filter audio files from mixed file list", () => {
      const files = [
        createMockFile("song1.mp3", "audio/mpeg"),
        createMockFile("image.png", "image/png"),
        createMockFile("song2.flac", "audio/flac"),
        createMockFile("document.pdf", "application/pdf"),
      ];

      const result = filterAudioFiles(files);
      
      expect(result.audioFiles).toHaveLength(2);
      expect(result.skippedCount).toBe(2);
      expect(result.audioFiles[0].name).toBe("song1.mp3");
      expect(result.audioFiles[1].name).toBe("song2.flac");
    });

    it("should return all files when all are audio", () => {
      const files = [
        createMockFile("song1.mp3", "audio/mpeg"),
        createMockFile("song2.wav", "audio/wav"),
        createMockFile("song3.ogg", "audio/ogg"),
      ];

      const result = filterAudioFiles(files);
      
      expect(result.audioFiles).toHaveLength(3);
      expect(result.skippedCount).toBe(0);
    });

    it("should return empty array when no audio files", () => {
      const files = [
        createMockFile("image.png", "image/png"),
        createMockFile("document.txt", "text/plain"),
      ];

      const result = filterAudioFiles(files);
      
      expect(result.audioFiles).toHaveLength(0);
      expect(result.skippedCount).toBe(2);
    });

    it("should handle empty input", () => {
      const result = filterAudioFiles([]);
      
      expect(result.audioFiles).toHaveLength(0);
      expect(result.skippedCount).toBe(0);
    });

    it("should preserve original order", () => {
      const files = [
        createMockFile("z-last.mp3"),
        createMockFile("skip.txt"),
        createMockFile("a-first.mp3"),
        createMockFile("m-middle.mp3"),
      ];

      const result = filterAudioFiles(files);
      
      expect(result.audioFiles.map(f => f.name)).toEqual([
        "z-last.mp3",
        "a-first.mp3",
        "m-middle.mp3",
      ]);
    });
  });

  describe("isFolderSelectionSupported", () => {
    let originalCreateElement: typeof document.createElement;

    beforeEach(() => {
      originalCreateElement = document.createElement.bind(document);
    });

    afterEach(() => {
      document.createElement = originalCreateElement;
    });

    it("should return true when webkitdirectory is supported", () => {
      // Default JSDOM should have webkitdirectory support
      const input = document.createElement("input");
      const hasSupport = "webkitdirectory" in input;
      
      expect(isFolderSelectionSupported()).toBe(hasSupport);
    });

    it("should return false when webkitdirectory is not supported", () => {
      // Mock createElement to return an input without webkitdirectory
      document.createElement = vi.fn((tagName: string) => {
        if (tagName === "input") {
          return {} as HTMLInputElement; // Object without webkitdirectory
        }
        return originalCreateElement(tagName);
      });

      expect(isFolderSelectionSupported()).toBe(false);
    });
  });

  describe("getFileName", () => {
    it("should return the file name", () => {
      const file = createMockFile("song.mp3");
      expect(getFileName(file)).toBe("song.mp3");
    });

    it("should handle files with spaces in name", () => {
      const file = createMockFile("My Favorite Song.mp3");
      expect(getFileName(file)).toBe("My Favorite Song.mp3");
    });

    it("should handle files with special characters", () => {
      const file = createMockFile("song (2023) [remaster].mp3");
      expect(getFileName(file)).toBe("song (2023) [remaster].mp3");
    });

    it("should handle unicode filenames", () => {
      const file = createMockFile("歌曲名称.mp3");
      expect(getFileName(file)).toBe("歌曲名称.mp3");
    });

    it("should handle files with webkitRelativePath", () => {
      // Create a file and manually set webkitRelativePath
      const file = createMockFile("song.mp3");
      Object.defineProperty(file, "webkitRelativePath", {
        value: "folder/subfolder/song.mp3",
        writable: false,
      });
      
      // getFileName should return just the filename, not the path
      expect(getFileName(file)).toBe("song.mp3");
    });
  });
});
