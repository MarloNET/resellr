# UI-003 – Gerät einbuchen

- Zweck: Gerät per WI-Nr erfassen, Werte prüfen und dem Modell-Inserat zuordnen (häufigste Tätigkeit, Ziel ≤ 2 Minuten).
- Flows: FLOW-01 (Schritte 2–3), FLOW-02 (Schritte 1–2)
- Anforderungen: REQ-012, REQ-013, REQ-014, REQ-015, REQ-009, REQ-062; Kap. 6.0 Schritt 2, Kap. 9.6
- Rollen: Nutzer
- Gerät(e): PC, Fenster frei in der Größe, Untergrenze 1366 × 768 (REQ-077)
- Artefakte: default.png (Stitch e049255c8296451297cb58145dbcf2d2, DESKTOP, 06.11.2026)

## Angezeigte Daten
| Element | Inhalt | Quelle | Hinweise |
|---|---|---|---|
| Klartext Zustandscode | „Klartext übernommen: <Text>“ bzw. „Zustandscode unbekannt“ | Code-Übersetzungstabelle (REQ-015) | erscheint nach Verlassen des Feldes |
| Gewählte Modellvorlage | „<Hersteller> <Modellbezeichnung> (<Typbezeichnung>) · <Geräteart> · Herstellernummer <Nr>“ | Modellvorlage | |
| Modelldaten (nur lesen) | Werte der Merkmale der Ebene Modell | Modellvorlage | Panel rechts, nicht editierbar, ohne Prüfmarkierung |
| Gerätewerte | je Merkmal der Ebene Gerät ein Feld, erzeugt aus den Merkmalsdefinitionen der Geräteart (Reihenfolge wie Datenblatt-Block/Merkmalsreihenfolge) | Merkmalsdefinition (REQ-005), Vorbelegung (REQ-013) | Pflichtfelder mit „*“ |
| Prüfmarkierung | Chip „zu prüfen“ und Link „Bestätigen“ je vorbelegtem Feld | REQ-013 | |
| Statuszeile unten | „Noch n Werte zu prüfen. Das Gerät kann gespeichert, aber noch nicht zugeordnet werden.“ bzw. „Alle Werte geprüft.“ | Erfassungsstatus | |

## Eingaben und Validierung
| Feld | Typ | Pflicht | Regel | Fehlermeldung (Wortlaut) |
|---|---|---|---|---|
| WI-Nr | Text | ja | 1–20 Zeichen, nur Buchstaben und Ziffern; eindeutig über verfügbare/verkaufte Geräte | „WI-Nr bereits vergeben: Gerät <WI-Nr> in <Anzeigetitel>“ bzw. „… Gerät <WI-Nr> (nicht zugeordnet)“, mit Link auf das Gerät (siehe „Meldung „WI-Nr bereits vergeben““ unten); „WI-Nr darf nur Buchstaben und Ziffern enthalten (1–20 Zeichen)“ |
| Lieferant | Auswahl | nein | aktive Lieferanten (REQ-099) | – |
| Zustandscode | Text | nein | max. 20 Zeichen; wirkt nach Verlassen: Klartext in Zustandsbeschreibung, ggf. Vorschlag Zustand/Optik-Note mit Prüfmarkierung | Hinweis „Zustandscode unbekannt“ |
| Modellvorlage | Suche mit Trefferliste (≥ 2 Zeichen) | ja | aktive Modellvorlage | „Bitte eine Modellvorlage wählen“ |
| Zustand | Auswahl | ja | Liste Zustand | „Zustand fehlt“ |
| Optik-Note | Ganzzahl 1–5 | ja | | „Optik-Note: ganze Zahl von 1 bis 5“ |
| Zustandsbeschreibung | Mehrzeilentext | nein | max. 1.000 Zeichen | „Zustandsbeschreibung: höchstens 1.000 Zeichen“ |
| Tastaturlayout, Netzteil, Akku | Auswahl | ja, wenn Geräteart das Merkmal hat | | „<Feld> fehlt“ |
| Akkukapazität | Ganzzahl 0–100 oder „nicht ermittelbar“ | ja, wenn Akku-Wert „Akku vorhanden“ trägt | Feld erscheint/entfällt abhängig vom Akku-Wert | „Akkukapazität: ganze Zahl von 0 bis 100 oder „nicht ermittelbar““ |
| weitere Merkmale | je Datentyp | je Merkmalsdefinition | keine Typumwandlung (Zahl bleibt Zahl, kein Datum) | „<Merkmal>: <Regel>“; **fehlt der Wert eines Pflichtmerkmals (v0.6.4, AC-REQ-005-12 b, M-32): „<Merkmal> fehlt“** (z. B. „RAM fehlt“), Muster wie „<Feld> fehlt“ oben. Beim Ändern eines bereits gespeicherten Geräts (UI-010 öffnet dasselbe Formular) auch dann, wenn die Änderung ein anderes Feld betrifft; Fokus auf das erste markierte Feld, nichts gespeichert |

