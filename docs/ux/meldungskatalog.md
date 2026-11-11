# Meldungskatalog – Ergänzungen (Design v0.6.2, MAR-167, Spec DG-08; v0.6.2 MAR-212; v0.6.4 MAR-494)

Der Katalog enthält 30 Meldungen (M-01 bis M-22 und M-24 bis M-31; M-23 entfallen, siehe Abschnitt 3; M-25 bis M-31 neu in v0.6.2). Wortlaut für Fälle, die im Design bisher keinen Text hatten. Muster wie im Design: Feldfehler „<Feld>: 1 bis n Zeichen“ bzw. „<Feld>: höchstens n Zeichen“, Anrede „Sie“, keine Codes oder technischen Begriffe (REQ-073), Zahlen de-DE (20.000). Gezählt werden Zeichen (nicht Bytes). Grenzen aus der Technical Specification (MAR-153, Kap. 2 und 3, DG-08), vom Design auf Plausibilität geprüft (siehe unten). Der Katalog ergänzt das Design; die Regeln selbst (REQ) sind unverändert.

## 1. Texte

| Nr | Fall | Screen | Wortlaut | Darstellung |
|---|---|---|---|---|
| M-01 | Gerät ist bereits einem Modell-Inserat zugeordnet (AC-REQ-017-04) | UI-004 (Zuordnen) | „Gerät ist bereits einem Modell-Inserat zugeordnet“ | Banner im Dialog (Ablehnung wie die übrigen Ablehnungen in UI-004), nichts gespeichert |
| M-02 | Merkmal: Bezeichnung leer oder zu lang | UI-027 | „Bezeichnung: 1 bis 100 Zeichen“ | Feldfehler |
| M-03 | Merkmal: Bezeichnung enthält { oder } | UI-027 | „Bezeichnung darf { und } nicht enthalten“ | Feldfehler |
| M-04 | Merkmal: Bezeichnung gleich festem Platzhalternamen (Requirements Kap. 9.7, z. B. „Hersteller“, „Modellbezeichnung“, „Stückzahl“) | UI-027 | „Bezeichnung ist für einen festen Platzhalter vergeben: <Name>“ | Feldfehler; <Name> ist die eingegebene Bezeichnung. Ausnahme: „Akkukapazität“ beim Merkmal mit der Rolle Akkukapazität ist erlaubt, kein Fehler |
| M-05 | GPSR: Herstellername zu lang | UI-031 | „Herstellername: höchstens 200 Zeichen“ | Feldfehler |
| M-06 | GPSR: Straße und Hausnummer zu lang | UI-031 | „Straße und Hausnummer: höchstens 200 Zeichen“ | Feldfehler |
| M-07 | GPSR: Postleitzahl zu lang | UI-031 | „Postleitzahl: höchstens 20 Zeichen“ | Feldfehler |
| M-08 | GPSR: Ort zu lang | UI-031 | „Ort: höchstens 100 Zeichen“ | Feldfehler |
| M-09 | GPSR: Land zu lang | UI-031 | „Land: höchstens 100 Zeichen“ | Feldfehler |
| M-10 | GPSR: Kontakt zu lang | UI-031 | „Elektronische Kontaktadresse: höchstens 254 Zeichen“ | Feldfehler; Formatfehler bleibt „E-Mail-Adresse oder Internetadresse ungültig“ |
| M-11 | GPSR: Verantwortliche Person in der EU, Name zu lang | UI-031 | „Name der verantwortlichen Person: höchstens 200 Zeichen“ | Feldfehler |
| M-12 | GPSR: verantwortliche Person, Postanschrift zu lang | UI-031 | „Postanschrift der verantwortlichen Person: höchstens 500 Zeichen“ | Feldfehler |
| M-13 | GPSR: verantwortliche Person, Kontaktadresse zu lang | UI-031 | „Kontaktadresse der verantwortlichen Person: höchstens 254 Zeichen“ | Feldfehler |
| M-14 | Kategorie-Kennung zu lang | UI-035 | „Kategorie-Kennung: höchstens 100 Zeichen“ | Feldfehler (die Kennung ist optional, 0 bis 100) |
| M-15 | Eintrag nicht mehr vorhanden (`not_found`) | alle Screens | „Dieser Eintrag ist nicht mehr vorhanden.“ | siehe Abschnitt 2 |
| M-16 | Manuelle Beschreibung leer oder zu lang | UI-016 | „Beschreibung: 1 bis 20.000 Zeichen“ | Feldfehler; vor „Unbekannter Platzhalter {…}“ geprüft |
| M-17 | Titelmuster: Präfix zu lang | UI-029 | „Präfix: höchstens 50 Zeichen“ | Feldfehler in der Zeile des Bestandteils |
| M-18 | Titelmuster: Suffix zu lang | UI-029 | „Suffix: höchstens 50 Zeichen“ | Feldfehler in der Zeile des Bestandteils |
| M-19 | Titelmuster: fester Text leer oder zu lang | UI-029 | „Fester Text: 1 bis 100 Zeichen“ | Feldfehler in der Zeile des Bestandteils |
| M-20 | Beschreibungsvorlage: Überschrift zu lang | UI-037 | „Überschrift: höchstens 100 Zeichen“ | Feldfehler am Abschnitt |
| M-21 | Beschreibungsvorlage: Zeile zu lang | UI-037 | „Zeile: höchstens 1.000 Zeichen“ | Feldfehler an der Zeile |
| M-22 | Excel-Datei zu groß | UI-042 | „Excel-Datei: höchstens 10 MB“ | Feldfehler am Feld „Excel-Datei“; vor dem Einlesen, nichts angelegt |
| M-23 | **entfallen** (v0.6.1, Owner-Entscheidung MAR-176): kein Sammeltext; die Nummer bleibt unbesetzt und wird nicht neu vergeben (Schlüssel der Specification) | – | – | – |
| M-24 | Prüfdatum und/oder prüfende Stelle fehlt bei „rechtlich geprüft“ (AC-REQ-054-03) | UI-030 | „Prüfdatum und prüfende Stelle erforderlich“ | **ein** Text, wenn Prüfdatum, prüfende Stelle oder beides fehlt; erscheint einmal, beide betroffenen Felder sind markiert; kein zweiter Text „Prüfende Stelle fehlt“ |
| M-25 | Herstellernummer länger als 40 Zeichen (O-4, REQ-008) | UI-007 | „Herstellernummer: höchstens 40 Zeichen“ | Feldfehler; **Wortlaut vom Designer, Owner bestätigt mit der Freigabe**; Muster wie M-05 |
| M-26 | Herstellernummer mit unzulässigem Zeichen (O-4, REQ-008) | UI-007 | „Herstellernummer: nur Buchstaben, Ziffern und die Zeichen - / . erlaubt“ | Feldfehler; **Wortlaut vom Designer, Owner bestätigt mit der Freigabe**; zulässig sind Buchstaben, Ziffern, `-`, `/`, `.`; bei zugleich zu lang und unzulässigem Zeichen nur M-25 |
| M-27 | Mögliche Dublette (O-5, REQ-011) | UI-007 | Titel „Mögliche Dublette“; Text „Es gibt bereits eine Modellvorlage mit gleichem Hersteller und gleicher Modellbezeichnung.“ | Dialogtext (Wortlaut des Owners); Knöpfe „Vorhandene verwenden“ / „Trotzdem anlegen“ unverändert |
| M-28 | Gleiche Herstellernummer (O-6, REQ-058, **Could, nur wenn REQ-058 in den Umfang kommt**) | UI-007 | Titel „Gleiche Herstellernummer“; Text „Es gibt bereits eine Modellvorlage mit gleicher Herstellernummer.“; Knöpfe „Abbrechen“, „Trotzdem speichern“ | Bestätigungsdialog mit Treffern; **Wortlaut vom Designer, Owner bestätigt mit der Freigabe**; Speichern nach Bestätigung (`mpn_in_use`) |
| M-29 | Löschen einer Modellvorlage mit Modell-Inserat (O-8, REQ-095) | UI-041 | „Löschen nicht möglich: Modellvorlage wird von ein oder mehreren Inseraten genutzt“ | Banner im Dialog (Wortlaut des Owners, ohne Schlusspunkt); Grund-Teil von `delete_not_allowed`; ersetzt den früheren Vorschlag „Modell-Inserate verweisen auf die Modellvorlage.“ |
| M-30 | Textbaustein: Name leer oder zu lang (O-3, REQ-026) | UI-030 | „Name: 1 bis 100 Zeichen“ | Feldfehler am Feld „Name“; **Wortlaut vom Designer, Owner bestätigt mit der Freigabe**; Muster wie M-05; die Specification v0.5.1 nennt nur die Grenze (Kap. 2.2), keinen Wortlaut |
| M-31 | Textbaustein: Prüfende Stelle zu lang (O-3, REQ-054) | UI-030 | „Prüfende Stelle: höchstens 100 Zeichen“ | Feldfehler am Feld „Prüfende Stelle“; **Wortlaut vom Designer, Owner bestätigt mit der Freigabe**; Muster wie M-05; „Prüfende Stelle fehlt“ bleibt der Text M-24 |

