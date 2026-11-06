# UI-005 – Abweichungen bei Zuordnung (Dialog)

- Zweck: Abweichungen der Variantenangaben zwischen Gerät und gewähltem Modell-Inserat zeigen und entscheiden.
- Flows: FLOW-02
- Anforderungen: REQ-018, REQ-014, REQ-020 (Should), REQ-072; AC-REQ-014-07, AC-REQ-020-01 bis -04
- Kontexte: **A** Zuordnen eines Geräts (aus UI-004, REQ-018); **B** Gerät ist bereits zugeordnet, eine Variantenangabe wurde geändert (aus UI-003/UI-010, REQ-014)
- Rollen: Nutzer · Gerät(e): PC
- Artefakte: default.png (Stitch 3e8680e117f941aa8112e320354fb2a7, DESKTOP, 06.11.2026)

## Angezeigte Daten
| Element | Inhalt | Quelle | Hinweise |
|---|---|---|---|
| Tabelle | je abweichender Variantenangabe: Merkmal, Wert am Gerät, Wert am Modell-Inserat | REQ-018 | nur Variantenmerkmale (Zustand, Optik-Note, Zustandsbeschreibung, Variantenmerkmale) |
| Zustandsbeschreibung | beide Texte vollständig, nebeneinander | REQ-018 | |
| Hinweis | „Das Gerät weicht vom Modell-Inserat ab.“ | | Zeilenformat z. B. „Optik-Note: Gerät 4, Modell-Inserat 2“ |

## Eingaben und Validierung
Keine.

## Aktionen
| Aktion | Auslöser | Voraussetzung | Ergebnis bei Erfolg | Ergebnis bei Fehler | Navigation danach |
|---|---|---|---|---|---|
| Trotzdem zuordnen | Primärbutton, nur Kontext A | – | Zuordnung, Inseratswerte unverändert, Protokolleintrag mit Zeitpunkt und abweichenden Angaben | Fehlerbanner | UI-003 |
| Zuordnung behalten | Primärbutton, nur Kontext B | Gerät bleibt dem Modell-Inserat zugeordnet | Zuordnung unverändert, Modell-Inserat unverändert, Protokolleintrag wie „trotzdem zuordnen“ (Zeitpunkt, abweichende Angaben) | Fehlerbanner „Speichern nicht möglich. Referenz: <Nr>“ | Ausgangsscreen (UI-003/UI-010) |
| Umbuchen (Should, REQ-020) | Sekundärbutton, Kontext B und Kontext A bei bereits zugeordnetem Gerät; öffnet im Dialog die Auswahl „Anderes Modell-Inserat derselben Modellvorlage“ (Liste: Titel, Variantenangaben, Stückzahl) und Button „Umbuchen“ | Gerät verfügbar und zugeordnet; mindestens ein anderes Modell-Inserat derselben Modellvorlage | Stückzahl des bisherigen Modell-Inserats −1, des neuen +1, Bestandsangaben beider aktualisiert (REQ-091), Banner „Gerät umgebucht“; bisheriges Modell-Inserat bleibt bei Stückzahl 0 bestehen | Verkauftes oder storniertes Gerät: Button nicht verfügbar, Hinweis „Ein verkauftes oder storniertes Gerät kann nicht umgebucht werden“; kein anderes Modell-Inserat: „Kein anderes Modell-Inserat dieser Modellvorlage“ | UI-014 des neuen Modell-Inserats |
| Neues Modell-Inserat anlegen | Sekundärbutton | Variantenangaben unterscheiden sich | wie UI-004 | Ablehnung wie UI-004 | UI-014 |
| Abbrechen | Button, Esc | – | zurück zu UI-004 | – | UI-004 |

## Zustände
| Zustand | Darstellung | Artefakt | Text |
|---|---|---|---|
| default | Abweichungstabelle | nur Text | – |
| loading/error | wie UI-004 | nur Text | |
| empty | n/a (Dialog erscheint nur bei Abweichung) | – | – |
| validation, success, disabled | n/a | – | – |

## Fenstergröße und Bedienung
Dialogbreite 800 px, lange Zustandsbeschreibung bricht um.

## Bekannte Abweichungen im Mockup
Dargestellt ist Kontext A (Zuordnen). Der Link „Umbuchen“ links im Fuß erscheint im Mockup als Textlink; maßgeblich ist `screen.md` (Sekundärbutton, nur bei bereits zugeordnetem Gerät, Kontext B). Wertangaben „4“ und „Gut“ am Gerät sind im Mockup als Kennzeichnung (warn) hervorgehoben; die Hervorhebung ist nicht verbindlich. Im Hintergrund erscheint eine abgedunkelte Skelett-Seite (von Stitch erzeugt, nicht Teil des Designs). Navigationsuntertitel entfällt.

## Annahmen und offene Fragen
- Kontext B (REQ-014) nutzt denselben Dialog mit den Aktionen „Zuordnung behalten“, „Neues Modell-Inserat anlegen“ und „Umbuchen“ (siehe Aktionen).
