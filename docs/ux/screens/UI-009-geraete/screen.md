# UI-009 – Geräte

- Zweck: Geräte per WI-Nr finden; Liste der nicht zugeordneten Geräte.
- Flows: FLOW-03 (Schritt 1) · Anforderungen: REQ-016, REQ-094 · Rollen: Nutzer · Gerät(e): PC · Artefakte: nur Text

## Angezeigte Daten
| Element | Inhalt | Quelle | Hinweise |
|---|---|---|---|
| Reiter „Suche“ | Trefferliste: WI-Nr, Modellvorlage, Modell-Inserat (Titel) oder „nicht zugeordnet“, Bestandsstatus (verfügbar, verkauft, storniert), Erfassungsstatus (geprüft, unvollständig geprüft) | Geräte | |
| Reiter „Nicht zugeordnet“ | WI-Nr, Modellvorlage, Erfassungsstatus, Erfassungsdatum, ältestes zuerst | REQ-094 | |

## Eingaben und Validierung
| Feld | Typ | Pflicht | Regel | Fehlermeldung |
|---|---|---|---|---|
| WI-Nr (Suche) | Text | nein | Teil der WI-Nr genügt | – |

## Aktionen
| Aktion | Auslöser | Voraussetzung | Ergebnis bei Erfolg | Ergebnis bei Fehler | Navigation danach |
|---|---|---|---|---|---|
| Gerät öffnen | Zeilenklick, Enter | – | – | – | UI-010 |
| Gerät einbuchen | Button | – | – | – | UI-003 |

## Zustände
| Zustand | Darstellung | Artefakt | Text |
|---|---|---|---|
| default | Fokus im Suchfeld | nur Text | – |
| loading | Platzhalter | nur Text | „Suche …“ |
| empty (Suche) | | nur Text | „Kein Gerät mit dieser WI-Nr“ |
| empty (nicht zugeordnet) | | nur Text | „Keine nicht zugeordneten Geräte“ |
| error | Banner | nur Text | „Suche fehlgeschlagen. Referenz: <Nr>“ |
| validation, success, disabled | n/a | – | – |

## Fenstergröße und Bedienung
Ab 1366 px; Enter öffnet die erste Zeile, wenn genau ein Treffer.

## Bekannte Abweichungen im Mockup
keine (kein Mockup).

## Annahmen und offene Fragen
- Annahme: Stornierte Geräte erscheinen in der Suche mit Status „storniert“ (REQ-016).
