# ADR-005 – Kanal-Inhalte: deterministische Bildung, gespeicherte Stände, Kanäle als Konfiguration

- **Status:** approved (Owner-Freigabe 2026-11-07 mit Architecture Baseline v0.3.2, Revision `2876806d-48b2-4ec3-b961-2f4d370d9b2e`, [MAR-142](/MAR/issues/MAR-142#document-owner-freigabeanfrage))
- **Kontext:** Kanal-Inhalte werden aus vielen Quellen gebildet (Requirements Kap. 6.0). Der freigegebene Stand muss erhalten bleiben, solange ein Änderungsentwurf offen ist (REQ-045, REQ-047). Eine Änderung „geht ein“, wenn der neu gebildete Stand vom freigegebenen abweicht, Bestandsangaben ausgenommen (REQ-045). Bestandsangaben werden stets aktuell ausgegeben (REQ-091). Zentrale Änderungen wirken auf viele Kanal-Inhalte und werden gezählt (REQ-053). Ein weiterer Kanal darf den Kern nicht ändern (LP-2, REQ-075).
- **Betroffene Anforderungen:** REQ-029 bis REQ-047, REQ-052, REQ-053, REQ-075, REQ-086, REQ-089 bis REQ-091.
- **Optionen Bildung und Speicherung:**
  - (A) stets bei Bedarf bilden, nur den freigegebenen Stand speichern.
  - (B) aktuellen Stand nach jeder Änderung bilden und speichern, freigegebenen Stand unveränderlich speichern.
  - (C) Ereignis-Sourcing aller Stände.
  - (D) wie (B), aber Neubildung asynchron in einer Warteschlange.

  (A) macht Übersicht, Filter und Kennzeichnungen teuer. (C) ist unverhältnismäßig. (D) bringt Zwischenzustände und Zählungen erst nach Abschluss.
- **Entscheidung (Vorschlag):** **(B)**.
  - `content-engine` ist eine reine, deterministische Funktion: gleiche Eingaben ergeben einen zeichengleichen Stand, ohne Uhrzeit oder Zufall.
  - Bestandsplatzhalter `{WI-Nr}`, `{Stückzahl}` und `{Akkukapazität}` bleiben im Stand als Platzhalter stehen und werden erst bei der Ausgabe aufgelöst. Der freigegebene Stand enthält deshalb keine veralteten Bestandswerte (REQ-091).
  - „Geht ein“ wird als Vergleich der kanonischen Form von neuem und freigegebenem Stand bestimmt.
  - Schreibende Komponenten melden geänderte Inhaltsangaben als Ereignis. `listing-content` ermittelt die betroffenen Kanal-Inhalte und bildet sie in derselben Transaktion neu. Danach setzt es Status und Kennzeichnungen nach Requirements Kap. 6.0 und liefert die Zählung nach REQ-053.
  - Manuelle Anpassungen (REQ-043, REQ-086) werden mit dem automatisch gebildeten Text gespeichert, auf dem sie beruhen. Ändert sich dieser, wird der Kanal-Inhalt gekennzeichnet.
  - Für die Kennzeichnung „Bestand auf Kanal anpassen“ wird der Bestand bei Veröffentlichung bzw. letztem Abgleich gespeichert und mit dem aktuellen verglichen. Die genaue Regel legt die Technical Specification fest.
- **Optionen Kanäle:**
  - (i) Kanäle als Daten mit generischer Bildung aus Einstellungen; kanaleigener Code nur in späteren Adaptern.
  - (ii) ein Code-Modul je Kanal ab Release 0.1.
- **Entscheidung (Vorschlag):** **(i)**. Shop, Kleinanzeigen und eBay unterscheiden sich in 0.1 nur in Einstellungen (Requirements Kap. 9.8, 9.12). Ein weiterer Kopier-Kanal ist ein neuer Datensatz mit Einstellungen, eingespielt per Datenmigration, ohne Änderung an Erfassung, Modell-Bibliothek, Modell-Inserat oder bestehenden Kanälen (REQ-075). Direktanbindungen (0.2) kommen als Adapter hinzu (Kap. 5.3).
- **Konsequenzen:**
  - Die Neuberechnung ist synchron. Ihr Zeitbedarf wird früh gemessen (AR-03).
  - Fotos, auf die ein freigegebener Stand verweist, werden nicht gelöscht (Kap. 9.4).
  - Änderungen an der Kanal-Engine wirken wie Inhaltsänderungen (AR-04).
- **Risiken:** AR-03, AR-04.
- **Referenzen:** Review und Freigabe pending.

---
Veröffentlicht aus der Architecture Baseline v0.3.2 (Kapitel 15), `docs/architecture/architecture-baseline.md`.
