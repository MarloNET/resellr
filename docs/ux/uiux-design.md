# UI/UX-Design – resellr Phase 1 / Release 0.1 „Inserat-Generator“

## 1. Metadaten und Basis

| Feld | Wert |
|---|---|
| Projekt / Release | resellr (Arbeitstitel), Phase 1 / Release 0.1 |
| Dokumentversion | v0.1 (Entwurf, siehe Kap. 10 „Lieferstand“) |
| Status | draft (kein Review, keine Freigabe) |
| Klassifikation | **Material** (Owner bestätigt) |
| Autor / Datum | UI/UX Designer, 06.11.2026 |
| Paperclip-Task | MAR-128 (Parent MAR-126) |
| Repository / Branch | MarloNET/resellr, `design/MAR-126` |
| Requirements | v0.3 Rev. `170ca77f` (freigegeben, bindend); **gelesen wurde die aktuelle Revision v0.3.1 `d816223d`** (Delta-Review pending, nicht freigegeben), da MAR-114 nur diese als Dokument liefert. Auswirkung auf UI: nur UI-001/UI-040 (kein Zeitablauf, andere Zugänge enden bei Passwortänderung). Stellen sind mit „[v0.3.1]“ markiert. |
| Product Brief | v1.0, Commit `45d5ef6`, `docs/product/product-brief.md` |
| Owner-Entscheidungen | E-1 bis E-6 (MAR-121) |
| Architecture Baseline | liegt nicht vor; Owner hat am 06.11.2026 entschieden, nicht darauf zu warten (Kommentar an MAR-128). Cross-Check folgt später. |
| Stitch | Projekt `7947641073263768710`, Design-System-Asset `14699510063308426971`, Budget siehe `stitch-log.md` |
| Design-System | `DESIGN.md`, Status **vorgeschlagen** |

## 2. Nutzer, Umfang, Designziele

- **Nutzer:** genau eine Person (der Owner, E-4). Keine Konten, Rollen, rollenabhängige Sichten.
- **Plattform:** ein PC, Tastatur und Maus, ab 1366 × 768 (REQ-077). Kein Smartphone, kein Tablet (E-2). **Web oder Desktop (OP-15):** Die Architecture Baseline v0.1 (MAR-125, Entwurf, nicht freigegeben) schlägt eine lokale Webanwendung im Browserfenster vor (ADR-001). Das Design folgt dieser Annahme unter Vorbehalt der Baseline-Freigabe; Chromium (Edge/Chrome) Referenz, Firefox unterstützt.
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
| FLOW-07 | Zugang (Netzbetrieb) | REQ-001/097 | UI-001; UI-040 |
| FLOW-08 | Fehlerkorrektur und Löschen | REQ-092/093/084/095 | UI-010 → UI-013 / UI-012 / UI-011 (Rücknahme); UI-014/UI-007 → UI-041 |
| FLOW-09 | Kopier-Assistent nutzen | REQ-047–049 | UI-014 → UI-019 (Vollfenster oder schmal) → UI-020 / UI-021 |

**Informationsarchitektur (linke Navigation, 208 px, immer sichtbar):** Inserate (UI-002) · Gerät einbuchen (UI-003) · Modell-Bibliothek (UI-006) · Geräte (UI-009) · Änderungsprotokoll (UI-024) · Einstellungen (UI-025, mit zweiter Spalte für 15 Bereiche).
Datenblatt (UI-023), Kopier-Assistent (UI-019), Kanal-Inhalt (UI-016/017/018) und Fotos (UI-015) sind keine Hauptnavigationspunkte, sondern Folgeseiten des Modell-Inserats (UI-014) bzw. Geräts (UI-010). „Zugangspasswort“ erscheint nur im Netzbetrieb als 15. Eintrag der Einstellungen; im Betrieb nur am Arbeitsplatzrechner fehlt dieser Eintrag und UI-001.
Navigationsregeln: Seitenwechsel ersetzt den Inhaltsbereich; „← Zurück …“-Link oben links führt zur Aufrufseite; Dialoge (UI-004, 005, 008, 011, 012, 013, 020, 021, 022, 041, 043) sind modal und kehren nach Abschluss zur Aufrufseite zurück, sofern nicht anders in `screen.md`.

## 4. Screen-Katalog

Spalte „Mockup“: Zustände mit PNG. „Text“ = nur `screen.md` (Muster P-01 bis P-04, Kap. 5). Pfad: `docs/ux/screens/UI-NNN-<slug>/`.

