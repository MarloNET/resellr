# UI-002 – Inserat-Übersicht

- Zweck: Alle Modell-Inserate mit Kanal-Status und Kennzeichnungen sehen, filtern und öffnen.
- Flows: FLOW-03 (Schritt 2), FLOW-06
- Anforderungen: REQ-052, REQ-046, REQ-045, REQ-090; AC-REQ-046-07
- Rollen: Nutzer (einzige Rolle, alle Funktionen)
- Gerät(e): PC, Fenster frei in der Größe, Untergrenze 1366 × 768 (REQ-077)
- Artefakte: default.png (Stitch-Screen 12c22468330840bcbcc2ee31ac74efb0, DESKTOP, 06.11.2026)

## Angezeigte Daten
| Element | Inhalt | Quelle (fachlich) | Hinweise |
|---|---|---|---|
| Titel | ungekürzter Titel nach Titelmuster der Geräteart (Kap. 9.3), Zeile darunter „Geräteart · Zustand · Optik N“ sowie alle weiteren Variantenangaben nach der Vergleichsregel (Kap. 6.0, REQ-005): Werte der Variantenmerkmale (z. B. „16 GB RAM · 512 GB SSD · QWERTZ“) und die Zustandsbeschreibung (erste Zeile, gekürzt; vollständig im Tooltip). Grund: Modell-Inserate derselben Modellvorlage unterscheiden sich nur durch diese Angaben und müssen in der Liste unterscheidbar sein | Modell-Inserat | Spalte mindestens 40 % der Tabellenbreite, höchstens 3 Zeilen sichtbar, voller Text als Tooltip |
| Stückzahl | Zahl; bei 0 zusätzlich Chip „ausverkauft“ | Bestandsangabe | |
| Verkauft | „Shop / Kleinanzeigen / eBay“ als Zahlen | verkaufte Geräte je Kanal | |
| Kanal-Spalten | je aktivem Kanal: Status-Chip (Entwurf, Freigegeben, Veröffentlicht, Beendet) und Kennzeichnungen als Chips, darunter je Zeile „Daten geändert, manuell angepassten Text prüfen“ bei manuell angepasstem Titel/Beschreibung nach einer Datenänderung (REQ-052, Kap. 9.4; es gibt dafür **keinen Filter**, Filter-Chips siehe Eingaben); bei „Veröffentlicht“ „Abgleich TT.MM.JJJJ“ (letzter Abgleich) | Kanal-Inhalt (freigegebener Stand bei Änderungsentwurf) | Kanal-Spalten folgen der Reihenfolge der aktiven Kanäle |
| Zähler | „n Modell-Inserate“ unter der Tabelle | | |

## Eingaben und Validierung
| Feld | Typ | Pflicht | Regel | Fehlermeldung |
|---|---|---|---|---|
| Suche | Text | nein | sucht WI-Nr, Hersteller, Modellbezeichnung, Teilübereinstimmung, ohne Groß-/Kleinschreibung | – |
| Geräteart | Auswahl | nein | „Alle“ oder aktive und deaktivierte Gerätearten | – |
| Kanal-Status | Auswahl | nein | Alle, Entwurf, Freigegeben, Veröffentlicht, Beendet | – |
| Filter-Chips | Umschalter | nein | „Stückzahl 0“, „Geändert seit Freigabe“, „Änderung auf Kanal übertragen“, „Bestand auf Kanal anpassen“; mehrere kombinierbar (UND) | – |

## Aktionen
| Aktion | Auslöser | Voraussetzung | Ergebnis bei Erfolg | Ergebnis bei Fehler | Navigation danach |
|---|---|---|---|---|---|
| Inserat öffnen | Klick/Enter auf Zeile | – | – | – | UI-014 |
| Gerät einbuchen | Primärbutton | – | – | – | UI-003 |
| Filter anwenden | Änderung eines Filters/Eingabe (nach 300 ms) | – | Liste aktualisiert | Fehlerbanner (`.error`) | bleibt |

## Zustände
| Zustand | Darstellung | Artefakt | Text |
|---|---|---|---|
| default | Tabelle gefüllt | default.png | – |
| loading | Tabellenzeilen als Platzhalter | nur Text | „Lade Inserate …“ |
| empty | Kein Modell-Inserat vorhanden | nur Text | „Noch keine Modell-Inserate“ und Button „Gerät einbuchen“ |
| empty (Filter) | keine Treffer | nur Text | „Keine Treffer“ und Link „Filter zurücksetzen“ |
| error | Banner | nur Text | „Inserate konnten nicht geladen werden. Bitte erneut versuchen. Referenz: <Nr>“ (REQ-073) |
| validation | – | n/a | Suche mit < 2 Zeichen filtert nicht, kein Fehler |

## Fenstergröße und Bedienung
Fenster frei in der Größe, Untergrenze 1366 × 768 (REQ-077, keine feste Planungsgröße); Titelspalte nimmt Restbreite. Fokus startet im Suchfeld; Pfeil auf/ab wählt Zeile, Enter öffnet. Keine Barrierefreiheitsanforderung (E-3).

## Bekannte Abweichungen im Mockup
Untertitel „Business Portal“ unter „resellr“ (von Stitch erzeugt, kein Teil des Designs); Platzhaltertext „Modell, Spezifikation…“ im Suchfeld (nicht in screen.md, entfällt); Titelspalte im Mockup zu schmal (7 Zeilen), Soll siehe „Hinweise“; Beispielzeilen 4/5 zeigen „Notebook“ als Geräteart für PC/Tablet (nur Beispieldaten); Navigationssymbole von Stitch gewählt (Symbolwahl offen, nicht verbindlich).

## Annahmen und offene Fragen
- Annahme: Seiten à 50 Zeilen ab 200 Treffern (Datenvolumen A-12: bis 3.000 Modell-Inserate).
- Annahme: Sortierung nach letzter Änderung absteigend; keine Spaltensortierung in Release 0.1.

- **Mockup `hinweis.png` (v0.4.1, UI-044 im Rahmen):** zeigt den Hinweis unten in der linken Spalte. Abweichungen (Stitch-Zusätze, kein Teil des Designs): Zusatz „BUSINESS PORTAL“ am Kopf, Untertitel „Übersicht aller erfassten …“, Fußzeile „4 Datensätze geladen / Automatische Synchronisation aktiv“, Navigationseinträge höher als 28 px, Pfad in Monospace mit Zeilenumbruch mitten im Wort (4 Zeilen, entspricht dem Fall Pfad etwa 80 Zeichen), Warnzeile „Wichtig“ gelb hinterlegt (Gestaltungsvariante, nicht verbindlich). Abstände (v0.5.2): das Mockup zeigt noch die früheren Abstände (12 px Rand, 12 px Innenabstand); verbindlich sind 8 px/8 px und die Rechnung in `screen.md` von UI-044 (588 px bei Pfad 100 Zeichen). Verbindlich sind `screen.md` von UI-044 und das dortige Abnahmekriterium. **Seit v0.6 nicht mehr verbindlich:** die festen Maße im Mockup und die frühere Pixelrechnung (588 px, Fenster 1366 × 768); das Fenster ist in der Größe frei, bei wenig Höhe scrollt die Navigationsspalte unter dem festen Kopf. Kein „×“, kein Schließen, keine weiteren Elemente im Hinweis.
