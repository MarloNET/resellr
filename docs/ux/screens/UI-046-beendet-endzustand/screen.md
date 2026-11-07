# UI-046 – resellr beendet (Endzustand) und „Ausgang unbekannt“

- Zweck: Nach dem Beenden zeigen, dass resellr beendet ist und wo der Datenordner liegt; falls der Ausgang nicht feststellbar ist, den nächsten Schritt nennen.
- Flows: FLOW-10 · Anforderungen: REQ-105, REQ-104, REQ-073; AC-REQ-105-03; Baseline Kap. 6.1 (Aktion „resellr beenden“); Kap. 6.3 X-2, X-6
- Rollen: Nutzer · Gerät(e): PC · Artefakte: nur Text; Wortlaut `[Vorschlag BA]` (REQ-105)
- **Technischer Hintergrund für das Design:** Nach dem Beenden gibt es keinen Server. Die Seite wird **aus bereits geladenen Daten** gezeigt (Speicherort stammt aus dem Betriebsstatus beim Laden des Rahmens) und lädt nichts nach. Sie ersetzt den gesamten Anwendungsrahmen (keine Navigation, kein Hinweis UI-044, da beide ohne Server nicht mehr funktionieren). Lädt der Nutzer die Seite neu, zeigt Chrome seine eigene Fehlerseite; die wird nicht gestaltet.

## Angezeigte Daten
`UI-046.success` (Endzustand), zentrierte Karte auf bg, Breite 560 px:
| Element | Inhalt | Hinweise |
|---|---|---|
| Titel/Meldung | „resellr ist beendet. Sie können den Datenordner jetzt kopieren.“ | Wortlaut REQ-105 unverändert, Seitentitel-Größe 22/28 |
| Speicherort | „Der Datenordner liegt hier:“ + vollständiger Pfad | **auswählbarer Text** (X-6), kein Button |
| Zusatzzeile (**Vorschlag Design, keine Anforderung**, X-6) | „So erreichen Sie den Ordner: Markieren Sie den Pfad, kopieren Sie ihn mit Strg+C und fügen Sie ihn oben in die Adressleiste des Windows-Explorers ein. Der Ordner „AppData“ ist in Windows standardmäßig ausgeblendet.“ | kennzeichnet die Hilfe zum Erreichen; wird vom Owner bestätigt oder gestrichen |
| Zusatzzeile (**Vorschlag Design, keine Anforderung**) | „Zum Weiterarbeiten starten Sie resellr über die Verknüpfung „resellr“ im Startmenü.“ | Baseline: Neustart nur über Verknüpfung oder nächste Windows-Anmeldung; REQ-105 regelt das Starten nicht |

`UI-046.unknown` (Ausgang unbekannt), gleiche Karte, Warn-Stil (flag-warn):
| Element | Inhalt |
|---|---|
| Titel | „Es ließ sich nicht feststellen, ob resellr beendet wurde.“ |
| Text | „Ausgang unbekannt. resellr antwortet nicht mehr. Kopieren Sie den Datenordner deshalb noch nicht. Starten Sie resellr über die Verknüpfung „resellr“ im Startmenü und beenden Sie es danach erneut. Läuft resellr noch, öffnet die Verknüpfung die normale Oberfläche.“ (Satz ist eine Annahme über den Launcher, siehe unten) |
| Button | „Erneut versuchen“ (Sekundär): fragt den Server erneut; antwortet er, lädt die normale Oberfläche (resellr lief weiter oder wurde neu gestartet), sonst bleibt der Zustand mit Hinweis „resellr antwortet noch nicht.“ |

Kein Speicherort in `.unknown`, damit nicht vorzeitig kopiert wird.

## Eingaben und Validierung
Keine.

## Aktionen
| Aktion | Auslöser | Voraussetzung | Ergebnis bei Erfolg | Ergebnis bei Fehler | Navigation danach |
|---|---|---|---|---|---|
| Erneut versuchen | Button | nur `.unknown` | Server antwortet: Oberfläche lädt neu (UI-002) | „resellr antwortet noch nicht.“ | bleibt |
| Speicherort markieren | Mausmarkierung | nur `.success` | markiert, Strg+C kopiert | – | bleibt |

Keine weiteren Aktionen (kein „Im Explorer öffnen“, kein „resellr starten“, X-6).

## Zustände
| Zustand | Darstellung | Artefakt | Text |
|---|---|---|---|
| success (Endzustand) | siehe oben | nur Text | siehe oben |
| unknown | siehe oben | nur Text | siehe oben |
| loading | n/a (Wartezustand ist in UI-045) | – | – |
| error | n/a (Fehlerfall des Beendens ist in UI-045 `.error`: resellr läuft weiter) | – | – |
| empty, validation, disabled | n/a | – | – |

## Fenstergröße und Bedienung
Karte mittig, funktioniert von 480 px (schmales Fenster) bis breit. Kein Fokus-Trap, keine Tastaturlogik außer Tab zu „Erneut versuchen“.

## Annahmen und offene Fragen
- Die beiden Zusatzzeilen sind Vorschläge für den Owner (X-6, Start-Hinweis); ohne Bestätigung entfallen sie, der Rest bleibt gültig.
- **Annahme für den Software Architect (zu bestätigen, wie bei LP-03):** Die Verknüpfung „resellr“ öffnet bei laufendem resellr die normale Oberfläche, statt einen zweiten Start zu versuchen. Gilt dies nicht, ist der Satz in `.unknown` zu streichen.
- Beschriftung „Erneut versuchen“ ist mit P-06 (Laden) vereinheitlicht (gleiche Funktion: nur Verbindung prüfen; es wird keine Aktion wiederholt, „Beenden“ wird nicht erneut ausgelöst). Der Kern „Ausgang unbekannt“ entspricht P-08 (K-6); anders als bei P-08 ist das Neuladen hier nicht der Weg, weil die Seite ohne Server aus geladenen Daten steht.
- Der Zustand `.unknown` mit „Erneut versuchen“ ist Designvorschlag; Baseline nennt nur, dass `web-ui` den Ausgang nicht sicher kennt.
