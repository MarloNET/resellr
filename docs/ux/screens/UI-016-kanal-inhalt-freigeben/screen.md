# UI-016 – Kanal-Inhalt prüfen und freigeben

- Zweck: Kanal-Inhalt (Titel, Beschreibung, Kategorie, Zustand, Preis, Merkmale, GPSR) prüfen, ggf. manuell anpassen (eigene Aktion „Anpassung speichern“, K-3) und freigeben.
- Flows: FLOW-01 (Schritt 6), FLOW-04 (Schritt 3)
- Anforderungen: REQ-034–044, REQ-045, REQ-086, REQ-087, REQ-043, REQ-053, REQ-059 (Could); AC-REQ-044-01 bis -03, AC-REQ-045-01, AC-REQ-089-02
- Rollen: Nutzer
- Gerät(e): PC, Fenster ab 1366 × 768 (nutzbar etwa 1350 × 630 px, Ä-28)
- Artefakte: default.png (Stitch d7ec8b5e63924f6e8bfb298d11121f62, DESKTOP, 06.11.2026; ersetzt Stand a88484966822498492facf1aab70cf6d, der mit der Spezifikation kollidierte)

## Angezeigte Daten
| Element | Inhalt | Quelle | Hinweise |
|---|---|---|---|
| Kopf | ungekürzter Titel des Modell-Inserats, „Stückzahl n · WI-Nr …“ | Bestandsangaben | |
| Kanal-Tabs | je aktivem Kanal Name + Status-Chip; bei ungespeicherter Anpassung zusätzlich die Marke „Anpassung nicht gespeichert“ (flag-warn, Text) | Kanal-Inhalt | Wechsel ohne Datenverlust und ohne Dialog (siehe „Ungespeicherte Anpassung“) |
| Titel | Text, Zeichenzähler „n / Höchstlänge Zeichen“, ggf. Chip „Titel gekürzt, bitte prüfen“, „manuell angepasst“, „Daten geändert, manuell angepassten Text prüfen“ | REQ-034/035/043 | |
| Preis | Betrag, „VB“ wenn gesetzt | REQ-032 | nur lesen, Änderung in UI-014 (Link „Preis ändern“) |
| Kategorie | Kategorie, Chip „Kategorie manuell“ oder „Kategorie fehlt“ | REQ-038/086 | |
| Zustand | Zustandsbezeichnung, Zusatzangabe, bei fehlender Zuordnung „Zustandszuordnung fehlt“ | REQ-039 | |
| Beschreibung | Text mit Zeilenumbrüchen, im Lesemodus nur lesen, im Bearbeitungsmodus editierbar; Chip „manuell angepasst“ | REQ-036, REQ-043 | |
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
| Titel (manuell) | Text | nein | höchstens Höchstlänge des Kanals; „Anpassung speichern“ ist erst aktiv, wenn sich der Text vom gespeicherten Stand unterscheidet | „Titel zu lang: höchstens <n> Zeichen“ |
| Beschreibung (manuell) | Mehrzeilentext | nein | Bestandsplatzhalter bleiben als Platzhalter erhalten; „Anpassung speichern“ erst aktiv, wenn der Text vom gespeicherten Stand abweicht | „Unbekannter Platzhalter {…}“ |

