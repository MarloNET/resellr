# UI-023 – Datenblatt

- Zweck: Datenblatt eines Geräts als A4-Hochformat erzeugen und im PDF-Viewer des Browsers öffnen (Drucken und Speichern dort).
- **Entscheidung v0.4 (Baseline Kap. 6.2 C-2 bestätigt, Variante (a)):** UI-023 zeigt **nur den Button „Datenblatt öffnen (PDF)“**, kein eingebettetes PDF und keine nachgebaute Blattvorschau. Das PDF öffnet im PDF-Viewer von Chrome (neuer Tab); Drucken und Speichern dort. Begründung: kleinster Umfang, der REQ-050 erfüllt; das echte PDF ist die einzige Vorschau und weicht nie vom Druck ab. Das Mockup `inhaltsreferenz-pdf.png` (früher `default.png`) zeigt noch die frühere Blattvorschau und ist nur Inhaltsreferenz des PDFs (Aufbau des Blatts), nicht der Bildschirm.
- Flows: FLOW-01 (Schritt 8)
- Anforderungen: REQ-050, REQ-051, REQ-081, REQ-040
- Rollen: Nutzer
- Gerät(e): PC; A4-Drucker
- Artefakte: inhaltsreferenz-pdf.png (**Inhaltsreferenz des PDFs, kein Bildschirm; nicht bauen**; früher default.png) (Stitch b54e7fed073c49b1af58c3b5d24c1d0d, DESKTOP, 06.11.2026)

## Angezeigte Daten
| Element | Inhalt | Quelle | Hinweise |
|---|---|---|---|
| Titel | „Datenblatt WI-Nr <Nr>“ | Gerät | |
| Inhalt des PDFs (nur zur Beschreibung, nicht auf dem Bildschirm) | Logo der Händlermarke (Kopf, mittig), Kanalfelder „Shop:“, „eBay:“, „Kleinanzeigen:“ mit Schreiblinien, Blöcke Identifikation, Zustand, Lieferumfang (inkl. Akku-Hinweis und Akkukapazität dieses Geräts), Technik, Anschlüsse, Software als Bezeichnung | Wert | Leere Merkmale erscheinen nicht; Blockfolge und Merkmalsreihenfolge nach UI-039 |
| Hinweis | „A4 Hochformat“ | | bei mehr als 1 Seite (vor dem Öffnen aus der Seitenzahl, die der Server beim Erzeugen kennt): „Datenblatt passt nicht auf eine Seite“ (Warnung, Druck bleibt möglich) |

## Eingaben und Validierung
Keine. Voraussetzungen werden beim Öffnen geprüft:
| Bedingung | Meldung |
|---|---|
| Gerät mit Prüfmarkierung | „Werte noch zu prüfen“ |
| Gerät keinem Modell-Inserat zugeordnet | „Gerät keinem Modell-Inserat zugeordnet“ |
| Gerät storniert | „Gerät storniert“ |
| Kein Logo gepflegt | „Logo der Händlermarke fehlt“ (Link zu UI-026) |

## Aktionen
| Aktion | Auslöser | Voraussetzung | Ergebnis bei Erfolg | Ergebnis bei Fehler | Navigation danach |
|---|---|---|---|---|---|
| Datenblatt öffnen (PDF) | Primärbutton | Voraussetzungen erfüllt | PDF A4 Hochformat öffnet sich in neuem Browser-Tab; Drucken und Speichern über den PDF-Viewer | „Datenblatt konnte nicht erzeugt werden. Referenz: <Nr>“ | bleibt |
| Zurück zum Gerät | Link | – | – | – | UI-010 |

## Zustände
| Zustand | Darstellung | Artefakt | Text |
|---|---|---|---|
| default | Titel, Hinweis „A4 Hochformat“, Button „Datenblatt öffnen (PDF)“, Link „Zurück zum Gerät“; keine Vorschau | `inhaltsreferenz-pdf.png` nur als Inhaltsreferenz des PDFs (kein Bildschirm) | – |
| loading | Button deaktiviert mit Text, bis das PDF bereit ist (bis 5 s, REQ-061) | nur Text | „Datenblatt wird erzeugt …“ |
| empty | n/a | – | – |
| error | Voraussetzungs-Meldung über dem Button (siehe Tabelle) oder technischer Fehler als Banner | nur Text | siehe oben |
| success | Hinweis nach dem Öffnen | nur Text | „Datenblatt in neuem Tab geöffnet“ |
| disabled | Buttons deaktiviert bei Voraussetzungs-Meldung | nur Text | |

## Fenstergröße und Bedienung
Einspaltige Seite ohne Vorschau. Das Layout des PDFs ist inhaltlich gleichwertig zu `Datenblatt.xlsx` (Annahme A-10/OP-01, nicht pixelgenau). Unter 1366 CSS-px (Zoom, schmaleres Fenster) gilt die Reflow-Regel R-1 (uiux-design.md Kap. 5, DESIGN.md).

## Bekannte Abweichungen im Mockup
„Business Portal“ (Stitch); im Blatt hat Stitch die Blöcke teils zweispaltig gesetzt und den Akku-Hinweis kursiv hervorgehoben (maßgeblich: zweispaltig Bezeichnung | Wert je Block, einheitlich); Schreiblinien zeigen „Shop:“ usw. wie in Requirements (die Excel schreibt „shop:“, „ebay:“, „Kleinenzeigen:“); Logo-Platzhalterbox nur Platzhalter (Logo liefert der Pilotkunde, OP-13).

## Annahmen und offene Fragen
- Offen (OP-01/A-10): exakte oder inhaltlich gleichwertige Nachbildung des Excel-Layouts.
- Druck- und Speicherdialog gehören dem Browser und sind nicht Teil des Designs (Baseline ADR-007).
- Seitenzahl-Warnung („passt nicht auf eine Seite“) entsteht vor dem Öffnen als Hinweis; das PDF lässt sich trotzdem öffnen.
- Wird später ein eingebettetes PDF gewünscht (Baseline Kap. 6.1, Variante (b)), wäre das eine Designänderung ohne Requirements-Änderung.
