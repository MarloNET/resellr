# UI-035 – Kategoriezuordnung

- Zweck: Je Geräteart und Kanal eine Kategorie als Vorschlag festlegen. · Flows: FLOW-05 · Anforderungen: REQ-024, REQ-038 · Rollen: Nutzer · Gerät(e): PC · Artefakte: nur Text (Muster P-02)

## Angezeigte Daten
Matrix Geräteart (Zeilen) × Kanal (Spalten); Zelle zeigt Kategoriepfad und Kennung oder „fehlt“.

## Eingaben und Validierung
| Feld | Typ | Pflicht | Regel | Fehlermeldung |
|---|---|---|---|---|
| Kategoriebezeichnung/-pfad | Text | ja je gepflegter Zelle | max. 255 | „Kategorie: 1 bis 255 Zeichen“ |
| Kategorie-Kennung | Text | nein | höchstens 100 Zeichen | „Kategorie-Kennung: höchstens 100 Zeichen“ (v0.6, M-14) |

## Aktionen
| Aktion | Auslöser | Voraussetzung | Ergebnis bei Erfolg | Ergebnis bei Fehler | Navigation danach |
|---|---|---|---|---|---|
| Zelle bearbeiten, Speichern | Klick, Primärbutton | gültig | gespeichert; Kategorien der Kanäle werden von Hand gepflegt (keine Abfrage beim Kanal) | Feldfehler | bleibt |
| Zuordnung entfernen (v0.6.2, O-1, REQ-024) | Textbutton (destruktiv) im Bearbeitungsbereich der Zelle; **sichtbar nur, wenn die Zelle eine Zuordnung hat** (bei leerer Zelle und beim Anlegen nicht angeboten) | Zelle belegt | Rückfrage `UI-035.entfernen-rueckfrage`; nach „Zuordnung entfernen“ im Dialog ist die Zelle leer („fehlt“), Banner „Zuordnung entfernt“, protokolliert (REQ-072) | siehe „Entfernen: Rückfrage und Fehler“ | bleibt (UI-035) |

### Entfernen: Rückfrage und Fehler (v0.6.2, O-1)
- **Rückfrage (Muster P-04, modal, Breite 480 px, Dialoghöhe nie größer als das Fenster):** Titel „Zuordnung entfernen“. Text: „Die Kategorie-Zuordnung „<Kategoriepfad>“ für <Geräteart> bei <Kanal> wird entfernt. Ohne Zuordnung zeigt der Kanal-Inhalt „Kategorie fehlt“.“ Knöpfe: „Abbrechen“ (links), „Zuordnung entfernen“ (rechts, destruktiv). Fokus beim Öffnen auf „Abbrechen“; Enter löst „Zuordnung entfernen“ nur aus, wenn der Fokus auf diesem Knopf liegt; auf „Abbrechen“ löst Enter „Abbrechen“ aus (Klarstellung MAR-278). Esc = Abbrechen, danach Fokus zurück auf den Textbutton „Zuordnung entfernen“.
- **Erfolg:** Dialog schließt, Zelle zeigt „fehlt“, Banner „Zuordnung entfernt“ (5 s, Kap. 5 „Feedback“); der Fokus liegt auf der Zelle. Der Textbutton verschwindet (Zelle leer).
- **Fehler:** `not_found` (Zelle inzwischen von anderswo entfernt): Banner M-15 „Dieser Eintrag ist nicht mehr vorhanden.“ im Dialog, „Abbrechen“ als einzige Aktion (Meldungskatalog Abschnitt 2). Zelle inzwischen geändert (`version_conflict`): Konflikt P-05. Sonstiger Fehler: Banner im Dialog „Zuordnung konnte nicht entfernt werden. Referenz: <Nr>“, Dialog bleibt, nichts entfernt. Ohne Antwort: `.ausgang-unbekannt` (P-08).
- **Während der Aktion (`UI-035.speichert`, P-08):** beide Knöpfe und alle Eingaben gesperrt bis zur Antwort, kein festes Timeout.
- Die Specification (DELETE auf die Zelle, Fehler `version_conflict`) nennt keinen eigenen Wortlaut; die Texte oben sind vom Designer formuliert, ein Widerspruch zur Specification besteht nicht.

## Zustände
| Zustand | Darstellung | Artefakt | Text |
|---|---|---|---|
| default | wie oben | nur Text | – |
| loading | Platzhalter | nur Text | „Lade Einstellungen …“ |
| empty | Hinweistext mittig im Listenbereich, darunter Button „Kategorie zuordnen“ (Primärbutton) | nur Text | „Noch keine Kategorien zugeordnet. Ohne Zuordnung zeigt der Kanal-Inhalt „Kategorie fehlt“.“ |
| `UI-035.speichert` (wird gespeichert) | Speicherknopf und alle Eingaben gesperrt bis zur Antwort, Anzeige „Speichern …“, **kein festes Timeout** (Muster P-08); bei Verbindungsverlust „Ausgang unbekannt, bitte neu laden“ | nur Text | „Speichern …“ |
| error | Banner | nur Text | „Einstellungen konnten nicht gespeichert werden. Referenz: <Nr>“ |
| validation | Feldfehler | nur Text | siehe Eingaben |
| success | Banner | nur Text | „Gespeichert“ |
| disabled | Speichern deaktiviert ohne Änderung; „Zuordnung entfernen“ nicht sichtbar bei leerer Zelle | nur Text | |

## Fenstergröße und Bedienung
Fenster frei in der Größe, Untergrenze 1366 px (REQ-077); Einstellungs-Liste (240 px) links, Inhalt rechts (unter 1366 CSS-px: Liste über dem Inhalt, Regel R-1); Tastaturalternativen zum Ziehen.

## Bekannte Abweichungen im Mockup
keine (kein Mockup; Muster siehe uiux-design.md Kap. 5).

## Annahmen und offene Fragen
- Zellen ohne Eintrag führen zu „Kategorie fehlt“ im Kanal-Inhalt.
