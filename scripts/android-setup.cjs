#!/usr/bin/env node
/**
 * Android SDK Setup Script
 *
 * One-click installation of Android SDK Command-line tools, emulator,
 * and AVD for local PWA testing.
 *
 * Usage: node scripts/android-setup.cjs [options]
 *
 * Options:
 *   --help          Show help
 *   --skip-avd      Skip AVD creation
 *   --avd-name      AVD name (default: m3w-test)
 *   --api-level     Android API level (default: 34)
 *   --mirror        Use mirror for downloads (cn = China mirrors)
 */

const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");
const https = require("https");
const http = require("http");
const { createWriteStream, mkdirSync, existsSync, rmSync } = fs;

// ============================================================================
// Configuration
// ============================================================================

const CONFIG = {
  // SDK download URLs by platform
  sdkUrls: {
    win32:
      "https://dl.google.com/android/repository/commandlinetools-win-11076708_latest.zip",
    darwin:
      "https://dl.google.com/android/repository/commandlinetools-mac-11076708_latest.zip",
    linux:
      "https://dl.google.com/android/repository/commandlinetools-linux-11076708_latest.zip",
  },
  // China mirror (Tencent)
  mirrorBase: "https://mirrors.cloud.tencent.com/AndroidSDK/",
  // Default installation paths
  defaultSdkPaths: {
    win32: path.join(process.env.LOCALAPPDATA || "", "Android", "Sdk"),
    darwin: path.join(process.env.HOME || "", "Library", "Android", "sdk"),
    linux: path.join(process.env.HOME || "", "Android", "Sdk"),
  },
  // SDK components to install
  sdkComponents: [
    "platform-tools",
    "emulator",
    "platforms;android-34",
    "system-images;android-34;google_apis;x86_64",
  ],
  // Default AVD settings
  defaultAvdName: "m3w-test",
  defaultApiLevel: 34,
};

// ============================================================================
// Utilities
// ============================================================================

const isWindows = process.platform === "win32";
const isMac = process.platform === "darwin";

function log(message, type = "info") {
  const icons = {
    info: "ℹ️ ",
    success: "✅ ",
    error: "❌ ",
    warning: "⚠️ ",
    progress: "⏳ ",
    check: "🔍 ",
    download: "📥 ",
    install: "📦 ",
  };
  console.log(`${icons[type] || ""}${message}`);
}

function exec(command, options = {}) {
  try {
    return execSync(command, {
      encoding: "utf8",
      stdio: options.silent ? "pipe" : "inherit",
      ...options,
    });
  } catch (error) {
    if (!options.ignoreError) {
      throw error;
    }
    return null;
  }
}

function commandExists(cmd) {
  try {
    const checkCmd = isWindows ? `where ${cmd}` : `which ${cmd}`;
    execSync(checkCmd, { stdio: "pipe" });
    return true;
  } catch {
    return false;
  }
}

function checkJava() {
  // Check if java command exists
  if (commandExists("java")) {
    return checkJavaVersion();
  }

  // Check JAVA_HOME
  if (process.env.JAVA_HOME && existsSync(path.join(process.env.JAVA_HOME, "bin", isWindows ? "java.exe" : "java"))) {
    log(`Using JAVA_HOME: ${process.env.JAVA_HOME}`, "info");
    return checkJavaVersion();
  }

  // Try to find Java in common locations (for newly installed Java)
  const javaPath = findJavaPath();
  if (javaPath) {
    log(`Found Java at: ${javaPath}`, "success");
    // Set JAVA_HOME for this process
    process.env.JAVA_HOME = javaPath;
    process.env.PATH = `${path.join(javaPath, "bin")}${path.delimiter}${process.env.PATH}`;
    return checkJavaVersion();
  }

  log("Java not found!", "error");
  return tryInstallJava();
}

