# resellr

Projekt-Repository von MarloNET. Dokumente liegen unter `docs/`, das Backlog als GitHub Issues.

## Entwicklung

Voraussetzung ist Node.js in der Version aus `.nvmrc` (Node.js 26 LTS, Technical Specification Kap. 4.3).

```sh
npm ci              # Abhängigkeiten exakt nach package-lock.json
npm run lint        # Codeformat und Importgrenzen (eslint.config.mjs)
npm run typecheck   # TypeScript strict, alle Workspaces
npm test            # Unit- und Integrationstests (Vitest)
npm run build       # u. a. Oberfläche bauen (apps/web/dist)
npm run e2e         # E2E-Tests (Playwright in Google Chrome, Fenstergrößen FM-1 bis FM-7)
npm run demo        # Demo-Start mit frischem temporären Datenordner
node tools/qa/check-ac-coverage.mjs   # AC-Abdeckung der abgeschlossenen Bauschritte
```

**Demo-Start (Baseline 11.3):** `npm ci && npm run demo` baut die Anwendung, legt einen neuen
temporären Ordner mit Daten-, Protokoll-, Übergabe- und Update-Kopie-Ordner an, startet den Server
auf `127.0.0.1` mit dem Port aus `PORT` (Standard 4310), spielt die Beispieldaten über die API ein
(`packages/test-data/src/demo-seed.ts`; in Bauschritt S1 noch keine) und gibt erst dann die Adresse
aus. Strg+C beendet den Server und löscht den temporären Ordner. Scheitert der Start, bleibt der
Ordner mit den Protokollen erhalten; sein Pfad steht in der Ausgabe.

**E2E-Tests:** `npm run e2e` braucht Google Chrome (Playwright-Kanal `chrome`). Zuerst läuft das
Projekt `demo-start` (`npm run demo`, baut auch die Oberfläche), danach je Zeile der
Fenstergrößen-Matrix FM-1 bis FM-7 ein Projekt (Technical Specification Kap. 6.3). Jeder Test-Worker
startet einen eigenen Server mit eigenem Datenordner auf einem freien Port. Jeder Test prüft, dass
der Browser nur `127.0.0.1` und `file://` anfragt (REQ-079).

**AC-Abdeckung:** `tools/qa/ac-steps.json` ordnet die AC-REQ-IDs den Bauschritten zu und nennt die
abgeschlossenen Schritte. Für jede AC eines abgeschlossenen Schritts muss ein Testtitel mit der ID
beginnen (`it('AC-REQ-001-07 …')`, Technical Specification Kap. 6.2); sonst bricht die CI ab.

Den Server startet `node apps/server/src/main.ts` (optional `--test-clock`). Die Ordner kommen aus
`RESELLR_DATA_DIR`, `RESELLR_LOG_DIR`, `RESELLR_HANDOVER_DIR` und `RESELLR_UPDATE_COPY_DIR` bzw.
`%LOCALAPPDATA%\resellr` (Technical Specification Kap. 2.19). Der Startablauf legt beim ersten Start
`config.json` mit `port` 4310 im Datenordner an, migriert die Datenbank `resellr.db` und lauscht
dann nur auf `http://127.0.0.1:<port>`. `GET /api/ops/health` meldet den Betriebszustand,
`GET /api/ops/status` den Datenordner und die Version. Ist der Port belegt, endet der Server mit
Exit-Code 10 und einem Eintrag mit Referenznummer im Fehlerprotokoll.

Die Oberfläche (`apps/web`, React und Vite, ADR-001) startet zur Entwicklung mit `npm run dev -w @resellr/web` auf `127.0.0.1`; Anfragen an `/api` gehen an den Server auf `127.0.0.1:${PORT:-4310}`.

Die Struktur des Repositorys und die Importgrenzen beschreibt die Technical Specification in Kap. 4.1.
