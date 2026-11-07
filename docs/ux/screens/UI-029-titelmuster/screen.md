# UI-029 – Titelmuster

- Zweck: Titelmuster je Geräteart (optional je Kanal) aus Bestandteilen mit Präfix, Suffix und Kürzungspriorität definieren und mit Vorschau prüfen.
- Flows: FLOW-05
- Anforderungen: REQ-030, REQ-034, REQ-035; Kap. 9.7
- Rollen: Nutzer
- Gerät(e): PC, Fenster frei in der Größe, Untergrenze 1366 × 768 (REQ-077)
- Artefakte: default.png (Stitch 877d32da24214ae9970d9047237ec7d6, DESKTOP, 06.11.2026)

## Angezeigte Daten
| Element | Inhalt | Quelle | Hinweise |
|---|---|---|---|
| Auswahl | Geräteart, „Gilt für“ (Alle Kanäle oder ein Kanal) | | |
| Bestandteil-Tabelle | Nr, Bestandteil (Platzhalter-Chip oder fester Text), Präfix, Suffix, Kürzungspriorität, Entfernen | REQ-030 | Reihenfolge per Ziehen oder Buttons |
| Hilfszeile | „Kürzungspriorität 1 entfällt nie. Höhere Zahlen entfallen zuerst.“ | REQ-035 | |
| Vorschau | je aktivem Kanal Titel am gewählten Beispiel-Modell **nach Kürzung**, Zähler „n / Höchstlänge“, Hinweis „Titel gekürzt, bitte prüfen“, wenn selbst Priorität-1-Bestandteile zu lang | REQ-035 | |

## Eingaben und Validierung
| Feld | Typ | Pflicht | Regel | Fehlermeldung |
|---|---|---|---|---|
| Platzhalter | Auswahl nach Gruppen (Modelldaten, Inseratswerte; ohne Bestand, Kanal, Händler, Zusammenstellungen) | ja | muss Hersteller und Modellbezeichnung enthalten, beide Priorität 1 | „Das Titelmuster muss {Hersteller} und {Modellbezeichnung} mit Kürzungspriorität 1 enthalten“ |
| Fester Text | Text | ja bei Festtext-Bestandteil | 1–100 Zeichen | „Fester Text: 1 bis 100 Zeichen“ (v0.6, M-19) |
| Präfix, Suffix | Text | nein | je 0–50 Zeichen; Leerzeichen erlaubt, werden sichtbar als „␣“ | „Präfix: höchstens 50 Zeichen“; „Suffix: höchstens 50 Zeichen“ (v0.6, M-17/M-18) |
| Kürzungspriorität | Ganzzahl ≥ 1 | ja | | „Kürzungspriorität: ganze Zahl ab 1“ |
| Platzhalter-Gültigkeit | – | – | Bestandsplatzhalter und unbekannte Platzhalter unzulässig | „Platzhalter {Stückzahl} ist im Titelmuster nicht zulässig.“ |

## Aktionen
| Aktion | Auslöser | Voraussetzung | Ergebnis bei Erfolg | Ergebnis bei Fehler | Navigation danach |
|---|---|---|---|---|---|
| Platzhalter einfügen | Button (Auswahl nach Gruppen) | – | Zeile hinzugefügt | – | bleibt |
| Festen Text einfügen | Button | – | Zeile hinzugefügt | – | bleibt |
| Entfernen | Zeilenaktion | – | Zeile entfernt; Vorschau aktualisiert | – | bleibt |
| Titelmuster speichern | Primärbutton | gültig | Banner „Titelmuster gespeichert“; wirkt nach Kap. 6.0 auf Kanal-Inhalte; vor dem Speichern nur die Angabe „gilt für n Kanal-Inhalte im Geltungsbereich“ mit Bestätigung (Ä-32, keine Gruppenzahlen); nach dem Speichern nur das Banner, kein UI-043 (REQ-053 verlangt die Gruppenmeldung nur nach Textbausteinen und GPSR-Herstellerangaben) | Fehlerbox, Speichern abgelehnt | bleibt |
| Verwerfen | Sekundärbutton | – | Änderungen verworfen | – | bleibt |

## Zustände
| Zustand | Darstellung | Artefakt | Text |
|---|---|---|---|
| default | wie Mockup | default.png | – |
| loading | Platzhalter | nur Text | „Lade Titelmuster …“ |
| empty | keine Bestandteile | nur Text | „Noch kein Titelmuster. Fügen Sie einen Platzhalter ein.“ |
| `UI-029.speichert` (wird gespeichert) | Speicherknopf und alle Eingaben gesperrt bis zur Antwort, Anzeige „Speichern …“, **kein festes Timeout** (Muster P-08); bei Verbindungsverlust „Ausgang unbekannt, bitte neu laden“ | nur Text | „Speichern …“ |
| error | Banner | nur Text | „Titelmuster konnte nicht gespeichert werden. Referenz: <Nr>“ |
| validation | Fehlerbox oben, Zeile markiert | Mockup | siehe Eingaben |
| success | Banner | nur Text | „Titelmuster gespeichert“ |
| disabled | „Titelmuster speichern“ deaktiviert ohne Änderung | nur Text | |

## Fenstergröße und Bedienung
Tabelle und Vorschau untereinander; Vorschau nach jeder Änderung neu berechnet (kurz verzögert).

## Bekannte Abweichungen im Mockup
„Business Portal“ (Stitch); Seiten-ID „UI-029“ und Untertitel „Regelbasierte Zusammensetzung und automatische Zeichenkürzung für Verkaufsplattformen“ (von Stitch, entfällt); Vorschau Kleinanzeigen zeigt „72 / 65“ in Rot mit „zu lang …“ — nach Regel kürzt das System; maßgeblich: gekürzter Titel ≤ Höchstlänge, Chip „Titel gekürzt, bitte prüfen“ nur bei Kürzung am Wortende; das Mockup illustriert nur eine Fehlerdarstellung.

## Annahmen und offene Fragen
- Annahme: Die Vorschau berechnet Titel aus einem wählbaren existierenden Modell-Inserat der Geräteart.
