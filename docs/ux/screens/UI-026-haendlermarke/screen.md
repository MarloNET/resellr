# UI-026 – Händlermarke

- Zweck: Name der Händlermarke, Logo und Kontaktangaben pflegen.
- Flows: FLOW-05 · Anforderungen: REQ-028, REQ-074 · Rollen: Nutzer · Gerät(e): PC · Artefakte: nur Text

## Angezeigte Daten
Name, Logo-Vorschau (oder „Kein Logo“), Kontaktangaben. Hinweis: „Das Logo erscheint auf dem Datenblatt. Die Druckqualität stellt der Händler sicher.“

## Eingaben und Validierung
| Feld | Typ | Pflicht | Regel | Fehlermeldung |
|---|---|---|---|---|
| Name der Händlermarke | Text | ja | max. 100 Zeichen | „Name: 1 bis 100 Zeichen“ |
| Logo | Datei | für das Datenblatt | PNG oder JPEG, ≤ 5 MB; ersetzt das bisherige | „Logo: nur PNG oder JPEG bis 5 MB“ |
| Kontaktangaben | Mehrzeilentext | nein | max. 500 Zeichen; als `{Händler-Kontakt}` verfügbar | „Kontaktangaben: höchstens 500 Zeichen“ |

## Aktionen
| Aktion | Auslöser | Voraussetzung | Ergebnis bei Erfolg | Ergebnis bei Fehler | Navigation danach |
|---|---|---|---|---|---|
| Speichern | Primärbutton | gültig | Banner „Händlermarke gespeichert“ | Feldfehler | bleibt |
| Logo ersetzen/entfernen | Buttons | – | Vorschau aktualisiert | Dateifehler | bleibt |

## Zustände
| Zustand | Darstellung | Artefakt | Text |
|---|---|---|---|
| default | Formular | nur Text | – |
| empty | kein Logo | nur Text | „Kein Logo. Ohne Logo kann kein Datenblatt erzeugt werden.“ |
| loading, error, validation, success | wie üblich | nur Text | error: „Händlermarke konnte nicht gespeichert werden. Referenz: <Nr>“ |
| disabled, permission | n/a | – | – |

## Responsive und Barrierefreiheit
Ab 1366 px.

## Bekannte Abweichungen im Mockup
keine (kein Mockup).

## Annahmen und offene Fragen
- notebookers.de wird als Einstellung erfasst, nicht ausgeliefert (REQ-074).