## Aktionen
| Aktion | Auslöser | Voraussetzung | Ergebnis bei Erfolg | Ergebnis bei Fehler | Navigation danach |
|---|---|---|---|---|---|
| Freigeben | Primärbutton (immer aktiv bei Status Entwurf) | Status Entwurf. **Bei ungespeicherter Anpassung im aktuellen Kanal-Inhalt:** kein Serveraufruf, stattdessen Hinweis (siehe „Freigeben mit ungespeicherter Anpassung“); „Freigeben“ speichert die Anpassung **nicht** mit (REQ-043, REQ-044) | Alle Bedingungen erfüllt: Status Freigegeben, Zeitpunkt gespeichert, „geändert seit Freigabe“ entfernt, Banner „Kanal-Inhalt freigegeben“ | Freigabe wird abgelehnt: Fehlerbanner „Freigabe nicht möglich:“ mit Liste **aller** verletzten Bedingungen (z. B. „Preis fehlt“, „Kategorie fehlt“, Pflichtfeld „Farbe“ leer); jeder Listeneintrag ist ein Link, der zum betroffenen Feld springt; Status bleibt Entwurf. Bei Rechtstext „rechtlich ungeprüft“ zuerst Dialog UI-022 (REQ-087) | bleibt; Angebot „Weiter zum Kopier-Assistenten“ (Link) |
| Titel / Beschreibung manuell anpassen | Link je Feld | **in jedem Status möglich** (REQ-043; Folgen siehe „Anpassung speichern“) | Feld im Bearbeitungsmodus, vorbelegt mit dem gespeicherten Text; Zeichenzähler | – | bleibt |
| Anpassung speichern | Sekundärbutton unter dem Feld (der Primärbutton des Bereichs bleibt „Freigeben“) | Bearbeitungsmodus **und** Text unterscheidet sich vom gespeicherten Stand; Validierung ohne Fehler | Zustand `UI-016.speichert`; danach Ergebnismeldung je Status (REQ-043): **Entwurf** „Anpassung gespeichert“; **Freigegeben** „Anpassung gespeichert, Kanal-Inhalt ist wieder Entwurf, bitte erneut freigeben“ (Status Entwurf, Kennzeichnung „geändert seit Freigabe“, Chip „manuell angepasst“); **Veröffentlicht/Beendet** „Änderungsentwurf angelegt“ mit Link „Zum Änderungsentwurf“ (UI-018); der freigegebene Stand bleibt maßgeblich | Feldfehler (Validierung); Ablehnung mit Meldung; Konflikt (`UI-016.conflict`, siehe unten); Verbindungsverlust „Ausgang unbekannt, bitte neu laden“ (P-08); „resellr wird gerade beendet“ P-07 | bleibt (Entwurf, Freigegeben); bei Veröffentlicht/Beendet Link zu UI-018 |
| Anpassung verwerfen | Sekundärlink im Bearbeitungsmodus | ungespeicherte Anpassung vorhanden | Eingabe verworfen, Feld zeigt den gespeicherten Stand im Lesemodus; Marke „Anpassung nicht gespeichert“ entfällt | – | bleibt |
| Manuelle Anpassung zurücknehmen | Link, nur bei gespeicherter Anpassung („manuell angepasst“) | – | Text wird neu gebildet; Wirkung auf den Status und Ergebnismeldung wie bei „Anpassung speichern“ (Annahme, Product Owner bitte bestätigen, REQ-043) | wie „Anpassung speichern“ | bleibt |
| Kanal wechseln | Tab / Kanal-Karte | – | ungespeicherte Anpassung bleibt je Kanal in diesem Browserfenster erhalten (kein Verlust, kein Dialog), der Kanal-Reiter trägt die Marke „Anpassung nicht gespeichert“ | – | anderer Kanal-Inhalt (UI-016) |
| Screen verlassen | „← Zurück“, Navigation, Schließen des Fensters oder Tabs | ungespeicherte Anpassung in mindestens einem Kanal | Rückfrage `UI-016.verlassen-rueckfrage` (siehe unten); Browser-Hinweis beim Schließen des Fensters | – | je nach Wahl |
| Kategorie übernehmen / verwerfen | Button | – | Kategorie gesetzt, „Kategorie manuell“ | Feldfehler | bleibt |
| Alt und neu vergleichen | Link im Banner (nur bei „geändert seit Freigabe“) | Entwurf mit Kennzeichnung | – | – | UI-018 |
| Kanäle vergleichen | Link | – | – | – | UI-017 |

