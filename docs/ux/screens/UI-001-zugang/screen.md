# UI-001 – Zugang

> **Entschieden (Owner, 06.11.2026, OP-23):** Der Screen bleibt (REQ-001, REQ-067, REQ-097). Die Baseline-Annahme A-35 (kein Zugangspasswort) gilt dafür nicht; Klärung im Cross-Check.

- Zweck: Im Netzbetrieb das Zugangspasswort eingeben. 
- Flows: FLOW-07
- Anforderungen: REQ-001, REQ-067 [v0.3.1: Geltung bis Programmende, kein Zeitablauf]; AC-REQ-001-01, -02, -04, -08, -09
- Rollen: Nutzer (kein Konto)
- Gerät(e): PC
- Artefakte: nur Text (Mockup geplant)

## Angezeigte Daten
Titel „resellr“, Feld „Zugangspasswort“, Button „Öffnen“. Kein Benutzername, kein „Passwort vergessen“, keine Registrierung (AC-REQ-001-06).

## Eingaben und Validierung
| Feld | Typ | Pflicht | Regel | Fehlermeldung |
|---|---|---|---|---|
| Zugangspasswort | Passwort (maskiert, Anzeige-Umschalter „Anzeigen“) | ja | – | „Zugangspasswort falsch“ (keine Daten sichtbar); „Bitte Zugangspasswort eingeben“ |

## Aktionen
| Aktion | Auslöser | Voraussetzung | Ergebnis bei Erfolg | Ergebnis bei Fehler | Navigation danach |
|---|---|---|---|---|---|
| Öffnen | Button, Enter | Passwort eingegeben | Zugang für dieses Programm bis zu seinem Ende (keine Zeitgrenze, kein Hinweis „Sitzung abgelaufen“) | „Zugangspasswort falsch“ | UI-002 (oder die zuvor aufgerufene Seite) |

## Zustände
| Zustand | Darstellung | Artefakt | Text |
|---|---|---|---|
| default | Feld, Button | nur Text | – |
| loading | Button zeigt „Prüfe …“ | nur Text | |
| empty | n/a | – | – |
| error | Banner | nur Text | „Zugang nicht möglich. Bitte erneut versuchen. Referenz: <Nr>“ |
| validation | Fehler unter dem Feld | nur Text | siehe oben |
| success | direkter Wechsel | – | – |
| disabled | n/a | – | – |
| permission | [v0.3.1] Wird in einem anderen Programm das Passwort geändert, erscheint hier beim nächsten Aufruf die Abfrage | nur Text | „Bitte Zugangspasswort eingeben“ |

## Responsive und Barrierefreiheit
Zentrierte Karte, Fokus im Feld. Enter sendet.

## Bekannte Abweichungen im Mockup
keine (kein Mockup).

## Annahmen und offene Fragen
- Passwort vergessen: nur Betreiber außerhalb des Systems (E-5); kein Hinweistext im Screen (kein Zusatztext erfunden).
