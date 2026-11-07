# UI-014 – Modell-Inserat

- Zweck: Arbeitsbereich eines Modell-Inserats: Kanäle, Preise, Inseratswerte, Fotos, Geräte.
- Flows: FLOW-01 (Schritt 4–6), FLOW-06, FLOW-09
- Anforderungen: REQ-019, REQ-032, REQ-033, REQ-088, REQ-091, REQ-095, REQ-045, REQ-046, REQ-089, REQ-090, REQ-057 (Could)
- Rollen: Nutzer
- Gerät(e): PC, Fenster frei in der Größe, Untergrenze 1366 × 768 (REQ-077)
- Artefakte: default.png (Stitch 1b01b1d0b1084415a8e4d917ff94cde6, DESKTOP, 06.11.2026)

## Angezeigte Daten
| Element | Inhalt | Quelle | Hinweise |
|---|---|---|---|
| Kopf | ungekürzter Titel; „Geräteart · Stückzahl n · Artikelnummer <Nr>“ | Modell-Inserat | |
| Kanal-Karte (je aktivem Kanal) | Kanalname, Status-Chip, Kennzeichnungen (Kap. 9.4, darunter „manuell angepasst“ nach einer gespeicherten Anpassung aus UI-016), „Abgleich <Datum>“, Preis (ggf. „VB“), vorgeschlagener Preis als Hinweis „Vorschlag nach Preisregel“ | Kanal-Inhalt, Preise | Aktionen je Zustand siehe „Aktionen“ |
| Inseratswerte | Zustand, Optik-Note, Zustandsbeschreibung, übrige inserierte Gerätewerte, Lieferumfang, Artikelnummer, EAN („Original (Nr)“ oder „eigene (Nr)“) | Modell-Inserat | Modelldaten nicht hier, Hinweis auf UI-007 |
| Fotos | Anzahl, nummerierte Vorschaubilder in Reihenfolge | REQ-042 | |
| Geräte | WI-Nr, Bestandsstatus (verfügbar/verkauft(Kanal, Datum)/storniert), Akkukapazität, Erfassungsdatum | Geräte | storniert nur mit Filter „auch stornierte“ |

## Eingaben und Validierung
| Feld | Typ | Pflicht | Regel | Fehlermeldung |
|---|---|---|---|---|
| Preis je Kanal | Dezimalzahl in € | zur Freigabe | > 0, höchstens 2 Nachkommastellen; Dezimalkomma | „Preis: Zahl größer 0 mit höchstens zwei Nachkommastellen“ |
| VB | Kontrollkästchen | nein | nur wo Kanal es zulässt (REQ-029), sonst nicht angezeigt | – |
| Inseratswerte bearbeiten | Formular (Dialog-Seite „Inseratswerte bearbeiten“, Felder wie UI-003, plus Lieferumfang, Artikelnummer, EAN-Kennzeichnung/eigene EAN) | je Merkmal | Variantenangaben müssen sich von anderen Modell-Inseraten derselben Modellvorlage unterscheiden (REQ-088); Artikelnummer 1–30 Zeichen, Buchstaben/Ziffern/„-“, eindeutig; EAN 8/13 Ziffern mit Prüfziffer | „Variantenangaben stimmen mit Modell-Inserat <Titel> überein“; „Artikelnummer bereits vergeben“; „EAN: 8 oder 13 Ziffern mit gültiger Prüfziffer“ |

## Aktionen
| Aktion | Auslöser | Voraussetzung | Ergebnis bei Erfolg | Ergebnis bei Fehler | Navigation danach |
|---|---|---|---|---|---|
| Preis speichern | Verlassen/Enter im Preisfeld | Preis gültig | gespeichert; wirkt nach Kap. 6.0 auf Kanal-Inhalt (Entwurf: neu gebildet; Freigegeben: → Entwurf mit Kennzeichnung; Veröffentlicht/Beendet: Änderungsentwurf) | Feldfehler | bleibt |
| Prüfen und freigeben | Primärbutton (nur bei Status Entwurf; Primärbutton nur einmal je Seite: bei mehreren Entwürfen am ersten) | – | – | – | UI-016 (Kanal) |
| Änderungsentwurf prüfen | Button bei „geändert seit Freigabe“ (Veröffentlicht/Beendet) | – | – | – | UI-018 |
| Kopier-Assistent | Button bei Freigegeben/Veröffentlicht/Beendet | – | – | – | UI-019 |
| Als veröffentlicht melden | Button bei Freigegeben | – | – | – | UI-020 |
| Abgleich bestätigen | Textlink bei „Bestand auf Kanal anpassen“/„Änderung auf Kanal übertragen“ | Status Veröffentlicht | – | – | UI-021 |
| Kanäle vergleichen | Link | – | – | – | UI-017 |
| Bearbeiten (Inseratswerte) | Sekundärbutton | – | – | – | Bearbeitungsansicht (Teil von UI-014, Zustand `UI-014.edit`) |
| Fotos verwalten | Sekundärbutton | – | – | – | UI-015 |
| Datenblatt | Sekundärbutton (je Gerät über UI-010); hier: Auswahl des Geräts in Dialog „Datenblatt für Gerät“ | Gerät geprüft, zugeordnet | – | Hinweise nach REQ-050 | UI-023 |
| Änderung trotzdem speichern | Primärbutton im Bestätigungsdialog `UI-014.abweichung-bestaetigen` (erscheint beim Speichern der Inseratswerte, wenn zugeordnete verfügbare Geräte danach abweichen, REQ-088) | Variantenangaben geändert, Abweichung vorhanden | Inseratswerte gespeichert; Bestätigung mit Zeitpunkt und abweichenden Angaben protokolliert (REQ-072); Kanal-Inhalte nach Kap. 6.0 neu gebildet bzw. gekennzeichnet; Banner „Inseratswerte gespeichert“ | Fehlerbanner „Speichern nicht möglich. Referenz: <Nr>“, Dialog bleibt, nichts gespeichert | UI-014 |
| Speichern abbrechen | Sekundärbutton, Esc im Dialog | – | Nichts gespeichert, Formular behält Eingaben | – | UI-014 (Bearbeiten) |
| Importdatei erzeugen (Could, REQ-057) | Sekundärbutton in der Shop-Kanal-Karte | Shop-Kanal-Inhalt Status Freigegeben, Veröffentlicht oder Beendet | Datei wird heruntergeladen (Format laut Architecture Baseline), Banner „Importdatei erzeugt“ | Banner „Importdatei konnte nicht erzeugt werden. Referenz: <Nr>“ | bleibt |
| Gerät öffnen | Link in Zeile | – | – | – | UI-010 |
| Löschen | Textbutton (destruktiv) | – | Bestätigung | – | UI-041 |

