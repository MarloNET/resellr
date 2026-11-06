# UI/UX-Design – resellr Phase 1 / Release 0.1 „Inserat-Generator“

## 1. Metadaten und Basis

| Feld | Wert |
|---|---|
| Projekt / Release | resellr (Arbeitstitel), Phase 1 / Release 0.1 |
| Dokumentversion | **v0.4 (Entwurf)**: Cross-Check Baseline v0.3.1 (Kap. 6b), neu UI-044 bis UI-046, LP-01 bis LP-03, FLOW-10; Bereinigung UI-019/UI-023. Vorgänger v0.3 (Commit `92e018e`) |
| Status | draft (kein Review, keine Freigabe) |
| Klassifikation | **Material** (Owner bestätigt) |
| Autor / Datum | UI/UX Designer, 06.11.2026 |
| Paperclip-Task | MAR-128 (Parent MAR-126); v0.4: MAR-143 (Parent MAR-142) |
| Repository / Branch | MarloNET/resellr, `design/MAR-126` |
| Requirements | v0.3 Rev. `170ca77f` (freigegeben, bindend); **gelesen wurde die aktuelle Revision v0.3.1 `d816223d`** (Delta-Review pending, nicht freigegeben), da MAR-114 nur diese als Dokument liefert. Auswirkung auf UI: nur UI-001/UI-040 (kein Zeitablauf, andere Zugänge enden bei Passwortänderung). Stellen sind mit „[v0.3.1]“ markiert. |
| Product Brief | v1.0, Commit `45d5ef6`, `docs/product/product-brief.md` |
| Owner-Entscheidungen | E-1 bis E-6 (MAR-121) |
| Architecture Baseline | v0.3.1, Revision `a1b9ea85-c28a-49db-9fc7-768c214e743a` (MAR-125, Review Runde 2: pass). Cross-Check: Kap. 6b. Requirements-Lesestand v0.3.3 `ce76d962` (Kandidat, nicht freigegeben; REQ-104 bis -106 warten auf Owner-Bestätigung). |
| Stitch | Projekt `7947641073263768710`, Design-System-Asset `14699510063308426971`, Budget siehe `stitch-log.md` |
| Design-System | `DESIGN.md`, Status **vorgeschlagen** |

## 2. Nutzer, Umfang, Designziele

- **Nutzer:** genau eine Person (der Owner, E-4). Keine Konten, Rollen, rollenabhängige Sichten.
- **Plattform:** ein PC, Tastatur und Maus, ab 1366 × 768 (REQ-077). Kein Smartphone, kein Tablet (E-2). **Web oder Desktop (OP-15):** Die Architecture Baseline v0.1 (MAR-125, Entwurf, nicht freigegeben) schlägt eine lokale Webanwendung im Browserfenster vor (ADR-001). Das Design folgt dieser Annahme unter Vorbehalt der Baseline-Freigabe; **Google Chrome** ist laut Baseline v0.3.1 (OD-04) der einzige unterstützte Browser (v0.4; vorher „Edge/Chrome Referenz, Firefox unterstützt“).
- **Barrierefreiheit:** keine Anforderung (E-3); nur gute Lesbarkeit und Bedienbarkeit.
- **Sprache/Formate:** Deutsch, de-DE (1.234,56 €, TT.MM.JJJJ) (REQ-078).
- **Designziele:** (1) Einbuchen in ≤ 2 Minuten (REQ-062) per Tastatur; (2) Kopier-Assistent mit einem Klick je Feld, auch neben einem anderen Fenster; (3) Status und Kennzeichnungen sofort lesbar, nie nur durch Farbe; (4) Einstellungen für Nicht-Entwickler bedienbar, mit Vorschau (REQ-076).
- **Nicht-Ziele:** Mobil/Responsive, Konten, Dashboards, Kennzahlen, Suche über alles, Benachrichtigungen, Direktveröffentlichung (Kap. 14 der Requirements).

## 3. Nutzerflüsse und Navigation

Flussdiagramm: `flows/flow.md` (Textdiagramm je FLOW).

| FLOW | Name | Quelle | Screens (Reihenfolge) |
|---|---|---|---|
| FLOW-01 | Neues Modell erstmals inserieren | J-01 | UI-006 → UI-007 (→ UI-008) → UI-003 → UI-004 → UI-014 → UI-015 → UI-016 → UI-019 → UI-020 → UI-023 |
| FLOW-02 | Weiteres Gerät einbuchen | J-02 | UI-003 → UI-004 → UI-005 → UI-021 (bei veröffentlichtem Kanal) |
| FLOW-03 | Verkauf erfassen | J-03 | UI-009 → UI-010 → UI-011 → UI-002 → UI-021 / UI-020 (Beendet) |
| FLOW-04 | Textbaustein/GPSR ändern | J-04 | UI-030 / UI-031 → UI-043 → UI-016 / UI-018 → UI-019 → UI-021 |
| FLOW-05 | Neue Geräteart anlegen | J-05 | UI-027 → UI-029 → UI-035 → UI-036 → UI-039 |
| FLOW-06 | Veröffentlichtes Modell-Inserat ändern | J-06 | UI-014 (oder UI-007) → UI-018 → UI-019 → UI-021 |
| FLOW-07 | Zugang (Netzbetrieb) | REQ-001/097 | UI-001; UI-040 (Vermerk Kap. 6c: abhängig von OD-02) |
| FLOW-08 | Fehlerkorrektur und Löschen | REQ-092/093/084/095 | UI-010 → UI-013 / UI-012 / UI-011 (Rücknahme); UI-014/UI-007 → UI-041 |
| FLOW-09 | Kopier-Assistent nutzen | REQ-047–049 | UI-014 → UI-019 (Vollfenster oder schmal) → UI-020 / UI-021 |
| FLOW-10 | Sicherung anlegen | REQ-104, 105 (E-7) | UI-044 (in jedem Rahmen) → UI-045 → UI-046; LP-01 bis LP-03 ohne Server |

