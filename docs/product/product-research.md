# Markt- und Wettbewerbsrecherche – resellr (Arbeitstitel): Automatisierte Inserate für Gebrauchtgeräte-Händler

Version: v0.3 | Status: Abgeschlossen (Grundlage des freigegebenen Product Brief v1.0) | Verantwortlich: Product Discovery | Datum: 06.11.2026
Recherchegrundlage: Websuche und Web-Abruf verfügbar (Abruf jeweils am 06.11.2026). Wo eine Aussage nur auf Modellwissen beruht, ist sie als `Modellwissen, Stand unbekannt` markiert. Zusätzlich ausgewertet: die Kundendatei `Datenblatt.xlsx` (Anhang an [MAR-113](/MAR/issues/MAR-113)) und sechs echte Inserate des Kunden, die der Owner in Runde 1 genannt hat (Kap. 2b).

> Hinweis: Dies ist keine Rechtsberatung. Rechtliche Punkte sind Signale für die Produktplanung und müssen vor dem Go-Live fachlich geprüft werden.

## 1. Recherchefragen

| # | Frage | Status |
| --- | --- | --- |
| RF-1 | Wie erfasst der Kunde seine Geräte heute, welche Daten sind manuell, was ist redundant oder automatisierbar? (Analyse `Datenblatt.xlsx`) | beantwortet |
| RF-2 | Lassen sich PrestaShop 9, eBay und Kleinanzeigen offiziell und regelkonform automatisiert befüllen? | teilweise (eBay/PrestaShop: ja; Kleinanzeigen: keine offizielle Schnittstelle gefunden) |
| RF-3 | Welche bestehenden Werkzeuge lösen das Problem heute (Multichannel-Tools, KI-Inseratshelfer, Kleinanzeigen-Tools)? | teilweise |
| RF-4 | Woher lassen sich technische Daten automatisch beziehen (EAN/Herstellernummer, Geräte-Auslese)? | teilweise |
| RF-5 | Welche rechtlichen Vorgaben betreffen die Inseratsinhalte (GPSR, Gewährleistung bei Gebrauchtware, Zustandsbezeichnungen)? | teilweise |
| RF-6 | Wie viel Zeit kostet der heutige Prozess pro Gerät, und bei welchem Volumen? | **offen**, nur der Kunde kann das beantworten; grobe Volumen-Schätzung aus öffentlichen Daten in Kap. 2b |
| RF-7 | Wie sehen die fertigen Inserate des Kunden je Kanal aus, und was unterscheidet sie? | beantwortet (Kap. 2b) |
| RF-8 | Gibt es Hinweise auf weitere Händler mit demselben Problem (Produktpotenzial)? | teilweise (Kap. 3.4) |

## 2. Analyse der Kundendatei `Datenblatt.xlsx` (RF-1)

**Herkunft und Zweck.** Die Arbeitsmappe stammt vom Kunden **defekte-IT.de**: Das Logo steht als Kopfzeilenbild auf den Blättern. Angelegt wurde sie im Februar 2023, zuletzt geändert am 02.10.2026. Sie enthält 25 Tabellenblätter, jedes im A4-Hochformat mit Logo, also als **druckbares Datenblatt** gestaltet. *Einschätzung:* Das Datenblatt wird vermutlich ausgedruckt (Beilage oder Foto im Inserat) oder als Textquelle für die Inserate genutzt. Bitte beim Kunden klären.

**Granularität: ein Blatt pro Einzelgerät.** Jedes Blatt trägt eine eigene „WI-Nr“ und gerätespezifische Werte wie Akkukapazität, Schäden und Lieferumfang. Die Mappe ist also eher ein **Gerätedatenblatt** als ein Modell-Datenblatt. **Geklärt in Runde 1 (Owner):** Inseriert wird in der Regel pro Modell mit Stückzahl; bei deutlich unterschiedlichem Zustand entstehen getrennte Inserate. Die WI-Nr ist eine interne Warennummer, die meist auf dem Karton steht.

**Gerätemix (25 Blätter):** 22 Notebooks bzw. Tablets und 3 Desktops (Lenovo ThinkCentre M720q Tiny, Dell OptiPlex 7040 MT, HP ProDesk 600 G6). Marken: Lenovo 10, Dell 6, HP 3, Microsoft 2, Wortmann Terra 2, Apple 1, Medion 1.

**Feldstruktur (Spalte A = Label, B–F = Wert).**

