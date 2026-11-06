# UI-022 – Ungeprüften Rechtstext bestätigen (Dialog)

- Zweck: Freigabe eines Kanal-Inhalts mit Textbaustein „rechtlich ungeprüft“ ausdrücklich bestätigen.
- Flows: FLOW-01, FLOW-06 · Anforderungen: REQ-087, REQ-054, REQ-072 · Rollen: Nutzer · Gerät(e): PC · Artefakte: nur Text

## Angezeigte Daten
Namen der enthaltenen Textbausteine mit Prüfstatus „rechtlich ungeprüft“ (Liste, je mit Link zu UI-030).

## Eingaben und Validierung
Keine.

## Aktionen
| Aktion | Auslöser | Voraussetzung | Ergebnis bei Erfolg | Ergebnis bei Fehler | Navigation danach |
|---|---|---|---|---|---|
| Ungeprüfter Rechtstext enthalten – trotzdem freigeben | Primärbutton (Beschriftung wörtlich) | – | Freigabe ausgeführt, Bestätigung mit Zeitpunkt protokolliert | – | Aufrufseite (UI-016 oder UI-018) |
| Abbrechen | Button, Esc | – | Kanal-Inhalt unverändert | – | Aufrufseite |

## Zustände
| Zustand | Darstellung | Artefakt | Text |
|---|---|---|---|
| default | Liste | nur Text | – |
| error | Banner | nur Text | „Freigabe fehlgeschlagen. Referenz: <Nr>“ |
| loading, empty, validation, success, disabled, permission | n/a | – | – |

## Responsive und Barrierefreiheit
Ab 1366 px; Dialogbreite 480 px, Esc schließt, Enter löst die Primäraktion aus.

## Bekannte Abweichungen im Mockup
keine (kein Mockup).

## Annahmen und offene Fragen
keine.
