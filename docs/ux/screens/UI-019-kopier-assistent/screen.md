# UI-019 – Kopier-Assistent

- Zweck: Felder und Fotos eines freigegebenen Kanal-Inhalts mit einer Aktion je Feld in das Formular des Kanals (anderes Programm) übernehmen.
- Flows: FLOW-09 (und Schlusssteil von FLOW-01, 02, 03, 04, 06)
- Anforderungen: REQ-047, REQ-048, REQ-049, REQ-037, REQ-091, REQ-045, REQ-046, REQ-090, REQ-104/105 (Hinweis im Rahmen, siehe UI-044); AC-REQ-047-01 bis -07, AC-REQ-048-01/-02, AC-REQ-049-03, AC-REQ-104-01
- Rollen: Nutzer
- Gerät(e): PC; **zwei Layouts**: Vollfenster (Fenster ab 1366 × 768, nutzbar etwa 1350 × 630 px) und schmales Arbeitsfenster (ab 480 px Mindestbreite, volle Höhe, ohne Navigation) zur Nutzung neben einem anderen Programm
- Artefakte: default.png (Stitch 67d2ba17a4874daeafe35e12dae4a07d, ersetzt 59004a11…), compact.png (Stitch 257305f592a548688c85f43e24e3fc77; ersetzt 149274c4a0b04b9e9dd56e5e94187906 mit 440 px, „39%“ und altem Foto-Button), DESKTOP, 06.11.2026

## Angezeigte Daten
| Element | Inhalt | Quelle | Hinweise |
|---|---|---|---|
| Kopf | Titel des Modell-Inserats, Kanal-Wahl (Shop/Kleinanzeigen/eBay) mit Status-Chip | Kanal-Inhalt | Wechsel behält Übernommen-Markierungen je Kanal |
| Hinweis | „Neuer Stand noch nicht freigegeben“ + Link „Änderungsentwurf prüfen“ (UI-018) bei „geändert seit Freigabe“ | REQ-047 | zeigt immer den freigegebenen Stand, nie den Entwurf |
| Fortschritt | „n von m übernommen“ (z. B. „3 von 11 übernommen“) und „k offen“, Balken | REQ-049, AC-REQ-049-01, AC-REQ-049-03 | m zählt nur angezeigte Felder (Merkmalsfelder ohne Wert fehlen in n und m). Prozentzahl entfällt (im Mockup „39%“ von Stitch ergänzt) |
| Sicherungshinweis | im Anwendungsrahmen, **auch in der schmalen Ansicht** (dort fest am unteren Rand, vollständig, siehe UI-044) | REQ-104 | nicht ausblendbar |
| Feldzeilen | Feldbezeichnung des Kanals, Wert (Beschreibung mehrzeilig, Zeilenumbrüche sichtbar, scrollbar), Kopieren-Button, Chip „übernommen“ | freigegebener Stand mit aktuellen Bestandsangaben (REQ-091) | Reihenfolge = Feldreihenfolge des Kanals (UI-036); Felder: Titel, Beschreibung, Kategorie, Zustand (+Zusatz), Preis (ggf. „VB“), Merkmalsfelder, GPSR-Angaben |
| Merkmalsfeld ohne Wert | **wird nicht angezeigt** (keine Zeile, kein „leer“, kein Button) | REQ-037, REQ-047, AC-REQ-047-07 | Gilt nur für Merkmalsfelder. Titel, Beschreibung, Kategorie, Zustand, Preis und GPSR-Angaben sind im freigegebenen Stand stets vorhanden. Ein Feld erscheint bzw. entfällt nach dem aktuellen Stand (REQ-091). Geändert in Design v0.4 (Requirements v0.3.3: Regeländerung gegenüber v0.3); vorher Design-Annahme „Wert leer“ |
| Fotos | „n Fotos in Reihenfolge, Dateinamen beginnen mit 01 …“, nummerierte Vorschau, Buttons „Foto-Ordner öffnen“ und „Fotos als ZIP herunterladen“; ohne Fotos „Keine Fotos zugeordnet“ | REQ-048 | Foto-Ordner öffnen bzw. ZIP herunterladen laut Architecture Baseline v0.3.2 (C-3, ADR-001; wie FLOW-09) |
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
Vollfenster: Liste mit Spalten Feldname | Wert | Aktion. Schmal: Kopf, Kanal-Wahl und Fortschritt stehen fest oben, der **Sicherungshinweis (UI-044, vollständiger Text, etwa 256 px hoch bei Pfad bis 100 Zeichen, etwa 240 px bei Beispielpfad; Rechnung in UI-044) fest unten**, nur die Feldliste dazwischen scrollt (bei 630 px nutzbarer Höhe bleiben etwa 374 px für Kopf, Kanal-Wahl, Fortschritt und Feldliste, bei Planungshöhe 600 px etwa 344 px); die Aktionen „Als veröffentlicht melden“ und „Abgleich bestätigen“ stehen am Ende der Feldliste. Eine Zeile je Feld, Wert einzeilig gekürzt (voller Wert per Klick auf den Wert oder Tooltip), Buttons groß (≥ 32 px Höhe), Navigation ausgeblendet. Die Markierungen „übernommen“ gelten für die laufende Nutzung und werden bei neuer Freigabe zurückgesetzt (REQ-049). Das schmale Layout ist ein Umschalter im selben Fenster („Schmale Ansicht“/„Normale Ansicht“, ADR-001; siehe „Annahmen und offene Fragen“).