| ID | Name | Zweck | REQ | FLOW | Mockup | Ordner |
|---|---|---|---|---|---|---|
| UI-001 | Zugang | Zugangspasswort eingeben (Netzbetrieb) | REQ-001 | 07 | Text | UI-001-zugang |
| UI-002 | Inserat-Übersicht | Modell-Inserate mit Status/Kennzeichnungen filtern | REQ-052, 046, 090 | 03, 06 | default | UI-002-inserat-uebersicht |
| UI-003 | Gerät einbuchen | Gerät per WI-Nr erfassen, Werte prüfen | REQ-012–015, 062 | 01, 02 | default | UI-003-geraet-einbuchen |
| UI-004 | Modell-Inserat wählen (Dialog) | Gerät zuordnen oder neues Modell-Inserat anlegen | REQ-017, 019 | 01, 02 | Text | UI-004-zuordnen-dialog |
| UI-005 | Abweichungen bei Zuordnung (Dialog) | Abweichung der Variantenangaben entscheiden | REQ-018 | 02 | Text | UI-005-abweichungen-dialog |
| UI-006 | Modell-Bibliothek | Modellvorlagen suchen | REQ-009 | 01 | Text | UI-006-modell-bibliothek |
| UI-007 | Modellvorlage anlegen/ändern | Modelldaten und Vorbelegungen pflegen | REQ-008, 010, 011, 058 | 01, 06 | Text | UI-007-modellvorlage |
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
| UI-030 | Textbausteine | Texte, Geltungsbereich, Prüfstatus | REQ-026, 054 | 04 | Text | UI-030-textbausteine |
| UI-031 | Hersteller und GPSR | Hersteller, GPSR-Angaben | REQ-027, 100, 101 | 04 | Text | UI-031-hersteller-gpsr |
| UI-032 | Lieferanten | Lieferanten pflegen | REQ-099 | – | Text | UI-032-lieferanten |
| UI-033 | Code-Übersetzung | Zustandscodes | REQ-022 | – | Text | UI-033-code-uebersetzung |
| UI-034 | Zustandszuordnung | Zustand → Kanal-Bezeichnung | REQ-023 | – | Text | UI-034-zustandszuordnung |
| UI-035 | Kategoriezuordnung | Geräteart → Kanal-Kategorie | REQ-024 | 05 | Text | UI-035-kategoriezuordnung |
| UI-036 | Merkmalszuordnung | Felder je Kanal/Geräteart, Reihenfolge | REQ-025 | 05 | Text | UI-036-merkmalszuordnung |
| UI-037 | Beschreibungsvorlagen | Abschnitte je Kanal | REQ-031, 036 | 05 | Text | UI-037-beschreibungsvorlagen |
| UI-038 | Kanäle und Preisregeln | Kanal-Einstellungen, Preisregel | REQ-029, 033, 085 | – | Text | UI-038-kanaele-preisregeln |
| UI-039 | Datenblatt-Layout | Kopfzeilen, Blockfolge | REQ-051 | 05 | Text | UI-039-datenblatt-layout |
| UI-040 | Zugangspasswort ändern | Passwort ändern (Netzbetrieb) | REQ-097, 067 | 07 | Text | UI-040-zugangspasswort |
| UI-041 | Löschen bestätigen (Dialog) | Modell-Inserat/Modellvorlage löschen | REQ-095, 103 | 08 | Text | UI-041-loeschen-dialog |
| UI-042 | Excel-Übernahme | Datenblatt-Excel einlesen (Could) | REQ-056 | – | Text | UI-042-excel-uebernahme |
| UI-043 | Auswirkung der Änderung (Dialog) | Anzahl betroffener Kanal-Inhalte melden | REQ-053, 043 | 04 | Text | UI-043-auswirkung-dialog |

Nicht abgedeckt, weil nicht in Kap. 6 gefordert: Suche über alles, Dashboard, Benutzerverwaltung. Die Pflege-Kanalfeld-Reihenfolge des Kopier-Assistenten (REQ-029) liegt in UI-036.

## 5. Muster und übergreifende Regeln