## Meldung „WI-Nr bereits vergeben“ (v0.6.9, MAR-970)
Klärung des Wortlauts der Meldung `wi_nr_taken`; sie gilt auch in UI-013.
- **Gerät ohne Modell-Inserat** (`details.listingId` fehlt): „WI-Nr bereits vergeben: Gerät <WI-Nr> (nicht zugeordnet)“, z. B. „WI-Nr bereits vergeben: Gerät 626198 (nicht zugeordnet)“. „nicht zugeordnet“ wie in UI-009/UI-010.
- **Gerät mit Modell-Inserat:** „WI-Nr bereits vergeben: Gerät <WI-Nr> in <Anzeigetitel>“; <Modell-Inserat> ist der Anzeigetitel des Modell-Inserats (`display_title`, wie „Modell-Inserat (Titel)“ in UI-009).
- **<WI-Nr>** ist die WI-Nr des vorhandenen Geräts in der gespeicherten Schreibweise (die Prüfung ignoriert Groß-/Kleinschreibung), nicht die Eingabe.
- **Link:** „Gerät <WI-Nr>“ ist ein Link auf das vorhandene Gerät (UI-010, `/geraete/{deviceId}`, `details.deviceId` ist immer vorhanden). Das Modell-Inserat ist nur genannt, nicht verlinkt (UI-010 zeigt es im Kopf mit Link). Der Link öffnet im selben Fenster; die Eingaben im Formular gehen dabei verloren, das Formular wird nicht gesperrt.

## Auswahl nach Ablehnung wegen Deaktivierung (v0.6.8, MAR-927, DG-19)
Es gilt die Regel von UI-007 („Auswahl nach Ablehnung und vor der ersten Wahl“, v0.6.7) unverändert, mit diesen Ergänzungen für dieses Formular. Betroffen sind Lieferant (`supplier_deactivated`) und alle Auswahlfelder mit Auswahllistenwerten (Zustand, Tastaturlayout, Netzteil, Akku, weitere Auswahlmerkmale; `pick_list_value_deactivated`). Die Modellvorlage ist keine Auswahlliste dieser Art und nicht betroffen.
- **Anzeige.** Fehlt der gewählte Eintrag nach der Ablehnung und dem Neuladen der Liste, ist das Feld leer, kein Eintrag vorausgewählt, die abgelehnte ID wird nie erneut gesendet. **Pflichtfelder** (Zustand, Tastaturlayout, Netzteil, Akku): Platzhalter „Bitte wählen“ (nicht wählbar). **Lieferant (optional):** Entscheidung: **leer statt „Bitte wählen“**; die leere Wahl „kein Lieferant“ bleibt zulässig und ist erst nach dem Neuladen sichtbar eine aktive Wahl des Nutzers.
- **Meldung.** „Lieferant <Name> ist deaktiviert“ bzw. „<Feld> <Name> ist deaktiviert“ (z. B. „Zustand B-Ware ist deaktiviert“; bei Auswahlmerkmalen mit Doppelpunkt „<Merkmal>: <Wert> ist deaktiviert“, z. B. „Tastaturlayout: Ungarisch ist deaktiviert“, v0.6.10, MAR-986, Wortlaut nach Specification Kap. 2.0.6) am Feld; sie bleibt bis zur nächsten Wahl im Feld (beim Lieferanten auch die leere Wahl). Fokus auf das erste abgelehnte Feld in Formularreihenfolge, nichts gespeichert; sind mehrere Felder betroffen, tragen alle ihre Meldung. Speichern ohne Wahl: bei Pflichtfeldern „<Feld> fehlt“, beim Lieferanten kein Fehler.
- **Abhängige Eingaben.** Alle übrigen Eingaben bleiben erhalten (auch Zustandscode und bereits übernommene Vorschläge samt Prüfmarkierung). Wird der Lieferant abgelehnt, wird der Klartext des Zustandscodes neu ermittelt (ohne Lieferant gelten nur Übersetzungen für „alle“; Hinweis „Zustandscode unbekannt“ möglich); bereits eingetragene Zustandswerte werden nicht überschrieben. Wird der Akku-Wert abgelehnt, entfällt das Feld Akkukapazität samt Wert (wie beim normalen Wechsel des Akku-Werts), bis ein aktiver Akku-Wert gewählt ist.
- **Ändern (UI-010 öffnet dasselbe Formular).** Kein Rückfall auf den gespeicherten Wert. Der gespeicherte, ggf. deaktivierte Eintrag bleibt in der Liste wählbar, wird dort mit „(deaktiviert)“ gekennzeichnet; wird er unverändert gespeichert, entsteht keine Ablehnung. Zusatz „(deaktiviert)“ nur für den gespeicherten Eintrag. Ein im Entwurf gewählter, noch nicht abgelehnter Eintrag, der nach einem Neuladen deaktiviert ist, bleibt gewählt und ohne Zusatz angeboten; Speichern führt zur Ablehnung nach DG-19.

