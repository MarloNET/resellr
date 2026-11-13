# UI-027 – Gerätearten und Merkmale

- Zweck: Gerätearten anlegen, ändern und über den Status-Umschalter deaktivieren bzw. wieder aktivieren (unverändert) und ihre Merkmale (Datentyp, Ebene, Variantenkennzeichen, Pflicht, Datenblatt-Block) pflegen, **neu in v0.6.4: ein deaktiviertes Merkmal wieder aktivieren** (REQ-005).
- Flows: FLOW-05
- Anforderungen: REQ-004, REQ-005, REQ-006, REQ-076; AC zu REQ-004/005, **v0.6.4: AC-REQ-005-11, AC-REQ-005-12 (Wieder aktivieren)**
- Rollen: Nutzer
- Gerät(e): PC, Fenster frei in der Größe, Untergrenze 1366 × 768 (REQ-077)
- Artefakte: default.png (Stitch 81e728c27f964e70b2e78954255f0725, DESKTOP, 06.11.2026)

## Angezeigte Daten
| Element | Inhalt | Quelle | Hinweise |
|---|---|---|---|
| Einstellungs-Liste | 14 Bereiche (Händlermarke, Gerätearten und Merkmale, Auswahllisten, Titelmuster, Textbausteine, Hersteller und GPSR, Lieferanten, Code-Übersetzung, Zustandszuordnung, Kategoriezuordnung, Merkmalszuordnung, Beschreibungsvorlagen, Kanäle und Preisregeln, Datenblatt-Layout; „Zugangspasswort“ entfällt in Release 0.1, OD-02 Variante A) | Kap. 9.5 | zweite Navigationsspalte, 240 px |
| Geräteart-Liste | Name, Status „aktiv“/„deaktiviert“ | REQ-004 | |
| Merkmal-Tabelle | Reihenfolge, Bezeichnung, Datentyp, Einheit, Ebene (Modell/Gerät), variantenbildend (Ja/Nein/–), Pflicht, Datenblatt-Block, Status | REQ-005 | Reihenfolge per Ziehen oder Buttons „nach oben/unten“. Spalte „Status“ als Text „aktiv“ oder „deaktiviert“ (nie nur durch Farbe); deaktivierte Merkmale bleiben in der Tabelle an ihrem Platz in der Reihenfolge (v0.6.4, siehe „Wieder aktivieren“) |
| Merkmal-Formular | Seitenpanel „Merkmal bearbeiten“ | | |

## Eingaben und Validierung
| Feld | Typ | Pflicht | Regel | Fehlermeldung |
|---|---|---|---|---|
| Geräteart: Name | Text | ja | 1–50 Zeichen, eindeutig ohne Groß-/Kleinschreibung | „Name ist bereits vergeben“ / „Name: 1 bis 50 Zeichen“ |
| Geräteart: Status | Umschalter | ja | aktiv/deaktiviert | – |
| Merkmal: Bezeichnung | Text | ja | 1–100 Zeichen, ohne { }, nicht gleich einem festen Platzhalternamen, eindeutig je Geräteart | „Bezeichnung ist bei dieser Geräteart bereits vergeben“; „Bezeichnung: 1 bis 100 Zeichen“; „Bezeichnung darf { und } nicht enthalten“; „Bezeichnung ist für einen festen Platzhalter vergeben: <Name>“ (v0.6, meldungskatalog.md M-02 bis M-04) |
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
| Merkmal deaktivieren | Zeilenaktion, nur bei Status „aktiv“ | – | Status „deaktiviert“, Werte bleiben | – | bleibt |
| **Merkmal wieder aktivieren** (v0.6.4, REQ-005, AC-REQ-005-11) | Zeilenaktion „Wieder aktivieren“ (Textbutton), **nur bei Status „deaktiviert“** sichtbar, an derselben Stelle wie „Deaktivieren“; **ohne Rückfrage-Dialog** | Merkmal hat Status „deaktiviert“ | Status „aktiv“, Banner „Merkmal aktiviert“; gespeicherte Werte und alle übrigen Angaben unverändert | nur der allgemeine technische Fehler (Zustand `error`, Muster P-08); **keine Ablehnung, keine fachliche Fehlermeldung** | bleibt in UI-027 |
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
| success | Banner | nur Text | „Merkmal gespeichert“; nach „Wieder aktivieren“: „Merkmal aktiviert“ |
| `UI-027.aktiviert-speichert` (v0.6.4, wird aktiviert) | Wie `UI-027.speichert`: Zeilenaktionen, Speicherknopf und Panel-Eingaben gesperrt bis zur Antwort, Anzeige „Speichern …“ in der Zeile, **kein festes Timeout** (Muster P-08); bei Verbindungsverlust „Ausgang unbekannt, bitte neu laden“, die Zeile zeigt bis zum Neuladen ihren bisherigen Status | nur Text | „Speichern …“ |
| disabled | Ebene/Datentyp gesperrt bei gespeicherten Werten | default.png | |

