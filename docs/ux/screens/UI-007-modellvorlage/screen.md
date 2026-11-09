# UI-007 – Modellvorlage anlegen/ändern

- Zweck: Modelldaten, Werte der Modell-Merkmale und Vorbelegungen der Gerät-Merkmale pflegen.
- Flows: FLOW-01 (Schritt 1), FLOW-06 (Schritt 1)
- Anforderungen: REQ-008, REQ-010, REQ-011, REQ-058 (Could), REQ-100
- Rollen: Nutzer · Gerät(e): PC
- Artefakte: default.png (Stitch 69e6f51ff7de415ca4632aca7d171b60, DESKTOP, 06.11.2026)

## Angezeigte Daten
Formular nach Geräteart: Felder aus Merkmalsdefinitionen; Bereich „Vorbelegungswerte für Geräte“ (optional). Beim Ändern Hinweis „Änderungen an Modelldaten wirken auf alle Modell-Inserate und Datenblätter dieser Modellvorlage.“ und „gilt für n Kanal-Inhalte im Geltungsbereich“ (Zahl im Geltungsbereich, Baseline Ä-32; die Gruppenzahlen „aktualisiert“, „zur erneuten Freigabe“, „manuell angepasst“ gibt es erst nach dem Speichern, REQ-053; keine Vorab-Berechnung). Beim Speichern gilt der Zustand `UI-007.speichert` (Muster P-08, K-4).

## Eingaben und Validierung
| Feld | Typ | Pflicht | Regel | Fehlermeldung |
|---|---|---|---|---|
| Geräteart | Auswahl | ja | aktive Geräteart; bei Modellvorlage mit Geräten gesperrt | „Geräteart kann nicht geändert werden, weil Geräte erfasst sind“ |
| Hersteller | Auswahl, Link „Neuen Hersteller anlegen“ | ja | aktive Hersteller | „Hersteller fehlt“ |
| Modellbezeichnung | Text | ja | max. 100 | „Modellbezeichnung: 1 bis 100 Zeichen“ |
| Typbezeichnung | Text | nein | max. 50 | „Typbezeichnung: höchstens 50 Zeichen“ |
| Herstellernummer | Text oder Kontrollkästchen „unbekannt“ | ja | 1–40 Zeichen, Buchstaben, Ziffern, „-“, „/“, „.“ | „Herstellernummer: Wert oder „unbekannt“ angeben“ (leer). **v0.6.2, O-4 (M-25, M-26; Wortlaut vom Designer, Owner bestätigt mit der Freigabe):** länger als 40 Zeichen: „Herstellernummer: höchstens 40 Zeichen“; unzulässiges Zeichen: „Herstellernummer: nur Buchstaben, Ziffern und die Zeichen - / . erlaubt“. Beide am Feld; sind Länge und Zeichen zugleich verletzt, erscheint nur die Längenmeldung (eine Meldung je Feld, wie in den übrigen Feldern); erst nach Kürzen folgt gegebenenfalls die Zeichenmeldung |
| Original-EAN | Text | nein | 8 oder 13 Ziffern, gültige Prüfziffer | „EAN: 8 oder 13 Ziffern mit gültiger Prüfziffer“ |
| Merkmale Ebene Modell | je Datentyp | je Definition | Typ/Wertebereich | „<Merkmal>: <Regel>“ |
| Vorbelegungswerte Ebene Gerät | je Datentyp | nein | | wie oben |

## Aktionen
| Aktion | Auslöser | Voraussetzung | Ergebnis bei Erfolg | Ergebnis bei Fehler | Navigation danach |
|---|---|---|---|---|---|
| Modellvorlage speichern | Primärbutton, Strg+S | gültig | Banner „Modellvorlage gespeichert“ | Feldfehler, fehlende Felder benannt | Aufrufseite (UI-003 oder UI-006) |
| Hinweis „mögliche Dublette“ | beim Speichern bei gleichem Hersteller + Modellbezeichnung | – | Dialog `UI-007.dublette` (Wortlaut siehe „Dialoge“) mit Treffern: „Vorhandene verwenden“ / „Trotzdem anlegen“ (REQ-011) | – | |
| Warnung gleiche Herstellernummer (**Could, REQ-058, nur wenn REQ-058 in den Umfang kommt**) | beim Speichern (Anlegen und Ändern), nur bei nicht „unbekannt“ | – | Dialog `UI-007.mpn-warnung` (Wortlaut siehe „Dialoge“); „Trotzdem speichern“ speichert (AC-REQ-058-01) | – | |
| Löschen | Textbutton | | UI-041 | | UI-041 |
| Abbrechen | Button | – | verwerfen | – | Aufrufseite |

