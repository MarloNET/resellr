# UI-021 – Abgleich bestätigen (Dialog)

- Zweck: Bestätigen, dass das Inserat auf dem Kanal dem freigegebenen Stand und den aktuellen Bestandsangaben entspricht.
- Flows: FLOW-02, 03, 04, 06 · Anforderungen: REQ-090, REQ-052, REQ-072; AC-REQ-090-01 bis -03; OP-30 (Standardannahme: bleibt) · Rollen: Nutzer · Gerät(e): PC · Artefakte: nur Text

## Angezeigte Daten
Kanal, Titel; Liste offener Kennzeichnungen: „Änderung auf Kanal übertragen“, „Bestand auf Kanal anpassen“ mit genannten geänderten Bestandsangaben (Stückzahl, WI-Nrn, Akkukapazität) und deren aktuellem Wert. Hinweis, wenn „geändert seit Freigabe“ besteht: „Der noch nicht freigegebene Änderungsentwurf bleibt unberührt.“

## Eingaben und Validierung
Keine (Bestätigung per Button).

## Aktionen
| Aktion | Auslöser | Voraussetzung | Ergebnis bei Erfolg | Ergebnis bei Fehler | Navigation danach |
|---|---|---|---|---|---|
| Abgleich bestätigen | Primärbutton | Status Veröffentlicht, mindestens eine der beiden Kennzeichnungen | Kennzeichnungen entfernt, Zeitpunkt gespeichert und in UI-002 angezeigt, Banner „Abgleich bestätigt“ | – | Aufrufseite |
| Abbrechen | Button, Esc | – | – | – | Aufrufseite |

## Zustände
| Zustand | Darstellung | Artefakt | Text |
|---|---|---|---|
| default | Liste | nur Text | – |
| empty | keine Kennzeichnung | nur Text | „Kanal ist abgeglichen“ (Dialog ohne Aktion, nur „Schließen“) |
| error | Banner | nur Text | „Abgleich konnte nicht gespeichert werden. Referenz: <Nr>“ |
| loading, validation, success, disabled, permission | n/a bzw. Banner | – | – |

## Responsive und Barrierefreiheit
Ab 1366 px; Dialogbreite 480 px, Esc schließt, Enter löst die Primäraktion aus.

## Bekannte Abweichungen im Mockup
keine (kein Mockup).

## Annahmen und offene Fragen
keine.