**Informationsarchitektur (linke Navigation, 208 px, immer sichtbar):** Inserate (UI-002) · Gerät einbuchen (UI-003) · Modell-Bibliothek (UI-006) · Geräte (UI-009) · Änderungsprotokoll (UI-024) · Einstellungen (UI-025, mit zweiter Spalte für 15 Bereiche).
Datenblatt (UI-023), Kopier-Assistent (UI-019), Kanal-Inhalt (UI-016/017/018) und Fotos (UI-015) sind keine Hauptnavigationspunkte, sondern Folgeseiten des Modell-Inserats (UI-014) bzw. Geräts (UI-010). „Zugangspasswort“ erscheint nur im Netzbetrieb als 15. Eintrag der Einstellungen; im Betrieb nur am Arbeitsplatzrechner fehlt dieser Eintrag und UI-001.
**Anwendungsrahmen (v0.4):** Die linke Navigation trägt unten den Hinweis „Sicherung einrichten“ (UI-044), in jeder Ansicht, bei jedem Einstieg; in der schmalen Ansicht von UI-019 steht er als fester Streifen unten. Außer UI-001 (Zugang), UI-046 (Endzustand) und den Seiten LP-01 bis LP-03 haben alle Screens den Rahmen.
Navigationsregeln: Seitenwechsel ersetzt den Inhaltsbereich; „← Zurück …“-Link oben links führt zur Aufrufseite; Dialoge (UI-004, 005, 008, 011, 012, 013, 020, 021, 022, 041, 043) sind modal und kehren nach Abschluss zur Aufrufseite zurück, sofern nicht anders in `screen.md`.

## 4. Screen-Katalog

Spalte „Mockup“: Zustände mit PNG. „Text“ = nur `screen.md` (Muster P-01 bis P-04, Kap. 5). Pfad: `docs/ux/screens/UI-NNN-<slug>/`.

| ID | Name | Zweck | REQ | FLOW | Mockup | Ordner |
|---|---|---|---|---|---|---|
| UI-001 | Zugang | Zugangspasswort eingeben (Netzbetrieb) | REQ-001 | 07 | default | UI-001-zugang |
| UI-002 | Inserat-Übersicht | Modell-Inserate mit Status/Kennzeichnungen filtern | REQ-052, 046, 090 | 03, 06 | default | UI-002-inserat-uebersicht |
| UI-003 | Gerät einbuchen | Gerät per WI-Nr erfassen, Werte prüfen | REQ-012–015, 062 | 01, 02 | default | UI-003-geraet-einbuchen |
| UI-004 | Modell-Inserat wählen (Dialog) | Gerät zuordnen oder neues Modell-Inserat anlegen | REQ-017, 019 | 01, 02 | Text | UI-004-zuordnen-dialog |
| UI-005 | Abweichungen bei Zuordnung (Dialog) | Abweichung der Variantenangaben entscheiden | REQ-018 | 02 | default | UI-005-abweichungen-dialog |
| UI-006 | Modell-Bibliothek | Modellvorlagen suchen | REQ-009 | 01 | Text | UI-006-modell-bibliothek |
| UI-007 | Modellvorlage anlegen/ändern | Modelldaten und Vorbelegungen pflegen | REQ-008, 010, 011, 058 | 01, 06 | default | UI-007-modellvorlage |
| UI-008 | Hersteller anlegen (Dialog) | neuen Hersteller anlegen | REQ-100 | 01 | Text | UI-008-hersteller-dialog |
| UI-009 | Geräte | Geräte per WI-Nr finden, nicht zugeordnete Geräte | REQ-016, 094 | 03 | Text | UI-009-geraete |
| UI-010 | Gerät | Gerätewerte, Verkauf, Korrektur, Datenblatt | REQ-014, 016, 020, 021, 084, 092, 093 | 03, 08 | Text | UI-010-geraet |
| UI-011 | Verkauf markieren (Dialog) | Verkauf mit Kanal/Datum markieren | REQ-021, 084 | 03 | Text | UI-011-verkauf-dialog |
| UI-012 | Gerät stornieren (Dialog) | Fehlerfassung stornieren | REQ-093 | 08 | Text | UI-012-storno-dialog |
| UI-013 | WI-Nr korrigieren (Dialog) | WI-Nr ändern | REQ-092 | 08 | Text | UI-013-wi-nr-dialog |
| UI-014 | Modell-Inserat | Arbeitsbereich: Kanäle, Preise, Inseratswerte, Fotos, Geräte | REQ-019, 032, 033, 088, 091, 095 | 01, 06, 09 | default | UI-014-modell-inserat |
| UI-015 | Fotos verwalten | Fotos hinzufügen, ordnen, entfernen | REQ-042 | 01 | Text | UI-015-fotos |
| UI-016 | Kanal-Inhalt prüfen und freigeben | Prüfen, manuell anpassen, freigeben | REQ-034–044, 086, 087 | 01, 04 | default | UI-016-kanal-inhalt-freigeben |
| UI-017 | Kanäle vergleichen | 3 Kanal-Inhalte nebeneinander | REQ-044 (Kap. 10.6) | 01 | default | UI-017-kanal-vergleich |
| UI-018 | Änderungsentwurf prüfen | freigegebener und neuer Stand | REQ-045, 089 | 04, 06 | default | UI-018-aenderungsentwurf-pruefen |
| UI-019 | Kopier-Assistent | Felder und Fotos in Kanal-Formular übernehmen | REQ-047–049 | 09 | default, compact | UI-019-kopier-assistent |
| UI-020 | Kanal-Status setzen (Dialog) | Veröffentlicht / Beendet melden | REQ-046 | 01, 03, 09 | Text | UI-020-kanal-status-dialog |
| UI-021 | Abgleich bestätigen (Dialog) | Übertragung bestätigen | REQ-090 | 02, 03, 04, 06 | Text | UI-021-abgleich-dialog |
| UI-022 | Ungeprüften Rechtstext bestätigen (Dialog) | Freigabe mit ungeprüftem Rechtstext | REQ-087 | 01, 06 | Text | UI-022-rechtstext-dialog |
| UI-023 | Datenblatt | Vorschau, Drucken, PDF | REQ-050 | 01 | default | UI-023-datenblatt |
| UI-024 | Änderungsprotokoll | Protokoll filtern | REQ-055, 072 | – | Text | UI-024-aenderungsprotokoll |
| UI-025 | Einstellungen | Einstieg, Liste der 15 Bereiche | REQ-004–031, 051, 085, 097 | 05 | Text (Teil von UI-027/029) | UI-025-einstellungen |
| UI-026 | Händlermarke | Name, Logo, Kontakt | REQ-028 | 05 | Text | UI-026-haendlermarke |
| UI-027 | Gerätearten und Merkmale | Geräteart, Merkmale | REQ-004, 005, 006 | 05 | default | UI-027-geraeteart-merkmale |
| UI-028 | Auswahllisten | Listenwerte pflegen | REQ-007 | – | Text | UI-028-auswahllisten |
| UI-029 | Titelmuster | Bestandteile, Kürzung, Vorschau | REQ-030, 034, 035 | 05 | default | UI-029-titelmuster |
| UI-030 | Textbausteine | Texte, Geltungsbereich, Prüfstatus | REQ-026, 054 | 04 | default | UI-030-textbausteine |
| UI-031 | Hersteller und GPSR | Hersteller, GPSR-Angaben | REQ-027, 100, 101 | 04 | Text | UI-031-hersteller-gpsr |
| UI-032 | Lieferanten | Lieferanten pflegen | REQ-099 | – | Text | UI-032-lieferanten |
| UI-033 | Code-Übersetzung | Zustandscodes | REQ-022 | – | Text | UI-033-code-uebersetzung |
| UI-034 | Zustandszuordnung | Zustand → Kanal-Bezeichnung | REQ-023 | – | Text | UI-034-zustandszuordnung |
| UI-035 | Kategoriezuordnung | Geräteart → Kanal-Kategorie | REQ-024 | 05 | Text | UI-035-kategoriezuordnung |
| UI-036 | Merkmalszuordnung | Felder je Kanal/Geräteart, Reihenfolge | REQ-025 | 05 | default | UI-036-merkmalszuordnung |
| UI-037 | Beschreibungsvorlagen | Abschnitte je Kanal | REQ-031, 036 | 05 | default | UI-037-beschreibungsvorlagen |
| UI-038 | Kanäle und Preisregeln | Kanal-Einstellungen, Preisregel | REQ-029, 033, 085 | – | Text | UI-038-kanaele-preisregeln |
| UI-039 | Datenblatt-Layout | Kopfzeilen, Blockfolge | REQ-051 | 05 | Text | UI-039-datenblatt-layout |
| UI-040 | Zugangspasswort ändern | Passwort ändern (Netzbetrieb) | REQ-097, 067 | 07 | success | UI-040-zugangspasswort |
| UI-041 | Löschen bestätigen (Dialog) | Modell-Inserat/Modellvorlage löschen | REQ-095, 103 | 08 | default | UI-041-loeschen-dialog |
| UI-042 | Excel-Übernahme | Datenblatt-Excel einlesen (Could) | REQ-056 | – | Text | UI-042-excel-uebernahme |
| UI-043 | Auswirkung der Änderung (Dialog) | Anzahl betroffener Kanal-Inhalte melden | REQ-053, 043 | 04 | default | UI-043-auswirkung-dialog |
| UI-044 | Hinweis „Sicherung einrichten“ (Rahmenkomponente) | Dauerhafter Hinweis mit Speicherort und Aktion „resellr beenden“ | REQ-104, 106 | 10 | Text | UI-044-sicherungshinweis |
| UI-045 | „resellr beenden“ (Dialog) | Rückfrage, Warten, Fehler | REQ-105, 073 | 10 | Text | UI-045-beenden-rueckfrage |
| UI-046 | resellr beendet (Endzustand) | Endzustand und „Ausgang unbekannt“ | REQ-105 | 10 | Text | UI-046-beendet-endzustand |
| LP-01 | „resellr startet“ (statische Seite) | Rückmeldung bei langem Start | REQ-073, 060 | 10 | Text | launcher-pages/LP-01-resellr-startet |
| LP-02 | „Start abgebrochen“ (statische Seite) | Startabbruch mit Referenznummer | REQ-073 | 10 | Text | launcher-pages/LP-02-start-abgebrochen |
| LP-03 | Ergebnis „resellr beenden“ (statische Seite) | Ergebnis des Startmenü-Werkzeugs | REQ-105, 073 | 10 | Text | launcher-pages/LP-03-beenden-ergebnis |

