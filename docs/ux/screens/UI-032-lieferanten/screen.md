# UI-032 – Lieferanten

- Zweck: Lieferanten pflegen. · Flows: – · Anforderungen: REQ-099 · Rollen: Nutzer · Gerät(e): PC · Artefakte: nur Text (Muster P-01)

## Angezeigte Daten
Liste: Name, Status. Leerzustand: „Noch keine Lieferanten“.

## Eingaben und Validierung
| Feld | Typ | Pflicht | Regel | Fehlermeldung |
|---|---|---|---|---|
| Name | Text | ja | 1–100 Zeichen, eindeutig ohne Groß-/Kleinschreibung | „Name ist bereits vergeben“ / „Name: 1 bis 100 Zeichen“ |
| Status | Umschalter | ja | | – |

## Aktionen
| Aktion | Auslöser | Voraussetzung | Ergebnis bei Erfolg | Ergebnis bei Fehler | Navigation danach |
|---|---|---|---|---|---|
| Lieferant anlegen/umbenennen/deaktivieren | Button, Zeilenaktion | – | gespeichert; Löschen nicht angeboten (Lieferanten mit Verweisen nur deaktivierbar) | Feldfehler | bleibt |

## Zustände
| Zustand | Darstellung | Artefakt | Text |
|---|---|---|---|
| default | wie oben | nur Text | – |
| loading | Platzhalter | nur Text | „Lade Einstellungen …“ |
| empty | Hinweistext mittig im Listenbereich, darunter Button „Lieferant anlegen“ (Primärbutton) | nur Text | „Noch keine Lieferanten“ |
| error | Banner | nur Text | „Einstellungen konnten nicht gespeichert werden. Referenz: <Nr>“ |
| validation | Feldfehler | nur Text | siehe Eingaben |
| success | Banner | nur Text | „Gespeichert“ |
| disabled | Speichern deaktiviert ohne Änderung | nur Text | |

## Fenstergröße und Bedienung
Fenster frei in der Größe, Untergrenze 1366 px (REQ-077); Einstellungs-Liste (240 px) links, Inhalt rechts (unter 1366 CSS-px: Liste über dem Inhalt, Regel R-1); Tastaturalternativen zum Ziehen.

## Bekannte Abweichungen im Mockup
keine (kein Mockup; Muster siehe uiux-design.md Kap. 5).

## Annahmen und offene Fragen
- OP-26: Lieferant als Auswahlliste (Startannahme) oder Freitext.