**Ergänzung v0.6.4 (MAR-494, redaktionell, ohne neue M-Nummern):** Vier weitere Feldtexte nach demselben Muster; die Specification führt sie als Zeilen ohne Schlüssel (Muster MAR-487). Wortlaut vom Product Owner entschieden (MAR-492), Owner bestätigt mit der nächsten Freigabe. Die Zählung „30 Meldungen“ bleibt unverändert.

| Fall | Screen | Wortlaut | Darstellung |
|---|---|---|---|
| Merkmal: Einheit zu lang (0 bis 20, optional) | UI-027 | „Einheit: höchstens 20 Zeichen“ | Feldfehler am Feld „Einheit“; Muster wie M-31 |
| Textbaustein: Text leer oder zu lang (Pflicht, 1 bis 5.000) | UI-030 | „Text: 1 bis 5.000 Zeichen“ | Feldfehler am Feld „Text“; Muster wie M-30; Zahl de-DE |
| Zustandszuordnung: Zusatzangabe zu lang (0 bis 100, optional) | UI-034 | „Zusatzangabe: höchstens 100 Zeichen“ | Feldfehler am Feld „Zusatzangabe“; Muster wie M-31 |
| Merkmalszuordnung: Kanal-Wert leer oder zu lang (Pflicht, 1 bis 100) | UI-036 | „Kanal-Wert: 1 bis 100 Zeichen“ | Zelle rot in der Wertzuordnung (Text unverändert aus UI-036, Zeile „Wertzuordnung bearbeiten“) |

