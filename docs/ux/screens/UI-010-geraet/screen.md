# UI-010 – Gerät

- Zweck: Gerätewerte ansehen/ändern, Verkauf, Umbuchen, WI-Nr korrigieren, Storno, Datenblatt.
- Flows: FLOW-03, FLOW-08 · Anforderungen: REQ-014, REQ-016, REQ-020, REQ-021, REQ-084, REQ-092, REQ-093, REQ-050 · Rollen: Nutzer · Gerät(e): PC · Artefakte: nur Text (kein Mockup; Screen ist Text-Spezifikation)

## Angezeigte Daten
| Element | Inhalt | Quelle | Hinweise |
|---|---|---|---|
| Kopf | WI-Nr, Modellvorlage, Modell-Inserat (Link) oder „nicht zugeordnet“, Chips Bestandsstatus und Erfassungsstatus | Gerät | bei verkauft: „verkauft über <Kanal> am <Datum>“; bei storniert: Grund und Zeitpunkt |
| Gerätewerte | Formular wie UI-003 (ohne WI-Nr-Eingabe) | Gerät | nur bei Status verfügbar bearbeitbar |
| Prüfmarkierungen | Chip „zu prüfen“ je Feld | REQ-013 | |

## Eingaben und Validierung
Gerätewerte wie UI-003 (Regeln REQ-014; Meldungstexte der Merkmalswerte: meldungskatalog.md, Ergänzung v0.6.13, MAR-548). **v0.6.4 (REQ-005, AC-REQ-005-12 b):** Fehlt dem Gerät der Wert eines (wieder aktivierten) Pflichtmerkmals, wird „Gerätewerte speichern“ abgelehnt, auch wenn nur ein anderes Feld geändert wurde (z. B. Optik-Note beim am 11.11. erfassten Notebook ohne RAM-Wert): Feldfehler „<Merkmal> fehlt“ (M-32, z. B. „RAM fehlt“) am Feld des Merkmals, Fokus dorthin, nichts gespeichert; nach Eintragen des Werts wird gespeichert. Das Merkmal erscheint als leeres Pflichtfeld („*“), weil es nach dem Aktivieren wieder abgefragt wird. Andere Vorgänge in UI-010 (Verkauf, Umbuchen, Zuordnen, WI-Nr korrigieren, Storno, Datenblatt) verlangen den Wert nicht und zeigen M-32 nicht (A-39). Ändert der Nutzer eine Variantenangabe eines zugeordneten Geräts und weicht sie ab: UI-005 mit Wahl „Zuordnung behalten“, „Neues Modell-Inserat anlegen“, „Umbuchen“.

**Auswahl nach Ablehnung wegen Deaktivierung (v0.6.8, MAR-927, DG-19).** Für Lieferant, Zustand, Tastaturlayout, Netzteil, Akku und weitere Auswahlmerkmale gilt die Regel in UI-003 („Auswahl nach Ablehnung wegen Deaktivierung“), die ihrerseits die Regel von UI-007 übernimmt, unverändert: Platzhalter „Bitte wählen“ bei Pflichtfeldern, Lieferant (optional) leer, Meldung „<Feld> <Name> ist deaktiviert“ (bei Auswahlmerkmalen „<Merkmal>: <Wert> ist deaktiviert“, v0.6.10, MAR-986) am Feld bis zur nächsten Wahl, Fokus auf das Feld, nichts gespeichert, kein Rückfall auf den gespeicherten Wert, gespeicherter (ggf. deaktivierter) Eintrag bleibt wählbar und wird unverändert ohne Ablehnung gespeichert. Gilt nur für „Gerätewerte speichern“; Verkauf, Umbuchen, Storno u. a. senden diese Felder nicht. Zusatz „(deaktiviert)“ nur für den gespeicherten Eintrag. Ein im Entwurf gewählter, noch nicht abgelehnter Eintrag, der nach einem Neuladen deaktiviert ist, bleibt gewählt und ohne Zusatz angeboten; Speichern führt zur Ablehnung nach DG-19.

## Aktionen
| Aktion | Auslöser | Voraussetzung | Ergebnis bei Erfolg | Ergebnis bei Fehler | Navigation danach |
|---|---|---|---|---|---|
| Gerätewerte speichern | Primärbutton | gültig | Banner „Gerät gespeichert“ | Feldfehler (auch „<Merkmal> fehlt“, M-32) | bleibt |
| Als verkauft markieren | Button | verfügbar, zugeordnet | UI-011 | „Gerät keinem Modell-Inserat zugeordnet“ (Button deaktiviert, Tooltip) | UI-011 |
| Verkauf zurücknehmen | Button | Status verkauft | Bestätigungsdialog (P-04): „Verkaufsmarkierung zurücknehmen? Stückzahl steigt um 1.“ → Status verfügbar, Protokoll | „Gerät ist nicht als verkauft markiert“ | bleibt |
| Umbuchen (Should) | Button | verfügbar, zugeordnet | UI-004 im Modus „umbuchen“ | – | UI-004 |
| WI-Nr korrigieren (Should) | Button | verfügbar oder verkauft | UI-013 | – | UI-013 |
| Gerät stornieren | destruktiver Textbutton | verfügbar | UI-012 | – | UI-012 |
| Zuordnen | Button | nicht zugeordnet, geprüft | UI-004 | „Erst Werte prüfen“ | UI-004 |
| Datenblatt | Sekundärbutton | geprüft, zugeordnet, nicht storniert | – | Hinweise nach REQ-050 (Tooltip) | UI-023 |

## Zustände
| Zustand | Darstellung | Artefakt | Text |
|---|---|---|---|
| default | wie oben | nur Text | – |
| loading | Platzhalter | nur Text | „Lade Gerät …“ |
| empty | n/a | – | – |
| error | Banner | nur Text | „Gerät konnte nicht geladen/gespeichert werden. Referenz: <Nr>“ |
| validation | Feldfehler | nur Text | |
| success | Banner | nur Text | „Gerät gespeichert“ |
| disabled | verkauft/storniert: Werte schreibgeschützt, Aktionen je Status | nur Text | „Gerät storniert“ |

## Fenstergröße und Bedienung
Ab 1366 px, Aktionen oben rechts. Unter 1366 CSS-px (Zoom, schmaleres Fenster) gilt die Reflow-Regel R-1 (uiux-design.md Kap. 5, DESIGN.md).

## Bekannte Abweichungen im Mockup
keine (kein Mockup).

## Annahmen und offene Fragen
- Annahme: Akkukapazität darf auch bei verkauften Geräten nicht geändert werden (REQ-014 betrifft zugeordnete verfügbare Geräte).
