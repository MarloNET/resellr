# UI-037 – Beschreibungsvorlagen

- Zweck: Je Kanal eine Beschreibungsvorlage aus Abschnitten definieren. · Flows: FLOW-05 · Anforderungen: REQ-031, REQ-036, Kap. 9.7, 9.12 · Rollen: Nutzer · Gerät(e): PC · Artefakte: nur Text (Mockup geplant; Muster P-03)

## Angezeigte Daten
Kanal-Auswahl; Abschnittsliste: optionale Überschrift, Inhaltselemente (fester Text, Platzhalter-Chips, Textbaustein, „alle Textbausteine der Art …“), Geltung (alle oder bestimmte Gerätearten); **Vorschau** rechts: Beschreibung am gewählten Beispiel-Modell-Inserat mit Zeilenumbrüchen; entfallende Zeilen/Abschnitte (leere Platzhalter) sind in der Vorschau erkennbar.

## Eingaben und Validierung
| Feld | Typ | Pflicht | Regel | Fehlermeldung |
|---|---|---|---|---|
| Überschrift | Text | nein | | – |
| Inhalt | Zeilen aus Text und Platzhaltern | ja | alle Platzhalter zulässig; Zeile mit nur leeren Platzhaltern entfällt samt festem Text; Abschnitt mit nur leeren Platzhaltern/Bausteinen entfällt samt Überschrift | „Unbekannter Platzhalter {…}“ |
| Textbaustein-Element | Auswahl | nein | aktive Textbausteine | – |
| Geltung | Mehrfachauswahl | nein | | – |

## Aktionen
| Aktion | Auslöser | Voraussetzung | Ergebnis bei Erfolg | Ergebnis bei Fehler | Navigation danach |
|---|---|---|---|---|---|
| Abschnitt hinzufügen/entfernen/verschieben | Buttons | – | Vorschau aktualisiert | – | bleibt |
| Speichern | Primärbutton | gültig | Banner; Hinweis „n Kanal-Inhalte betroffen“ | Fehler am Platzhalter | bleibt |

## Zustände
| Zustand | Darstellung | Artefakt | Text |
|---|---|---|---|
| default | wie oben | nur Text | – |
| loading | Platzhalter | nur Text | „Lade Einstellungen …“ |
| empty | Hinweistext mittig im Listenbereich, darunter Button „Abschnitt hinzufügen“ (Primärbutton) | nur Text | „Für diesen Kanal gibt es noch keine Beschreibungsvorlage“ |
| error | Banner | nur Text | „Einstellungen konnten nicht gespeichert werden. Referenz: <Nr>“ |
| validation | Feldfehler | nur Text | siehe Eingaben |
| success | Banner | nur Text | „Gespeichert“ |
| disabled | Speichern deaktiviert ohne Änderung | nur Text | |

## Fenstergröße und Bedienung
Ab 1366 px; Einstellungs-Liste (240 px) links, Inhalt rechts; Tastaturalternativen zum Ziehen.

## Bekannte Abweichungen im Mockup
keine (kein Mockup; Muster siehe uiux-design.md Kap. 5).

## Annahmen und offene Fragen
- Überschriften und Zeilen der Startbelegung sind [Vorschlag BA] und werden mit dem Pilotkunden abgestimmt.
