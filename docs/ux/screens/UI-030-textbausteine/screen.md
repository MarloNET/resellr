# UI-030 – Textbausteine

- Zweck: Textbausteine (Akku-Hinweis, Lieferumfang, Abholung/Kontakt, Rechtliches, Sonstiges) pflegen, inkl. rechtlichem Prüfstatus.
- Flows: FLOW-04 · Anforderungen: REQ-026, REQ-054, REQ-053, REQ-043 · Rollen: Nutzer · Gerät(e): PC · Artefakte: default.png (Stitch 17cd3cbfa6634c04bf11a6b3a6575080, DESKTOP, 06.11.2026)

## Angezeigte Daten
Liste: Name, Art, Geltungsbereich (Gerätearten/Kanäle), Status, Prüfstatus (nur Rechtliches/Akku-Hinweis: „rechtlich ungeprüft“ / „rechtlich geprüft am <Datum> durch <Stelle>“). Detailbereich mit Textfeld und Platzhalterliste (Kap. 9.7, ohne `{Baustein:Name}`).

## Eingaben und Validierung
| Feld | Typ | Pflicht | Regel | Fehlermeldung |
|---|---|---|---|---|
| Name | Text | ja | eindeutig, max. 100 | „Name ist bereits vergeben“ |
| Art | Auswahl | ja | fünf Arten | – |
| Text | Mehrzeilentext | ja | max. 5.000 Zeichen; nur zulässige Platzhalter | „Unbekannter Platzhalter {…}“; „{Baustein:Name} ist im Textbaustein nicht zulässig“ |
| Geltungsbereich | Mehrfachauswahl Gerätearten, Kanäle (oder „alle“) | ja | | – |
| Prüfstatus | Auswahl | nur Rechtliches/Akku-Hinweis | neue Bausteine „rechtlich ungeprüft“; Textänderung setzt zurück | – |
| Prüfdatum | Datum | ja bei „rechtlich geprüft“ | nicht in der Zukunft | „Prüfdatum fehlt“ (v0.6, M-24, AC-REQ-054-03); „Prüfdatum darf nicht in der Zukunft liegen“ |
| Prüfende Stelle | Text | ja bei „rechtlich geprüft“ | max. 100 | „Prüfende Stelle fehlt“ |

## Aktionen
| Aktion | Auslöser | Voraussetzung | Ergebnis bei Erfolg | Ergebnis bei Fehler | Navigation danach |
|---|---|---|---|---|---|
| Speichern | Primärbutton | gültig | Baustein gespeichert; bei Textänderung eines „geprüft“-Bausteins Hinweis „Prüfstatus wurde auf ‚rechtlich ungeprüft‘ zurückgesetzt“; danach UI-043 | Feldfehler | UI-043 |
| Deaktivieren | Zeilenaktion | – | wird in neue Kanal-Inhalte nicht mehr übernommen | – | bleibt |

## Zustände
| Zustand | Darstellung | Artefakt | Text |
|---|---|---|---|
| default | wie oben | nur Text | – |
| loading | Platzhalter | nur Text | „Lade Einstellungen …“ |
| empty | Hinweistext mittig im Listenbereich, darunter Button „Textbaustein anlegen“ (Primärbutton) | nur Text | „Noch keine Textbausteine“ |
| `UI-030.speichert` (wird gespeichert) | Speicherknopf und alle Eingaben gesperrt bis zur Antwort, Anzeige „Speichern …“, **kein festes Timeout** (Muster P-08); bei Verbindungsverlust „Ausgang unbekannt, bitte neu laden“ | nur Text | „Speichern …“ |
| error | Banner | nur Text | „Einstellungen konnten nicht gespeichert werden. Referenz: <Nr>“ |
| validation | Feldfehler | nur Text | siehe Eingaben |
| success | Banner | nur Text | „Gespeichert“ |
| disabled | Speichern deaktiviert ohne Änderung | nur Text | |

## Fenstergröße und Bedienung
Fenster frei in der Größe, Untergrenze 1366 px (REQ-077); Einstellungs-Liste (240 px) links, Inhalt rechts (unter 1366 CSS-px: Liste über dem Inhalt, Regel R-1); Tastaturalternativen zum Ziehen.

## Bekannte Abweichungen im Mockup
Von Stitch erzeugt, nicht Teil des Designs: **Schaltfläche „Löschen“ je Zeile** (REQ-026 kennt nur anlegen, ändern, deaktivieren; maßgeblich ist „Deaktivieren"; Löschen wäre eine Scope-Frage für den Owner); Kartenüberschrift „Verfügbare Bausteine (5)“ links neben „Neuer Textbaustein“; Pluszeichen im Button. Die Tabelle ist rechts abgeschnitten: Spalte „Prüfstatus“ und das Ende von „Geltungsbereich“ sind im Mockup nicht lesbar; maßgeblich sind die Spalten laut „Angezeigte Daten“ (inkl. Prüfstatus-Chip). Platzhalter-Chips sind eine Darstellungsform der Platzhalterliste.

## Annahmen und offene Fragen
- Texte der Bausteine sind nicht Teil der Auslieferung (REQ-006).
