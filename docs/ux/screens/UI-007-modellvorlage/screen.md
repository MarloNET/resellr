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
| Geräteart | Auswahl, Platzhalter „Bitte wählen“ (v0.6.7) | ja | aktive Geräteart; bei Modellvorlage mit Geräten gesperrt | „Geräteart fehlt“ (v0.6.7, keine Wahl); „Geräteart kann nicht geändert werden, weil Geräte erfasst sind“; Ablehnung wegen Deaktivierung: „Geräteart <Name> ist deaktiviert“ (siehe „Auswahl nach Ablehnung“) |
| Hersteller | Auswahl, Platzhalter „Bitte wählen“ (v0.6.7), Link „Neuen Hersteller anlegen“ | ja | aktive Hersteller | „Hersteller fehlt“; Ablehnung wegen Deaktivierung: „Hersteller <Name> ist deaktiviert“ (siehe „Auswahl nach Ablehnung“) |
| Modellbezeichnung | Text | ja | max. 100 | „Modellbezeichnung: 1 bis 100 Zeichen“ |
| Typbezeichnung | Text | nein | max. 50 | „Typbezeichnung: höchstens 50 Zeichen“ |
| Herstellernummer | Text oder Kontrollkästchen „unbekannt“ | ja | 1–40 Zeichen, Buchstaben, Ziffern, „-“, „/“, „.“ | „Herstellernummer: Wert eingeben oder ‚unbekannt‘ wählen“ (leer; **v0.6.3, DG-17:** Wortlaut wie AC-REQ-008-02). **v0.6.2, O-4 (M-25, M-26; Wortlaut vom Designer, Owner bestätigt mit der Freigabe):** länger als 40 Zeichen: „Herstellernummer: höchstens 40 Zeichen“; unzulässiges Zeichen: „Herstellernummer: nur Buchstaben, Ziffern und die Zeichen - / . erlaubt“. Beide am Feld; sind Länge und Zeichen zugleich verletzt, erscheint nur die Längenmeldung (eine Meldung je Feld, wie in den übrigen Feldern); erst nach Kürzen folgt gegebenenfalls die Zeichenmeldung |
| Original-EAN | Text | nein | 8 oder 13 Ziffern, gültige Prüfziffer | „EAN: 8 oder 13 Ziffern mit gültiger Prüfziffer“ |
| Merkmale Ebene Modell | je Datentyp | je Definition | Typ/Wertebereich | „<Merkmal>: <Regel>“ (Wortlaut je Datentyp: meldungskatalog.md, Ergänzung v0.6.13, MAR-548); **fehlt der Wert eines Pflichtmerkmals (v0.6.4, REQ-005, AC-REQ-005-12 a, M-32): „<Merkmal> fehlt“** (z. B. „Prozessor fehlt“) am Feld, wie die übrigen Pflichtangaben (z. B. „Hersteller fehlt“); das Feld ist mit „*“ als Pflicht gekennzeichnet und wird mit Fehler markiert. Gilt auch, wenn die Änderung ein anderes Feld betrifft: das Pflichtmerkmal kann nach dem Wieder-Aktivieren (UI-027, AC-REQ-005-12) wieder als leeres Feld erscheinen; Fokus auf das erste markierte Feld, nichts gespeichert (M-32). Beispiel: Modellvorlage „ThinkPad T14“ ohne Prozessor, Prozessor wieder aktiviert, der Nutzer ändert nur die Typbezeichnung: Speichern wird abgelehnt mit „Prozessor fehlt“ am Feld Prozessor; nach Eintragen wird gespeichert. **Auswahlmerkmal nach Ablehnung wegen Deaktivierung (v0.6.10, MAR-986, DG-20): „<Merkmal>: <Wert> ist deaktiviert“ am Feld, siehe „Auswahl nach Ablehnung und vor der ersten Wahl“, Punkt „Auswahlmerkmale“** |
| Vorbelegungswerte Ebene Gerät | je Datentyp | nein | | wie oben; Auswahlmerkmal nach Ablehnung wegen Deaktivierung: „<Merkmal>: <Wert> ist deaktiviert“ am Feld (v0.6.10, MAR-986, DG-20, Punkt „Auswahlmerkmale“) |

## Aktionen
| Aktion | Auslöser | Voraussetzung | Ergebnis bei Erfolg | Ergebnis bei Fehler | Navigation danach |
|---|---|---|---|---|---|
| Modellvorlage speichern | Primärbutton, Strg+S | gültig | Banner „Modellvorlage gespeichert“ | Feldfehler, fehlende Felder benannt (auch ein wieder aktiviertes Pflichtmerkmal ohne Wert, M-32) | Aufrufseite (UI-003 oder UI-006) |
| Hinweis „mögliche Dublette“ | beim Speichern bei gleichem Hersteller + Modellbezeichnung | – | Dialog `UI-007.dublette` (Wortlaut siehe „Dialoge“) mit Treffern: „Vorhandene verwenden“ / „Trotzdem anlegen“ (REQ-011) | – | |
| Warnung gleiche Herstellernummer (**Could, REQ-058, nur wenn REQ-058 in den Umfang kommt**) | beim Speichern (Anlegen und Ändern), nur bei nicht „unbekannt“ | – | Dialog `UI-007.mpn-warnung` (Wortlaut siehe „Dialoge“); „Trotzdem speichern“ speichert (AC-REQ-058-01) | – | |
| Löschen | Textbutton | | UI-041 | | UI-041 |
| Abbrechen | Button | – | verwerfen | – | Aufrufseite |

