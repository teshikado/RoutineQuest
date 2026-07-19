const { app, BrowserWindow, dialog, shell } = require("electron");
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
const APP_URL = process.env.APP_URL || "https://routinequest.vercel.app";

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1320,
    height: 880,
    minWidth: 420,
    minHeight: 600,
    title: "RoutineQuest",
    backgroundColor: "#EAF7FC",
    icon: path.join(__dirname, "icon.ico"),
    autoHideMenuBar: true,
    webPreferences: {
      contextIsolation: true,
      sandbox: true,
    },
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

app.whenReady().then(() => {
  createWindow();

  if (app.isPackaged) {
    // Auto-update check; no-op until electron-builder `publish` is configured
    // against a real GitHub repo with published releases (see README).
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
