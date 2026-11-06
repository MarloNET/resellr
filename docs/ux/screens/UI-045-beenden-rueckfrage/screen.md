# UI-045 – „resellr beenden“: Rückfrage, Warten, Fehler (Dialog)

- Zweck: Geordnetes Beenden von resellr nach Rückfrage auslösen; Warte- und Fehlerzustand.
- Flows: FLOW-10 · Anforderungen: REQ-105, REQ-073; AC-REQ-105-01, -02, -03; Baseline Kap. 6.1 (Aktion „resellr beenden“), Kap. 9.6 (Geordnetes Beenden), Ablauf 4a; Kap. 6.3 X-2
- Rollen: Nutzer · Gerät(e): PC (normal und schmal) · Artefakte: nur Text (Muster P-04); Wortlaut Rückfrage `[Vorschlag BA]` aus REQ-105
- Nur im Betrieb nur am Arbeitsplatzrechner (Variante A; bei Variante B nicht vorhanden, siehe Kap. „Variante B“ im Design).

## Angezeigte Daten
| Element | Inhalt | Quelle | Hinweise |
|---|---|---|---|
| Titel | „resellr beenden“ | REQ-105 | |
| Text | „resellr jetzt beenden? Nicht gespeicherte Eingaben gehen verloren. Danach können Sie den Datenordner kopieren.“ | REQ-105 | Wortlaut unverändert |
| Buttons | „Abbrechen“ (links), „resellr beenden“ (rechts, Primär, nicht destruktiv rot) | P-04 | Fokus beim Öffnen auf „Abbrechen“ (versehentliches Beenden vermeiden) |

## Eingaben und Validierung
Keine.

## Aktionen
| Aktion | Auslöser | Voraussetzung | Ergebnis bei Erfolg | Ergebnis bei Fehler | Navigation danach |
|---|---|---|---|---|---|
| Abbrechen | Button, Esc | Rückfrage offen, Beenden nicht gestartet | Dialog schließt; resellr läuft unverändert, nichts verändert (AC-REQ-105-02) | – | Aufrufseite |
| resellr beenden | Button, Enter | – | Wartezustand; nach Bestätigung des Servers Seitenwechsel auf Endzustand UI-046 `.success` | siehe Zustände `.error` und `.unknown` | UI-046 |

## Zustände
| Zustand | Darstellung | Artefakt | Text |
|---|---|---|---|
| default | Rückfrage | nur Text | siehe oben |
| loading | Dialog bleibt, Buttons deaktiviert, Esc und Klick außerhalb wirkungslos (Beenden lässt sich nicht zurücknehmen), Fortschrittsanzeige ohne Prozent; Dauer bis etwa 10 s | nur Text | „resellr wird beendet …“ |
| error | Der Server meldet, dass das Beenden nicht gelang: Dialog schließt, **Seite bleibt bedienbar, Hinweis bleibt sichtbar**, Banner oben im Inhaltsbereich nach REQ-073 mit Funktion, nächstem Schritt, Referenznummer, „×“ | nur Text | „resellr konnte nicht beendet werden. resellr läuft weiter. Bitte versuchen Sie es erneut. Besteht der Fehler weiter, informieren Sie den Betreiber mit der Referenznummer <Nr>.“ |
| unknown | Der Server antwortet nicht mehr (kein Ergebnis in 30 s oder Verbindung abgebrochen; Wert Vorschlag, Technical Specification legt ihn fest): Dialog wird ersetzt durch UI-046 `.unknown` | siehe UI-046 | siehe UI-046 |
| validation, empty, success, disabled | n/a (Erfolg = UI-046) | – | – |
| `.wird-beendet` (anderes Fenster) | siehe Muster P-07 | – | – |

## Fenstergröße und Bedienung
Modal, Breite 480 px, mittig; im schmalen Fenster (480 px) volle Breite abzüglich 16 px Rand. Enter bestätigt nur, wenn der Fokus auf „resellr beenden“ liegt.

## Annahmen und offene Fragen
- Dialogbuttons-Reihenfolge und Fokus auf „Abbrechen“: Design-Entscheidung, keine Anforderung.
- Fehlertext der Fehlerbanner: Funktion und nächster Schritt nach REQ-073 sind Designvorschlag, der REQ-Wortlaut der Rückfrage ist unverändert.
