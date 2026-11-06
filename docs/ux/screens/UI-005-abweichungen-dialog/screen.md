# UI-005 – Abweichungen bei Zuordnung (Dialog)

- Zweck: Abweichungen der Variantenangaben zwischen Gerät und gewähltem Modell-Inserat zeigen und entscheiden.
- Flows: FLOW-02
- Anforderungen: REQ-018, REQ-014, REQ-020, REQ-072
- Rollen: Nutzer · Gerät(e): PC
- Artefakte: nur Text (Mockup geplant)

## Angezeigte Daten
| Element | Inhalt | Quelle | Hinweise |
|---|---|---|---|
| Tabelle | je abweichender Variantenangabe: Merkmal, Wert am Gerät, Wert am Modell-Inserat | REQ-018 | nur Variantenmerkmale (Zustand, Optik-Note, Zustandsbeschreibung, Variantenmerkmale) |
| Zustandsbeschreibung | beide Texte vollständig, nebeneinander | REQ-018 | |
| Hinweis | „Das Gerät weicht vom Modell-Inserat ab.“ | | |

## Eingaben und Validierung
Keine.

## Aktionen
| Aktion | Auslöser | Voraussetzung | Ergebnis bei Erfolg | Ergebnis bei Fehler | Navigation danach |
|---|---|---|---|---|---|
| Trotzdem zuordnen | Primärbutton | – | Zuordnung, Inseratswerte unverändert, Protokolleintrag mit Zeitpunkt und abweichenden Angaben | Fehlerbanner | UI-003 |
| Neues Modell-Inserat anlegen | Sekundärbutton | Variantenangaben unterscheiden sich | wie UI-004 | Ablehnung wie UI-004 | UI-014 |
| Abbrechen | Button, Esc | – | zurück zu UI-004 | – | UI-004 |

## Zustände
| Zustand | Darstellung | Artefakt | Text |
|---|---|---|---|
| default | Abweichungstabelle | nur Text | – |
| loading/error | wie UI-004 | nur Text | |
| empty | n/a (Dialog erscheint nur bei Abweichung) | – | – |
| validation, success, disabled, permission | n/a | – | – |

## Responsive und Barrierefreiheit
Dialogbreite 800 px, lange Zustandsbeschreibung bricht um.

## Bekannte Abweichungen im Mockup
keine (kein Mockup).

## Annahmen und offene Fragen
- Gilt auch nach Änderung einer Variantenangabe eines zugeordneten Geräts (REQ-014): Auswahl „Zuordnung behalten“ (statt „trotzdem zuordnen“), „Neues Modell-Inserat anlegen“, „Umbuchen“.