| Block | Felder | Beobachtung |
| --- | --- | --- |
| Identifikation | WI-Nr, Hersteller, Model, Herstellernummer | Die WI-Nr steht in allen 25 Blättern, aber unter 4 Bezeichnungen („WI-Nr:“, „WI:“, „WIS“, „WI“) und in gemischten Formaten (rein numerisch, „A637607“, „633641MSGo“, „MD99563“). Eine **Herstellernummer** (MTM/Part-Nr.) steht nur in **8 von 25** Blättern, und zwar unter 7 verschiedenen Bezeichnungen (ModNr., HN, Mod-Nr:, Model-Nr.:, Hersteller-Nr:, ProduktNr.:, ohne Label). Eine **EAN** gibt es nur in **1 von 25** Blättern (MacBook Air). |
| Zustand | Zustand, Optisch, Beschreibung, ggf. „DEFEKT“-Zeile | **Zustand** ist Freitext: gebraucht/GEBRAUCHT (17×), DEFEKT (3×), Refurbished/„Rurbished“ (2×), „Sehr guter Zustand“, „gebraucht (Bio-PW)“. **Optisch** ist offenbar eine Note von 1 (sehr gut) bis 5 (Display gebrochen). Sie fehlt in 4 Blättern und erscheint einmal als „3 bis 4“; einmal hat Excel die Eingabe in ein Datum umgewandelt (02.03.2025). Schäden stehen als Freitext in Beschreibung oder Zustand: BIOS-Passwort, Palmrest/Scharnier/Display gebrochen, fehlende F-Tasten, defekte Enter-Taste, fehlende Antenne oder Gummifüße. Codes wie „DGS“ kommen in der Excel **nicht** vor. Sie stammen aus den Lieferanten-PDFs und werden beim Übertragen in Klartext übersetzt. |
| Lieferumfang | Netzteil, Akku, Akkukapazität | Netzteil: mit, ohne, „nicht Original“, 130 W, USB-C. Akku: mit, ohne, defekt, „Akku 2 fehlt“. Eine **Akkukapazität in %** (54–93 %, einmal „siehe Batteryreport“) steht in 11 Blättern und stammt nach eigener Angabe aus dem Windows-Batteriereport. |
| Textbausteine | Akku-Hinweis | Der Satz „Der Akku ist ein Verbrauchsartikel und ich mache keine DAUERTESTS! …“ steht **wortgleich in 19 von 25 Blättern**. Das ist reiner Vorlagentext. |
| Technik | CPU (+ Kerne × GHz), RAM, SSD (+ Typ, Steckplatz 1/2), Laufwerk, Display (Zoll, matt), Auflösung, Touchscreen, Grafik 1/2, Tastatur (Layout, z. B. Deutsch oder **Ungarisch**), Beleuchtet, Ziffernblock, Fingerprint, WLAN, Bluetooth, LTE, LAN, WebCam | Rund 20–25 Felder. Reihenfolge und Bezeichnungen variieren (Ziffernblock/Nummernblock, Grafik/Grafik 1). Werte mit uneinheitlichen Einheiten (13,3 / „13,3 Zoll“ / 15.6 als Zahl). Einmal wurde ein Wert in ein Datum umgewandelt (Display „14.01.2026“). |
| Anschlüsse | Anzahl × Typ (USB-A/C, HDMI, DP, LAN, Kartenleser, Audio …) | Freie Liste; Desktops getrennt nach vorn/hinten. |
| Software | Betriebssystem (+ Version, z. B. 25H2), einmal Antivirus-Beigabe | |

**Fehlende Daten.** Die Excel enthält **keinen Preis, keine Menge oder Bestand, keine Kategorie, keinen Inseratstitel, keine Suchbegriffe/SEO, keinen Bildverweis, keine Plattform-IDs und keinen Verkaufsstatus**. All das wird heute zusätzlich und je Plattform von Hand erzeugt (laut Owner-Notizen: Kategorie, Beschreibung, Titel, Bilder, Suchbegriffe, SEO).

**Arbeitsweise „Blatt kopieren und überschreiben“.** In rund **18 von 25** Blättern passt der Blattname nicht zum Inhalt. Beispiele: Blatt „T480“ enthält ein ThinkPad X1 Extreme G3, „Dell 5320“ ein Surface Go 2, „Microsoft (2)“ ein Medion Akoya. Offenbar wird das Blatt eines ähnlichen Geräts dupliziert und überschrieben. Das spart Tipparbeit, erzeugt aber **Kopierfehler**. *Einschätzung, anhand von Modellwissen nicht abschließend geprüft:*
- „terra1551“ (ThinkPad V15) trägt dieselbe Herstellernummer 20TD002MGE wie das ThinkPad E15 Gen 2 in „T470s“.
- Das Medion Akoya hat 12,3″, 2736 × 1824 und Touch. Diese Werte sind typisch für ein Microsoft Surface Pro und vermutlich aus der Vorlage übernommen.
- Beim Surface Go 2 stehen „2 x USB-C 3.1 Thunderbolt“.
- Beim MacBook Air steht die Auflösung „2650 x 1600“, vermutlich 2560 × 1600.
- Beim Precision 7540 steht „SSD 512 GB (max. 128GB)“.

Dazu kommen zahlreiche Tippfehler, etwa „Rurbished“, „Notebokk“, „GeFroce“, „Irius“, „Thunderbold“, „Akkukapatzität“. Falsche Angaben im Inserat bedeuten Retouren- und Bewertungsrisiko. Das ist ein Nutzen **neben** der Zeitersparnis.

**Was automatisierbar ist (Einschätzung):**