## Zustände
| Zustand | Darstellung | Artefakt | Text |
|---|---|---|---|
| default (Entwurf, Bedingungen verletzt; im Mockup zwei) | siehe Mockup | default.png | – |
| default (alle Bedingungen erfüllt) | Primärbutton aktiv | nur Text | „Alle Freigabebedingungen erfüllt“ |
| default (Entwurf, geändert seit Freigabe) | wie default, zusätzlich Vergleichsbanner und Kennzeichnung „geändert seit Freigabe“ im Tab | nur Text (`UI-016.geaendert`) | Text siehe „Vergleich mit freigegebenem Stand“ |
| default (Freigegeben/Veröffentlicht/Beendet) | Felder im Lesemodus, Button „Kopier-Assistent“ statt „Freigeben“; bei „geändert seit Freigabe“ Link zu UI-018; **„Titel/Beschreibung manuell anpassen“ bleibt in jedem Status möglich** (REQ-043, Folgen siehe Aktion „Anpassung speichern“); alle übrigen Felder nur lesen | nur Text | |
| `UI-016.bearbeiten` | Titel und/oder Beschreibung im Bearbeitungsmodus; „Anpassung speichern“ deaktiviert, solange der Text dem gespeicherten gleicht; „Anpassung verwerfen“ sichtbar | nur Text | – |
| `UI-016.speichert` (wird gespeichert, K-4) | „Anpassung speichern“ und Eingaben gesperrt, Anzeige „Speichern …“, **kein festes Timeout** (Muster P-08); „Freigeben“ ebenfalls gesperrt; bei Verbindungsverlust „Ausgang unbekannt, bitte neu laden“ | nur Text | „Speichern …“ |
| `UI-016.ungespeichert-hinweis` | Hinweisbox über „Freigeben“ (kein Fehlerbanner, **kein neuer Freigabegrund und keine neue Freigabebedingung**; die Freigabe lief nicht, es gab keinen Serveraufruf) mit Aktionen „Anpassung speichern“ und „Anpassung verwerfen“; erst danach läuft die Freigabe (Prüfung der Bedingungen wie bisher) | nur Text | „Es wird nur der gespeicherte Stand freigegeben. Ungespeicherte Anpassung: speichern oder verwerfen.“ |
| `UI-016.verlassen-rueckfrage` | modaler Dialog nach P-04 | nur Text | Titel „Ungespeicherte Anpassung verwerfen?“, Aktionen „Verwerfen“ (verlässt den Screen, Entwürfe aller Kanäle verworfen) und „Weiter bearbeiten“ (primär, Esc = Weiter bearbeiten) |
| `UI-016.conflict` (Ä-31, P-05) | „Anpassung speichern“ abgelehnt, weil der Kanal-Inhalt inzwischen geändert wurde: Banner „Dieser Eintrag wurde inzwischen in einem anderen Fenster geändert. Es wurde nichts gespeichert.“ mit „Stand neu laden“; nach dem Neuladen zeigt das Feld den neuen gespeicherten Stand, darunter „Ihr Text (nicht gespeichert)“ mit „Meinen Text übernehmen“ (setzt ihn in den Bearbeitungsmodus, danach erneut „Anpassung speichern“). Der eigene Text bleibt bis dahin sichtbar | nur Text | s. o. |
| loading | Platzhalter | nur Text | „Lade Kanal-Inhalt …“ |
| empty | n/a | – | – |
| error | Banner | nur Text | „Kanal-Inhalt konnte nicht geladen/freigegeben/gespeichert werden. Referenz: <Nr>“ (Verbindungsverlust beim Speichern: nicht `.error`, sondern „Ausgang unbekannt, bitte neu laden“, P-08) |
| validation | Feldfehler; Fehlerbanner mit Liste aller verletzten Bedingungen bei abgelehnter Freigabe | Mockup (Kategorie fehlt, Pflichtfeld „Farbe“ leer: zwei Einträge) | „Freigabe nicht möglich:“ + Liste |
| success | Banner | nur Text | „Kanal-Inhalt freigegeben“; nach „Anpassung speichern“ die Ergebnismeldung je Status (siehe Aktion) |
| disabled | „Anpassung speichern“ ohne Änderung des Textes; „Freigeben“ ist bei verletzten Bedingungen **nicht** deaktiviert (Ablehnung mit Begründung, REQ-044); bei Status ≠ Entwurf wird der Button durch „Kopier-Assistent“ ersetzt | nur Text | – |

## Fenstergröße und Bedienung
Zwei Spalten (Inhalt 8/12, Bedingungen 4/12), Bedingungen bleiben beim Scrollen sichtbar. Der Inhalt scrollt; Kanal-Tabs und die Leiste mit „Freigeben“ bleiben bei der nutzbaren Höhe von etwa 630 px (Ä-28) fest sichtbar. Tab-Reihenfolge: Tabs → Felder → Anpassung speichern/verwerfen → Bedingungen → Freigeben.

