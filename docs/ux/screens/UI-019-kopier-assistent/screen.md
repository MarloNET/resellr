# UI-019 – Kopier-Assistent

- Zweck: Felder und Fotos eines freigegebenen Kanal-Inhalts mit einer Aktion je Feld in das Formular des Kanals (anderes Programm) übernehmen.
- Flows: FLOW-09 (und Schlusssteil von FLOW-01, 02, 03, 04, 06)
- Anforderungen: REQ-047, REQ-048, REQ-049, REQ-037, REQ-091, REQ-045, REQ-046, REQ-090, REQ-104/105 (Hinweis im Rahmen, siehe UI-044); AC-REQ-047-01 bis -07, AC-REQ-048-01/-02, AC-REQ-049-03, AC-REQ-104-01
- Rollen: Nutzer
- Gerät(e): PC; **zwei Layouts**: Vollfenster (Fenster frei in der Größe, Untergrenze 1366 × 768 nach REQ-077) und schmales Arbeitsfenster (ab 480 px Mindestbreite, volle Höhe, ohne Navigation) zur Nutzung neben einem anderen Programm
- Artefakte: default.png (Stitch 67d2ba17a4874daeafe35e12dae4a07d, ersetzt 59004a11…), compact.png (Stitch 257305f592a548688c85f43e24e3fc77; ersetzt 149274c4a0b04b9e9dd56e5e94187906 mit 440 px, „39%“ und altem Foto-Button), DESKTOP, 06.11.2026

## Angezeigte Daten
| Element | Inhalt | Quelle | Hinweise |
|---|---|---|---|
| Kopf | Titel des Modell-Inserats, Kanal-Wahl (Shop/Kleinanzeigen/eBay) mit Status-Chip | Kanal-Inhalt | Wechsel behält Übernommen-Markierungen je Kanal |
| Hinweis | „Neuer Stand noch nicht freigegeben“ + Link „Änderungsentwurf prüfen“ (UI-018) bei „geändert seit Freigabe“ | REQ-047 | zeigt immer den freigegebenen Stand, nie den Entwurf |
| Fortschritt | „n von m übernommen“ (z. B. „3 von 18 übernommen“) und „k offen“, Balken | REQ-049, AC-REQ-049-01, AC-REQ-049-03 | **m zählt jedes angezeigte Kopierfeld einzeln**, auch jede GPSR-Angabe (siehe „Feste Kopierfelder“ unten); Merkmalsfelder ohne Wert und optionale GPSR-Angaben ohne Wert fehlen in n und m. Prozentzahl entfällt (im Mockup „39%“ von Stitch ergänzt). Zahlen sind Beispiele (v0.6: vorher „3 von 11“) |
| Sicherungshinweis | im Anwendungsrahmen, **auch in der schmalen Ansicht** (dort als Streifen am Ende der scrollenden Fläche, vollständig, siehe UI-044) | REQ-104 | nicht ausblendbar |
| Feldzeilen | Feldbezeichnung (feste Felder: siehe unten; Merkmalsfelder: laut Kanal), Wert (Beschreibung mehrzeilig, Zeilenumbrüche sichtbar, scrollbar), Kopieren-Button, Chip „übernommen“ | freigegebener Stand mit aktuellen Bestandsangaben (REQ-091) | Reihenfolge = Feldreihenfolge des Kanals (UI-036); Felder: Titel, Beschreibung, Kategorie, Zustand (+Zusatz), Preis (ggf. „VB“), Merkmalsfelder, GPSR-Angaben |
| Feste Kopierfelder (v0.6, MAR-167, DG-01, DG-02) | Jedes Feld ist **ein eigenes Kopierfeld** mit eigener Zeile, Kopieren-Button und Marke „übernommen“. Bezeichnungen und Reihenfolge siehe Tabelle unten. | Requirements (REQ-047), Spec DG-01 | Die Bezeichnungen der festen Felder sind fest (nicht über UI-036 einstellbar); UI-036 stellt nur die Bezeichnung der Merkmalsfelder ein |
| Merkmalsfeld ohne Wert | **wird nicht angezeigt** (keine Zeile, kein „leer“, kein Button) | REQ-037, REQ-047, AC-REQ-047-07 | Gilt nur für Merkmalsfelder. Titel, Beschreibung, Kategorie, Zustand, Preis und GPSR-Angaben sind im freigegebenen Stand stets vorhanden. Ein Feld erscheint bzw. entfällt nach dem aktuellen Stand (REQ-091). Geändert in Design v0.4 (Requirements v0.3.3: Regeländerung gegenüber v0.3); vorher Design-Annahme „Wert leer“ |
| Fotos | „n Fotos in Reihenfolge, Dateinamen beginnen mit 01 …“, nummerierte Vorschau, Buttons „Foto-Ordner öffnen“ und „Fotos als ZIP herunterladen“; ohne Fotos „Keine Fotos zugeordnet“ | REQ-048 | Foto-Ordner öffnen bzw. ZIP herunterladen laut Architecture Baseline v0.3.2 (C-3, ADR-001; wie FLOW-09) |
| Nächstes Feld | Die erste offene Zeile ist hervorgehoben und trägt die Marke „nächstes Feld“, in beiden Layouts | – | Enter kopiert dieses Feld |

