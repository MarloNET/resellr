# UI-033 – Code-Übersetzung

- Zweck: Zustandscodes der Lieferanten in Klartext übersetzen. · Flows: – · Anforderungen: REQ-022, REQ-015 · Rollen: Nutzer · Gerät(e): PC · Artefakte: nur Text (Muster P-01)

## Angezeigte Daten
Tabelle: Zustandscode, Lieferant (oder „alle“), Klartext, Vorschlag Zustand, Vorschlag Optik-Note. Hinweis: „Änderungen wirken nur auf künftig erfasste Codes.“

## Eingaben und Validierung
| Feld | Typ | Pflicht | Regel | Fehlermeldung |
|---|---|---|---|---|
| Zustandscode | Text | ja | max. 20 Zeichen, ohne Groß-/Kleinschreibung | „Zustandscode: 1 bis 20 Zeichen“ |
| Lieferant | Auswahl | nein | aktive Lieferanten | – |
| Klartext | Text | ja | max. 500 | „Klartext: 1 bis 500 Zeichen“ |
| Vorschlag Zustand, Vorschlag Optik-Note | Auswahl, 1–5 | nein | | „Optik-Note: ganze Zahl von 1 bis 5“ |
| Kombination | – | – | Code + Lieferant eindeutig | „Diesen Code gibt es für diesen Lieferanten bereits“ |

**Auswahl nach Ablehnung wegen Deaktivierung (v0.6.8, MAR-927, DG-19).** Betroffen ist Lieferant (`supplier_deactivated`, wenn der Lieferant nach dem Öffnen deaktiviert wurde); Vorschlag Zustand ist ebenfalls eine Auswahl (`pick_list_value_deactivated`) und folgt derselben Regel. Es gilt die Regel von UI-007 (v0.6.7) mit einer begründeten Abweichung beim Lieferanten:
- **Lieferant (optional, leer = „alle“).** Nach der Ablehnung und dem Neuladen der Liste zeigt das Feld **nicht** die leere Wahl „alle“, sondern den Platzhalter „Bitte wählen“; kein Eintrag vorausgewählt, die abgelehnte ID wird nie erneut gesendet. Grund: „alle“ würde die Reichweite der Übersetzung stillschweigend von einem Lieferanten auf alle ausweiten. Der Nutzer wählt aktiv einen Lieferanten oder „alle“ (beides bleibt zulässig, keine neue Anforderung); „Speichern“ ohne diese Wahl nach einer Ablehnung: „Lieferant: Lieferanten oder „alle“ wählen“.
- **Vorschlag Zustand (optional).** leer statt „Bitte wählen“ (leere Wahl bleibt zulässig, ändert keine Reichweite).
- **Meldung.** „Lieferant <Name> ist deaktiviert“ bzw. „Vorschlag Zustand <Name> ist deaktiviert“ am Feld bis zur nächsten Wahl; Fokus auf das Feld, nichts gespeichert.
- **Abhängige Eingaben.** Zustandscode, Klartext, Vorschlag Optik-Note bleiben erhalten; es gibt keine abhängigen Werte, die verworfen würden.
- **Ändern.** Kein Rückfall auf den gespeicherten Wert; der gespeicherte, ggf. deaktivierte Lieferant bleibt wählbar („(deaktiviert)“) und wird unverändert ohne Ablehnung gespeichert. Zuordnungsfelder gibt es in UI-033 nicht.

## Aktionen
| Aktion | Auslöser | Voraussetzung | Ergebnis bei Erfolg | Ergebnis bei Fehler | Navigation danach |
|---|---|---|---|---|---|
| Eintrag anlegen/ändern/löschen | Button, Zeilenaktion | gültig; Löschen nach Bestätigung (P-04) | gespeichert | Feldfehler | bleibt |

## Zustände
| Zustand | Darstellung | Artefakt | Text |
|---|---|---|---|
| default | wie oben | nur Text | – |
| loading | Platzhalter | nur Text | „Lade Einstellungen …“ |
| empty | Hinweistext mittig im Listenbereich, darunter Button „Übersetzung anlegen“ (Primärbutton) | nur Text | „Noch keine Code-Übersetzungen“ |
| error | Banner | nur Text | „Einstellungen konnten nicht gespeichert werden. Referenz: <Nr>“ |
| validation | Feldfehler | nur Text | siehe Eingaben |
| success | Banner | nur Text | „Gespeichert“ |
| disabled | Speichern deaktiviert ohne Änderung | nur Text | |

## Fenstergröße und Bedienung
Fenster frei in der Größe, Untergrenze 1366 px (REQ-077); Einstellungs-Liste (240 px) links, Inhalt rechts (unter 1366 CSS-px: Liste über dem Inhalt, Regel R-1); Tastaturalternativen zum Ziehen.

## Bekannte Abweichungen im Mockup
keine (kein Mockup; Muster siehe uiux-design.md Kap. 5).

## Annahmen und offene Fragen
keine.
