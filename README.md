# resellr

Projekt-Repository von MarloNET. Dokumente liegen unter `docs/`, das Backlog als GitHub Issues.

## Entwicklung

Voraussetzung ist Node.js in der Version aus `.nvmrc` (Node.js 26 LTS, Technical Specification Kap. 4.3).

```sh
npm ci              # Abhängigkeiten exakt nach package-lock.json
npm run lint        # Codeformat und Importgrenzen (eslint.config.mjs)
npm run typecheck   # TypeScript strict, alle Workspaces
npm test            # Unit- und Integrationstests (Vitest)
```

Die Struktur des Repositorys und die Importgrenzen beschreibt die Technical Specification in Kap. 4.1.