## Wieder aktivieren (v0.6.4, REQ-005, AC-REQ-005-11, AC-REQ-005-12; Auftrag MAR-607)

**Darstellung eines deaktivierten Merkmals.** Die Zeile bleibt an ihrem Platz; die Spalte „Status“ zeigt den Text „deaktiviert“ (Chip), die Bezeichnung in gedämpfter Schrift (zusätzlich zum Text, nie nur Farbe). Alle übrigen Spalten (Datentyp, Einheit, Ebene, variantenbildend, Pflicht, Datenblatt-Block) bleiben sichtbar und unverändert; „variantenbildend“ hängt nicht am Status (A-38). Die Zeilenaktion lautet bei Status „deaktiviert“ **„Wieder aktivieren“**, bei „aktiv“ „Deaktivieren“ (die Aktion wechselt je Status die Beschriftung an derselben Stelle).

```
| Reihenfolge | Bezeichnung | Datentyp | Ebene | variantenbildend | Pflicht | Status      | Aktion             |
|      4      | RAM         | Ganzzahl | Gerät | Ja               | Ja      | deaktiviert | Wieder aktivieren  |
|      5      | Prozessor   | Text     | Modell| Nein             | Ja      | aktiv       | Deaktivieren       |
```

**Ablauf.** Klick (oder Enter/Leertaste bei Fokus) auf „Wieder aktivieren“ → Zustand `UI-027.aktiviert-speichert` → Erfolg: Status „aktiv“, Aktion wechselt auf „Deaktivieren“, Banner „Merkmal aktiviert“ (bestehendes Banner-Muster wie „Merkmal gespeichert“). Der Nutzer bleibt in UI-027; Fokus bleibt auf der Zeilenaktion derselben Zeile (jetzt „Deaktivieren“); der Banner wird Screenreadern als Statusmeldung angekündigt. Gleiche Tastaturbedienung wie die Zeilenaktion „Deaktivieren“.

**Was nicht geschieht.**
- **Kein Rückfrage-Dialog**, kein Hinweistext, kein Zähler betroffener Datensätze: Das Aktivieren wird nie abgelehnt, es gibt keine Prüfung, die es verhindert (Namenskonflikte können nicht entstehen, A-38). Es gibt deshalb keinen fachlichen Fehlerzustand und keine Ablehnungsmeldung.
- Gespeicherte Werte bleiben unverändert; fehlende Werte werden **nicht** nachgefordert; es gibt keine Liste „Werte nachtragen“ und keine Markierung betroffener Datensätze.
- Ebene, Einheit, Reihenfolge, Pflicht, variantenbildend und Datenblatt-Block bleiben; die Variantenbildung der Modell-Inserate ändert sich durch Aktivieren und Deaktivieren nicht (A-38).
- Nur der allgemeine technische Fehler: Banner „Einstellungen konnten nicht gespeichert werden. Referenz: <Nr>“ (Zustand `error`); bei Verbindungsverlust „Ausgang unbekannt, bitte neu laden“ (P-08). Die Zeile behält ihren bisherigen Status; kein „Erneut versuchen“ (Muster K-6).

