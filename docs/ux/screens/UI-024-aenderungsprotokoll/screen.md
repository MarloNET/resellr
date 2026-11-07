# UI-024 – Änderungsprotokoll

- Zweck: Änderungen nachvollziehen (nur lesen).
- Flows: – · Anforderungen: REQ-055 (Should), REQ-072 · Rollen: Nutzer · Gerät(e): PC · Artefakte: nur Text

## Angezeigte Daten
Tabelle: Zeitpunkt (TT.MM.JJJJ HH:MM), Objekt (Art und Bezeichnung, mit Link, wo noch vorhanden), Aktion, alter Wert, neuer Wert. Kein Nutzer, keine Passwörter (E-4, E-5). Einträge älter als 24 Monate werden vom System gelöscht.

## Eingaben und Validierung
| Feld | Typ | Pflicht | Regel | Fehlermeldung |
|---|---|---|---|---|
| Zeitraum von/bis | Datum | nein | von ≤ bis | „Von-Datum liegt nach Bis-Datum“ |
| Art des Objekts | Auswahl | nein | Einstellung, Modellvorlage, Modell-Inserat, Kanal-Inhalt, Gerät, Sonstiges (Löschung, Freigabe-Bestätigung) | – |

## Aktionen
| Aktion | Auslöser | Voraussetzung | Ergebnis bei Erfolg | Ergebnis bei Fehler | Navigation danach |
|---|---|---|---|---|---|
| Filtern | Änderung der Filter | – | Liste aktualisiert | Fehlerbanner | bleibt |
| Objekt öffnen | Link | Objekt existiert | – | – | zugehöriger Screen |

## Zustände
| Zustand | Darstellung | Artefakt | Text |
|---|---|---|---|
| default | letzte 30 Tage, neueste zuerst, Seiten à 50 | nur Text | – |
| loading | Platzhalter | nur Text | „Lade Protokoll …“ |
| empty | | nur Text | „Keine Einträge im gewählten Zeitraum“ |
| error | Banner | nur Text | „Protokoll konnte nicht geladen werden. Referenz: <Nr>“ |
| validation | | nur Text | siehe oben |
| success, disabled | n/a | – | – |

## Fenstergröße und Bedienung
Fenster frei in der Größe, Untergrenze 1366 px (REQ-077); lange alte/neue Werte umbrechen, Details per Klick auf die Zeile.

## Bekannte Abweichungen im Mockup
keine (kein Mockup).

## Annahmen und offene Fragen
- **Design-Annahme, keine Anforderung (vom Product Owner bestätigt):** Standardzeitraum „letzte 30 Tage“.