| Datenart | Heute | Automatisierungspotenzial |
| --- | --- | --- |
| Modellstammdaten (CPU-Basis, Display, Ports, Anschlüsse, Grafik) | manuell recherchiert oder aus altem Blatt kopiert | **hoch**: aus Herstellernummer/Modell über Herstellerdatenbanken oder Produktkataloge, oder aus einer eigenen, wachsenden Modell-Bibliothek („einmal pflegen, immer wiederverwenden“) |
| Konfiguration des Einzelgeräts (RAM, SSD, CPU, Akkukapazität, OS) | manuell abgelesen | **mittel bis hoch**: per Auslese-Tool auf dem Gerät (Windows-Batteriereport liefert Kapazität und Seriennummer, siehe 3.3); bei Geräten mit BIOS-Passwort oder Defekt nicht möglich |
| Zustand, Schäden | Lieferanten-Code (z. B. DGS) plus Sichtprüfung | **mittel**: Code-Übersetzungstabelle je Lieferant; die Sichtprüfung bleibt manuell |
| Textbausteine (Akku-Hinweis, Lieferumfang, rechtliche Hinweise, Herstellerangaben nach GPSR) | kopiert | **sehr hoch**: zentrale, geprüfte Bausteine |
| Titel, Beschreibung, Suchbegriffe, Kategorie je Plattform | manuell je Plattform | **hoch**: aus strukturierten Daten generierbar; Kategorie-Mapping je Plattform |
| Fotos | manuell | **gering**: Aufnahme bleibt manuell; Zuordnung, Benennung und Upload sind automatisierbar |
| Veröffentlichung | 3× manuell | eBay/PrestaShop: **hoch** über offizielle Schnittstellen. Kleinanzeigen: **gering** (keine offizielle Schnittstelle) |

## 2b. Analyse echter Inserate des Kunden (RF-7)

Der Owner hat drei Beispiele genannt, jeweils im Shop und bei Kleinanzeigen. Abruf am 06.11.2026:

- MacBook Pro 13 (A1989): https://notebookers.de/175-apple-macbook-pro-13-a1989-intel-core-i5-8279u-16gb-ram-512gb-space-gray.html ; https://www.kleinanzeigen.de/s-anzeige/apple-macbook-pro-13-a1989-intel-core-i5-8279u-16gb-ram-512g/3560691735-278-16540
- HP ProDesk 600 G5 Mini: https://notebookers.de/177-hp-prodesk-600-g5-mini-pc-intel-core-i5-9500t-16gb-ddr4-512gb-ssd-wlan-blue.html ; https://www.kleinanzeigen.de/s-anzeige/hp-prodesk-600-g5-mini-pc-intel-core-i5-9500t-16gb-ddr4-512gb/3559957873-278-16540
- iPhone SE 2: https://notebookers.de/166-apple-iphone-se-2-generation-2020-128gb-ios-2701-mhgt3zda-90.html ; https://www.kleinanzeigen.de/s-anzeige/apple-iphone-se-2-generation-2020-128gb-ios-27-0-lte-m/3541618113-173-16540

**Absender.** Shop und Kleinanzeigen-Konto laufen unter **notebookers.de** (gewerblicher Nutzer bei Kleinanzeigen seit 08/2022). Das Excel-Datenblatt trägt dagegen das Logo **defekte-IT.de**. **Geklärt (Owner, Runde 2):** defekte-IT.de ist die alte Domain, notebookers.de die aktuelle. Das Excel-Logo ist also veraltet; neue Datenblätter und Inserate sollten unter notebookers.de laufen.

| Merkmal | Shop (PrestaShop) | Kleinanzeigen | Folgerung |
| --- | --- | --- | --- |
| Titel | „Apple MacBook Pro 13 (A1989), intel Core i5-8279U, 16GB RAM, 512GB Space Gray“ | gleicher Titel, hart abgeschnitten nach 65 Zeichen („…512G“) | festes Titelmuster; automatisch erzeugbar und je Kanal sinnvoll kürzbar |
| Beschreibung | „Zustand“, „Lieferumfang“ und Merkmalsliste („Artikeldetails“) | derselbe Inhalt als Freitext, beim HP beginnend mit „WI-Nr: 626198“ und „ProduktNr. 6FY52AV“, dazu Abholzeiten und Rechtsblock | die Datenblatt-Felder sind die Textquelle für alle Kanäle |
| Strukturierte Felder | Hersteller, CPU, RAM, SSD, Display, Ports, OS; Artikel-Nr., EAN-13, MPN | Merkmale: Typ, Marke, Modell, Zustand, Betriebssystem, Prozessor, RAM, Speicher, Farbe u. a.; **Felder für GPSR**: Produktidentifikation und Hersteller mit Anschrift | Kleinanzeigen hat inzwischen eigene GPSR-Felder (Korrektur zu v0.1, Kap. 4) |
| Preis | 269 € / 289 € / 89 € | 279 € / 299 € / 50 € VB | Preis je Kanal unterschiedlich |
| Zustand | „gebraucht“, „Optisch 3“ bzw. „sehr gut“ | „Gut“ bzw. „In Ordnung“ | Zuordnungstabelle je Kanal nötig |
| Stückzahl | MacBook: „Auf Lager 2 Artikel“; HP: 1; iPhone: „Nicht auf Lager“ | iPhone-Anzeige ist laut Text „nur ein Beispiel“ für mehrere Geräte in unterschiedlichem Zustand | bestätigt Modell-Inserat mit Stückzahl und Varianten |
| Kennungen | Artikel-Nr. = WI-Nr (626198); iPhone „616027-90“ (WI-Nr plus Akkustand 90 %); EAN 4255867… beim MacBook und HP, Original-EAN 0194252146835 beim iPhone | Produktidentifikation = Shop-EAN | *Einschätzung:* Präfix 425 ist ein deutsches GS1-Präfix; der Kunde vergibt vermutlich eigene EANs. Bitte klären. |
| Bilder | 4–5 | 4–5 | gleiche Fotos je Kanal |