function findJavaPath() {
  // Common Java installation paths
  const possiblePaths = [];

  if (isWindows) {
    const programFiles = process.env.ProgramFiles || "C:\\Program Files";

    // Microsoft OpenJDK
    const msJdkBase = path.join(programFiles, "Microsoft");
    if (existsSync(msJdkBase)) {
      try {
        const dirs = fs.readdirSync(msJdkBase).filter(d => d.startsWith("jdk-"));
        for (const dir of dirs.sort().reverse()) { // Prefer newer versions
          possiblePaths.push(path.join(msJdkBase, dir));
        }
      } catch {}
    }

    // Eclipse Temurin / Adoptium
    const adoptiumBase = path.join(programFiles, "Eclipse Adoptium");
    if (existsSync(adoptiumBase)) {
      try {
        const dirs = fs.readdirSync(adoptiumBase).filter(d => d.startsWith("jdk-"));
        for (const dir of dirs.sort().reverse()) {
          possiblePaths.push(path.join(adoptiumBase, dir));
        }
      } catch {}
    }

    // Oracle JDK
    possiblePaths.push(path.join(programFiles, "Java", "jdk-17"));
    possiblePaths.push(path.join(programFiles, "Java", "jdk-21"));

    // Zulu
    possiblePaths.push(path.join(programFiles, "Zulu", "zulu-17"));
  } else if (isMac) {
    possiblePaths.push("/Library/Java/JavaVirtualMachines/openjdk-17.jdk/Contents/Home");
    possiblePaths.push("/Library/Java/JavaVirtualMachines/temurin-17.jdk/Contents/Home");
    possiblePaths.push("/opt/homebrew/opt/openjdk@17/libexec/openjdk.jdk/Contents/Home");
    possiblePaths.push("/usr/local/opt/openjdk@17/libexec/openjdk.jdk/Contents/Home");
  } else {
    possiblePaths.push("/usr/lib/jvm/java-17-openjdk-amd64");
    possiblePaths.push("/usr/lib/jvm/java-17-openjdk");
    possiblePaths.push("/usr/lib/jvm/temurin-17-jdk-amd64");
  }

  for (const javaPath of possiblePaths) {
    const javaBin = path.join(javaPath, "bin", isWindows ? "java.exe" : "java");
    if (existsSync(javaBin)) {
      return javaPath;
    }
  }

  return null;
}

