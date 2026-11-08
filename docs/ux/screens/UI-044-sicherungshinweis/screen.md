# UI-044 – Hinweis „Sicherung einrichten“ (Anwendungsrahmen)

- Zweck: Dauerhafter Hinweis, dass resellr die Daten nicht selbst sichert, mit Speicherort des Datenordners und (nur Betrieb am Arbeitsplatzrechner) der Aktion „resellr beenden“.
- Flows: FLOW-10; wirkt in **jedem** Screen mit Anwendungsrahmen (alle außer UI-001, UI-046, LP-01 bis LP-03)
- Anforderungen: REQ-104, REQ-105, REQ-106; AC-REQ-104-01 bis -06, AC-REQ-105-01; Baseline Kap. 6.1 (Sicherungshinweis), Kap. 6.3 X-1
- Rollen: Nutzer · Gerät(e): PC, Fenster frei in der Größe, Untergrenze 1366 × 768 (REQ-077); schmale Ansicht UI-019 ab 480 px
- Artefakte: Mockups `UI-002/hinweis.png` (Rahmen) und `UI-019/compact-hinweis.png` (schmal) als visuelle Referenz mit dokumentierten Abweichungen, sonst Text (Wortlaut `[Vorschlag BA]`, wird vom Owner mit der Requirements-Freigabe bestätigt; **Wortlaut der REQ-Texte nicht geändert**, hier nur Ort und Gestaltung)

## Ort (Entscheidung)
Der Hinweis ist Teil der **Anwendungsgrundstruktur** (App-Rahmen), nicht eines Screens. Er wird beim Laden des Rahmens gezeigt, also bei jedem Einstieg über jede Adresse (Start, Lesezeichen, Zurück/Vorwärts, Neuladen) und bei jedem Seitenwechsel. Kein Screen kann ihn weglassen.
- **Normale Ansicht (Fenster ab REQ-077, 1366 × 768 aufwärts):** unten in der linken Navigationsspalte (208 px Breite), unter den Navigationseinträgen. Der Inhaltsbereich verliert dadurch **keine** Fläche. Begründung: die Navigation ist immer sichtbar (Kap. 3), die Arbeitsflächen bleiben frei.
- **Schmale Ansicht UI-019 (ab 480 px, keine Navigation):** Streifen mit vollständigem Text am **Ende der scrollenden Fläche** (siehe „Fenstergröße und Bedienung“ und UI-019).
- Aufbau der Navigationsspalte: Kopf „resellr“ (40 px, **fest**) · darunter **ein Bereich**, der die 6 Einträge (je 28 px, kompakt) und den Hinweis enthält. Ist das Fenster hoch genug, steht der Hinweis am unteren Spaltenrand (Einträge oben, Hinweis unten). Ist es nicht hoch genug, **scrollt dieser Bereich** (nur senkrecht), und der Hinweis steht unter den Einträgen am Ende des Bereichs.
- **Fenstergröße ist frei (v0.6, Owner-Entscheid MAR-168):** Die Oberfläche ist nicht auf einen Bildschirm oder PC zugeschnitten. Höhe und Breite des Fensters sind frei veränderbar; **REQ-077 (ab 1366 × 768) ist die Untergrenze**, keine Planungsgröße. Es gibt keine feste Höhenrechnung mehr (die frühere Rechnung 588 px ≤ 600 px und die Planungshöhe 600 px entfallen als Grundlage).
- **Gewählte Variante A (Spalte scrollt, Kopf fest), Variante B (Hinweis klappt ein) verworfen.** Begründung in einem Satz: A führt keinen neuen Zustand ein und lässt den Wortlaut unberührt, während ein Einklappen ein neuer Zustand wäre und der Festlegung „nicht ausblendbar, ohne Zustand“ (X-1 (c), AC-REQ-104-03 bis -05) widerspräche.
- **Maße des Hinweises (gelten unverändert, DESIGN.md):** Abstand zum Spaltenrand (links, rechts, unten) 8 px; Rahmen 1 px; Balken links 4 px; Innenabstand 8 px; Absatzabstand 2 px; Abstand zu den Navigationseinträgen 4 px; Button einschließlich Abstand zum Text 32 px; Überschrift 14/20 plus 4; Text 12/16 (Mindestgröße 12 px, auch bei Zoom). Textbreite in der Spalte 170 px; der Text bricht nach Wörtern um, der Pfad an beliebiger Stelle (auch bei 100 Zeichen).
- **Erreichbarkeit (zwingend, bei jeder Höhe):** Die Aktion „resellr beenden“ und der Speicherort (auswählbarer Text) sind durch Scrollen des Bereichs immer erreichbar, nichts wird abgeschnitten. Der Button ist per Tab erreichbar; erhält er den Fokus, scrollt der Bereich ihn ins Sichtbare. Das Scrollen der Spalte erfolgt per Mausrad, Scrollleiste und Tastatur (Pfeil auf/ab, Bild auf/ab, wenn der Bereich den Fokus hat); der Kopf „resellr“ bleibt dabei sichtbar. Der Hinweis wird nie eingeklappt, ausgeblendet oder gekürzt.
- **Seitenzoom:** Bei Seitenzoom bis 150 % (bei 1366 × 768 effektiv ab etwa 910 × 512 px CSS-Fläche) gilt dasselbe; bei Zoom darf die CSS-Fläche kleiner sein als bei 100 %, die Untergrenze der Fenstergröße (REQ-077) bleibt maßgeblich. Spaltenbreite bleibt 208 px CSS, Text mindestens 12 px CSS.
- **Abnahmekriterium (Test, vom Architekten zu übernehmen):** **„Kein Inhalt und keine Aktion ist unerreichbar.“** Prüfung in Google Chrome: (1) Fenster in der Größe verändern, mindestens von 1366 × 768 bis voller Bildschirm und wieder zurück, (2) Seitenzoom 100 %, 125 % und 150 %, (3) Speicherort mit **100 Zeichen** (auch mit mehr). Bei jeder Kombination muss gelten: der Kopf „resellr“ ist sichtbar; jeder Navigationseintrag ist erreichbar (sichtbar oder per Scrollen); der vollständige Hinweistext ist per Scrollen lesbar (nichts abgeschnitten, keine Überlappung mit den Einträgen); der vollständige Speicherort ist erreichbar und markierbar; der Button „resellr beenden“ ist erreichbar und bedienbar (Maus und Tab/Enter); kein waagrechtes Scrollen der Spalte; Text mindestens 12 px. **Ohne Scrollen sichtbar** ist ausdrücklich kein Kriterium mehr. Der Wortlaut bleibt unverändert; ein Platzproblem ist kein Anlass, ihn zu kürzen.

