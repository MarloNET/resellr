# ADR-004 – Persistenz: SQLite, Dateiablage und Merkmalswerte als JSON-Dokumente

- **Status:** approved (Owner-Freigabe 2026-11-07 mit Architecture Baseline v0.3.2, Revision `2876806d-48b2-4ec3-b961-2f4d370d9b2e`, [MAR-142](/MAR/issues/MAR-142#document-owner-freigabeanfrage))
- **Kontext:**
  - Ein Nutzer, Volumen nach A-12, Betrieb auf einem PC ohne Betriebsteam.
  - Gerätearten und Merkmale sind Einstellung. Eine neue Geräteart darf die Datenbankstruktur nicht ändern (REQ-076).
  - Fotos müssen gespeichert werden (A-06) und zusammen mit der Datenbank in einem Datenordner liegen (REQ-106, E-7, ADR-006).
- **Betroffene Anforderungen:** REQ-004, REQ-005, REQ-042, REQ-064, REQ-072, REQ-076, REQ-106 (bis v0.3.1 REQ-066).
- **Optionen Datenbank:**
  - (A) SQLite eingebettet.
  - (B) PostgreSQL als lokaler Dienst.
  - (C) Dateien je Datensatz (JSON).

  (B) bedeutet einen zusätzlichen Dienst mit Installation, Updates und eigener Sicherung. (C) bietet keine Transaktionen und keine Indizes.
- **Optionen Merkmalswerte:**
  - (A) JSON-Dokument je Datensatz mit Merkmals-ID als Schlüssel.
  - (B) EAV-Tabelle (eine Zeile je Wert).
  - (C) Spalten je Merkmal.

  (C) verletzt REQ-076. (B) ist möglich, macht aber Lesen und Validieren aufwendiger. Die Kanal-Engine braucht stets alle Werte eines Datensatzes.
- **Optionen Fotos:**
  - (A) Dateisystem mit Inhalts-Hash als Name.
  - (B) Blobs in der Datenbank.

  (B) bläht die Datenbank auf und macht jede Kopie der Datenbank (Handsicherung, Kopie vor Updates) groß und langsam.
- **Entscheidung (Vorschlag):** SQLite im WAL-Modus, Merkmalswerte als JSON-Dokumente mit Validierung in der Fachschicht gegen die Merkmalsdefinitionen, Fotos im Dateisystem unter ihrem Inhalts-Hash.
- **Konsequenzen:**
  - Die Datenintegrität der Merkmalswerte prüft die Anwendung, nicht die Datenbank. Prüfungen wie „gibt es Werte zu diesem Merkmal“ (REQ-005) laufen über JSON-Funktionen von SQLite. Bei A-12 ist das schnell genug.
  - Fotodateien sind unveränderlich und können von mehreren Ständen gleichzeitig genutzt werden (Kap. 9.4).
  - Abfragen laufen über Kysely. Ein späterer Wechsel zu PostgreSQL bleibt möglich.
- **Risiken:** AR-09.
- **Referenzen:** Review und Freigabe pending.

---
Veröffentlicht aus der Architecture Baseline v0.3.2 (Kapitel 15), `docs/architecture/architecture-baseline.md`.
