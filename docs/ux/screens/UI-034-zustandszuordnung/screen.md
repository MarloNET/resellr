# UI-034 – Zustandszuordnung

- Zweck: Je Kanal festlegen, welche Zustandsbezeichnung (und Zusatzangabe) für Zustand und Optik-Note ausgegeben wird. · Flows: – · Anforderungen: REQ-023, REQ-039 · Rollen: Nutzer · Gerät(e): PC · Artefakte: nur Text (Muster P-02)

## Angezeigte Daten
Kanal-Auswahl; Tabelle: Zustand, Optik-Note (Zahl oder „alle Noten“), Zustandsbezeichnung des Kanals, Zusatzangabe (mit Platzhaltern).

## Eingaben und Validierung
| Feld | Typ | Pflicht | Regel | Fehlermeldung |
|---|---|---|---|---|
| Zustand, Optik-Note | Auswahl | ja | je Kanal/Zustand/Note höchstens ein Eintrag; einzelne Note hat Vorrang vor „alle Noten“ | „Für diese Kombination gibt es bereits einen Eintrag“ |
| Zustandsbezeichnung | Text | ja | max. 100 | „Zustandsbezeichnung: 1 bis 100 Zeichen“ |
| Zusatzangabe | Text | nein | max. 100; nur Platzhalter für Zusatzangaben (Kap. 9.7) | „Platzhalter {…} ist in der Zusatzangabe nicht zulässig“ |

## Aktionen
| Aktion | Auslöser | Voraussetzung | Ergebnis bei Erfolg | Ergebnis bei Fehler | Navigation danach |
|---|---|---|---|---|---|
| Zeile hinzufügen/ändern/entfernen, Speichern | Buttons | gültig | gespeichert (Zustand `UI-034.speichert` bis zur Antwort); vor dem Speichern „gilt für n Kanal-Inhalte im Geltungsbereich“ (Ä-32, keine Gruppenzahlen); danach nur das bisherige Banner „Gespeichert“, kein UI-043 (REQ-053 gilt nur für UI-030/UI-031) | Zellenfehler | bleibt |

## Zustände
| Zustand | Darstellung | Artefakt | Text |
|---|---|---|---|
| default | wie oben | nur Text | – |
| loading | Platzhalter | nur Text | „Lade Einstellungen …“ |
| empty | Hinweistext mittig im Listenbereich, darunter Button „Zuordnung anlegen“ (Primärbutton) | nur Text | „Für diesen Kanal gibt es noch keine Zustandszuordnung. Ohne Zuordnung zeigt der Kanal-Inhalt „Zustandszuordnung fehlt“.“ |
| `UI-034.speichert` (wird gespeichert) | Speicherknopf und alle Eingaben gesperrt bis zur Antwort, Anzeige „Speichern …“, **kein festes Timeout** (Muster P-08); bei Verbindungsverlust „Ausgang unbekannt, bitte neu laden“ | nur Text | „Speichern …“ |
| error | Banner | nur Text | „Einstellungen konnten nicht gespeichert werden. Referenz: <Nr>“ |
| validation | Feldfehler | nur Text | siehe Eingaben |
| success | Banner | nur Text | „Gespeichert“ |
| disabled | Speichern deaktiviert ohne Änderung | nur Text | |

## Fenstergröße und Bedienung
Fenster frei in der Größe, Untergrenze 1366 px (REQ-077); Einstellungs-Liste (240 px) links, Inhalt rechts (unter 1366 CSS-px: Liste über dem Inhalt, Regel R-1); Tastaturalternativen zum Ziehen.

## Bekannte Abweichungen im Mockup
keine (kein Mockup; Muster siehe uiux-design.md Kap. 5).

## Annahmen und offene Fragen
keine.
