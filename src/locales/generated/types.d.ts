/**
 * Auto-generated i18n type definitions
 * DO NOT EDIT MANUALLY
 * 
 * Generated from: src/locales/messages/en.json
 * Command: npm run i18n:build
 */

export interface Messages {
  error: {
    /** Unauthorized */
    unauthorized: string;
    /** No file provided */
    noFileProvided: string;
    /** libraryId is required */
    libraryIdRequired: string;
    /** Invalid file type. Only audio files are allowed. */
    invalidFileType: string;
    /** File too large. Maximum size is 100MB. */
    fileTooLarge: string;
    /** File upload failed. Please try again. */
    fileUploadFailed: string;
    /** Invalid input */
    invalidInput: string;
    /** Failed to retrieve libraries */
    failedToRetrieveLibraries: string;
    /** Failed to retrieve library */
    failedToRetrieveLibrary: string;
    /** Failed to create library */
    failedToCreateLibrary: string;
    /** Library not found */
    libraryNotFound: string;
    /** Failed to update library */
    failedToUpdateLibrary: string;
    /** Failed to delete library */
    failedToDeleteLibrary: string;
    /** Failed to retrieve songs */
    failedToRetrieveSongs: string;
    /** Failed to retrieve playlist */
    failedToGetPlaylist: string;
    /** Failed to retrieve playlists */
    failedToGetPlaylists: string;
    /** Failed to create playlist */
    failedToCreatePlaylist: string;
    /** Failed to add song to playlist */
    failedToAddSongToPlaylist: string;
    /** Failed to remove song from playlist */
    failedToRemoveSongFromPlaylist: string;
    /** Playlist or song not found */
    playlistOrSongNotFound: string;
    /** Failed to delete playlist */
    failedToDeletePlaylist: string;
    /** Playlist not found */
    playlistNotFound: string;
    /** Playlist not found or unauthorized */
    playlistNotFoundOrUnauthorized: string;
    /** Invalid song order */
    invalidSongOrder: string;
    /** Failed to reorder playlist songs */
    failedToReorderSongs: string;
    /** Failed to seed playback */
    failedToSeedPlayback: string;
    /** Failed to retrieve playback preferences */
    failedToGetPlaybackPreferences: string;
    /** Failed to update playback preferences */
    failedToUpdatePlaybackPreferences: string;
    /** Failed to retrieve playback progress */
    failedToGetPlaybackProgress: string;
    /** Failed to update playback progress */
    failedToUpdatePlaybackProgress: string;
    /** Failed to stream audio */
    failedToStreamAudio: string;
    /** Failed to fetch playlist tracks */
    failedToFetchPlaylistTracks: string;
    /** Song not found */
    songNotFound: string;
    /** Song not found in playlist */
    songNotFoundInPlaylist: string;
    /** Upload failed. Please try again later. */
    uploadFailed: string;
    /** Something went wrong during upload. Please try again later. */
    uploadErrorGeneric: string;
    /** Please select an audio file. */
    noAudioFileSelected: string;
    /** Please choose a library to save the song. */
    noLibrarySelected: string;
    /** Library not found */
    libraryUnavailable: string;
    /** Missing action parameter */
    missingActionParameter: string;
    /** Missing songId */
    missingSongId: string;
    /** Missing or invalid songIds array */
    missingOrInvalidSongIds: string;
    /** Unauthorized or resource not found */
    unauthorizedOrNotFound: string;
    /** Invalid songId or direction */
    invalidSongIdOrDirection: string;
    /** Invalid direction for current position */
    invalidDirectionForPosition: string;
    /** Unknown action */
    unknownAction: string;
    /** Internal server error */
    internalServerError: string;
    /** Failed to sign out */
    failedToSignOut: string;
    /** Please try again. */
    genericTryAgain: string;
  };
  success: {
    /** File upload completed */
    uploadCompleted: string;
  };
  common: {
    /** Songs */
    songsLabel: string;
    /** Manage songs */
    manageSongsCta: string;
    /** View */
    viewLinkLabel: string;
    /** Loading... */
    loadingLabel: string;
    /** Not found */
    notFoundLabel: string;
    /** Error */
    errorLabel: string;
    /** Try again */
    tryAgainLabel: string;
    /** Confirm */
    confirmLabel: string;
    /** Cancel */
    cancelLabel: string;
    /** Creating... */
    creatingLabel: string;
    /** Deleting... */
    deletingLabel: string;
    /** Uploading... */
    uploadingLabel: string;
    /** Saving... */
    savingLabel: string;
    /** Are you sure you want to delete this playlist? */
    confirmDeletePlaylist: string;
  };
  dashboard: {
    /** M3W Dashboard */
    title: string;
    welcome: {
      /** Welcome back,  */
      prefix: string;
      /** there */
      fallback: string;
      /** ! 👋 */
      suffix: string;
      /** Your Next.js full-stack application is ready. Start building amazing features! */
      description: string;
    };
    /** Production Ready */
    badgeProductionReady: string;
    navbar: {
      /** M3W Dashboard */
      title: string;
      /** Return to dashboard */
      goToDashboard: string;
      /** Sign Out */
      signOut: string;
    };
    cards: {
      libraries: {
        /** 🎵 */
        titleIcon: string;
        /** Your Libraries */
        titleSuffix: string;
        /** Click a library to manage songs, or use the + button to create a new one */
        description: string;
        /** You have not created any libraries yet. */
        emptyTitle: string;
        /** Create library */
        createLabel: string;
        /** Create library */
        emptyActionLabel: string;
      };
      playlists: {
        /** 📻 */
        titleIcon: string;
        /** Your Playlists */
        titleSuffix: string;
        /** Tap a playlist to edit it, or press + to start a new mix */
        description: string;
        /** No playlists yet. Create one to start organizing tracks. */
        emptyTitle: string;
        /** Create playlist */
        createLabel: string;
        /** Create playlist */
        emptyActionLabel: string;
      };
      storage: {
        /** 📊 */
        titleIcon: string;
        /** Storage At A Glance */
        titleSuffix: string;
        /** Keep track of how much data you sync locally */
        description: string;
        /** Storage metrics will appear once offline caching is configured. */
        placeholder: string;
      };
    };
  };
  library: {
    manager: {
      /** Library Manager */
      pageTitle: string;
      /** Create, review, and remove music libraries. Each library keeps its own metadata and songs. */
      pageDescription: string;
      form: {
        /** Create a new library */
        title: string;
        /** Library name */
        nameLabel: string;
        /** Jazz Collection */
        namePlaceholder: string;
        /** Description */
        descriptionLabel: string;
        /** Optional notes about this library */
        descriptionPlaceholder: string;
        /** Create library */
        submitLabel: string;
      };
      list: {
        /** Your libraries */
        title: string;
        /** No libraries yet */
        emptyTitle: string;
        /** Use the form to create your first collection. */
        emptyDescription: string;
        /** Upload Songs */
        emptyActionLabel: string;
        /**  songs */
        songsSuffix: string;
        /** Songs */
        metadataSongsLabel: string;
        /** Created */
        metadataCreatedLabel: string;
        /** Updated */
        metadataUpdatedLabel: string;
        /** Manage songs */
        manageSongsCta: string;
        /** Delete */
        deleteButton: string;
        /** Delete library? */
        deleteConfirmTitle: string;
        /** This removes the library and disconnects its songs from playlists. You cannot undo this action. */
        deleteConfirmDescription: string;
        /** Cancel */
        deleteConfirmCancel: string;
        /** Delete */
        deleteConfirmSubmit: string;
        /** Deleting... */
        deleteConfirmPending: string;
        /** Library removed */
        toastDeleteSuccessTitle: string;
        /** Deleted  */
        toastDeleteSuccessDescriptionPrefix: string;
        /** Unable to delete library */
        toastDeleteErrorTitle: string;
        /** Something went wrong. Please try again. */
        toastDeleteErrorDescription: string;
        /** You do not have permission to delete this library. */
        toastDeleteErrorUnauthorized: string;
      };
    };
    detail: {
      /** Back to libraries */
      backToLibraries: string;
      /** Library:  */
      titlePrefix: string;
      /** Manage songs in this library and add them to your playlists. */
      description: string;
      /** Upload songs */
      uploadSongsCta: string;
      /** Songs in this library */
      songListTitle: string;
      /** No songs found in this library yet. */
      songListEmpty: string;
      /** Use the Upload songs button to add tracks to this library. */
      songListEmptyHelper: string;
      /** Songs */
      songCountLabel: string;
      /** Album */
      songAlbumLabel: string;
      /** Duration */
      songDurationLabel: string;
      /** Create a playlist first to start adding songs. */
      noPlaylistsHelper: string;
      /** Go to playlists */
      goToPlaylistsLink: string;
    };
    addToPlaylist: {
      /** Add to playlist */
      label: string;
      /** Select a playlist */
      placeholder: string;
      /** Add */
      submitLabel: string;
      /** Adding... */
      pendingLabel: string;
      /** Added to playlist */
      toastSuccessTitle: string;
      /** Song added successfully. */
      toastSuccessDescription: string;
      /** Unable to add song */
      toastErrorTitle: string;
      /** Please try again. */
      toastErrorDescription: string;
      /** Select a playlist first. */
      selectPlaylistFirst: string;
    };
  };
  playlist: {
    manager: {
      /** Playlist Builder */
      pageTitle: string;
      /** Combine songs across libraries, set custom artwork, and keep your favorite mixes up to date. */
      pageDescription: string;
      form: {
        /** Create a new playlist */
        title: string;
        /** Playlist name */
        nameLabel: string;
        /** Road Trip Mix */
        namePlaceholder: string;
        /** Description */
        descriptionLabel: string;
        /** Capture the mood or story behind this playlist */
        descriptionPlaceholder: string;
        /** Cover image URL */
        coverLabel: string;
        /** https://example.com/cover.jpg */
        coverPlaceholder: string;
        /** Create playlist */
        submitLabel: string;
      };
      list: {
        /** Your playlists */
        title: string;
        /** No playlists yet. Use the form to build your first mix. */
        emptyTitle: string;
        /** Use the form to build your first mix and start adding tracks immediately. */
        emptyDescription: string;
        /** Create playlist */
        emptyActionLabel: string;
        /** Songs */
        metadataSongsLabel: string;
        /** Cover */
        coverLabel: string;
        /** Created */
        metadataCreatedLabel: string;
        /** Updated */
        metadataUpdatedLabel: string;
        /** Manage songs */
        manageSongsCta: string;
        /** Delete */
        deleteButton: string;
      };
    };
    detail: {
      /** Back to playlists */
      backToPlaylists: string;
      /** Playlist:  */
      titlePrefix: string;
      /** Review songs in this playlist, adjust ordering, and remove tracks you no longer need. */
      description: string;
      /** Songs in this playlist */
      songListTitle: string;
      /** No songs in this playlist yet. */
      songListEmpty: string;
      /** Add songs from your libraries to build this playlist. */
      addedFromLibraryHelper: string;
      /** Total duration */
      playlistDurationLabel: string;
      /** Songs */
      songCountLabel: string;
      /** Album */
      songAlbumLabel: string;
      /** Duration */
      songDurationLabel: string;
      /** Manage libraries */
      manageLibrariesCta: string;
    };
    controls: {
      /** Move up */
      moveUp: string;
      /** Move down */
      moveDown: string;
      /** Remove */
      removeButton: string;
      /** Play */
      playButtonLabel: string;
      /** Loading... */
      playButtonLoading: string;
      /** Play playlist  */
      playButtonAriaPrefix: string;
      /** Order updated */
      toastMoveSuccessTitle: string;
      /** Moved up:  */
      toastMoveUpDescriptionPrefix: string;
      /** Moved down:  */
      toastMoveDownDescriptionPrefix: string;
      /** Song removed */
      toastRemoveSuccessTitle: string;
      /** Removed:  */
      toastRemoveSuccessDescriptionPrefix: string;
      /** Action failed */
      toastActionErrorTitle: string;
      /** Please try again. */
      toastActionErrorDescription: string;
    };
  };
  upload: {
    page: {
      /** Upload Songs */
      title: string;
      /** Save audio files to your library; deduplication and metadata extraction run automatically. */
      description: string;
      /** Upload Audio File */
      cardTitle: string;
      /** No libraries are available yet. Create one in Library Manager before uploading. */
      emptyState: string;
    };
    form: {
      /** Select library */
      selectLibraryLabel: string;
      /** Uploaded songs will be saved to this library. */
      selectLibraryPlaceholder: string;
      /** Create a library first */
      libraryOptionFallback: string;
      /**  songs */
      librarySongSuffix: string;
      /** Select audio file */
      selectFileLabel: string;
      /** Supports MP3, FLAC, WAV, OGG, M4A, AAC, and other common formats. Max size 100 MB per file. */
      fileHelper: string;
      /** Title */
      titleLabel: string;
      /** If left blank, the filename or parsed metadata will be used. */
      titlePlaceholder: string;
      /** Artist */
      artistLabel: string;
      /** Optional */
      optionalPlaceholder: string;
      /** Album */
      albumLabel: string;
      /** Album artist */
      albumArtistLabel: string;
      /** Genre */
      genreLabel: string;
      /** Composer */
      composerLabel: string;
      /** Year */
      yearLabel: string;
      /** Optional, e.g. 2025 */
      yearPlaceholder: string;
      /** Track number */
      trackNumberLabel: string;
      /** Disc number */
      discNumberLabel: string;
      /** Cover image URL */
      coverLabel: string;
      /** Optional, provide a public image link */
      coverPlaceholder: string;
      /** Upload song */
      uploadButton: string;
      /** Uploading... */
      uploadingLabel: string;
      /** Reset form */
      resetButton: string;
      /** " */
      successPrefix: string;
      /** " has been added to  */
      successSuffix: string;
      /** the selected library */
      successFallbackLibrary: string;
      /** Duration:  */
      successDurationPrefix: string;
      /** Unknown */
      successDurationFallback: string;
      /** Bitrate:  */
      successBitratePrefix: string;
      /** Unknown */
      successBitrateFallback: string;
      /**  s */
      durationUnit: string;
      /**  kbps */
      bitrateUnit: string;
    };
  };
}