function checkJavaVersion() {
  try {
    const version = exec("java -version 2>&1", { silent: true }) || "";
    const match = version.match(/version "?(\d+)/);
    if (match) {
      const majorVersion = parseInt(match[1], 10);
      if (majorVersion >= 11) {
        log(`Java ${majorVersion} found`, "success");
        return true;
      } else {
        log(`Java ${majorVersion} found, but version 11+ recommended`, "warning");
        return true;
      }
    }
    log("Java found", "success");
    return true;
  } catch {
    log("Could not determine Java version, continuing anyway", "warning");
    return true;
  }
}

function tryInstallJava() {
  log("Attempting to install Java automatically...", "install");

  if (isWindows) {
    // Try winget first
    if (commandExists("winget")) {
      log("Installing OpenJDK 17 via winget...", "progress");
      try {
        exec("winget install Microsoft.OpenJDK.17 --accept-source-agreements --accept-package-agreements", {
          silent: false,
        });
        log("Java installed! Please restart your terminal and run this script again.", "success");
        return false; // Need restart
      } catch (err) {
        log(`winget install failed: ${err.message}`, "warning");
      }
    }

    // Try chocolatey
    if (commandExists("choco")) {
      log("Installing OpenJDK 17 via Chocolatey...", "progress");
      try {
        exec("choco install openjdk17 -y", { silent: false });
        log("Java installed! Please restart your terminal and run this script again.", "success");
        return false;
      } catch (err) {
        log(`choco install failed: ${err.message}`, "warning");
      }
    }
  } else if (isMac) {
    // Try homebrew
    if (commandExists("brew")) {
      log("Installing OpenJDK 17 via Homebrew...", "progress");
      try {
        exec("brew install openjdk@17", { silent: false });
        // Link it
        exec("sudo ln -sfn $(brew --prefix)/opt/openjdk@17/libexec/openjdk.jdk /Library/Java/JavaVirtualMachines/openjdk-17.jdk", {
          silent: true,
          ignoreError: true,
        });
        log("Java installed! Please restart your terminal and run this script again.", "success");
        return false;
      } catch (err) {
        log(`brew install failed: ${err.message}`, "warning");
      }
    }
  } else {
    // Linux - try apt or dnf
    if (commandExists("apt")) {
      log("Installing OpenJDK 17 via apt (may require sudo password)...", "progress");
      try {
        exec("sudo apt update && sudo apt install -y openjdk-17-jdk", { silent: false });
        log("Java installed! Please restart your terminal and run this script again.", "success");
        return false;
      } catch (err) {
        log(`apt install failed: ${err.message}`, "warning");
      }
    } else if (commandExists("dnf")) {
      log("Installing OpenJDK 17 via dnf (may require sudo password)...", "progress");
      try {
        exec("sudo dnf install -y java-17-openjdk-devel", { silent: false });
        log("Java installed! Please restart your terminal and run this script again.", "success");
        return false;
      } catch (err) {
        log(`dnf install failed: ${err.message}`, "warning");
      }
    }
  }

  // Manual instructions if auto-install failed
  console.log(`
❌ Automatic Java installation failed.

Please install Java manually:

Windows:
  winget install Microsoft.OpenJDK.17
  - OR download from: https://adoptium.net/temurin/releases/

macOS:
  brew install openjdk@17

Linux:
  sudo apt install openjdk-17-jdk  (Debian/Ubuntu)
  sudo dnf install java-17-openjdk-devel  (Fedora/RHEL)

After installation, restart your terminal and run this script again.
`);
  return false;
}

// ============================================================================
// SDK Detection
// ============================================================================

function findAndroidSdk() {
  // Check environment variables
  const envPaths = [
    process.env.ANDROID_HOME,
    process.env.ANDROID_SDK_ROOT,
    process.env.ANDROID_SDK,
  ].filter(Boolean);

  for (const p of envPaths) {
    if (existsSync(p) && existsSync(path.join(p, "cmdline-tools"))) {
      return p;
    }
  }

  // Check default paths
  const defaultPath = CONFIG.defaultSdkPaths[process.platform];
  if (defaultPath && existsSync(defaultPath)) {
    const hasTools =
      existsSync(path.join(defaultPath, "cmdline-tools")) ||
      existsSync(path.join(defaultPath, "platform-tools"));
    if (hasTools) {
      return defaultPath;
    }
  }

  // Check common paths
  const commonPaths = [
    path.join(process.env.HOME || "", "Android", "Sdk"),
    path.join(process.env.LOCALAPPDATA || "", "Android", "Sdk"),
    "C:\\Android\\Sdk",
    "/usr/local/android-sdk",
  ];

  for (const p of commonPaths) {
    if (existsSync(p) && existsSync(path.join(p, "cmdline-tools"))) {
      return p;
    }
  }

  return null;
}

function getSdkManagerPath(sdkPath) {
  const possiblePaths = [
    path.join(sdkPath, "cmdline-tools", "latest", "bin", "sdkmanager"),
    path.join(sdkPath, "cmdline-tools", "bin", "sdkmanager"),
    path.join(sdkPath, "tools", "bin", "sdkmanager"),
  ];

  const ext = isWindows ? ".bat" : "";
  for (const candidatePath of possiblePaths) {
    const fullPath = candidatePath + ext;
    if (existsSync(fullPath)) {
      return fullPath;
    }
  }
  return null;
}

function getAvdManagerPath(sdkPath) {
  const possiblePaths = [
    path.join(sdkPath, "cmdline-tools", "latest", "bin", "avdmanager"),
    path.join(sdkPath, "cmdline-tools", "bin", "avdmanager"),
    path.join(sdkPath, "tools", "bin", "avdmanager"),
  ];

  const ext = isWindows ? ".bat" : "";
  for (const candidatePath of possiblePaths) {
    const fullPath = candidatePath + ext;
    if (existsSync(fullPath)) {
      return fullPath;
    }
  }
  return null;
}

function getEmulatorPath(sdkPath) {
  const emulatorPath = path.join(
    sdkPath,
    "emulator",
    isWindows ? "emulator.exe" : "emulator"
  );
  if (existsSync(emulatorPath)) {
    return emulatorPath;
  }
  return null;
}

// ============================================================================
// Download & Extract
// ============================================================================

function downloadFile(url, destPath, useMirror = false) {
  return new Promise((resolve, reject) => {
    let finalUrl = url;
    if (useMirror && url.includes("dl.google.com")) {
      // Try to use mirror
      const filename = path.basename(url);
      finalUrl = CONFIG.mirrorBase + filename;
      log(`Using mirror: ${finalUrl}`, "info");
    }

    const protocol = finalUrl.startsWith("https") ? https : http;
    const file = createWriteStream(destPath);
    let downloadedBytes = 0;
    let totalBytes = 0;
    let lastProgress = 0;

    const request = protocol.get(finalUrl, (response) => {
      // Handle redirects
      if (response.statusCode === 301 || response.statusCode === 302) {
        file.close();
        rmSync(destPath, { force: true });
        downloadFile(response.headers.location, destPath, false)
          .then(resolve)
          .catch(reject);
        return;
      }

      if (response.statusCode !== 200) {
        file.close();
        rmSync(destPath, { force: true });
        reject(new Error(`Download failed with status ${response.statusCode}`));
        return;
      }

      totalBytes = parseInt(response.headers["content-length"] || "0", 10);

      response.on("data", (chunk) => {
        downloadedBytes += chunk.length;
        if (totalBytes > 0) {
          const progress = Math.floor((downloadedBytes / totalBytes) * 100);
          if (progress >= lastProgress + 10) {
            const mb = (downloadedBytes / 1024 / 1024).toFixed(1);
            const totalMb = (totalBytes / 1024 / 1024).toFixed(1);
            process.stdout.write(`\r   ${progress}% (${mb}MB / ${totalMb}MB)`);
            lastProgress = progress;
          }
        }
      });

      response.pipe(file);

      file.on("finish", () => {
        file.close();
        console.log(); // New line after progress
        resolve(destPath);
      });
    });

    request.on("error", (err) => {
      file.close();
      rmSync(destPath, { force: true });
      reject(err);
    });

    request.setTimeout(30000, () => {
      request.destroy();
      reject(new Error("Download timeout"));
    });
  });
}

async function extractZip(zipPath, destPath) {
  // Use PowerShell on Windows, unzip on Unix
  mkdirSync(destPath, { recursive: true });

  if (isWindows) {
    // Use -LiteralPath to handle paths with special characters
    const psCommand = `Expand-Archive -LiteralPath '${zipPath.replace(/'/g, "''")}' -DestinationPath '${destPath.replace(/'/g, "''")}' -Force`;
    exec(
      `powershell -NoProfile -Command "${psCommand}"`,
      { silent: true }
    );
  } else {
    exec(`unzip -o -q "${zipPath}" -d "${destPath}"`, { silent: true });
  }
}

// ============================================================================
// Installation
// ============================================================================

async function installSdk(targetPath, useMirror = false) {
  const platform = process.platform;
  const downloadUrl = CONFIG.sdkUrls[platform];

  if (!downloadUrl) {
    throw new Error(`Unsupported platform: ${platform}`);
  }

  // Create SDK directory
  mkdirSync(targetPath, { recursive: true });

  // Download
  const zipPath = path.join(targetPath, "cmdline-tools.zip");
  log(`Downloading Android Command-line tools (~150MB)...`, "download");

  try {
    await downloadFile(downloadUrl, zipPath, useMirror);
  } catch (err) {
    if (!useMirror) {
      // Fallback to Tencent mirror for China network accessibility
      // Note: Mirror downloads same official Google SDK files, just via different CDN
      // The downloaded content is verified by the SDK installer during component installation
      log("Download slow or failed. Trying China mirror...", "warning");
      await downloadFile(downloadUrl, zipPath, true);
    } else {
      throw err;
    }
  }

  // Extract
  log("Extracting...", "install");
  const cmdlineToolsPath = path.join(targetPath, "cmdline-tools");
  await extractZip(zipPath, targetPath);

  // Move to proper location (cmdline-tools/latest)
  const extractedPath = path.join(targetPath, "cmdline-tools");
  const latestPath = path.join(targetPath, "cmdline-tools-temp");

  if (existsSync(extractedPath)) {
    // Rename to temp first
    fs.renameSync(extractedPath, latestPath);
    // Create proper structure
    mkdirSync(cmdlineToolsPath, { recursive: true });
    fs.renameSync(latestPath, path.join(cmdlineToolsPath, "latest"));
  }

  // Cleanup downloaded zip file
  try {
    rmSync(zipPath, { force: true });
  } catch (cleanupErr) {
    log(`Note: Could not remove temp file ${zipPath}: ${cleanupErr.message}`, "warning");
  }

  log("Command-line tools installed", "success");
  return targetPath;
}

async function acceptLicenses(sdkPath) {
  const sdkManager = getSdkManagerPath(sdkPath);
  if (!sdkManager) {
    throw new Error("sdkmanager not found");
  }

  log("Accepting licenses...", "install");

  // Accept all licenses automatically
  const yesInput = "y\ny\ny\ny\ny\ny\ny\ny\n";

  try {
    if (isWindows) {
      // Windows: Use PowerShell for reliable piping of multiple 'y' inputs
      const yesCommand = `@('y','y','y','y','y','y','y','y') | ForEach-Object { $_ } | & '${sdkManager.replace(/'/g, "''")}' --licenses`;
      exec(`powershell -NoProfile -Command "${yesCommand}"`, {
        silent: true,
        ignoreError: true,
      });
    } else {
      exec(`yes | "${sdkManager}" --licenses`, {
        silent: true,
        ignoreError: true,
      });
    }
    log("Licenses accepted", "success");
  } catch {
    // License acceptance may return non-zero even on success
    log("Licenses processed", "success");
  }
}

async function installComponents(sdkPath) {
  const sdkManager = getSdkManagerPath(sdkPath);
  if (!sdkManager) {
    throw new Error("sdkmanager not found");
  }

  log("Installing SDK components (this may take 10-20 minutes)...", "install");
  log("Components: " + CONFIG.sdkComponents.join(", "), "info");

  // SDK component names are defined in CONFIG.sdkComponents constant - no user input
  for (const component of CONFIG.sdkComponents) {
    log(`Installing ${component}...`, "progress");
    try {
      exec(`"${sdkManager}" "${component}"`, { silent: false });
      log(`${component} installed`, "success");
    } catch (err) {
      log(`Failed to install ${component}: ${err.message}`, "error");
      throw err;
    }
  }

  log("All SDK components installed", "success");
}

async function createAvd(sdkPath, avdName, apiLevel) {
  // Validate AVD name to prevent shell injection (only alphanumeric, underscores, hyphens)
  const avdPattern = /^[a-zA-Z0-9_-]+$/;
  if (!avdPattern.test(avdName)) {
    throw new Error(`Invalid AVD name: ${avdName}. Only alphanumeric, underscores, and hyphens allowed.`);
  }
  
  const avdManager = getAvdManagerPath(sdkPath);
  if (!avdManager) {
    throw new Error("avdmanager not found");
  }

  const systemImage = `system-images;android-${apiLevel};google_apis;x86_64`;

  log(`Creating AVD '${avdName}'...`, "install");

  try {
    // Delete existing AVD if exists
    exec(`"${avdManager}" delete avd -n "${avdName}"`, {
      silent: true,
      ignoreError: true,
    });

    // Create new AVD
    const createCmd = `"${avdManager}" create avd -n "${avdName}" -k "${systemImage}" --force -d "pixel_6"`;

    if (isWindows) {
      exec(`echo no | ${createCmd}`, { silent: true });
    } else {
      exec(`echo "no" | ${createCmd}`, { silent: true });
    }

    // Enable hardware keyboard in AVD config
    const avdConfigPath = path.join(
      process.env.HOME || process.env.USERPROFILE,
      ".android",
      "avd",
      `${avdName}.avd`,
      "config.ini"
    );

    if (fs.existsSync(avdConfigPath)) {
      let config = fs.readFileSync(avdConfigPath, "utf8");
      // Replace hw.keyboard = no with yes (case-insensitive)
      config = config.replace(/hw\.keyboard\s*=\s*no/gi, "hw.keyboard = yes");
      // If hw.keyboard doesn't exist (case-insensitive check to match replacement), add it
      if (!/hw\.keyboard/i.test(config)) {
        config += "\nhw.keyboard = yes\n";
      }
      fs.writeFileSync(avdConfigPath, config);
      log("Hardware keyboard enabled in AVD config", "success");
    }

    log(`AVD '${avdName}' created`, "success");
  } catch (err) {
    log(`Failed to create AVD: ${err.message}`, "error");
    throw err;
  }
}

// ============================================================================
// Main
// ============================================================================

async function main() {
  const args = process.argv.slice(2);

  if (args.includes("--help")) {
    console.log(`
Android SDK Setup Script

Usage: node scripts/android-setup.cjs [options]

Options:
  --help          Show this help
  --skip-avd      Skip AVD creation
  --avd-name=NAME AVD name (default: m3w-test)
  --api-level=N   Android API level (default: 34)
  --mirror        Use China mirror for downloads
  --force         Force reinstall even if SDK exists
`);
    process.exit(0);
  }

  console.log("\n🤖 Android SDK Setup for M3W Development\n");

  // Step 0: Check Java
  log("Checking Java installation...", "check");
  if (!checkJava()) {
    process.exit(1);
  }

  const skipAvd = args.includes("--skip-avd");
  const useMirror = args.includes("--mirror");
  const force = args.includes("--force");
  const avdName =
    args.find((a) => a.startsWith("--avd-name="))?.split("=")[1] ||
    CONFIG.defaultAvdName;
  const apiLevel =
    args.find((a) => a.startsWith("--api-level="))?.split("=")[1] ||
    CONFIG.defaultApiLevel;

  // Step 1: Check existing SDK
  log("Checking for existing Android SDK...", "check");
  let sdkPath = findAndroidSdk();

  if (sdkPath && !force) {
    log(`Found existing SDK at: ${sdkPath}`, "success");

    // Check if all components are installed
    const emulator = getEmulatorPath(sdkPath);
    if (emulator) {
      log("Emulator is installed", "success");

      if (!skipAvd) {
        // Check AVD
        log("Checking for AVD...", "check");
        try {
          const avds = exec(`"${emulator}" -list-avds`, { silent: true }) || "";
          if (avds.includes(avdName)) {
            log(`AVD '${avdName}' already exists`, "success");
          } else {
            await createAvd(sdkPath, avdName, apiLevel);
          }
        } catch {
          await createAvd(sdkPath, avdName, apiLevel);
        }
      }

      printSuccess(sdkPath);
      return;
    }
  }

  // Step 2: Install SDK
  if (!sdkPath || force) {
    sdkPath = CONFIG.defaultSdkPaths[process.platform];
    log(`Installing SDK to: ${sdkPath}`, "info");

    try {
      await installSdk(sdkPath, useMirror);
    } catch (err) {
      log(`SDK installation failed: ${err.message}`, "error");
      process.exit(1);
    }
  }

  // Step 3: Accept licenses
  try {
    await acceptLicenses(sdkPath);
  } catch (err) {
    log(`License acceptance failed: ${err.message}`, "error");
    process.exit(1);
  }

  // Step 4: Install components
  try {
    await installComponents(sdkPath);
  } catch (err) {
    log(`Component installation failed: ${err.message}`, "error");
    process.exit(1);
  }

  // Step 5: Create AVD
  if (!skipAvd) {
    try {
      await createAvd(sdkPath, avdName, apiLevel);
    } catch (err) {
      log(`AVD creation failed: ${err.message}`, "error");
      log("You can create it manually later or re-run this script", "warning");
    }
  }

  // Step 6: Print environment setup instructions
  printSuccess(sdkPath);
}

function printSuccess(sdkPath) {
  console.log("\n" + "=".repeat(60));
  log("Android SDK setup complete!", "success");
  console.log("=".repeat(60));

  console.log(`
📍 SDK Location: ${sdkPath}

🔧 Environment Variables (add to your shell profile):
`);

  if (isWindows) {
    console.log(`   [System.Environment]::SetEnvironmentVariable("ANDROID_HOME", "${sdkPath}", "User")`);
    console.log(`   [System.Environment]::SetEnvironmentVariable("Path", "$env:Path;${sdkPath}\\platform-tools;${sdkPath}\\emulator", "User")`);
  } else {
    console.log(`   export ANDROID_HOME="${sdkPath}"`);
    console.log(`   export PATH="$PATH:$ANDROID_HOME/platform-tools:$ANDROID_HOME/emulator"`);
  }

  console.log(`
🚀 Next Steps:
   1. Restart your terminal (for environment variables)
   2. Run: npm run android:test

📱 Tips:
   - Chrome DevTools: Open chrome://inspect on your host browser
   - Emulator snapshots: Use Quick Boot for faster startup
`);
}

// Run
main().catch((err) => {
  log(`Unexpected error: ${err.message}`, "error");
  console.error(err.stack);
  process.exit(1);
});
