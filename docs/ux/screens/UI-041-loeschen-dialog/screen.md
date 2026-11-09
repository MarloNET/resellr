# UI-041 – Löschen bestätigen (Dialog)

- Zweck: Modell-Inserat oder Modellvorlage nach ausdrücklicher Bestätigung löschen (Geräte werden nie gelöscht).
- Flows: FLOW-08 · Anforderungen: REQ-095 (Should), REQ-103, REQ-072 · Rollen: Nutzer · Gerät(e): PC · Artefakte: default.png (Stitch 33551ce25df94a83bdeb5a0ca4ecbe78, DESKTOP, 06.11.2026)

## Angezeigte Daten
Objekt (Titel/Modellvorlage), Wirkung: „Mit dem Modell-Inserat werden seine Kanal-Inhalte gelöscht.“ Bei Ablehnungsgrund statt Bestätigung der Grund.

**Ablehnungsgrund Modellvorlage mit Modell-Inserat (v0.6.2, O-8, M-29):** Der Grund steht als Banner im Dialog (flag-warn, ohne „×“, ohne Referenznummer), Wortlaut exakt, ohne Schlusspunkt: „Löschen nicht möglich: Modellvorlage wird von ein oder mehreren Inseraten genutzt“. Der Dialog zeigt dann statt der Bestätigung nur diesen Grund; „Löschen“ ist deaktiviert, „Abbrechen“ bleibt. Der frühere Vorschlag „Modell-Inserate verweisen auf die Modellvorlage.“ entfällt. Der Grund bei verweisenden Geräten bleibt „Löschen nicht möglich: … Geräte verweisen auf die Modellvorlage“ (unverändert). Liefert die Specification mehrere Gründe zugleich (Geräte und Modell-Inserate), zeigt der Dialog den einen Grund, den sie meldet.

## Eingaben und Validierung
| Feld | Typ | Pflicht | Regel | Fehlermeldung |
|---|---|---|---|---|
| Bestätigung | Kontrollkästchen „Ich möchte <Objekt> endgültig löschen“ | ja | | – |

## Aktionen
| Aktion | Auslöser | Voraussetzung | Ergebnis bei Erfolg | Ergebnis bei Fehler | Navigation danach |
|---|---|---|---|---|---|
| Löschen | destruktiver Button | Bestätigung gesetzt; Modell-Inserat: kein verfügbares/verkauftes Gerät zugeordnet und kein Kanal-Inhalt „Veröffentlicht“; Modellvorlage: kein Gerät (jeder Status) und kein Modell-Inserat | gelöscht, protokolliert, Banner „<Objekt> gelöscht“ | Ablehnung mit Grund: „Löschen nicht möglich: Dem Modell-Inserat sind noch Geräte zugeordnet“ / „… ein Kanal-Inhalt ist veröffentlicht“ / „… Geräte verweisen auf die Modellvorlage“ / „Löschen nicht möglich: Modellvorlage wird von ein oder mehreren Inseraten genutzt“ (v0.6.2, O-8) | UI-002 bzw. UI-006 |
| Abbrechen | Button, Esc | – | – | – | Aufrufseite |

## Zustände
| Zustand | Darstellung | Artefakt | Text |
|---|---|---|---|
| default | Bestätigung | nur Text | – |
| disabled | „Löschen“ deaktiviert ohne Häkchen oder bei Ablehnungsgrund (v0.6.2: auch bei Modell-Inserat an der Modellvorlage, Banner siehe oben) | nur Text | „Löschen nicht möglich: Modellvorlage wird von ein oder mehreren Inseraten genutzt“ |
| error | Banner | nur Text | „Löschen fehlgeschlagen. Referenz: <Nr>“ |
| loading, empty, validation, success | n/a | – | – |
| ausgang-unbekannt (K-6) | Schreibende Aktion ohne Antwort (Verbindungsverlust): Aktion bleibt bis zum Neuladen der Seite gesperrt, Banner „Ausgang unbekannt, bitte neu laden“ (Muster P-08, uiux-design.md Kap. 5), Eingaben bleiben sichtbar, **kein „Erneut versuchen“**; es wird nicht von „noch nicht gespeichert“ ausgegangen. Ablehnung „resellr wird beendet“: P-07 (nicht gespeichert) | nur Text | „Ausgang unbekannt, bitte neu laden.“ |

## Fenstergröße und Bedienung
Fenster frei in der Größe, Untergrenze 1366 px (REQ-077); Dialogbreite 480 px (bei schmalerem Fenster Fensterbreite abzüglich 16 px Rand), Dialoghöhe nie größer als die Fensterhöhe (Titel und Aktionsleiste bleiben sichtbar, der Inhalt scrollt), Esc schließt, Enter löst die Primäraktion aus.

## Bekannte Abweichungen im Mockup
Der Hintergrund ist nur abgedunkelt (kein Seitenabbild). Sonst keine Abweichung.

## Annahmen und offene Fragen
keine.
