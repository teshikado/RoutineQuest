const { app, BrowserWindow, shell, Menu } = require("electron");
const path = require("path");

// The desktop app is a thin client: it does not run a server or touch a
// database itself. It simply opens the hosted RoutineQuest web app (Next.js +
// Postgres, deployed centrally, e.g. on Vercel) in a native window — exactly
// like a browser would. This is what makes shared features (groups,
// leaderboards, group routines) work across different users on different
// PCs/Macs, and it means no database credentials ever ship inside the
// installer. This file runs unmodified on both Windows and macOS.
//
// Override for local development: `npm run electron:dev` sets APP_URL to
// http://localhost:3000 so the wrapper points at your local `next dev` server.
const APP_URL = process.env.APP_URL || "https://routine-quest-rouge.vercel.app";
const isMac = process.platform === "darwin";

// Only one window/instance at a time — a second launch (e.g. double-clicking
// the desktop shortcut while the app is already running) just focuses the
// existing window instead of opening a duplicate.
const gotSingleInstanceLock = app.requestSingleInstanceLock();
if (!gotSingleInstanceLock) {
  app.quit();
}

if (isMac) {
  // macOS still needs an application menu even for a single-purpose window —
  // without it, standard shortcuts users expect (Cmd+Q to quit, Cmd+C/Cmd+V
  // to copy/paste in the email/password fields, Cmd+H to hide) silently stop
  // working, since Electron wires those shortcuts through the menu's roles,
  // not the OS keyboard layer. Windows/Linux keep the old menu-less setup.
  const template = [
    {
      label: app.name,
      submenu: [
        { role: "about" },
        { type: "separator" },
        { role: "hide" },
        { role: "hideOthers" },
        { role: "unhide" },
        { type: "separator" },
        { role: "quit" },
      ],
    },
    {
      label: "Bearbeiten",
      submenu: [
        { role: "undo" },
        { role: "redo" },
        { type: "separator" },
        { role: "cut" },
        { role: "copy" },
        { role: "paste" },
        { role: "selectAll" },
      ],
    },
    {
      label: "Fenster",
      submenu: [{ role: "minimize" }, { role: "close" }, { role: "front" }],
    },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
} else {
  // No File/Edit/View/Window/Help menu bar — this is a single-purpose kiosk-style
  // client, not a browser, so a menu bar would only be visual noise.
  Menu.setApplicationMenu(null);
}

// Small on-brand offline page, shown inside the window itself instead of a
// native OS dialog box — matches the app's dark/purple design instead of
// dropping the user into an unstyled system alert. Built as a data: URL (no
// separate HTML file needed) so APP_URL — which differs between
// `electron:dev` and the packaged app — can be interpolated directly into
// the retry link. Clicking it is a normal navigation to APP_URL, which the
// will-navigate handler below already allows (it starts with APP_URL).
function offlinePageDataUrl() {
  const html = `<!doctype html>
<html lang="de"><head><meta charset="utf-8" />
<style>
  * { box-sizing: border-box; }
  html, body {
    margin: 0; height: 100%; background: #050507; color: #F8F7FC;
    font-family: -apple-system, "Segoe UI", Inter, system-ui, sans-serif;
    display: flex; align-items: center; justify-content: center;
  }
  .card { text-align: center; max-width: 360px; padding: 32px; }
  .glow {
    width: 72px; height: 72px; margin: 0 auto 20px; border-radius: 9999px;
    background: radial-gradient(circle, rgba(168,85,247,0.35) 0%, transparent 70%);
    display: flex; align-items: center; justify-content: center;
  }
  h1 { font-size: 18px; margin: 0 0 8px; }
  p { font-size: 13px; color: #C8C5D2; line-height: 1.5; margin: 0 0 20px; }
  a.retry {
    display: inline-block; padding: 10px 20px; border-radius: 10px;
    background: #A855F7; color: #fff; text-decoration: none; font-size: 13px;
    font-weight: 600; box-shadow: 0 8px 24px rgba(168,85,247,0.35);
  }
  a.retry:hover { background: #9333EA; }
</style></head>
<body>
  <div class="card">
    <div class="glow">
      <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="#D8B4FE" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <line x1="1" y1="1" x2="23" y2="23"></line>
        <path d="M16.72 11.06A10.94 10.94 0 0 1 19 12.55"></path>
        <path d="M5 12.55a10.94 10.94 0 0 1 5.17-2.39"></path>
        <path d="M10.71 5.05A16 16 0 0 1 22.58 9"></path>
        <path d="M1.42 9a15.91 15.91 0 0 1 4.7-2.88"></path>
        <path d="M8.53 16.11a6 6 0 0 1 6.95 0"></path>
        <line x1="12" y1="20" x2="12.01" y2="20"></line>
      </svg>
    </div>
    <h1>RoutineQuest ist nicht erreichbar</h1>
    <p>Für RoutineQuest wird eine Internetverbindung benötigt. Bitte prüfe deine Verbindung und versuche es erneut.</p>
    <a class="retry" href="${APP_URL}">Erneut versuchen</a>
  </div>
</body></html>`;
  return "data:text/html;charset=utf-8," + encodeURIComponent(html);
}

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1320,
    height: 880,
    minWidth: 420,
    minHeight: 600,
    title: "RoutineQuest",
    backgroundColor: "#050507",
    icon: path.join(__dirname, isMac ? "icon.icns" : "icon.ico"),
    autoHideMenuBar: !isMac,
    show: false,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  // Keep the window hidden (behind the dark backgroundColor above, so no
  // white flash either way) until the page has actually painted something —
  // avoids a blank frame between process start and first content.
  mainWindow.once("ready-to-show", () => {
    mainWindow.show();
  });

  // Links that would open a new window (e.g. mailto:, external references)
  // open in the system browser instead of a second app window.
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (!url.startsWith(APP_URL)) {
      shell.openExternal(url);
      return { action: "deny" };
    }
    return { action: "allow" };
  });

  // Same-window navigations (e.g. a plain <a href> to an external site)
  // are redirected to the system browser too, so the app window always
  // stays on the RoutineQuest domain.
  mainWindow.webContents.on("will-navigate", (event, url) => {
    if (!url.startsWith(APP_URL)) {
      event.preventDefault();
      shell.openExternal(url);
    }
  });

  mainWindow.webContents.on("did-fail-load", (_event, errorCode, _errorDescription, validatedURL) => {
    if (errorCode === -3) return; // ERR_ABORTED, e.g. a cancelled in-page navigation
    if (validatedURL.startsWith("data:")) return; // avoid loading the offline page in a loop
    mainWindow.loadURL(offlinePageDataUrl());
  });

  mainWindow.loadURL(APP_URL);
  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

app.on("second-instance", () => {
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
  }
});

app.whenReady().then(() => {
  if (isMac && app.dock) {
    // Explicit dock icon for unpackaged dev runs (`npm run electron:dev`) —
    // a packaged .app already gets this from build.mac.icon/Info.plist.
    app.dock.setIcon(path.join(__dirname, "icon.icns"));
  }

  createWindow();

  if (app.isPackaged) {
    // Checks the GitHub Releases of this repo (see build.publish in
    // package.json) for a newer version, downloads it in the background,
    // and installs it on the next app restart.
    const { autoUpdater } = require("electron-updater");
    autoUpdater.checkForUpdatesAndNotify().catch(() => {
      // Silently ignore — e.g. no releases published yet, or offline.
    });
  }

  app.on("activate", () => {
    // macOS convention: clicking the Dock icon while the app has no open
    // windows (but is still running, see window-all-closed below) reopens one.
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  // macOS convention: closing the last window does not quit the app — it
  // stays in the Dock (relaunched via `activate` above). Windows/Linux quit,
  // since there's no Dock to keep it alive in.
  if (!isMac) app.quit();
});
