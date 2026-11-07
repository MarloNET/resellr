# UI-040 – Zugangspasswort ändern

> **In Release 0.1 nicht umgesetzt (Owner, 07.11.2026, OD-02 Variante A: Betrieb nur am Arbeitsplatzrechner, kein Zugangspasswort; Baseline v0.3.2, ADR-002, Kap. 13.3.1).** Diese Beschreibung und das Mockup bleiben unverändert als Reserve für Variante B (Netzbetrieb, REQ-001, REQ-067, REQ-097) erhalten und sind nicht Teil des Umfangs von Release 0.1. Früherer Vermerk (06.11.2026, OP-23): Der Screen blieb zunächst im Design.

- Zweck: Im Netzbetrieb das Zugangspasswort ändern. Nur im Netzbetrieb vorhanden.
- Flows: FLOW-07 · Anforderungen: REQ-097, REQ-067 [v0.3.1: andere Zugänge enden]; AC-REQ-097-01 bis -05 · Rollen: Nutzer · Gerät(e): PC · Artefakte: success.png (Stitch c6973f04666c47f99c5a021d3ad2f9b0, DESKTOP, 06.11.2026)

## Angezeigte Daten
Felder und Hinweis „Mindestens 12 Zeichen.“ Nach Erfolg Banner „Zugangspasswort geändert“.

## Eingaben und Validierung
| Feld | Typ | Pflicht | Regel | Fehlermeldung |
|---|---|---|---|---|
| Bisheriges Zugangspasswort | Passwort | ja | muss stimmen | „Zugangspasswort falsch“ (keine Änderung) |
| Neues Zugangspasswort | Passwort | ja | ≥ 12 Zeichen, verschieden vom bisherigen | „Zugangspasswort: mindestens 12 Zeichen“; „Das neue Zugangspasswort muss sich vom bisherigen unterscheiden“ |
| Wiederholung | Passwort | ja | gleich dem neuen | „Die Wiederholung stimmt nicht überein“ |

## Aktionen
| Aktion | Auslöser | Voraussetzung | Ergebnis bei Erfolg | Ergebnis bei Fehler | Navigation danach |
|---|---|---|---|---|---|
| Zugangspasswort ändern | Primärbutton | gültig | neues Passwort gilt; dieser Zugang bleibt, alle anderen Zugänge enden (dort erscheint beim nächsten Aufruf UI-001) | Feldfehler | bleibt, Felder geleert |
| Abbrechen | Button | – | – | – | UI-025 |

## Zustände
| Zustand | Darstellung | Artefakt | Text |
|---|---|---|---|
| default, validation, success | wie oben | nur Text | |
| error | Banner | nur Text | „Zugangspasswort konnte nicht geändert werden. Referenz: <Nr>“ |
| loading, empty, disabled | n/a (Screen existiert nur im Netzbetrieb) | – | – |

## Fenstergröße und Bedienung
Karte 480 px; Anzeige-Umschalter „Anzeigen“ je Feld.

## Bekannte Abweichungen im Mockup
Gezeigt ist der Zustand success. Nach dem Speichern sind die Felder in `screen.md` leer; im Mockup stehen noch Punkte (Darstellung nur zur Illustration). Der Link „← Zurück zu Einstellungen“ ist grau statt blau.

## Annahmen und offene Fragen
- Vergessenes Passwort: nur über den Betreiber, kein Screen (E-5).