## Dialoge (v0.6.2)
Beide Dialoge sind modal, Muster P-04 (Breite 480 px, bei schmalerem Fenster Fensterbreite abzüglich 16 px Rand, nie höher als das Fenster, Titel und Aktionsleiste sichtbar, Inhalt scrollt; Esc = „Abbrechen“ bzw. Schließen ohne Speichern).

**`UI-007.dublette` (REQ-011, O-5, M-27).** Titel „Mögliche Dublette“. Text exakt: „Es gibt bereits eine Modellvorlage mit gleichem Hersteller und gleicher Modellbezeichnung.“ Darunter die Treffer (Hersteller, Modellbezeichnung, Herstellernummer). Knöpfe und Verhalten unverändert: „Vorhandene verwenden“ und „Trotzdem anlegen“ (nichts anderes ist neu).

**`UI-007.mpn-warnung` (REQ-058, O-6, M-28; Could, nur wenn REQ-058 in den Umfang kommt; Wortlaut vom Designer, Owner bestätigt mit der Freigabe).** Titel „Gleiche Herstellernummer“. Text: „Es gibt bereits eine Modellvorlage mit gleicher Herstellernummer.“ Darunter die Treffer (Hersteller, Modellbezeichnung, Herstellernummer; Verweis auf die Modellvorlage nach AC-REQ-058-01). Knöpfe: „Abbrechen“ (links; zurück ins Formular, nichts gespeichert), „Trotzdem speichern“ (rechts, Primär, nicht destruktiv). Fokus beim Öffnen auf „Abbrechen“. Verhalten (Specification `confirmation_required` / `mpn_in_use`): „Trotzdem speichern“ speichert die Modellvorlage, Banner „Modellvorlage gespeichert“, Navigation wie „Speichern“. Während des Speicherns gilt `UI-007.speichert` (P-08). Erscheinen Dublette und gleiche Herstellernummer zugleich, kommt zuerst `UI-007.dublette`, danach `UI-007.mpn-warnung`.

## Auswahl nach Ablehnung und vor der ersten Wahl (v0.6.7, MAR-923, FIND-397-04)
- **Platzhalter.** Geräteart und Hersteller zeigen einheitlich den Platzhalter „Bitte wählen“: beim Öffnen von „Modellvorlage anlegen“ und nach einer Ablehnung wegen Deaktivierung (`device_type_deactivated`, `manufacturer_deactivated`), wenn der gewählte Eintrag nach dem Neuladen beider Listen fehlt. Kein Eintrag wird vorausgewählt, der Wert ist leer, es wird keine ID gesendet; der Platzhalter ist nicht wählbar.
- **Meldung.** Die Ablehnungsmeldung („Geräteart <Name> ist deaktiviert“ bzw. „Hersteller <Name> ist deaktiviert“) bleibt am Feld stehen, bis der Nutzer einen aktiven Eintrag wählt; Fokus auf das Feld, nichts gespeichert. Speichern ohne Wahl: „Geräteart fehlt“ bzw. „Hersteller fehlt“.
- **Merkmalsbereiche.** Solange keine Geräteart gewählt ist (frisches Formular und nach Ablehnung), zeigen „Merkmale“ und „Vorbelegungswerte für Geräte“ statt der Felder den Hinweis „Geräteart wählen, dann erscheinen die Merkmale“.
- **Eingaben.** Hersteller, Modellbezeichnung, Typbezeichnung, Herstellernummer (mit „unbekannt“) und Original-EAN bleiben erhalten. Werte der Merkmals- und Vorbelegungsfelder der abgelehnten Geräteart werden verworfen (Merkmale sind je Geräteart definiert; keine Rückfrage, keine Übernahme); dieselbe Regel gilt beim normalen Wechsel der Geräteart.
- **Ändern.** Gleiche Regel ohne Rückfall auf den gespeicherten Wert. Der gespeicherte (ggf. deaktivierte) Eintrag bleibt in der Liste wählbar. Bei gesperrter Geräteart entsteht die Ablehnung für Geräteart nicht.
- **Auswahlmerkmale (v0.6.10, MAR-986, DG-20).** Die Regel gilt unverändert auch für die Auswahlmerkmale (Datentyp *Auswahl aus Liste*) in „Merkmale“ und „Vorbelegungswerte für Geräte“ nach `pick_list_value_deactivated` (Verwendung `.attribute`), sobald ein gewählter Listeneintrag nach dem Neuladen fehlt. Abweichungen gibt es nicht, nur diese Anwendung auf das Merkmalsfeld:
  - **Anzeige.** Pflichtmerkmal (nur „Merkmale“; Vorbelegungswerte haben keine Pflicht): Platzhalter „Bitte wählen“, nicht wählbar. Merkmal ohne Pflicht (alle Vorbelegungswerte und nicht verlangte Merkmale): leere Wahl. Kein Eintrag vorausgewählt, die abgelehnte ID wird nie erneut gesendet. Der Eintrag trägt im Feld keinen Zusatz „(deaktiviert)“.
  - **Meldung.** „<Merkmal>: <Wert> ist deaktiviert“ (z. B. „Tastaturlayout: Ungarisch ist deaktiviert“; Wert aus der Liste vor dem Neuladen) am Feld, bis der Nutzer im Feld wählt, bei einem Merkmal ohne Pflicht auch die leere Wahl. Jedes betroffene Feld trägt seine Meldung, nicht nur das erste. Fokus auf das erste markierte Feld in Formularreihenfolge, nichts gespeichert, alle übrigen Eingaben bleiben. Speichern ohne Wahl: bei Pflichtmerkmal „<Merkmal> fehlt“, sonst kein Fehler.
  - **Ändern.** Kein Rückfall auf den gespeicherten Wert. Der gespeicherte, ggf. deaktivierte Eintrag bleibt in der Liste wählbar (dort mit „(deaktiviert)“ gekennzeichnet, wie in UI-003) und wird unverändert ohne Ablehnung gespeichert. Zusatz „(deaktiviert)“ nur für den gespeicherten Eintrag. Ein im Entwurf gewählter, noch nicht abgelehnter Eintrag, der nach einem Neuladen deaktiviert ist, bleibt gewählt und ohne Zusatz angeboten; Speichern führt zur Ablehnung nach DG-19.

