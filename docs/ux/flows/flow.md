# Nutzerflüsse (Textdiagramme)

Legende: `[UI-nnn]` Screen, `(Aktion)` Nutzeraktion, `{Bedingung}`. Fehlerpfade je Fluss darunter. Zuordnung zu den Nutzerreisen J-01 bis J-06 der Requirements (Kap. 6.1).

## FLOW-01 Neues Modell erstmals inserieren (J-01)
[UI-006 Modell-Bibliothek] (suchen) {kein Treffer} → [UI-007 Modellvorlage] ({Hersteller neu} → [UI-008]) (speichern) → [UI-003 Gerät einbuchen] (WI-Nr, Werte, Prüfmarkierungen bestätigen) (Speichern und zuordnen) → [UI-004] (Neues Modell-Inserat anlegen) → [UI-014 Modell-Inserat] (Preise je Kanal, [UI-015] Fotos, Lieferumfang) → [UI-016] je Kanal (prüfen, ggf. manuell anpassen, [UI-017] vergleichen; {ungeprüfter Rechtstext} → [UI-022]) (Freigeben) → [UI-019 Kopier-Assistent] (Felder kopieren, Fotos) → [UI-020] (Veröffentlicht) → [UI-010] → [UI-023 Datenblatt] (Drucken/PDF).
Fehlerpfade: WI-Nr vergeben (Fehler am Feld in UI-003); Pflichtangaben fehlen (Feldfehler); Abbruch nach UI-003 → Gerät bleibt nicht zugeordnet, auffindbar in [UI-009]; falsch erfasst → [UI-012] Storno und Neuerfassung.

## FLOW-02 Weiteres Gerät einbuchen (J-02)
[UI-003] (WI-Nr, Zustandscode, Werte bestätigen) → [UI-004] (bestehendes Modell-Inserat wählen) {Abweichung} → [UI-005] (trotzdem zuordnen oder neues Modell-Inserat) → Banner „Stückzahl n“ {Kanal veröffentlicht} → Hinweis „Bestand auf Kanal anpassen“ → [UI-019] → [UI-021] (Abgleich bestätigen).
Fehlerpfade: andere Modellvorlage → Ablehnung; Prüfmarkierung offen → „Erst Werte prüfen“.
Variante (REQ-088): Inseratswerte ändern in [UI-014] (Bearbeiten) → {zugeordnete Geräte weichen danach ab} → Bestätigungsdialog `UI-014.abweichung-bestaetigen` (Änderung trotzdem speichern, protokolliert) | Abbrechen → [UI-014].
Variante (REQ-014/REQ-020): Variantenangabe eines zugeordneten Geräts ändern in [UI-010]/[UI-003] → [UI-005] im Kontext „Gerät bereits zugeordnet“ (Zuordnung behalten | Neues Modell-Inserat anlegen | Umbuchen).

## FLOW-03 Verkauf erfassen (J-03)
[UI-009] (WI-Nr suchen) → [UI-010] → [UI-011] (Kanal, Datum) → [UI-002] (Kennzeichnung „Bestand auf Kanal anpassen“) → anderen Kanal anpassen → [UI-021] {Stückzahl 0 „ausverkauft“} → [UI-020] (Beendet je veröffentlichtem Kanal).
Fehlerpfad: irrtümlich verkauft → [UI-010] (Verkauf zurücknehmen).

## FLOW-04 Textbaustein oder GPSR ändern (J-04)
[UI-030] oder [UI-031] (speichern) → [UI-043] (Anzahl je Gruppe) → [UI-002] (Filter „Geändert seit Freigabe“) → [UI-016] bzw. [UI-018] (erneut freigeben) → [UI-019] → [UI-021].

## FLOW-05 Neue Geräteart anlegen (J-05)
[UI-027] (Geräteart, Merkmale) → [UI-029] (Titelmuster) → [UI-035] (Kategorien) → [UI-036] (Merkmalszuordnung) → [UI-037] (Beschreibungsvorlage, falls abweichend) → [UI-039] (Datenblatt-Layout) → ab sofort FLOW-01.

## FLOW-06 Veröffentlichtes Modell-Inserat ändern (J-06)
[UI-014] (Inseratswerte bearbeiten) oder [UI-007] oder Preis → Kanal-Inhalt „Veröffentlicht“ erhält „geändert seit Freigabe“ → [UI-018] (alt/neu) (Änderungsentwurf freigeben) → „Änderung auf Kanal übertragen“ → [UI-019] (neuen Stand kopieren) → [UI-021].
Fehlerpfad: Freigabebedingung verletzt → Ablehnung mit Liste aller verletzten Bedingungen, freigegebener Stand bleibt im Kopier-Assistenten.
Variante (Kanal-Inhalt Freigegeben, REQ-045, AC-REQ-045-01): Änderung → Kanal-Inhalt wird Entwurf mit „geändert seit Freigabe“ → [UI-016] (Banner, Link „Alt und neu vergleichen“) → [UI-018] (Zustand `entwurf-vergleich`) (Kanal-Inhalt freigeben) → Status Freigegeben.

## FLOW-07 Zugang (nur Netzbetrieb)
Programmstart ohne Zugang → [UI-001] (Passwort) → [UI-002]. Passwort ändern: [UI-040]; andere Programme erhalten bei nächstem Aufruf [UI-001]. Kein Zeitablauf [v0.3.1].

## FLOW-08 Fehlerkorrektur und Löschen
[UI-010] → [UI-013] (WI-Nr korrigieren) | [UI-012] (Storno) | Verkauf zurücknehmen. Löschen: [UI-014]/[UI-007] → [UI-041].

## FLOW-09 Kopier-Assistent nutzen
[UI-014] → [UI-019] (Vollfenster; „Schmale Ansicht“ → compact neben dem Kanal-Formular) → je Feld (Kopieren) im Kanal-Formular einfügen → Fotos herunterladen → [UI-020] (Veröffentlicht) bzw. [UI-021] (Abgleich).