Nicht abgedeckt, weil nicht in Kap. 6 gefordert: Suche über alles, Dashboard, Benutzerverwaltung. Die Pflege-Kanalfeld-Reihenfolge des Kopier-Assistenten (REQ-029) liegt in UI-036.

## 5. Muster und übergreifende Regeln

- **P-01 Pflege-Tabelle (Einstellungen mit Listen):** Tabelle links, Detailbereich rechts oder Dialog; Zeilenaktionen „Bearbeiten“, „Deaktivieren“; Reihenfolge per Ziehen oder Hoch/Runter-Buttons (Tastatur); „Anlegen“-Button oben rechts; Primärbutton im Detail „Speichern“, daneben „Abbrechen“.
- **P-02 Zuordnungstabelle (Kanal × Quelle/Wert):** Auswahl Kanal/Geräteart oben, Tabelle mit Dropdown-Zellen, Zeile „Zeile hinzufügen“, Validierungsfehler je Zelle.
- **P-03 Muster-/Vorlagen-Editor mit Vorschau:** Bestandteile als Zeilen, Platzhalter-Auswahl nach Gruppen (Kap. 9.7), Vorschau je Kanal am Beispiel-Modell, Fehler bei unzulässigem Platzhalter inline (UI-029).
- **P-04 Bestätigungsdialog:** Titel = Aktion, Text nennt Wirkung, Buttons: „Abbrechen“ (links), Aktion (rechts, bei Löschen/Storno destruktiv).
- **P-05 Konflikt:** Meldet das Speichern oder Freigeben einen Konflikt (Datensatz in anderem Fenster geändert, Baseline 9.3), erscheint ein Banner „Dieser Eintrag wurde inzwischen in einem anderen Fenster geändert. Bitte neu laden und erneut prüfen.“ mit Button „Neu laden“. Es wird nichts gespeichert oder freigegeben; eingegebene Werte bleiben bis zum Neuladen sichtbar. Zustand `.conflict` gilt für alle Formulare, UI-016 und UI-018.
- **P-06 resellr nicht erreichbar (`.unreachable`, X-3):** Antwortet der Server auf eine Aktion oder ein Laden nicht (Server beendet in anderem Fenster, Absturz bis zum automatischen Neustart, Update, abgebrochener Start), erscheint ein **dauerhaftes Banner** (flag-warn, ohne „×“) oben im Inhaltsbereich, **ohne die Seite zu ersetzen**: „resellr ist nicht erreichbar. Ihre Eingaben sind noch nicht gespeichert, bleiben aber sichtbar, solange diese Seite offen ist. Warten Sie einen Moment und versuchen Sie es erneut. Läuft resellr nicht, starten Sie es über die Verknüpfung „resellr“ im Startmenü.“ Button „Erneut versuchen“ prüft nur die Verbindung (führt die Aktion nicht aus); antwortet der Server, verschwindet das Banner, die Aktion muss der Nutzer neu auslösen. Keine Referenznummer (es gibt keinen Protokolleintrag). Das Banner ersetzt `.error` für Verbindungsfehler im Netz- und Einzelbetrieb. Hinweis UI-044 bleibt unverändert sichtbar.
- **P-07 resellr wird beendet (`.wird-beendet`, X-3):** Lehnt der Server eine schreibende Aktion mit „resellr wird beendet“ ab (Beenden läuft in einem anderen Fenster, bis etwa 10 s), zeigt die Seite ein Banner nach Muster `.error`: „resellr wird gerade beendet. Ihre Eingabe wurde nicht gespeichert.“ Eingaben bleiben sichtbar; folgt der Verbindungsverlust, gilt P-06.
- **Validierung:** Fehler am Feld, Fehlertext aus Kap. 6/9.6 im Wortlaut der Requirements; Prüfung beim Verlassen des Feldes und beim Speichern; erster Fehler erhält Fokus. Zahlen akzeptieren Dezimalkomma und -punkt (Kap. 9.6).
- **Feedback:** Erfolg als Banner oben (z. B. „Zugangspasswort geändert“), schließt nach 5 s oder per „×“; technische Fehler als Banner mit Funktion, nächstem Schritt, Referenznummer (REQ-073).
- **Zustände (State-IDs):** `UI-nnn.default`, `.loading` (Skeleton/„Lade …“ bis 5 s, danach Fehler), `.empty`, `.error`, `.validation`, `.success`, `.disabled`, `.conflict` (P-05). Rollenabhängige Zustände entfallen (E-4). Offline/Timeout: nicht vorgesehen (A-02). Verbindungsfehler: `.unreachable` (P-06), Ablehnung beim Beenden: `.wird-beendet` (P-07); `.error` bleibt für Fehler mit Referenznummer.
- **Tastatur:** Tab-Reihenfolge = Leserichtung; Enter bestätigt Primäraktion eines Formulars/Dialogs; Esc schließt Dialoge und Dropdowns; im Kopier-Assistenten Pfeil auf/ab wählt Feld, Enter kopiert das gewählte Feld und springt zum nächsten offenen (als Bedienkomfort, keine Konformitätsaussage). Einbuchen: Fokus beim Öffnen von UI-003 in „WI-Nr“; Reihenfolge WI-Nr → Lieferant → Zustandscode → Modellvorlage → Gerätewerte.
- **Fensterbreiten:** ≥ 1366 px: volle Ansicht. UI-019 zusätzlich schmale Ansicht (480 px Mindestbreite, ohne Navigation), erreichbar über „Schmale Ansicht“/„Normale Ansicht“; ob als eigenes Fenster oder Umschalter, hängt von OP-15 ab. Unter 1366 px wird nicht gestaltet.
- **Kennzeichnungen (Kap. 9.4):** je Kennzeichnung ein Text-Chip; Reihenfolge: Fehlt-Hinweise, „geändert seit Freigabe“, „Änderung auf Kanal übertragen“, „Bestand auf Kanal anpassen“, „manuell angepasst“, „Kategorie manuell“, „Titel gekürzt, bitte prüfen“.