### Feste Kopierfelder und Bezeichnungen (v0.6)
| Nr | Feldbezeichnung | Erscheint | Wert |
|---|---|---|---|
| 1 | Titel | immer | Titel des freigegebenen Stands |
| 2 | Beschreibung | immer | Beschreibung, mehrzeilig |
| 3 | Kategorie | immer | Kategoriepfad des Kanals |
| 4 | Zustand | immer | Zustandsbezeichnung |
| 5 | Zustand – Zusatz | **nur wenn eine Zusatzangabe besteht** | Zusatzangabe |
| 6 | Preis | immer | Preis (ggf. „VB“) |
| – | (Merkmalsfelder) | nur mit Wert | Bezeichnung und Reihenfolge laut UI-036 |
| 7 | Herstellername | immer | GPSR |
| 8 | Postanschrift | immer | GPSR |
| 9 | Elektronische Kontaktadresse | immer | GPSR |
| 10 | Verantwortliche Person in der EU | **nur wenn angegeben** | GPSR, optional |
| 11 | Postanschrift der verantwortlichen Person | **nur wenn angegeben** | GPSR, optional |
| 12 | Kontaktadresse der verantwortlichen Person | **nur wenn angegeben** | GPSR, optional |
| 13 | Produktidentifikation | immer | GPSR |

Optionale GPSR-Angaben ohne Wert erscheinen **nicht** (keine Zeile, kein „leer“) und zählen weder in n noch in m. Die Reihenfolge der Tabelle ist die feste Reihenfolge der Spec; **REQ-029 (Feldreihenfolge) ist offen** und wird hier nicht entschieden. Beispiel: Ohne Zusatzangabe und ohne Angaben der verantwortlichen Person sind es 5 feste Felder (Titel, Beschreibung, Kategorie, Zustand, Preis) + 4 GPSR-Felder + die Merkmalsfelder; bei 9 Merkmalsfeldern „n von 18“. (Die Mockups zeigen „7 von 18“ als Beispiel; die Zahl ist nur ein Beispiel, kein Sollwert.)

### Markierungen „übernommen“ (v0.6, DG-03, REQ-049)
- Sie gelten **je Fenster** (Browserfenster bzw. Registerkarte). Ein zweites Fenster mit demselben Kopier-Assistenten beginnt bei 0 von m.
- Sie **überstehen das Neuladen** im selben Fenster (auch nach dem Banner „Bitte neu laden“, P-05), nicht aber das Schließen des Fensters.
- Der Wechsel zwischen „Schmale Ansicht“ und „Normale Ansicht“ im selben Fenster und der Kanalwechsel behalten sie.
- Bei **reiner Änderung von Bestandsangaben** (Stückzahl, WI-Nr, Akkukapazität) bleiben sie stehen (REQ-049 setzt nur bei neuer Freigabe zurück, AC-REQ-049-02); die Kennzeichnung „Bestand auf Kanal anpassen“ weist auf den geänderten Wert hin. Eine Anzeige „Wert seit Übernahme geändert“ gibt es in Release 0.1 nicht.
- Eine neue Freigabe setzt alle zurück (unverändert).

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
Vollfenster: Liste mit Spalten Feldname | Wert | Aktion. Schmal (v0.6, anpassend, keine feste Höhenrechnung): Kopf (Titel), Kanal-Wahl und Fortschritt stehen fest oben und bleiben bei jeder Höhe sichtbar und erreichbar; darunter **eine scrollende Fläche**: Feldliste, danach die Aktionen „Als veröffentlicht melden“ und „Abgleich bestätigen“, danach der **Sicherungshinweis (UI-044, vollständiger und unveränderter Text) als Streifen am Ende der Fläche**. Ist das Fenster hoch genug, füllt die Fläche die Höhe und der Streifen steht am unteren Fensterrand; ist es niedriger, scrollt die Fläche und der Streifen folgt nach den Aktionen. **Begründung:** ein fester Streifen (etwa 240 bis 256 px) würde bei wenig Höhe die Feldliste verdrängen; am Ende der Fläche kostet er keine Höhe, ist immer erreichbar, und Wortlaut und „nicht ausblendbar“ bleiben unberührt. Der Streifen hat keine eigene Höhenbegrenzung und kein eigenes Scrollen. Eine Zeile je Feld, Wert einzeilig gekürzt (voller Wert per Klick auf den Wert oder Tooltip), Buttons groß (≥ 32 px Höhe), Navigation ausgeblendet. Die Markierungen „übernommen“ gelten je Fenster, überstehen das Neuladen im selben Fenster und werden bei neuer Freigabe zurückgesetzt (REQ-049, siehe „Markierungen“). Das schmale Layout ist ein Umschalter im selben Fenster („Schmale Ansicht“/„Normale Ansicht“, ADR-001; siehe „Annahmen und offene Fragen“). Unter 1366 CSS-px (Zoom, schmaleres Fenster) gilt die Reflow-Regel R-1 (uiux-design.md Kap. 5, DESIGN.md).

