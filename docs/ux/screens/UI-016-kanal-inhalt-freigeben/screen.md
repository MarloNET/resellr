# UI-016 – Kanal-Inhalt prüfen und freigeben

- Zweck: Kanal-Inhalt (Titel, Beschreibung, Kategorie, Zustand, Preis, Merkmale, GPSR) prüfen, ggf. anpassen und freigeben.
- Flows: FLOW-01 (Schritt 6), FLOW-04 (Schritt 3)
- Anforderungen: REQ-034–044, REQ-045, REQ-086, REQ-087, REQ-043, REQ-053, REQ-059 (Could); AC-REQ-044-01 bis -03, AC-REQ-045-01, AC-REQ-089-02
- Rollen: Nutzer
- Gerät(e): PC, ab 1366 × 768
- Artefakte: default.png (Stitch d7ec8b5e63924f6e8bfb298d11121f62, DESKTOP, 06.11.2026; ersetzt Stand a88484966822498492facf1aab70cf6d, der mit der Spezifikation kollidierte)

## Angezeigte Daten
| Element | Inhalt | Quelle | Hinweise |
|---|---|---|---|
| Kopf | ungekürzter Titel des Modell-Inserats, „Stückzahl n · WI-Nr …“ | Bestandsangaben | |
| Kanal-Tabs | je aktivem Kanal Name + Status-Chip | Kanal-Inhalt | Wechsel ohne Datenverlust |
| Titel | Text, Zeichenzähler „n / Höchstlänge Zeichen“, ggf. Chip „Titel gekürzt, bitte prüfen“, „manuell angepasst“, „Daten geändert, manuell angepassten Text prüfen“ | REQ-034/035/043 | |
| Preis | Betrag, „VB“ wenn gesetzt | REQ-032 | nur lesen, Änderung in UI-014 (Link „Preis ändern“) |
| Kategorie | Kategorie, Chip „Kategorie manuell“ oder „Kategorie fehlt“ | REQ-038/086 | |
| Zustand | Zustandsbezeichnung, Zusatzangabe, bei fehlender Zuordnung „Zustandszuordnung fehlt“ | REQ-039 | |
| Beschreibung | Text mit Zeilenumbrüchen, nur lesen, Chip „manuell angepasst“ | REQ-036 | |
| Merkmalsfelder | Tabelle Feldbezeichnung → Wert, leere Werte „leer“ | REQ-037 | Reihenfolge der Merkmalszuordnung |
| GPSR | Herstellerangaben, Produktidentifikation; fehlend: „GPSR-Herstellerangaben fehlen“ mit Link zu UI-031 | REQ-041 | |
| Fotos | „n Fotos zugeordnet“ | REQ-042 | |
| Freigabebedingungen | Liste mit Status als Text („OK“/„nicht erfüllt“): Preis, Kategorie, Zustandsbezeichnung, GPSR, Titellänge, Pflichtfelder des Kanals | REQ-044 | Nach abgelehnter Freigabe nennt das Fehlerbanner jede verletzte Bedingung (siehe Aktion „Freigeben“) |
| Vergleich mit freigegebenem Stand | nur bei Status Entwurf mit Kennzeichnung „geändert seit Freigabe“ (zuvor Freigegeben): Banner „Dieser Kanal-Inhalt war freigegeben und wurde durch Änderungen wieder zum Entwurf. Der bisher freigegebene Stand bleibt zum Vergleich sichtbar.“ mit Link „Alt und neu vergleichen“ | REQ-045, AC-REQ-045-01 | Vergleich in UI-018 (Zustand `UI-018.entwurf-vergleich`) |
| Kategorie-Warnung (Could) | Hinweis „Kategorie <Name> gehört in der Kategoriezuordnung dieses Kanals zur Geräteart <Art>, nicht zu <diese Geräteart>“, nur wenn die gewählte Kategorie einer anderen Geräteart zugeordnet ist | REQ-059 | Warnung, keine Sperre; Freigabe bleibt möglich |

## Eingaben und Validierung
| Feld | Typ | Pflicht | Regel | Fehlermeldung |
|---|---|---|---|---|
| Kategorie (überschreiben) | Text | nein | 1–255 Zeichen; „Verwerfen“ stellt Vorschlag wieder her | „Kategorie: 1 bis 255 Zeichen“ |
| Titel (manuell) | Text | nein | höchstens Höchstlänge des Kanals | „Titel zu lang: höchstens <n> Zeichen“ |
| Beschreibung (manuell) | Mehrzeilentext | nein | Bestandsplatzhalter bleiben als Platzhalter erhalten | „Unbekannter Platzhalter {…}“ |

