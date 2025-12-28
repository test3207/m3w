#!/usr/bin/env node
/**
 * Android Emulator Test Script
 *
 * Launches Android emulator, sets up port forwarding, and opens Chrome
 * for PWA testing.
 *
 * Usage: node scripts/android-test.cjs [options]
 *
 * Options:
 *   --help           Show help
 *   --avd=NAME       Specify AVD name (interactive selection if omitted)
 *   --reverse-only   Only set up port forwarding (emulator already running)
 *   --no-chrome      Don't open Chrome after boot
 *   --headless       Run emulator in headless mode
 *   --cold-boot      Force cold boot (no snapshot)
 */

const { execSync, spawn } = require("child_process");
const fs = require("fs");
const path = require("path");
const readline = require("readline");

// ============================================================================
// Configuration
// ============================================================================

const CONFIG = {
  ports: [
    { host: 3000, device: 3000, name: "Frontend (Vite)" },
    { host: 4000, device: 4000, name: "Backend (Hono)" },
  ],
  defaultAvdName: "m3w-test",
  // 5 minutes - Android emulator cold boot (no snapshot) can take 2-4 min
  // on slower machines. Warm boot with snapshots typically takes 10-30 sec.
  bootTimeout: 5 * 60 * 1000,
  adbRetryDelay: 2000,
  adbMaxRetries: 60,
};

// ============================================================================
// Utilities
// ============================================================================

const isWindows = process.platform === "win32";

function log(message, type = "info") {
  const icons = {
    info: "ℹ️ ",
    success: "✅ ",
    error: "❌ ",
    warning: "⚠️ ",
    progress: "⏳ ",
    check: "🔍 ",
    phone: "📱 ",
    link: "🔗 ",
  };
  console.log(`${icons[type] || ""}${message}`);
}

