# ADR-001 – Anwendungsart: lokale Webanwendung (Browser-Oberfläche und lokaler Server)

- **Status:** approved (Owner-Freigabe 2026-11-07 mit Architecture Baseline v0.3.2, Revision `2876806d-48b2-4ec3-b961-2f4d370d9b2e`, [MAR-142](/MAR/issues/MAR-142#document-owner-freigabeanfrage))
- **Kontext:** E-1 legt eine eigene Oberfläche fest. Offen ist Web oder Desktop (OP-15, A-33). Der Nutzer arbeitet allein an einem PC (E-4, E-6). Er kopiert Felder in die Formulare anderer Programme (REQ-047), stellt Fotos als Dateien bereit (REQ-048) und druckt Datenblätter (REQ-050). Ein Betriebsteam gibt es nicht. Zielplattform ist nach Owner-Angabe Windows 11 mit Google Chrome (OD-04, 06.11.2026; vor v0.2 war das Betriebssystem unbekannt, OP-24).
- **Betroffene Anforderungen:** REQ-047, REQ-048, REQ-050, REQ-060, REQ-077, REQ-079, REQ-001 (über ADR-002); LP-2, F-5.
- **Optionen:**

| Kriterium | (A) Webanwendung, Oberfläche im Browser, lokaler Server-Prozess | (B) Desktop mit Webtechnik (Electron, Tauri) | (C) nativ (.NET WPF/WinUI, Qt) |
| --- | --- | --- | --- |
| Zwischenablage (REQ-047) | Clipboard API; `127.0.0.1` ist sicherer Kontext | nativ | nativ |
| Dateien (REQ-048) | über den lokalen Server, der Dateien schreibt und den Ordner öffnet; ZIP | nativ | nativ |
| Druck und PDF (REQ-050) | Server-PDF, PDF-Viewer des Browsers | eigene Umsetzung oder wie (A) | eigene Umsetzung |
| Plattform (OP-24; seit v0.2 entschieden: Windows 11) | plattformneutral | plattformneutral, aber Builds je Betriebssystem | an ein Betriebssystem gebunden (WPF) bzw. aufwendig |
| Paketierung, Signierung, Updater | Installer mit Laufzeit, keine Code-Signierung des UI-Teils | je Betriebssystem, Code-Signierung gegen SmartScreen/Gatekeeper, eigener Updater | je Betriebssystem |
| Aufwand Release 0.1 | gering | mittel | mittel bis hoch |
| Testbarkeit | Playwright im Standard-Browser | Playwright mit Electron-Unterstützung | eigene UI-Tests |
| Offen für später (Hosting, Produkt) | derselbe Code ist auf einem Server betreibbar | Umbau nötig | Neuentwicklung |

- **Entscheidung (Vorschlag):** **(A)**. Sie erfüllt alle Anforderungen mit dem geringsten Aufwand und ist plattformneutral. Sie hält den Weg zu einem gehosteten Produkt offen (F-5), ohne ihn jetzt zu bauen.
- **Konsequenzen:**
  - Das UI/UX-Design entwirft für ein Browserfenster (Kap. 6); das Design `92e018e` folgt dem bereits.
  - Unterstützt und getestet wird nur Google Chrome in aktueller Version unter Windows 11 (OD-04, ab v0.2).
  - Nötig ist ein Hintergrundprozess `resellr-server` unter der Überwachung von `resellr-launcher` mit Autostart bei der Anmeldung (ADR-006, H2; Kap. 10.2), dazu `resellr-launcher` zum Starten und Beenden (ab v0.2). Ein Windows-Dienst ist das ausdrücklich nicht (ADR-006, H3 verworfen; v0.3.2, FIND-111).
  - Fotos per Drag & Drop direkt in fremde Websites sind kein verlässlicher Weg, die Übergabe erfolgt über einen Ordner.
  - Falls Browser-Einschränkungen später stören (AR-05), lässt sich dieselbe Anwendung ohne Neuentwicklung in eine Electron-Hülle setzen.
  - Mit OD-04 entfällt der Vorteil „plattformneutral“ für Release 0.1 als Entscheidungsgrund. Die Entscheidung bleibt richtig, weil der Mehraufwand von (B) und (C) für Paketierung, Signierung und Updater bleibt und (A) den Weg zum gehosteten Produkt offen hält.
- **Risiken:** AR-05, AR-13.
- **Referenzen:** Requirements Rev. `170ca77f` (OP-15, A-33); frühe Empfehlung als Kommentar an MAR-125 vom 06.11.2026; Owner-Antwort zu OD-04 vom 06.11.2026; Architecture Review Runde 1 (FIND-109, Kontext in v0.3 nachgeführt); Freigabe pending.

---
Veröffentlicht aus der Architecture Baseline v0.3.2 (Kapitel 15), `docs/architecture/architecture-baseline.md`.
