# UI-018 – Änderungsentwurf prüfen

- Zweck: Freigegebenen Stand und neuen Stand eines Kanal-Inhalts vergleichen und freigeben. Gilt für zwei Fälle: (a) Änderungsentwurf bei Veröffentlicht/Beendet (REQ-089), (b) Entwurf mit „geändert seit Freigabe“, der zuvor Freigegeben war (REQ-045, AC-REQ-045-01).
- Flows: FLOW-04, FLOW-06 (Schritt 3)
- Anforderungen: REQ-045, REQ-089, REQ-087, REQ-044; AC-REQ-089-01 bis -03, AC-REQ-046-04
- Rollen: Nutzer
- Gerät(e): PC, Fenster ab 1366 × 768 (nutzbar etwa 1350 × 630 px)
- Artefakte: default.png (Stitch fd8edac267244e5cb1582dda6b85f654, DESKTOP, 06.11.2026)

## Angezeigte Daten
| Element | Inhalt | Quelle | Hinweise |
|---|---|---|---|
| Kopf | „Kanal · Titel“, Status-Chip, Chip „geändert seit Freigabe“, Chip „manuell angepasst“, wenn der Änderungsentwurf aus einer manuellen Anpassung in UI-016 entstand (REQ-043; Einstieg über „Änderungsentwurf angelegt“) | Kanal-Inhalt | Fall (b): Status-Chip „Entwurf“ |
| Spalte links | „Freigegebener Stand (gilt auf dem Kanal)“, Freigabedatum | freigegebener Stand | |
| Spalte rechts | Fall (a): „Neuer Stand (Änderungsentwurf)“; Fall (b): „Neuer Stand (Entwurf)“ | Änderungsentwurf bzw. Entwurf | |
| Vergleichszeilen | je geändertem Feld (Titel, Preis, Kategorie, Zustandsbezeichnung, Beschreibung, Merkmalsfelder, GPSR-Angaben): Feldname, Chip „geändert“, Werte links/rechts, geänderte Textstellen hinterlegt (#FEF3C7) | Differenz der Stände | Bestandsangaben (Stückzahl, WI-Nr, Akkukapazität) werden nicht als Änderung gezeigt (REQ-045) |
| Unveränderte Felder | Link „n unveränderte Felder anzeigen“ | | klappt Liste auf |
| Hinweis | Fall (a): „Bis zur Freigabe zeigen Kopier-Assistent und Inserat-Übersicht den freigegebenen Stand.“ Fall (b): „Der Kanal-Inhalt ist wieder ein Entwurf und muss neu freigegeben werden.“ | REQ-045 | |

## Eingaben und Validierung
Keine Eingabefelder. Freigabebedingungen wie REQ-044 werden bei der Freigabe geprüft; der Button bleibt aktiv, eine Verletzung wird abgelehnt und jede verletzte Bedingung genannt.

## Aktionen
| Aktion | Auslöser | Voraussetzung | Ergebnis bei Erfolg | Ergebnis bei Fehler | Navigation danach |
|---|---|---|---|---|---|
| Änderungsentwurf freigeben (Fall a) bzw. Kanal-Inhalt freigeben (Fall b) | Primärbutton, immer aktiv | bei ungeprüftem Rechtstext zuerst UI-022 | Entwurf wird freigegebener Stand, „geändert seit Freigabe“ entfällt, bei Veröffentlicht „Änderung auf Kanal übertragen“ gesetzt, Banner „Änderungsentwurf freigegeben“; Fall (b): Status Freigegeben, Zeitpunkt gespeichert, Kennzeichnung entfällt, Banner „Kanal-Inhalt freigegeben“ | Ablehnung: Fehlerbanner „Freigabe nicht möglich:“ mit Liste **aller** verletzten Bedingungen; Fall (a): bisher freigegebener Stand bleibt maßgeblich | UI-014; Angebot „Zum Kopier-Assistenten“ |
| Zum Kanal-Inhalt bearbeiten | Sekundärbutton | – | – | – | UI-016 |
| Unveränderte Felder anzeigen | Link | – | Liste eingeblendet | – | bleibt |

## Zustände
| Zustand | Darstellung | Artefakt | Text |
|---|---|---|---|
| default (Fall a, Änderungsentwurf) | wie Mockup | default.png | – |
| `UI-018.entwurf-vergleich` (Fall b) | gleiches Layout; Spaltenköpfe „Freigegebener Stand (zuletzt freigegeben am <Datum>)“ und „Neuer Stand (Entwurf)“; Einstieg über UI-016 (Link „Alt und neu vergleichen“) | nur Text | s. o. |
| loading | Platzhalter | nur Text | „Lade Änderungsentwurf …“ |
| empty | kein Änderungsentwurf vorhanden | nur Text | „Kein Änderungsentwurf vorhanden“ + Link zurück |
| error | Banner | nur Text | „Änderungsentwurf konnte nicht freigegeben werden. Referenz: <Nr>“ |
| validation | Fehlerbanner mit Liste aller verletzten Bedingungen | nur Text | „Freigabe nicht möglich:“ + Liste, z. B. „Kategorie fehlt“, „Preis fehlt“ |
| success | Banner | nur Text | „Änderungsentwurf freigegeben“ |
| disabled | Primärbutton nur ohne vorhandenen Entwurf nicht verfügbar (Zustand empty); sonst aktiv | nur Text | |
| ausgang-unbekannt (K-6) | Schreibende Aktion ohne Antwort (Verbindungsverlust): Aktion bleibt bis zum Neuladen der Seite gesperrt, Banner „Ausgang unbekannt, bitte neu laden“ (Muster P-08, uiux-design.md Kap. 5), Eingaben bleiben sichtbar, **kein „Erneut versuchen“**; es wird nicht von „noch nicht gespeichert“ ausgegangen. Ablehnung „resellr wird beendet“: P-07 (nicht gespeichert) | nur Text | „Ausgang unbekannt, bitte neu laden.“ |

## Fenstergröße und Bedienung
Zwei gleich breite Spalten; lange Texte brechen um (kein Abschneiden). Beschreibung zeigt Zeilen unverändert; geänderte Zeilen ganz hinterlegt.

## Bekannte Abweichungen im Mockup
„Business Portal“ (Stitch); Diff-Hervorhebung im Titel markiert „512 GB Space Gray“ statt nur „Space Gray“ (Wortgenauigkeit, maßgeblich: nur geänderte Wörter); Chip-Kontrast kleiner Pillen; Beispieltitel in Zeile 1 weicht vom Titelmuster ab (Beispieldaten).

## Annahmen und offene Fragen
- Annahme: Die Differenz wird feldweise gezeigt; die Granularität (Wort/Zeile) legt der Software Architect fest; Mindestanforderung: geänderte Felder sichtbar, bei Beschreibung geänderte Zeilen.