function exec(command, options = {}) {
  try {
    return execSync(command, {
      encoding: "utf8",
      stdio: options.silent ? "pipe" : "inherit",
      ...options,
    }).trim();
  } catch (error) {
    if (!options.ignoreError) {
      throw error;
    }
    return null;
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ============================================================================
// Windows Window Management
// ============================================================================

async function moveEmulatorWindow() {
  if (!isWindows) return;

  log("Adjusting emulator window position...", "info");

  // Create a temporary PowerShell script file
  const scriptPath = path.join(process.env.TEMP || ".", "move-emulator.ps1");
  const psScript = `
Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;
using System.Text;
public class Win32Window {
    [DllImport("user32.dll")] public static extern bool SetWindowPos(IntPtr hWnd, IntPtr hWndInsertAfter, int X, int Y, int cx, int cy, uint uFlags);
    [DllImport("user32.dll")] public static extern int GetWindowText(IntPtr hWnd, StringBuilder lpString, int nMaxCount);
    [DllImport("user32.dll")] public static extern bool IsWindowVisible(IntPtr hWnd);
}
'@

# Try multiple patterns to find emulator window
$patterns = @("*Android Emulator*", "*emulator*", "*Pixel*", "*m3w-test*")
foreach ($pattern in $patterns) {
    Get-Process | Where-Object { $_.MainWindowTitle -like $pattern } | ForEach-Object {
        $hwnd = $_.MainWindowHandle
        if ($hwnd -ne [IntPtr]::Zero) {
            # 0x0001 = SWP_NOSIZE (don't change window size, only position)
            [Win32Window]::SetWindowPos($hwnd, [IntPtr]::Zero, 50, 50, 0, 0, 0x0001)
            Write-Host "MOVED"
            exit 0
        }
    }
}

# Also try by process name (qemu-system)
Get-Process -Name "qemu-system*" -ErrorAction SilentlyContinue | ForEach-Object {
    $hwnd = $_.MainWindowHandle
    if ($hwnd -ne [IntPtr]::Zero) {
        [Win32Window]::SetWindowPos($hwnd, [IntPtr]::Zero, 50, 50, 0, 0, 0x0001)
        Write-Host "MOVED"
        exit 0
    }
}

Write-Host "NOT_FOUND"
`;

  try {
    fs.writeFileSync(scriptPath, psScript);

    // Window may take a moment to fully initialize after boot
    // Try multiple times with increasing delays
    const maxRetries = 10;
    for (let i = 0; i < maxRetries; i++) {
      const result = exec(`powershell -ExecutionPolicy Bypass -File "${scriptPath}"`, {
        silent: true,
        ignoreError: true,
      }) || "";

      if (result.includes("MOVED")) {
        log("Window position adjusted to (50, 50)", "success");
        fs.unlinkSync(scriptPath);
        return;
      }
      
      if (i < maxRetries - 1) {
        // Wait longer between retries (1s, 1s, 1s, ...)
        await sleep(1000);
      }
    }
    
    log("Could not find emulator window (will use default position)", "warning");
    fs.unlinkSync(scriptPath);
  } catch (err) {
    log(`Window adjustment failed: ${err.message}`, "warning");

    try {
      fs.unlinkSync(scriptPath);
    } catch (cleanupErr) {
      log(`Failed to cleanup temp script: ${cleanupErr.message}`, "warning");
    }
  }
}

// ============================================================================
// SDK Detection
// ============================================================================

function findAndroidSdk() {
  const envPaths = [
    process.env.ANDROID_HOME,
    process.env.ANDROID_SDK_ROOT,
    process.env.ANDROID_SDK,
  ].filter(Boolean);

  for (const p of envPaths) {
    if (fs.existsSync(p)) {
      return p;
    }
  }

  // Check default paths
  const defaultPaths = {
    win32: path.join(process.env.LOCALAPPDATA || "", "Android", "Sdk"),
    darwin: path.join(process.env.HOME || "", "Library", "Android", "sdk"),
    linux: path.join(process.env.HOME || "", "Android", "Sdk"),
  };

  const defaultPath = defaultPaths[process.platform];
  if (defaultPath && fs.existsSync(defaultPath)) {
    return defaultPath;
  }

  return null;
}

function getAdbPath(sdkPath) {
  if (!sdkPath) return "adb"; // Fallback to PATH

  const adbPath = path.join(
    sdkPath,
    "platform-tools",
    isWindows ? "adb.exe" : "adb"
  );

  if (fs.existsSync(adbPath)) {
    return `"${adbPath}"`;
  }

  return "adb";
}

function getEmulatorPath(sdkPath) {
  if (!sdkPath) return "emulator"; // Fallback to PATH

  const emulatorPath = path.join(
    sdkPath,
    "emulator",
    isWindows ? "emulator.exe" : "emulator"
  );

  if (fs.existsSync(emulatorPath)) {
    return `"${emulatorPath}"`;
  }

  return "emulator";
}

// ============================================================================
// Emulator Management
// ============================================================================

function listAvds(emulatorPath) {
  try {
    const output = exec(`${emulatorPath} -list-avds`, { silent: true }) || "";
    return output
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean);
  } catch {
    return [];
  }
}

function isEmulatorRunning(adbPath) {
  try {
    const devices = exec(`${adbPath} devices`, { silent: true }) || "";
    return devices.includes("emulator-");
  } catch {
    return false;
  }
}

async function waitForDevice(adbPath, timeout = CONFIG.bootTimeout) {
  log("Waiting for device to boot (this may take a few minutes)...", "progress");

  const startTime = Date.now();
  let lastStatus = "";
  let dotCount = 0;

  while (Date.now() - startTime < timeout) {
    try {
      // Check if device is connected
      const devices = exec(`${adbPath} devices`, { silent: true }) || "";
      if (!devices.includes("emulator-")) {
        // Show progress dots while waiting for emulator to connect
        dotCount++;
        if (dotCount % 5 === 0) {
          const elapsed = Math.round((Date.now() - startTime) / 1000);
          log(`Still waiting for emulator to connect... (${elapsed}s)`, "progress");
        }
        await sleep(CONFIG.adbRetryDelay);
        continue;
      }

      // Check boot status
      const bootAnim =
        exec(`${adbPath} shell getprop init.svc.bootanim`, {
          silent: true,
          ignoreError: true,
        }) || "";

      const sysBootCompleted =
        exec(`${adbPath} shell getprop sys.boot_completed`, {
          silent: true,
          ignoreError: true,
        }) || "";

      const status = `bootanim=${bootAnim.trim()}, boot_completed=${sysBootCompleted.trim()}`;
      if (status !== lastStatus) {
        log(`Boot status: ${status}`, "info");
        lastStatus = status;
      }

      if (sysBootCompleted.trim() === "1") {
        log("Device booted successfully", "success");
        return true;
      }
    } catch {
      // Ignore errors during boot
    }

    await sleep(CONFIG.adbRetryDelay);
  }

  throw new Error(`Device did not boot within ${timeout / 1000} seconds`);
}

/**
 * Validates AVD name to prevent shell injection
 * Only allows alphanumeric, underscores, and hyphens
 */
function validateAvdName(name) {
  const avdPattern = /^[a-zA-Z0-9_-]+$/;
  if (!avdPattern.test(name)) {
    throw new Error(`Invalid AVD name: ${name}. Only alphanumeric, underscores, and hyphens allowed.`);
  }
  return name;
}

async function startEmulator(emulatorPath, avdName, options = {}) {
  // Validate AVD name to prevent shell injection
  const safeAvdName = validateAvdName(avdName);
  
  log(`Starting emulator: ${safeAvdName}`, "phone");

  const args = ["-avd", safeAvdName];

  if (options.headless) {
    args.push("-no-window");
  }

  if (options.coldBoot) {
    args.push("-no-snapshot-load");
  }

  // Start emulator in background
  const emulator = spawn(
    emulatorPath.replace(/"/g, ""),
    args,
    {
      detached: true,
      stdio: "ignore",
      shell: isWindows,
    }
  );

  emulator.unref();

  // Give it a moment to start
  await sleep(3000);

  log("Emulator process started", "success");
}

// ============================================================================
// Port Forwarding
// ============================================================================

async function setupPortForwarding(adbPath) {
  log("Setting up port forwarding...", "link");

  for (const port of CONFIG.ports) {
    try {
      exec(`${adbPath} reverse tcp:${port.device} tcp:${port.host}`, {
        silent: true,
      });
      log(`  ${port.device} → ${port.host} (${port.name})`, "success");
    } catch (err) {
      log(`  Failed to forward port ${port.device}: ${err.message}`, "error");
    }
  }

  log("Port forwarding configured", "success");
}

// ============================================================================
// Chrome DevTools Log Streaming
// ============================================================================

async function setupChromeDevToolsForward(adbPath) {
  log("Setting up Chrome DevTools port forward...", "link");
  try {
    exec(`${adbPath} forward tcp:9222 localabstract:chrome_devtools_remote`, {
      silent: true,
    });
    log("  9222 → chrome_devtools_remote", "success");
    return true;
  } catch (err) {
    log(`  Failed to forward DevTools: ${err.message}`, "error");
    return false;
  }
}

async function streamChromeLogs(adbPath, filterKeywords = []) {
  log("Starting Chrome console log stream...", "info");
  log(`Filter: ${filterKeywords.join(", ")}`, "info");
  log("Press Ctrl+C to stop\n", "info");

  // Set up DevTools forward
  const success = await setupChromeDevToolsForward(adbPath);
  if (!success) {
    log("Cannot stream logs without DevTools connection", "error");
    return;
  }

  // Use WebSocket to connect to Chrome DevTools Protocol
  const http = require("http");

  const fetchTargets = () => {
    return new Promise((resolve, reject) => {
      http.get("http://localhost:9222/json", (res) => {
        let data = "";
        res.on("data", (chunk) => (data += chunk));
        res.on("end", () => {
          try {
            resolve(JSON.parse(data));
          } catch (e) {
            reject(e);
          }
        });
      }).on("error", reject);
    });
  };

  // Wait for Chrome to be ready
  let targets = [];
  for (let i = 0; i < 10; i++) {
    try {
      targets = await fetchTargets();
      if (targets.length > 0) break;
    } catch (err) {
      log(`Chrome not ready (attempt ${i + 1}/10): ${err.message}`, "warning");
      await sleep(1000);
    }
  }

  if (targets.length === 0) {
    log("No Chrome tabs found. Make sure Chrome is open with M3W.", "error");
    return;
  }

  // Find M3W tab
  const m3wTab = targets.find(
    (t) => t.url && (t.url.includes("localhost:3000") || t.url.includes("m3w"))
  ) || targets[0];

  log(`Connecting to: ${m3wTab.title || m3wTab.url}`, "info");

  // Use WebSocket
  const WebSocket = require("ws");
  const ws = new WebSocket(m3wTab.webSocketDebuggerUrl);

  ws.on("open", () => {
    // Enable Runtime to receive console messages
    ws.send(JSON.stringify({ id: 1, method: "Runtime.enable" }));
    log("Connected! Waiting for logs...\n", "success");
  });

  ws.on("message", (data) => {
    try {
      const msg = JSON.parse(data.toString());
      if (msg.method === "Runtime.consoleAPICalled") {
        const args = msg.params.args || [];
        const text = args.map((a) => a.value || a.description || "").join(" ");

        // Filter for relevant logs (use configured keywords)
        const matchesFilter = filterKeywords.length === 0 || 
          filterKeywords.some(keyword => text.includes(keyword));
        
        if (matchesFilter) {
          const timestamp = new Date().toISOString().slice(11, 23);
          console.log(`[${timestamp}] ${text}`);
        }
      }
    } catch (err) {
      // Log parse errors for debugging protocol issues
      log(`DevTools message parse error: ${err.message}`, "error");
    }
  });

  ws.on("error", (err) => {
    log(`WebSocket error: ${err.message}`, "error");
    process.exit(1);
  });

  ws.on("close", () => {
    log("DevTools connection closed", "warning");
    process.exit(0);
  });

  // Keep running until interrupted (Ctrl+C) or WebSocket closes
  await new Promise((resolve) => {
    process.on("SIGINT", () => {
      log("Stopping log stream...", "info");
      ws.close();
      resolve();
    });
    process.on("SIGTERM", () => {
      ws.close();
      resolve();
    });
  });
}

// ============================================================================
// Host Proxy Detection
// ============================================================================

function getHostProxy() {
  if (!isWindows) {
    // macOS/Linux: check environment variables
    const httpProxy = process.env.HTTP_PROXY || process.env.http_proxy;
    const httpsProxy = process.env.HTTPS_PROXY || process.env.https_proxy;
    const proxy = httpsProxy || httpProxy;
    
    if (proxy) {
      // Parse proxy URL to get host:port
      try {
        const url = new URL(proxy);
        return { host: url.hostname, port: url.port || "1080" };
      } catch {
        // Try simple host:port format
        const match = proxy.match(/([^:]+):(\d+)/);
        if (match) {
          return { host: match[1], port: match[2] };
        }
      }
    }
    return null;
  }

  // Windows: read from registry
  try {
    const result = exec(
      'reg query "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Internet Settings" /v ProxyServer',
      { silent: true, ignoreError: true }
    );
    
    if (result) {
      const match = result.match(/ProxyServer\s+REG_SZ\s+(.+)/);
      if (match) {
        const proxyValue = match[1].trim();
        // Windows registry ProxyServer formats:
        // - Simple: "host:port"
        // - Per-protocol: "http=host:port;https=host:port"
        // The regex handles whitespace variations in REG_SZ output
        const simpleMatch = proxyValue.match(/^([^:=;]+):(\d+)$/);
        if (simpleMatch) {
          return { host: simpleMatch[1], port: simpleMatch[2] };
        }
        // Try to extract https or http proxy
        const protocolMatch = proxyValue.match(/https?=([^:;]+):(\d+)/);
        if (protocolMatch) {
          return { host: protocolMatch[1], port: protocolMatch[2] };
        }
      }
    }
    
    // Also check if proxy is enabled
    const enableResult = exec(
      'reg query "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Internet Settings" /v ProxyEnable',
      { silent: true, ignoreError: true }
    );
    
    if (enableResult && enableResult.includes("0x0")) {
      return null; // Proxy disabled
    }
  } catch {
    // Ignore errors
  }
  
  return null;
}

async function setupProxy(adbPath) {
  const proxy = getHostProxy();
  
  if (!proxy) {
    log("No host proxy detected", "info");
    return;
  }
  
  // In emulator, 10.0.2.2 is the host machine's loopback address
  const hostLower = proxy.host.toLowerCase();
  const emulatorProxyHost = hostLower === "localhost" || hostLower === "127.0.0.1"
    ? "10.0.2.2"
    : proxy.host;
  
  const proxyString = `${emulatorProxyHost}:${proxy.port}`;
  
  log(`Setting up proxy: ${proxyString} (host: ${proxy.host}:${proxy.port})`, "link");
  
  try {
    // Use single quotes for shell command to avoid quote escaping issues
    exec(`${adbPath} shell settings put global http_proxy ${proxyString}`, {
      silent: true,
    });
    log(`Proxy configured: ${proxyString}`, "success");
  } catch (err) {
    log(`Failed to set proxy: ${err.message}`, "warning");
  }
}

// ============================================================================
// Hardware Keyboard Support
// ============================================================================

async function enableHardwareKeyboard(adbPath) {
  log("Enabling hardware keyboard...", "info");
  
  try {
    // Enable hardware keyboard input
    exec(`${adbPath} shell settings put secure show_ime_with_hard_keyboard 1`, {
      silent: true,
      ignoreError: true,
    });
    
    // Also set the preference that allows hardware keyboard
    // Note: The content command syntax uses colons for type:value pairs
    exec(`${adbPath} shell content insert --uri content://settings/secure --bind name:s:show_ime_with_hard_keyboard --bind value:i:1`, {
      silent: true,
      ignoreError: true,
    });
    
    log("Hardware keyboard enabled", "success");
  } catch (err) {
    log(`Failed to enable hardware keyboard: ${err.message}`, "warning");
  }
}

// ============================================================================
// Screen Lock & Display Settings
// ============================================================================

async function setupScreenTimeout(adbPath) {
  log("Configuring screen timeout...", "info");
  
  try {
    // Set screen timeout to 30 seconds for easier testing
    exec(`${adbPath} shell settings put system screen_off_timeout 30000`, {
      silent: true,
      ignoreError: true,
    });
    
    log("Screen timeout set to 30 seconds", "success");
    log("Note: For PIN lock, go to Settings > Security > Screen lock", "info");
  } catch (err) {
    log(`Screen timeout setup failed: ${err.message}`, "warning");
  }
}

async function configureDeviceSettings(adbPath) {
  log("Configuring device settings...", "info");
  
  try {
    // Keep animations at normal speed (scale 1 = normal, 0 = disabled)
    // We don't disable animations to maintain realistic testing experience
    exec(`${adbPath} shell settings put global window_animation_scale 1`, {
      silent: true,
      ignoreError: true,
    });
    exec(`${adbPath} shell settings put global transition_animation_scale 1`, {
      silent: true,
      ignoreError: true,
    });
    exec(`${adbPath} shell settings put global animator_duration_scale 1`, {
      silent: true,
      ignoreError: true,
    });
    
    // Stay awake while charging (useful during development)
    // Value 3 = BIT_PLUGGED_USB(1) | BIT_PLUGGED_AC(2) - stays on for USB and AC power
    exec(`${adbPath} shell settings put global stay_on_while_plugged_in 3`, {
      silent: true,
      ignoreError: true,
    });
    
    // Disable showing touches (set to 1 to enable for debugging)
    exec(`${adbPath} shell settings put system show_touches 0`, {
      silent: true,
      ignoreError: true,
    });
    
    log("Device settings configured", "success");
  } catch (err) {
    log(`Device settings configuration failed: ${err.message}`, "warning");
  }
}

// ============================================================================
// Chrome Launch
// ============================================================================

/**
 * Validates URL to prevent shell injection
 * Only allows http/https URLs with safe characters
 */
function validateUrl(url) {
  // Only allow http/https URLs with alphanumeric, dots, colons, slashes, and common URL chars
  const urlPattern = /^https?:\/\/[a-zA-Z0-9][a-zA-Z0-9.-]*(?::\d+)?(?:\/[a-zA-Z0-9._~:/?#[\]@!$&'()*+,;=-]*)?$/;
  if (!urlPattern.test(url)) {
    throw new Error(`Invalid URL format: ${url}`);
  }
  return url;
}

async function openChrome(adbPath, url = "http://localhost:3000") {
  // Validate URL to prevent shell metacharacter injection
  const safeUrl = validateUrl(url);
  
  log(`Opening Chrome with ${safeUrl}...`, "phone");

  try {
    // Start Chrome with the URL
    exec(
      `${adbPath} shell am start -a android.intent.action.VIEW -d "${safeUrl}" com.android.chrome`,
      { silent: true }
    );
    log("Chrome opened", "success");
  } catch {
    // Try with default browser if Chrome not available
    try {
      exec(
        `${adbPath} shell am start -a android.intent.action.VIEW -d "${safeUrl}"`,
        { silent: true }
      );
      log("Browser opened", "success");
    } catch (err) {
      log(`Failed to open browser: ${err.message}`, "warning");
    }
  }
}

// ============================================================================
// Interactive AVD Selection
// ============================================================================

async function selectAvd(avds) {
  if (avds.length === 0) {
    throw new Error(
      "No AVDs found. Run 'npm run android:setup' to create one."
    );
  }

  if (avds.length === 1) {
    return avds[0];
  }

  console.log("\nAvailable AVDs:");
  avds.forEach((avd, i) => {
    const marker = avd === CONFIG.defaultAvdName ? " (default)" : "";
    console.log(`  ${i + 1}. ${avd}${marker}`);
  });

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question("\nSelect AVD (number or name): ", (answer) => {
      rl.close();

      const num = parseInt(answer, 10);
      if (num >= 1 && num <= avds.length) {
        resolve(avds[num - 1]);
      } else if (avds.includes(answer)) {
        resolve(answer);
      } else {
        // Default to first or m3w-test
        const defaultAvd = avds.includes(CONFIG.defaultAvdName)
          ? CONFIG.defaultAvdName
          : avds[0];
        console.log(`Using: ${defaultAvd}`);
        resolve(defaultAvd);
      }
    });
  });
}

// ============================================================================
// Main
// ============================================================================

async function main() {
  const args = process.argv.slice(2);

  if (args.includes("--help")) {
    console.log(`
Android Emulator Test Script

Usage: node scripts/android-test.cjs [options]

Options:
  --help           Show this help
  --avd=NAME       Specify AVD name
  --reverse-only   Only set up port forwarding (emulator already running)
  --no-chrome      Don't open Chrome after boot
  --headless       Run emulator in headless mode
  --cold-boot      Force cold boot (no snapshot, default: true)
  --use-snapshot   Use snapshot for faster boot (may cause issues)
  --logs           Start Chrome DevTools log streaming (shows all logs by default)
  --filter=WORDS   Comma-separated filter keywords (e.g., --filter=[AudioPlayer],seekto)

Examples:
  npm run android:test                    # Start emulator and test
  npm run android:test -- --reverse-only  # Just set up port forwarding
  npm run android:test -- --avd=Pixel_6   # Use specific AVD
  npm run android:test -- --use-snapshot  # Use snapshot (faster but may hang)
  npm run android:test -- --logs          # Stream Chrome console logs
  npm run android:test -- --logs --filter=error,warning  # Custom filter
`);
    process.exit(0);
  }

  console.log("\n📱 M3W Android Testing\n");

  const reverseOnly = args.includes("--reverse-only");
  const noChrome = args.includes("--no-chrome");
  const headless = args.includes("--headless");
  const streamLogs = args.includes("--logs");
  // Default to cold boot to avoid snapshot loading issues
  const coldBoot = !args.includes("--use-snapshot");
  const avdArg = args.find((a) => a.startsWith("--avd="))?.split("=")[1];
  // Parse --filter argument (comma-separated keywords, empty string = no filter)
  const filterArg = args.find((a) => a.startsWith("--filter="));
  const filterKeywords = filterArg !== undefined
    ? filterArg.split("=")[1].split(",").filter(Boolean)
    : undefined; // undefined = use default

  // Find SDK
  const sdkPath = findAndroidSdk();
  if (sdkPath) {
    log(`SDK found: ${sdkPath}`, "success");
  } else {
    log("SDK not found in PATH or default locations", "warning");
    log("Trying system adb/emulator...", "info");
  }

  const adbPath = getAdbPath(sdkPath);
  const emulatorPath = getEmulatorPath(sdkPath);

  // Check if emulator is already running
  const running = isEmulatorRunning(adbPath);

  if (running) {
    log("Emulator already running", "success");
    // Configure device settings for already running emulator
    await setupProxy(adbPath);
    await enableHardwareKeyboard(adbPath);
    await setupScreenTimeout(adbPath);
    await configureDeviceSettings(adbPath);
  } else if (reverseOnly) {
    log("No emulator running. Start one first or remove --reverse-only", "error");
    process.exit(1);
  } else {
    // Need to start emulator
    const avds = listAvds(emulatorPath);

    if (avds.length === 0) {
      log("No AVDs found!", "error");
      log("Run 'npm run android:setup' to create one", "info");
      process.exit(1);
    }

    // Select AVD
    let selectedAvd = avdArg;
    if (!selectedAvd) {
      if (avds.includes(CONFIG.defaultAvdName)) {
        selectedAvd = CONFIG.defaultAvdName;
        log(`Using default AVD: ${selectedAvd}`, "info");
      } else {
        selectedAvd = await selectAvd(avds);
      }
    }

    if (!avds.includes(selectedAvd)) {
      log(`AVD '${selectedAvd}' not found`, "error");
      log(`Available AVDs: ${avds.join(", ")}`, "info");
      process.exit(1);
    }

    // Start emulator
    await startEmulator(emulatorPath, selectedAvd, { headless, coldBoot });

    // Wait for boot
    await waitForDevice(adbPath);

    // Adjust window position on Windows (after boot completes)
    if (!headless) {
      await moveEmulatorWindow();
    }
    
    // Configure device settings
    await setupProxy(adbPath);
    await enableHardwareKeyboard(adbPath);
    await setupScreenTimeout(adbPath);
    await configureDeviceSettings(adbPath);
  }

  // Set up port forwarding
  await setupPortForwarding(adbPath);

  // Open Chrome
  if (!noChrome) {
    await sleep(1000); // Small delay for stability
    await openChrome(adbPath);
  }

  // Print success
  console.log("\n" + "=".repeat(60));
  log("Ready for testing!", "success");
  console.log("=".repeat(60));

  console.log(`
Access in Emulator:
   Frontend: http://localhost:3000
   Backend:  http://localhost:4000

Debugging:
   1. Open chrome://inspect in your desktop Chrome
   2. Click "inspect" under the M3W entry
   3. Full DevTools access!

Testing Tips:
   - Service Worker: Works (localhost is secure context)
   - IndexedDB: Works
   - Media Session: Works (Android native controls)
   - PWA Install: Works (can add to home screen)

Screen Control:
   npm run android:sleep    # Turn off screen
   npm run android:wake     # Turn on screen
   (Or use emulator sidebar power button)

Lock Screen:
   Set PIN via: Settings > Security > Screen lock > PIN
   Screen timeout: 30 seconds

If ports stop working:
   npm run android:reverse

Log Streaming:
   npm run android:test -- --logs
`);

  // Start log streaming if requested
  if (streamLogs) {
    await sleep(2000); // Wait for Chrome to fully load
    await streamChromeLogs(adbPath, filterKeywords);
  }
}

// Run
main().catch((err) => {
  log(`Error: ${err.message}`, "error");
  process.exit(1);
});