## Zustände
| Zustand | Darstellung | Artefakt | Text |
|---|---|---|---|
| default | leeres bzw. gefülltes Formular | nur Text | – |
| loading | Platzhalter | nur Text | „Lade Modellvorlage …“ |
| empty | n/a | – | – |
| `UI-007.speichert` (wird gespeichert) | Speicherknopf und alle Eingaben gesperrt bis zur Antwort, Anzeige „Speichern …“, **kein festes Timeout** (Muster P-08); bei Verbindungsverlust „Ausgang unbekannt, bitte neu laden“ | nur Text | „Speichern …“ |
| error | Banner | nur Text | „Modellvorlage konnte nicht gespeichert werden. Referenz: <Nr>“ |
| `UI-007.ladefehler` (Gerätearten oder Hersteller konnten beim Öffnen nicht geladen werden) | Banner oben im Formular, nur Text; das Formular bleibt leer und „Speichern“ gesperrt, „Abbrechen“ bedienbar; kein Neuladen-Knopf, Neuladen der Seite genügt (wie UI-002, UI-017) | nur Text | „Gerätearten und Hersteller konnten nicht geladen werden. Bitte Seite neu laden. Referenz: <Nr>“ (Muster „… konnte nicht geladen werden. Referenz: <Nr>“ wie UI-010, UI-024; zeigt nie den Text der Speicheraktion, weil nichts gespeichert wurde) |
| validation | Feldfehler | nur Text | siehe oben; Auswahlmerkmale nach Ablehnung: Abschnitt „Auswahl nach Ablehnung und vor der ersten Wahl“, Punkt „Auswahlmerkmale“ |
| success | Banner | nur Text | |
| disabled | Geräteart gesperrt | nur Text | |

## Fenstergröße und Bedienung
Zweispaltiges Formular ab 1366 px, Modell- und Vorbelegungsbereich getrennt. Unter 1366 CSS-px (Zoom, schmaleres Fenster) gilt die Reflow-Regel R-1 (uiux-design.md Kap. 5, DESIGN.md).

## Bekannte Abweichungen im Mockup
Das Mockup zeigt den Zustand „ändern“ mit gesperrter Geräteart. „Betroffene Modell-Inserate: 3“ steht im Hinweisbanner (Anzahl laut `screen.md`). Die Beispielwerte der Merkmale (Bildschirmdiagonale, Auflösung) sind fiktiv und hängen von den Merkmalsdefinitionen der Geräteart ab. Bereich unterhalb „Auflösung“ liegt hinter der Sticky-Leiste (Scrollbereich).

## Annahmen und offene Fragen
- REQ-058 ist Could; **v0.6.2:** Darstellung als Bestätigungsdialog `UI-007.mpn-warnung` statt reinem Hinweis, weil die Specification `confirmation_required` mit Bestätigung vorsieht (Änderung gegenüber v0.6.1, im Freigabe-Briefing genannt). Entfällt, wenn REQ-058 nicht in den Umfang kommt.