## 6. Feasibility- und Handoff-Hinweise

- **Abhängig von OP-15 (Web oder Desktop), vom Software Architect zu bestätigen:**
  1. Zwischenablage je Feld (REQ-047): im Browser nur mit Nutzeraktion; in beiden Varianten möglich.
  2. Fotos bereitstellen (REQ-048): Entwurf „Fotos herunterladen“ (Ordner oder ZIP mit Namen 01 …). Direktes Ziehen in ein anderes Programm nur bei Desktop wahrscheinlich; **nicht entworfen**.
  3. Schmales Arbeitsfenster neben anderem Programm (UI-019 compact): als eigenes Fenster nur bei Desktop oder per Pop-out; sonst Fenstergröße vom Nutzer.
  4. Druck: UI-023 ist ein Erzeugungsschritt mit „Datenblatt öffnen (PDF)“; Anzeige, Druck und Speichern übernimmt der PDF-Viewer des Browsers (Baseline v0.1, C-2); Dialoge des Betriebssystems/Browsers werden nicht gestaltet.
  5. Zugang: UI-001/UI-040 nur im Netzbetrieb.
- Mockups sind visuelle Referenz; maßgeblich ist `screen.md`. Es wird kein HTML als Implementierungscode übergeben (HTML-Export entfällt, siehe `stitch-log.md`).
- Cross-Check mit der Architecture Baseline v0.1 (Entwurf, Revision `ae51c8cc`): **Vorabprüfung durchgeführt**, siehe Kap. 6a. Der formale Cross-Check folgt nach Freigabe der Baseline.

## 6a. Vorabprüfung gegen die Architecture Baseline v0.1 (ae51c8cc)

