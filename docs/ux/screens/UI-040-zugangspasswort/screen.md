# UI-040 – Zugangspasswort ändern

- Zweck: Im Netzbetrieb das Zugangspasswort ändern. Nur im Netzbetrieb vorhanden.
- Flows: FLOW-07 · Anforderungen: REQ-097, REQ-067 [v0.3.1: andere Zugänge enden]; AC-REQ-097-01 bis -05 · Rollen: Nutzer · Gerät(e): PC · Artefakte: nur Text

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
| loading, empty, disabled, permission | n/a (Screen existiert nur im Netzbetrieb) | – | – |

## Responsive und Barrierefreiheit
Karte 480 px; Anzeige-Umschalter „Anzeigen“ je Feld.

## Bekannte Abweichungen im Mockup
keine (kein Mockup).

## Annahmen und offene Fragen
- Vergessenes Passwort: nur über den Betreiber, kein Screen (E-5).
