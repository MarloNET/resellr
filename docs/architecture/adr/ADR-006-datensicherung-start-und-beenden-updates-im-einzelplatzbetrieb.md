# ADR-006 – Datensicherung, Start und Beenden, Updates im Einzelplatzbetrieb

- **Status:** approved (Owner-Freigabe 2026-11-07 mit Architecture Baseline v0.3.2, Revision `2876806d-48b2-4ec3-b961-2f4d370d9b2e`, [MAR-142](/MAR/issues/MAR-142#document-owner-freigabeanfrage)). **In v0.2 inhaltlich neu gefasst** nach Owner-Entscheidung E-7 (OD-03 b) vom 06.11.2026. Die Fassung v0.1 (Revision `ae51c8cc`) schlug eine eingebaute tägliche Sicherung auf ein konfiguriertes Ziel mit 30 Tagen Aufbewahrung und Wiederherstellungs-Prüfbefehl vor; diese Option ist unten als (A) erhalten und nicht mehr gewählt. **In v0.3 ergänzt** um den Hosting-Mechanismus unter Windows (Optionen Hosting), den Fehlerpfad des Beendens und die Startprüfung (FIND-104 bis FIND-107). **In v0.3.1 ergänzt** um die Trennung von Owner-Wortlaut und Ableitung bei E-7 und um OP-32/A-37 (Requirements v0.3.3); die Entscheidung selbst ist unverändert. **In v0.3.2 ergänzt** um den Lebenszyklus der Überwachung (FIND-110); die Entscheidung (H2) ist unverändert. Da ADR-006 nie freigegeben war, wird nichts Freigegebenes ersetzt.
- **Kontext:**
  - Daten liegen nach ADR-002 nur auf dem PC. Zielplattform Windows 11 (OD-04).
  - **E-7** (Fragekarte `15ba6e78-50f2-45ae-bf5f-94ec9af39256`, 06.11.2026 18:58 UTC, „(b) Nur Hinweis, ich sichere selbst“): Release 0.1 bekommt **keine eigene Sicherungsfunktion**, sondern einen dauerhaft klaren Hinweis; der Owner sichert selbst, freiwillig, nach OneDrive; eine Kopie ist nur bei beendetem resellr sicher brauchbar (Owner-Wortlaut nach Requirements RB-21).
  - Requirements: REQ-066 v0.3 verlangte eine Sicherung durch das System. v0.3.2 (in v0.3.3 inhaltlich unverändert) zieht sie zurück und fordert stattdessen den dauerhaften Hinweis (REQ-104), das geordnete Beenden aus dem Hinweis heraus mit Fehlerpfad nach REQ-073 (REQ-105) und einen Datenordner mit allen Daten (REQ-106). REQ-105 und REQ-106 sind **aus E-7 abgeleitet**, nicht Owner-Wortlaut; die Ableitung stammt aus dem Kommentar `bb98a214` des Software Architect nach der Owner-Antwort. Sie stehen zur ausdrücklichen Owner-Bestätigung mit der Freigabe von v0.3.3 (OP-17).
  - v0.3.3 nimmt die Kopie vor Updates als offenen Punkt OP-32 auf, mit Startannahme A-37: keine Sicherung im Sinne von Requirements Kap. 14.
  - resellr startet mit der Anmeldung und läuft fast immer; eine Kopie einer laufenden SQLite-Datenbank im WAL-Modus ist nicht sicher brauchbar.
  - Den Betrieb übernimmt der Owner ohne Betriebsteam und ohne Adminrechte bei der Installation. Ausgehende Verbindungen gibt es nicht (REQ-079).
  - Die Windows-Aufgabenplanung als Hosting-Mechanismus (v0.2) ist für Neustart nach Absturz, unsichtbaren Start und Anmelde-Trigger ohne Adminrechte nicht belegt (FIND-106).
- **Betroffene Anforderungen:** REQ-065, REQ-072, REQ-073, REQ-079, REQ-104, REQ-105, REQ-106 (v0.3.2, unverändert in v0.3.3); A-37 (OP-32, v0.3.3); REQ-066 bis v0.3.1, mit v0.3.2 *Withdrawn* (KF-01, Kap. 13.4).
- **Optionen Sicherung:**
  - (A) in die Anwendung eingebaute automatische Sicherung auf ein vom Owner gewähltes Verzeichnis (Fassung v0.1; etwa 1 bis 2 Entwicklertage).
  - (B) keine Sicherungsfunktion; resellr macht die **Handsicherung** einfach und sicher: ein Datenordner, geordnetes Beenden, Betriebsstatus mit Speicherort, Datenordner im Explorer öffnen, dauerhafter Hinweis, Anleitung, Startprüfung.
  - (C) Datenordner direkt in OneDrive legen oder vom Windows-Dateiversionsverlauf erfassen lassen.
  - (D) externer Backup-Dienst.

  (C) erzeugt keine verlässlich konsistenten Kopien einer laufend beschriebenen Datenbank, eine Synchronisierung kann sie sogar beschädigen. (D) ist ein zusätzlicher Dienst mit Kosten und ausgehenden Verbindungen. (A) ist technisch die robustere Lösung, vom Owner aber für Phase 1 nicht gewünscht.
- **Optionen Hosting unter Windows (seit v0.3):**
  - (H1) Windows-Aufgabenplanung für Autostart, Neustart nach Absturz und Verfügbarkeitsprüfung (Fassung v0.2).
  - (H2) Autostart-Eintrag des Benutzers, Überwachung als Teil von `resellr-launcher`, die `resellr-server` als Kindprozess ohne Fenster startet und nur nach Absturz neu startet.
  - (H3) Windows-Dienst.

  (H1) ist nicht belegt und hat bekannte Fallstricke (Kap. 10.2). (H3) braucht Adminrechte bei der Installation und läuft außerhalb der Benutzersitzung, sodass der Server den Explorer nicht im Benutzerkontext öffnen kann. (H2) kommt ohne Adminrechte aus, ist in der CI testbar und unterscheidet Absturz, geordnetes Beenden und Abmelden selbst.
- **Optionen Updates:**
  - (A) manuelle Installation eines Release-Pakets, automatische lokale Kopie von Datenbank und Konfiguration vor den Migrationen.
  - (B) automatische Updates.

  (B) braucht ausgehende Verbindungen, Signierung und Update-Infrastruktur.
- **Entscheidung:** Sicherung **(B)** (Kern vom Owner entschieden, E-7: keine Sicherungsfunktion, Hinweis, Handsicherung; Datenordner und Aktion „resellr beenden“ in resellr aus E-7 abgeleitet, REQ-105 und REQ-106, Owner-Bestätigung nach OP-17), Hosting **(H2)** (Vorschlag, im Windows-Spike zu belegen), Updates **(A)** (Vorschlag), wie in Kap. 9.6, 10.2, 10.4 und 10.6 beschrieben. Dazu:
  - ein Datenordner außerhalb von OneDrive-synchronisierten Ordnern (REQ-106),
  - `resellr-launcher` zum Starten, Überwachen und Beenden, mit `launcher-pages` für Rückmeldungen ohne Server; genau eine Überwachung je Windows-Sitzung, Ende nach der Neustartgrenze mit „Neustart aufgegeben“, Server an die Lebensdauer der Überwachung gekoppelt (Kap. 9.6, v0.3.2),
  - geordnetes Beenden mit Checkpoint und Ende-Markierung; Bestätigung erst nach Erfolg, sonst Meldung und Weiterlaufen; danach kein automatischer Neustart (REQ-105),
  - Startprüfung des Datenordners mit Erkennung eines ersetzten Datenordners, damit eine unbrauchbare oder unvollständige Kopie nicht unbemerkt weiterverwendet wird; Schutzgrenze beim Löschen verwaister Dateien.
- **Konsequenzen:**
  - Mit v0.3.2 erfüllt die Baseline REQ-104 bis REQ-106. Bis zur Owner-Freigabe von v0.3.3 besteht der Konflikt mit REQ-066 v0.3 formal weiter (KF-01, Kap. 13.4). Folgen eines Widerspruchs zu REQ-105 oder REQ-106: Kap. 13.4.
  - Datenverlust und Wiederherstellungszeit hängen von der Sicherungsgewohnheit des Owners ab (AR-01, AR-02); resellr kann nicht erkennen, ob gesichert wurde. Eine bei laufendem resellr angelegte, strukturell intakte Kopie mit älterem Stand erkennt die Startprüfung nur als Verdacht (AR-14).
  - Das UI/UX-Design braucht den dauerhaften Hinweis, die Aktion „resellr beenden“ mit Endzustand und Fehlerzustand sowie Texte für `launcher-pages` (Kap. 6.3).
  - Der Hosting-Mechanismus (H2) wird vor Abschluss der Technical Specification belegt; die Rückfallwege ändern die Architektur nicht (AR-15). Ist Smart App Control aktiv, wird die Code-Signierung Pflicht (OD-09).
  - Updates sind eine Aufgabe des Owners (AR-11); die Kopie vor Updates macht ein Zurück möglich, ersetzt aber keine Sicherung. Sie ist ein Schritt des Update-Vorgangs und keine Sicherung im Sinne von Requirements Kap. 14 (A-37). Entscheiden Product Owner und Software Architect OP-32 anders, entfällt sie oder wird als eigene Anforderung gefasst; ADR-006 wird dann angepasst (Stellungnahme und Folgen in Kap. 13.3).
  - Option (A) Sicherung bleibt ohne Umbau nachrüstbar (Kap. 5.3).
- **Risiken:** AR-01, AR-02, AR-11, AR-13, AR-14, AR-15.
- **Referenzen:** E-7 (Fragekarte `15ba6e78`, 06.11.2026) und Owner-Antworten vom 06.11.2026 an MAR-125 („von mir aus gern One-Drive, aber ich hätte das nicht in Phase 1 eingebaut und es sollte optional bleiben …“, „gern immer klaren Hinweis …“); Requirements-Kandidat v0.3.2 Rev. `e4b94794` (REQ-066 *Withdrawn*, REQ-104 bis REQ-106, A-36, OP-31); Requirements-Kandidat v0.3.3 Rev. `ce76d962` (Kennzeichnung REQ-105 und REQ-106, REQ-065, AC-REQ-106-01, OP-32, A-37); Kommentare `317f1409` (Owner) und `bb98a214` (Software Architect) an MAR-125; Architecture Review Runde 1 (FIND-101, FIND-104 bis FIND-107, FIND-109); Freigabe pending.

---
Veröffentlicht aus der Architecture Baseline v0.3.2 (Kapitel 15), `docs/architecture/architecture-baseline.md`.