| ID | Betroffen | Befund | UX-Auswirkung | Designseitige Anpassung / Alternative | Status |
|---|---|---|---|---|---|
| C-1 | UI-001, UI-040, FLOW-07 | Baseline: Betrieb nur am PC, **keine Anmeldung, kein Zugangspasswort** (ADR-002, A-35). Requirements v0.3.1 sehen Zugang im Netzbetrieb vor. | Konflikt zwischen Requirements (REQ-001/067/097) und Baseline. | **Entschieden (Owner, 06.11.2026): Requirements gelten, UI-001 und UI-040 bleiben.** Die Baseline muss den Zugang im Netzbetrieb abbilden (Hinweis für den Cross-Check). | entschieden |
| C-2 | UI-023 | Baseline: Datenblatt als serverseitiges PDF, Anzeige/Druck/Speichern im PDF-Viewer des Browsers (neuer Tab), **kein eigener Druckdialog, keine Vorschau im Browser-Layout**. Das Mockup zeigt eine Blattvorschau mit „Drucken“ und „Als PDF speichern“. | Vorschau und Buttons in der App entfallen. | UI-023 wird zum Erzeugungsschritt: Button „Datenblatt öffnen (PDF)“ öffnet neuen Tab; Voraussetzungs-Meldungen bleiben. Mockup bleibt nur als Inhaltsreferenz des Blatts. Angepasst in `screen.md`. | angepasst |
| C-3 | UI-019, V-3 | Baseline: Foto-Übergabe als Ordner (wird im Dateimanager geöffnet) oder ZIP-Download; Ziehen aus der Seite in fremde Upload-Felder nicht verlässlich. | V-3 (B) entfällt; Empfehlung A bestätigt, aber mit zwei Aktionen. | Buttons „Foto-Ordner öffnen“ und „Fotos als ZIP herunterladen“; Fehler Ordner nicht beschreibbar → Hinweis auf ZIP. Angepasst in `screen.md`; Mockup zeigt noch „Fotos herunterladen“. | angepasst |
| C-4 | alle Formulare, UI-016, UI-018 | Baseline (RI-11, 9.3): Speichern/Freigeben kann mit **Konflikt** abgelehnt werden, wenn der Datensatz in einem anderen Fenster geändert wurde. | Neuer Zustand `.conflict`. | Muster P-05 (Konflikt-Banner mit „Neu laden“), eingetragen in Kap. 5. Eingaben bleiben bis zum Neuladen sichtbar. | angepasst |
| C-5 | UI-019 schmal | Baseline: Browserfenster, frei skalierbar, als eigenes Fenster „installierbar“. Mindestbreite von Browserfenstern kann über 440 px liegen. | Schmales Layout (440 px) evtl. nicht erreichbar. | Annahme, vom Software Architect zu prüfen: Layout funktioniert ab 480 px; Umschalter „Schmale Ansicht“ ändert nur das Layout, öffnet kein Fenster. | zu prüfen |
| C-6 | UI-018 | Baseline: Textdifferenz in der Beschreibung im Browser berechenbar. | keine | Feldweiser Vergleich bleibt Pflicht; Wort-Hervorhebung optional. | ok |
| C-7 | Einstellungen | Baseline: Neuberechnung synchron, Ergebnismeldung mit Anzahlen; bei langer Dauer Ladezustand. | keine | `.loading` in UI-043/Einstellungen vorhanden. | ok |
| C-8 | – | Baseline OD-07: Hinweis in der Oberfläche bei fehlgeschlagener Sicherung nur vorgeschlagen. | Kein Screen vorhanden. | Entschieden (Owner, 06.11.2026): kein Screen für den Hinweis auf *fehlgeschlagene automatische* Sicherung. **Überholt (v0.4):** Baseline v0.3.1 6.2 „C-8 überholt durch OD-03 (b)“; der neue Hinweis „Sicherung einrichten“ (REQ-104) ist als Rahmenkomponente UI-044 gestaltet, siehe Kap. 6b. | überholt |
| C-9 | UI-015 | Upload-Grenzen der Baseline (JPEG/PNG, 20 MB, 20 Fotos) entsprechen dem Design. | keine | – | ok |
| C-10 | UI-003, UI-006 | Baseline: Suche nach Modellvorlage/WI-Nr serverseitig, schnell genug für Trefferliste während der Eingabe. | keine | – | ok |

## 6b. Cross-Check Baseline v0.3.1 (a1b9ea85) – Stand v0.4

Geprüft: Baseline Kap. 6.1 vollständig, 6.2 (C-8, „neu“), 6.3 (X-1 bis X-7), 8.1, 9.6 (Geordnetes Beenden, Startprüfung), 13.3.1 (OD-02), Ablauf 4a/4b. Technische Machbarkeit wird nicht beurteilt. Das ist eine Konsistenzprüfung, keine Freigabe.

### Ergebnis je Flow
| Flow | Konflikt? | Befund / Lösung |
|---|---|---|
| FLOW-01 (UI-006 → UI-023) | **kein Konflikt** | Chrome-Fenster, eigene Adresse je Ansicht, Zwischenablage, Foto-Ordner/ZIP, Upload-Grenzen und Antwortzeiten passen. Änderungen: UI-023 bereinigt (Wahl (a)); Hinweis UI-044 im Rahmen (AC-REQ-104-02: Flow ohne Bestätigung möglich). Neue Zustände P-06/P-07 gelten für alle Speichern-/Freigabe-Schritte. |
| FLOW-02 | **kein Konflikt** | Konflikt-Muster P-05 bestätigt (Baseline C-4). P-06/P-07 ergänzt. |
| FLOW-03 | **kein Konflikt** | wie FLOW-02. |
| FLOW-04 | **kein Konflikt** | Neuberechnung mit Ladezustand und Ergebnismeldung (UI-043) passt (Baseline 6.1 „Antwortzeiten“). |
| FLOW-05 | **kein Konflikt** | Formulare aus Merkmalsdefinitionen bis etwa 30 Felder, unbekannte Feldzahl: Layout je Screen fluid (UI-027, UI-036). |
| FLOW-06 | **kein Konflikt** | Feldweiser Vergleich (UI-018) passt, Wort-Hervorhebung bleibt optional. |
| FLOW-07 (Zugang) | **kein Konflikt in der Sache; abhängig von OD-02** | Siehe Kap. 6c (X-7). Bei Variante B zeigt der Hinweis keine Aktion. UI-001 hat keinen Anwendungsrahmen und keinen Hinweis (AC-REQ-104-06: sichtbar erst nach Eingabe des Passworts). |
| FLOW-08 | **kein Konflikt** | – |
| FLOW-09 (UI-019) | **Konflikt, im Design gelöst, eine Auslegungsfrage** | Die schmale Ansicht (ab 480 px, ohne Navigation) hat keinen Ort für den Hinweis in der Navigationsspalte. Lösung: fester Streifen unten mit vollständigem Text (UI-044). Kosten: etwa 180 von etwa 635 px Höhe. Prüfpunkt Baseline C-5 (Fenster nicht schmaler ziehbar als 480 px) bleibt Abnahme des Architekten. **Auslegungsfrage an den Product Owner:** siehe UI-044 „Annahmen und offene Fragen“. |
| FLOW-10 (neu) | – | Neu aus REQ-104/105. Endzustand ohne Server aus geladenen Daten (UI-046), Fehlerzweig, „Ausgang unbekannt“ gestaltet. |