### Ungespeicherte Anpassung (K-3)
Eine Anpassung ist „ungespeichert“, solange der Text im Bearbeitungsmodus vom gespeicherten Stand abweicht. (1) **Kanalwechsel:** der Entwurf bleibt je Kanal im Browser erhalten (solange die Seite geöffnet ist), kein Dialog; der Kanal-Reiter trägt „Anpassung nicht gespeichert“. (2) **Verlassen** über „Zurück“, Navigation oder Fensterschließen: Rückfrage „Ungespeicherte Anpassung verwerfen?“ mit „Verwerfen“ / „Weiter bearbeiten“; beim Schließen des Fensters zeigt der Browser seinen eigenen Hinweis (nicht gestaltet). (3) **Freigeben:** siehe `UI-016.ungespeichert-hinweis`. (4) **Speichern:** `UI-016.speichert`, Ergebnis je Status nach REQ-043, bei Konflikt `UI-016.conflict`. Beziehung zu UI-014/UI-018/UI-002: UI-014 zeigt in der Kanal-Karte „manuell angepasst“; bei Veröffentlicht/Beendet entsteht der Änderungsentwurf, den UI-018 mit Chip „manuell angepasst“ zeigt; UI-002 zeigt „manuell angepasst“ und je Zeile „Daten geändert, manuell angepassten Text prüfen“ (REQ-052, Kap. 9.4).

## Bekannte Abweichungen im Mockup
**Titelzähler (Widerspruch im Mockup):** Der Titel im Mockup hat etwa 71 Zeichen, der Zähler zeigt „62 / 65“, und die Bedingung „Titel nicht länger als 65 Zeichen“ steht auf „OK“. Das ist ein Fehler von Stitch und nicht Teil des Designs. Maßgeblich: Bei mehr als 65 Zeichen steht der Zähler auf Überschreitung, die Bedingung auf „nicht erfüllt“ und der Titel erscheint im Fehlerbanner bei Freigabe. Das Mockup ist für den Titel nicht als Beispiel für ein erfülltes Limit zu lesen. **Anzahl Fehler:** Das Mockup zeigt zwei verletzte Bedingungen (Kategorie, Pflichtfeld „Farbe“); die Zustandstabelle nennt sie als Beispiel. Das Mockup zeigt „Freigeben“ aktiv und das Fehlerbanner mit Liste und Links (Stand nach Korrektur). Abweichungen: Titel ohne Chip „Titel gekürzt, bitte prüfen“ (Beispiel bei 62/65 Zeichen, Chip erscheint nur bei Kürzung); die Bedingung „Pflichtfelder des Kanals gefüllt“ steht auf „nicht erfüllt“ (im Fehlerbanner als „Pflichtfeld „Farbe“ ist leer“ benannt); der Eintrag „Preis fehlt“ wird nicht gezeigt (Preis ist vorhanden). Die GPSR-Karte liegt hinter der Sticky-Leiste und ist im Mockup nicht sichtbar; die Fotos-Karte steht außerhalb des Bildschirmrahmens. Das Eingabefeld „Kategorie“ ist leer ohne Platzhalter. Navigationsuntertitel „Business Portal“ entfällt in diesem Mockup. Kennzeichnung „VB“ ist als Kontrollkästchen dargestellt.

## Annahmen und offene Fragen
- Annahme: Nach Freigabe wird kein automatischer Seitenwechsel durchgeführt, nur Link zum Kopier-Assistenten.
- Entscheidung (Product Owner, MAR-147, K-3 Variante a): Es gibt die eigene Aktion „Anpassung speichern“ (und „Anpassung verwerfen“); „Freigeben“ speichert nicht mit. Begründung: REQ-043 gibt der manuellen Anpassung eine eigene Wirkung je Status, REQ-044 lässt die Freigabe den freigegebenen Zustand speichern; ein Freigabe-Klick mit stiller Statusänderung würde beides vermischen. Das Mockup `default.png` zeigt „Anpassung speichern“ nicht; maßgeblich ist diese Beschreibung.
- Annahme: Der Entwurf einer ungespeicherten Anpassung bleibt nur im Browserfenster (nicht im Server) und nur, solange die Seite geöffnet ist.
- Entscheidung (Review R1, Punkt 4): „Freigeben“ bleibt aktiv; Ablehnung nennt jede verletzte Bedingung (AC-REQ-044-02/-03).
