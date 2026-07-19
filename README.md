# RoutineQuest

Routine aufbauen. XP sammeln. Gemeinsam aufsteigen.

Habit-Tracker mit XP-, Level-, Rang- und Gruppensystem (inkl. gemeinsamer
Gruppenroutinen mit Rangliste, wöchentlichem Champion und Statistiken).
Next.js (App Router) + TypeScript, Prisma/PostgreSQL, Auth.js (Credentials),
Tailwind CSS, Recharts — als Website **und** als Windows-Desktop-App.

## Architektur

RoutineQuest besteht aus zwei Teilen, die unabhängig voneinander laufen:

1. **Die Web-App** (`src/`) — die eigentliche Next.js-Anwendung mit Prisma/PostgreSQL.
   Wird zentral gehostet (empfohlen: [Vercel](https://vercel.com)) und bedient
   sowohl Browser-Nutzer als auch die Desktop-App.
2. **Der Desktop-Client** (`electron/`) — ein **schlanker Electron-Wrapper**,
   der beim Start einfach die gehostete Web-App in einem nativen Fenster lädt
   (wie ein Browser mit fester Startseite, ohne Adressleiste). Er enthält
   **keinen** eigenen Server, **keine** Datenbank-Zugangsdaten und **kein**
   Prisma — nur `electron-updater` für Auto-Updates.

**Warum so und nicht "jeder Nutzer bekommt seine eigene lokale Datenbank"?**
Gruppen, Ranglisten und Gruppenroutinen sind zwischen mehreren Nutzern auf
verschiedenen PCs geteilte Daten — das funktioniert nur mit einer zentralen
Datenbank. Der Client greift nie direkt auf Postgres zu; er spricht
ausschließlich HTTPS mit der gehosteten Web-App, genau wie ein Browser. Der
Datenbank-Connection-String liegt dadurch **nur serverseitig** (bei Vercel),
niemals in der an Endnutzer verteilten `.exe`.

```
Windows-Nutzer ──(HTTPS)──► gehostete Web-App (Vercel) ──► PostgreSQL (z.B. Neon)
      ▲
      └── Electron-Fenster lädt nur die obige URL, sonst nichts
```

## Lokale Entwicklung

Vorbedingungen: Node.js 20+, npm, lokal laufendes PostgreSQL (für die
Datenbank während der Entwicklung — **nur** für Entwicklung, nicht für
Endnutzer der fertigen Desktop-App nötig).

```powershell
npm install                        # installiert Abhängigkeiten, generiert Prisma-Client (postinstall)
Copy-Item .env.example .env        # dann DATABASE_URL/AUTH_SECRET in .env eintragen
npx prisma migrate deploy          # wendet alle Migrationen auf die lokale DB an
npm run dev                        # http://localhost:3000
```

`AUTH_SECRET` generieren: `npx auth secret` (oder `openssl rand -base64 32`).

### Desktop-App lokal testen

```powershell
npm run electron:dev
```

Startet die Electron-Hülle mit `APP_URL=http://localhost:3000` — dafür muss
`npm run dev` parallel in einem zweiten Terminal laufen. `npm run electron`
(ohne `:dev`) lädt stattdessen die produktive, gehostete URL aus
`electron/main.js`.

### Bekanntes Problem: Turbopack auf Windows

Falls `next dev` mit `Turbopack is not supported on this platform` abbricht
(z. B. weil eine Windows-Anwendungssteuerungsrichtlinie / Smart App Control
die native `.node`-Datei blockiert), nutze stattdessen:

```powershell
npm run dev:webpack
```

## Produktion: Web-App hosten

**Empfohlen: Vercel**, weil es Next.js (App Router) ohne weitere Konfiguration
unterstützt und kostenlos für dieses Projektvolumen reicht.

1. **Datenbank anlegen** — empfohlen: [Neon](https://neon.tech) (verwaltetes
   Postgres, großzügiger Free-Tier, eingebautes Connection-Pooling — wichtig
   für Vercels serverlose Funktionen). Alternativ Supabase, Railway, o. ä.
   Connection-String kopieren (`postgresql://...`).
2. **Projekt auf [vercel.com](https://vercel.com) importieren** — GitHub-Repo
   verbinden, Framework-Preset "Next.js" wird automatisch erkannt.
3. **Umgebungsvariablen in den Vercel-Projekteinstellungen setzen**
   (Settings → Environment Variables), nicht in eine Datei committen:
   - `DATABASE_URL` — der Neon-Connection-String
   - `AUTH_SECRET` — z. B. via `npx auth secret` erzeugt
   - `NEXTAUTH_URL` — die endgültige Vercel-Domain, z. B.
     `https://routinequest.vercel.app`
   - optional `SMTP_HOST` / `SMTP_PORT` / `SMTP_SECURE` / `SMTP_USER` /
     `SMTP_PASS` / `SMTP_FROM`, falls E-Mails (Passwort-Reset, Einladungen)
     wirklich verschickt statt nur in die Server-Logs geschrieben werden sollen
4. **Migrationen auf die Produktions-DB anwenden** (einmalig und bei jedem
   Schema-Update): `DATABASE_URL="<neon-connection-string>" npx prisma migrate deploy`
5. Deploy auslösen (Push auf `main` — Vercel deployt automatisch).
6. **`electron/main.js`** die endgültige `APP_URL`-Konstante auf die
   tatsächliche Vercel-Domain setzen, falls abweichend vom Platzhalter.

## Produktion: Windows-Installer bauen

```powershell
npm run dist:win
```

Erzeugt `dist/RoutineQuest Setup <version>.exe` — einen NSIS-Installer mit
wählbarem Installationsverzeichnis, Desktop- und Startmenü-Verknüpfung.
Da der Client jetzt nur die gehostete Seite lädt, ist der Installer sehr
klein (kein gebündelter Next.js-Server, kein Prisma).

Das App-Icon (`build/icon.ico`, `electron/icon.ico`) ist bereits erzeugt und
eingecheckt. Bei Bedarf neu generieren (z. B. nach Änderung der Marke):

```powershell
npm run icon
```

### Icon/Branding

`build/generate-icon.js` rendert das App-Icon programmatisch (blaues,
abgerundetes Quadrat mit weißem Sparkle — passend zum In-App-Logo) über
`sharp` + `png-to-ico`. Für ein eigenes Logo einfach die SVG-Definition in
diesem Skript ersetzen und `npm run icon` erneut ausführen.

### Code-Signing (optional, aber empfohlen)

Ohne Code-Signatur zeigt Windows SmartScreen beim ersten Start eine
"Unbekannter Herausgeber"-Warnung. Für eine echte Veröffentlichung ein
Authenticode-Zertifikat besorgen und in `package.json` unter `build.win`
`certificateFile`/`certificatePassword` (lokal) bzw. die entsprechenden
`CSC_LINK`/`CSC_KEY_PASSWORD`-Secrets (GitHub Actions) ergänzen. Für interne
Tests/kleine Nutzergruppen ist das nicht zwingend nötig.

## Automatische Releases (GitHub Actions)

`.github/workflows/release.yml` baut bei jedem gepushten Tag `v*` den
Windows-Installer und veröffentlicht ihn automatisch als GitHub Release
(inkl. `latest.yml`, das `electron-updater` für Auto-Updates braucht).

**Einmalig vor dem ersten Release nötig:**

In `package.json` unter `"build"."publish"` die Platzhalter durch den
echten GitHub-Owner/Repo-Namen ersetzen:

```json
"publish": {
  "provider": "github",
  "owner": "DEIN_GITHUB_NAME",
  "repo": "RoutineQuest"
}
```

**Release veröffentlichen:**

```powershell
git tag v1.0.0
git push origin v1.0.0
```

GitHub Actions baut daraufhin automatisch `dist/RoutineQuest Setup 1.0.0.exe`
und hängt es an ein neues GitHub Release unter dem Tag `v1.0.0` an. Kein
zusätzliches Secret nötig — der Workflow nutzt das von GitHub automatisch
bereitgestellte `GITHUB_TOKEN`.

`.github/workflows/ci.yml` läuft zusätzlich bei jedem Push/PR auf `main` und
prüft Lint, TypeScript und den Next.js-Produktionsbuild — unabhängig vom
Windows-Installer-Release.

## Automatische Updates (electron-updater)

Sobald `build.publish` (siehe oben) korrekt konfiguriert ist und mindestens
ein Release veröffentlicht wurde, prüft die installierte Desktop-App beim
Start automatisch (`autoUpdater.checkForUpdatesAndNotify()` in
`electron/main.js`), ob eine neuere Version als GitHub Release existiert, lädt
sie im Hintergrund herunter und installiert sie beim nächsten Neustart. Dafür
reicht es, einen neuen Tag zu pushen (siehe oben) — kein manueller Schritt in
der App nötig.

## Wichtige Skripte

| Skript | Zweck |
|---|---|
| `npm run dev` | Web-App-Entwicklungsserver (Turbopack) |
| `npm run dev:webpack` | wie oben, aber mit Webpack (Turbopack-Workaround) |
| `npm run build` / `npm start` | Web-App Produktions-Build / -Start |
| `npm run lint` | ESLint |
| `npm run electron:dev` | Desktop-Hülle gegen `localhost:3000` (mit `npm run dev` parallel) |
| `npm run electron` | Desktop-Hülle gegen die gehostete Produktions-URL |
| `npm run icon` | App-Icon aus `build/generate-icon.js` neu erzeugen |
| `npm run dist:win` | Windows-Installer lokal bauen (`dist/*.exe`) |
| `npm run release:win` | wie oben, zusätzlich Veröffentlichung als GitHub Release (nutzt CI) |
| `npx prisma studio` | Datenbank-Browser |
| `npx prisma migrate dev --name <name>` | neue Migration lokal erstellen + anwenden |
| `npx prisma migrate deploy` | vorhandene Migrationen anwenden (lokal oder Produktion) |

## E-Mail (Passwort-Reset, Gruppeneinladungen per E-Mail)

Ohne SMTP-Konfiguration werden E-Mails nur in die Server-Konsole geloggt
(inkl. Reset-/Einladungslink) — praktisch zum Testen ohne echten
Mail-Versand. Für echten Versand `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`,
`SMTP_USER`, `SMTP_PASS`, `SMTP_FROM` setzen (lokal in `.env`, produktiv in
den Vercel-Umgebungsvariablen).

## Projektstruktur (Kurzüberblick)

```
src/app/            Next.js App Router: Seiten + API-Routen
src/components/      React-Komponenten (nach Feature sortiert)
src/lib/             Serverseitige Logik: Auth, XP/Streak-Engine, Gruppen-
                     routinen-Services, Validierung, Prisma-Client
prisma/              Datenbankschema + Migrationen
electron/            Schlanker Desktop-Client (eigenes package.json,
                     eigenes node_modules — bewusst getrennt vom Web-App-Baum,
                     damit der Installer klein bleibt)
build/               Icon-Quelle + Generator-Skript (electron-builder liest
                     build/icon.ico für die .exe)
.github/workflows/   CI (Lint/Typecheck/Build) + Release (Windows-Installer)
```

## Troubleshooting

- **"Turbopack is not supported on this platform"** beim `npm run dev`:
  siehe oben, `npm run dev:webpack` verwenden.
- **Windows warnt "Unbekannter Herausgeber"** beim Installer-Start: normal
  für unsignierte Installer, siehe Abschnitt Code-Signing oben.
- **Desktop-App zeigt "nicht erreichbar"**: Internetverbindung prüfen und ob
  die in `electron/main.js` hinterlegte `APP_URL` tatsächlich erreichbar ist
  (z. B. im Browser öffnen).
- **Lokale Migrationen laufen nicht durch**: prüfen, ob der lokale
  PostgreSQL-Dienst läuft (`Get-Service postgresql*`) und `DATABASE_URL` in
  `.env` korrekt ist.