**Qualitätsmängel, die beim Käufer ankommen:** Tippfehler („neutrale Verpüackung“, „Diplayport“, „Fingerprin“, „Kennektivität“); auf der iPhone-Shopseite zwei unterschiedliche Produktnummern (MHGT3ZD/A im Titel, MHGT3D/A als MPN); der Mini-PC steht bei Kleinanzeigen in „Laptops & Notebooks“; der generische Spezifikationstext beim iPhone enthält Doppelungen. Das bestätigt den Befund aus der Excel (Kap. 2): Kopien und Freitext erzeugen sichtbare Fehler.

**Volumen (grobe Schätzung, nicht belastbar).** Die Shop-URLs zeigen fortlaufende Produkt-IDs bis 177; die Startseite verlinkt rund 110 Artikel, darunter auch Fremdsortiment wie Nähmaschinen. Bei Kleinanzeigen sind 4 Anzeigen aktiv. Ein eBay-Angebot des Kunden habe ich per Websuche nicht gefunden; laut Owner (Runde 2) wird eBay „zum Teil, aber nicht hauptsächlich“ genutzt. *Einschätzung:* Es entstehen eher wenige neue Inserate pro Woche, mit mehreren Geräten je Inserat. Das spricht eher für einen moderaten als für einen sehr hohen Gesamtaufwand und macht eine Messung beim Kunden dringender. Quellen: Startseite und Kategorieseiten https://notebookers.de/ (Abruf 06.11.2026).

## 3. Wettbewerber und Alternativen (RF-2, RF-3, RF-4)

### 3.1 Plattform-Schnittstellen

| Plattform | Offizielle Schnittstelle | Produkt-Relevanz | Quelle (Abruf 06.11.2026) |
| --- | --- | --- | --- |
| **eBay** | Sell **Inventory API** (u. a. `createOrReplaceInventoryItem`, `bulkCreateOrReplaceInventoryItem`; Ablauf Inventory Item → Offer → Publish) | Direktes Einstellen und Aktualisieren ist offiziell möglich. Zulässige Zustandswerte hängen von der Kategorie ab und sollten über die Metadata API abgefragt werden. Für gebrauchte/aufbereitete Ware gibt es ein Feld `conditionDescription`. | https://www.developer.ebay.com/api-docs/sell/inventory/resources/inventory_item/methods/createOrReplaceInventoryItem ; https://www.developer.ebay.com/api-docs/sell/static/inventory/inventory-item-to-offer.html |
| eBay: Zustand „Refurbished“ | Laut eBay sind die neuen Refurbished-Stufen (Excellent/Very Good/Good) nur für Handys in der Kategorie 9355 freigegeben. „Seller Refurbished“ ist in DE in vielen Kategorien nicht mehr nutzbar. „Certified Refurbished“ erfordert eine Vorqualifizierung durch eBay. | Die Kundenbezeichnung „Refurbished“ lässt sich **nicht 1:1** auf eBay übertragen; es braucht ein Zustands-Mapping je Plattform. | https://developer.ebay.com/api-docs/sell/inventory/release-notes.html ; https://eclipseplugin.codebase.ebay.com/api-docs/user-guides/static/mip-user-guide/mip-enum-conditions.html |
| **PrestaShop 9** | Klassischer **Webservice** (REST/XML, u. a. Leitfaden „Creating a product“) und die neue **Admin API** (OAuth2, API Platform) | Das Anlegen von Produkten ist offiziell möglich. Die Shop-Version 9.1.4 des Kunden ist aktuell. *Modellwissen, Stand unbekannt:* PrestaShop hat zusätzlich einen CSV-Produktimport im Backoffice, als Weg ohne Programmierschnittstelle. | https://devdocs.prestashop-project.org/9/webservice/resources/ ; https://devdocs.prestashop-project.org/9/development/page-reference/ |
| **Kleinanzeigen** | **Keine offizielle Händler-API gefunden.** Die alte Schnittstelle aus eBay-Zeiten ist laut Drittanbieter nicht mehr nutzbar. Die PRO-Pakete für gewerbliche Anbieter wurden im Mai 2026 neu strukturiert (Basic/Power/Premium); eine Import-Schnittstelle wird dort nicht erwähnt. | Automatisches Einstellen ist offiziell nicht vorgesehen. | https://kleinanzeigen-agent.de/ ; https://retail-news.de/kleinanzeigen-pro-pakete-2026-neue-struktur/ ; https://themen.kleinanzeigen.de/medien/pressemitteilungen/kleinanzeigen-modernisiert-pro-branchenspezifische-pakete-und-neues-angebot-fur-kleine-budgets/ |
| Kleinanzeigen: Nutzungsbedingungen (gültig ab 17.02.2024) | § 5 Nr. 1 verbietet ohne ausdrückliche schriftliche Zustimmung, „Crawler, Spider, Scraper oder andere automatisierte Mechanismen“ zu nutzen, um auf die Dienste zuzugreifen und Inhalte zu sammeln. § 6 erlaubt Verwarnung und Sperre; gewerbliche Nutzer werden in der Regel 30 Tage vorher informiert. Automatisches *Einstellen* ist nicht ausdrücklich geregelt. | Browser-Automatisierung ist eine **Grauzone mit Sperrrisiko**. Der Open-Source-„kleinanzeigen-bot“ schreibt selbst, die Nutzung könne gegen die Nutzungsbedingungen verstoßen. | https://themen.kleinanzeigen.de/nutzungsbedingungen/ ; https://github.com/Second-Hand-Friends/kleinanzeigen-bot |