## Zustände
| Zustand | Darstellung | Artefakt | Text |
|---|---|---|---|
| default | wie Mockup | default.png | – |
| loading | Platzhalterblöcke | nur Text | „Lade Modell-Inserat …“ |
| empty | n/a; Fotos leer: „Noch keine Fotos“ + Button „Fotos verwalten“; Lieferumfang leer: „–“ | nur Text | |
| `abweichung-bestaetigen` | Modaler Dialog, Breite 800 px. Titel „Zugeordnete Geräte weichen ab“. Text: „Nach dieser Änderung weichen <n> zugeordnete Geräte vom Modell-Inserat ab:“. Tabelle: WI-Nr, Merkmal, „Gerät <Wert>, Modell-Inserat <Wert>“ (z. B. „Optik-Note: Gerät 2, Modell-Inserat 3“). Hinweis: „Die Bestätigung wird im Änderungsprotokoll festgehalten.“ Buttons „Änderung trotzdem speichern“ (primär), „Abbrechen“ | nur Text | siehe links (REQ-088, AC-REQ-088-03) |
| Shop-Karte ohne Freigabe (Could) | „Importdatei erzeugen“ deaktiviert | nur Text | Tooltip „Erst Shop-Kanal-Inhalt freigeben“ |
| `UI-014.speichert` (wird gespeichert) | Speicherknopf und alle Eingaben gesperrt bis zur Antwort, Anzeige „Speichern …“, **kein festes Timeout** (Muster P-08); bei Verbindungsverlust „Ausgang unbekannt, bitte neu laden“ | nur Text | „Speichern …“ |
| error | Banner | nur Text | „Das Modell-Inserat konnte nicht geladen/gespeichert werden. Referenz: <Nr>“ |
| validation | Feldfehler | nur Text | siehe Eingaben |
| success | Banner | nur Text | „Preis gespeichert“ u. a. |
| disabled | „Datenblatt“-Auswahl deaktiviert, wenn kein Gerät geprüft/zugeordnet: Tooltip „Gerät noch zu prüfen“ | nur Text | |

## Fenstergröße und Bedienung
Drei Kanal-Karten gleich breit ab Fensterbreite 1366 px. Höhe frei: Kopfaktionen und Aktionsleiste bleiben sichtbar, der Inhalt scrollt; der Dialog `abweichung-bestaetigen` (Breite 800 px, bei schmalerem Fenster Fensterbreite abzüglich 16 px) ist nie höher als das Fenster, Titel und Aktionen bleiben sichtbar, die Tabelle scrollt. Tab-Reihenfolge: Kopfaktionen → Kanal-Karten → Inseratswerte → Fotos → Geräte.

## Bekannte Abweichungen im Mockup
„Business Portal“ (Stitch); Lieferumfang-Beispiel „Netzteil, Handbuch“ entspricht Textbausteinen, nur Beispiel; kleine Status-Pille „verfügbar“ in grün (Farbe nicht in DESIGN.md definiert, Text maßgeblich); Hinweis „Vorschlag nach Preisregel“ nicht im Mockup.

## Annahmen und offene Fragen
- Design-Annahme, keine Anforderung: Gerätewahl per Dialog für das Datenblatt und Hinweis „Vorschlag nach Preisregel“ (vom Product Owner bestätigt).
- Annahme: Ein Primärbutton je Seite (nur bei Status Entwurf), sonst keiner.
- „Datenblatt“ im Kopf wählt, wenn mehrere Geräte vorhanden sind, per Dialog das Gerät (Datenblatt ist je Gerät, REQ-050). Per Product Owner bestätigt, zusätzlich zu UI-010.
