# DESIGN – resellr (Phase 1 / Release 0.1)

Status: **vorgeschlagen** (kein vorhandenes Designsystem, Requirements 10.4). Wird mit der Owner-Freigabe des Designs verbindlich.
Keine Markenbindung an notebookers.de (REQ-074). Keine Barrierefreiheitsvorgabe (E-3); die Kontraste unten sind Lesbarkeitsziele, keine Konformitätsaussage.

Charakter: ruhiges, dichtes Arbeitswerkzeug für einen PC (Tastatur und Maus, Fenstergröße frei, Untergrenze 1366 × 768 nach REQ-077; die Oberfläche passt sich an). Helles Theme, wenig Dekoration, Informationen vor Optik.

## Farben
| Token | Hex | Rolle |
|---|---|---|
| bg | #F6F7F9 | Fensterhintergrund |
| surface | #FFFFFF | Karten, Tabellen, Formulare |
| border | #D1D5DB | Rahmen, Trenner (Eingabefelder zusätzlich 1 px #9CA3AF) |
| text | #1F2937 | Haupttext |
| text-secondary | #4B5563 | Hilfstexte, Spaltenköpfe |
| primary | #1D4ED8 | primäre Aktion, Links, Fokus |
| on-primary | #FFFFFF | Text auf primary |
| status-draft | #374151 auf #E5E7EB | Kanal-Status Entwurf, Beendet |
| status-approved | #1E40AF auf #DBEAFE | Kanal-Status Freigegeben |
| status-published | #166534 auf #DCFCE7 | Kanal-Status Veröffentlicht |
| flag-warn | #92400E auf #FEF3C7 | Kennzeichnungen (geändert seit Freigabe, Bestand auf Kanal anpassen, Änderung auf Kanal übertragen, Prüfmarkierung) |
| error | #B42318 auf #FEE4E2 | Fehler, Validierung, abgelehnte Freigabe |

Gemessene Kontraste (Skript): text/bg 13,7; text-secondary/surface 7,6; primary/surface 6,7; success 6,5; warn 6,4; error 5,5; info 7,2; neutral 8,3.
Status und Kennzeichnungen werden immer mit Text ausgeschrieben, nie nur durch Farbe.

## Typografie
Inter für Überschriften und Text; Zahlen in Tabellen mit tabellarischen Ziffern. Skala: Seitentitel 22/28 semibold, Abschnitt 16/24 semibold, Text 14/20, Hilfstext/Label 12/16. Mindestgröße 12 px. Ausgabetexte der Kanal-Inhalte (Titel, Beschreibung, Kopierwert) in Monospace-freier Inter 14 px, Zeilenumbrüche sichtbar.

## Form und Dichte
Eckenradius 6 px (Felder, Buttons, Karten), Chips 4 px. 8er-Raster. Dichte: kompakt (Zeilenhöhe Tabelle 36 px, Feldhöhe 36 px). Linke Navigation 208 px breit, Höhe folgt dem Fenster (Kopf „resellr“ 40 px **fest**, darunter ein Bereich mit den Einträgen (je 28 px, kompakte Dichte) und dem Hinweis UI-044; bei wenig Höhe scrollt dieser Bereich senkrecht, bei viel Höhe steht der Hinweis am unteren Spaltenrand; Variante A, kein Einklappen). Hinweis-Maße: Rand 8 px, Innenabstand 8 px, Rahmen 1 px, Balken 4 px, Absatzabstand 2 px, Abstand zu den Einträgen 4 px, Button 32 px, Text mindestens 12 px; Pixelrechnungen sind keine Abnahmegrundlage. Inhaltsbereich fluide, Breite fluide. **Fenstergröße (Ä-28, v0.6):** Gemeint ist die Mindestgröße des Fensters (REQ-077, 1366 × 768) als Untergrenze; Höhe und Breite sind frei, das Layout passt sich an, nichts ist auf einen Bildschirm zugeschnitten (kein festes Maß 1350 × 630 px). Seitenzoom bis 150 % ist zu unterstützen. Lange Formulare und Dialoge: Inhalt scrollt, Titel und Aktionsleiste (Speichern, Freigeben, Dialog-Buttons) bleiben fest sichtbar. Kopier-Assistent zusätzlich als schmale Variante ab 480 px Breite (Umschalter im selben Fenster, ADR-001; Mindestbreite 480 px bleibt Abnahmepunkt des Architekten, Baseline C-5). **Abnahmegrundlage für Rahmen und Hinweis:** „Kein Inhalt und keine Aktion ist unerreichbar“ (siehe UI-044).

