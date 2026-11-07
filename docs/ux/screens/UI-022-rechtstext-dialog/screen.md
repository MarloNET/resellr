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
| loading, empty, validation, success, disabled | n/a | – | – |
| ausgang-unbekannt (K-6) | Schreibende Aktion ohne Antwort (Verbindungsverlust): Aktion bleibt bis zum Neuladen der Seite gesperrt, Banner „Ausgang unbekannt, bitte neu laden“ (Muster P-08, uiux-design.md Kap. 5), Eingaben bleiben sichtbar, **kein „Erneut versuchen“**; es wird nicht von „noch nicht gespeichert“ ausgegangen. Ablehnung „resellr wird beendet“: P-07 (nicht gespeichert) | nur Text | „Ausgang unbekannt, bitte neu laden.“ |

## Fenstergröße und Bedienung
Fenster frei in der Größe, Untergrenze 1366 px (REQ-077); Dialogbreite 480 px (bei schmalerem Fenster Fensterbreite abzüglich 16 px Rand), Dialoghöhe nie größer als die Fensterhöhe (Titel und Aktionsleiste bleiben sichtbar, der Inhalt scrollt), Esc schließt, Enter löst die Primäraktion aus.

## Bekannte Abweichungen im Mockup
keine (kein Mockup).

## Annahmen und offene Fragen
keine.