## Bekannte Abweichungen im Mockup
default.png (Vollfenster, neu erzeugt in Korrekturrunde 2, Stitch 67d2ba17a4874daeafe35e12dae4a07d): zeigt „7 von 18 übernommen“ ohne Prozent, „Foto-Ordner öffnen“ und „Fotos als ZIP herunterladen“. Abweichungen: Stitch ergänzt die Beschriftung „Übertragungsfortschritt“; Buttons bei übernommenen Zeilen heißen „Erneut kopieren“ (entspricht der Aktion „Erneut kopieren“), die Beschreibung steht in Festbreitenschrift; die Hinweisfläche „Kanal ist abgeglichen“ steht links in der Fußleiste; das Banner „Neuer Stand noch nicht freigegeben“ ist nicht dargestellt (Zustand „geändert seit Freigabe"); Schaltfläche „Abgleich bestätigen“ ist deaktiviert dargestellt. compact.png (neu, 480 px; **Banner/Button:** zeigt das Banner „Neuer Stand noch nicht freigegeben“ ohne den Link „Änderungsentwurf prüfen“ neben einem aktiven „Als veröffentlicht melden“; das widerspricht der Aktionstabelle, maßgeblich ist `screen.md`): Anzeige „7 von 18 übernommen“ ohne Prozent; beide Foto-Aktionen sichtbar; Feldbezeichner in Großbuchstaben; Fotos-Karte zeigt „6 Fotos (01–06)“ statt Thumbnails; „Normale Ansicht“ ohne Symbol (Symbolwahl nicht verbindlich); Liste endet nach 8 Feldern (Rest laut Liste, Scrollbereich); die Sicht „Abgleich bestätigen“ ist im Mockup als aktiv dargestellt, in Status Freigegeben gilt der Zustand laut Aktionstabelle (deaktiviert).

## Änderung v0.4 (Cross-Check Baseline v0.3.1)
- Leere Merkmalsfelder: nicht angezeigt, zählen nicht (siehe Tabelle). Zustände, Aktionen und Mockups geprüft: Zustandstabelle und Aktionen enthalten keine Aussage zu leeren Feldern; beide Mockups zeigen kein leeres Feld und bleiben gültig (Beispiel „7 von 18“ nur Beispielzahl).
- Sicherungshinweis: Mockups `default.png` und `compact.png` zeigen den Hinweis noch nicht (Stand v0.3); maßgeblich ist `screen.md` und UI-044.

## Sicherungshinweis in jedem Fenster (X-1, Ergänzung des Architekten)
Der Sicherungshinweis (UI-044) steht auch in der **schmalen Ansicht** (Streifen am Ende der scrollenden Fläche, vollständiger Text) und in **jedem Fenster bzw. Rahmen**, also auch in einem zweiten, schmalen Browserfenster, das der Nutzer neben dem Kanal-Formular öffnet. Es gibt keine Ansicht von UI-019 ohne den Hinweis. Inhalt und Position wie in UI-044; X-1 ist sonst unverändert (MAR-143).

## Annahmen und offene Fragen
- Browser (Baseline v0.3.2, freigegeben): Zwischenablage nur auf Nutzeraktion, ein Feld als reiner Text (Fehlerfall ist gestaltet). Schmales Layout ist ein Umschalter im selben Fenster (ADR-001, nicht mehr von OP-15 abhängig); der Nutzer kann ein zweites, schmales Browserfenster öffnen. Mindestbreite 480 px, vom Software Architect zu prüfen (C-5).
- Konflikt (P-05): „Neuer Stand noch nicht freigegeben“ bzw. geänderter Stand beim Laden → Banner „Bitte neu laden“.
- Annahme: „Kopieren“ markiert nicht automatisch „übernommen“, wenn der Systemzugriff scheitert.
- ~~OF-19-1~~ erledigt: Die Regel „leere Merkmalsfelder zählen nicht“ ist mit Requirements v0.3.3 Anforderung (REQ-047, REQ-049), nicht mehr Design-Annahme (Bestätigung durch den Owner mit der Requirements-Freigabe).

- **Mockup `compact-hinweis.png` (v0.4.1, schmale Ansicht mit Streifen UI-044):** zeigt den Streifen unten mit vollständigem Hinweis (**seit v0.6 verbindlich: Streifen am Ende der scrollenden Fläche, nicht fest unten; die feste Position im Mockup ist nicht mehr verbindlich**). Abweichungen (Stitch-Zusätze): Fenster als Karte auf dunklem Hintergrund dargestellt (kein Bildschirmbestandteil), Chip „Kompaktmodus“ oben rechts (kein Teil des Designs, entfällt), Feldkarten statt Zeilen. Pfad in zwei Zeilen (Monospace). Abstände und Höhe (v0.5.2): das Mockup zeigt noch die früheren Abstände und eine geringere Streifenhöhe; verbindlich sind 8 px/8 px laut UI-044; die Streifenhöhe folgt dem Text und wird nicht mehr als feste Zahl geplant (v0.6). Verbindlich sind `screen.md` von UI-019/UI-044. Kein „×“, kein Schließen.
