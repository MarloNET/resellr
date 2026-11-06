# UI-044 – Hinweis „Sicherung einrichten“ (Anwendungsrahmen)

- Zweck: Dauerhafter Hinweis, dass resellr die Daten nicht selbst sichert, mit Speicherort des Datenordners und (nur Betrieb am Arbeitsplatzrechner) der Aktion „resellr beenden“.
- Flows: FLOW-10; wirkt in **jedem** Screen mit Anwendungsrahmen (alle außer UI-001, UI-046, LP-01 bis LP-03)
- Anforderungen: REQ-104, REQ-105, REQ-106; AC-REQ-104-01 bis -06, AC-REQ-105-01; Baseline Kap. 6.1 (Sicherungshinweis), Kap. 6.3 X-1
- Rollen: Nutzer · Gerät(e): PC ab 1366 × 768; schmale Ansicht UI-019 ab 480 px
- Artefakte: nur Text (Wortlaut `[Vorschlag BA]`, wird vom Owner mit der Requirements-Freigabe bestätigt; **Wortlaut der REQ-Texte nicht geändert**, hier nur Ort und Gestaltung)

## Ort (Entscheidung)
Der Hinweis ist Teil der **Anwendungsgrundstruktur** (App-Rahmen), nicht eines Screens. Er wird beim Laden des Rahmens gezeigt, also bei jedem Einstieg über jede Adresse (Start, Lesezeichen, Zurück/Vorwärts, Neuladen) und bei jedem Seitenwechsel. Kein Screen kann ihn weglassen.
- **Normale Ansicht (ab 1366 × 768):** unten in der linken Navigationsspalte (208 px), unter den Navigationseinträgen. Der Inhaltsbereich verliert dadurch **keine** Fläche. Begründung: die Navigation ist immer sichtbar (Kap. 3), die Arbeitsflächen bleiben frei.
- **Schmale Ansicht UI-019 (ab 480 px, keine Navigation):** fester Streifen am unteren Rand des Fensters, volle Breite, vollständiger Text (siehe unten).
- Reihenfolge der Navigationsspalte: Kopf „resellr“ · 6 Einträge · Hinweis. Höhe des Hinweises bei 184 px Textbreite: etwa 340 px; zusammen mit Kopf und Einträgen etwa 610 px, passt in die Fensterhöhe bei 1366 × 768 (etwa 635 px Seitenhöhe in Chrome). Ist das Fenster niedriger, scrollt die **ganze Navigationsspalte** (nicht der Hinweis allein); der Text bleibt vollständig und wird nie abgeschnitten oder eingeklappt.

## Angezeigte Daten
| Element | Inhalt | Quelle | Hinweise |
|---|---|---|---|
| Überschrift | „Sicherung einrichten“ mit Info-Symbol | REQ-104 | 14/20 semibold |
| Text | „resellr sichert Ihre Daten nicht selbst. Bitte sichern Sie sie regelmäßig selbst, zum Beispiel in OneDrive. So geht es: 1. resellr beenden. 2. Den Datenordner vollständig an Ihren Sicherungsort kopieren. Der Datenordner liegt hier: {Speicherort des Datenordners}. Wichtig: Eine Kopie, die bei laufendem resellr entsteht, kann unbrauchbar sein.“ | REQ-104 | Wortlaut unverändert; der Satz „So geht es“ und die zwei Schritte stehen in eigenen Zeilen (Zeilenumbruch, kein Wortlaut geändert); 12/16 Text, Mindestgröße 12 px |
| Speicherort | vollständiger Pfad des Datenordners (Beispiel: `C:\Users\Beispiel\AppData\Local\resellr\Daten`) | Betriebsstatus (Baseline 6.1) | **auswählbarer Text** (Dreifachklick markiert ihn), bricht an beliebiger Stelle um, kein Kopieren-Button, kein „Im Explorer öffnen“ (X-6) |
| Aktion | Button „resellr beenden“ | REQ-105 | nur im Betrieb nur am Arbeitsplatzrechner; Sekundärbutton (Rahmen), ganz unten im Hinweis |

Gestaltung: Fläche surface (#FFFFFF) mit 1 px Rahmen primary und 4 px linker Balken primary, Radius 6 px, Innenabstand 12 px, Abstand 12 px zum Spaltenrand. Keine neuen Tokens. Der Hinweis ist **kein Banner und kein Dialog**: kein „×“, kein „Schließen“, kein „Nicht mehr anzeigen“, kein Einklappen, kein Zähler.

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
| error | Speicherort nicht ermittelbar: Hinweis bleibt vollständig, an der Stelle des Pfades steht „Speicherort konnte nicht ermittelt werden.“ und die Referenznummer nach REQ-073 | nur Text | s. links |
| disabled | Button „resellr beenden“ deaktiviert, solange UI-045 offen ist oder das Beenden läuft | nur Text | – |
| Netzbetrieb (Variante B, nicht Standard) | derselbe Text, **ohne** Button (AC-REQ-104-06) | nur Text | – |
| empty, success, validation | n/a | – | – |
| `.unreachable`, `.wird-beendet` | wirken im Inhaltsbereich (Muster P-06/P-07); der Hinweis bleibt unverändert | – | – |

## Fenstergröße und Bedienung
- Normal: Spalte 208 px, siehe Ort. Schmal (480 px bis unter 1366 px, nur UI-019): Streifen, Textbreite 456 px, vollständiger Text etwa 6 Zeilen plus Pfad, Gesamthöhe etwa 180 px mit Button; Feldliste von UI-019 scrollt dazwischen.
- Tastatur: Button in der Tab-Reihenfolge nach den Navigationseinträgen (normal) bzw. nach der Feldliste (schmal).
- Dialoge (modal) dunkeln den Rahmen ab; der Hinweis bleibt dabei in seiner Position sichtbar (abgedunkelt).

## Annahmen und offene Fragen
- **Auslegungsfrage AC-REQ-104-01 in UI-019 schmal (an den Product Owner):** Das Design erfüllt die AC wörtlich (vollständiger Text, ohne Aktion, auch im schmalen Fenster), kostet dort aber etwa 180 von etwa 635 px Höhe. Alternative nur mit Auslegung: Im schmalen Fenster Überschrift und Kurzfassung plus Link zum Hauptfenster. Das erfüllt AC-REQ-104-01 nicht wörtlich, weil Aussagen (b) bis (d) und der Speicherort dann erst nach einer Aktion sichtbar wären. Empfehlung: wörtliche Fassung beibehalten, solange kein Platzproblem im Test auftritt.
- Annahme: Der Hinweistext wird nicht gekürzt oder übersetzt; Wortlaut bestätigt der Owner (OP-17).
