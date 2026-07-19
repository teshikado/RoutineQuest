const { app, BrowserWindow, dialog, shell, Menu } = require("electron");
const path = require("path");

// The desktop app is a thin client: it does not run a server or touch a
// database itself. It simply opens the hosted RoutineQuest web app (Next.js +
// Postgres, deployed centrally, e.g. on Vercel) in a native window — exactly
// like a browser would. This is what makes shared features (groups,
// leaderboards, group routines) work across different users on different
// PCs, and it means no database credentials ever ship inside the installer.
//
// Override for local development: `npm run electron:dev` sets APP_URL to
// http://localhost:3000 so the wrapper points at your local `next dev` server.
const APP_URL = process.env.APP_URL || "https://routine-quest-rouge.vercel.app";

// Only one window/instance at a time — a second launch (e.g. double-clicking
// the desktop shortcut while the app is already running) just focuses the
// existing window instead of opening a duplicate.
const gotSingleInstanceLock = app.requestSingleInstanceLock();
if (!gotSingleInstanceLock) {
  app.quit();
}

// No File/Edit/View/Window/Help menu bar — this is a single-purpose kiosk-style
// client, not a browser, so a menu bar would only be visual noise.
Menu.setApplicationMenu(null);

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1320,
    height: 880,
    minWidth: 420,
    minHeight: 600,
    title: "RoutineQuest",
    backgroundColor: "#050507",
    icon: path.join(__dirname, "icon.ico"),
    autoHideMenuBar: true,
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

  mainWindow.webContents.on("did-fail-load", (_event, errorCode, errorDescription) => {
    if (errorCode === -3) return; // ERR_ABORTED, e.g. a cancelled in-page navigation
    dialog
      .showMessageBox(mainWindow, {
        type: "error",
        title: "RoutineQuest ist nicht erreichbar",
        message: "Die Verbindung zu RoutineQuest konnte nicht hergestellt werden.",
        detail: `${APP_URL}\n\n${errorDescription} (${errorCode})\n\nBitte prüfe deine Internetverbindung.`,
        buttons: ["Erneut versuchen", "Beenden"],
        defaultId: 0,
        cancelId: 1,
      })
      .then((result) => {
        if (result.response === 0) mainWindow.loadURL(APP_URL);
        else app.quit();
      });
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
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
