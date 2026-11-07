# UI-025 – Einstellungen

- Zweck: Einstieg in die Einstellungen; zweite Navigationsspalte mit den Bereichen.
- Flows: FLOW-05 · Anforderungen: Kap. 9.5, REQ-074 · Rollen: Nutzer · Gerät(e): PC · Artefakte: Navigationsspalte gezeigt in UI-027/UI-029 (default.png)

## Angezeigte Daten
Liste mit 14 Bereichen (OD-02 Variante A, Release 0.1): Händlermarke (UI-026), Gerätearten und Merkmale (UI-027), Auswahllisten (UI-028), Titelmuster (UI-029), Textbausteine (UI-030), Hersteller und GPSR (UI-031), Lieferanten (UI-032), Code-Übersetzung (UI-033), Zustandszuordnung (UI-034), Kategoriezuordnung (UI-035), Merkmalszuordnung (UI-036), Beschreibungsvorlagen (UI-037), Kanäle und Preisregeln (UI-038), Datenblatt-Layout (UI-039). „Zugangspasswort“ (UI-040) erscheint in Release 0.1 nicht (nur bei Variante B, Netzbetrieb, wäre es ein 15. Bereich). Preisregeln (REQ-085) sind Teil von UI-038.

## Eingaben und Validierung
Keine.

## Aktionen
| Aktion | Auslöser | Voraussetzung | Ergebnis bei Erfolg | Ergebnis bei Fehler | Navigation danach |
|---|---|---|---|---|---|
| Bereich öffnen | Klick/Enter | – | – | – | UI-026 bis UI-039 |

## Zustände
default: Beim Aufruf von „Einstellungen“ wird der zuletzt genutzte Bereich geöffnet, beim ersten Mal „Händlermarke“. Alle anderen Zustände: n/a (reine Navigation).

## Fenstergröße und Bedienung
Pfeil auf/ab in der Liste, Enter öffnet.

## Bekannte Abweichungen im Mockup
Im Mockup zeigt Stitch die Überschrift „Konfiguration“ über der Liste (nicht Teil des Designs).

## Annahmen und offene Fragen
- Annahme: „Zuletzt genutzter Bereich“ als Einstieg (Komfort, keine Anforderung).