### Ergebnis je Baseline-Punkt
| Nr. | Thema | Ergebnis |
|---|---|---|
| X-1 | Hinweis „Sicherung einrichten“ | **erledigt**: UI-044. (a) Rahmenebene, jeder Einstieg; (b) Überschrift, vier Aussagen, Speicherort ohne Aktion sichtbar; (c) nicht ausblendbar, ohne Zustand; (d) blockiert nichts. Ort: untere Navigationsspalte (normal, 1366 × 768 passt, Inhaltsbereich unverändert), Streifen unten (schmal). |
| X-2 | „resellr beenden“ | **erledigt**: UI-045 (Rückfrage, Wartezustand bis etwa 10 s, Fehlerzustand mit Referenznummer), UI-046 (Endzustand, „Ausgang unbekannt“). Wortlaut REQ-104/-105 unverändert. |
| X-3 | „nicht erreichbar“, „wird beendet“ | **`.error` genügt nicht**, zwei Muster: P-06 (`.unreachable`) und P-07 (`.wird-beendet`), siehe Kap. 5. Begründung: Verbindungsfehler hat keine Referenznummer und braucht einen eigenen nächsten Schritt (Startmenü, Warten), Eingaben bleiben sichtbar und die Seite darf nicht ersetzt werden; „wird beendet“ ist eine gewöhnliche Server-Ablehnung und nutzt `.error`-Darstellung mit eigenem Text. |
| X-4 | Seiten ohne Server | **erledigt**: LP-01 bis LP-03 (nur Text, kein Mockup). |
| X-5 | Befund der Startprüfung | **bewusst nicht gestaltet**, siehe Kap. 6c. |
| X-6 | Datenordner erreichen | **nur Speicherort**, auswählbarer Text in UI-044 und UI-046; keine Verknüpfung, kein „Im Explorer öffnen“. Zusatzzeile zur Adressleiste des Explorers in UI-046 als **Vorschlag Design** gekennzeichnet. |
| X-7 | OD-02 Variante B | nur beschrieben, Kap. 6c. |
| C-2 (6.2) | UI-023 | **erledigt**, Wahl (a) nur Button „Datenblatt öffnen (PDF)“; Begründung in `screen.md`. |
| Browser (6.1) | nur Chrome | Design nennt jetzt Chrome (Kap. 2). Kein UI-Konflikt. |
| Schmale Ansicht (6.1) | ab 480 px, ohne waagrechtes Scrollen | passt zur Design-Annahme; UI-019 schmal bleibt 480 px. |
| Echtzeit/Konflikt/Offline/Listen/Validierung/Foto-Übergabe/Zwischenablage (6.1) | – | **kein Konflikt** mit dem Design. |

## 6c. Vermerke zu X-5 und X-7 (Entscheidungen des Product Owner, MAR-143)

### Bewusst nicht gestaltet (X-5)
Befunde der Startprüfung nach einer Wiederherstellung (ersetzter Datenordner, fehlende Fotos, fehlende Ende-Markierung) zeigt die Oberfläche in Release 0.1 **nicht**. Begründung: Requirements Kap. 14 schließt Wiederherstellung und Prüfung auf Sicherung aus (E-7), keine REQ verlangt die Anzeige. Der Befund bleibt Betriebsstatus und Fehlerprotokoll. Es gibt dafür keinen Screen und keinen Zustand; LP-01 zeigt keinen Befund. Eine Anzeige wäre eine Requirements-Änderung. Ebenso nicht gestaltet: Startmenü-Verknüpfung „resellr-Datenordner“ und „Im Explorer öffnen“ (X-6, zusätzliche Funktionen ohne REQ), Anzeige von Größe des Datenordners, freiem Speicher oder Zeitpunkt der letzten Sicherung (resellr erkennt nicht, ob gesichert wurde).

### OD-02 und die Screens UI-001, UI-040, FLOW-07 (X-7)
UI-001, UI-040 und FLOW-07 bleiben unverändert im Design. Vermerk (Owner-Entscheidung zu OD-02 steht aus, der Vermerk nimmt sie nicht vorweg): *Bei Variante A (Betrieb nur am Arbeitsplatzrechner) werden UI-001, UI-040 und FLOW-07 in Release 0.1 nicht umgesetzt; UI-025 zeigt dann 14 Bereiche. Bei Variante B (Netzbetrieb) werden sie wie beschrieben umgesetzt.*
**Was Variante B am Design ändern würde:** (1) Hinweis UI-044 mit identischem Text, **ohne** Button „resellr beenden“ (AC-REQ-104-06); UI-045 und UI-046 entfallen, ebenso das Wartekonzept dazu (AC-REQ-105-05). (2) UI-001, UI-040, FLOW-07 aktiv; UI-025 mit 15 statt 14 Bereichen. (3) Neuer Zustand „Zugang abgelaufen“ (Passwort in einem anderen Programm geändert), in UI-001 als erneute Abfrage bereits vorgesehen, wäre als eigener Text zu ergänzen. (4) LP-03 und die Verknüpfung bleiben Betreiberwerkzeug. Mehraufwand im Design: gering (kein neuer Screen).

## 7. Rückverfolgbarkeit (REQ → FLOW → UI)

