# UI-005 – Abweichungen bei Zuordnung (Dialog)

- Zweck: Abweichungen der Variantenangaben zwischen Gerät und gewähltem Modell-Inserat zeigen und entscheiden.
- Flows: FLOW-02
- Anforderungen: REQ-018, REQ-014, REQ-019 (Kontext B, v0.6.15), REQ-020 (Should), REQ-072; AC-REQ-014-07, AC-REQ-020-01 bis -04
- Kontexte: **A** Zuordnen eines Geräts (aus UI-004, REQ-018); **B** Gerät ist bereits zugeordnet, eine Variantenangabe wurde geändert (aus UI-003/UI-010, REQ-014)
- Rollen: Nutzer · Gerät(e): PC
- Artefakte: default.png (Stitch 3e8680e117f941aa8112e320354fb2a7, DESKTOP, 06.11.2026)

## Angezeigte Daten
| Element | Inhalt | Quelle | Hinweise |
|---|---|---|---|
| Tabelle | je abweichender Variantenangabe: Merkmal, Wert am Gerät, Wert am Modell-Inserat | REQ-018 | nur Variantenmerkmale (Zustand, Optik-Note, Zustandsbeschreibung, Variantenmerkmale) |
| Zustandsbeschreibung | beide Texte vollständig, nebeneinander | REQ-018 | |
| Hinweis | „Das Gerät weicht vom Modell-Inserat ab.“ | | Zeilenformat z. B. „Optik-Note: Gerät 4, Modell-Inserat 2“ |
| **Schritt 2 „Ziel weicht ab“ (v0.6, MAR-167, nur beim Umbuchen)** | siehe Abschnitt „Umbuchen: Ziel weicht ab“ unten | REQ-014, REQ-020, AC-REQ-020-04 | Erscheint nur, wenn das gewählte Ziel-Modell-Inserat von den Variantenangaben des Geräts abweicht |

## Eingaben und Validierung
Kontext A und Schritt 1/2 des Umbuchens: keine Eingaben.