## 2. `not_found` (M-15)

- **Darstellung:** Banner (flag-warn, ohne „×“, ohne Referenznummer, da kein technischer Fehler) mit dem Text „Dieser Eintrag ist nicht mehr vorhanden.“ Gilt für alle Screens, in denen ein Eintrag beim Laden, Speichern oder bei einer Aktion fehlt (z. B. in einem anderen Fenster gelöscht). Nichts wird gespeichert; eingegebene Werte bleiben sichtbar, bis die Seite verlassen wird. Kein „Erneut versuchen“ (es würde dasselbe ergeben); der Nutzer verlässt die Seite über die linke Navigation oder „← Zurück …“.
- Beim Laden steht der Banner anstelle des Inhalts. Ein Dialog zeigt ihn im Dialog mit „Abbrechen“ als einziger Aktion.
- Das ist ein Text und keine neue Seite; es gibt keinen zusätzlichen Button und keinen eigenen Zustand je Screen. Die Spec bildet ihn über `not_found` ab. Er ersetzt weder `.error` mit Referenznummer noch P-05 (Konflikt).

## 3. M-23: entfallen

Der Sammeltext „Bitte die markierten Felder prüfen.“ entfällt (v0.6.1, Owner-Entscheidung MAR-176 / MAR-179). Es gibt keinen eigenen Sammeltext; Feldfehler stehen am Feld, der erste markierte Fehler erhält den Fokus (Kap. 5 „Validierung“). Eine Fehlerzusammenfassung, wo das freigegebene Design sie bereits beschreibt (UI-003 „Speichern“, DESIGN.md Formulare, UI-016 „Freigabe nicht möglich:“ mit Liste), bleibt unverändert und ist nicht Teil von M-23. Die Nummer M-23 bleibt unbesetzt. Der Katalog enthält 30 Meldungen: M-01 bis M-22 und M-24 bis M-31.

## 4. Plausibilitätsprüfung der Grenzen

Alle Grenzen sind für das Design plausibel und widersprechen keinem Screen. Hinweise (keine Änderung veranlasst):

1. **Beschreibungsvorlage:** Eine Zeile bis 1.000 Zeichen und die manuelle Beschreibung bis 20.000 Zeichen liegen weit über den Längen der Kanäle; das ist unkritisch. Beschreibungslängen der Kanäle sind im Design nicht gefordert.
2. **Titelmuster:** Präfix und Suffix je 50 Zeichen und fester Text 100 Zeichen sind größer als die Titel-Höchstlängen der Kanäle (128/65/80); die Kürzung (REQ-035) fängt das ab, der Nutzer sieht es in der Vorschau.
3. **GPSR-Felder:** Die Grenzen der Verantwortlichen Person (200/500/254) stehen in der Spec, aber nicht in UI-031; hier ergänzt (M-11 bis M-13). Für die „Produktidentifikation“ (Kopierfeld in UI-019) nennt die Spec keine Grenze am Hersteller; falls dafür ein Eingabefeld mit Grenze entsteht, fehlt ein Wortlaut.
4. **Lücken ohne Text:** **Geschlossen mit v0.6.4 (MAR-494):** Die Längentexte für UI-027 „Einheit“, UI-030 „Text“, UI-034 „Zusatzangabe“ und UI-036 „Kanal-Wert“ stehen in der Ergänzung unter Abschnitt 1; die Lücke ist damit geschlossen. Frühere Stände: Die Merkmalswerte der Zuordnungen (UI-036, 1 bis 100) hatten keinen Längentext (nicht Teil von O-3). **Stand v0.6.2 (O-3):** UI-030 „Name“ (1 bis 100) und „Prüfende Stelle“ (max. 100) haben jetzt Längentexte (M-30, M-31). Die Specification v0.5.1 (Kap. 8.2, Tabelle „Meldungstexte“) enthält dafür keinen Wortlaut (nur die Grenzen, Kap. 2.2); auf Entscheidung des Product Owners (Review Runde 1) hat der Designer den Wortlaut nach dem Katalogmuster formuliert, der Owner bestätigt ihn mit der Freigabe. Die Lücke in der Specification meldet der Product Owner über den CEOrchestrator.
5. **Excel-Datei:** UI-042 nennt bisher „Nur Excel-Dateien (.xlsx) im Format des Datenblatts“; M-22 ergänzt die Größe, die Formatmeldung bleibt.
6. **M-04 Ausnahme Akkukapazität:** Die Spec nimmt das Merkmal mit der Systemrolle `battery_capacity` aus der Platzhalterprüfung aus; der Katalog gibt daher keinen Fehler dafür aus.
