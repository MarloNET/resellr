# UI-004 – Modell-Inserat wählen (Dialog)

- Zweck: Geprüftes Gerät einem bestehenden Modell-Inserat derselben Modellvorlage zuordnen oder ein neues Modell-Inserat anlegen.
- Flows: FLOW-01 (Schritt 4), FLOW-02 (Schritt 3)
- Anforderungen: REQ-017, REQ-018, REQ-019, REQ-020
- Rollen: Nutzer · Gerät(e): PC
- Artefakte: nur Text

## Angezeigte Daten
| Element | Inhalt | Quelle | Hinweise |
|---|---|---|---|
| Gerät | WI-Nr, Modellvorlage | Gerät | |
| Liste Modell-Inserate | je Modell-Inserat der Modellvorlage: Titel, Variantenangaben (Zustand, Optik-Note, Zustandsbeschreibung, Variantenmerkmale), aktuelle Stückzahl | Modell-Inserat | Auswahl per Optionsfeld |
| Leere Liste | „Für diese Modellvorlage gibt es noch kein Modell-Inserat.“ | REQ-017 | nur Neuanlage |

## Eingaben und Validierung
| Feld | Typ | Pflicht | Regel | Fehlermeldung |
|---|---|---|---|---|
| Modell-Inserat | Optionsfeld | ja für „Zuordnen“ | nur Modell-Inserate derselben Modellvorlage | „Bitte ein Modell-Inserat wählen“ |
| Artikelnummer (nur Neuanlage, nur wenn WI-Nr schon Artikelnummer eines anderen Modell-Inserats ist) | Text | ja | 1–30 Zeichen, Buchstaben, Ziffern, „-“, eindeutig | „Artikelnummer bereits vergeben“ |

## Aktionen
| Aktion | Auslöser | Voraussetzung | Ergebnis bei Erfolg | Ergebnis bei Fehler | Navigation danach |
|---|---|---|---|---|---|
| Zuordnen | Primärbutton | Modell-Inserat gewählt, Gerät geprüft | ohne Abweichung: Stückzahl +1, Banner „Gerät <WI-Nr> zugeordnet (Stückzahl n)“; mit Abweichung zuerst UI-005 | „Erst Werte prüfen“ mit Nennung der markierten Werte; „Gerät gehört zu anderer Modellvorlage“; „Gerät ist bereits einem Modell-Inserat zugeordnet“ (v0.6, M-01) | Banner in UI-003, Formular für nächstes Gerät; bei veröffentlichtem Kanal Hinweis „Bestand auf Kanal anpassen“ mit Link UI-021 |
| Neues Modell-Inserat anlegen | Sekundärbutton | Variantenangaben unterscheiden sich von allen bestehenden | Modell-Inserat mit Stückzahl 1, Kanal-Inhalte im Status Entwurf | „Gleiche Variantenangaben wie Modell-Inserat <Titel>; bitte dort zuordnen“ | UI-014 |
| Abbrechen | Button, Esc | – | Gerät bleibt nicht zugeordnet | – | UI-003 |

## Zustände
| Zustand | Darstellung | Artefakt | Text |
|---|---|---|---|
| default | Liste | nur Text | – |
| loading | Platzhalter | nur Text | „Lade Modell-Inserate …“ |
| empty | siehe oben | nur Text | |
| error | Banner im Dialog | nur Text | „Zuordnung fehlgeschlagen. Referenz: <Nr>“ |
| validation | Feldfehler | nur Text | |
| success | Banner in UI-003 | nur Text | |
| disabled | „Zuordnen“ deaktiviert ohne Auswahl | nur Text | |
| ausgang-unbekannt (K-6) | Schreibende Aktion ohne Antwort (Verbindungsverlust): Aktion bleibt bis zum Neuladen der Seite gesperrt, Banner „Ausgang unbekannt, bitte neu laden“ (Muster P-08, uiux-design.md Kap. 5), Eingaben bleiben sichtbar, **kein „Erneut versuchen“**; es wird nicht von „noch nicht gespeichert“ ausgegangen. Ablehnung „resellr wird beendet“: P-07 (nicht gespeichert) | nur Text | „Ausgang unbekannt, bitte neu laden.“ |

## Fenstergröße und Bedienung
Dialogbreite 720 px; Pfeiltasten wählen Optionsfeld; Enter = Zuordnen.

## Bekannte Abweichungen im Mockup
keine (kein Mockup).

## Annahmen und offene Fragen
- Umbuchen (REQ-020, Should) öffnet denselben Dialog aus UI-010 mit Titel „Gerät umbuchen“.