**Nur Kontext B, nur nach Ablehnung `article_number_taken` (v0.6.15, MAR-1252, DG-22, #201):**

| Feld | Typ | Pflicht | Regel | Fehlermeldung |
|---|---|---|---|---|
| Artikelnummer | Text | ja | 1–30 Zeichen, Buchstaben, Ziffern, „-“, eindeutig (Regel und Texte wie UI-004) | „Artikelnummer bereits vergeben“ (bei Format-/Pflichtverstoß die Texte von UI-004) |

Das Feld ist vorher nicht sichtbar. Es erscheint, wenn „Neues Modell-Inserat anlegen“ abgelehnt wurde, weil die WI-Nr (die im Kontext B schon Artikelnummer des zugeordneten Modell-Inserats ist) vergeben ist. Platzierung: unter der Abweichungstabelle, über der Aktionsleiste. Vorbelegt mit dem zuletzt gesendeten Wert (zuerst die WI-Nr), bleibt bis zum Schließen des Dialogs sichtbar. Der Dialog bleibt offen; „Zuordnung behalten“ und „Umbuchen“ bleiben möglich und senden keine Artikelnummer.

## Aktionen
| Aktion | Auslöser | Voraussetzung | Ergebnis bei Erfolg | Ergebnis bei Fehler | Navigation danach |
|---|---|---|---|---|---|
| Trotzdem zuordnen | Primärbutton, nur Kontext A | – | Zuordnung, Inseratswerte unverändert, Protokolleintrag mit Zeitpunkt und abweichenden Angaben | Fehlerbanner | UI-003 |
| Zuordnung behalten | Primärbutton, nur Kontext B | Gerät bleibt dem Modell-Inserat zugeordnet | Zuordnung unverändert, Modell-Inserat unverändert, Protokolleintrag wie „trotzdem zuordnen“ (Zeitpunkt, abweichende Angaben) | Fehlerbanner „Speichern nicht möglich. Referenz: <Nr>“ | Ausgangsscreen (UI-003/UI-010) |
| Umbuchen (Should, REQ-020) | Sekundärbutton, Kontext B und Kontext A bei bereits zugeordnetem Gerät; öffnet im Dialog die Auswahl „Anderes Modell-Inserat derselben Modellvorlage“ (Liste: Titel, Variantenangaben, Stückzahl) und Button „Umbuchen“ | Gerät verfügbar und zugeordnet; mindestens ein anderes Modell-Inserat derselben Modellvorlage | Stückzahl des bisherigen Modell-Inserats −1, des neuen +1, Bestandsangaben beider aktualisiert (REQ-091), Banner „Gerät umgebucht“; bisheriges Modell-Inserat bleibt bei Stückzahl 0 bestehen | Verkauftes oder storniertes Gerät: Button nicht verfügbar, Hinweis „Ein verkauftes oder storniertes Gerät kann nicht umgebucht werden“; kein anderes Modell-Inserat: „Kein anderes Modell-Inserat dieser Modellvorlage“ | UI-014 des neuen Modell-Inserats (weicht das Ziel ab: erst Schritt 2, siehe unten) |
| Neues Modell-Inserat anlegen | Sekundärbutton; im Feld „Artikelnummer“ (siehe oben) auch Enter | Variantenangaben unterscheiden sich; sichtbares Feld „Artikelnummer“ nicht leer und gültig | wie UI-004 | Ablehnung wie UI-004. Kontext B, `article_number_taken`: Dialog bleibt offen, Feld „Artikelnummer“ erscheint (falls noch nicht sichtbar) mit Feldfehler „Artikelnummer bereits vergeben“, Fokus auf das Feld; erneutes Anlegen sendet die eingegebene Artikelnummer. Kontext A: UI-004 legt an und zeigt das Feld selbst | UI-014 |
| Abbrechen | Button, Esc | – | zurück zu UI-004 | – | UI-004 |

## Zustände
| Zustand | Darstellung | Artefakt | Text |
|---|---|---|---|
| default | Abweichungstabelle | nur Text | – |
| loading/error | wie UI-004 | nur Text | |
| `UI-005.ziel-abweichung` (v0.6) | Schritt 2 des Umbuchens: Abweichungstabelle gegen das **Ziel**-Modell-Inserat, siehe Abschnitt „Umbuchen: Ziel weicht ab“ | nur Text (Muster: `default.png`) | „Das Gerät weicht vom Ziel-Modell-Inserat ab.“ |
| `UI-005.ziel-abweichung.speichert` | „Trotzdem umbuchen“, „Anderes Ziel wählen“, „Abbrechen“ und Auswahl gesperrt bis zur Antwort, Beschriftung des Primärbuttons „Umbuchen …“, kein festes Timeout (P-08) | nur Text | „Umbuchen …“ |
| empty | n/a (Dialog erscheint nur bei Abweichung) | – | – |
| `UI-005.artikelnummer` (nur Kontext B, v0.6.15) | Nach `article_number_taken`: Feld „Artikelnummer“ (vorbelegt) mit Feldfehler unter der Abweichungstabelle, Fokus im Feld; Eingabe ändern und „Neues Modell-Inserat anlegen“ (oder Enter) sendet erneut; weitere Ablehnung zeigt den Feldfehler erneut | nur Text | „Artikelnummer bereits vergeben“ |
| validation (Kontext A), success, disabled | n/a (Kontext B: siehe `UI-005.artikelnummer`) | – | – |
| ausgang-unbekannt (K-6) | Schreibende Aktion ohne Antwort (Verbindungsverlust): Aktion bleibt bis zum Neuladen der Seite gesperrt, Banner „Ausgang unbekannt, bitte neu laden“ (Muster P-08, uiux-design.md Kap. 5), Eingaben bleiben sichtbar, **kein „Erneut versuchen“**; es wird nicht von „noch nicht gespeichert“ ausgegangen. Ablehnung „resellr wird beendet“: P-07 (nicht gespeichert) | nur Text | „Ausgang unbekannt, bitte neu laden.“ |

## Umbuchen: Ziel weicht ab (v0.6, MAR-167, Entscheidung PO an MAR-163, FIND-208)
Gilt nur für die Aktion „Umbuchen“ (Kontext A bei bereits zugeordnetem Gerät und Kontext B). Gleicher Dialog, **zweiter Schritt**; kein neuer Screen. Das Muster der Abweichungsanzeige (Tabelle, Hinweis, Aktionen) bleibt gleich.

**Wann:** Der Nutzer wählt im Dialog ein anderes Modell-Inserat derselben Modellvorlage und klickt „Umbuchen“. Stimmen die Variantenangaben des Geräts (in Kontext B die soeben geänderten, noch nicht gespeicherten) nach der Vergleichsregel (Requirements Kap. 6.0) mit dem Ziel überein, wird sofort umgebucht, wie im Fall von AC-REQ-020-04. Weichen sie ab, zeigt der Dialog Schritt 2; **es wird noch nichts gespeichert**. (Fachlich: die Spec fragt hier ein zweites Mal nach, `confirmTargetDeviation`.)

| Element | Inhalt |
|---|---|
| Dialogtitel | „Umbuchen: Ziel weicht ab“ |
| Ziel | Zeile „Ziel: <Titel des Ziel-Modell-Inserats>“ (wie in der Auswahlliste von Schritt 1) |
| Hinweis | „Das Gerät weicht vom Ziel-Modell-Inserat ab.“ |
| Tabelle | wie oben je abweichender Variantenangabe: Merkmal, Wert am Gerät, Wert am **Ziel-Modell-Inserat**; Zustandsbeschreibung beide Texte vollständig nebeneinander; Zeilenformat „Optik-Note: Gerät 4, Ziel-Modell-Inserat 2“ |
| Folge | Satz unter der Tabelle: „Beim Umbuchen ändern sich die Angaben des Ziel-Modell-Inserats nicht.“ |

| Aktion | Auslöser | Ergebnis bei Erfolg | Ergebnis bei Fehler | Navigation danach |
|---|---|---|---|---|
| Trotzdem umbuchen | Primärbutton, Enter | Gerät umgebucht wie „Umbuchen“ (Stückzahl bisheriges −1, Ziel +1, Bestandsangaben aktualisiert, REQ-091); Inseratswerte des Ziels unverändert; Protokolleintrag mit Zeitpunkt und den abweichenden Angaben (wie „trotzdem zuordnen“); Banner „Gerät umgebucht“; in Kontext B wird die geänderte Variantenangabe des Geräts mitgespeichert | Fehlerbanner „Speichern nicht möglich. Referenz: <Nr>“; „Gerät ist bereits einem Modell-Inserat zugeordnet“ ist hier nicht möglich; ist das Gerät inzwischen verkauft oder storniert: Hinweis „Ein verkauftes oder storniertes Gerät kann nicht umgebucht werden“ | UI-014 des Ziel-Modell-Inserats |
| Anderes Ziel wählen | Sekundärbutton | zurück zu Schritt 1 (Auswahlliste), bisherige Auswahl markiert; nichts gespeichert | – | bleibt im Dialog |
| Abbrechen | Button, Esc | Dialog schließt, nichts gespeichert (wie Abbrechen in Schritt 1) | – | wie „Abbrechen“ oben |

Konflikt (P-05), Verbindungsverlust (P-08), „resellr wird beendet“ (P-07) und Ladefehler (P-06) gelten wie in Schritt 1. Tastatur: Fokus beim Öffnen von Schritt 2 auf „Anderes Ziel wählen“ (die ungefährlichere Wahl), Tab-Reihenfolge Tabelle → „Anderes Ziel wählen“ → „Abbrechen“ → „Trotzdem umbuchen“.

**Mockup-Hinweis:** Für Schritt 2 gibt es kein eigenes Mockup (Stitch-Budget unverändert, `stitch-log.md`). Maßgeblich ist diese Beschreibung. Als Layoutmuster dient `default.png` (Tabelle Merkmal | Wert am Gerät | Wert am Modell-Inserat, Primärbutton rechts im Fuß); abweichend gilt: Spalte „Wert am Ziel-Modell-Inserat“, Zeile „Ziel: …“, Dialogtitel „Umbuchen: Ziel weicht ab“, Buttons wie in der Tabelle (kein Button „Neues Modell-Inserat anlegen“ in Schritt 2).

## Fenstergröße und Bedienung
Dialogbreite 800 px (bei schmalerem Fenster Fensterbreite abzüglich 16 px Rand), Dialoghöhe nie größer als das Fenster: Titel und Aktionsleiste bleiben sichtbar, der Inhalt scrollt. Seit v0.6 wächst UI-005 durch die Zielliste (Umbuchen) und Schritt 2 in der Höhe; der Inhalt scrollt dann im Dialog. Weitere Bedienung: lange Zustandsbeschreibung bricht um.

## Bekannte Abweichungen im Mockup
Dargestellt ist Kontext A (Zuordnen). Der Link „Umbuchen“ links im Fuß erscheint im Mockup als Textlink; maßgeblich ist `screen.md` (Sekundärbutton, nur bei bereits zugeordnetem Gerät, Kontext B). Wertangaben „4“ und „Gut“ am Gerät sind im Mockup als Kennzeichnung (warn) hervorgehoben; die Hervorhebung ist nicht verbindlich. Im Hintergrund erscheint eine abgedunkelte Skelett-Seite (von Stitch erzeugt, nicht Teil des Designs). Navigationsuntertitel entfällt.

## Annahmen und offene Fragen
- Kontext B (REQ-014) nutzt denselben Dialog mit den Aktionen „Zuordnung behalten“, „Neues Modell-Inserat anlegen“ und „Umbuchen“ (siehe Aktionen).