## Bekannte Abweichungen im Mockup
default.png (Vollfenster, neu erzeugt in Korrekturrunde 2, Stitch 67d2ba17a4874daeafe35e12dae4a07d): zeigt „7 von 18 übernommen“ ohne Prozent, „Foto-Ordner öffnen“ und „Fotos als ZIP herunterladen“. Abweichungen: Stitch ergänzt die Beschriftung „Übertragungsfortschritt“; Buttons bei übernommenen Zeilen heißen „Erneut kopieren“ (entspricht der Aktion „Erneut kopieren“), die Beschreibung steht in Festbreitenschrift; die Hinweisfläche „Kanal ist abgeglichen“ steht links in der Fußleiste; das Banner „Neuer Stand noch nicht freigegeben“ ist nicht dargestellt (Zustand „geändert seit Freigabe"); Schaltfläche „Abgleich bestätigen“ ist deaktiviert dargestellt. compact.png (neu, 480 px; **Banner/Button:** zeigt das Banner „Neuer Stand noch nicht freigegeben“ ohne den Link „Änderungsentwurf prüfen“ neben einem aktiven „Als veröffentlicht melden“; das widerspricht der Aktionstabelle, maßgeblich ist `screen.md`): Anzeige „7 von 18 übernommen“ ohne Prozent; beide Foto-Aktionen sichtbar; Feldbezeichner in Großbuchstaben; Fotos-Karte zeigt „6 Fotos (01–06)“ statt Thumbnails; „Normale Ansicht“ ohne Symbol (Symbolwahl nicht verbindlich); Liste endet nach 8 Feldern (Rest laut Liste, Scrollbereich); die Sicht „Abgleich bestätigen“ ist im Mockup als aktiv dargestellt, in Status Freigegeben gilt der Zustand laut Aktionstabelle (deaktiviert).

## Änderung v0.4 (Cross-Check Baseline v0.3.1)
- Leere Merkmalsfelder: nicht angezeigt, zählen nicht (siehe Tabelle). Zustände, Aktionen und Mockups geprüft: Zustandstabelle und Aktionen enthalten keine Aussage zu leeren Feldern; beide Mockups zeigen kein leeres Feld und bleiben gültig (Beispiel „7 von 18“ nur Beispielzahl).
- Sicherungshinweis: Mockups `default.png` und `compact.png` zeigen den Hinweis noch nicht (Stand v0.3); maßgeblich ist `screen.md` und UI-044.

## Sicherungshinweis in jedem Fenster (X-1, Ergänzung des Architekten)
Der Sicherungshinweis (UI-044) steht auch in der **schmalen Ansicht** (fester Streifen unten, vollständiger Text) und in **jedem Fenster bzw. Rahmen**, also auch in einem zweiten, schmalen Browserfenster, das der Nutzer neben dem Kanal-Formular öffnet. Es gibt keine Ansicht von UI-019 ohne den Hinweis. Inhalt und Position wie in UI-044; X-1 ist sonst unverändert (MAR-143).

## Annahmen und offene Fragen
- Browser (Baseline v0.3.2, Entwurf, Cross-Check läuft): Zwischenablage nur auf Nutzeraktion, ein Feld als reiner Text (Fehlerfall ist gestaltet). Schmales Layout ist ein Umschalter im selben Fenster (ADR-001, nicht mehr von OP-15 abhängig); der Nutzer kann ein zweites, schmales Browserfenster öffnen. Mindestbreite 480 px, vom Software Architect zu prüfen (C-5).
- Konflikt (P-05): „Neuer Stand noch nicht freigegeben“ bzw. geänderter Stand beim Laden → Banner „Bitte neu laden“.
- Annahme: „Kopieren“ markiert nicht automatisch „übernommen“, wenn der Systemzugriff scheitert.
- ~~OF-19-1~~ erledigt: Die Regel „leere Merkmalsfelder zählen nicht“ ist mit Requirements v0.3.3 Anforderung (REQ-047, REQ-049), nicht mehr Design-Annahme (Bestätigung durch den Owner mit der Requirements-Freigabe).

- **Mockup `compact-hinweis.png` (v0.4.1, schmale Ansicht mit Streifen UI-044):** zeigt den festen Streifen unten mit vollständigem Hinweis. Abweichungen (Stitch-Zusätze): Fenster als Karte auf dunklem Hintergrund dargestellt (kein Bildschirmbestandteil), Chip „Kompaktmodus“ oben rechts (kein Teil des Designs, entfällt), Feldkarten statt Zeilen. Pfad in zwei Zeilen (Monospace). Abstände und Höhe (v0.5.2): das Mockup zeigt noch die früheren Abstände und eine geringere Streifenhöhe; verbindlich sind 8 px/8 px und etwa 256 px laut UI-044. Verbindlich sind `screen.md` von UI-019/UI-044. Kein „×“, kein Schließen.