- **P-01 Pflege-Tabelle (Einstellungen mit Listen):** Tabelle links, Detailbereich rechts oder Dialog; Zeilenaktionen „Bearbeiten“, „Deaktivieren“; Reihenfolge per Ziehen oder Hoch/Runter-Buttons (Tastatur); „Anlegen“-Button oben rechts; Primärbutton im Detail „Speichern“, daneben „Abbrechen“.
- **P-02 Zuordnungstabelle (Kanal × Quelle/Wert):** Auswahl Kanal/Geräteart oben, Tabelle mit Dropdown-Zellen, Zeile „Zeile hinzufügen“, Validierungsfehler je Zelle.
- **P-03 Muster-/Vorlagen-Editor mit Vorschau:** Bestandteile als Zeilen, Platzhalter-Auswahl nach Gruppen (Kap. 9.7), Vorschau je Kanal am Beispiel-Modell, Fehler bei unzulässigem Platzhalter inline (UI-029).
- **P-05 Konflikt:** Meldet das Speichern oder Freigeben einen Konflikt (Datensatz in anderem Fenster geändert, Baseline 9.3), erscheint ein Banner „Dieser Eintrag wurde inzwischen in einem anderen Fenster geändert. Bitte neu laden und erneut prüfen.“ mit Button „Neu laden“. Es wird nichts gespeichert oder freigegeben; eingegebene Werte bleiben bis zum Neuladen sichtbar. Zustand `.conflict` gilt für alle Formulare, UI-016 und UI-018.
- **P-04 Bestätigungsdialog:** Titel = Aktion, Text nennt Wirkung, Buttons: „Abbrechen“ (links), Aktion (rechts, bei Löschen/Storno destruktiv).
- **Validierung:** Fehler am Feld, Fehlertext aus Kap. 6/9.6 im Wortlaut der Requirements; Prüfung beim Verlassen des Feldes und beim Speichern; erster Fehler erhält Fokus. Zahlen akzeptieren Dezimalkomma und -punkt (Kap. 9.6).
- **Feedback:** Erfolg als Banner oben (z. B. „Zugangspasswort geändert“), schließt nach 5 s oder per „×“; technische Fehler als Banner mit Funktion, nächstem Schritt, Referenznummer (REQ-073).
- **Zustände (State-IDs):** `UI-nnn.default`, `.loading` (Skeleton/„Lade …“ bis 5 s, danach Fehler), `.empty`, `.error`, `.validation`, `.success`, `.disabled`, `.conflict` (P-05). Rollenabhängige Zustände entfallen (E-4). Offline/Timeout: nicht vorgesehen (A-02); Verbindungsfehler im Netzbetrieb → `.error`.
- **Tastatur:** Tab-Reihenfolge = Leserichtung; Enter bestätigt Primäraktion eines Formulars/Dialogs; Esc schließt Dialoge und Dropdowns; im Kopier-Assistenten Pfeil auf/ab wählt Feld, Enter kopiert das gewählte Feld und springt zum nächsten offenen (als Bedienkomfort, keine Konformitätsaussage). Einbuchen: Fokus beim Öffnen von UI-003 in „WI-Nr“; Reihenfolge WI-Nr → Lieferant → Zustandscode → Modellvorlage → Gerätewerte.
- **Fensterbreiten:** ≥ 1366 px: volle Ansicht. UI-019 zusätzlich schmale Ansicht (440 px, ohne Navigation), erreichbar über „Schmale Ansicht“/„Normale Ansicht“; ob als eigenes Fenster oder Umschalter, hängt von OP-15 ab. Unter 1366 px wird nicht gestaltet.
- **Kennzeichnungen (Kap. 9.4):** je Kennzeichnung ein Text-Chip; Reihenfolge: Fehlt-Hinweise, „geändert seit Freigabe“, „Änderung auf Kanal übertragen“, „Bestand auf Kanal anpassen“, „manuell angepasst“, „Kategorie manuell“, „Titel gekürzt, bitte prüfen“.

## 6. Feasibility- und Handoff-Hinweise

- **Abhängig von OP-15 (Web oder Desktop), vom Software Architect zu bestätigen:**
  1. Zwischenablage je Feld (REQ-047): im Browser nur mit Nutzeraktion; in beiden Varianten möglich.
  2. Fotos bereitstellen (REQ-048): Entwurf „Fotos herunterladen“ (Ordner oder ZIP mit Namen 01 …). Direktes Ziehen in ein anderes Programm nur bei Desktop wahrscheinlich; **nicht entworfen**.
  3. Schmales Arbeitsfenster neben anderem Programm (UI-019 compact): als eigenes Fenster nur bei Desktop oder per Pop-out; sonst Fenstergröße vom Nutzer.
  4. Druck: UI-023 zeigt Vorschau mit „Drucken“ und „Als PDF speichern“; Dialoge des Betriebssystems/Browsers werden nicht gestaltet.
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
| C-8 | – | Baseline OD-07: Hinweis in der Oberfläche bei fehlgeschlagener Sicherung nur vorgeschlagen. | Kein Screen vorhanden. | **Entschieden (Owner, 06.11.2026): kein Screen für den Sicherungshinweis.** | entschieden |
| C-9 | UI-015 | Upload-Grenzen der Baseline (JPEG/PNG, 20 MB, 20 Fotos) entsprechen dem Design. | keine | – | ok |
| C-10 | UI-003, UI-006 | Baseline: Suche nach Modellvorlage/WI-Nr serverseitig, schnell genug für Trefferliste während der Eingabe. | keine | – | ok |

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
| REQ-057, 059 | – | **nicht entworfen** (Could; REQ-057 Importdatei, REQ-059 Warnung): Lücke, Entscheidung PO |
| REQ-091 | 02, 03 | wirkt in UI-014/016/019/002 (keine eigene Oberfläche) |
| REQ-060–066, 068–070, 073–083, 103 (NFR) | – | ohne UI; REQ-073 Fehlerbanner, REQ-078 Formate, REQ-080 Erlernbarkeit durch Muster |