## Aktionen
| Aktion | Auslöser | Voraussetzung | Ergebnis bei Erfolg | Ergebnis bei Fehler | Navigation danach |
|---|---|---|---|---|---|
| Freigeben | Primärbutton (immer aktiv bei Status Entwurf) | Status Entwurf | Alle Bedingungen erfüllt: Status Freigegeben, Zeitpunkt gespeichert, „geändert seit Freigabe“ entfernt, Banner „Kanal-Inhalt freigegeben“ | Freigabe wird abgelehnt: Fehlerbanner „Freigabe nicht möglich:“ mit Liste **aller** verletzten Bedingungen (z. B. „Preis fehlt“, „Kategorie fehlt“, Pflichtfeld „Farbe“ leer); jeder Listeneintrag ist ein Link, der zum betroffenen Feld springt; Status bleibt Entwurf. Bei Rechtstext „rechtlich ungeprüft“ zuerst Dialog UI-022 (REQ-087) | bleibt; Angebot „Weiter zum Kopier-Assistenten“ (Link) |
| Titel manuell anpassen | Link | – | Titel editierbar | – | bleibt |
| Beschreibung manuell anpassen | Link | – | Beschreibung editierbar | – | bleibt |
| Manuelle Anpassung verwerfen | Link nach Anpassung | – | Text wird neu gebildet | – | bleibt |
| Kategorie übernehmen / verwerfen | Button | – | Kategorie gesetzt, „Kategorie manuell“ | Feldfehler | bleibt |
| Alt und neu vergleichen | Link im Banner (nur bei „geändert seit Freigabe“) | Entwurf mit Kennzeichnung | – | – | UI-018 |
| Kanäle vergleichen | Link | – | – | – | UI-017 |

## Zustände
| Zustand | Darstellung | Artefakt | Text |
|---|---|---|---|
| default (Entwurf, Bedingungen verletzt; im Mockup zwei) | siehe Mockup | default.png | – |
| default (alle Bedingungen erfüllt) | Primärbutton aktiv | nur Text | „Alle Freigabebedingungen erfüllt“ |
| default (Entwurf, geändert seit Freigabe) | wie default, zusätzlich Vergleichsbanner und Kennzeichnung „geändert seit Freigabe“ im Tab | nur Text (`UI-016.geaendert`) | Text siehe „Vergleich mit freigegebenem Stand“ |
| default (Freigegeben/Veröffentlicht/Beendet) | Nur lesen, Button „Kopier-Assistent“ statt „Freigeben“; bei „geändert seit Freigabe“ Link zu UI-018 | nur Text | |
| loading | Platzhalter | nur Text | „Lade Kanal-Inhalt …“ |
| empty | n/a | – | – |
| error | Banner | nur Text | „Kanal-Inhalt konnte nicht geladen/freigegeben werden. Referenz: <Nr>“ |
| validation | Feldfehler; Fehlerbanner mit Liste aller verletzten Bedingungen bei abgelehnter Freigabe | Mockup (Kategorie fehlt, Pflichtfeld „Farbe“ leer: zwei Einträge) | „Freigabe nicht möglich:“ + Liste |
| success | Banner | nur Text | „Kanal-Inhalt freigegeben“ |
| disabled | „Freigeben“ ist bei verletzten Bedingungen **nicht** deaktiviert (Ablehnung mit Begründung, REQ-044); bei Status ≠ Entwurf wird der Button durch „Kopier-Assistent“ ersetzt | nur Text | – |

## Fenstergröße und Bedienung
Zwei Spalten (Inhalt 8/12, Bedingungen 4/12), Bedingungen bleiben beim Scrollen sichtbar. Tab-Reihenfolge: Tabs → Felder → Bedingungen → Freigeben.

## Bekannte Abweichungen im Mockup
**Titelzähler (Widerspruch im Mockup):** Der Titel im Mockup hat etwa 71 Zeichen, der Zähler zeigt „62 / 65“, und die Bedingung „Titel nicht länger als 65 Zeichen“ steht auf „OK“. Das ist ein Fehler von Stitch und nicht Teil des Designs. Maßgeblich: Bei mehr als 65 Zeichen steht der Zähler auf Überschreitung, die Bedingung auf „nicht erfüllt“ und der Titel erscheint im Fehlerbanner bei Freigabe. Das Mockup ist für den Titel nicht als Beispiel für ein erfülltes Limit zu lesen. **Anzahl Fehler:** Das Mockup zeigt zwei verletzte Bedingungen (Kategorie, Pflichtfeld „Farbe“); die Zustandstabelle nennt sie als Beispiel. Das Mockup zeigt „Freigeben“ aktiv und das Fehlerbanner mit Liste und Links (Stand nach Korrektur). Abweichungen: Titel ohne Chip „Titel gekürzt, bitte prüfen“ (Beispiel bei 62/65 Zeichen, Chip erscheint nur bei Kürzung); die Bedingung „Pflichtfelder des Kanals gefüllt“ steht auf „nicht erfüllt“ (im Fehlerbanner als „Pflichtfeld „Farbe“ ist leer“ benannt); der Eintrag „Preis fehlt“ wird nicht gezeigt (Preis ist vorhanden). Die GPSR-Karte liegt hinter der Sticky-Leiste und ist im Mockup nicht sichtbar; die Fotos-Karte steht außerhalb des Bildschirmrahmens. Das Eingabefeld „Kategorie“ ist leer ohne Platzhalter. Navigationsuntertitel „Business Portal“ entfällt in diesem Mockup. Kennzeichnung „VB“ ist als Kontrollkästchen dargestellt.

## Annahmen und offene Fragen
- Annahme: Nach Freigabe wird kein automatischer Seitenwechsel durchgeführt, nur Link zum Kopier-Assistenten.
- Entscheidung (Review R1, Punkt 4): „Freigeben“ bleibt aktiv; Ablehnung nennt jede verletzte Bedingung (AC-REQ-044-02/-03).