## Angezeigte Daten
| Element | Inhalt | Quelle | Hinweise |
|---|---|---|---|
| Überschrift | „Sicherung einrichten“ mit Info-Symbol | REQ-104 | 14/20 semibold |
| Text | „resellr sichert Ihre Daten nicht selbst. Bitte sichern Sie sie regelmäßig selbst, zum Beispiel in OneDrive. So geht es: 1. resellr beenden. 2. Den Datenordner vollständig an Ihren Sicherungsort kopieren. Der Datenordner liegt hier: {Speicherort des Datenordners}. Wichtig: Eine Kopie, die bei laufendem resellr entsteht, kann unbrauchbar sein.“ | REQ-104 | Wortlaut unverändert; der Satz „So geht es“ und die zwei Schritte stehen in eigenen Zeilen (Zeilenumbruch, kein Wortlaut geändert); 12/16 Text, Mindestgröße 12 px |
| Speicherort | vollständiger Pfad des Datenordners (Beispiel: `C:\Users\Beispiel\AppData\Local\resellr\Daten`) | Betriebsstatus (Baseline 6.1) | **auswählbarer Text** (Dreifachklick markiert ihn), bricht an beliebiger Stelle um, kein Kopieren-Button, kein „Im Explorer öffnen“ (X-6) |
| Aktion | Button „resellr beenden“ | REQ-105 | nur im Betrieb nur am Arbeitsplatzrechner; Sekundärbutton (Rahmen), ganz unten im Hinweis |