| REQ | FLOW | UI |
|---|---|---|
| REQ-001, 067, 097 | 07 | UI-001, UI-040 |
| REQ-004, 005, 006 | 05 | UI-027 (Start-Belegung ist Datenbestand, kein UI) |
| REQ-007 | – | UI-028 |
| REQ-008, 010, 011, 058 | 01, 06 | UI-007 (UI-003 für Neuanlage per Link) |
| REQ-009 | 01 | UI-006, UI-003 (Suchfeld) |
| REQ-100, 101 | 01, 04 | UI-008, UI-031 |
| REQ-012–016 | 01, 02 | UI-003, UI-009, UI-010 |
| REQ-017–020 | 01, 02, 08 | UI-004, UI-005, UI-010 |
| REQ-021, 084 | 03 | UI-011, UI-010 |
| REQ-088 | 06 | UI-014 |
| REQ-092, 093, 094, 095, 103 | 08 | UI-013, UI-012, UI-009, UI-041 |
| REQ-022, 099 | – | UI-033, UI-032 |
| REQ-023, 024, 025 | 05 | UI-034, UI-035, UI-036 |
| REQ-026, 027, 054, 087, 053 | 04 | UI-030, UI-031, UI-022, UI-043 |
| REQ-028 | 05 | UI-026 |
| REQ-029, 085, 033 | – | UI-038, UI-014 (Preis-Vorschlag) |
| REQ-030, 031 | 05 | UI-029, UI-037 |
| REQ-032, 042 | 01 | UI-014, UI-015 |
| REQ-034–041, 043, 044, 086 | 01 | UI-016, UI-017 |
| REQ-045, 089 | 04, 06 | UI-018, UI-016, UI-002 |
| REQ-046, 090 | 03, 06, 09 | UI-020, UI-021, UI-019, UI-014 |
| REQ-047, 048, 049 | 09 | UI-019 |
| REQ-050, 051 | 01, 05 | UI-023, UI-039 |
| REQ-052 | 03 | UI-002 |
| REQ-055, 072 | – | UI-024 |
| REQ-056 | – | UI-042 (Could) |
| REQ-057 (Could) | 09 | UI-014 (Aktion „Importdatei erzeugen“ in der Shop-Kanal-Karte, nur textlich, ohne Mockup) |
| REQ-059 (Could) | 01 | UI-016 (Kategorie-Warnung, nur textlich, ohne Mockup) |
| REQ-104, 106 | 10 | UI-044 (Rahmen, in allen Screens; UI-019 schmal), LP-01–03 nicht betroffen |
| REQ-105 | 10 | UI-045, UI-046, LP-03 |
| REQ-073 (Meldungen) | 10 | UI-045 `.error`, LP-02, LP-03, Muster P-06/P-07 |
| REQ-037, 047, 049 (leere Merkmalsfelder) | 09 | UI-019 |
| REQ-091 | 02, 03 | wirkt in UI-014/016/019/002 (keine eigene Oberfläche) |
| REQ-060–066, 068–070, 073–083, 103 (NFR) | – | ohne UI; REQ-073 Fehlerbanner, REQ-078 Formate, REQ-080 Erlernbarkeit durch Muster |

## 8. Entscheidungen, Annahmen, offene Fragen, Varianten

**Annahmen (Standardannahmen Owner):** OP-17, OP-18 (keine Suchbegriff-/SEO-Felder), OP-29 (Bestandsangaben ohne Neufreigabe), OP-30/REQ-090 (Abgleich-Bestätigung bleibt).

**Varianten mit Empfehlung (Owner entscheidet, nicht von mir entschieden):**
- **V-1 Kopier-Assistent:** (A) ein Screen mit zwei Layouts: Vollfenster und schmal (480 px) per Umschalter — *Empfehlung*; (B) nur schmales Arbeitsfenster, Vollansicht entfällt. Grund A: Nutzer kann je nach Bildschirm wählen, geringer Mehraufwand.
- **V-2 Prüfablauf:** (A) Freigabe je Kanal-Inhalt (UI-016) plus Vergleichsansicht (UI-017) — *Empfehlung*, entspricht REQ-044; (B) Sammelfreigabe aller Kanäle: würde „nie automatisch freigeben“ aufweichen, deshalb nicht empfohlen.
- **V-3 Fotos (REQ-048):** (A) Foto-Ordner öffnen oder ZIP herunterladen, Namen 01 … — *Empfehlung*, nach Baseline v0.1 der einzige tragfähige Weg; (B) Ziehen aus der Seite in fremde Upload-Felder: laut Baseline nicht verlässlich möglich, entfällt.

**Offene Fragen an den Product Owner:**
1. v0.3.1 als Lesestand: **beantwortet** (Owner und Product Owner: gilt).
2. REQ-057 und REQ-059 (Could): vom Product Owner zur textlichen Aufnahme entschieden; eingearbeitet (erledigt).
3a. OF-19-1: Zählen leere Felder in „n von m“ mit? **Entschieden** (Product Owner): nein; Design-Annahme, keine Anforderung. Klärungspunkt an CEOrchestrator gemeldet.
3. REQ-033/085: Hinweis „vorgeschlagen nach Preisregel“ in UI-014: **bestätigt** (Design-Annahme, keine Anforderung).
4. REQ-048: Form der Bereitstellung (siehe V-3): wartet auf OP-15.
5. In UI-029 zeigt die Vorschau den Titel **nach** Kürzung; die Mockup-Beispielzeile mit „zu lang“ entspricht dem Fall „Kürzung nicht möglich“ (Priorität-1-Bestandteile zu lang).

## 9. Stitch-Budget

Stand siehe `stitch-log.md`: **25 von 40** Generierungen (inkl. 1 genehmigte Neugenerierung UI-019 Vollfenster in Korrekturrunde 2). Davon 2 verworfene `edit_screens` (Änderung wurde von Stitch nicht gespeichert, siehe Log) und 2 Neugenerierungen als Ersatz (UI-016, UI-019 compact). Der Richtwert des Product Owners (höchstens 12 weitere ab Stand 11, also 23) ist um 1 überschritten, bedingt durch den zweiten Ersatz (UI-019 compact). Die Meldeschwelle 30 ist nicht erreicht. **v0.4 (MAR-143): keine weiteren Generierungen, Stand unverändert 25 von 40.** UI-044 bis UI-046 und LP-01 bis LP-03 sind nur als `screen.md` beschrieben.

## 10. Lieferstand (Ehrlichkeitsvermerk)

