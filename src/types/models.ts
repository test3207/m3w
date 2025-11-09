/**
 * Frontend data models
 * Simplified versions of Prisma models for client-side usage
 */

export interface User {
  id: string;
  email: string;
  name?: string | null;
  image?: string | null;
}

export interface Library {
  id: string;
  name: string;
  description: string | null;
  createdAt: string;
  updatedAt: string;
  _count?: {
    songs: number;
  };
}

export interface LibraryWithSongs extends Library {
  songs: Song[];
}

export interface Song {
  id: string;
  title: string;
  artist: string | null;
  album: string | null;
  albumArtist: string | null;
  genre: string | null;
  year: number | null;
  trackNumber: number | null;
  discNumber: number | null;
  duration: number | null;
  coverArtUrl: string | null;
  libraryId: string;
  fileId: string;
  createdAt: string;
  updatedAt: string;
  file?: {
    id: string;
    duration: number | null;
  } | null;
}

export interface Playlist {
  id: string;
  name: string;
  description: string | null;
  userId: string;
  createdAt: string;
  updatedAt: string;
  _count?: {
    songs: number;
  };
  songs?: PlaylistSong[];
}

export interface PlaylistSong {
  playlistId: string;
  songId: string;
  position: number;
  addedAt: string;
  song: Song;
}

export interface LibraryOption {
  id: string;
  name: string;
  songCount: number;
  description: string | null;
}

export interface PlaylistOption {
  id: string;
  name: string;
}
