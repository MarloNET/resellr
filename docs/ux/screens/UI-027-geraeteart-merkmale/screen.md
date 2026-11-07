# UI-027 – Gerätearten und Merkmale

- Zweck: Gerätearten anlegen/ändern/deaktivieren und ihre Merkmale (Datentyp, Ebene, Variantenkennzeichen, Pflicht, Datenblatt-Block) pflegen.
- Flows: FLOW-05
- Anforderungen: REQ-004, REQ-005, REQ-006, REQ-076; AC zu REQ-004/005
- Rollen: Nutzer
- Gerät(e): PC, ab 1366 × 768
- Artefakte: default.png (Stitch 81e728c27f964e70b2e78954255f0725, DESKTOP, 06.11.2026)

## Angezeigte Daten
| Element | Inhalt | Quelle | Hinweise |
|---|---|---|---|
| Einstellungs-Liste | 14 Bereiche (Händlermarke, Gerätearten und Merkmale, Auswahllisten, Titelmuster, Textbausteine, Hersteller und GPSR, Lieferanten, Code-Übersetzung, Zustandszuordnung, Kategoriezuordnung, Merkmalszuordnung, Beschreibungsvorlagen, Kanäle und Preisregeln, Datenblatt-Layout; „Zugangspasswort“ entfällt in Release 0.1, OD-02 Variante A) | Kap. 9.5 | zweite Navigationsspalte, 240 px |
| Geräteart-Liste | Name, Status „aktiv“/„deaktiviert“ | REQ-004 | |
| Merkmal-Tabelle | Reihenfolge, Bezeichnung, Datentyp, Einheit, Ebene (Modell/Gerät), variantenbildend (Ja/Nein/–), Pflicht, Datenblatt-Block, Status | REQ-005 | Reihenfolge per Ziehen oder Buttons „nach oben/unten“ |
| Merkmal-Formular | Seitenpanel „Merkmal bearbeiten“ | | |

## Eingaben und Validierung
| Feld | Typ | Pflicht | Regel | Fehlermeldung |
|---|---|---|---|---|
| Geräteart: Name | Text | ja | 1–50 Zeichen, eindeutig ohne Groß-/Kleinschreibung | „Name ist bereits vergeben“ / „Name: 1 bis 50 Zeichen“ |
| Geräteart: Status | Umschalter | ja | aktiv/deaktiviert | – |
| Merkmal: Bezeichnung | Text | ja | eindeutig je Geräteart | „Bezeichnung ist bei dieser Geräteart bereits vergeben“ |
| Datentyp | Auswahl | ja | Text, Ganzzahl, Dezimalzahl, Ja/Nein, Auswahl aus Liste, Mehrfachangabe Anzahl × Typ | – |
| Einheit, Schreibweise | Text, Auswahl | nein | Schreibweise „mit/ohne Leerzeichen“ | – |
| Mindest-/Höchstwert | Zahl | nein | nur bei Zahlen; Min ≤ Max | „Mindestwert darf nicht größer als Höchstwert sein“ |
| Auswahlliste | Auswahl | ja bei Datentyp „Auswahl aus Liste“ | Liste aus UI-028 | „Auswahlliste fehlt“ |
| Ebene | Auswahl | ja | Modell/Gerät; nach gespeicherten Werten gesperrt | „Ebene kann nicht geändert werden, weil bereits Werte gespeichert sind.“ (Datentyp analog: „Datentyp kann nicht geändert werden, weil bereits Werte gespeichert sind.“) |
| Variantenbildend | Kontrollkästchen | ja bei Ebene Gerät | Akkukapazität immer „Nein“; Änderung wird abgelehnt, wenn danach zwei Modell-Inserate derselben Modellvorlage übereinstimmen | „Änderung nicht möglich: Modell-Inserate <Liste> würden gleiche Variantenangaben haben“ |
| Pflichtmerkmal | Kontrollkästchen | ja | | – |
| Datenblatt-Block | Auswahl | ja | Identifikation, Zustand, Lieferumfang, Technik, Anschlüsse, Software | – |

## Aktionen
| Aktion | Auslöser | Voraussetzung | Ergebnis bei Erfolg | Ergebnis bei Fehler | Navigation danach |
|---|---|---|---|---|---|
| Geräteart anlegen | Button | – | neue Geräteart, Name-Eingabe | Feldfehler | bleibt, neue Geräteart markiert |
| Geräteart speichern | Primärbutton im Kopf | gültig | Banner „Geräteart gespeichert“ | Feldfehler | bleibt |
| Merkmal anlegen/ändern | Button / Zeilenklick | – | Seitenpanel öffnet | – | bleibt |
| Merkmal speichern | Primärbutton im Panel | gültig | Zeile aktualisiert, Banner „Merkmal gespeichert“ | Feldfehler | Panel schließt |
| Merkmal deaktivieren | Zeilenaktion | – | Status „deaktiviert“, Werte bleiben | – | bleibt |
| Geräteart löschen | nicht vorhanden | – | Geräteart mit Modellvorlagen kann nur deaktiviert werden | – | – |

## Zustände
| Zustand | Darstellung | Artefakt | Text |
|---|---|---|---|
| default | wie Mockup | default.png | – |
| loading | Platzhalter | nur Text | „Lade Gerätearten …“ |
| empty (Geräteart ohne Merkmale) | | nur Text | „Noch keine Merkmale. Legen Sie das erste Merkmal an.“ |
| `UI-027.speichert` (wird gespeichert) | Speicherknopf und alle Eingaben gesperrt bis zur Antwort, Anzeige „Speichern …“, **kein festes Timeout** (Muster P-08); bei Verbindungsverlust „Ausgang unbekannt, bitte neu laden“ | nur Text | „Speichern …“ |
| error | Banner | nur Text | „Einstellungen konnten nicht gespeichert werden. Referenz: <Nr>“ |
| validation | Feldfehler | Mockup (Ebene) | siehe Eingaben |
| success | Banner | nur Text | „Merkmal gespeichert“ |
| disabled | Ebene/Datentyp gesperrt bei gespeicherten Werten | default.png | |

## Fenstergröße und Bedienung
Drei Bereiche (Geräteart-Liste, Merkmal-Tabelle, Seitenpanel) ab 1366 px; Seitenpanel überlagert bei schmaler Breite die Tabelle. Hoch/Runter-Buttons als Tastaturalternative zum Ziehen.

## Bekannte Abweichungen im Mockup
„Business Portal“ (Stitch); Stitch ergänzt Kopfzähler und Statuschips „aktiv“ (aus Requirements ableitbar, übernommen); Untertitel „Konfiguration“ in der zweiten Navigation (nicht Teil des Designs); Panel zeigt „RAM“ auf Ebene Gerät als Beispiel; Hinweistext der Sperrung als Fehlerbox (maßgeblich: Inline am Feld).

## Annahmen und offene Fragen
- Annahme: Startbelegung (Kap. 9.3) steht bei Auslieferung bereit (REQ-006) und wird hier unverändert bearbeitet.
