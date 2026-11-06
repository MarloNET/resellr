# UI-018 – Änderungsentwurf prüfen

- Zweck: Freigegebenen Stand und Änderungsentwurf eines Kanal-Inhalts vergleichen und den Entwurf freigeben.
- Flows: FLOW-04, FLOW-06 (Schritt 3)
- Anforderungen: REQ-045, REQ-089, REQ-087, REQ-044; AC-REQ-089-01 bis -03, AC-REQ-046-04
- Rollen: Nutzer
- Gerät(e): PC, ab 1366 × 768
- Artefakte: default.png (Stitch fd8edac267244e5cb1582dda6b85f654, DESKTOP, 06.11.2026)

## Angezeigte Daten
| Element | Inhalt | Quelle | Hinweise |
|---|---|---|---|
| Kopf | „Kanal · Titel“, Status-Chip, Chip „geändert seit Freigabe“ | Kanal-Inhalt | |
| Spalte links | „Freigegebener Stand (gilt auf dem Kanal)“, Freigabedatum | freigegebener Stand | |
| Spalte rechts | „Neuer Stand (Änderungsentwurf)“ | Änderungsentwurf | |
| Vergleichszeilen | je geändertem Feld (Titel, Preis, Kategorie, Zustandsbezeichnung, Beschreibung, Merkmalsfelder, GPSR-Angaben): Feldname, Chip „geändert“, Werte links/rechts, geänderte Textstellen hinterlegt (#FEF3C7) | Differenz der Stände | Bestandsangaben (Stückzahl, WI-Nr, Akkukapazität) werden nicht als Änderung gezeigt (REQ-045) |
| Unveränderte Felder | Link „n unveränderte Felder anzeigen“ | | klappt Liste auf |
| Hinweis | „Bis zur Freigabe zeigen Kopier-Assistent und Inserat-Übersicht den freigegebenen Stand.“ | REQ-045 | |

## Eingaben und Validierung
Keine Eingabefelder. Freigabebedingungen wie REQ-044 werden bei „Änderungsentwurf freigeben“ geprüft.

## Aktionen
| Aktion | Auslöser | Voraussetzung | Ergebnis bei Erfolg | Ergebnis bei Fehler | Navigation danach |
|---|---|---|---|---|---|
| Änderungsentwurf freigeben | Primärbutton | alle Freigabebedingungen erfüllt; bei ungeprüftem Rechtstext zuerst UI-022 | Entwurf wird freigegebener Stand, „geändert seit Freigabe“ entfällt, bei Veröffentlicht „Änderung auf Kanal übertragen“ gesetzt, Banner „Änderungsentwurf freigegeben“ | Fehlerbanner mit verletzter Bedingung (z. B. „Kategorie fehlt“), freigegebener Stand bleibt maßgeblich | UI-014; Angebot „Zum Kopier-Assistenten“ |
| Zum Kanal-Inhalt bearbeiten | Sekundärbutton | – | – | – | UI-016 |
| Unveränderte Felder anzeigen | Link | – | Liste eingeblendet | – | bleibt |

## Zustände
| Zustand | Darstellung | Artefakt | Text |
|---|---|---|---|
| default | wie Mockup | default.png | – |
| loading | Platzhalter | nur Text | „Lade Änderungsentwurf …“ |
| empty | kein Änderungsentwurf vorhanden | nur Text | „Kein Änderungsentwurf vorhanden“ + Link zurück |
| error | Banner | nur Text | „Änderungsentwurf konnte nicht freigegeben werden. Referenz: <Nr>“ |
| validation | Fehlerbanner bei verletzter Freigabebedingung | nur Text | „Freigabe nicht möglich: Kategorie fehlt“ |
| success | Banner | nur Text | „Änderungsentwurf freigegeben“ |
| disabled | Primärbutton deaktiviert, wenn kein Entwurf | nur Text | |
| permission | n/a | – | – |

## Responsive und Barrierefreiheit
Zwei gleich breite Spalten; lange Texte brechen um (kein Abschneiden). Beschreibung zeigt Zeilen unverändert; geänderte Zeilen ganz hinterlegt.

## Bekannte Abweichungen im Mockup
„Business Portal“ (Stitch); Diff-Hervorhebung im Titel markiert „512 GB Space Gray“ statt nur „Space Gray“ (Wortgenauigkeit, maßgeblich: nur geänderte Wörter); Chip-Kontrast kleiner Pillen; Beispieltitel in Zeile 1 weicht vom Titelmuster ab (Beispieldaten).

## Annahmen und offene Fragen
- Annahme: Die Differenz wird feldweise gezeigt; die Granularität (Wort/Zeile) legt der Software Architect fest; Mindestanforderung: geänderte Felder sichtbar, bei Beschreibung geänderte Zeilen.
