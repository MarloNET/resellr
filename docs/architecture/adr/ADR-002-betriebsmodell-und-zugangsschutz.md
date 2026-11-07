# ADR-002 – Betriebsmodell und Zugangsschutz: Betrieb nur am Arbeitsplatzrechner

- **Status:** approved (Owner-Freigabe 2026-11-07 mit Architecture Baseline v0.3.2, Revision `2876806d-48b2-4ec3-b961-2f4d370d9b2e`, [MAR-142](/MAR/issues/MAR-142#document-owner-freigabeanfrage))
- **Kontext:** E-5 verlangt ein Zugangspasswort nur im Netzbetrieb, A-35 lässt Betrieb nur auf dem PC zu. Offen sind Betreiber und Ort der Daten (OP-23). FIND-026 verlangt eine prüfbare Abgrenzung zwischen lokalem Betrieb und Netzbetrieb. Das UI/UX-Design hält UI-001 und UI-040 für den Netzbetrieb vor (C-1, Owner: „Requirements gelten, Screens bleiben“).
- **Betroffene Anforderungen:** REQ-001, REQ-065, REQ-067, REQ-069, REQ-079, REQ-097, REQ-104 und REQ-105 (über A-36, OP-31), REQ-106 (AC-REQ-106-01 im Netzbetrieb mit Beenden durch den Betreiber, v0.3.3); E-4, E-5, E-6. REQ-066 bis v0.3.1, mit v0.3.2 *Withdrawn*.
- **Optionen:**
  - (A) Betrieb nur am Arbeitsplatzrechner: Server an `127.0.0.1`, Daten im Benutzerprofil, Betreiber ist der Owner. Entspricht OD-02 Variante A.
  - (B) Server im lokalen Netz, z. B. auf einem NAS: Netzbetrieb.
  - (C) Cloud-Hosting auf einer VM oder PaaS in der EU: Netzbetrieb.
  - (D) wie (A), aber mit Fernzugriff über VPN: ebenfalls Netzbetrieb.
  - (E) wie (A), aber `resellr-server` zusätzlich im lokalen Netz erreichbar, mit Zugangspasswort und HTTPS (ab v0.2 ergänzt). Entspricht OD-02 Variante B.

  Bei (B) bis (E) werden REQ-001, REQ-067 und REQ-097 wirksam. Nötig sind dann Zugangspasswort, Passwort-Hash, Sitzung, HTTPS, Schutz vor Brute Force, bei (B) bis (D) zusätzlich Server-Betrieb mit Patches und Zertifikaten, bei (C) mit laufenden Kosten. (E) ist unter den Netzbetriebs-Varianten die günstigste, weil Daten und Betrieb auf dem PC bleiben (Kap. 13.3.1).
- **Entscheidung (Vorschlag):** **(A)**. Der Nutzer arbeitet nur an diesem PC (E-6). Ein Server oder Netzzugang brächte deshalb keine höhere Verfügbarkeit für den Nutzer, aber mehr Angriffsfläche, mehr Betriebsaufwand und, bei (B) bis (D), mehr Kosten. Wählt der Owner Netzbetrieb, empfiehlt der Architekt (E).
- **Umsetzung:**
  - Bindung ausschließlich an `127.0.0.1`. Die Adresse steht fest im Programm und ist kein Konfigurationswert; der Server liest sie aus keiner Einstellung (Kap. 8.1, 10.2; v0.3.2, FIND-111).
  - `local-guard` gegen fremde Websites (Kap. 8.1).
  - Keine Anmeldung (AC-REQ-001-05).
- **Konsequenzen:**
  - REQ-097 ist nach eigenem Wortlaut nicht vorhanden, von REQ-067 gilt nur die Nicht-Erreichbarkeit (AC-REQ-001-07); die Netzbetriebs-Regeln aus FIND-026 (b) und (c) greifen nicht.
  - UI-001, UI-040 und FLOW-07 werden in Release 0.1 nicht umgesetzt, bleiben im Design aber erhalten.
  - Die Daten liegen nur auf dem PC. Nach E-7 schützt nur die Handsicherung des Owners gegen Verlust (ADR-006, AR-01).
  - Die Aktion „resellr beenden“ steht am Hinweis (REQ-105); OP-31 hat bei (A) keine Wirkung.
  - Die Verfügbarkeitsmessung braucht eine Definition für den lokalen Betrieb (OD-05).
- **Netzbetrieb (Option E), falls der Owner ihn wählt oder später wünscht (nicht gebaut):**
  - Zugangspasswort mit Argon2id-Hash in `resellr-db`, gesetzt und zurückgesetzt vom Betreiber per Befehl, der die Mindestlänge nach REQ-067 auch für das erste Passwort prüft (REQ-001, v0.3.1),
  - Sitzungs-Cookie ohne Ablaufzeit (`HttpOnly`, `Secure`, `SameSite=Strict`), gültig bis zum Beenden von Chrome (REQ-001 v0.3.1); serverseitige Sitzungsliste mit Passwort-Generation, damit eine Passwortänderung alle anderen Zugänge beendet (REQ-097 v0.3.1); Begrenzung der Fehlversuche,
  - HTTPS direkt in `resellr-server` mit eigenem Zertifikat, das auf jedem weiteren Gerät einmal als vertrauenswürdig eingetragen wird; HTTPS ist auch wegen der Clipboard API nötig (Kap. 13.3.1),
  - Bindung an das lokale Netz, Windows-Firewall-Regel (einmal Adminrechte), Erweiterung der Host-Allowlist in `local-guard`.
  - Hinweis „Sicherung einrichten“ ohne Aktion nach A-36; Beenden nur über Loopback am PC (Kap. 13.3.1, OP-31). Dieses Beenden durch den Betreiber ist auch der Prüfschritt von AC-REQ-106-01 im Netzbetrieb und der Beginn der Zeiten, die REQ-065 herausrechnet (v0.3.3).

  Vor der Baseline-Freigabe gehört das über OD-02 zur Entscheidung des Owners, danach wäre es eine Architekturänderung mit Review und Owner-Freigabe.
- **Risiken:** AR-01, AR-02, AR-07.
- **Referenzen:** Requirements Rev. `170ca77f` (OP-23, A-35, E-5); Lesestand v0.3.1 Rev. `d816223d` (REQ-001, REQ-067, REQ-097, AC-REQ-001-07 bis -09); Kandidat v0.3.3 Rev. `ce76d962` (REQ-065, AC-REQ-106-01); Review-Findings FIND-026, FIND-027; Design C-1 (Commit `92e018e`); Architecture Review Runde 2 (FIND-111, in v0.3.2 behoben); Cross-Check MAR-141 (UI-001, UI-040 in beiden Varianten machbar, Kap. 6.4); Freigabe pending.

---
Veröffentlicht aus der Architecture Baseline v0.3.2 (Kapitel 15), `docs/architecture/architecture-baseline.md`.
