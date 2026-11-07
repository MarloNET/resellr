# UI-036 – Merkmalszuordnung

- Zweck: Je Kanal und Geräteart festlegen, welche Quelle unter welcher Feldbezeichnung in welcher Reihenfolge ausgegeben wird (bestimmt auch die Reihenfolge im Kopier-Assistenten). · Flows: FLOW-05 · Anforderungen: REQ-025, REQ-029, REQ-037, Kap. 9.8, 9.11 · Rollen: Nutzer · Gerät(e): PC · Artefakte: default.png (Stitch 26f112bbf02e48ac8e663f46655bc3fd, DESKTOP, 06.11.2026)

## Angezeigte Daten
Auswahl Kanal und Geräteart; Tabelle: Reihenfolge, Feldbezeichnung des Kanals, Quelle (Q-01 bis Q-08 in Klartext: „Merkmal <Name>“, „Hersteller“, „EAN“ …), Pflichtfeld des Kanals, Wertzuordnung (Anzahl Zuordnungen).

## Eingaben und Validierung
| Feld | Typ | Pflicht | Regel | Fehlermeldung |
|---|---|---|---|---|
| Feldbezeichnung | Text | ja | max. 100 | „Feldbezeichnung: 1 bis 100 Zeichen“ |
| Quelle | Auswahl | ja | genau eine Quelle aus Kap. 9.11 | „Quelle fehlt“ |
| Fester Text (Q-08) | Text | ja bei Q-08 | max. 255 | „Fester Text: höchstens 255 Zeichen“ |
| Pflichtfeld des Kanals | Kontrollkästchen | ja | leeres Pflichtfeld verhindert Freigabe | – |
| Wertzuordnung | Tabelle interner Wert → Kanal-Wert | nein | | – |

## Aktionen
| Aktion | Auslöser | Voraussetzung | Ergebnis bei Erfolg | Ergebnis bei Fehler | Navigation danach |
|---|---|---|---|---|---|
| Wertzuordnung bearbeiten | Link „Bearbeiten“ in der Spalte „Wertzuordnung“ einer Zeile | Zeile mit Quelle, die Werte liefert (z. B. Geräteart, Zustand) | Bereich unter der Zeile klappt auf (kein eigener Screen): Tabelle interner Wert → Kanal-Wert, je Zeile Textfeld für den Kanal-Wert (1 bis 100 Zeichen), Zeilen hinzufügen/entfernen, Button „Übernehmen“ schließt den Bereich; die Anzahl in der Spalte aktualisiert sich; gespeichert wird mit „Speichern“ der Seite. Startbelegung Kleinanzeigen: Typ ← Geräteart (AC-REQ-025-02) | Zelle rot: „Kanal-Wert: 1 bis 100 Zeichen“; doppelter interner Wert: „Interner Wert ist schon zugeordnet“ | bleibt |
| Zeile hinzufügen, entfernen, verschieben | Buttons, Ziehen | – | Reihenfolge gilt auch im Kopier-Assistenten | – | bleibt |
| Speichern | Primärbutton | gültig | Banner „Gespeichert“; vor dem Speichern „gilt für n Kanal-Inhalte im Geltungsbereich“ (Ä-32, keine Gruppenzahlen); danach nur das Banner, kein UI-043 (REQ-053 gilt nur für UI-030/UI-031) | Zellenfehler | bleibt |

## Zustände
| Zustand | Darstellung | Artefakt | Text |
|---|---|---|---|
| default | wie oben | nur Text | – |
| loading | Platzhalter | nur Text | „Lade Einstellungen …“ |
| empty | Hinweistext mittig im Listenbereich, darunter Button „Merkmalsfeld hinzufügen“ (Primärbutton) | nur Text | „Für diese Geräteart und diesen Kanal sind noch keine Merkmalsfelder festgelegt“ |
| `UI-036.speichert` (wird gespeichert) | Speicherknopf und alle Eingaben gesperrt bis zur Antwort, Anzeige „Speichern …“, **kein festes Timeout** (Muster P-08); bei Verbindungsverlust „Ausgang unbekannt, bitte neu laden“ | nur Text | „Speichern …“ |
| error | Banner | nur Text | „Einstellungen konnten nicht gespeichert werden. Referenz: <Nr>“ |
| validation | Feldfehler | nur Text | siehe Eingaben |
| success | Banner | nur Text | „Gespeichert“ |
| disabled | Speichern deaktiviert ohne Änderung | nur Text | |

## Fenstergröße und Bedienung
Fenster frei in der Größe, Untergrenze 1366 px (REQ-077); Einstellungs-Liste (240 px) links, Inhalt rechts; Tastaturalternativen zum Ziehen.

## Bekannte Abweichungen im Mockup
Die „Feldbezeichnung des Kanals“ ist im Mockup als Text dargestellt; maßgeblich ist ein Eingabefeld (1 bis 100 Zeichen). Auf-/Ab-Pfeile je Zeile sind die Bedienung für die Reihenfolge (Design-Entscheidung, keine Anforderung). Beim Entfernen einer Zeile: Aktion „Zeile entfernen“ ist im Mockup nicht dargestellt, steht in `screen.md`.

## Annahmen und offene Fragen
- Entschieden (PO): Bereich innerhalb von UI-036 genügt, kein eigener Screen. Kein Mockup dazu.
- Mockup: Der Link „Bearbeiten“ hat dort keine dargestellte Folgeansicht; maßgeblich ist die Aktion oben.
- Startbelegung Kap. 9.8; Pflichtfelder des Kanals offen bis OP-22.