## Aktionen
| Aktion | Auslöser | Voraussetzung | Ergebnis bei Erfolg | Ergebnis bei Fehler | Navigation danach |
|---|---|---|---|---|---|
| Bestätigen | Link je Feld oder Ändern des Werts | – | Prüfmarkierung entfernt, Zähler sinkt | – | bleibt |
| Gerät speichern | Sekundärbutton, Strg+S | WI-Nr, Modellvorlage gültig | Gerät gespeichert, Status „unvollständig geprüft“ oder „geprüft“, Banner „Gerät <WI-Nr> gespeichert“ | Fehler am Feld | bleibt, Formular wird geleert, wenn kein Wert mehr zu prüfen und „Weiteres Gerät“ gewählt |
| Speichern und zuordnen | Primärbutton, Strg+Enter | alle Prüfmarkierungen aufgehoben; Pflichtfelder gültig | Gerät gespeichert | Fehler am Feld; deaktiviert mit Hinweis, solange Werte zu prüfen sind („Erst Werte prüfen“ mit Nennung der Felder) | UI-004 |
| Andere Modellvorlage wählen | Link | – | Suchfeld aktiv | – | bleibt |
| Neue Modellvorlage anlegen | Link | – | öffnet UI-007 (WI-Nr und Eingaben bleiben erhalten) | – | UI-007, danach zurück zu UI-003 |

## Zustände
| Zustand | Darstellung | Artefakt | Text |
|---|---|---|---|
| default | WI-Nr leer, Modellvorlage leer; Gerätewerte erst nach Modellvorlage sichtbar | default.png zeigt Teilstand mit Prüfmarkierungen | – |
| loading | Gerätewerte-Karte lädt nach Modellvorlagen-Wahl | nur Text | „Lade Gerätewerte …“ |
| empty | n/a (Eingabeformular) | – | – |
| error | Banner | nur Text | „Das Gerät konnte nicht gespeichert werden. Bitte erneut versuchen. Referenz: <Nr>“ |
| validation | Feldfehler, Fehlerzusammenfassung oben bei „Speichern“ | im Mockup an Akkukapazität | siehe Eingaben |
| success | Banner | nur Text | „Gerät <WI-Nr> gespeichert“ |
| disabled | „Speichern und zuordnen“ deaktiviert bei offenen Prüfmarkierungen | default.png | Tooltip „Erst Werte prüfen“ |
| ausgang-unbekannt (K-6) | Schreibende Aktion ohne Antwort (Verbindungsverlust): Aktion bleibt bis zum Neuladen der Seite gesperrt, Banner „Ausgang unbekannt, bitte neu laden“ (Muster P-08, uiux-design.md Kap. 5), Eingaben bleiben sichtbar, **kein „Erneut versuchen“**; es wird nicht von „noch nicht gespeichert“ ausgegangen. Ablehnung „resellr wird beendet“: P-07 (nicht gespeichert) | nur Text | „Ausgang unbekannt, bitte neu laden.“ |

## Fenstergröße und Bedienung
Ab Fensterbreite 1366 px dreispaltiges Raster, Info-Panel rechts. Fokusreihenfolge siehe uiux-design.md Kap. 5. Beim Öffnen Fokus in WI-Nr; Enter in WI-Nr springt zu Lieferant. Unter 1366 CSS-px (Zoom, schmaleres Fenster) gilt die Reflow-Regel R-1 (uiux-design.md Kap. 5, DESIGN.md).

## Bekannte Abweichungen im Mockup
„Business Portal“ unter „resellr“ (Stitch); Platzhalter „Modellname, Typ-Nummer oder Herstellernummer eingeben…“ im Suchfeld (entfällt); Hinweis „Stammdaten aus Bibliotheksmodell fest verknüpft“ im Info-Panel (nicht Teil des Designs); der Fehlerzustand an Akkukapazität „87“ ist nur Beispiel einer Validierungsmeldung (87 ist gültig); Zustandsliste im Mockup zeigt Beispiel-Optionen, maßgeblich Kap. 9.2; Zustandscode-Feld in Monospace (nicht Teil des Designs).

## Annahmen und offene Fragen
- Annahme: Nach „Gerät speichern“ bleibt die Seite offen; Modellvorlage wird für das nächste Gerät behalten („Weiteres Gerät derselben Modellvorlage“ als Checkbox, standardmäßig an) – beschleunigt J-02. **Design-Annahme, keine Anforderung (vom Product Owner bestätigt).**
- Offen: Reihenfolge der Gerätewerte-Felder je Geräteart folgt der Merkmalsreihenfolge (UI-027).