**Seitenpanel „Merkmal bearbeiten“ eines deaktivierten Merkmals.** Entscheidung: **bearbeitbar wie bei einem aktiven Merkmal**, mit denselben Regeln und Meldungen. Begründung: REQ-005 verbietet es nicht, es braucht keine neue Regel und keinen zweiten Zustand des Panels; so kann der Nutzer z. B. „Pflicht“ ändern, bevor er das Merkmal aktiviert. Das Panel enthält **keinen** Status-Umschalter; Aktivieren und Deaktivieren geschehen nur in der Zeile. Ein geöffnetes Panel desselben Merkmals bleibt beim Aktivieren offen, seine Eingaben werden weder gespeichert noch verworfen (während `UI-027.aktiviert-speichert` gesperrt).

**Rolle:** Nutzer (genau eine Person, E-4), keine rollenabhängige Sicht. **Navigation danach:** bleibt in UI-027.

### Rückmeldung bei später verlangtem Pflichtwert (AC-REQ-005-12)
Ein fehlender Wert eines (wieder aktivierten) Pflichtmerkmals wird erst beim Speichern in **UI-007** (Modellvorlage, REQ-010/REQ-008), **UI-010** und **UI-003** (Gerätewerte, REQ-014) und **UI-014** „Inseratswerte bearbeiten“ (REQ-088, ohne Preise und Fotos) verlangt, auch wenn die Änderung ein anderes Feld betrifft. Die Darstellung dort steht in den jeweiligen `screen.md` und im Meldungskatalog (**M-32**, „<Merkmal> fehlt“). **Preis erfassen und Fotos zuordnen (UI-014, UI-015) verlangen den Wert nicht und zeigen M-32 nicht (AC-REQ-005-12 c)**; ebenso Zuordnen, Umbuchen, Verkauf, WI-Nr-Korrektur, Storno und Freigabe (A-39).

## Fenstergröße und Bedienung
Drei Bereiche (Geräteart-Liste, Merkmal-Tabelle, Seitenpanel) ab 1366 px; Seitenpanel überlagert bei schmaler Breite die Tabelle. Hoch/Runter-Buttons als Tastaturalternative zum Ziehen. Unter 1366 CSS-px (Zoom, schmaleres Fenster) gilt die Reflow-Regel R-1 (uiux-design.md Kap. 5, DESIGN.md).

## Bekannte Abweichungen im Mockup
**v0.6.4:** Die Zeilenaktion „Wieder aktivieren“ und der Banner „Merkmal aktiviert“ sind **nur in `screen.md` beschrieben**, `default.png` zeigt sie nicht (kein neues Mockup, Klassifikation Minimal). „Business Portal“ (Stitch); Stitch ergänzt Kopfzähler und Statuschips „aktiv“ (aus Requirements ableitbar, übernommen); Untertitel „Konfiguration“ in der zweiten Navigation (nicht Teil des Designs); Panel zeigt „RAM“ auf Ebene Gerät als Beispiel; Hinweistext der Sperrung als Fehlerbox (maßgeblich: Inline am Feld).

## Annahmen und offene Fragen
- Annahme: Startbelegung (Kap. 9.3) steht bei Auslieferung bereit (REQ-006) und wird hier unverändert bearbeitet.
- Annahme (v0.6.4): „Wieder aktivieren“ braucht keine Rückfrage, weil nichts verloren gehen kann und das Aktivieren nie abgelehnt wird (Owner-Festlegung REQ-005). Wortlaut „Wieder aktivieren“ und „Merkmal aktiviert“ vom Designer, vom Owner mit der Freigabe zu bestätigen.
- Annahme (v0.6.4): Das Panel „Merkmal bearbeiten“ bleibt bei einem deaktivierten Merkmal bearbeitbar (siehe „Wieder aktivieren“).