## Komponentenregeln
- **Buttons:** je Bereich genau ein Primärbutton (gefüllt primary). Sekundär: Rahmen. Destruktiv (Storno, Löschen): Rahmen und Text error, Bestätigungsdialog. Button-Text beschreibt das Ergebnis („Freigeben“, „Gerät speichern“).
- **Formulare:** Label über dem Feld, Pflichtfelder mit „*“ und Hinweis im Kopf; Fehlertext unter dem Feld in error mit Symbol; Fehlerzusammenfassung oben bei Freigabe-Ablehnung. Tab-Reihenfolge = visuelle Reihenfolge; Enter im letzten Feld löst den Primärbutton aus.
- **Prüfmarkierung:** Feld mit Badge „zu prüfen“ (flag-warn) und Vorbelegungswert; Bestätigen per Häkchen-Button oder Ändern des Werts.
- **Tabellen:** Spaltenköpfe text-secondary, Zeilen-Hover bg, Sortierung nur wo in `screen.md` genannt, keine Paginierung unter 200 Zeilen (sonst Seiten à 50).
- **Chips/Badges:** Kanal-Status und Kennzeichnungen als Text-Chips (Status Kap. 9.4), ein Chip je Kennzeichnung.
- **Feedback:** Inline-Fehler am Feld; Banner oben im Inhaltsbereich für Seitenmeldungen (Erfolg, Fehler); Toast nur für „Ziel kopiert“ im Kopier-Assistenten (3 s). Technische Fehler: Banner mit Funktion, nächstem Schritt und Referenznummer (REQ-073).
- **Speichern mit Neuberechnung (K-4):** Speicherknopf und Eingaben gesperrt bis zur Antwort, Anzeige „Speichern …“, kein festes Timeout (Muster P-08, `uiux-design.md`). Die 5-Sekunden-Regel gilt nur für Laden.
- **Dialoge:** modal, Höhe nie größer als die Fensterhöhe abzüglich Rand (Inhalt scrollt; Titel und Aktionsleiste bleiben sichtbar), Titel, Inhalt, Aktionen rechts unten (primär ganz rechts), Esc schließt (ohne Speichern).
- **Reflow-Regel R-1 (v0.6):** Unter 1366 CSS-px Breite (Seitenzoom 125 %/150 % oder schmaleres Fenster) gilt für alle Screens: (1) mehrspaltige Bereiche stapeln einspaltig in Leserichtung (Spalten, Kanal-Karten, Formularspalten, Einstellungs-Liste über dem Inhalt); (2) Tabellen und breite Vergleiche scrollen waagrecht **in ihrem eigenen Bereich**, die Seite selbst scrollt nicht waagrecht; die erste Spalte (Bezeichnung) bleibt fixiert; (3) Seitenpanels überlagern den Inhalt als Fläche mit „Schließen“; (4) Kopf- und Aktionsleisten bleiben erreichbar (Aktionen dürfen umbrechen); (5) kein Inhalt und keine Aktion entfällt oder wird gekürzt, Text mindestens 12 px. Gewährleistet bis 910 CSS-px Breite (Zoom 150 % an der Untergrenze REQ-077). Die Stellen „ab 1366 px“ in den `screen.md` beschreiben das Layout oberhalb dieser Grenze; darunter gilt R-1.
- **Leerzustände:** ein Satz Erklärung und eine Aktion (aus `screen.md`).
- **Fokus:** sichtbarer 2-px-Ring primary mit 2 px Abstand.

## Barrierefreiheit
Keine Anforderung (E-3). Gute Lesbarkeit: Kontrastziele oben (≥ 4,5:1 Text), Mindest-Klickfläche 32 × 32 px, Schaltfläche „×“ im Seitenbanner (PageBanner) hat den zugänglichen Namen (Screenreader-Text, aria-label) „Meldung schließen“ (Klarstellung MAR-283), vollständige Tastaturbedienung der Häufigkeitsabläufe (Einbuchen, Freigeben, Kopier-Assistent) als Bedienkomfort, nicht als Konformitätsaussage.

## Nicht verwenden
- Kopf- und Navigationselemente, die nicht im Screen-Inventar stehen: Avatar/Profil, Benachrichtigungsglocke, globale Suche, Hamburger-Menü, Bottom-Navigation, Zahnrad im Kopf (Einstellungen stehen in der linken Navigation).
- Platzhalter-, Hilfe- oder Marketingtexte, die nicht in `screen.md` stehen.
- Kennzahlen, Diagramme, Dashboards, Badges ohne Grundlage in den Requirements, Footer.
- Verläufe, Schatten über Level 1, dekorative Animationen, Dark Mode.
- Mobile Layouts, Tablet-Varianten, Rollen- oder Konto-Elemente (E-2, E-4).
- Mehr als ein Primärbutton pro Bereich.
