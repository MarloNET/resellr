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
| Zeile hinzufügen/ändern/entfernen, Speichern | Buttons | gültig | gespeichert; Hinweis „n Kanal-Inhalte betroffen“ (Kap. 6.0) | Zellenfehler | bleibt |

## Zustände
| Zustand | Darstellung | Artefakt | Text |
|---|---|---|---|
| default | wie oben | nur Text | – |
| loading | Platzhalter | nur Text | „Lade Einstellungen …“ |
| empty | Hinweistext mittig im Listenbereich, darunter Button „Zuordnung anlegen“ (Primärbutton) | nur Text | „Für diesen Kanal gibt es noch keine Zustandszuordnung. Ohne Zuordnung zeigt der Kanal-Inhalt „Zustandszuordnung fehlt“.“ |
| error | Banner | nur Text | „Einstellungen konnten nicht gespeichert werden. Referenz: <Nr>“ |
| validation | Feldfehler | nur Text | siehe Eingaben |
| success | Banner | nur Text | „Gespeichert“ |
| disabled | Speichern deaktiviert ohne Änderung | nur Text | |

## Fenstergröße und Bedienung
Ab 1366 px; Einstellungs-Liste (240 px) links, Inhalt rechts; Tastaturalternativen zum Ziehen.

## Bekannte Abweichungen im Mockup
keine (kein Mockup; Muster siehe uiux-design.md Kap. 5).

## Annahmen und offene Fragen
keine.
