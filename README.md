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
```

Den Server startet `node apps/server/src/main.ts` (optional `--test-clock`). Er lauscht nur auf
`http://127.0.0.1:4310`; die Ordner kommen aus `RESELLR_DATA_DIR`, `RESELLR_LOG_DIR`,
`RESELLR_HANDOVER_DIR` und `RESELLR_UPDATE_COPY_DIR` bzw. `%LOCALAPPDATA%\resellr` (Technical
Specification Kap. 2.19). Port aus `config.json`, Startablauf und `npm run demo` folgen mit #112.

Die Oberfläche (`apps/web`, React und Vite, ADR-001) startet zur Entwicklung mit `npm run dev -w @resellr/web` auf `127.0.0.1`; Anfragen an `/api` gehen an den Server auf `127.0.0.1:${PORT:-4310}`.

Die Struktur des Repositorys und die Importgrenzen beschreibt die Technical Specification in Kap. 4.1.
