# Android Emulator Testing Guide

This guide explains how to set up Android Emulator for testing M3W PWA features locally.

## Why Android Emulator?

Physical Android phones require USB debugging setup and may have driver issues. The Android Emulator provides:

- ✅ **Secure Context**: `localhost` is a secure origin (Service Worker, IndexedDB work)
- ✅ **Media Session API**: Native Android media controls integration
- ✅ **PWA Install**: Can install to home screen
- ✅ **No USB Required**: Software-only solution
- ✅ **Chrome DevTools**: Remote debugging via `chrome://inspect`

## Quick Start (Recommended)

### One-Time Setup

```bash
# Install Android SDK, emulator, and create AVD (takes 10-20 minutes)
npm run android:setup
```

This script will:

1. Download Android Command-line tools (~150MB)
2. Install platform-tools, emulator, and system images (~2.5GB)
3. Create an AVD named `m3w-test`

### Start Testing

```bash
# Terminal 1: Start dev servers
npm run dev

# Terminal 2: Launch emulator and open Chrome
npm run android:test
```

## Commands Reference

| Command | Description |
| ------- | ----------- |
| `npm run android:setup` | Install Android SDK and create AVD |
| `npm run android:test` | Start emulator, port forwarding, open Chrome |
| `npm run android:reverse` | Only set up port forwarding (emulator already running) |

### Options

```bash
# Setup options
npm run android:setup -- --mirror         # Use China mirrors
npm run android:setup -- --skip-avd       # Don't create AVD
npm run android:setup -- --avd-name=MyAVD # Custom AVD name
npm run android:setup -- --force          # Force reinstall

# Test options
npm run android:test -- --avd=Pixel_6     # Use specific AVD
npm run android:test -- --reverse-only    # Only port forwarding
npm run android:test -- --no-chrome       # Don't open Chrome
npm run android:test -- --headless        # No emulator window
npm run android:test -- --cold-boot       # Force cold boot
```

## Port Forwarding

The scripts automatically set up `adb reverse` to forward ports:

| Emulator Port | Host Port | Service |
| ------------- | --------- | ------- |
| 3000 | 3000 | Frontend (Vite) |
| 4000 | 4000 | Backend (Hono) |

This allows the emulator to access `http://localhost:3000` and reach your host machine's dev server.

## Debugging with Chrome DevTools

1. Open `chrome://inspect` in your desktop Chrome
2. Click "inspect" under the M3W entry
3. Full DevTools access (Elements, Console, Network, Application)

## Manual Setup (Alternative)

If the automated scripts don't work, follow these steps:

### 1. Install Android Studio

Download from: <https://developer.android.com/studio>

Or install just Command-line tools:

- Windows: <https://dl.google.com/android/repository/commandlinetools-win-11076708_latest.zip>
- macOS: <https://dl.google.com/android/repository/commandlinetools-mac-11076708_latest.zip>
- Linux: <https://dl.google.com/android/repository/commandlinetools-linux-11076708_latest.zip>

### 2. Install SDK Components

```bash
# Set ANDROID_HOME (adjust path as needed)
# Windows (PowerShell):
$env:ANDROID_HOME = "$env:LOCALAPPDATA\Android\Sdk"

# macOS/Linux:
export ANDROID_HOME=~/Android/Sdk

# Install components
sdkmanager "platform-tools" "emulator" "platforms;android-34" "system-images;android-34;google_apis;x86_64"
```

### 3. Create AVD

```bash
# Accept licenses
sdkmanager --licenses

# Create AVD
avdmanager create avd -n m3w-test -k "system-images;android-34;google_apis;x86_64" -d "pixel_6"
```

### 4. Start Emulator

```bash
emulator -avd m3w-test
```

### 5. Port Forwarding

```bash
# Wait for device to boot
adb wait-for-device

# Set up reverse port forwarding
adb reverse tcp:3000 tcp:3000
adb reverse tcp:4000 tcp:4000
```

### 6. Open Chrome

```bash
adb shell am start -a android.intent.action.VIEW -d "http://localhost:3000" com.android.chrome
```

## Troubleshooting

### Emulator won't start

**Symptom**: Emulator hangs or crashes on startup

**Solutions**:

1. Enable hardware acceleration (Intel HAXM or AMD SVM)
2. Try cold boot: `npm run android:test -- --cold-boot`
3. Use a different system image (try `google_apis_playstore` instead of `google_apis`)
4. Increase RAM allocation in AVD settings

### Port forwarding not working

**Symptom**: Emulator can't reach localhost

**Solutions**:

1. Re-run: `npm run android:reverse`
2. Restart ADB: `adb kill-server && adb start-server`
3. Check emulator is "device" state: `adb devices`
4. Try explicit device: `adb -s emulator-5554 reverse tcp:3000 tcp:3000`

### Download slow (China)

**Symptom**: SDK download hangs or times out

**Solution**: Use mirror flag:

```bash
npm run android:setup -- --mirror
```

### "ANDROID_HOME is not set"

**Windows (PowerShell)**:

```powershell
[System.Environment]::SetEnvironmentVariable("ANDROID_HOME", "$env:LOCALAPPDATA\Android\Sdk", "User")
```

**macOS/Linux (.bashrc or .zshrc)**:

```bash
export ANDROID_HOME=~/Android/Sdk
export PATH="$PATH:$ANDROID_HOME/platform-tools:$ANDROID_HOME/emulator"
```

### AVD not found

**Symptom**: `npm run android:test` says no AVDs found

**Solution**: Run setup first:

```bash
npm run android:setup
```

Or create manually:

```bash
avdmanager create avd -n m3w-test -k "system-images;android-34;google_apis;x86_64"
```

## Hardware Requirements

- **CPU**: Intel with VT-x or AMD with SVM (hardware virtualization)
- **RAM**: 8GB minimum, 16GB recommended
- **Disk**: ~5GB for SDK and emulator images
- **OS**: Windows 10+, macOS 10.14+, or Linux

## Testing PWA Features

### Service Worker

Works out of the box on `localhost` (secure context).

### Media Session

1. Play a song in M3W
2. Swipe down notification shade
3. See media controls with artwork, title, play/pause

### PWA Install

1. Open M3W in Chrome
2. Menu (⋮) → "Add to Home screen" or "Install app"
3. App appears in launcher

### Offline Mode

1. Play some songs (they get cached)
2. Enable airplane mode in emulator
3. App continues to work with cached content

## Resources

- [Android Emulator Documentation](https://developer.android.com/studio/run/emulator)
- [ADB Documentation](https://developer.android.com/studio/command-line/adb)
- [Chrome Remote Debugging](https://developer.chrome.com/docs/devtools/remote-debugging/)