### 3.2 Bestehende Werkzeuge

| Anbieter / Alternative | Typ | Zielgruppe | Kernfunktionen | Preis | Stärken | Schwächen für diesen Fall | Quelle (Abruf 06.11.2026) |
| --- | --- | --- | --- | --- | --- | --- | --- |
| **Excel + manuelles Einstellen** (Status quo) | indirekt | der Kunde | flexible Datenblätter, Druck | vorhanden | keine Kosten, volle Freiheit | dreifache Erfassung, Kopierfehler, keine Bestandssynchronisation | Kundendatei |
| **magnalister** | direkt (Multichannel-Plugin) | Online-Händler mit eigenem Shop | Plugin für PrestaShop u. a.: Artikel-Upload zu eBay, Bestands- und Preisabgleich, Bestellimport, EAN/MPN-Synchronisation | auf den gefundenen Seiten nicht für DE angegeben; 30 Tage Test | etabliert, PrestaShop-Anbindung | Kleinanzeigen auf den gefundenen Seiten nicht erwähnt; löst die Datenerfassung (Datenblatt, Zustand) nicht; setzt fertige Shop-Artikel voraus | https://www.magnalister.com/en/prestashop-interface-magnalister/ ; https://www.magnalister.com/en/ebay-interface/ (Herstellerangabe) |
| **PrestaShop-eBay-Module** (z. B. FME Modules, Salestio, Knowband) | direkt (Connector) | PrestaShop-Händler | Produkte von PrestaShop nach eBay | nicht erhoben | günstige Connector-Lösung | Unterstützung für PrestaShop 9 uneinheitlich (FME nennt v9; Salestio „in Arbeit“ 2025; Knowband bis 8.1) | https://www.fmemodules.com/en/prestashop-modules/229-prestashop-ebay-integration-module.html ; https://salestio.frill.co/announcements/amazon-and-ebay-modules-for-prestashop-summary-of-2025 ; https://knowband.com/prestashop-plugins/prestashop-customers/prestashop-ebay-marketplace-integration |
| **Kleinanzeigen-Enhanced / clasify** (Clasify GmbH) | direkt für Kleinanzeigen | Kleinanzeigen-, Vinted-, willhaben- und eBay-Verkäufer | Browser-Erweiterung: KI erzeugt aus Fotos Titel, Beschreibung, Preis und Kategorie; Textvorlagen; Business-Stufen mit Feed-Import (CSV/JSON/XML/Excel) und Massenänderung; Browser muss geöffnet sein | Free-Tarif (20 KI-Erstellungen/Monat); Business ab „200“, Preise nicht auf der Seite | einziger gefundener Weg, Kleinanzeigen halbautomatisch aus Feeds zu befüllen | technisches Vorgehen ungeklärt (Browser-Automatisierung?); PrestaShop nicht genannt; dieselbe Nutzungsbedingungs-Frage | https://kleinanzeigen-enhanced.de/integrationen/ (Herstellerangabe) |
| **kleinanzeigen-bot** (Open Source) | direkt | technisch versierte Verkäufer | Einstellen, Aktualisieren, Löschen und Verlängern per Browser-Automatisierung aus Konfigurationsdateien | kostenlos | belegt den Bedarf (440 Stars, über 1.100 Commits) | eigener Hinweis auf möglichen Verstoß gegen die Nutzungsbedingungen; nicht für Endanwender | https://github.com/Second-Hand-Friends/kleinanzeigen-bot |
| **eBay-eigene KI-Inseratserstellung** | indirekt | vor allem Privatverkäufer, teilweise Händler | Aus dem Foto werden Produkt, Kategorie und Beschreibung vorgeschlagen; Deutschland war Startmarkt | kostenlos in eBay | ohne Zusatzsoftware | nur eBay; erkennt keine gerätespezifischen Daten (Akku, Schäden, Konfiguration); im eBay-Forum gibt es Beschwerden über die KI-Texte | https://www.netzwelt.de/news/240451-ebay-fuehrt-ki-zukuenftig-einfacher.html ; https://www.giga.de/news/angebotsflut-bei-ebay-neues-tool-koennte-alles-veraendern/ ; https://www.ebay.de/verkaeuferportal/news/verkaeufer/2023-september/ki |
| **Warenwirtschaft/Multichannel** (JTL-Wawi, Afterbuy, Billbee, plentymarkets) | indirekt | mittlere und größere Händler | zentrale Artikelverwaltung, Marktplatzanbindung | nicht erhoben | etabliert, Bestandsführung | *Modellwissen, Stand unbekannt:* hoher Einführungsaufwand für einen Einzelhändler; keine Kleinanzeigen-Anbindung gefunden; löst die Datenblatt-Erfassung nicht | Recherche ohne Treffer zu Kleinanzeigen-Anbindung |

