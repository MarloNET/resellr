# UI-016 – Kanal-Inhalt prüfen und freigeben

- Zweck: Kanal-Inhalt (Titel, Beschreibung, Kategorie, Zustand, Preis, Merkmale, GPSR) prüfen, ggf. anpassen und freigeben.
- Flows: FLOW-01 (Schritt 6), FLOW-04 (Schritt 3)
- Anforderungen: REQ-034–044, REQ-086, REQ-087, REQ-043, REQ-053; AC-REQ-089-02
- Rollen: Nutzer
- Gerät(e): PC, ab 1366 × 768
- Artefakte: default.png (Stitch a88484966822498492facf1aab70cf6d, DESKTOP, 06.11.2026)

## Angezeigte Daten
| Element | Inhalt | Quelle | Hinweise |
|---|---|---|---|
| Kopf | ungekürzter Titel des Modell-Inserats, „Stückzahl n · WI-Nr …“ | Bestandsangaben | |
| Kanal-Tabs | je aktivem Kanal Name + Status-Chip | Kanal-Inhalt | Wechsel ohne Datenverlust |
| Titel | Text, Zeichenzähler „n / Höchstlänge Zeichen“, ggf. Chip „Titel gekürzt, bitte prüfen“, „manuell angepasst“, „Daten geändert, manuell angepassten Text prüfen“ | REQ-034/035/043 | |
| Preis | Betrag, „VB“ wenn gesetzt | REQ-032 | nur lesen, Änderung in UI-014 (Link „Preis ändern“) |
| Kategorie | Kategorie, Chip „Kategorie manuell“ oder „Kategorie fehlt“ | REQ-038/086 | |
| Zustand | Zustandsbezeichnung, Zusatzangabe, bei fehlender Zuordnung „Zustandszuordnung fehlt“ | REQ-039 | |
| Beschreibung | Text mit Zeilenumbrüchen, nur lesen, Chip „manuell angepasst“ | REQ-036 | |
| Merkmalsfelder | Tabelle Feldbezeichnung → Wert, leere Werte „leer“ | REQ-037 | Reihenfolge der Merkmalszuordnung |
| GPSR | Herstellerangaben, Produktidentifikation; fehlend: „GPSR-Herstellerangaben fehlen“ mit Link zu UI-031 | REQ-041 | |
| Fotos | „n Fotos zugeordnet“ | REQ-042 | |
| Freigabebedingungen | Liste mit Status als Text („OK“/„nicht erfüllt“): Preis, Kategorie, Zustandsbezeichnung, GPSR, Titellänge, Pflichtfelder des Kanals | REQ-044 | Fehlerbanner „Freigabe nicht möglich: <Bedingungen>“ nennt jede verletzte Bedingung |

## Eingaben und Validierung
| Feld | Typ | Pflicht | Regel | Fehlermeldung |
|---|---|---|---|---|
| Kategorie (überschreiben) | Text | nein | 1–255 Zeichen; „Verwerfen“ stellt Vorschlag wieder her | „Kategorie: 1 bis 255 Zeichen“ |
| Titel (manuell) | Text | nein | höchstens Höchstlänge des Kanals | „Titel zu lang: höchstens <n> Zeichen“ |
| Beschreibung (manuell) | Mehrzeilentext | nein | Bestandsplatzhalter bleiben als Platzhalter erhalten | „Unbekannter Platzhalter {…}“ |

## Aktionen
| Aktion | Auslöser | Voraussetzung | Ergebnis bei Erfolg | Ergebnis bei Fehler | Navigation danach |
|---|---|---|---|---|---|
| Freigeben | Primärbutton | Status Entwurf, alle Bedingungen erfüllt | Status Freigegeben, Zeitpunkt gespeichert, „geändert seit Freigabe“ entfernt, Banner „Kanal-Inhalt freigegeben“ | Button deaktiviert; Klick auf Hinweis springt zur ersten verletzten Bedingung; bei Rechtstext „rechtlich ungeprüft“ zuerst UI-022 | bleibt; Angebot „Weiter zum Kopier-Assistenten“ (Link) |
| Titel manuell anpassen | Link | – | Titel editierbar | – | bleibt |
| Beschreibung manuell anpassen | Link | – | Beschreibung editierbar | – | bleibt |
| Manuelle Anpassung verwerfen | Link nach Anpassung | – | Text wird neu gebildet | – | bleibt |
| Kategorie übernehmen / verwerfen | Button | – | Kategorie gesetzt, „Kategorie manuell“ | Feldfehler | bleibt |
| Kanäle vergleichen | Link | – | – | – | UI-017 |

## Zustände
| Zustand | Darstellung | Artefakt | Text |
|---|---|---|---|
| default (Entwurf, eine Bedingung verletzt) | siehe Mockup | default.png | – |
| default (alle Bedingungen erfüllt) | Primärbutton aktiv | nur Text | „Alle Freigabebedingungen erfüllt“ |
| default (Freigegeben/Veröffentlicht/Beendet) | Nur lesen, Button „Kopier-Assistent“ statt „Freigeben“; bei „geändert seit Freigabe“ Link zu UI-018 | nur Text | |
| loading | Platzhalter | nur Text | „Lade Kanal-Inhalt …“ |
| empty | n/a | – | – |
| error | Banner | nur Text | „Kanal-Inhalt konnte nicht geladen/freigegeben werden. Referenz: <Nr>“ |
| validation | Feldfehler; Fehlerbanner bei abgelehnter Freigabe | Mockup (Kategorie fehlt) | siehe oben |
| success | Banner | nur Text | „Kanal-Inhalt freigegeben“ |
| disabled | Freigeben deaktiviert bei verletzter Bedingung oder Status ≠ Entwurf | default.png | Tooltip nennt Grund |
| permission | n/a | – | – |

## Responsive und Barrierefreiheit
Zwei Spalten (Inhalt 8/12, Bedingungen 4/12), Bedingungen bleiben beim Scrollen sichtbar. Tab-Reihenfolge: Tabs → Felder → Bedingungen → Freigeben.

## Bekannte Abweichungen im Mockup
„Business Portal“ (Stitch); Beispiel „Titel gekürzt, bitte prüfen“ bei 62/65 Zeichen (nach Regel erscheint der Chip nur bei Kürzung am Wortende, Beispiel nur zur Illustration); Platzhalter „Kategorie des Kanals eingeben“ im Eingabefeld; „Übernehmen“-Button heißt in Wirklichkeit „Kategorie übernehmen“; Preis-Link „Preis ändern“ fehlt im Mockup; Sticky-Leiste mit nur einem Button ist maßgeblich.

## Annahmen und offene Fragen
- Annahme: Nach Freigabe wird kein automatischer Seitenwechsel durchgeführt, nur Link zum Kopier-Assistenten.
