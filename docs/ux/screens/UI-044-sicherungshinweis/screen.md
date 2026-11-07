# UI-044 – Hinweis „Sicherung einrichten“ (Anwendungsrahmen)

- Zweck: Dauerhafter Hinweis, dass resellr die Daten nicht selbst sichert, mit Speicherort des Datenordners und (nur Betrieb am Arbeitsplatzrechner) der Aktion „resellr beenden“.
- Flows: FLOW-10; wirkt in **jedem** Screen mit Anwendungsrahmen (alle außer UI-001, UI-046, LP-01 bis LP-03)
- Anforderungen: REQ-104, REQ-105, REQ-106; AC-REQ-104-01 bis -06, AC-REQ-105-01; Baseline Kap. 6.1 (Sicherungshinweis), Kap. 6.3 X-1
- Rollen: Nutzer · Gerät(e): PC ab 1366 × 768; schmale Ansicht UI-019 ab 480 px
- Artefakte: Mockups `UI-002/hinweis.png` (Rahmen) und `UI-019/compact-hinweis.png` (schmal) als visuelle Referenz mit dokumentierten Abweichungen, sonst Text (Wortlaut `[Vorschlag BA]`, wird vom Owner mit der Requirements-Freigabe bestätigt; **Wortlaut der REQ-Texte nicht geändert**, hier nur Ort und Gestaltung)

## Ort (Entscheidung)
Der Hinweis ist Teil der **Anwendungsgrundstruktur** (App-Rahmen), nicht eines Screens. Er wird beim Laden des Rahmens gezeigt, also bei jedem Einstieg über jede Adresse (Start, Lesezeichen, Zurück/Vorwärts, Neuladen) und bei jedem Seitenwechsel. Kein Screen kann ihn weglassen.
- **Normale Ansicht (ab 1366 × 768):** unten in der linken Navigationsspalte (208 px), unter den Navigationseinträgen. Der Inhaltsbereich verliert dadurch **keine** Fläche. Begründung: die Navigation ist immer sichtbar (Kap. 3), die Arbeitsflächen bleiben frei.
- **Schmale Ansicht UI-019 (ab 480 px, keine Navigation):** fester Streifen am unteren Rand des Fensters, volle Breite, vollständiger Text (siehe unten).
- Reihenfolge der Navigationsspalte: Kopf „resellr“ (40 px) · 6 Einträge (je **28 px**, kompakt, nur in dieser Spalte; Entscheidung v0.4.1) · Hinweis. Die Spalte steht fest (Kap. 3), der Hinweis hängt unten an.
- **Planungshöhe (F-1, v0.4.1):** Windows 1366 × 768, Taskleiste 40 px, Chrome mit Tab- und Adressleiste ergibt etwa **640 px** Seitenhöhe ohne und etwa **607 px** mit Lesezeichenleiste. Das Design plant mit **600 px** (konservativ; Baseline Ä-28 nennt als nutzbare Fläche etwa 1350 × 630 px, die Planung bleibt darunter).
- **Maße (v0.5.2, A-1, eine durchgängige Angabe, gilt auch für DESIGN.md):** Abstand zum Spaltenrand (links, rechts, unten) 8 px; Rahmen 1 px; Balken links 4 px; Innenabstand 8 px; Absatzabstand 2 px; Abstand zu den Navigationseinträgen 4 px; Button einschließlich Abstand zum Text zusammen 32 px; Überschrift 24 px (14/20 plus 4); Text 12/16.
- **Rechnung (Spalte 208 px):** Textbreite = 208 − 2 × 8 (Rand) − 4 (Balken) − 2 (Rahmen) − 2 × 8 (Innenabstand) = **170 px**; bei etwa 6,2 px je Zeichen (Inter 12 px, **Schätzung**) etwa **27 Zeichen je Zeile**. Zeilen nach Wörtern umbrochen: Aussage 4, „So geht es:“ 1, Schritt 1 1, Schritt 2 3, „Der Datenordner liegt hier:“ 1, **Pfad 4 Zeilen bei 100 Zeichen** (bricht an beliebiger Stelle), „Wichtig …“ 4 = **18 Zeilen**. Höhe: Kopf 40 + 6 × 28 = 208; Abstand zu den Einträgen 4; Rahmen 2 + Innenabstand 2 × 8 = 18; Überschrift 24; Text 18 × 16 = 288; 3 × Absatzabstand 2 = 6; Button 32; Randabstand unten 8. **Gesamt 208 + 4 + 18 + 24 + 288 + 6 + 32 + 8 = 588 px ≤ 600 px** (12 px Reserve): Der Hinweis ist bei 1366 × 768 **ohne Scrollen vollständig sichtbar**, auch bei einem Pfad mit 100 Zeichen.
- **Drei Pfadlängen getrennt:** Beispielpfad (etwa 45 Zeichen, 2 Pfadzeilen, 16 Zeilen): **556 px**. Realistischer Pfad (unter 75 Zeichen, 3 Pfadzeilen, 17 Zeilen): **572 px**. Pfad mit **100 Zeichen** (4 Pfadzeilen, 18 Zeilen): **588 px**. Bei 150 Zeichen (6 Pfadzeilen, praktisch ausgeschlossen) etwa 620 px: Rückfall.
- **Vorgeschichte und Verifikation (A-1):** Die Rechnung in v0.4.1 (588 px) setzte 184 px Textbreite und 2 × 10 px Innenabstand an und passte nicht zur Gestaltung (12 px Rand, 12 px Innenabstand, Balken, Rahmen; Textbreite dann nur 154 px, 24 Zeichen, 21 Zeilen, etwa 658 px). Die Gestaltung wurde deshalb nach dem im Design festgehaltenen Rückweg angepasst (zuerst Abstände: Rand 8, Innenabstand 8, Absatzabstand 2, Abstand zu den Einträgen 4, Button 32); der Wortlaut bleibt unverändert.
- **Unsicherheit Zeichenbreite:** Die Zeichenbreite 6,2 px ist geschätzt. Empfindlichkeit bei Textbreite 170 px: bis 6,29 px je Zeichen (27 Zeichen) 588 px; ab 6,3 bis 6,5 px (26 Zeichen) etwa 604 px bei 75 Zeichen und **etwa 620 px bei 100 Zeichen** (dann auch mit Lesezeichenleiste, 607 px, nicht mehr vollständig sichtbar). Bei 5,9 px (28 Zeichen) 572 px. Die Reserve gegenüber 600 px ist also schmal und hängt an der Zeichenbreite; gemessen wird im Test (Abnahmekriterium). Zeigt der Test Überschreitung, ist das eine Entscheidungsvorlage (Änderungswunsch an REQ-104 über den Owner), der Wortlaut wird nicht gekürzt.
- **Rückfall:** Ist das Fenster niedriger als die Planungshöhe (kleiner als 1366 × 768, größere Browserleisten, Pfad über etwa 100 Zeichen), scrollt die **ganze Navigationsspalte** (nicht der Hinweis allein); der Text bleibt vollständig und wird nie abgeschnitten oder eingeklappt.
- **Abnahmekriterium (Test):** In Chrome bei 1366 × 768 mit Lesezeichenleiste und einem Pfad von 100 Zeichen ist der Hinweis ohne Scrollen vollständig sichtbar. Die Zeichenbreite ist eine Schätzung und im Test zu messen; gemessen wird mit dem Viewport aus Spike-Punkt 6 (Baseline). Weicht das Ergebnis ab, sind die Abstände bereits auf 8/8/2/4 verringert; ein weiterer Rückweg ist ein Änderungswunsch an REQ-104 über den Owner, der Wortlaut bleibt unverändert.

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
Der Hinweis steht in **jedem** Fenster und Rahmen: normale Ansicht (Navigationsspalte), **schmale Ansicht von UI-019** (Streifen unten) und jedes weitere Browserfenster, das die Anwendung zeigt. Ausnahmen nur UI-001, UI-046 und LP-01 bis LP-03 (siehe uiux-design.md Kap. 3).

