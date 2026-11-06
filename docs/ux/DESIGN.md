# DESIGN – resellr (Phase 1 / Release 0.1)

Status: **vorgeschlagen** (kein vorhandenes Designsystem, Requirements 10.4). Wird mit der Owner-Freigabe des Designs verbindlich.
Keine Markenbindung an notebookers.de (REQ-074). Keine Barrierefreiheitsvorgabe (E-3); die Kontraste unten sind Lesbarkeitsziele, keine Konformitätsaussage.

Charakter: ruhiges, dichtes Arbeitswerkzeug für einen PC (Tastatur und Maus, ab 1366 × 768). Helles Theme, wenig Dekoration, Informationen vor Optik.

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
Eckenradius 6 px (Felder, Buttons, Karten), Chips 4 px. 8er-Raster. Dichte: kompakt (Zeilenhöhe Tabelle 36 px, Feldhöhe 36 px). Linke Navigation 208 px fest; Inhaltsbereich fluide, Mindestbreite 1366 px. Kopier-Assistent zusätzlich als schmale Variante ab 480 px Breite (Baseline C-5, vom Software Architect zu prüfen).

## Komponentenregeln
- **Buttons:** je Bereich genau ein Primärbutton (gefüllt primary). Sekundär: Rahmen. Destruktiv (Storno, Löschen): Rahmen und Text error, Bestätigungsdialog. Button-Text beschreibt das Ergebnis („Freigeben“, „Gerät speichern“).
- **Formulare:** Label über dem Feld, Pflichtfelder mit „*“ und Hinweis im Kopf; Fehlertext unter dem Feld in error mit Symbol; Fehlerzusammenfassung oben bei Freigabe-Ablehnung. Tab-Reihenfolge = visuelle Reihenfolge; Enter im letzten Feld löst den Primärbutton aus.
- **Prüfmarkierung:** Feld mit Badge „zu prüfen“ (flag-warn) und Vorbelegungswert; Bestätigen per Häkchen-Button oder Ändern des Werts.
- **Tabellen:** Spaltenköpfe text-secondary, Zeilen-Hover bg, Sortierung nur wo in `screen.md` genannt, keine Paginierung unter 200 Zeilen (sonst Seiten à 50).
- **Chips/Badges:** Kanal-Status und Kennzeichnungen als Text-Chips (Status Kap. 9.4), ein Chip je Kennzeichnung.
- **Feedback:** Inline-Fehler am Feld; Banner oben im Inhaltsbereich für Seitenmeldungen (Erfolg, Fehler); Toast nur für „Ziel kopiert“ im Kopier-Assistenten (3 s). Technische Fehler: Banner mit Funktion, nächstem Schritt und Referenznummer (REQ-073).
- **Dialoge:** modal, Titel, Inhalt, Aktionen rechts unten (primär ganz rechts), Esc schließt (ohne Speichern).
- **Leerzustände:** ein Satz Erklärung und eine Aktion (aus `screen.md`).
- **Fokus:** sichtbarer 2-px-Ring primary mit 2 px Abstand.

## Barrierefreiheit
Keine Anforderung (E-3). Gute Lesbarkeit: Kontrastziele oben (≥ 4,5:1 Text), Mindest-Klickfläche 32 × 32 px, vollständige Tastaturbedienung der Häufigkeitsabläufe (Einbuchen, Freigeben, Kopier-Assistent) als Bedienkomfort, nicht als Konformitätsaussage.

## Nicht verwenden
- Kopf- und Navigationselemente, die nicht im Screen-Inventar stehen: Avatar/Profil, Benachrichtigungsglocke, globale Suche, Hamburger-Menü, Bottom-Navigation, Zahnrad im Kopf (Einstellungen stehen in der linken Navigation).
- Platzhalter-, Hilfe- oder Marketingtexte, die nicht in `screen.md` stehen.
- Kennzahlen, Diagramme, Dashboards, Badges ohne Grundlage in den Requirements, Footer.
- Verläufe, Schatten über Level 1, dekorative Animationen, Dark Mode.
- Mobile Layouts, Tablet-Varianten, Rollen- oder Konto-Elemente (E-2, E-4).
- Mehr als ein Primärbutton pro Bereich.
