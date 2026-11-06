# UI-017 – Kanäle vergleichen

- Zweck: Die Kanal-Inhalte (bis zu 3) eines Modell-Inserats vor der Freigabe nebeneinander vergleichen.
- Flows: FLOW-01 (Schritt 6) · Anforderungen: Kap. 10.6 (Vergleich vor Freigabe), REQ-034–041, REQ-044 · Rollen: Nutzer · Gerät(e): PC · Artefakte: nur Text (Mockup geplant)

## Angezeigte Daten
| Element | Inhalt | Quelle | Hinweise |
|---|---|---|---|
| Spalten | je aktivem Kanal eine Spalte: Kanalname, Status-Chip, Kennzeichnungen | Kanal-Inhalt | |
| Zeilen | Titel, Preis, Kategorie, Zustandsbezeichnung, Beschreibung, wichtige Merkmale (Herstellernummer, EAN, Artikelnummer, Stückzahl, Prozessor, RAM, Speicher), GPSR-Angaben | Kanal-Inhalt | Zeilen mit Unterschieden zwischen Kanälen tragen den Chip „unterschiedlich“; Abweichungen bei Kennungen (Herstellernummer, EAN, Artikelnummer) werden hervorgehoben |
| Freigabebedingungen | je Kanal Kurzstatus („alle erfüllt“ / „n offen“) | REQ-044 | |

## Eingaben und Validierung
Keine.

## Aktionen
| Aktion | Auslöser | Voraussetzung | Ergebnis bei Erfolg | Ergebnis bei Fehler | Navigation danach |
|---|---|---|---|---|---|
| Kanal prüfen und freigeben | Link je Spalte | – | – | – | UI-016 (Kanal) |
| Zurück | Link | – | – | – | UI-014 |
| Freigabe | nicht hier (Freigabe je Kanal in UI-016, Variante V-2) | – | – | – | – |

## Zustände
| Zustand | Darstellung | Artefakt | Text |
|---|---|---|---|
| default | Spaltenvergleich | nur Text | – |
| loading | Platzhalter | nur Text | „Lade Kanal-Inhalte …“ |
| empty | nur 1 aktiver Kanal | nur Text | „Nur ein aktiver Kanal. Kein Vergleich möglich.“ |
| error | Banner | nur Text | „Vergleich konnte nicht geladen werden. Referenz: <Nr>“ |
| validation, success, disabled, permission | n/a | – | – |

## Responsive und Barrierefreiheit
Drei Spalten ab 1366 px; erste Spalte (Feldname) fixiert.

## Bekannte Abweichungen im Mockup
keine (kein Mockup).

## Annahmen und offene Fragen
- Form legt das Design fest (Kap. 10.6); Annahme „Chip unterschiedlich“ ist Gestaltung, keine neue Regel. Variante V-2 siehe uiux-design.md.
