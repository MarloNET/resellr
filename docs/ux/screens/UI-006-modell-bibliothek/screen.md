# UI-006 – Modell-Bibliothek

- Zweck: Modellvorlagen suchen und öffnen; Einstieg zum Anlegen.
- Flows: FLOW-01 (Schritt 1)
- Anforderungen: REQ-008, REQ-009
- Rollen: Nutzer · Gerät(e): PC
- Artefakte: nur Text

## Angezeigte Daten
Trefferliste: Geräteart, Hersteller, Modellbezeichnung, Typbezeichnung, Herstellernummer; Zähler „n Modellvorlagen“.

## Eingaben und Validierung
| Feld | Typ | Pflicht | Regel | Fehlermeldung |
|---|---|---|---|---|
| Suchbegriff | Text | nein | ab 2 Zeichen; Teilübereinstimmung, ohne Groß-/Kleinschreibung; sucht Hersteller, Modellbezeichnung, Typbezeichnung, Herstellernummer | Hinweis „Mindestens 2 Zeichen“ |
| Geräteart | Auswahl | nein | | – |

## Aktionen
| Aktion | Auslöser | Voraussetzung | Ergebnis bei Erfolg | Ergebnis bei Fehler | Navigation danach |
|---|---|---|---|---|---|
| Modellvorlage öffnen | Zeilenklick, Enter | – | – | – | UI-007 |
| Modellvorlage anlegen | Primärbutton | – | – | – | UI-007 (neu) |

## Zustände
| Zustand | Darstellung | Artefakt | Text |
|---|---|---|---|
| default | Suchfeld fokussiert, Liste der zuletzt angelegten (50) | nur Text | – |
| loading | Platzhalter | nur Text | „Suche …“ |
| empty (Treffer) | | nur Text | „Keine Modellvorlage gefunden“ + Button „Modellvorlage anlegen“ |
| empty (Bibliothek) | | nur Text | „Noch keine Modellvorlagen“ + Button „Modellvorlage anlegen“ |
| error | Banner | nur Text | „Suche fehlgeschlagen. Referenz: <Nr>“ |
| validation, success, disabled | n/a bzw. wie oben | – | – |

## Fenstergröße und Bedienung
Ab 1366 px; Pfeil auf/ab + Enter.

## Bekannte Abweichungen im Mockup
keine (kein Mockup).

## Annahmen und offene Fragen
- Annahme: Ohne Suchbegriff zeigt die Liste die zuletzt angelegten Modellvorlagen (nicht in Requirements; sonst Leerzustand „Suchbegriff eingeben“). Entscheidung PO.
