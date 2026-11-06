# UI-019 – Kopier-Assistent

- Zweck: Felder und Fotos eines freigegebenen Kanal-Inhalts mit einer Aktion je Feld in das Formular des Kanals (anderes Programm) übernehmen.
- Flows: FLOW-09 (und Schlusssteil von FLOW-01, 02, 03, 04, 06)
- Anforderungen: REQ-047, REQ-048, REQ-049, REQ-091, REQ-045, REQ-046, REQ-090; AC-REQ-047-01 bis -06, AC-REQ-048-01/-02
- Rollen: Nutzer
- Gerät(e): PC; **zwei Layouts**: Vollfenster ab 1366 × 768 und schmales Arbeitsfenster (ab 480 px Mindestbreite, volle Höhe, ohne Navigation) zur Nutzung neben einem anderen Programm
- Artefakte: default.png (Stitch 59004a119c70418f85d9024115185329), compact.png (Stitch 149274c4a0b04b9e9dd56e5e94187906), DESKTOP, 06.11.2026

## Angezeigte Daten
| Element | Inhalt | Quelle | Hinweise |
|---|---|---|---|
| Kopf | Titel des Modell-Inserats, Kanal-Wahl (Shop/Kleinanzeigen/eBay) mit Status-Chip | Kanal-Inhalt | Wechsel behält Übernommen-Markierungen je Kanal |
| Hinweis | „Neuer Stand noch nicht freigegeben“ + Link „Änderungsentwurf prüfen“ (UI-018) bei „geändert seit Freigabe“ | REQ-047 | zeigt immer den freigegebenen Stand, nie den Entwurf |
| Fortschritt | „n von m übernommen“ (z. B. „3 von 12 übernommen“) und „k offen“, Balken | REQ-049, AC-REQ-049-01 | Prozentzahl entfällt (im Mockup „39%“ von Stitch ergänzt) |
| Feldzeilen | Feldbezeichnung des Kanals, Wert (Beschreibung mehrzeilig, Zeilenumbrüche sichtbar, scrollbar), Kopieren-Button, Chip „übernommen“ | freigegebener Stand mit aktuellen Bestandsangaben (REQ-091) | Reihenfolge = Feldreihenfolge des Kanals (UI-036); Felder: Titel, Beschreibung, Kategorie, Zustand (+Zusatz), Preis (ggf. „VB“), Merkmalsfelder, GPSR-Angaben |
| Leeres Feld | Wert „leer“, kein Kopieren-Button | REQ-037 | Leere Felder sind nicht kopierbar und zählen weder in „n“ noch in „m“ (m = Felder mit Wert). Das entspricht AC-REQ-049-01 („12 Felder“), die Requirements regeln leere Felder aber nicht ausdrücklich: offene Frage OF-19-1 |
| Fotos | „n Fotos in Reihenfolge, Dateinamen beginnen mit 01 …“, nummerierte Vorschau, Buttons „Foto-Ordner öffnen“ und „Fotos als ZIP herunterladen“; ohne Fotos „Keine Fotos zugeordnet“ | REQ-048 | Ordner oder ZIP laut Architecture Baseline v0.1 (C-3); Mockup zeigt noch „Fotos herunterladen“ |
| Nächstes Feld | Die erste offene Zeile ist hervorgehoben und trägt die Marke „nächstes Feld“, in beiden Layouts | – | Enter kopiert dieses Feld |

## Eingaben und Validierung
Keine Eingaben. Tastatur: Pfeil auf/ab wählt Zeile, Enter oder Strg+Enter kopiert das gewählte Feld und wählt das nächste offene Feld.

