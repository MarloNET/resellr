# Product Brief – resellr (Arbeitstitel): Einmal erfassen, überall inserieren

Version: v1.0 | Status: Freigegeben (Owner, 06.11.2026) | Verantwortlich: Product Discovery | Datum: 06.11.2026
Recherche: [product-research](/MAR/issues/MAR-113#document-product-research) v0.3 | Quellen: Owner-Notizen in [MAR-111](/MAR/issues/MAR-111), `Datenblatt.xlsx` (Anhang an [MAR-113](/MAR/issues/MAR-113)), Owner-Antworten Runde 1 und 2, sechs echte Inserate des Kunden (Shop und Kleinanzeigen)

> **Lesehilfe:** **[Owner]** = vom Owner entschieden oder bestätigt. **[Vorschlag]** = Empfehlung von Product Discovery. **[Annahme]** = noch zu prüfen. **[Beleg]** = aus Excel oder echten Inseraten nachweisbar.
> **v1.0:** inhaltsgleich mit der freigegebenen v0.3 (Dokument-Revision 3); geändert sind nur Versionsvermerk und Kap. 14.
> **Neu in v0.3:** Zielbild „Pilot zuerst, produktfähig“ entschieden (Kap. 6b); kostenloser Pilot, Rechte beim Owner; Gerätearten als erweiterbare Einstellung (neue Leitplanke 4, SC-07); eBay als Nebenkanal, daher Shop zuerst in Phase 2 (Kap. 8); notebookers.de als aktuelle Marke; Händlergespräche parallel zum Pilot (Kap. 6b, 13).

## 1. Produktvision und Wertversprechen

Ein Gebrauchtgeräte-Händler erfasst jedes eingekaufte Gerät **genau einmal**, strukturiert und mit wiederverwendbaren Modellvorlagen. Daraus entstehen fehlerfreie, plattformgerechte Inserate für den eigenen PrestaShop, eBay und Kleinanzeigen sowie das gewohnte Datenblatt.

**Wertversprechen [Vorschlag]:** „Vom eingekauften Gerät zum Inserat auf allen Kanälen in einem Bruchteil der heutigen Zeit, ohne Excel-Kopien, ohne mehrfaches Abtippen und ohne Fehler, die beim Käufer ankommen.“

## 2. Problem und Zielgruppe

**Primärer Nutzer [Owner, Beleg]:** ein kleiner Händler, der gebrauchte und defekte IT B2B einkauft. Verkauft wird unter **notebookers.de** (aktuelle Domain; das Excel-Logo **defekte-IT.de** ist die alte Domain [Owner]) über den eigenen PrestaShop und ein gewerbliches Kleinanzeigen-Konto. **eBay wird zum Teil genutzt, aber nicht hauptsächlich** [Owner]. Sortiment laut Shop: Notebooks, PCs, Smartphones, Tablets, Defektware, daneben Zubehör und Sonderposten.

**Zielbild [Owner]:** Pilot für diesen Kunden, produktfähig gebaut (Kap. 6b). Der Pilot ist **kostenlos**, die Rechte am Ergebnis liegen beim Owner.

**Ist-Prozess [Owner, ergänzt durch Belege]:**
1. Geräte im Los einkaufen; die Rechnung/PDF listet Geräte mit Zustandscodes (z. B. „DGS“).
2. Jedes Gerät trägt eine **WI-Nr**: eine interne Warennummer, die meist auf dem Karton steht und zur Identifikation dient [Owner]. Im Shop ist sie zugleich die Artikelnummer, z. B. 626198 [Beleg].
3. Zustand prüfen, Fotos machen.
4. Datenblatt in Excel anlegen, indem das Blatt eines ähnlichen Geräts kopiert und überschrieben wird [Beleg].
5. Inserate auf jedem Kanal einzeln anlegen: Titel, Beschreibung, Kategorie, Merkmale, Preis, Bilder, Suchbegriffe.
6. **Ein Inserat pro Modell mit Stückzahl** [Owner]. Weichen Geräte desselben Modells im Zustand deutlich ab (z. B. Display- statt Gehäuseschaden), entstehen getrennte Inserate [Owner].

**Was die Excel zeigt** (Details in der Recherche, Kap. 2): ein Blatt pro Gerät mit 20–25 Technikfeldern; uneinheitliche Bezeichnungen (4 Labels für die WI-Nr, 7 für die Herstellernummer); Herstellernummer nur in 8 von 25 Blättern, EAN in 1; der Akku-Hinweis wortgleich in 19 Blättern; in rund 18 von 25 Blättern passt der Blattname nicht zum Gerät, mit übernommenen Fremdwerten und Datumsfehlern. Preis, Kategorie, Titel und Plattformstatus fehlen.

### 2b. Was die echten Inserate zeigen [Beleg]

Ausgewertet: MacBook Pro 13, HP ProDesk 600 G5 und iPhone SE 2, jeweils im Shop und bei Kleinanzeigen (Details: Recherche, Kap. 2b).

- **Titel folgen einem festen Muster:** „Marke Modell (Typ), CPU, RAM, SSD, Extras“. Bei Kleinanzeigen wird er hart abgeschnitten („…512G“). Das lässt sich vollständig automatisch erzeugen und kürzen.
- **Derselbe Inhalt, dreimal anders verpackt:** Der Shop zeigt Lieferumfang und eine Merkmalsliste. Kleinanzeigen nutzt denselben Text als Freitext (inkl. WI-Nr und Produktnummer) plus eigene Merkmalsfelder (Marke, Modell, Zustand, Prozessor, RAM, Speicher) und **Felder für die GPSR-Herstellerangaben**.
- **Preis je Kanal unterschiedlich:** 269/279 €, 289/299 €, 89 €/50 € VB (Shop/Kleinanzeigen). Ein Preis pro Kanal ist also Pflicht.
- **Zustand je Kanal anders benannt:** Shop „gebraucht“ plus Optik-Note 3; Kleinanzeigen „Gut“ oder „In Ordnung“. Es braucht eine Zuordnungstabelle.
- **Fehler erreichen den Käufer:** Tippfehler („Verpüackung“, „Diplayport“, „Kennektivität“), zwei unterschiedliche Produktnummern auf derselben Seite (MHGT3ZD/A und MHGT3D/A), ein Mini-PC in der Kleinanzeigen-Kategorie „Laptops & Notebooks“.
- **Varianten sind Alltag:** Das iPhone-Inserat bei Kleinanzeigen ist „nur ein Beispiel“ für mehrere Geräte in unterschiedlichem Zustand; die Shop-Artikelnummer „616027-90“ hängt den Akkustand an die WI-Nr.
- **Eigene EANs:** Die Shop-Artikel tragen EANs mit dem Präfix 4255867, beim iPhone die Original-EAN. [Annahme] Der Kunde vergibt eigene GS1-Nummern.
- **Volumen (Schätzung aus öffentlichen Daten):** Die Shop-Artikel-IDs reichen bis 177, auf der Startseite sind rund 110 Artikel verlinkt, bei Kleinanzeigen sind 4 Anzeigen aktiv. Das spricht für **eher wenige neue Inserate pro Woche**, aber mehrere Geräte je Inserat. Die echte Zahl kennt nur der Kunde (A-1).

### 2c. Zeitaufwand und Einsparpotenzial

**Messwerte fehlen** (Owner: Volumen und Zeit pro Gerät unbekannt). Keine erfundenen Zahlen; die Einschätzung ist qualitativ.

| Schritt | heute | Einsparpotenzial [Vorschlag] |
| --- | --- | --- |
| Gerät einbuchen (WI-Nr, Code aus PDF übersetzen) | manuell | mittel (Code-Tabelle, Zuordnung zum bestehenden Modell-Inserat) |
| Sichtprüfung, Fotos | manuell | gering |
| Spezifikationen recherchieren, Datenblatt bauen | Excel-Kopie | **hoch** (Modell-Bibliothek) |
| Titel, Beschreibung, Merkmale, Kategorie je Kanal | manuell × 3 | **hoch** (aus Struktur generiert) |
| Formulare ausfüllen, Bilder hochladen | manuell × 3 | mittel (Kopier-Assistent), später hoch für eBay/Shop |
| Stückzahl nach Verkauf auf den anderen Kanälen anpassen | manuell | hoch, ab Phase 2 |

**Baseline-Formel:** Zeitersparnis/Monat = neue Inserate/Monat × (Minuten heute − Minuten neu) + Geräte/Monat × (Einbuchen heute − Einbuchen neu). Weil pro Modell inseriert wird, zählt vor allem die Zahl **neuer Modelle und Varianten**.

## 3. Marktumfeld und Wettbewerb

- **Lücke:** Kein gefundenes Werkzeug verbindet strukturierte Erfassung von Gebrauchtgeräten (Zustand, Akku, Schäden, Modell-Bibliothek) mit plattformgerechten Inseraten inkl. Kleinanzeigen. Multichannel-Tools wie magnalister oder JTL setzen erst nach der Erfassung an.
- **Plattformen:** eBay (Sell Inventory API) und PrestaShop 9 (Webservice/Admin API) sind offiziell anbindbar. **Kleinanzeigen hat keine offizielle Händler-Schnittstelle**; Automatisierung ohne schriftliche Zustimmung riskiert eine Kontosperre.
- **Recht:** GPSR-Herstellerangaben auch bei Gebrauchtware; Abmahnrisiko bei Gewährleistungs- und „Garantie“-Formulierungen; „Refurbished“ bei eBay für Laptops eingeschränkt.
- **Marktsignal für ein Produkt:** Auf eBay sind viele spezialisierte Gebrauchtgeräte-Händler aktiv, von kleinen bis sehr großen. Ob kleine Händler dasselbe Problem haben und dafür zahlen, ist **nicht untersucht** (A-7).

## 4. Ziele

- **GOAL-01** Zeit von „Gerät liegt vor“ bis „auf allen Kanälen inseriert“ deutlich senken. Zielwert nach Baseline; Vorschlag: mindestens halbieren.
- **GOAL-02** Jede Information wird nur einmal eingegeben und auf alle Kanäle und das Datenblatt übertragen.
- **GOAL-03** Fehlerfreie, einheitliche Inserate: keine Tippfehler aus Kopien, keine widersprüchlichen Nummern, richtige Kategorie und Zustandsbezeichnung je Kanal.
- **GOAL-04** Rechtliche Textbausteine und GPSR-Herstellerangaben zentral pflegen und einheitlich ausspielen.
- **GOAL-05** (ab Phase 2) Stückzahlen kanalübergreifend abgleichen, keine Überverkäufe.

## 5. Zentrale Use Cases

- **UC-01** Gerät per WI-Nr einbuchen und einem bestehenden Modell-Inserat zuordnen (Stückzahl +1), oder eine neue Zustandsvariante anlegen.
- **UC-02** Neues Modell einmalig anlegen (Technikdaten, Anschlüsse, Herstellernummer, EAN), wiederverwendbar für alle künftigen Geräte.
- **UC-03** Lieferanten-Zustandscodes (z. B. „DGS“) automatisch in Klartext übersetzen; die Tabelle pflegt der Händler.
- **UC-04** Inserate je Kanal erzeugen lassen: Titel in passender Länge, Beschreibung, Merkmalsfelder, Kategorie- und Zustandsvorschlag, Preis je Kanal. Der Mensch prüft und gibt frei.
- **UC-05** Kleinanzeigen-Inserat über den Kopier-Assistenten Feld für Feld übernehmen (inkl. Merkmale und GPSR-Felder).
- **UC-06** Datenblatt im gewohnten Layout drucken bzw. als PDF erzeugen.
- **UC-07** Pro Inserat sehen: Kanäle, Stückzahl, verkaufte Geräte (Phase 1 manuell gepflegt).
- **UC-08** Textbausteine und Herstellerangaben je Marke zentral pflegen.

## 6. Lösungsrichtung

| | **A: Inserat-Generator** | B: Multichannel-Hub | C: PrestaShop-zentriert | D: Wareneingangs-Automatik |
| --- | --- | --- | --- | --- |
| Idee | Einmal erfassen → Inserate je Kanal zum Kopieren, Datenblatt-Druck | A + Direktveröffentlichung Shop/eBay, Bestandsabgleich | Erfassung im PrestaShop-Backend, eBay per Fremdmodul | PDF-Import und Geräte-Auslese |
| Zeitersparnis | hoch | sehr hoch | mittel bis hoch | hoch nur bei Erfassung |
| Zeit bis Nutzen / Risiko | kurz / gering | mittel / mittel | mittel / mittel bis hoch | lang / hoch |

**Entscheidung [Owner]:** Phase 1 = **Richtung A**. Weiterer Weg [Vorschlag]: Phase 2 = B, zuerst für den Shop, für eBay nur, wenn dessen Anteil es rechtfertigt (eBay ist Nebenkanal [Owner]); Phase 3 = D, wenn Lieferanten-PDFs und Volumen es rechtfertigen. Ob Browser, Desktop oder Shop-Modul, entscheiden später Software Architect und Owner.

### 6b. Zielbild: Individuallösung oder Produkt für mehrere Händler [Owner: entschieden, F-5]

**Entscheidung [Owner]: „Pilot zuerst, produktfähig bauen“** (Empfehlung von Product Discovery). Wir bauen Phase 1 für diesen einen Kunden und halten vier Leitplanken ein, damit ein späteres Produkt nicht an der Lösung scheitert. Ob ein Produkt daraus wird, entscheidet der Owner erst mit Belegen.

| | Rein individuell | **Pilot zuerst, produktfähig** | Von Anfang an Produkt |
| --- | --- | --- | --- |
| Was | alles fest auf diesen Kunden zugeschnitten | für diesen Kunden gebaut, Kundenspezifisches als Einstellung, Kanäle als austauschbare Bausteine | mehrere Händler, Selbstregistrierung, Abrechnung, Konnektoren-Auswahl ab Start |
| Nutzen für den Kunden | am schnellsten | fast gleich schnell | deutlich später |
| Mehraufwand | keiner | gering | hoch (Mandanten, Onboarding, Support, Datenschutz, Abrechnung) |
| Spätere Produktchance | teurer Umbau | offen, ohne Umbau des Kerns | eingebaut, aber ungeprüft |
| Hauptrisiko | Sackgasse | etwas Disziplin nötig | Produkt für Kunden, die es nicht gibt |

**Begründung:**
- Belegt ist bisher **ein** Kunde mit einem konkreten Problem. Ob andere Händler dasselbe Problem haben und dafür zahlen, wissen wir nicht. Ein Mehrhändler-Produkt jetzt zu bauen, hieße Monate Aufwand auf eine ungeprüfte Annahme.
- Gleichzeitig ist die Lücke im Markt plausibel (Kap. 3), und die Leitplanken kosten wenig.
- Das „Konnektor“-Prinzip, das der Owner anspricht, steckt bereits in Leitplanke 2. Wir bauen aber nur die drei Kanäle, die der Pilot braucht, und kein allgemeines Konnektor-Framework auf Vorrat.
- Der Kanal mit der größten Reichweite für kleine Händler, Kleinanzeigen, lässt sich ohnehin nicht offiziell anbinden. Das begrenzt den Vorteil eines Konnektor-Produkts.

**Leitplanken (Produktanforderungen, keine Architekturvorgabe):**
1. Alles Kundenspezifische ist **Einstellung statt fester Inhalt**: Logo/Marke, Textbausteine, Zustandscodes, Zustands- und Kategoriezuordnung je Kanal, Titelmuster, Preisregeln, Datenblatt-Layout.
2. Jeder Kanal ist ein **eigenständiger, ergänzbarer Ausgabe-Baustein**. Ein weiterer Kanal (z. B. Shopware, Back Market) darf den Kern nicht verändern.
3. **Rechte am Ergebnis liegen beim Owner** [Owner, F-6]. [Vorschlag] Das zusammen mit „kostenlos“ und der Mitwirkung des Kunden (Zeitmessung, Beispieldaten, Feedback, ggf. Nutzung als Referenz) in einer kurzen schriftlichen Pilotvereinbarung festhalten. Das ist keine Rechtsberatung; den Text ggf. prüfen lassen.
4. **Gerätearten sind erweiterbar** [Owner, F-7a]: Phase 1 deckt Notebooks, PCs, Tablets und Smartphones ab. Eine neue Geräteart (z. B. Monitor, Zubehör) mit eigenen Merkmalen, Titelmuster und Kategorien darf keinen nennenswerten Entwicklungsaufwand erfordern, sondern soll im Wesentlichen per Einstellung entstehen.

**Nicht in Phase 1:** mehrere Händler im selben System, Selbstregistrierung, Abrechnung, weitere Kanäle.

**Produkt-Entscheidungspunkt:** wenn der Pilot 4–8 Wochen produktiv läuft. Bis dahin Gespräche mit 5–8 weiteren Gebrauchtgeräte-Händlern (Problem, heutige Lösung, Zahlungsbereitschaft). Dann entscheidet der Owner: Produkt ausbauen, als Individuallösung weiterführen oder einstellen.

**Konsequenz aus „kostenloser Pilot“ [Vorschlag]:** Der Pilot bringt dem Owner kein Geld ein; ein wirtschaftlicher Rückfluss entsteht nur über ein späteres Produkt (oder eine Folgebeauftragung). Deshalb sollten die Händlergespräche **parallel zum Pilot** beginnen, nicht erst danach. Sie kosten wenig und können den Ausbau früh bestätigen oder stoppen.

## 7. Phase 1 (MVP) und Funktionsumfang [Owner: Richtung A; Umfang Vorschlag]

**Must-have**
- **Modell-Inserat mit Stückzahl** als zentrale Einheit; darunter die Einzelgeräte mit WI-Nr; getrennte Zustandsvarianten desselben Modells.
- Geräteerfassung mit festen Feldern und Auswahllisten (Zustand, Optik-Note 1–5, Tastaturlayout, Netzteil/Akku, Akku-% als Zahl); Herstellernummer als Pflicht oder „unbekannt“; EAN-Feld (eigene oder Original-EAN).
- Modell-Bibliothek: Neues Gerät aus Modellvorlage; gerätespezifische Werte werden zur Prüfung hervorgehoben, damit nichts vom Vorgänger übrig bleibt.
- Übersetzungstabelle für Zustandscodes (z. B. DGS) und Zuordnungstabelle der Zustandsbezeichnungen je Kanal.
- Zentrale Textbausteine (Akku-Hinweis, Lieferumfang, Rechtliches, GPSR-Herstellerangaben je Marke).
- Inserat je Kanal erzeugen: Titel nach Muster mit sinnvoller Kürzung je Kanal, Beschreibung, Merkmalsfelder, Kategorievorschlag, **Preis je Kanal**. Freigabe durch den Menschen.
- Kopier-Assistent für Kleinanzeigen [Owner], ebenso für Shop und eBay, solange die Direktanbindung fehlt; Fotos dem Inserat zuordnen. Schwerpunkt sind Shop und Kleinanzeigen; eBay als Nebenkanal [Owner] bekommt in Phase 1 nur die Kopier-Ausgabe.
- Datenblatt im bisherigen Layout drucken bzw. als PDF, mit der aktuellen Marke notebookers.de.
- Übersicht je Inserat: Kanal, Stückzahl, verkauft (manuell gepflegt).
- Gerätearten: Notebooks, PCs/Mini-PCs, Tablets, Smartphones [Owner, F-7a]. Merkmale, Titelmuster und Kategoriezuordnung je Geräteart sind Einstellung, damit weitere Arten ohne Entwicklung dazukommen (Leitplanke 4).

**Nice-to-have:** Übernahme der vorhandenen Excel-Blätter als Startbestand der Modell-Bibliothek; Importdatei für PrestaShop als Zwischenschritt; Plausibilitätswarnungen (z. B. abweichende Produktnummern, Kategorie passt nicht zur Geräteart).

**Out of Scope Phase 1 (Non-Goals):** Direktveröffentlichung und automatischer Bestandsabgleich (Phase 2); PDF-Import und Geräte-Auslese (Phase 3); jede Automatisierung bei Kleinanzeigen ohne deren Zustimmung [Owner]; Zubehör und Sonstiges (z. B. Nähmaschinen); Preisfindung, Bestellungen, Versand, Buchhaltung, Warenwirtschaft; Bildbearbeitung oder KI-Fotoanalyse; mehrere Händler, Abrechnung, Selbstregistrierung. **Abgrenzung zu Leitplanke 4:** Vorgefertigte Vorlagen für weitere Gerätearten (Zubehör, Monitore, Sonstiges) liefert Phase 1 nicht; Phase 1 muss sie nur ohne Entwicklung ermöglichen.

## 8. Release-Roadmap [Vorschlag]

| Release | Nutzerziel | Vertikal nutzbarer Funktionsumfang |
| --- | --- | --- |
| 0.1 (Phase 1) | „Ich erfasse jedes Gerät nur einmal und kopiere fertige Inserate.“ | Modell-Inserat mit Stückzahl, Modell-Bibliothek, Codes, Bausteine → Inserate für 3 Kanäle per Kopier-Assistent, Datenblatt-Druck, Übersicht |
| 0.2 (Phase 2a) | „Der Shop füllt sich von selbst.“ | Direktveröffentlichung im PrestaShop inkl. Bilder, Kategorie- und Zustandszuordnung |
| 0.3 (Phase 2b) | „Verkauft heißt überall weg.“ | Stückzahl-Abgleich Shop; Hinweis zum Anpassen bei Kleinanzeigen; eBay-Direktanbindung nur, wenn der eBay-Anteil es rechtfertigt |
| Entscheidungspunkt | Produkt oder Individuallösung? | Ergebnis der parallel geführten Händlergespräche, Entscheidung des Owners (Kap. 6b) |
| 0.4 (Phase 3) | „Der Wareneingang füllt sich vor.“ | Einkaufs-PDF einlesen, Geräte- und Akkudaten auslesen |

## 9. Plattform-Anbindung und Rahmenbedingungen

| Plattform | Machbarkeit (Recherche) | Rechtliches und Regeln | Phase |
| --- | --- | --- | --- |
| **PrestaShop 9.1.4** | Webservice und Admin API; CSV-Import im Backoffice | Shop-Rechtstexte beim Kunden | 1: Kopie/Import; 2: direkt |
| **eBay** | Sell Inventory API; Zustandswerte je Kategorie | „Refurbished“ eingeschränkt → Zustandszuordnung; GPSR empfohlen | Nebenkanal [Owner]. 1: Kopie; 2: direkt nach Bedarf |
| **Kleinanzeigen** | keine offizielle Händler-API; Formular hat Merkmals- und GPSR-Felder | Nutzungsbedingungen § 5 (keine automatisierten Mechanismen ohne Zustimmung), § 6 (Sperre); gewerbliches Konto vorhanden | Kopier-Assistent [Owner] |

Weitere Rahmenbedingungen: deutsche Inserate; der Händler bleibt für die Richtigkeit verantwortlich, daher Freigabe jedes Inserats durch den Menschen; Akku- und Gewährleistungstexte vor Einführung rechtlich prüfen lassen; Plattform-Zugänge verwaltet der Kunde.

## 10. Erfolgskriterien

- **SC-01 (GOAL-01):** Minuten bis „auf allen Kanälen“ je neuem Inserat mindestens 50 % unter der gemessenen Baseline; Einbuchen eines Geräts zu einem bestehenden Inserat in unter 2 Minuten [Vorschlag].
- **SC-02 (GOAL-02):** 4 Wochen nach Einführung entstehen alle neuen Inserate im Tool; keine neuen Excel-Datenblätter.
- **SC-03 (GOAL-03):** Bei Stichproben stimmen Pflichtangaben, Produktnummer, Kategorie und Zustand je Kanal mit dem Gerät überein.
- **SC-04 (GOAL-04):** Änderung eines Textbausteins wirkt auf alle künftigen Inserate ohne Einzelbearbeitung.
- **SC-05 (GOAL-05, Phase 2):** kein Überverkauf über Shop/eBay.
- **SC-06 (Produktentscheidung):** Mindestens 3 von 5–8 befragten Händlern bestätigen das Problem und nennen eine Zahlungsbereitschaft.
- **SC-07 (Leitplanke 4):** Eine weitere Geräteart (z. B. Monitor) lässt sich mit eigenen Merkmalen, Titelmuster und Kategorie anlegen und inserieren, ohne dass entwickelt werden muss [Vorschlag].

## 11. Riskanteste Annahmen und Validierung

| Annahme | Warum kritisch | Validierungsvorschlag |
| --- | --- | --- |
| A-1: Das Inserieren kostet relevant viel Zeit (Volumen × Minuten). Öffentliche Daten deuten auf eher wenige neue Inserate pro Woche. | Ohne nennenswerte Zeit kein Business Case | Kunde misst 2–3 neue Inserate und 5 Einbuchungen; neue Modelle/Monat aus der WI-Nr-Historie zählen |
| A-2: Der Hauptaufwand liegt in Datenblatt und Texten, nicht in Fotos und Prüfung | Bestimmt, ob Phase 1 den größten Hebel hat | dieselbe Messung, nach Schritten aufgeteilt |
| A-3: Ein Kopier-Assistent für Kleinanzeigen ist im Alltag akzeptabel | Kleinanzeigen ist ein Hauptkanal | Klickbarer Prototyp mit 2 echten Modellen; Kleinanzeigen-PRO-Vertrieb nach Partnerschnittstelle fragen |
| A-4: Der Kunde wechselt von Excel auf ein neues Werkzeug | Die Excel ist seit 2023 gewachsen | derselbe Prototyp; Excel-Übernahme als Einstiegshilfe |
| A-7: Weitere Händler haben dasselbe Problem und würden zahlen | Der Pilot ist kostenlos; der wirtschaftliche Sinn für den Owner hängt am späteren Produkt | 5–8 Händlergespräche, parallel zum Pilot |

## 12. Entscheidungen, Risiken und offene Fragen

**Owner-Entscheidungen**
- Kanäle: eigener PrestaShop 9.1.4, eBay, Kleinanzeigen.
- Phase 1 = Richtung A „Inserat-Generator“ (Runde 1, F-1).
- Kleinanzeigen in Phase 1 per Kopier-Assistent, keine Automatisierung (F-3).
- Inserat in der Regel pro Modell mit Stückzahl; bei deutlich unterschiedlichem Zustand getrennte Inserate (F-4c).
- WI-Nr = interne Warennummer auf dem Karton, dient der Identifikation (F-4d).
- Volumen, Zeit pro Gerät und Zweck des gedruckten Datenblatts sind dem Owner nicht bekannt (F-4a, b, e).
- Zielbild: Pilot zuerst, produktfähig gebaut (Runde 2, F-5).
- Kostenloses Pilotprojekt; die Rechte am Ergebnis gehören dem Owner (F-6).
- Schwerpunkt Laptops, PCs, Tablets, Smartphones; das Produkt darf nicht so starr sein, dass jede neue Geräteart großen Implementierungsaufwand braucht (F-7a).
- eBay wird zum Teil genutzt, ist aber kein Hauptkanal (F-7b).
- notebookers.de ist die aktuelle, defekte-IT.de die alte Domain (F-7c).

**Offene Fragen an den Owner:** keine, die die Freigabe blockieren.

**Offen beim Kunden** (klären vor Abschluss des Requirements Engineering): Zeitmessung und Volumen (A-1, A-2); Zweck des gedruckten Datenblatts; 3–5 Einkaufs-PDFs mit Zustandscodes; Umsatzanteil je Kanal, insbesondere eBay; Herkunft der eigenen EANs; schriftliche Pilotvereinbarung (Leitplanke 3).

**Risiken:** Kontosperre bei Kleinanzeigen-Automatisierung; Änderungen an eBay-Kategorien und -Zuständen; rechtliche Mängel in zentral verbreiteten Textbausteinen; geringes Volumen begrenzt den Nutzen; Abhängigkeit von einem Pilotkunden; beim kostenlosen Pilot geringe Verbindlichkeit des Kunden (Zeitmessung, Feedback), daher Mitwirkung schriftlich vereinbaren; der Flexibilitätsanspruch an Gerätearten kann Phase 1 aufblähen, daher nur vier Arten ausliefern und Erweiterbarkeit über SC-07 prüfen.

## 13. Empfehlung

**Bauen: Phase 1 = Richtung A, als kostenloser Pilot für diesen Kunden mit vier produktfähigen Leitplanken [Owner: Richtung und Zielbild]. Bedingungen [Vorschlag]: Der Kunde liefert vor Entwicklungsstart eine einfache Zeitmessung, und die Pilotvereinbarung liegt schriftlich vor. Die Händlergespräche laufen parallel zum Pilot.**

Das Problem ist durch Excel und echte Inserate belegt: mehrfache Erfassung, kopierte Fehler, die bis zum Käufer gelangen, und unterschiedliche Formate je Kanal. Richtung A löst das mit geringem Risiko und ohne Abhängigkeit von Kleinanzeigen. Unsicher ist die **Größe** des Nutzens: Die öffentlichen Daten deuten auf ein moderates Volumen. Die Zeitmessung kann parallel zum Requirements Engineering laufen. Ergibt sie nur wenige Stunden Ersparnis pro Monat, empfehle ich, Phase 1 weiter zu verkleinern (z. B. nur Modell-Bibliothek und Textgenerator) oder das Vorhaben nicht weiterzuverfolgen. Weil der Pilot kostenlos ist, liegt der wirtschaftliche Wert für den Owner im späteren Produkt. Die Leitplanken halten diesen Weg günstig offen; ob er sich lohnt, zeigen die parallel geführten Händlergespräche. Ein Mehrhändler-Produkt empfehle ich erst nach dem Entscheidungspunkt in Kap. 6b.

## 14. Product-Brief-Bestätigung

Status: Approved
Entscheidung: Approved (Freigabe der eingereichten v0.3, Dokument-Revision 3, ohne Änderungswünsche; daraus wird v1.0)
Bestätigt durch: Menschlicher Owner (Paperclip-Freigabekarte „Freigabe Product Brief v0.3“, `request_confirmation`, human_only, Interaktion `0dcd616b-a133-4b6e-a7fe-68ba130a6198`)
Datum: 06.11.2026
Prüfung des Gates: durch den CEOrchestrator (Owner des Product Brief Gate) ausstehend