### 3.3 Datenquellen für technische Daten

| Quelle | Was | Relevanz | Quelle (Abruf 06.11.2026) |
| --- | --- | --- | --- |
| **Open Icecat** | kostenloser Produktkatalog nach Registrierung; Abfrage per GTIN/EAN oder Marke + Herstellernummer; Datenblätter u. a. mit Marke, MPN, EAN, Kategorie, Gewicht | Spezifikationen vorausfüllen. Die Abdeckung ist laut Icecat unvollständig; mehr Daten gibt es im kostenpflichtigen Full Icecat. Nutzungsrechte an Markeninhalten sind widerruflich. | https://icecat.co.uk/menu/channelpartners ; https://iceclog.com/manual-icecat-live-for-granular-call/amp/ |
| **Lenovo PSREF** (Product Specifications Reference) | Herstellerreferenz für Spezifikationen | *Modellwissen, Stand unbekannt:* Suche nach Machine Type Model, z. B. 20TD002MGE, liefert die Ausstattung; Lenovo ist die größte Marke im Kundenbestand. | https://psref.lenovo.com/ |
| **Windows-Batteriereport** (`powercfg /batteryreport`) | Design- und aktuelle Kapazität, Ladezyklen, Seriennummer | Der Kunde nutzt ihn bereits („77% laut Batteriereport“). Das Auslesen am Gerät lässt sich weitgehend automatisieren. | https://blog.ipc-computer.de/2025/11/battery-report-unter-windows-10-laptop-akku-erkennen-pruefen/ |
| eBay-Produktkatalog / Artikelmerkmale | Notebook-Inserate zeigen Merkmale wie Marke, Prozessor, Bildschirmgröße und Produktart | Strukturierte Daten können eBay-Artikelmerkmale direkt befüllen. *Modellwissen, Stand unbekannt:* Die Pflichtmerkmale je Kategorie liefert die eBay Taxonomy API. | z. B. https://www.ebay.de/itm/167635651028 |

### 3.4 Signale für ein Produkt für mehrere Händler (RF-8)

- Auf eBay.de gibt es zahlreiche spezialisierte Händler für gebrauchte Notebooks und IT, von kleineren Shops bis zu Händlern mit sechsstelligen Verkaufszahlen, z. B. einfachIT, it-versand.com, notebookstorekiel, bluebytenotebooks, second-it-store, notebookgalerie. Quellen (Abruf 06.11.2026, Angaben der eBay-Seiten): https://www.ebay.de/usr/einfachit ; https://www.ebay.de/str/itversandcom ; https://www.ebay.de/str/notebookstorekiel ; https://www.ebay.de/str/bluebytenotebooks ; https://www.ebay.de/str/second-it-store ; https://www.ebay.com/usr/notebookgalerie
- *Einschätzung:* Die Zielgruppe „Gebrauchtgeräte-Händler“ existiert in nennenswerter Zahl. Größere Händler nutzen vermutlich bereits Warenwirtschaft und Multichannel-Tools (Kap. 3.2). Die Lücke liegt eher bei **kleinen Händlern** mit wenigen Mitarbeitern und Kleinanzeigen als wichtigem Kanal. Ob diese Händler dasselbe Problem haben und dafür zahlen, ist **nicht untersucht**. Das lässt sich nur durch Gespräche klären, nicht durch Desk Research.
- Der Open-Source-„kleinanzeigen-bot“ und Kleinanzeigen-Enhanced (Kap. 3.2) zeigen eine Nachfrage nach Kleinanzeigen-Automatisierung, aber auch, dass Anbieter das Thema ohne offizielle Schnittstelle lösen müssen.

## 4. Trends und Rahmenbedingungen (RF-5)