## Aktionen
| Aktion | Auslöser | Voraussetzung | Ergebnis bei Erfolg | Ergebnis bei Fehler | Navigation danach |
|---|---|---|---|---|---|
| Kopieren | Button je Feld, Enter | Status Freigegeben/Veröffentlicht/Beendet | Wert zeichengenau in der Zwischenablage; Zeile „übernommen“; Toast „Kopiert: <Feld>“ (3 s); Zähler steigt | Fehlermeldung im Toast: „Kopieren nicht möglich. Bitte Wert markieren und mit Strg+C kopieren.“ | bleibt |
| Erneut kopieren | Button bei „übernommen“ | – | wie oben | wie oben | bleibt |
| Foto-Ordner öffnen | Button | Fotos vorhanden | Dateien 01_…, 02_… liegen in einem Übergabeordner; Ordner öffnet im Dateimanager; Hinweis „n Fotos bereitgestellt“ | „Foto-Ordner konnte nicht angelegt werden. Bitte stattdessen die ZIP-Datei laden. Referenz: <Nr>“ | bleibt |
| Fotos als ZIP herunterladen | Button | Fotos vorhanden | ZIP mit Namen 01_…, 02_… wird heruntergeladen | „Fotos konnten nicht bereitgestellt werden. Referenz: <Nr>“ | bleibt |
| Als veröffentlicht melden | Primärbutton | Status Freigegeben oder Beendet (nur ohne „geändert seit Freigabe“) | öffnet UI-020 | – | UI-020 |
| Abgleich bestätigen | Sekundärbutton | Status Veröffentlicht; bei „Änderung auf Kanal übertragen“/„Bestand auf Kanal anpassen“ aktiv; sonst deaktiviert mit „Kanal ist abgeglichen“ | öffnet UI-021 | – | UI-021 |
| Schmale/Normale Ansicht | Link | – | Layout wechselt | – | bleibt |
| Zurück | Link (nur Vollfenster) | – | – | – | UI-014 |

## Zustände
| Zustand | Darstellung | Artefakt | Text |
|---|---|---|---|
| default | Feldliste, Übernommen-Markierungen | default.png, compact.png | – |
| loading | Platzhalterzeilen | nur Text | „Lade Felder …“ |
| empty (Entwurf) | Kopieren nicht verfügbar | nur Text | „Erst freigeben“ + Link zu UI-016 |
| empty (Fotos) | „Keine Fotos zugeordnet“ | nur Text | |
| error | Banner | nur Text | „Kopier-Assistent konnte nicht geladen werden. Referenz: <Nr>“ |
| validation | n/a | – | – |
| success | alle Felder übernommen: Hinweis „Alle Felder übernommen“; Primärbutton hervorgehoben | nur Text | |
| disabled | „Abgleich bestätigen“ deaktiviert wenn nichts abzugleichen | compact.png | „Kanal ist abgeglichen“ |

## Fenstergröße und Bedienung
Vollfenster: Liste mit Spalten Feldname | Wert | Aktion. Schmal: eine Zeile je Feld, Wert einzeilig gekürzt (voller Wert per Klick auf den Wert oder Tooltip), Buttons groß (≥ 32 px Höhe), Navigation ausgeblendet. Die Markierungen „übernommen“ gelten für die laufende Nutzung und werden bei neuer Freigabe zurückgesetzt (REQ-049). Ob das schmale Layout als eigenes Fenster oder als Umschalter realisiert wird, hängt von OP-15 ab.

## Bekannte Abweichungen im Mockup
„Business Portal“ (Stitch, default.png); im default.png: Feldbezeichner in Großbuchstaben; Sticky-Leiste; compact.png ist auf 440 px gestaltet (maßgeblich: 480 px); Fortschrittsprozent „39%“ im compact.png (nicht Teil des Designs); „Normale Ansicht“ mit Symbol „externes Fenster“ (Symbolwahl nicht verbindlich); compact.png zeigt nur die ersten 10 Felder (Scrollbereich), Rest gemäß Liste; Thumbnails 01–06 sind Platzhalter.

## Annahmen und offene Fragen
- Browser (Baseline v0.1): Zwischenablage nur auf Nutzeraktion, ein Feld als reiner Text (Fehlerfall ist gestaltet). Schmales Layout ist ein Umschalter im selben Fenster; der Nutzer kann ein zweites, schmales Browserfenster öffnen. Mindestbreite 480 px, vom Software Architect zu prüfen (C-5).
- Konflikt (P-05): „Neuer Stand noch nicht freigegeben“ bzw. geänderter Stand beim Laden → Banner „Bitte neu laden“.
- Annahme: „Kopieren“ markiert nicht automatisch „übernommen“, wenn der Systemzugriff scheitert.
- **OF-19-1 (an Product Owner):** Sollen leere Felder in „n von m“ mitzählen? Design-Vorschlag: nein, weil sie nichts zu übernehmen haben; die Requirements (REQ-049) regeln das nicht.
