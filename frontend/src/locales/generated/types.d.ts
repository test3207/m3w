/**
 * Auto-generated i18n type definitions
 * DO NOT EDIT MANUALLY
 * 
 * Generated from: src/locales/messages/en.json
 * Command: npm run i18n:build
 */

export interface Messages {
  app: {
    /** M3W Music */
    name: string;
  };
  home: {
    /** Your Music, Your Way */
    title: string;
    /** Self-hosted music player with offline support and complete library ownership. */
    description: string;
    /** Get Started */
    getStarted: string;
    footer: {
      /** Open Source • Self-Hosted • Privacy-First */
      tagline: string;
    };
  };
  signin: {
    /** Back */
    back: string;
    /** Welcome to M3W */
    title: string;
    /** Sign in with your GitHub account to continue */
    description: string;
    /** Sign in with GitHub */
    button: string;
    /** Offline Mode */
    guest: string;
    /** Use locally without an account */
    guestDescription: string;
    /** Processing... */
    processing: string;
    /** By signing in, you agree to our Terms of Service and Privacy Policy. */
    terms: string;
  };
  navigation: {
    /** Libraries */
    libraries: string;
    /** Playlists */
    playlists: string;
    /** Settings */
    settings: string;
  };
  defaults: {
    library: {
      /** Default Library */
      name: string;
      /** Default */
      badge: string;
    };
    playlist: {
      /** My Favorites */
      name: string;
      /** Favorites */
      badge: string;
    };
  };
  error: {
    /** Error */
    title: string;
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
    /** The page you are looking for does not exist */
    pageNotFound: string;
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
    /** Session expired */
    sessionExpired: string;
    /** Please sign in again to continue */
    pleaseSignInAgain: string;
    /** Please try again. */
    genericTryAgain: string;
    /** Failed to delete song */
    failedToDeleteSong: string;
  };
  success: {
    /** Success */
    title: string;
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
    /** Redirecting in */
    redirecting: string;
    /** Error */
    errorLabel: string;
    /** Try again */
    tryAgainLabel: string;
    /** Confirm */
    confirmLabel: string;
    /** Cancel */
    cancelLabel: string;
    /** Cancel */
    cancelButton: string;
    /** Delete */
    deleteButton: string;
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
    /** {0} items */
    itemsCount: string;
    /** Hello {0}, welcome back! */
    greetingWithName: string;
    /** From {0} to {1} */
    dateRange: string;
    timeAgo: {
      /** Just now */
      justNow: string;
      /** {0} minutes ago */
      minutesAgo: string;
      /** {0} hours ago */
      hoursAgo: string;
      /** {0} days ago */
      daysAgo: string;
    };
  };
  networkStatus: {
    /** Online */
    online: string;
    /** Offline */
    offline: string;
    /** Syncing */
    syncing: string;
  };
  sync: {
    /** Sync completed */
    completed: string;
    /** Sync completed with conflicts */
    conflictsResolved: string;
    /** conflicts resolved (server version kept) */
    serverWins: string;
    /** Sync failed */
    failed: string;
    /** Syncing... */
    inProgress: string;
    /** pending changes */
    pendingChanges: string;
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
      /** Your music library is ready. Start uploading and organizing your collection! */
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
      /** Date Added (Newest) */
      sortDateDesc: string;
      /** Date Added (Oldest) */
      sortDateAsc: string;
      /** Title A-Z */
      sortTitleAsc: string;
      /** Title Z-A */
      sortTitleDesc: string;
      /** Artist A-Z */
      sortArtistAsc: string;
      /** Album A-Z */
      sortAlbumAsc: string;
      /** Loading... */
      loadingLabel: string;
      deleteSong: {
        /** Delete Song */
        button: string;
        /** Deleted successfully */
        successTitle: string;
        /** Removed "{0}" from library */
        successDescription: string;
        /** Deletion failed */
        errorTitle: string;
        /** Unknown error */
        unknownError: string;
      };
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
      /** Added "{0}" to "{1}" */
      toastSuccessDescriptionWithName: string;
      /** Added {0} songs to "{1}" */
      batchSuccessDescription: string;
      /** Unable to add song */
      toastErrorTitle: string;
      /** Please try again. */
      toastErrorDescription: string;
      /** Select a playlist first. */
      selectPlaylistFirst: string;
      /** Song is already in this playlist */
      alreadyInPlaylist: string;
      /** Create new playlist */
      createNewPlaylist: string;
      /** Playlist name */
      newPlaylistPlaceholder: string;
      /** Create */
      createButton: string;
      /** Failed to create playlist */
      createPlaylistError: string;
      /** No playlists yet */
      noPlaylists: string;
      /** Select a playlist for "{0}" */
      selectPlaylistForSong: string;
      /** Select a playlist for {0} songs */
      selectPlaylistForSongs: string;
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
      /** Library */
      songLibraryLabel: string;
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
  player: {
    /** Audio player controls */
    ariaLabel: string;
    /** Seek */
    seekLabel: string;
    /** Previous track */
    previousTrack: string;
    /** Next track */
    nextTrack: string;
    /** Play */
    play: string;
    /** Pause */
    pause: string;
    /** Mute */
    mute: string;
    /** Unmute */
    unmute: string;
    /** Volume */
    volume: string;
    repeat: {
      /** Repeat off */
      off: string;
      /** Repeat all */
      all: string;
      /** Repeat one */
      one: string;
    };
    shuffle: {
      /** Enable shuffle */
      enable: string;
      /** Disable shuffle */
      disable: string;
      /** Shuffle */
      label: string;
    };
    favorite: {
      /** Favorite */
      label: string;
      /** Added to Favorites */
      added: string;
      /** Removed from Favorites */
      removed: string;
      /** Failed to add to Favorites */
      addError: string;
      /** Failed to remove from Favorites */
      removeError: string;
    };
    state: {
      /** Repeat: Off */
      repeatOff: string;
      /** Repeat: Queue */
      repeatQueue: string;
      /** Repeat: Track */
      repeatTrack: string;
      /** Shuffle: On */
      shuffleOn: string;
      /** Shuffle: Off */
      shuffleOff: string;
    };
    playQueue: {
      /** Play Queue */
      title: string;
      /** {0} songs */
      songsCount: string;
      /** Playing from: {0} */
      playingFrom: string;
      /** Now Playing */
      nowPlaying: string;
      /** Queue is empty */
      emptyTitle: string;
      /** Select songs from a library or playlist */
      emptyDescription: string;
      /** Play Queue */
      fallbackSource: string;
      /** Removed from queue */
      removeFromQueueTitle: string;
      /** Queue cleared */
      clearQueueTitle: string;
      /** Enter playlist name */
      savePlaylistInputPlaceholder: string;
      /** Please enter playlist name */
      savePlaylistErrorEmptyName: string;
      /** Saved successfully */
      savePlaylistSuccessTitle: string;
      /** Playlist "{0}" has been created */
      savePlaylistSuccessDescription: string;
      /** Save failed */
      savePlaylistErrorTitle: string;
      /** Unable to save playlist */
      savePlaylistErrorDescription: string;
      /** Unknown error */
      savePlaylistErrorUnknown: string;
      /** Clear Queue */
      clearQueueButton: string;
      /** Save as Playlist */
      saveAsPlaylistButton: string;
      /** Saving... */
      savingButton: string;
      /** Save */
      saveButton: string;
    };
  };
  upload: {
    page: {
      /** Upload Songs */
      title: string;
      /** Save audio files to your library; deduplication and metadata extraction run automatically. */
      description: string;
      /** Uploading to: {0} */
      uploadingTo: string;
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
      /** Select audio files */
      selectFilesLabel: string;
      /** Supports MP3, FLAC, WAV, OGG, M4A, AAC, and other common formats. Max size 100 MB per file. */
      fileHelper: string;
      /** Select one or multiple audio files. Metadata will be extracted automatically from ID3 tags. */
      multiFileHelper: string;
      /** Selected files */
      selectedFilesTitle: string;
      /** Clear all */
      clearAllButton: string;
      /** Remove */
      removeButton: string;
      /** Success */
      successLabel: string;
      /** Failed */
      errorLabel: string;
      /** Successfully uploaded  */
      successUploadedCount: string;
      /**  file(s) */
      successUploadedSuffix: string;
      /**  file(s) failed to upload */
      errorUploadedSuffix: string;
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
  playback: {
    /** Now Playing */
    startPlayingTitle: string;
    /** Playing all songs from "{0}" */
    startPlayingDescription: string;
    /** Playing from library */
    playFromLibraryDescription: string;
  };
  settings: {
    /** Settings */
    title: string;
    /** Please sign in */
    pleaseSignIn: string;
    profile: {
      /** Personal Information */
      title: string;
      /** Your account information */
      description: string;
      /** Username: */
      username: string;
      /** Username not set */
      usernameNotSet: string;
      /** Email: */
      email: string;
      /** Login Method: */
      loginMethod: string;
    };
    account: {
      /** Account Actions */
      title: string;
      /** Sign out or manage your account */
      description: string;
      /** Sign Out */
      signOut: string;
    };
    storage: {
      /** Storage Management */
      title: string;
      /** Loading storage information... */
      loading: string;
      pwa: {
        /** PWA Status */
        title: string;
        /** Installed */
        installed: string;
        /** Not Installed */
        notInstalled: string;
        /** Progressive Web App enables offline music playback */
        description: string;
        installPrompt: {
          /** Install M3W */
          title: string;
          /** Install the app for faster access and offline support */
          description: string;
          /** Install */
          install: string;
          /** Not Now */
          notNow: string;
        };
        reloadPrompt: {
          /** New Version Available */
          newVersionTitle: string;
          /** App Ready to Work Offline */
          offlineReadyTitle: string;
          /** Click reload to update to the latest version */
          newVersionDescription: string;
          /** Your music library is now available offline */
          offlineReadyDescription: string;
          /** Reload */
          reload: string;
          /** Close */
          close: string;
        };
      };
      /** Browser Storage */
      globalTitle: string;
      /** Shared across all accounts on this device */
      globalNote: string;
      /** Clear All Data */
      clearAllTitle: string;
      /** This will delete all users' data on this device, including songs, playlists, and settings. */
      clearAllDescription: string;
      /** Clear All Data */
      clearAllButton: string;
      /** All data cleared successfully */
      clearSuccess: string;
      /** Failed to clear data. Please try again. */
      clearError: string;
      clearDialog: {
        /** Confirm Clear All Data */
        title: string;
        /** This action will delete ALL data from this browser, including all users' songs, playlists, settings, and cache. This cannot be undone. You will be signed out and redirected to the homepage. */
        description: string;
        /** Cancel */
        cancel: string;
        /** Delete Everything */
        confirm: string;
        /** Clearing... */
        clearing: string;
      };
    };
    offline: {
      /** Offline Settings */
      title: string;
      /** Configure how your music is cached for offline playback */
      description: string;
      /** Cache All Libraries */
      cacheAll: string;
      /** Automatically download all songs for offline playback (synced across devices) */
      cacheAllDescription: string;
      /** Local Override */
      localOverride: string;
      /** Override the cache setting for this device only */
      localOverrideDescription: string;
      /** Follow Account Setting */
      policyInherit: string;
      /** Always Cache */
      policyAlways: string;
      /** Never Cache */
      policyNever: string;
      /** Download Timing */
      downloadTiming: string;
      /** When to download songs for offline playback */
      downloadTimingDescription: string;
      /** Always Download */
      timingAlways: string;
      /** Wi-Fi Only */
      timingWifiOnly: string;
      /** Manual Only */
      timingManual: string;
      /** Downloading: {active} active, {pending} pending */
      downloadingStatus: string;
      /** Not enough storage space for offline caching */
      cacheNotAvailable: string;
    };
    toast: {
      /** Signed out successfully */
      signOutSuccess: string;
      /** You have been signed out successfully */
      signOutDescription: string;
    };
  };
  libraries: {
    /** Libraries */
    title: string;
    /** {0} libraries */
    count: string;
    create: {
      /** Create New Library */
      dialogTitle: string;
      /** Create a new collection for your music */
      dialogDescription: string;
      /** Library Name */
      nameLabel: string;
      /** e.g. My Music, Work Music */
      namePlaceholder: string;
      /** Cancel */
      cancel: string;
      /** Create */
      submit: string;
      /** Creating... */
      submitting: string;
      /** Please enter library name */
      promptName: string;
      /** Created successfully */
      successTitle: string;
      /** Library "{0}" has been created */
      successDescription: string;
      /** Creation failed */
      errorTitle: string;
      /** Unknown error */
      unknownError: string;
    };
    empty: {
      /** No libraries yet */
      title: string;
      /** Click the "+" button in the top right to create your first library */
      description: string;
    };
    card: {
      /** {0} songs */
      songsCount: string;
      /** Created on {0} */
      createdAt: string;
    };
    delete: {
      /** Delete */
      button: string;
      /** Delete Library */
      confirmTitle: string;
      /** Are you sure you want to delete "{0}"? All songs in this library will be removed. This action cannot be undone. */
      confirmDescription: string;
      /** Deleted successfully */
      successTitle: string;
      /** Library "{0}" has been deleted */
      successDescription: string;
      /** Deletion failed */
      errorTitle: string;
      /** Default library cannot be deleted */
      cannotDeleteDefault: string;
    };
    detail: {
      /** {0} songs */
      songsCount: string;
      /** Play All */
      playAll: string;
      sort: {
        /** Sort by: {0} */
        label: string;
        /** Date Added (Newest) */
        dateDesc: string;
        /** Date Added (Oldest) */
        dateAsc: string;
        /** Title A-Z */
        titleAsc: string;
        /** Title Z-A */
        titleDesc: string;
        /** Artist A-Z */
        artistAsc: string;
        /** Album A-Z */
        albumAsc: string;
      };
      empty: {
        /** No songs yet */
        title: string;
        /** Click the upload button above to add songs to this library */
        description: string;
      };
      deleteSong: {
        /** Delete Song */
        button: string;
        /** Deleted successfully */
        successTitle: string;
        /** Removed "{0}" from library */
        successDescription: string;
        /** Deletion failed */
        errorTitle: string;
        /** Unknown error */
        unknownError: string;
        /** Delete Song */
        confirmTitle: string;
        /** Are you sure you want to delete "{0}"? This song will also be removed from all playlists. This action cannot be undone. */
        confirmDescription: string;
      };
      selection: {
        /** {0} selected */
        selectedCount: string;
        /** Select All */
        selectAll: string;
        /** Cancel */
        cancel: string;
        /** Add to Playlist */
        addToPlaylist: string;
        /** Long press to select multiple songs */
        longPressHint: string;
      };
    };
  };
  playlists: {
    /** Playlists */
    title: string;
    /** {0} playlists */
    count: string;
    create: {
      /** Create New Playlist */
      dialogTitle: string;
      /** Create a custom playlist */
      dialogDescription: string;
      /** Playlist Name */
      nameLabel: string;
      /** e.g. Night Drive, Workout Music */
      namePlaceholder: string;
      /** Cancel */
      cancel: string;
      /** Create */
      submit: string;
      /** Creating... */
      submitting: string;
      /** Please enter playlist name */
      promptName: string;
      /** Created successfully */
      successTitle: string;
      /** Playlist "{0}" has been created */
      successDescription: string;
      /** Creation failed */
      errorTitle: string;
      /** Unknown error */
      unknownError: string;
    };
    empty: {
      /** No playlists yet */
      title: string;
      /** Click the "+" button in the top right to create your first playlist */
      description: string;
    };
    card: {
      /** {0} songs */
      songsCount: string;
      /** Created on {0} */
      createdAt: string;
    };
    delete: {
      /** Delete */
      button: string;
      /** Delete Playlist */
      confirmTitle: string;
      /** Are you sure you want to delete "{0}"? This action cannot be undone. */
      confirmDescription: string;
      /** Deleted successfully */
      successTitle: string;
      /** Playlist "{0}" has been deleted */
      successDescription: string;
      /** Deletion failed */
      errorTitle: string;
      /** Favorites playlist cannot be deleted */
      cannotDeleteDefault: string;
    };
    detail: {
      /** Playlist not found */
      notFound: string;
      /** {0} songs */
      songsCount: string;
      /** Play All */
      playAll: string;
      /** Now Playing: {0} */
      nowPlaying: string;
      /** From: {0} */
      fromLibrary: string;
      empty: {
        /** Playlist is empty */
        title: string;
        /** Add songs from your libraries to this playlist */
        description: string;
        /** Browse Libraries */
        browseButton: string;
      };
      moveSong: {
        /** Song moved */
        successTitle: string;
        /** Move failed */
        errorTitle: string;
      };
      removeSong: {
        /** Removed: {0} */
        successTitle: string;
        /** Removal failed */
        errorTitle: string;
      };
      /** Add songs from your libraries to this playlist */
      addFromLibrary: string;
    };
  };
  demo: {
    /** Demo Environment - Data resets every hour */
    bannerMessage: string;
    /** Storage limit reached (5GB). Please wait for next reset. */
    storageLimitReached: string;
    /** Storage */
    storageUsage: string;
    /** System is resetting, please try again later */
    systemResetting: string;
  };
}