- **GPSR (EU-Produktsicherheitsverordnung, seit 13.12.2024).** Sie gilt grundsätzlich auch für gebrauchte und aufbereitete Produkte. In Online-Angeboten werden u. a. Herstellername und -kontakt sowie die Produktidentifikation verlangt, und zwar im Angebot selbst. Laut Händlerbund sieht eBay für die meisten gebrauchten Waren, die vor dem 13.12.2024 in der EU verkauft wurden, eine Erleichterung, empfiehlt aber die Angabe. Es gibt Abmahnungen wegen fehlender Herstellerangaben. Kleinanzeigen hielt die Angaben laut IT-Recht Kanzlei (Stand 12/2024) für freiwillig und hatte keine eigenen Felder dafür. **Stand 11/2026:** Die Anzeigen des Kunden zeigen eigene Felder für Produktidentifikation und Hersteller (Kap. 2b); der Kunde füllt sie bereits. Quellen: https://ohn.haendlerbund.de/recht/rechtsfragen/produktsicherheit-ebay-antwortet-haendler-fragen-gpsr ; https://www.haendlerbund.de/de/ratgeber/recht/gpsr-ebay-produktsicherheitsverordnung ; https://www.it-recht-kanzlei.de/gpsr-kleinanzeigen-de.html (Stand 05.12.2024); https://www.it-recht-kanzlei.de/achtung-abmahnung-fehlende-angaben-hersteller-nach-gpsr.html. *Einschätzung:* Herstellerangaben je Marke einmal zu pflegen und automatisch in jedes Inserat zu setzen ist ein wertvoller Automatisierungsbaustein.
- **Gewährleistung bei Gebrauchtware (B2C).** Eine Verkürzung auf ein Jahr ist nur unter strengen Bedingungen möglich (vorab informieren, ausdrücklich und gesondert vereinbaren, § 476 Abs. 2 BGB). Die Rechtslage zwischen BGH und EuGH ist umstritten, und Formulierungen wie „nur 1 Jahr Gewährleistung“ in Shops gelten als abmahnträchtig. Quellen: https://www.it-recht-kanzlei.de/neues-kaufrecht-verkuerzung-gewaehrleistung-bei-gebrauchtwaren.html ; https://www.it-recht-kanzlei.de/verkuerzung-verjaehrungsfrist-verkauf-gebrauchtware-unzulaessig.html. *Einschätzung:* Der heutige Akku-Baustein („keine Garantie …“) sollte rechtlich geprüft werden, bevor das Produkt ihn automatisch in alle Inserate schreibt. Zentral gepflegte Bausteine machen eine spätere Korrektur auf einen Schlag möglich.
- **Kleinanzeigen nur gewerblich.** Private Konten dürfen nicht gewerblich genutzt werden (§ 2 Nr. 5 der Nutzungsbedingungen). Der Kunde braucht ein gewerbliches bzw. PRO-Konto. Die PRO-Pakete sind seit Mai 2026 als Baukasten organisiert. Quellen: https://themen.kleinanzeigen.de/nutzungsbedingungen/ ; https://retail-news.de/kleinanzeigen-pro-pakete-2026-neue-struktur/
- **KI im Inserat.** eBay und Kleinanzeigen-Tools setzen auf KI-Texterzeugung aus Fotos. Der Händler bleibt aber für die Richtigkeit verantwortlich: Laut eBay-Verkäuferportal ist er dafür verantwortlich, dass alle Angaben korrekt sind. Quellen: https://www.ebay.de/verkaeuferportal/news/verkaeufer/2023-september/ki ; https://www.giga.de/news/angebotsflut-bei-ebay-neues-tool-koennte-alles-veraendern/. *Einschätzung:* Für Gebrauchtgeräte mit individuellen Mängeln braucht es vor der Veröffentlichung eine **Freigabe durch den Menschen**.
- **Plattformabhängigkeit.** eBay ändert Zustandswerte und Kategorien regelmäßig (siehe Refurbished-Umstellung). Bei PrestaShop-Modulen hinkt die Unterstützung für Version 9 teilweise hinterher.

## 5. Implikationen für unser Produkt (Einschätzung)