- Vorhanden: `DESIGN.md`, `stitch-log.md`, dieses Dokument, `flows/flow.md`, **43 `screen.md`**, **20 Mockup-Dateien** zu 20 Screens/Zuständen: UI-001, 002, 003, 005, 007, 014, 016 (neu), 017, 018, 019 (default und compact neu), 023, 027, 029, 030, 036, 037, 040 (success), 041, 043.
- Screens ohne Mockup (z. B. UI-004, 006, 008 bis 013, 015, 020 bis 022, 024 bis 026, 028, 031 bis 035, 038, 039, 042): `screen.md` ist die vollständige Beschreibung (Muster P-01 bis P-05).
- **Mockups, die der Spezifikation noch nicht voll entsprechen** (Abweichungen je Screen unter „Bekannte Abweichungen im Mockup“, `screen.md` gilt): UI-019 default (Vollfenster: alter Foto-Button, alte Zählerform), UI-030 (Tabelle rechts abgeschnitten), UI-037 (Stitch-Zusatzelemente), UI-018 und weitere ältere Mockups mit dem Untertitel „Business Portal“. Gründe: Budget und der Tooling-Befund zu `edit_screens`.
- Tooling-Befund: `edit_screens` speichert Änderungen nicht (zweimal beobachtet); Korrekturen nur per Neugenerierung. HTML-Export entfällt weiterhin (Abweichung von Skill marlonet-uiux-stitch §8, siehe Log).
- **v0.4:** Cross-Check mit der Baseline v0.3.1 erfolgt (Kap. 6b); **neue Screens ohne Mockup**; die Mockups UI-002 und UI-019 (default, compact) zeigen den Hinweis UI-044 noch nicht, maßgeblich ist `screen.md`. Noch nicht erfolgt: Product Owner Review, Owner-Freigabe. 46 Screens/Seiten (43 + UI-044 bis UI-046) plus 3 statische Seiten.

## 11. Änderungsprotokoll

| Version | Datum | Änderung |
|---|---|---|
| v0.1 | 06.11.2026 | Erstfassung (Entwurf): Katalog, Flüsse, Muster, Traceability, Mockups Kernscreens |
| v0.2 | 06.11.2026 | Überarbeitung nach Struktur-Review Runde 1 (Commit 53bd6de) |
| v0.3 | 06.11.2026 | Restpunkte Review R1 (Kennzeichnung „Design-Annahme“, Kap. 8); Mockups UI-001, 005, 007, 030, 036, 037, 040, 041, 043; Neugenerierung UI-016 (Freigeben aktiv, Fehlerliste) und UI-019 compact (480 px, „n von m“, Foto-Aktionen); Self-Review (Kap. 12) |
| v0.4 | 06.11.2026 | Cross-Check Baseline v0.3.1 (MAR-143): Kap. 6b/6c, UI-044 bis UI-046, LP-01 bis LP-03, FLOW-10, Muster P-06/P-07, UI-023 bereinigt (Variante a), UI-019 leere Merkmalsfelder, Browser Chrome; keine Mockups, Stitch unverändert 25/40 |

## 12. Self-Review nach Skill marlonet-ui-ux-design §6 (Stand v0.3)

Geprüft wurde mechanisch (Skript) und durch Sichtprüfung der neun neuen und zwei ersetzten Mockups. Eine zeilenweise Neuprüfung aller REQ gegen alle Screens fand **nicht** statt; sie stützt sich auf die Traceability und den Struktur-Review des Product Owners (Runde 1).

| Kriterium | Ergebnis |
|---|---|
| Coverage | Alle aktiven REQ der Traceability haben Screens/Flows. Zurückgezogen: REQ-002/003/096/098. REQ-057/059 (Could) nur textlich. Bearbeitung der Wertzuordnung (UI-036, REQ-025): vom PO entschieden, Bereich in UI-036 genügt; die Lücke ist geschlossen. Mockup-Abweichungen von der Spezifikation (UI-016 Titelzähler und Fehleranzahl, UI-019 compact Banner/Button, UI-030 „Löschen“, UI-043 Breite) sind je Screen unter „Bekannte Abweichungen“ dokumentiert. |
| Spec readiness | Alle 43 `screen.md` enthalten die sieben Pflichtabschnitte (Skriptprüfung). Inhaltliche Vollständigkeit je Feld nicht erneut geprüft. |
| States | Zustandstabelle je Screen vorhanden. Layoutverändernde Zustände ohne Mockup: UI-002 empty, UI-016 geaendert, UI-019 ohne Fotos, UI-018 entwurf-vergleich (nur Text). |
| Consistency | UI-016 und UI-019 compact stimmen jetzt mit `screen.md` überein. UI-019 default (Vollfenster) wurde in Korrekturrunde 2 neu erzeugt und entspricht jetzt `screen.md` bis auf dokumentierte Abweichungen. 440 px nur noch als dokumentierte Abweichung. |
| No invented scope | Von Stitch ergänzte Elemente sind je Screen unter „Bekannte Abweichungen“ gelistet (am stärksten UI-037 und UI-030). Sie sind nicht Teil des Designs. Nicht entfernt, weil `edit_screens` nicht speichert und das Budget begrenzt ist. |
| Error/edge cases | Fehler- und Ablehnungstexte stehen in den Aktionstabellen. Vollbild-Fehlerzustände sind nur Text. |
| Accessibility/responsive | Keine Anforderung (E-2 bis E-4). Es wird keine Konformität behauptet. Kontraste siehe DESIGN.md (Skriptwerte). Mockups sind kein Nachweis. |
| Content/recovery | Texte deutsch, Formate de-DE in den Mockups geprüft (Dezimalkomma, „449,00 €“). |
| Pragmatism | Design System proportional (`DESIGN.md`, proposed). |
| Implementability | Baseline v0.1 nur als Vorabprüfung (Kap. 6a). Formaler Cross-Check offen. |
| Traceability | REQ → FLOW → UI vorhanden. |
| Decision integrity | Bestätigte Annahmen als „Design-Annahme, keine Anforderung“ gekennzeichnet (UI-003, 006, 014, 019, 024). Offene Owner-Entscheidungen: V-1 bis V-3, OP-15, OP-23-Klärung im Cross-Check. Status bleibt draft. |
| Repository state | Alle in `screen.md` genannten PNG existieren (Skriptprüfung). Keine Secrets. |