Gestaltung: Fläche surface (#FFFFFF) mit 1 px Rahmen primary und 4 px linker Balken primary, Radius 6 px, Innenabstand 8 px, Abstand 8 px zum Spaltenrand (Maße siehe „Ort“). Keine neuen Tokens. Der Hinweis ist **kein Banner und kein Dialog**: kein „×“, kein „Schließen“, kein „Nicht mehr anzeigen“, kein Einklappen, kein Zähler.

## Eingaben und Validierung
Keine. Der Hinweis hat keinen Zustand, der sich ändert (resellr erkennt nicht, ob gesichert wurde; AC-REQ-104-03/-04/-05). Es gibt in den Einstellungen keinen Eintrag dazu.

## Aktionen
| Aktion | Auslöser | Voraussetzung | Ergebnis bei Erfolg | Ergebnis bei Fehler | Navigation danach |
|---|---|---|---|---|---|
| resellr beenden | Button, Tastatur (Tab, Enter) | Betrieb nur am Arbeitsplatzrechner | öffnet die Rückfrage UI-045 | – | UI-045 (modal) |
| Speicherort markieren | Mausmarkierung | – | Text markiert, Strg+C kopiert | – | bleibt |

Der Hinweis blockiert nichts und verlangt keine Bestätigung (AC-REQ-104-02). Eine Arbeit in jedem Screen ist ohne Berührung des Hinweises möglich.

## Zustände
| Zustand | Darstellung | Artefakt | Text |
|---|---|---|---|
| default | wie oben, immer | nur Text | – |
| loading | Der Speicherort ist beim Laden des Rahmens noch nicht da: Überschrift und alle Sätze stehen sofort (Text ist fest), an der Stelle des Pfades steht „wird geladen …“; **der Hinweis wird nie ausgeblendet** | nur Text | „wird geladen …“ |
| error | Speicherort nicht ermittelbar: Hinweis bleibt vollständig, an der Stelle des Pfades steht der Text unten (REQ-073: Funktion, nächster Schritt, Referenznummer) | nur Text | „Speicherort konnte nicht ermittelt werden. Informieren Sie den Betreiber und nennen Sie die Referenznummer <Nr>.“ |
| disabled | Button „resellr beenden“ deaktiviert, solange UI-045 offen ist oder das Beenden läuft | nur Text | – |
| Netzbetrieb (Variante B, nicht Standard) | derselbe Text, **ohne** Button (AC-REQ-104-06) | nur Text | – |
| empty, success, validation | n/a | – | – |
| `.unreachable`, `.ausgang-unbekannt`, `.wird-beendet` | wirken im Inhaltsbereich (Muster P-06 beim Laden, P-08 bei schreibenden Aktionen, P-07); der Hinweis bleibt unverändert | – | – |

## In jedem Fenster und Rahmen (X-1, Ergänzung des Architekten)
Der Hinweis steht in **jedem** Fenster und Rahmen: normale Ansicht (Navigationsspalte), **schmale Ansicht von UI-019** (Streifen am Ende der scrollenden Fläche) und jedes weitere Browserfenster, das die Anwendung zeigt. Ausnahmen nur UI-001, UI-046 und LP-01 bis LP-03 (siehe uiux-design.md Kap. 3).

## Fenstergröße und Bedienung
- Normal: Spalte 208 px Breite, Höhe folgt dem Fenster, siehe Ort. Der Bereich unter dem Kopf scrollt bei wenig Höhe.
- Schmal (nur UI-019, ab 480 px Fensterbreite bis unter 1366 px): kein fester Streifen am unteren Fensterrand mehr. Der Streifen (volle Breite, Rand 8 px, Innenabstand 8 px, Textbreite 442 px bei 480 px Fensterbreite, vollständiger Text) steht **am Ende der scrollenden Fläche, direkt unter den Aktionen „Als veröffentlicht melden“ und „Abgleich bestätigen“**. Kopf, Kanal-Wahl und Fortschritt bleiben fest oben (UI-019); die Feldliste und der Streifen scrollen gemeinsam in **einer** Fläche. Begründung: ein fester Streifen (etwa 240 bis 256 px) würde bei wenig Höhe die Feldliste verdrängen; am Ende der Fläche braucht er keine Höhe, ist immer erreichbar und der Text bleibt vollständig und unverändert. Bei sehr viel Höhe steht er am unteren Fensterrand (Fläche füllt die Höhe, Streifen unten). Er ist per Scrollen, Tab (Button) und Tastatur erreichbar.
- Es gibt keine Pixelrechnung als Abnahmegrundlage; es gilt das Abnahmekriterium unter „Ort“.
- Tastatur: Button in der Tab-Reihenfolge nach den Navigationseinträgen (normal) bzw. nach der Feldliste (schmal).
- Dialoge (modal) dunkeln den Rahmen ab; der Hinweis bleibt dabei in seiner Position sichtbar (abgedunkelt).

## Annahmen und offene Fragen
- **Entschieden (Product Owner, Review Runde 1, MAR-143): Auslegung AC-REQ-104-01 in UI-019 schmal.** Die wörtliche Fassung bleibt (vollständiger Text ohne weitere Nutzeraktion, auch im schmalen Fenster, vollständiger Streifen am Ende der scrollenden Fläche, v0.6). Eine Kurzfassung wäre eine Änderung von REQ-104, keine Auslegung. Zeigt der Test ein Platzproblem, ist das ein Änderungswunsch an REQ-104 über den Owner, keine Designentscheidung.
- **Auslegung bei wenig Höhe (v0.6, Owner-Entscheid MAR-168):** Der Text steht „ohne weitere Nutzeraktion“ im Rahmen (AC-REQ-104-01), ist aber nicht ausblendbar und bei jeder Fenstergröße ab REQ-077 vollständig erreichbar. Ist das Fenster zu niedrig für Einträge und Hinweis zugleich, erreicht man ihn durch Scrollen der Spalte; das ist kein Klick auf den Hinweis und kein Zustand. In UI-019 schmal gilt dasselbe für den Streifen am Ende der scrollenden Fläche (bei langer Feldliste ist Scrollen nötig). Hinweis für das Review: Diese Auslegung ersetzt die frühere Zusage „ohne Scrollen sichtbar bei 1366 × 768“; ein fester Streifen in UI-019 wäre die Alternative, verdrängt aber bei wenig Höhe die Feldliste.
- Annahme: Der Hinweistext wird nicht gekürzt oder übersetzt; Wortlaut bestätigt der Owner (OP-17).
