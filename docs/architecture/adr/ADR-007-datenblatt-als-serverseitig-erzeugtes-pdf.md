# ADR-007 – Datenblatt als serverseitig erzeugtes PDF

- **Status:** approved (Owner-Freigabe 2026-11-07 mit Architecture Baseline v0.3.2, Revision `2876806d-48b2-4ec3-b961-2f4d370d9b2e`, [MAR-142](/MAR/issues/MAR-142#document-owner-freigabeanfrage))
- **Kontext:** REQ-050 verlangt das Datenblatt als Druck oder als PDF-Datei in A4. Bei der Startbelegung muss es auf eine Seite passen (REQ-081, bis 40 Merkmale), und das in höchstens 5 s (REQ-061). Das Layout ist Einstellung (REQ-051).
- **Betroffene Anforderungen:** REQ-050, REQ-051, REQ-061, REQ-078, REQ-081.
- **Optionen:**
  - (A) Druckansicht im Browser mit CSS für den Druck.
  - (B) PDF über einen Headless-Browser (Puppeteer oder Playwright).
  - (C) PDF-Bibliothek im Server (`pdfmake`).
  - (D) Vorlage in Excel oder LibreOffice.

  (A) ist browserabhängig: Seitenumbrüche, Kopf- und Fußzeilen des Browsers, keine automatische Prüfung der Seitenzahl. (B) braucht einen zusätzlichen Browser-Prozess mit großem Speicherbedarf. (D) braucht eine zusätzliche Office-Installation.
- **Entscheidung (Vorschlag):** **(C)**, mit eingebetteter, frei lizenzierter Schrift und dem Logo aus dem `media-store`. Drucken und Speichern laufen über den PDF-Viewer des Browsers.
- **Konsequenzen:**
  - Das Layout wird in Code aus der Layout-Einstellung gebaut, nicht als HTML.
  - Die Seitenzahl wird automatisch getestet (Kap. 11.2).
  - Eine pixelgenaue Nachbildung der Excel ist nicht vorgesehen (A-10).
- **Risiken:** Ist REQ-081 mit langen Werten knapp, braucht es eine Verdichtungsregel, z. B. eine kleinere Schrift ab einer Zeilenzahl. Sie wird in der Technical Specification festgelegt.
- **Referenzen:** Review und Freigabe pending.

---
Veröffentlicht aus der Architecture Baseline v0.3.2 (Kapitel 15), `docs/architecture/architecture-baseline.md`.