1. **Der größte Hebel liegt vor der Veröffentlichung.** Heute wird pro Gerät ein Datenblatt aus Kopien, Recherche und Abtippen gebaut und danach dreimal in andere Formulare übertragen. Bestehende Multichannel-Tools wie magnalister oder JTL setzen erst *nach* der Erfassung an und lösen die Kleinanzeigen-Frage nicht. Die **Lücke** ist die Kombination aus „Gerät einmal sauber erfassen“ (Modell-Bibliothek, Zustandscodes, Akku, Textbausteine) und „daraus drei plattformgerechte Inserate erzeugen“.
2. **Kleinanzeigen ist der kritische Kanal.** Es gibt keine offizielle Schnittstelle, und automatisiertes Einstellen ist eine Grauzone mit Sperrrisiko für das Händlerkonto. Ein regelkonformer Weg für Phase 1 ist ein **Kopier-Assistent**: Alle Felder werden fertig vorbereitet, der Mensch fügt sie ein. Automatisierung kommt nur mit schriftlicher Zustimmung von Kleinanzeigen in Frage, oder nach einer bewussten Risikoentscheidung des Kunden.
3. **eBay und PrestaShop sind offiziell anbindbar.** Damit sind sie die Kandidaten für eine Direktveröffentlichung, vermutlich erst nach Phase 1.
4. **Qualität ist ein zweites Verkaufsargument.** Die Kopierfehler in der Excel zeigen, dass strukturierte Erfassung und Plausibilitätsprüfungen falsche Angaben und damit Retouren und schlechte Bewertungen vermeiden.
5. **Die Herstellernummer ist der Schlüssel zur Automatisierung, wird aber heute nur in einem Drittel der Fälle erfasst.** Die Lösung sollte sie früh und verpflichtend erfassen, notfalls per Seriennummer oder Etikett, und eine eigene Modell-Bibliothek aufbauen, die mit jedem Gerät besser wird.
6. **Geschwächt hat die Recherche die Annahme**, dass die EAN der zentrale Suchschlüssel ist: Sie steht nur in 1 von 25 Blättern. **Bestätigt hat sie die Annahme**, dass eBay und PrestaShop offizielle Schnittstellen haben.
7. **Neu in v0.2:** Zentrale Einheit ist das **Modell-Inserat mit Stückzahl und Zustandsvarianten**, nicht das Einzelgerät. Preis, Zustandsbezeichnung, Kategorie und Titellänge unterscheiden sich je Kanal und müssen je Kanal einstellbar sein. Die Kleinanzeigen-Merkmals- und GPSR-Felder lassen sich im Kopier-Assistenten vorbereiten.

## 6. Offene Fragen

| # | Frage | Wie klären |
| --- | --- | --- |
| OF-1 | Wie viele Geräte pro Monat, wie viele neue Modelle, wie viel Zeit pro Gerät und Schritt? | Gespräch oder Zeitmessung beim Kunden an 2–3 Geräten |
| OF-2 | ~~Inserat pro Einzelgerät oder pro Modell?~~ **Geklärt:** pro Modell mit Stückzahl, bei deutlich anderem Zustand getrennt (Owner, Runde 1; bestätigt durch Inserate) | erledigt |
| OF-3 | ~~Was ist die „WI-Nr“?~~ **Geklärt:** interne Warennummer auf dem Karton (Owner); im Shop zugleich Artikelnummer | erledigt |
| OF-4 | Wie sehen die Lieferanten-PDFs aus (Anzahl Lieferanten und Formate, Liste der Zustandscodes wie „DGS“)? | 3–5 Beispiel-PDFs vom Kunden |
| OF-5 | Bietet Kleinanzeigen PRO-Kunden eine Import- oder Partnerschnittstelle an, die öffentlich nicht dokumentiert ist? | Anfrage des Kunden beim Kleinanzeigen-PRO-Vertrieb |
| OF-6 | Wie gut deckt Open Icecat bzw. die Herstellerdatenbank die typischen Business-Modelle (ThinkPad, Latitude, EliteBook) ab? | Stichprobe mit den 8 Herstellernummern aus der Excel (Aufgabe für eine spätere Phase) |
| OF-7 | Wofür wird das ausgedruckte Datenblatt genutzt (Beilage, Foto im Inserat, Lager)? Owner: unbekannt | Rückfrage beim Kunden |
| OF-8 | Vergibt der Kunde eigene EANs (Präfix 4255867), und nach welcher Regel? | Rückfrage beim Kunden |
| OF-9 | ~~Nutzt der Kunde eBay aktiv? Verhältnis defekte-IT.de zu notebookers.de?~~ **Geklärt (Owner, Runde 2):** eBay wird zum Teil genutzt, nicht hauptsächlich; defekte-IT.de ist die alte, notebookers.de die aktuelle Domain | erledigt |
| OF-10 | Haben kleine Gebrauchtgeräte-Händler dasselbe Problem, und würden sie zahlen? | 5–8 Händlergespräche, parallel zum Pilot (Owner hat „Pilot zuerst, produktfähig“ gewählt; der Pilot ist kostenlos, ein wirtschaftlicher Rückfluss entsteht daher nur über ein späteres Produkt) |

## Änderungshistorie

| Version | Datum | Änderung |
| --- | --- | --- |
| v0.1 | 06.11.2026 | Erste Recherche inkl. Analyse `Datenblatt.xlsx` (ersetzt den Stand aus dem abgebrochenen MAR-112) |
| v0.2 | 06.11.2026 | Analyse von sechs echten Inseraten (Kap. 2b), grobe Volumen-Schätzung, Signale für ein Mehrhändler-Produkt (Kap. 3.4), Korrektur zu GPSR-Feldern bei Kleinanzeigen, OF-2 und OF-3 geklärt, OF-8 bis OF-10 neu |
| v0.3 | 06.11.2026 | Owner-Antworten Runde 2 eingearbeitet: OF-9 geklärt (eBay Nebenkanal, notebookers.de aktuelle Marke), OF-10 als laufende Validierung neben dem Pilot |
