# Meldungskatalog – Ergänzungen (Design v0.6, MAR-167, Spec DG-08)

Wortlaut für Fälle, die im Design bisher keinen Text hatten. Muster wie im Design: Feldfehler „<Feld>: 1 bis n Zeichen“ bzw. „<Feld>: höchstens n Zeichen“, Anrede „Sie“, keine Codes oder technischen Begriffe (REQ-073), Zahlen de-DE (20.000). Gezählt werden Zeichen (nicht Bytes). Grenzen aus der Technical Specification (MAR-153, Kap. 2 und 3, DG-08), vom Design auf Plausibilität geprüft (siehe unten). Der Katalog ergänzt das Design; die Regeln selbst (REQ) sind unverändert.

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
| M-23 | Allgemeiner Hinweis, wenn mehrere Felder fehlerhaft sind | alle Formulare | „Bitte die markierten Felder prüfen.“ | siehe Abschnitt 3 |
| M-24 | Prüfdatum fehlt bei „rechtlich geprüft“ (AC-REQ-054-03) | UI-030 | „Prüfdatum fehlt“ | Feldfehler; „Prüfende Stelle fehlt“ besteht schon; fehlen beide, erscheinen beide Fehler |

## 2. `not_found` (M-15)

- **Darstellung:** Banner (flag-warn, ohne „×“, ohne Referenznummer, da kein technischer Fehler) mit dem Text „Dieser Eintrag ist nicht mehr vorhanden.“ Gilt für alle Screens, in denen ein Eintrag beim Laden, Speichern oder bei einer Aktion fehlt (z. B. in einem anderen Fenster gelöscht). Nichts wird gespeichert; eingegebene Werte bleiben sichtbar, bis die Seite verlassen wird. Kein „Erneut versuchen“ (es würde dasselbe ergeben); der Nutzer verlässt die Seite über die linke Navigation oder „← Zurück …“.
- Beim Laden steht der Banner anstelle des Inhalts. Ein Dialog zeigt ihn im Dialog mit „Abbrechen“ als einziger Aktion.
- Das ist ein Text und keine neue Seite; es gibt keinen zusätzlichen Button und keinen eigenen Zustand je Screen. Die Spec bildet ihn über `not_found` ab. Er ersetzt weder `.error` mit Referenznummer noch P-05 (Konflikt).

## 3. „Bitte die markierten Felder prüfen.“ (M-23)

Steht als Fehlerzusammenfassung oben im Formular, wenn beim Speichern mindestens ein Feld fehlerhaft ist und der Server mehrere oder keine einzelne Meldung liefert. Der erste markierte Fehler erhält den Fokus (Kap. 5 „Validierung“). Die Feldfehler (M-02 bis M-24 usw.) stehen zusätzlich am Feld. Ersetzt nicht den Text „Freigabe nicht möglich:“ mit Liste in UI-016.

## 4. Plausibilitätsprüfung der Grenzen

Alle Grenzen sind für das Design plausibel und widersprechen keinem Screen. Hinweise (keine Änderung veranlasst):

1. **Beschreibungsvorlage:** Eine Zeile bis 1.000 Zeichen und die manuelle Beschreibung bis 20.000 Zeichen liegen weit über den Längen der Kanäle; das ist unkritisch. Beschreibungslängen der Kanäle sind im Design nicht gefordert.
2. **Titelmuster:** Präfix und Suffix je 50 Zeichen und fester Text 100 Zeichen sind größer als die Titel-Höchstlängen der Kanäle (128/65/80); die Kürzung (REQ-035) fängt das ab, der Nutzer sieht es in der Vorschau.
3. **GPSR-Felder:** Die Grenzen der Verantwortlichen Person (200/500/254) stehen in der Spec, aber nicht in UI-031; hier ergänzt (M-11 bis M-13). Für die „Produktidentifikation“ (Kopierfeld in UI-019) nennt die Spec keine Grenze am Hersteller; falls dafür ein Eingabefeld mit Grenze entsteht, fehlt ein Wortlaut.
4. **Lücken ohne Text (nicht Teil des Auftrags, nur Hinweis):** UI-030 „Prüfende Stelle“ (max. 100) und „Name“ (max. 100) haben im Design keinen Längentext, ebenso die Merkmalswerte der Zuordnungen (UI-036, 1 bis 100). Der Wortlaut nach dem Muster wäre „Prüfende Stelle: höchstens 100 Zeichen“ bzw. „Name: 1 bis 100 Zeichen“; sie sind ausdrücklich nicht aufgenommen, bis der Product Owner es verlangt.
5. **Excel-Datei:** UI-042 nennt bisher „Nur Excel-Dateien (.xlsx) im Format des Datenblatts“; M-22 ergänzt die Größe, die Formatmeldung bleibt.
6. **M-04 Ausnahme Akkukapazität:** Die Spec nimmt das Merkmal mit der Systemrolle `battery_capacity` aus der Platzhalterprüfung aus; der Katalog gibt daher keinen Fehler dafür aus.