## 8. Entscheidungen, Annahmen, offene Fragen, Varianten

**Annahmen (Standardannahmen Owner):** OP-17, OP-18 (keine Suchbegriff-/SEO-Felder), OP-29 (Bestandsangaben ohne Neufreigabe), OP-30/REQ-090 (Abgleich-Bestätigung bleibt).

**Varianten mit Empfehlung (Owner entscheidet, nicht von mir entschieden):**
- **V-1 Kopier-Assistent:** (A) ein Screen mit zwei Layouts: Vollfenster und schmal (440 px) per Umschalter — *Empfehlung*; (B) nur schmales Arbeitsfenster, Vollansicht entfällt. Grund A: Nutzer kann je nach Bildschirm wählen, geringer Mehraufwand.
- **V-2 Prüfablauf:** (A) Freigabe je Kanal-Inhalt (UI-016) plus Vergleichsansicht (UI-017) — *Empfehlung*, entspricht REQ-044; (B) Sammelfreigabe aller Kanäle: würde „nie automatisch freigeben“ aufweichen, deshalb nicht empfohlen.
- **V-3 Fotos (REQ-048):** (A) Foto-Ordner öffnen oder ZIP herunterladen, Namen 01 … — *Empfehlung*, nach Baseline v0.1 der einzige tragfähige Weg; (B) Ziehen aus der Seite in fremde Upload-Felder: laut Baseline nicht verlässlich möglich, entfällt.

**Offene Fragen an den Product Owner:**
1. v0.3.1 als Lesestand bestätigen (Kap. 1).
2. REQ-057 (Importdatei) und REQ-059 (Kategorie-Warnung) sind Could; nicht gestaltet. Aufnehmen?
3. REQ-033/085: Preis-Vorschlag-Anzeige in UI-014 als Hinweis „vorgeschlagen nach Preisregel“ — in Requirements nicht textlich festgelegt; Annahme in `screen.md`.
4. REQ-048: Form der Bereitstellung (siehe V-3) wird mit OP-15 final.
5. In UI-029 zeigt die Vorschau den Titel **nach** Kürzung; die Mockup-Beispielzeile mit „zu lang“ entspricht dem Fall „Kürzung nicht möglich“ (Priorität-1-Bestandteile zu lang).

## 9. Stitch-Budget

Stand siehe `stitch-log.md` (aktuell 11 von 40). Geplant: weitere Mockups für UI-001, UI-005, UI-007, UI-030, UI-036, UI-037, UI-040, UI-041/043 und Zustände (UI-002 empty, UI-016 Entwurfsvergleich, UI-019 empty fotos).

## 10. Lieferstand (Ehrlichkeitsvermerk)

- Vorhanden: `DESIGN.md`, `stitch-log.md`, dieses Dokument, `flows/flow.md`, **43 `screen.md`** (alle Screens des Katalogs), Mockups für 11 Screens/Zustände (UI-002, 003, 014, 016, 017, 018, 019 default+compact, 023, 027, 029).
- Screens ohne Mockup tragen „nur Text“ (Muster P-01 bis P-04). Dort ist `screen.md` die vollständige Beschreibung; Mockups für wichtige Screens sind geplant (Stand siehe `stitch-log.md`), kein Ersatz für die Textbeschreibung.
- Noch **nicht** erfolgt: Self-Review nach Skill §6 (Teilprüfung im Kommentar), Cross-Check mit der Architecture Baseline (liegt nicht vor), Product Owner Review.
- Stitch ergänzt je Screen den Untertitel „Business Portal“ in der Navigation (kein Teil des Designs, siehe `screen.md` „Bekannte Abweichungen“).

## 11. Änderungsprotokoll

| Version | Datum | Änderung |
|---|---|---|
| v0.1 | 06.11.2026 | Erstfassung (Entwurf): Katalog, Flüsse, Muster, Traceability, Mockups Kernscreens |