## Fenstergröße und Bedienung
- Normal: Spalte 208 px, siehe Ort. Schmal (480 px bis unter 1366 px, nur UI-019): Streifen, Streifen mit Rand 8 px (links, rechts, oben, unten) und Innenabstand 8 px: Textbreite 480 − 2 × 8 − 4 − 2 − 2 × 8 = **442 px**, etwa 71 Zeichen je Zeile (Schätzung 6,2 px). Zeilen: Aussage 2, „So geht es:“ 1, Schritt 1 1, Schritt 2 1, „Der Datenordner liegt hier:“ 1, Pfad 1 (Beispielpfad 45 Zeichen) bzw. 2 (ab 72 bis 100 Zeichen), „Wichtig …“ 2 = 9 bzw. **10 Zeilen**. Höhe: Rand oben 8 + Rahmen/Innenabstand 18 + Überschrift 24 + Zeilen × 16 + 3 × 2 + Button 32 + Rand unten 8 = **240 px (Beispielpfad)**, **256 px (Pfad 72 bis 100 Zeichen)**. Rechnung mit 5,9 bis 6,8 px je Zeichen ergibt dieselben 9 bis 10 Zeilen (Unsicherheit klein, höchstens eine Zeile mehr = 16 px). Verbleibende Höhe für Kopf, Kanal-Wahl, Fortschritt und Feldliste: bei 630 px nutzbarer Höhe **etwa 374 px**, bei Planungshöhe 600 px **etwa 344 px**; die Feldliste selbst bekommt davon nach Abzug des festen Kopfbereichs (nicht festgelegt, Schätzung etwa 110 px) etwa 264 bzw. 234 px und scrollt.
- Tastatur: Button in der Tab-Reihenfolge nach den Navigationseinträgen (normal) bzw. nach der Feldliste (schmal).
- Dialoge (modal) dunkeln den Rahmen ab; der Hinweis bleibt dabei in seiner Position sichtbar (abgedunkelt).

## Annahmen und offene Fragen
- **Entschieden (Product Owner, Review Runde 1, MAR-143): Auslegung AC-REQ-104-01 in UI-019 schmal.** Die wörtliche Fassung bleibt (vollständiger Text ohne weitere Nutzeraktion, auch im schmalen Fenster, Streifen etwa 256 px, A-1 v0.5.2). Eine Kurzfassung wäre eine Änderung von REQ-104, keine Auslegung. Zeigt der Test ein Platzproblem, ist das ein Änderungswunsch an REQ-104 über den Owner, keine Designentscheidung.
- Annahme: Der Hinweistext wird nicht gekürzt oder übersetzt; Wortlaut bestätigt der Owner (OP-17).