## Dialoge (v0.6.2)
Beide Dialoge sind modal, Muster P-04 (Breite 480 px, bei schmalerem Fenster Fensterbreite abzüglich 16 px Rand, nie höher als das Fenster, Titel und Aktionsleiste sichtbar, Inhalt scrollt; Esc = „Abbrechen“ bzw. Schließen ohne Speichern).

**`UI-007.dublette` (REQ-011, O-5, M-27).** Titel „Mögliche Dublette“. Text exakt: „Es gibt bereits eine Modellvorlage mit gleichem Hersteller und gleicher Modellbezeichnung.“ Darunter die Treffer (Hersteller, Modellbezeichnung, Herstellernummer). Knöpfe und Verhalten unverändert: „Vorhandene verwenden“ und „Trotzdem anlegen“ (nichts anderes ist neu).

**`UI-007.mpn-warnung` (REQ-058, O-6, M-28; Could, nur wenn REQ-058 in den Umfang kommt; Wortlaut vom Designer, Owner bestätigt mit der Freigabe).** Titel „Gleiche Herstellernummer“. Text: „Es gibt bereits eine Modellvorlage mit gleicher Herstellernummer.“ Darunter die Treffer (Hersteller, Modellbezeichnung, Herstellernummer; Verweis auf die Modellvorlage nach AC-REQ-058-01). Knöpfe: „Abbrechen“ (links; zurück ins Formular, nichts gespeichert), „Trotzdem speichern“ (rechts, Primär, nicht destruktiv). Fokus beim Öffnen auf „Abbrechen“. Verhalten (Specification `confirmation_required` / `mpn_in_use`): „Trotzdem speichern“ speichert die Modellvorlage, Banner „Modellvorlage gespeichert“, Navigation wie „Speichern“. Während des Speicherns gilt `UI-007.speichert` (P-08). Erscheinen Dublette und gleiche Herstellernummer zugleich, kommt zuerst `UI-007.dublette`, danach `UI-007.mpn-warnung`.

## Zustände
| Zustand | Darstellung | Artefakt | Text |
|---|---|---|---|
| default | leeres bzw. gefülltes Formular | nur Text | – |
| loading | Platzhalter | nur Text | „Lade Modellvorlage …“ |
| empty | n/a | – | – |
| `UI-007.speichert` (wird gespeichert) | Speicherknopf und alle Eingaben gesperrt bis zur Antwort, Anzeige „Speichern …“, **kein festes Timeout** (Muster P-08); bei Verbindungsverlust „Ausgang unbekannt, bitte neu laden“ | nur Text | „Speichern …“ |
| error | Banner | nur Text | „Modellvorlage konnte nicht gespeichert werden. Referenz: <Nr>“ |
| validation | Feldfehler | nur Text | siehe oben |
| success | Banner | nur Text | |
| disabled | Geräteart gesperrt | nur Text | |

## Fenstergröße und Bedienung
Zweispaltiges Formular ab 1366 px, Modell- und Vorbelegungsbereich getrennt. Unter 1366 CSS-px (Zoom, schmaleres Fenster) gilt die Reflow-Regel R-1 (uiux-design.md Kap. 5, DESIGN.md).

## Bekannte Abweichungen im Mockup
Das Mockup zeigt den Zustand „ändern“ mit gesperrter Geräteart. „Betroffene Modell-Inserate: 3“ steht im Hinweisbanner (Anzahl laut `screen.md`). Die Beispielwerte der Merkmale (Bildschirmdiagonale, Auflösung) sind fiktiv und hängen von den Merkmalsdefinitionen der Geräteart ab. Bereich unterhalb „Auflösung“ liegt hinter der Sticky-Leiste (Scrollbereich).

## Annahmen und offene Fragen
- REQ-058 ist Could; **v0.6.2:** Darstellung als Bestätigungsdialog `UI-007.mpn-warnung` statt reinem Hinweis, weil die Specification `confirmation_required` mit Bestätigung vorsieht (Änderung gegenüber v0.6.1, im Freigabe-Briefing genannt). Entfällt, wenn REQ-058 nicht in den Umfang kommt.
