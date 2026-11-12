# Requirements Specification – resellr (Arbeitstitel), Phase 1 / Release 0.1 „Inserat-Generator“

## Dokument-Metadaten

| Feld | Wert |
| --- | --- |
| Projekt | resellr (Arbeitstitel), Kunde/Pilot: notebookers.de |
| Dokument | Requirements Specification, Paperclip-Dokument `requirements` an [MAR-579](/MAR/issues/MAR-579#document-requirements) (ab v0.3.4, Auftrag des Product Owner). **Maßgeblich für v0.3.4 ist die jüngste Revision dieses Dokuments an MAR-579.** Bis v0.3.3 wurde das Dokument `requirements` an [MAR-114](/MAR/issues/MAR-114#document-requirements) fortgeschrieben; dessen jüngste Revision `ce76d962-cc37-46e1-9086-b2be8e08e752` ist die freigegebene v0.3.3 und bleibt dort unverändert. |
| Nicht maßgebliche Kopie | Dokument `requirements` an [MAR-115](/MAR/issues/MAR-115), Revision `035a0e8c-3efe-4b16-bf48-5d22e1e9eddd` (Stand v0.1): nicht maßgebliche Kopie, nicht fortgeschrieben |
| Dokumentversion | v0.3.4 (Nachtrag nach Change Management, Change Request [MAR-573](/MAR/issues/MAR-573): Wieder-Aktivieren eines Merkmals in REQ-005, neue AC-REQ-005-11 und Folgepflege; in Korrekturrunde 2 Korrektur der Findings FIND-035 bis FIND-037 aus dem Requirements Review v0.3.4, Runde 1: Regel zu fehlenden Werten wieder aktivierter Pflichtmerkmale in REQ-005, neue AC-REQ-005-12 und A-39, Freigabe-Briefing korrigiert und an den Dokumentanfang gestellt; in Korrekturrunde 3 Korrektur von FIND-038 aus dem Requirements Review v0.3.4, Runde 2: Auslöser dieser Regel abschließend festgelegt (nur Speichern nach REQ-010, REQ-014 und REQ-088), AC-REQ-005-12 um einen Negativfall ergänzt; sonst unverändert gegenüber der freigegebenen v0.3.3; Details Kap. 15.13). v0.3.3: Folgerevision zu v0.3.2: ausschließlich Korrektur der minor Findings FIND-030 bis FIND-034 aus dem Delta-Review zu v0.3.1 und v0.3.2, Runde 1; sonst unverändert). v0.3.2: Folgerevision zu v0.3.1: Owner-Entscheidung E-7 zur Sicherung, REQ-066 zurückgezogen, neue REQ-104 bis REQ-106; leere Merkmalsfelder im Kopier-Assistenten: Änderung der mit v0.3 freigegebenen Regel bei REQ-037 (Folge in REQ-047), Klarstellung bei REQ-049. v0.3.1: ausschließlich Korrektur der minor Findings FIND-025 bis FIND-029 aus Review v0.3 Runde 1 |
| Status | approved (Owner-Freigabe 2026-11-12, Revision `0e17f047-eae3-41c0-8299-f9585509190b`, Gate [MAR-574](/MAR/issues/MAR-574), Freigabeanfrage im Kommentar `68c12942` mit Bestätigung der vier kritischen Annahmen und der UI/UX-Klassifizierung Minimal für UI-027). Vorheriger Status: draft (bereit für den Requirements Review, Runde 3; Verdikt `pass` an [MAR-598](/MAR/issues/MAR-598#document-requirements-review-v034-r3)). Basis: v0.3.3, approved (Owner-Freigabe 07.11.2026, Revision `ce76d962-cc37-46e1-9086-b2be8e08e752`, veröffentlicht als `docs/product/requirements.md`, Commit `6f34e2a`). Die Änderungen von v0.3.4 stehen in Kap. 15.13 |
| Autor | Business Analyst (MarloNET) |
| Auftraggeber | Product Owner; Auftrag v0.3.4 [MAR-579](/MAR/issues/MAR-579) (Parent [MAR-577](/MAR/issues/MAR-577), Gate [MAR-574](/MAR/issues/MAR-574)), Korrekturrunde 2 [MAR-583](/MAR/issues/MAR-583) (Parent [MAR-582](/MAR/issues/MAR-582)), Korrekturrunde 3 [MAR-592](/MAR/issues/MAR-592) (Parent [MAR-591](/MAR/issues/MAR-591)) zum Change Request [MAR-573](/MAR/issues/MAR-573) (Auslöser: Rückfrage des QA Lead [MAR-571](/MAR/issues/MAR-571), PR #334, Issue #151); Auftrag v0.3.3 [MAR-137](/MAR/issues/MAR-137) (Parent [MAR-135](/MAR/issues/MAR-135)), Änderungsliste `v033-aenderungsliste` an [MAR-137](/MAR/issues/MAR-137#document-v033-aenderungsliste); Auftrag v0.3.2 [MAR-132](/MAR/issues/MAR-132) (Parent [MAR-131](/MAR/issues/MAR-131)), Änderungsliste `v032-aenderungsliste` an [MAR-132](/MAR/issues/MAR-132#document-v032-aenderungsliste); Auftrag v0.3.1 [MAR-129](/MAR/issues/MAR-129) (Parent [MAR-127](/MAR/issues/MAR-127)); Auftrag v0.3 [MAR-123](/MAR/issues/MAR-123) (Parent [MAR-122](/MAR/issues/MAR-122)); Vorlage: Änderungsanalyse `v03-aenderungsanalyse` an [MAR-121](/MAR/issues/MAR-121#document-v03-aenderungsanalyse), Revision `5f87d5e9-07ae-42aa-8ca7-ee92294b7178`; frühere Aufträge [MAR-118](/MAR/issues/MAR-118) (v0.2), [MAR-114](/MAR/issues/MAR-114) (v0.1) |
| Datum | 12.11.2026 (v0.3.4); v0.3.3 bis v0.3: 06.11.2026 |
| Vorgängerfassung | v0.3.4 Review Runde 2: Revision `bc7b32ea-c3fa-421d-aabb-fd16e0fddf63` an MAR-579 (nicht freigegeben; Verdikt `changes_requested`, FIND-038); diese Revision baut darauf auf. Davor: v0.3.4 Review Runde 1: Revision `52d47c5d-b042-4330-aec0-d118110b10bb` an MAR-579 (nicht freigegeben; Verdikt `changes_requested`, FIND-035 bis FIND-037). Davor: v0.3.3, Revision `ce76d962-cc37-46e1-9086-b2be8e08e752` an MAR-114, **vom Owner am 07.11.2026 freigegeben** (Freigabeanfrage [MAR-142](/MAR/issues/MAR-142#document-owner-freigabeanfrage)); v0.3.4 baut darauf auf. Davor: v0.3.2, Revision `e4b94794-a239-47c3-83cc-ee3670691a4e` an MAR-114 (nicht freigegeben; Delta-Review zu v0.3.1 und v0.3.2 an [MAR-133](/MAR/issues/MAR-133): Verdikt `pass` mit fünf minor Findings FIND-030 bis FIND-034); v0.3.3 baut darauf auf. Davor: v0.3.1, Revision `d816223d-ea41-400e-b02c-5af7447bef10` an MAR-114 (nicht freigegeben; Delta-Review gemeinsam mit v0.3.2 an [MAR-133](/MAR/issues/MAR-133)); v0.3.2 baut darauf auf. Davor: v0.3, Revision `170ca77f-9e3e-4ffc-b0ae-d8ffa0f0c9e4` an MAR-114, **vom Owner am 06.11.2026 freigegeben** (Karte „Freigabe Requirements v0.3 und UI/UX-Klassifikation“, Bericht an [MAR-111](/MAR/issues/MAR-111)). Architecture Baseline ([MAR-125](/MAR/issues/MAR-125)) und UI/UX-Design ([MAR-126](/MAR/issues/MAR-126)) arbeiten auf dieser Revision; die Änderungsliste `v031-aenderungsliste` an [MAR-129](/MAR/issues/MAR-129#document-v031-aenderungsliste) nennt, was sie nachziehen müssen. Davor: v0.2, Revision `3275f25f-58b4-4190-97d2-6c8e71dc6d6e` an MAR-114. **v0.2 ist nicht freigegeben**; die Freigabekarte zu v0.2 an [MAR-111](/MAR/issues/MAR-111) wurde zurückgezogen, weil sie durch die Owner-Entscheidungen E-1 bis E-6 überholt ist. |
| Owner-Entscheidungen | **E-1 bis E-6** vom 06.11.2026 an [MAR-121](/MAR/issues/MAR-121) (Kommentare und Fragekarte; Wortlaut Kap. 11.1, RB-15 bis RB-20). Sie sind in v0.3 eingearbeitet und nicht verhandelbar. **E-7** vom 06.11.2026 an [MAR-125](/MAR/issues/MAR-125) (Fragekarte `15ba6e78-50f2-45ae-bf5f-94ec9af39256`, Titel „Sicherung in Phase 1“, vom Owner am 06.11.2026 um 18:58 UTC mit Option „(b) Nur Hinweis, ich sichere selbst“ beantwortet; dazu Kommentar `317f1409` des Owners an MAR-125; Owner-Wortlaut und davon getrennt die Ableitung in Kap. 11.1, RB-21): in v0.3.2 eingearbeitet; sie reduziert die mit v0.3 freigegebene REQ-066. Nicht Owner-Wortlaut, sondern aus E-7 abgeleitet sind der eine Datenordner (REQ-106) und die Aktion „resellr beenden“ in resellr (REQ-105); beide stehen zur ausdrücklichen Owner-Bestätigung (OP-17). |
| Verbindliche Basis | **Product Brief v1.0**, Owner-Freigabe 06.11.2026 (Interaktion `0dcd616b-a133-4b6e-a7fe-68ba130a6198`, freigegeben als Dokument-Revision 3; inhaltsgleich veröffentlicht als Revision 4 `bbe22e63-5691-418e-9ac2-b134b527df2e`); Repository `MarloNET/resellr`, Commit `45d5ef6`, `docs/product/product-brief.md` |
| Nicht bindender Hintergrund | Product Research v0.3 (Revision 4 `634fd004-0fd9-4531-846e-8c910e98f839`; Commit `45d5ef6`, `docs/product/product-research.md`); `Datenblatt.xlsx` (Anhang an [MAR-113](/MAR/issues/MAR-113), SHA-256 `866a53c4…9ced`); Owner-Notizen [MAR-111](/MAR/issues/MAR-111) |
| Review-Referenz | **Für v0.3.4: Runde 1 – `requirements-review-v034-r1` an [MAR-581](/MAR/issues/MAR-581#document-requirements-review-v034-r1), Revision `b47a2769-47a9-4fda-bc08-a26c369d84e0`, Verdikt `changes_requested` (FIND-035 bis FIND-037, in Korrekturrunde 2 korrigiert); Runde 2 – `requirements-review-v034-r2` an [MAR-586](/MAR/issues/MAR-586#document-requirements-review-v034-r2), Revision `7bb1a59f-5f35-407e-acf3-f258c4f13110`, Verdikt `changes_requested` (FIND-038, in dieser Revision korrigiert); Runde 3 pending.** v0.3.3: Review-Nachweise in der Freigabeanfrage an [MAR-142](/MAR/issues/MAR-142#document-owner-freigabeanfrage). v0.3.1 und v0.3.2 – `requirements-review-v032-r1` an [MAR-133](/MAR/issues/MAR-133#document-requirements-review-v032-r1), Revision `b119fea9-60fc-485a-b079-485276ba91c8`, Verdikt `pass` mit fünf minor Findings (FIND-030 bis FIND-034), die v0.3.3 korrigiert. v0.3 – `requirements-review-v03-r1` an [MAR-124](/MAR/issues/MAR-124#document-requirements-review-v03-r1), Revision `6adbad6c-2bfa-449f-8aac-b517f0d16094`, Verdikt `pass` mit fünf minor Findings (FIND-025 bis FIND-029), die v0.3.1 korrigiert. Frühere Runden: v0.1 – `requirements-review-r1` an [MAR-116](/MAR/issues/MAR-116#document-requirements-review-r1), Revision `23c36dba-08d8-4159-ae95-43e91e6c7698`, Verdikt `changes_requested` (FIND-001 bis FIND-019); v0.2 – `requirements-review-r2` an [MAR-119](/MAR/issues/MAR-119#document-requirements-review-r2), Revision `0f3fdb82-ff46-4a91-b25e-ec257756a12e`, Verdikt `pass` mit fünf minor Findings (FIND-020 bis FIND-024), die v0.3 korrigiert |
| Revision dieser Fassung | Revision `0e17f047-eae3-41c0-8299-f9585509190b` des Dokuments `requirements` an MAR-579 (vom Owner am 12.11.2026 freigegeben und unverändert veröffentlicht) |
| Human Approval | v0.3: freigegeben durch den Owner am 06.11.2026 (Revision `170ca77f`). v0.3.3 (mit den Änderungen aus v0.3.1 und v0.3.2): freigegeben durch den Owner am 07.11.2026 (Revision `ce76d962`, [MAR-142](/MAR/issues/MAR-142#document-owner-freigabeanfrage)). v0.3.4: freigegeben durch den Owner am 12.11.2026 (Revision `0e17f047`, Gate [MAR-574](/MAR/issues/MAR-574)), mit Bestätigung der vier kritischen Annahmen („Stimmt“) und der UI/UX-Klassifizierung Minimal für den Design-Nachtrag UI-027. |
| UI/UX-Klassifikation | **Material**, vom Owner mit der Freigabe von v0.3 bestätigt (Empfehlung des Product Owner; Einschätzung des BA in Anhang B). v0.3.1 ändert daran nichts. v0.3.2 ergänzt einen Hinweis und eine Aktion (REQ-104, REQ-105); nach Einschätzung des BA ändert das die Klasse nicht (Anhang B). v0.3.3 ändert nur Kennzeichnungen, eine offene Frage und zwei Messmethoden. v0.3.4 ergänzt in der bestehenden Pflegefunktion „Merkmale je Geräteart“ das Wieder-Aktivieren eines Merkmals (REQ-005); nach Einschätzung des BA ändert das die Klasse nicht (Anhang B). |

## Freigabe-Briefing

*Delta-Briefing für v0.3.4. Es betrifft nur die Änderung gegenüber v0.3.3, die du am 07.11.2026 freigegeben hast. Alles andere ist unverändert.*

### Kurzfassung
Mit v0.3.4 kann der Nutzer ein deaktiviertes Merkmal einer Geräteart wieder aktivieren (REQ-005). Bisher ging das nur in eine Richtung: Wer zum Beispiel das Merkmal RAM bei Notebooks versehentlich deaktiviert, konnte das nicht rückgängig machen, und jedes danach erfasste Notebook hätte keinen RAM-Wert. Nach dem Wieder-Aktivieren fragt resellr das Merkmal bei neuen Daten wieder ab; bereits gespeicherte Werte bleiben, wie sie sind. Fehlt einer Modellvorlage, einem Gerät oder einem Modell-Inserat aus der Zeit der Deaktivierung der Wert eines Pflichtmerkmals, verlangt resellr ihn nicht beim Aktivieren, sondern erst, wenn der Nutzer dort die Modellvorlage, die Gerätewerte oder die Inseratswerte (ohne Preise und Fotos) ändert; das folgt aus den bestehenden Pflichtregeln. Alle anderen Vorgänge laufen unverändert. Das Aktivieren wird nie abgelehnt und ändert nichts daran, welche Merkmale Modell-Inserate voneinander unterscheiden. Neu sind zwei Akzeptanzkriterien (AC-REQ-005-11, AC-REQ-005-12); sonst wird nur nachgeführt, eine neue Fachregel gibt es nicht.

### So haben wir dich verstanden
| Deine Vorgabe (Quelle) | Unsere Auslegung | Beispiel |
|---|---|---|
| Wieder-Aktivieren eines Merkmals ist gewünscht (Entscheidung des Product Owner im Change Request MAR-573; sie kommt mit dieser Freigabe zu dir) | Wieder-Aktivieren ist das Gegenstück zum Deaktivieren und wirkt nur nach vorn: Ab dem Aktivieren wird das Merkmal bei neuen Daten wieder abgefragt. Es gilt für jedes deaktivierte Merkmal jeder Geräteart (REQ-005). | RAM bei Notebooks war vom 10.11. bis 12.11. deaktiviert. Nach dem Aktivieren am 12.11. fragt resellr bei jedem neu erfassten Notebook wieder nach dem RAM. |
| „Gespeicherte Werte bleiben unverändert“ (MAR-573) | Das Aktivieren selbst ändert, ergänzt oder löscht keinen Wert. Vorhandene Werte bleiben, und Lücken aus der Zeit der Deaktivierung bleiben beim Aktivieren ebenfalls. Einen fehlenden Pflichtwert verlangt resellr erst, wenn der Nutzer Modellvorlage, Gerätewerte oder Inseratswerte ohne Preise und Fotos ändert (REQ-010, REQ-014, REQ-088; REQ-005, A-39). | Das Notebook „626198“ hat RAM 16 GB von vor der Deaktivierung: Es behält 16 GB. Ein Notebook, das am 11.11. erfasst wurde, hat keinen RAM-Wert: Es bekommt durch das Aktivieren keinen. RAM ist bei Notebooks Pflichtmerkmal; ändert der Nutzer später an diesem Notebook die Optik-Note, verlangt resellr beim Speichern den RAM-Wert. |

### Kritische Annahmen – bitte einzeln bestätigen
1. **Annahme:** Das Aktivieren eines Merkmals wird nie abgelehnt; es gibt keine Prüfung, die das Aktivieren verhindert.
   *Beispiel:* Der Nutzer aktiviert RAM bei Notebooks wieder, obwohl in der Zwischenzeit 40 Notebooks ohne RAM-Wert erfasst wurden: resellr führt das Aktivieren aus und lehnt es nicht ab.
   **Wenn falsch:** Es bräuchte Ablehnungsgründe und Meldungen, also eine neue Fachregel; Design (UI-027) und Technische Spezifikation müssten Fehlerfälle ergänzen, und die Umsetzung würde erneut geändert. (REQ-005, Regeln; AC-REQ-005-11)
2. **Annahme:** Gespeicherte Werte bleiben beim Aktivieren unverändert, und fehlende Werte werden beim Aktivieren nicht nachgefordert. Fehlt einer Modellvorlage, einem Gerät oder einem Modell-Inserat aus der Zeit der Deaktivierung aber der Wert eines **Pflichtmerkmals**, wird der Wert nur bei drei Vorgängen verlangt: beim Speichern einer Änderung der Modellvorlage (REQ-010), der Gerätewerte eines Geräts (REQ-014) oder der Inseratswerte eines Modell-Inserats ohne Preise und Fotos (REQ-088). Dann wird das Speichern abgelehnt und das fehlende Merkmal benannt, bis der Wert eingetragen ist, auch wenn die Änderung ein anderes Feld betrifft. Alle anderen Vorgänge verlangen den Wert nicht, etwa Preise erfassen, Fotos zuordnen, Modell-Inserat anlegen, zuordnen, umbuchen, Verkauf und Rücknahme, WI-Nr korrigieren, stornieren, freigeben. Solange das Merkmal deaktiviert ist, wird nichts verlangt. Das ist unsere Lesart des freigegebenen Stands (es gelten die bestehenden Pflichtregeln), keine neue Regel. Eine Liste „Werte nachtragen“ oder eine Markierung betroffener Datensätze gibt es nicht.
   *Beispiel:* Der Prozessor (bei Notebooks Pflichtmerkmal der Modellvorlage) ist vom 10.11. bis 12.11. deaktiviert. Am 11.11. legt der Nutzer die Modellvorlage „ThinkPad T14“ ohne Prozessor an. Am 12.11. aktiviert er den Prozessor wieder; am „ThinkPad T14“ ändert sich dadurch nichts. Danach korrigiert er dort die Typbezeichnung und speichert: resellr lehnt das Speichern ab und nennt „Prozessor“, bis er den Prozessor einträgt. Ebenso RAM (bei Notebooks Pflichtmerkmal am Gerät): Das Notebook vom 11.11. ohne RAM-Wert bleibt nach dem Aktivieren ohne RAM-Wert; ändert der Nutzer dort die Optik-Note, wird das Speichern abgelehnt, bis er den RAM-Wert einträgt. Den Shop-Preis 499,00 € für das am 11.11. aus einem Notebook ohne RAM-Wert angelegte Modell-Inserat MI-B speichert resellr dagegen wie bisher.
   **Wenn falsch:** Sollen solche Datensätze auch nach dem Aktivieren ohne den Wert gespeichert werden können, ist das eine Ausnahme von den Pflichtregeln (REQ-008/REQ-010, REQ-014, REQ-088), also eine neue Fachregel mit eigenem Change; AC-REQ-005-12 entfiele, Design UI-027 und Technische Spezifikation müssten die Ausnahme abbilden. Ebenso, wenn der Wert auch bei anderen Vorgängen (etwa Preis erfassen) verlangt werden soll. Wünschst du dagegen ein Nachfordern beim Aktivieren oder eine Liste der Lücken, ist das eine neue Funktion mit eigener Anforderung, Design und Umsetzung. (REQ-005, Regeln; Annahme A-39; AC-REQ-005-11, AC-REQ-005-12)
3. **Annahme:** Aktivieren (und auch Deaktivieren) ändert nicht, welche Merkmale Modell-Inserate unterscheiden. Ob ein Merkmal „variantenbildend“ ist, hängt nur an diesem Kennzeichen, nicht daran, ob das Merkmal aktiv ist. Das ist unsere Lesart des freigegebenen Stands, keine neue Regel.
   *Beispiel:* RAM ist bei Notebooks variantenbildend und bleibt es auch, solange es deaktiviert ist. Ein am 11.11. erfasstes Notebook ohne RAM-Wert erscheint deshalb beim Zuordnen zum Modell-Inserat MI-A (RAM 16 GB) als abweichend (REQ-018). Nach dem Aktivieren bleibt RAM variantenbildend; neue Notebooks haben wieder einen RAM-Wert und passen zu MI-A.
   **Wenn falsch:** Sollen deaktivierte Merkmale beim Vergleich nicht zählen, ist das eine neue Regel für das Gruppieren von Geräten zu Modell-Inseraten (Kap. 6.0, REQ-018, REQ-019). Sie beeinflusst Stückzahlen und Abweichungsanzeigen und wäre nach der Umsetzung teuer zu ändern. (REQ-005, Regeln; Annahme A-38)
4. **Annahme:** Der Umfang ist nur REQ-005 mit den neuen AC-REQ-005-11 und AC-REQ-005-12 und das Nachführen der davon betroffenen Stellen; es gibt keine weitere neue Fachregel.
   *Beispiel:* Hersteller, Lieferanten und Textbausteine können weiterhin nur deaktiviert werden; daran ändert v0.3.4 nichts.
   **Wenn falsch:** Was zusätzlich gewünscht ist, braucht einen eigenen Change mit Review und Freigabe. (Kap. 15.13)

### Weitere Annahmen
- Beim Aktivieren kann kein Namenskonflikt entstehen: Die Bezeichnung eines Merkmals ist schon heute je Geräteart eindeutig, deaktivierte Merkmale eingeschlossen (REQ-005, A-38). *Beispiel:* Solange das deaktivierte „RAM“ existiert, kann kein zweites Merkmal „RAM“ bei Notebooks angelegt werden.
- Das Aktivieren lässt alle übrigen Angaben des Merkmals unverändert (A-38). *Beispiel:* RAM behält Ebene *Gerät*, Einheit GB und seinen Platz in der Reihenfolge.
- Das Aktivieren erscheint wie jede Änderung an Einstellungen im Änderungsprotokoll (REQ-072, unverändert).
- Annahme 2 gilt auch für ein Modell-Inserat, aber nur beim Ändern seiner Inseratswerte nach REQ-088, weil dafür dieselben Regeln gelten wie am Gerät (REQ-088, A-39). *Beispiel:* MI-B (vom 11.11., ohne RAM-Wert): Ändert der Nutzer nach dem Aktivieren den Lieferumfang, verlangt resellr den RAM-Wert. Preis für MI-B erfassen (REQ-032) und Fotos zuordnen (REQ-042) geht weiterhin. Gleicht MI-B sonst MI-A (RAM 16 GB), wird der tatsächliche Wert 16 GB an MI-B abgelehnt, weil MI-B dann mit MI-A übereinstimmt (REQ-088); Weg: Notebook nach MI-A umbuchen (REQ-020), MI-B löschen (REQ-095, soweit zulässig).
- Alle anderen Vorgänge berührt Annahme 2 nicht; für sie gelten ihre Regeln unverändert (A-39). *Beispiel:* Das Notebook vom 11.11. ohne RAM-Wert kann nach dem Aktivieren wie bisher dem Modell-Inserat MI-A zugeordnet, danach als verkauft markiert und in seiner WI-Nr korrigiert werden (REQ-017, REQ-021, REQ-092); beim Zuordnen erscheint es wegen RAM 16 GB an MI-A als abweichend (Annahme 3).

### Entscheidungen der Agenten
| Entscheidung | Verworfene Alternative | Warum | Umkehrbar |
|---|---|---|---|
| AC-REQ-005-11 prüft zusätzlich, dass das Aktivieren ohne Ablehnung ausgeführt wird und RAM Variantenmerkmal bleibt | AC wörtlich wie im Change Request (nur Abfrage und gespeicherte Werte) | Damit sind alle Teile der neuen Regel prüfbar (Annahmen 1 bis 3) | leicht |
| Das Wieder-Aktivieren steht als Ergänzung in REQ-005, direkt hinter der Regel zum deaktivierten Merkmal | eigene neue Anforderung | So verlangt es der Auftrag; gleiche Funktion, gleiche Rolle, gleiche Herkunft | leicht |
| Der Status „aktiv/deaktiviert“ eines Merkmals steht jetzt ausdrücklich bei den Angaben des Merkmals (REQ-005, Kap. 9.1) | unverändert lassen | Deaktivieren gab es schon; der Status fehlte nur in diesen Listen (bei der Geräteart steht er bereits) | leicht |
| Die Lesart zu fehlenden Pflichtwerten (Annahme 2, A-39) nennt neben Modellvorlage und Gerät auch das Modell-Inserat (REQ-088) | nur Modellvorlage und Gerät, wie im Review genannt | REQ-088 verweist für diese Werte auf dieselben Regeln (REQ-014, REQ-005); ohne Nennung bliebe dort derselbe Fall offen | leicht |
| Der Wert wird nur nach REQ-010, REQ-014 und REQ-088 verlangt, nicht bei Preisen, Fotos und anderen Vorgängen | bei jeder Änderung an Modellvorlage, Gerät oder Modell-Inserat | Nur diese drei prüfen Werte nach Merkmalsdefinition; REQ-088 nimmt Preise und Fotos aus. Mehr wäre eine neue Fachregel | leicht |

### Bewusst nicht enthalten
- Kein Nachfordern fehlender Werte beim Aktivieren, keine Liste der Datensätze ohne Wert und keine Markierung solcher Datensätze (siehe Annahme 2). Ein fehlender Pflichtwert wird erst beim Ändern von Modellvorlage, Gerätewerten oder Inseratswerten ohne Preise und Fotos verlangt (REQ-010, REQ-014, REQ-088), bei anderen Vorgängen nicht.
- Keine Änderung an anderen Dingen, die man deaktivieren kann: Gerätearten (REQ-004), Werte von Auswahllisten (REQ-007), Hersteller (REQ-101), Lieferanten (REQ-099) und Textbausteine (REQ-026). *Beispiel:* Bei Gerätearten und Werten von Auswahllisten hat das freigegebene Design laut Change Request schon einen Weg zurück, die Requirements nennen dort aber weiterhin nur das Deaktivieren. Ob das nachgezogen werden soll, wäre ein eigener Change; Kanäle lassen sich schon heute aktivieren und deaktivieren (REQ-029).
- Design UI-027 und Technische Spezifikation: Sie folgen nach dieser Freigabe als eigene Schritte.

### Was sich geändert hat
Gegenüber v0.3.3 (von dir am 07.11.2026 freigegeben):
- REQ-005: „… deaktivieren und wieder aktivieren“; neue Regel zum Wieder-Aktivieren, einschließlich fehlender Werte von Pflichtmerkmalen beim späteren Speichern nach REQ-010, REQ-014 oder REQ-088; Status als Angabe des Merkmals genannt; Herkunft um MAR-573 ergänzt.
- Neue Akzeptanzkriterien AC-REQ-005-11 und AC-REQ-005-12.
- Kap. 9.1: Merkmal hat einen Status (aktiv/deaktiviert).
- Kap. 12: neue Annahmen A-38 (Lesart zu Variantenmerkmalen, Annahme 3) und A-39 (Lesart zu fehlenden Pflichtwerten, Annahme 2).
- Metadaten, Kap. 15 (neue Zeile v0.3.4, neues Kap. 15.13) und Anhang B nachgeführt; dieses Briefing steht jetzt direkt nach den Metadaten.

Gegenüber den internen Review-Fassungen (Runden 1 und 2) neu: die Regel zu fehlenden Pflichtwerten, verlangt nur beim Speichern nach REQ-010, REQ-014 oder REQ-088 (Annahme 2, AC-REQ-005-12, A-39); Annahme 1 auf den Wortlaut des Dokuments zurückgeführt.

Owner-Kommentare zu dieser Änderung gibt es noch nicht; dies ist die erste Vorlage von v0.3.4.

### Deine Entscheidungen
Keine offenen Fragen. Bitte bestätige die vier kritischen Annahmen oben einzeln.

### Lesetipps
- REQ-005 in Kap. 6.3, Regeln: der neue Absatz „Wieder aktivieren“ (die ganze inhaltliche Änderung).
- AC-REQ-005-11 und AC-REQ-005-12 in Kap. 8: woran die Abnahme das Verhalten prüft.
- A-38 in Kap. 12: unsere Lesart zu Variantenmerkmalen, die Annahme 3 trägt.
- A-39 in Kap. 12: unsere Lesart zu fehlenden Pflichtwerten, die Annahme 2 trägt.
- Kap. 15.13: alle geänderten und geprüften Stellen.

---

## Lesehilfe und Owner-Punkte aus v0.3.3

**Lesehilfe.** IDs aus dem Product Brief werden unverändert übernommen: GOAL-xx (Ziele), UC-xx (Use Cases), SC-xx (Erfolgskriterien), F-x (Owner-Entscheidungen), LP-1 bis LP-4 (Leitplanken aus Brief Kap. 6b). Annahmen des Product Brief heißen hier **Brief-A-1** usw., um sie von den Annahmen dieses Dokuments (**A-01** usw.) zu unterscheiden. „[Vorschlag BA]“ kennzeichnet Werte, die der Business Analyst vorschlägt und die weder aus dem Brief noch aus den Belegen stammen; der Owner bestätigt oder ändert sie mit der Freigabe (vollständige Liste in OP-17). „[Brief]“ kennzeichnet Werte aus dem Product Brief. **E-1 bis E-7** sind die Owner-Entscheidungen vom 06.11.2026 (Kap. 11.1; E-1 bis E-6 an MAR-121, E-7 an MAR-125). **Withdrawn** kennzeichnet zurückgezogene REQs und ACs; ihre IDs werden nicht wiederverwendet (Kap. 15.4).

*Hinweis v0.3.4: Die beiden folgenden Listen sind Stand v0.3.3 und bleiben unverändert stehen. v0.3.3 hat der Owner am 07.11.2026 freigegeben ([MAR-142](/MAR/issues/MAR-142#document-owner-freigabeanfrage)). Für die Freigabe von v0.3.4 gilt das Freigabe-Briefing oben.*

**Für die Owner-Freigabe offene Punkte (v0.3.1 bis v0.3.3, Details Kap. 13):**
- **Neu in v0.3.2 (E-7)** – REQ-066 ist zurückgezogen; resellr sichert in Phase 1 nicht selbst. Zu bestätigen sind die [Vorschlag BA] in OP-17: Überschrift und Wortlaut des Hinweises „Sicherung einrichten“ (REQ-104), Rückfrage und Meldungen der Aktion „resellr beenden“ (REQ-105). Neu offen ist **OP-31** (Aktion „resellr beenden“ im Netzbetrieb; Startannahme A-36: nur im Betrieb nur am Arbeitsplatzrechner).
- **Zur ausdrücklichen Owner-Bestätigung: aus E-7 abgeleitet, nicht Owner-Wortlaut (FIND-030)** – **REQ-105** (Aktion „resellr beenden“ in resellr, Priorität Must) und **REQ-106** (alle Daten in einem einzigen Datenordner). Entschieden hat der Owner mit E-7: OneDrive ja, freiwillig, nicht in Phase 1, immer ein klarer Hinweis, nur ein Hinweis mit Anleitung, eine Kopie ist nur bei beendetem resellr sicher brauchbar. Den einen Datenordner und die Aktion in resellr hat der Software Architect nach der Antwort beschrieben (Kommentar bb98a214 an MAR-125). Standardannahme: REQ-105 und REQ-106 gelten wie beschrieben, falls der Owner nicht widerspricht.
- **Zur ausdrücklichen Owner-Bestätigung: Änderung der mit v0.3 freigegebenen Regel (FIND-031)** – Leere Merkmalsfelder wurden bisher im Kopier-Assistenten als „leer“ gekennzeichnet und werden jetzt nicht mehr angezeigt (REQ-037, AC-REQ-037-01; Folge in REQ-047). Quelle: Design-Annahme an MAR-126, vom Product Owner bestätigt; Bestätigung durch den Owner mit der Freigabe. Klarstellung dazu: Leere Merkmalsfelder zählen im Übernahmefortschritt nicht mit (REQ-049).
- **Neu in v0.3.3** – Zu bestätigen ist der [Vorschlag BA] in OP-17: Zeiten, in denen resellr nach einem vom Nutzer ausgelösten Beenden (REQ-105) oder im Netzbetrieb nach einem Beenden durch den Betreiber (A-36) nicht läuft, zählen bei der Verfügbarkeit weder als Ausfall noch als Geschäftszeit (REQ-065, OP-12; FIND-033). Neu offen ist **OP-32** (automatische lokale Kopie vor jedem Update gegenüber dem Ausschluss jeder Sicherungsfunktion in Kap. 14; Startannahme A-37 [Vorschlag BA]: keine Sicherung im Sinne von Kap. 14; FIND-032).
- **OP-17, neu in v0.3.1** – [Vorschlag BA] aus FIND-026 und FIND-027; bis zur Bestätigung gelten sie als Standardannahme: Geltung eines erteilten Zugangs (REQ-001); Wirkung einer Änderung des Zugangspassworts auf bestehende Zugänge (REQ-097); Mindestlänge von 12 Zeichen auch für das erste und jedes zurückgesetzte Zugangspasswort, Einhaltung durch den Betreiber (REQ-067, Kap. 9.6); Messung der Verfügbarkeit im Betrieb nur am Arbeitsplatzrechner (REQ-065, OP-12).
- Weiter offen, mit Startannahme für die Parallelphase: **OP-15** (nur noch Web oder Desktop), **OP-23** (Betriebsmodell, Ort der Daten), **OP-24** (Betriebssystem und Programme am Arbeitsplatzrechner), **OP-26** (Lieferant als Auswahlliste oder Freitext).

**Mit der Freigabe von v0.3 am 06.11.2026 vom Owner bestätigt (mit ihren Standardannahmen; Wortlaut in Kap. 13 aus v0.3 unverändert):**
- **OP-17** – die verbleibenden „[Vorschlag BA]“-Werte, einschließlich der neuen Vorschläge aus v0.3 (Liste in Kap. 13 deutlich gekürzt).
- **OP-18** – Suchbegriffe/SEO-Felder nicht in Phase 1.
- **OP-29** – Bestandsangaben (Stückzahl, WI-Nrn, Akkukapazität) aktualisieren sich ohne neue Freigabe; berührt den Grundsatz „Freigabe jedes Inserats durch den Menschen“ (Brief Kap. 9, RB-11).
- **OP-30 / REQ-090** – Abgleich-Bestätigung beibehalten, vereinfachen oder streichen (laut Reviewer am ehesten verzichtbar).
- **UI/UX-Klassifikation** – Material (Empfehlung des Product Owner; Einschätzung des BA in Anhang B).

---

## 1. Zusammenfassung

resellr Phase 1 ist ein Inserat-Generator, mit dem ein Gebrauchtgeräte-Händler jedes eingekaufte Gerät genau einmal strukturiert erfasst und daraus fertige, geprüfte Inhalte für seinen Shop (PrestaShop), Kleinanzeigen und eBay sowie das gewohnte Datenblatt erzeugt. Kunde ist zunächst ein einzelner Pilotkunde (notebookers.de), für den genau eine Person, der Nutzer, mit resellr arbeitet (E-4) und der heute pro Gerät ein Excel-Blatt kopiert und jedes Inserat auf jedem Kanal von Hand abtippt; das System ist als Pilot gebaut, aber über Einstellungen statt fester Inhalte für weitere Händler und Gerätearten offen. Jetzt, weil die Kopier- und Abtippfehler nachweislich bis zum Käufer gelangen, GPSR-Herstellerangaben inzwischen in jedem Inserat erwartet werden und der Owner Richtung A (F-1) sowie das Zielbild „Pilot zuerst, produktfähig“ (F-5) entschieden hat.

## 2. Kontext und Problem

### 2.1 Heutige Situation (Brief Kap. 2, Research Kap. 2/2b)

1. Der Pilotkunde kauft Geräte im Los ein; die Einkaufsrechnung listet Geräte mit Lieferanten-Zustandscodes (z. B. „DGS“).
2. Jedes Gerät trägt eine WI-Nr (F-4d), im Shop zugleich Artikelnummer.
3. Zustand wird geprüft, Fotos werden gemacht.
4. Ein Datenblatt entsteht in Excel, indem das Blatt eines ähnlichen Geräts kopiert und überschrieben wird.
5. Für jeden Kanal werden Titel, Beschreibung, Kategorie, Merkmale, Preis und Bilder einzeln von Hand angelegt.
6. Inseriert wird pro Modell mit Stückzahl; bei deutlich abweichendem Zustand entstehen getrennte Inserate (F-4c).

### 2.2 Was daran falsch ist (Belege)

- **Mehrfacherfassung:** Dieselben Inhalte werden dreimal in unterschiedliche Formate übertragen (Shop: Lieferumfang und Merkmalsliste; Kleinanzeigen: Freitext plus eigene Merkmals- und GPSR-Felder; eBay: eigene Artikelmerkmale).
- **Kopierfehler:** In rund 18 von 25 Excel-Blättern passt der Blattname nicht zum Gerät; übernommene Fremdwerte (gleiche Herstellernummer bei zwei Modellen), Datumsumwandlungen (Optik-Note „02.03.2025“, Display „14.01.2026“), Tippfehler. In den echten Inseraten: zwei unterschiedliche Produktnummern auf einer Seite, ein Mini-PC in der Kategorie „Laptops & Notebooks“.
- **Uneinheitliche Bezeichnungen:** 4 Labels für die WI-Nr, 7 für die Herstellernummer; Herstellernummer nur in 8 von 25, EAN in 1 von 25 Blättern.
- **Je Kanal unterschiedliche Regeln:** Preis je Kanal (269/279 €, 289/299 €, 89 €/50 € VB), Zustandsbezeichnung je Kanal („gebraucht“ + „Optisch 3“ vs. „Gut“), Titel bei Kleinanzeigen nach 65 Zeichen hart abgeschnitten.
- **Rechtliche Texte kopiert:** Der Akku-Hinweis steht wortgleich in 19 von 25 Blättern; Gewährleistungs-/„Garantie“-Formulierungen gelten als abmahnträchtig (Research Kap. 4); GPSR-Herstellerangaben müssen in jedes Inserat.
- **Zeitaufwand:** nicht gemessen (F-4a, F-4b). Die Größe des Nutzens ist daher unsicher (Brief-A-1, Brief-A-2); eine Zeitmessung ist Voraussetzung vor Entwicklungsstart (Kap. 11.4).

### 2.3 Glossar

Jeder Begriff wird in diesem Dokument nur in der hier definierten Bedeutung verwendet.

| Begriff | Definition |
| --- | --- |
| **Pilotkunde** | Der Händler, für den Phase 1 gebaut wird; verkauft unter der Händlermarke notebookers.de. |
| **Owner** | Der menschliche Owner bei MarloNET; entscheidet über Produkt, Freigaben und hält die Rechte am Ergebnis (F-6). Nach E-4 ist der Owner zugleich der einzige Nutzer. |
| **Nutzer** | Die einzige Person, die mit resellr arbeitet; nach E-4 der Owner. Es gibt keine Mitarbeitenden, keine Benutzerkonten und keine Rollen (E-4, E-5). Der Nutzer darf alle Funktionen nutzen (Kap. 10.3). |
| **Bearbeiter**, **Administrator** | Rollen aus v0.2; in v0.3 entfallen (E-4). Beide sind durch **Nutzer** ersetzt (Kap. 15.5). Die Begriffe werden nur noch in der Änderungshistorie verwendet. |
| **Arbeitsplatzrechner** | Der eine PC, an dem der Nutzer immer arbeitet (E-6). Weil der Nutzer der Owner ist (E-4), ist es der PC des Owners; es gibt genau einen. „PC des Nutzers“ und „PC“ im Wortlaut von E-5 und E-6 meinen diesen Arbeitsplatzrechner; die Geräteart „PC/Mini-PC“ bezeichnet dagegen inserierte Ware. Angaben zu Betriebssystem und Programmen des Arbeitsplatzrechners liefert der Owner (OP-24, A-34). Ob der Arbeitsplatzrechner in den Räumen des Pilotkunden steht, ist nicht festgelegt; keine Anforderung hängt davon ab. Das Wort „Arbeitsplatz“ allein wird in diesem Dokument nicht verwendet. |
| **Netzbetrieb** | resellr ist über ein Netz (lokales Netz oder Internet) erreichbar, also nicht nur am Arbeitsplatzrechner selbst nutzbar. Ob Netzbetrieb vorliegt, ergibt sich aus der Architektur (OP-15, OP-23). Gegenteil: **Betrieb nur am Arbeitsplatzrechner**. |
| **Zugangspasswort** | Ein einziges Passwort, das im Netzbetrieb jeden Zugriff auf resellr schützt (E-5, REQ-001). Es gehört zu keinem Benutzerkonto. Im Betrieb nur am Arbeitsplatzrechner gibt es kein Zugangspasswort und keine Anmeldung. |
| **Betreiber** | Wer resellr technisch einrichtet und betreibt (z. B. Installation, im Netzbetrieb das Beenden von resellr für eine Sicherung (A-36, OP-31), Festlegen und Zurücksetzen des Zugangspassworts außerhalb der Funktionen des Systems). Wer das ist, ist offen (OP-23). |
| **Datenordner** | Der eine Ordner, in dem resellr alle Daten hält, einschließlich Fotos, Logo und Einstellungen (REQ-106, E-7). |
| **Sicherung** | Kopie der Daten, die der Owner freiwillig selbst anlegt, z. B. in OneDrive; sie ist nur bei beendetem resellr sicher brauchbar (Owner-Entscheidung E-7). Abgeleitet aus E-7 (zur ausdrücklichen Owner-Bestätigung, OP-17): Die Kopie ist eine Kopie des einen Datenordners (REQ-106). resellr hat in Phase 1 keine Funktion, die sichert, wiederherstellt oder prüft, ob gesichert wurde (Kap. 14). |
| **Händlermarke** | Name, Logo und Kontaktangaben, unter denen der Pilotkunde verkauft (aktuell notebookers.de, F-7c; nicht das alte Logo defekte-IT.de). |
| **Gerät** | Ein einzelnes physisches Gerät, eindeutig identifiziert durch seine WI-Nr. Ein Gerät ist entweder genau einem Modell-Inserat zugeordnet oder *nicht zugeordnet*. |
| **WI-Nr** | Interne Warennummer des Pilotkunden, meist auf dem Karton, dient der Identifikation eines Geräts (F-4d). |
| **Erfassungsstatus** | Status eines Geräts hinsichtlich seiner Prüfmarkierungen: *geprüft* (keine Prüfmarkierung) oder *unvollständig geprüft* (mindestens eine Prüfmarkierung, REQ-013). |
| **Bestandsstatus** | Status eines Geräts im Bestand: *verfügbar*, *verkauft* (REQ-021) oder *storniert* (Fehlerfassung, REQ-093). |
| **Geräteart** | Klasse von Geräten mit eigener Merkmalsliste, eigenem Titelmuster und eigener Kategoriezuordnung (z. B. Notebook, PC/Mini-PC, Tablet, Smartphone). Gerätearten sind Einstellung (LP-4). |
| **Merkmal** | Eine definierte Eigenschaft einer Geräteart (z. B. Prozessor, Arbeitsspeicher, Displaygröße) mit Datentyp, ggf. Einheit und zulässigen Werten. Jedes Merkmal hat eine **Ebene**: *Modell* (Wert gilt für alle Geräte der Modellvorlage und wird nur an der Modellvorlage gespeichert) oder *Gerät* (Wert wird je Gerät erfasst und kann abweichen). Tastaturlayout, Netzteil, Akku und Akkukapazität sind Merkmale der Ebene *Gerät* mit festen Regeln (REQ-014). |
| **Variantenmerkmal** | Merkmal der Ebene *Gerät* mit dem Kennzeichen „variantenbildend“ (Einstellung, REQ-005; Startbelegung Kap. 9.3). Beispiele: RAM, Speicherkapazität, Tastaturlayout. Die Akkukapazität ist nie Variantenmerkmal (A-16). |
| **Variantenangaben** | Zustand, Optik-Note, Zustandsbeschreibung und die Werte aller Variantenmerkmale. Variantenangaben gibt es am Gerät und am Modell-Inserat. Sie sind das **einzige Kriterium**, das zwei Modell-Inserate derselben Modellvorlage voneinander trennt (REQ-018, REQ-019; Vergleichsregel Kap. 6.0). |
| **Zustandsvariante** | Begriff des Brief (UC-01, F-4c, Brief Kap. 7) für getrennte Inserate desselben Modells. In diesem Dokument präzisiert durch **Variantenangaben**: „neue Zustandsvariante anlegen“ (UC-01) bedeutet „neues Modell-Inserat mit anderen Variantenangaben anlegen“ (REQ-019). Der Begriff wird darüber hinaus nicht verwendet. |
| **Hersteller** | Marke bzw. Hersteller eines Geräts (z. B. Lenovo, Apple), geführt mit einem Namen (REQ-100). Im Product Brief teilweise „Marke“ genannt („GPSR-Herstellerangaben je Marke“); in diesem Dokument einheitlich „Hersteller“. Der rechtliche Herstellername der GPSR-Herstellerangaben (REQ-027) kann vom Namen des Herstellers abweichen. |
| **Herstellernummer** | Vom Hersteller vergebene Produkt- oder Teilenummer (MPN, z. B. MTM „20TD002MGE“, „MHGT3D/A“, „6FY52AV“). Gehört zur Modellvorlage (A-22). Pflichtangabe oder ausdrücklich „unbekannt“. |
| **EAN** | Europäische Artikelnummer (GTIN-8 oder GTIN-13). **Original-EAN**: EAN des Herstellers an der Modellvorlage. **EAN des Modell-Inserats**: mit Kennzeichnung „Original“ (dann gilt stets die Original-EAN der Modellvorlage) oder „eigene“ (dann gilt die am Modell-Inserat erfasste EAN des Pilotkunden), A-11. |
| **Artikelnummer** | Die Nummer, unter der ein Modell-Inserat im Shop geführt wird (heute = WI-Nr, ggf. mit Zusatz, z. B. „616027-90“). |
| **Modellvorlage** | Wiederverwendbarer Datensatz eines Gerätemodells mit Modelldaten und Vorbelegungswerten. Einmal angelegt, für alle künftigen Geräte dieses Modells nutzbar (UC-02). |
| **Modelldaten** | Angaben der Modellvorlage, die für alle Geräte und Modell-Inserate dieser Modellvorlage gelten: Geräteart, Hersteller, Modellbezeichnung, Typbezeichnung, Herstellernummer, Original-EAN und die Werte der Merkmale der Ebene *Modell*. Sie werden nur an der Modellvorlage gespeichert und geändert (REQ-010). |
| **Vorbelegungswert** | Wert eines Merkmals der Ebene *Gerät* an der Modellvorlage, mit dem das System dieses Merkmal beim Erfassen eines Geräts vorbelegt (REQ-013). Wirkt nur auf künftig erfasste Geräte. |
| **Gerätewerte** | Am Gerät erfasste Angaben: Zustand, Optik-Note, Zustandsbeschreibung und die Werte aller Merkmale der Ebene *Gerät* (REQ-013, REQ-014). |
| **Modell-Bibliothek** | Gesamtheit aller Modellvorlagen. |
| **Modell-Inserat** | Zentrale Einheit des Inserierens (F-4c): gehört zu genau einer Modellvorlage, trägt eigene Inseratswerte und fasst die ihm zugeordneten Geräte zusammen, die mit Stückzahl inseriert werden. Ein Modell-Inserat hat je Kanal genau einen Kanal-Inhalt. Zwei Modell-Inserate derselben Modellvorlage unterscheiden sich immer in ihren Variantenangaben (REQ-019). |
| **Inseratswerte** | Am Modell-Inserat gespeicherte Angaben: Variantenangaben, übrige inserierte Gerätewerte (Werte der Merkmale der Ebene *Gerät*, die keine Variantenmerkmale sind, ohne Akkukapazität), Lieferumfang, Artikelnummer, EAN mit Kennzeichnung, Preise je Kanal, Fotos. Beim Anlegen aus dem anlegenden Gerät übernommen (REQ-019), danach über REQ-088, REQ-032 und REQ-042 änderbar. |
| **Lieferumfang** | Inseratswert: Auswahl von null bis mehreren aktiven Textbausteinen der Art *Lieferumfang* (A-32). Netzteil und Akku werden als Merkmale ausgegeben, nicht über den Lieferumfang. |
| **Bestandsangaben** | Aus den zugeordneten Geräten mit Bestandsstatus *verfügbar* abgeleitete Angaben eines Modell-Inserats: Stückzahl, WI-Nrn (Platzhalter `{WI-Nr}`) und Akkukapazität (Platzhalter `{Akkukapazität}`, A-16). Bestandsangaben werden nie von Hand gepflegt und stets aktuell ausgegeben (REQ-091). |
| **Inhaltsangaben** | Alle Angaben und Einstellungen, aus denen ein Kanal-Inhalt gebildet wird, mit Ausnahme der Bestandsangaben (z. B. Modelldaten, Inseratswerte, Textbausteine, GPSR-Herstellerangaben, Zuordnungen, Titelmuster, Beschreibungsvorlage) sowie manuelle Anpassungen am Kanal-Inhalt selbst (Titel, Beschreibung, Kategorie; REQ-043, REQ-086). |
| **Stückzahl** | Anzahl der einem Modell-Inserat zugeordneten Geräte mit Bestandsstatus *verfügbar*. |
| **Zustand** | Interner Zustandswert aus einer Auswahlliste (Startwerte siehe A-19, z. B. „gebraucht“, „defekt“, „refurbished“). |
| **Optik-Note** | Ganzzahlige Note 1–5 für den optischen Zustand (1 = beste Note); Bedeutung je Note siehe A-18. |
| **Zustandsbeschreibung** | Freitext zu Schäden und Besonderheiten (z. B. „BIOS-Passwort“, „Palmrest gebrochen“); am Gerät (Gerätewert) und am Modell-Inserat (Variantenangabe). |
| **Lieferant** | Bezugsquelle eines Geräts, deren Einkaufsunterlagen Zustandscodes enthalten; als Einstellung gepflegt (REQ-099, A-25). |
| **Zustandscode** | Kürzel eines Lieferanten für den Zustand (z. B. „DGS“). |
| **Code-Übersetzungstabelle** | Einstellung, die jedem Zustandscode (optional je Lieferant) einen Klartext zuordnet (UC-03). |
| **Kanal** | Ein Verkaufsweg mit eigenen Formatregeln. Phase 1: **Shop** (eigener PrestaShop 9.1.4 des Pilotkunden), **Kleinanzeigen** (gewerbliches Konto), **eBay** (Nebenkanal, F-7b). Jeder Kanal ist ein eigenständiger, ergänzbarer Ausgabe-Baustein (LP-2). |
| **Kanal-Inhalt** | Alle für einen Kanal erzeugten Angaben eines Modell-Inserats: Titel, Beschreibung, Merkmalsfelder, Kategorie, Zustandsbezeichnung (ggf. mit Zusatzangabe), Preis, GPSR-Angaben, Fotos. Ab der ersten Freigabe hat ein Kanal-Inhalt einen freigegebenen Stand, im Status *Veröffentlicht* oder *Beendet* ggf. zusätzlich einen Änderungsentwurf. |
| **Kanal-Status** | Status eines Kanal-Inhalts: *Entwurf*, *Freigegeben*, *Veröffentlicht*, *Beendet* (Kap. 9.4). |
| **Freigabe** | Ausdrückliche Bestätigung des Nutzers, dass ein Kanal-Inhalt geprüft und zur Veröffentlichung geeignet ist (Brief Kap. 9; REQ-044, REQ-089). |
| **Freigegebener Stand** | Der zuletzt freigegebene Inhalt eines Kanal-Inhalts. Bestandsangaben darin werden stets mit ihrem aktuellen Wert ausgegeben (REQ-091). |
| **Änderungsentwurf** | Neu gebildeter, noch nicht freigegebener Stand eines Kanal-Inhalts im Status *Veröffentlicht* oder *Beendet*, der entsteht, wenn sich nach der Freigabe eine Inhaltsangabe ändert (REQ-045). Er wird mit REQ-089 freigegeben. |
| **Kennzeichnung** | Hinweis an einem Kanal-Inhalt, der den Kanal-Status nicht ersetzt (vollständige Liste in Kap. 9.4), z. B. „geändert seit Freigabe“, „Änderung auf Kanal übertragen“, „Bestand auf Kanal anpassen“. |
| **Zustandszuordnung** | Einstellung, die je Kanal einem internen Zustand (mit Optik-Note) die Zustandsbezeichnung des Kanals und optional eine Zusatzangabe zuordnet. |
| **Kategoriezuordnung** | Einstellung, die je Geräteart und Kanal eine Kategorie des Kanals als Vorschlag festlegt. |
| **Merkmalszuordnung** | Einstellung, die je Kanal und Geräteart festlegt, welche Quellen (Kap. 9.11) unter welcher Feldbezeichnung und in welcher Reihenfolge als Merkmalsfelder ausgegeben werden. |
| **Titelmuster** | Einstellung je Geräteart (optional je Kanal), aus welchen Bestandteilen (Platzhalter mit Präfix und Suffix oder fester Text) der Titel gebildet wird und in welcher Reihenfolge Bestandteile bei Kürzung entfallen (REQ-030). |
| **Beschreibungsvorlage** | Einstellung je Kanal, aus welchen Abschnitten, Textbausteinen und Platzhaltern die Beschreibung gebildet wird. |
| **Textbaustein** | Zentral gepflegter, wiederverwendbarer Text (z. B. Akku-Hinweis, Lieferumfang, Abholzeiten, Rechtliches), ggf. mit Platzhaltern (UC-08). |
| **Prüfstatus** | Kennzeichen eines Textbausteins der Art *Rechtliches* oder *Akku-Hinweis*: *rechtlich ungeprüft* oder *rechtlich geprüft* (mit Datum und prüfender Stelle) (REQ-054). Nur für Textbausteine verwendet. |
| **GPSR-Herstellerangaben** | Je Hersteller gepflegte Angaben nach EU-Produktsicherheitsverordnung (GPSR): Herstellername, Postanschrift, elektronische Kontaktadresse, ggf. verantwortliche Person in der EU. |
| **Produktidentifikation** | Die im GPSR-Feld ausgegebene Kennung eines Modell-Inserats (Regel siehe A-26). |
| **Kopier-Assistent** | Funktion, die den freigegebenen Stand eines Kanal-Inhalts Feld für Feld in der Reihenfolge des Kanal-Formulars zur manuellen Übernahme bereitstellt (UC-05). Keine automatische Übertragung. |
| **Datenblatt** | Druckbares A4-Dokument je Gerät im bisherigen Excel-Layout mit Händlermarke (UC-06). |
| **Inserat-Übersicht** | Liste aller Modell-Inserate mit Kanal-Status, Kennzeichnungen, Stückzahl und verkauften Geräten (UC-07). |
| **Prüfmarkierung** | Kennzeichen „zu prüfen“ an einem vorbelegten Gerätewert (aus einem Vorbelegungswert der Modellvorlage oder aus einem Vorschlag der Code-Übersetzungstabelle); wird erst durch Bestätigung oder Änderung des Nutzers aufgehoben (REQ-013). |
| **Einstellung** | Inhalt, den der Nutzer über Funktionen des Systems ändert, ohne dass Entwicklung nötig ist (LP-1). |
| **Entwicklung** | Änderung an Programmcode, Datenbankstruktur oder Auslieferung des Systems durch Entwickler. |

## 3. Stakeholder und Nutzer

| Stakeholder | Rolle im System | Was er vom System braucht |
| --- | --- | --- |
| Owner (MarloNET) als Nutzer | Nutzer, die einzige Rolle (E-4, Kap. 10.3) | Weniger Zeit je Inserat (GOAL-01), keine Mehrfacherfassung (GOAL-02), fehlerfreie Inserate (GOAL-03), zentrale Rechtstexte und GPSR-Angaben (GOAL-04); schnelles Einbuchen per WI-Nr; klare Hinweise auf zu prüfende Werte; Kopier-Assistent für die Kanal-Formulare; gewohntes Datenblatt; volle Kontrolle durch Freigabe. |
| Owner (MarloNET) als Entscheider | – (Entscheidungen außerhalb des Systems) | Pilot, der produktfähig bleibt (F-5, LP-1 bis LP-4); Rechte am Ergebnis (F-6); Belege für den Produkt-Entscheidungspunkt (Brief Kap. 6b). |
| Pilotkunde (notebookers.de) | keine eigene Systemrolle; mit resellr arbeitet nur der Nutzer (E-4). Mitarbeitende gibt es nicht. | Inserate unter seiner Händlermarke (F-7c), korrekte Angaben auf allen Kanälen, gewohntes Datenblatt. |
| Käufer auf Shop, Kleinanzeigen, eBay | keine Systemrolle (indirekt) | Korrekte, widerspruchsfreie Angaben zu Gerät, Zustand und Hersteller. |
| Plattformen (PrestaShop des Pilotkunden, Kleinanzeigen, eBay) | externe Systeme, in Phase 1 ohne technische Anbindung | Einhaltung der Formatregeln und Nutzungsbedingungen (Kleinanzeigen § 5: keine automatisierten Mechanismen ohne Zustimmung). |
| Software Architect, UI/UX Designer (MarloNET) | nachgelagerte Leser | Eine vollständige, widerspruchsfreie gemeinsame Basis (insb. Kap. 9 und 10). |
| Weitere Gebrauchtgeräte-Händler (potenziell) | keine in Phase 1 | Nicht Teil von Phase 1; relevant nur über die Leitplanken (LP-1, LP-2, LP-4). |

## 4. Ziele und Nicht-Ziele

### 4.1 Ziele von Release 0.1 (aus Brief Kap. 4)

| Ziel | Inhalt | Erfolgskriterium | Gestützt durch (Auswahl, vollständig in Anhang A) |
| --- | --- | --- | --- |
| GOAL-01 | Zeit von „Gerät liegt vor“ bis „auf allen Kanälen inseriert“ deutlich senken | SC-01 | REQ-013, REQ-017, REQ-034 bis REQ-039, REQ-047, REQ-062, REQ-063, REQ-091 |
| GOAL-02 | Jede Information nur einmal eingeben und auf alle Kanäle und das Datenblatt übertragen | SC-02 | REQ-008, REQ-010, REQ-012, REQ-034 bis REQ-041, REQ-050, REQ-088 |
| GOAL-03 | Fehlerfreie, einheitliche Inserate | SC-03 | REQ-005, REQ-013, REQ-018, REQ-023, REQ-024, REQ-040, REQ-044, REQ-045, REQ-086, REQ-089 bis REQ-091, REQ-093 |
| GOAL-04 | Rechtliche Textbausteine und GPSR-Herstellerangaben zentral pflegen und einheitlich ausspielen | SC-04 | REQ-026, REQ-027, REQ-041, REQ-053, REQ-054, REQ-087 |
| Leitplanken LP-1, LP-2, LP-4 (F-5, F-7a) | Pilot produktfähig: Einstellung statt fester Inhalt, Kanäle als Bausteine, Gerätearten erweiterbar | SC-07 | REQ-004, REQ-005, REQ-029, REQ-030, REQ-074, REQ-075, REQ-076 |

### 4.2 Nicht-Ziele von Release 0.1

- **GOAL-05** (kanalübergreifender Stückzahl-Abgleich, SC-05) ist laut Brief ein Ziel ab Phase 2 (Release 0.3). Phase 1 pflegt Verkäufe manuell (REQ-021).
- **SC-06** (Händlergespräche, Produktentscheidung) ist eine Validierungsaktivität des Owners, keine Systemfunktion.
- **LP-3** (Rechte beim Owner, schriftliche Pilotvereinbarung) ist eine vertragliche Voraussetzung, keine Systemfunktion (Kap. 11.4).
- Alle Punkte aus Kap. 14 (u. a. Direktveröffentlichung, Automatisierung bei Kleinanzeigen, Preisfindung, Mehrhändler-Betrieb).

## 5. Umfang

### 5.1 MVP (Release 0.1, Brief Kap. 7 und 8)

Die Must-Anforderungen ergeben gemeinsam einen vollständigen, nutzbaren Ablauf: Gerät per WI-Nr erfassen → Modellvorlage nutzen oder anlegen → Modell-Inserat mit Stückzahl → Kanal-Inhalte für Shop, Kleinanzeigen und eBay erzeugen, prüfen, freigeben → per Kopier-Assistent in die Kanal-Formulare übernehmen → Datenblatt drucken → Verkäufe in der Inserat-Übersicht pflegen. Dazu kommen die Einstellungen, die LP-1, LP-2 und LP-4 verlangen.

| Funktionsbereich (Brief Kap. 7) | Anforderungen |
| --- | --- |
| Zugang (Zugangspasswort nur im Netzbetrieb, E-5) | REQ-001, REQ-097 |
| Gerätearten und Merkmale als Einstellung (F-7a, LP-4) | REQ-004 bis REQ-007, REQ-030 |
| Modell-Bibliothek, Hersteller | REQ-008 bis REQ-011, REQ-100, REQ-101 |
| Geräteerfassung, Modell-Inserat mit Stückzahl, Variantenangaben, Korrekturen | REQ-012 bis REQ-021, REQ-084, REQ-088, REQ-092 bis REQ-095 |
| Code-Übersetzungstabelle, Lieferanten, Zuordnungen je Kanal | REQ-022 bis REQ-025, REQ-099 |
| Textbausteine, GPSR-Herstellerangaben, Händlermarke | REQ-026 bis REQ-028, REQ-053, REQ-054, REQ-087 |
| Kanäle als Bausteine (LP-2) | REQ-029, REQ-031 |
| Inserat je Kanal erzeugen, Preis je Kanal, Freigabe, Statusmodell | REQ-032 bis REQ-046, REQ-085, REQ-086, REQ-089 bis REQ-091 |
| Kopier-Assistent für Shop, Kleinanzeigen und eBay | REQ-047 bis REQ-049 |
| Datenblatt | REQ-050, REQ-051 |
| Inserat-Übersicht | REQ-052 |
| Nachvollziehbarkeit | REQ-055 |
| Hinweis auf eigene Sicherung (E-7) | REQ-104, REQ-105 |
| Nice-to-have (Could) | REQ-056 bis REQ-059 |
| Nicht-funktionale Anforderungen | REQ-060 bis REQ-065, REQ-067 bis REQ-069, REQ-072 bis REQ-081, REQ-103, REQ-106 |
| *Withdrawn in v0.3* (IDs bleiben belegt, Kap. 15.4) | funktional: REQ-002, REQ-003, REQ-096, REQ-098; nicht-funktional: REQ-070, REQ-071, REQ-082, REQ-083, REQ-102 |
| *Withdrawn in v0.3.2* (ID bleibt belegt, Kap. 15.11) | nicht-funktional: REQ-066 (E-7) |

### 5.2 Prioritätenübersicht

- **Must:** alle funktionalen REQ außer den unten genannten und den zurückgezogenen.
- **Should:** REQ-011, REQ-020, REQ-033, REQ-043, REQ-049, REQ-055, REQ-085, REQ-092, REQ-094, REQ-095, REQ-101.
- **Could (Nice-to-have laut Brief):** REQ-056 (Excel-Übernahme), REQ-057 (PrestaShop-Importdatei), REQ-058 und REQ-059 (Plausibilitätswarnungen).
- **Won't (in Release 0.1):** keine REQ-IDs vergeben; die spätere Releases betreffenden Funktionen stehen in 5.3 und Kap. 14.
- **Withdrawn (v0.3):** REQ-002, REQ-003, REQ-096, REQ-098 (funktional) und REQ-070, REQ-071, REQ-082, REQ-083, REQ-102 (nicht-funktional); Begründung je REQ in Kap. 15.4.
- **Withdrawn (v0.3.2):** REQ-066 (nicht-funktional, Owner-Entscheidung E-7); Begründung in Kap. 7 und Kap. 15.11.

### 5.3 Spätere Releases (Brief Kap. 8, [Vorschlag] des Brief, unverändert übernommen)

| Release | Inhalt | Folgerung für Release 0.1 |
| --- | --- | --- |
| 0.2 (Phase 2a) | Direktveröffentlichung im PrestaShop inkl. Bilder, Kategorie- und Zustandszuordnung | Kanal-Inhalt des Shops muss vollständig strukturiert vorliegen (REQ-037, REQ-038, REQ-039); Kanal ist eigenständiger Baustein (REQ-075). |
| 0.3 (Phase 2b) | Stückzahl-Abgleich Shop; Hinweis zum Anpassen bei Kleinanzeigen; eBay-Direktanbindung nur bei ausreichendem eBay-Anteil | Verkäufe sind je Gerät und Kanal erfasst (REQ-021), Stückzahl ist abgeleitet (REQ-052). Abgrenzung: Release 0.1 enthält nur die manuell geführte Kennzeichnung „Bestand auf Kanal anpassen“ mit Abgleich-Bestätigung (REQ-052, REQ-090; OP-30), keine automatische Abgleichsfunktion und keinen kanalspezifischen Hinweis. |
| Entscheidungspunkt | Produkt oder Individuallösung (Owner, nach 4–8 Wochen Pilotbetrieb) | Keine Systemfunktion; LP-1/LP-2/LP-4 halten den Weg offen (REQ-074 bis REQ-076). |
| 0.4 (Phase 3) | Einkaufs-PDF einlesen, Geräte- und Akkudaten auslesen | Code-Übersetzungstabelle (REQ-022) bleibt nutzbar; keine Vorleistung in 0.1. |

## 6. Funktionale Anforderungen

Alle funktionalen Anforderungen haben `Release: 0.1`. Einzige Rolle ist der **Nutzer** (Kap. 10.3, E-4); „System“ bezeichnet Ergebnisse, die das System ohne eigene Nutzeraktion bildet. Akzeptanzkriterien stehen in Kap. 8. Neue Anforderungen aus v0.2 (REQ-084 bis REQ-101) stehen in dem Unterkapitel, zu dem sie fachlich gehören; die Nummern sind fortlaufend und unabhängig von der Kapitelreihenfolge.

### 6.0 Fachlicher Grundablauf: Modellvorlage → Gerät → Modell-Inserat → Kanal-Inhalt

Dieser Abschnitt legt verbindlich fest, woher jede Angabe eines Kanal-Inhalts stammt, wo sie gepflegt wird und wie Änderungen wirken. Alle Anforderungen in Kap. 6 und alle Akzeptanzkriterien in Kap. 8 folgen diesen Regeln.

**Schritt 1 – Modellvorlage (REQ-008, REQ-010).** Die Modellvorlage hält die Modelldaten (Geräteart, Hersteller, Modellbezeichnung, Typbezeichnung, Herstellernummer, Original-EAN, Werte der Merkmale der Ebene *Modell*) und die Vorbelegungswerte für Merkmale der Ebene *Gerät*.

**Schritt 2 – Gerät (REQ-012 bis REQ-016).** Ein Gerät wird mit WI-Nr und Modellvorlage erfasst. Das System belegt die Merkmale der Ebene *Gerät* mit den Vorbelegungswerten vor und versieht sie mit Prüfmarkierung (REQ-013). Der Nutzer erfasst bzw. bestätigt die Gerätewerte. Modelldaten werden am Gerät nicht gespeichert, sondern gelten aus der Modellvorlage. Ein Gerät mit Prüfmarkierung (Erfassungsstatus *unvollständig geprüft*) kann gespeichert, aber keinem Modell-Inserat zugeordnet werden. Bis zur Zuordnung ist das Gerät *nicht zugeordnet*: Es zählt in keiner Stückzahl, kann nicht als verkauft markiert werden, erscheint in keinem Kanal-Inhalt und ist über REQ-016 und REQ-094 auffindbar.

**Schritt 3 – Modell-Inserat (REQ-017 bis REQ-020, REQ-088).** Ein geprüftes Gerät wird einem bestehenden Modell-Inserat derselben Modellvorlage zugeordnet (REQ-017, mit Abweichungsprüfung REQ-018) oder es wird daraus ein neues Modell-Inserat angelegt (REQ-019). Beim Anlegen übernimmt das Modell-Inserat die Variantenangaben und die übrigen inserierten Gerätewerte unverändert vom anlegenden Gerät. Danach ändert der Nutzer Inseratswerte nur über REQ-088 (Preise: REQ-032; Fotos: REQ-042). Gerätewerte später zugeordneter Geräte verändern die Inseratswerte nicht.

**Vergleichsregel für Variantenangaben (gilt für REQ-014, REQ-018, REQ-019, REQ-088).** Zwei Sätze von Variantenangaben stimmen überein, wenn (a) Zustand, Optik-Note und der Wert jedes Variantenmerkmals gleich sind und (b) die Zustandsbeschreibungen zeichengleich sind, wobei Groß-/Kleinschreibung sowie Leerzeichen am Anfang und Ende nicht beachtet werden; zwei leere Zustandsbeschreibungen sind gleich, eine leere und eine nicht leere sind verschieden. Merkmale der Ebene *Gerät* ohne Variantenkennzeichen, die Akkukapazität und die WI-Nr werden nicht verglichen.

**Schritt 4 – Kanal-Inhalt (REQ-034 bis REQ-047, REQ-089 bis REQ-091).** Das System bildet je aktivem Kanal einen Kanal-Inhalt aus Modelldaten, Inseratswerten, Bestandsangaben und den Einstellungen des Kanals.

**Datenherkunft je Angabe**

| Angabe im Kanal-Inhalt bzw. Datenblatt | gespeichert an | beim Anlegen des Modell-Inserats | ändern über | Art der Angabe |
| --- | --- | --- | --- | --- |
| Geräteart, Hersteller, Modellbezeichnung, Typbezeichnung, Werte der Merkmale der Ebene *Modell* | Modellvorlage | – (gelten stets aus der Modellvorlage) | REQ-010 | Inhaltsangabe |
| Herstellernummer | Modellvorlage (A-22) | – | REQ-010 | Inhaltsangabe |
| EAN | Kennzeichnung „Original“: Original-EAN der Modellvorlage; Kennzeichnung „eigene“: Modell-Inserat | Kennzeichnung „Original“ | Kennzeichnung und eigene EAN: REQ-088; Original-EAN: REQ-010 | Inhaltsangabe |
| Variantenangaben (Zustand, Optik-Note, Zustandsbeschreibung, Werte der Variantenmerkmale) | Modell-Inserat | vom anlegenden Gerät übernommen | REQ-088 | Inhaltsangabe |
| Übrige inserierte Gerätewerte (Merkmale der Ebene *Gerät* ohne Variantenkennzeichen, ohne Akkukapazität) | Modell-Inserat | vom anlegenden Gerät übernommen | REQ-088 | Inhaltsangabe |
| Lieferumfang | Modell-Inserat | leer | REQ-088 | Inhaltsangabe |
| Artikelnummer | Modell-Inserat | WI-Nr des anlegenden Geräts (A-05) | REQ-088 | Inhaltsangabe |
| Preis je Kanal, Fotos | Modell-Inserat | leer | REQ-032, REQ-042 | Inhaltsangabe |
| Kategorie | Kanal-Inhalt (Vorschlag aus Kategoriezuordnung) | Vorschlag nach REQ-038 | REQ-086 | Inhaltsangabe |
| Manuell angepasster Titel bzw. manuell angepasste Beschreibung | Kanal-Inhalt | – (automatisch gebildet) | REQ-043 | Inhaltsangabe |
| Texte aus Textbausteinen, GPSR-Herstellerangaben, Zustands-, Merkmals-, Kategoriezuordnung, Titelmuster, Beschreibungsvorlage, Titel-Höchstlänge | Einstellungen | – | REQ-022 bis REQ-031, REQ-085 | Inhaltsangabe |
| Stückzahl, `{WI-Nr}` (alle verfügbaren WI-Nrn), `{Akkukapazität}` (A-16) | abgeleitet aus den zugeordneten verfügbaren Geräten | 1 bzw. Werte des anlegenden Geräts | nur indirekt über Geräte (REQ-014, REQ-017, REQ-020, REQ-021, REQ-084, REQ-092, REQ-093) | Bestandsangabe |
| Im **Datenblatt** zusätzlich: WI-Nr und alle Gerätewerte des einzelnen Geräts | Gerät | – | REQ-014, REQ-092 | (nur Datenblatt) |

**Wirkung von Änderungen auf Kanal-Inhalte (abschließend)**

| Kanal-Status des Kanal-Inhalts | Änderung einer Inhaltsangabe | Änderung einer Bestandsangabe |
| --- | --- | --- |
| *Entwurf* | Kanal-Inhalt wird automatisch neu gebildet (REQ-034 bis REQ-041) | aktueller Wert wird ausgegeben (REQ-091); keine Kennzeichnung |
| *Freigegeben* | Status wechselt zu *Entwurf* mit Kennzeichnung „geändert seit Freigabe“; neuer Stand wie bei *Entwurf* gebildet; der bisher freigegebene Stand bleibt zum Vergleich sichtbar (REQ-045) | aktueller Wert wird ausgegeben; keine Kennzeichnung, kein Statuswechsel |
| *Veröffentlicht* | Status bleibt; Kennzeichnung „geändert seit Freigabe“; Änderungsentwurf entsteht; Kopier-Assistent und Inserat-Übersicht zeigen weiter den freigegebenen Stand, bis der Änderungsentwurf freigegeben ist (REQ-045, REQ-089); danach „Änderung auf Kanal übertragen“ bis zur Abgleich-Bestätigung (REQ-090) | aktueller Wert wird ausgegeben; Kennzeichnung „Bestand auf Kanal anpassen“ bis zur Abgleich-Bestätigung (REQ-052, REQ-090); kein Statuswechsel |
| *Beendet* | Status bleibt; Kennzeichnung „geändert seit Freigabe“; Änderungsentwurf entsteht; Freigabe über REQ-089; *Beendet* → *Veröffentlicht* erst nach dieser Freigabe (REQ-046) | aktueller Wert wird ausgegeben; keine Kennzeichnung |

Eine Änderung „geht in einen Kanal-Inhalt ein“, wenn der neu gebildete Stand dieses Kanal-Inhalts vom freigegebenen Stand abweicht (Bestandsangaben ausgenommen) (REQ-045).

**Übergang *Veröffentlicht* → *Beendet* (REQ-046, Kap. 9.4):** Die Kennzeichnungen „Bestand auf Kanal anpassen“ und „Änderung auf Kanal übertragen“ entfallen; „geändert seit Freigabe“ und ein bestehender Änderungsentwurf bleiben [Vorschlag BA].

**Zusatz bei manueller Anpassung (REQ-043, Should).** Die Tabelle und REQ-045 gelten ohne manuelle Anpassungen vollständig. Ist ein Titel oder eine Beschreibung nach REQ-043 manuell angepasst, gilt zusätzlich: Der manuell angepasste Text wird nicht automatisch neu gebildet, sondern erhält „Daten geändert, manuell angepassten Text prüfen“, sobald sich der automatisch gebildete Text ändert, der ihm zugrunde liegt; eine solche Änderung geht ebenfalls in den Kanal-Inhalt ein (REQ-043).

### 6.1 Primäre Nutzerreisen (end-to-end, fachlich)

Im Netzbetrieb beginnt jede Nutzerreise ohne bestehenden Zugang (REQ-001, Geltung eines erteilten Zugangs) mit der Eingabe des Zugangspassworts (REQ-001; falsches Zugangspasswort → Ablehnung, AC-REQ-001-02). Im Betrieb nur am Arbeitsplatzrechner entfällt dieser Schritt (E-5).

**J-01 Neues Modell erstmals inserieren** (UC-02, UC-03, UC-04, UC-05, UC-06)
1. Der Nutzer sucht in der Modell-Bibliothek (REQ-009); ohne Treffer legt er eine Modellvorlage an (REQ-008), mit Geräteart, Hersteller (Auswahl oder Neuanlage, REQ-100), Modellbezeichnung, Herstellernummer oder „unbekannt“, Original-EAN (optional), Werten der Merkmale der Ebene *Modell* und Vorbelegungswerten der Ebene *Gerät*.
2. Er erfasst das Gerät mit seiner WI-Nr und der Modellvorlage (REQ-012), optional mit Lieferant und Zustandscode; das System setzt den Klartext (REQ-015) und belegt die Gerätewerte vor (REQ-013).
3. Er erfasst Zustand, Optik-Note, Zustandsbeschreibung und die Werte der Merkmale der Ebene *Gerät* (REQ-014) und hebt alle Prüfmarkierungen auf (REQ-013). Das Gerät ist *geprüft*.
4. Er legt aus dem Gerät ein neues Modell-Inserat an (REQ-019); das Modell-Inserat übernimmt die Variantenangaben und übrigen inserierten Gerätewerte des Geräts und hat Stückzahl 1. Er wählt den Lieferumfang (REQ-088), erfasst den Preis je Kanal (REQ-032) und ordnet Fotos zu (REQ-042).
5. Das System erzeugt je aktivem Kanal einen Kanal-Inhalt im Status *Entwurf*: Titel (REQ-034, REQ-035), Beschreibung (REQ-036), Merkmalsfelder (REQ-037), Kategorievorschlag (REQ-038), Zustandsbezeichnung (REQ-039), Kennungen (REQ-040), GPSR-Angaben (REQ-041).
6. Er prüft jeden Kanal-Inhalt, korrigiert bei Bedarf Kategorie (REQ-086) oder Texte (REQ-043) und gibt ihn frei (REQ-044, ggf. mit Bestätigung nach REQ-087); fehlende Pflichtangaben verhindern die Freigabe mit Nennung des fehlenden Punkts.
7. Er nutzt je Kanal den Kopier-Assistenten (REQ-047, REQ-048), überträgt die Felder und Fotos in das Formular des Kanals und setzt danach den Kanal-Status auf *Veröffentlicht* (REQ-046).
8. Er druckt das Datenblatt des Geräts oder speichert es als PDF (REQ-050).
- *Fehlerpfade:* WI-Nr bereits vergeben → Ablehnung mit Verweis (REQ-012); Pflichtangaben fehlen → Ablehnung mit Nennung (REQ-008, REQ-014); Abbruch nach Schritt 2 oder 3 → Gerät bleibt *nicht zugeordnet* und ist über REQ-094 auffindbar; falsch erfasstes Gerät → Storno (REQ-093) und Neuerfassung.

**J-02 Weiteres Gerät zu bestehendem Modell-Inserat einbuchen** (UC-01, SC-01)
1. Der Nutzer erfasst die WI-Nr mit der Modellvorlage (REQ-012) und ggf. den Zustandscode (REQ-015); das System belegt die Gerätewerte vor (REQ-013).
2. Er bestätigt oder ändert die markierten Werte (REQ-013, REQ-014).
3. Er wählt das bestehende Modell-Inserat (REQ-017). Weichen die Variantenangaben des Geräts von denen des Modell-Inserats ab, zeigt das System jede Abweichung (REQ-018); er ordnet trotzdem zu oder legt ein neues Modell-Inserat an (REQ-019, weiter mit J-01 ab Schritt 4).
4. Die Stückzahl steigt um 1; `{WI-Nr}` und `{Akkukapazität}` werden in allen Kanal-Inhalten aktualisiert, ohne dass eine erneute Freigabe nötig ist (REQ-091). Ist ein Kanal-Inhalt veröffentlicht, trägt er „Bestand auf Kanal anpassen“ (REQ-052); der Nutzer passt die Stückzahl auf dem Kanal an und bestätigt den Abgleich (REQ-090).
- *Fehlerpfade:* Gerät aus anderer Modellvorlage → Ablehnung (REQ-017); Gerät mit Prüfmarkierung → Ablehnung „Erst Werte prüfen“ (REQ-017).

**J-03 Verkauf erfassen** (UC-07)
1. Der Nutzer findet das Gerät per WI-Nr (REQ-016) und markiert es als verkauft mit Kanal und Datum (REQ-021).
2. Die Stückzahl des Modell-Inserats sinkt um 1; die Inserat-Übersicht zeigt verkaufte Geräte je Kanal und bei veröffentlichten Kanal-Inhalten „Bestand auf Kanal anpassen“ (REQ-052). Der Nutzer passt die anderen Kanäle an und bestätigt den Abgleich (REQ-090).
3. Bei Stückzahl 0 zeigt die Übersicht das Modell-Inserat als „ausverkauft“; der Nutzer beendet die Inserate auf den Kanälen und setzt jeden veröffentlichten Kanal-Inhalt auf *Beendet* (REQ-046). Dabei entfallen „Bestand auf Kanal anpassen“ und „Änderung auf Kanal übertragen“ ohne Abgleich-Bestätigung; der Übersichtsfilter nach diesen Kennzeichnungen zeigt das Modell-Inserat danach nicht mehr, sofern kein anderer seiner Kanal-Inhalte sie trägt (AC-REQ-046-07).
- *Fehlerpfad:* irrtümlich als verkauft markiert → Verkaufsmarkierung zurücknehmen (REQ-084).

**J-04 Textbaustein oder GPSR-Herstellerangaben ändern** (UC-08, SC-04)
1. Der Nutzer ändert einen Textbaustein (REQ-026) oder die GPSR-Herstellerangaben eines Herstellers (REQ-027).
2. Kanal-Inhalte im Status *Entwurf* und Änderungsentwürfe übernehmen die Änderung ohne Einzelbearbeitung, soweit der betroffene Text nicht manuell angepasst ist; manuell angepasste Texte erhalten einen Prüfhinweis (REQ-043). Freigegebene, veröffentlichte und beendete Kanal-Inhalte erhalten „geändert seit Freigabe“ (REQ-045). Das System meldet die Anzahl je Gruppe (REQ-053).
3. Der Nutzer gibt die betroffenen Kanal-Inhalte erneut frei (REQ-044 bzw. REQ-089) und überträgt die Änderung bei veröffentlichten Kanal-Inhalten per Kopier-Assistent; danach bestätigt er den Abgleich (REQ-090). Künftig angelegte Modell-Inserate enthalten den neuen Text (SC-04).

**J-05 Neue Geräteart anlegen** (LP-4, SC-07)
1. Der Nutzer legt eine Geräteart an (REQ-004), definiert ihre Merkmale mit Ebene und Variantenkennzeichen (REQ-005), ihr Titelmuster (REQ-030), ihre Kategoriezuordnung je Kanal (REQ-024) und ergänzt die Merkmalszuordnung je Kanal (REQ-025).
2. Ab sofort kann der Nutzer Modellvorlagen, Geräte und Modell-Inserate dieser Geräteart anlegen und Kanal-Inhalte sowie Datenblätter erzeugen (J-01), ohne Entwicklung (REQ-076).

**J-06 Veröffentlichtes Modell-Inserat ändern** (UC-04, GOAL-03)
1. Der Nutzer ändert einen Inseratswert, z. B. die Zustandsbeschreibung oder den Preis eines Kanals (REQ-088, REQ-032), oder er korrigiert Modelldaten der Modellvorlage (REQ-010).
2. Jeder veröffentlichte Kanal-Inhalt, in den die Änderung eingeht, behält den Status *Veröffentlicht*, erhält „geändert seit Freigabe“ und einen Änderungsentwurf (REQ-045). Kopier-Assistent und Inserat-Übersicht zeigen weiter den freigegebenen Stand, damit kein ungeprüfter Stand auf den Kanal gelangt.
3. Der Nutzer prüft den Änderungsentwurf (alter und neuer Stand) und gibt ihn frei (REQ-089). Der Kanal-Inhalt trägt nun „Änderung auf Kanal übertragen“; der Kopier-Assistent zeigt den neuen freigegebenen Stand.
4. Der Nutzer überträgt die Änderung per Kopier-Assistent auf den Kanal und bestätigt den Abgleich (REQ-090); die Kennzeichnung entfällt.
- *Fehlerpfad:* Änderungsentwurf erfüllt eine Freigabebedingung nicht (z. B. Kategorie fehlt) → Freigabe abgelehnt mit Nennung (REQ-089); der freigegebene Stand bleibt im Kopier-Assistenten.

### 6.2 Zugang (Zugangspasswort nur im Netzbetrieb)

Mit resellr arbeitet genau eine Person, der Nutzer (E-4). Es gibt keine Benutzerkonten, keine Rollen und kein Zurücksetzen von Passwörtern durch das System (E-5).

#### REQ-001 – Zugang im Netzbetrieb nur mit Zugangspasswort
- **Type:** Functional | **Priorität:** Must | **Release:** 0.1 | **Rolle:** Nutzer
- **Anforderung:** Das System muss im Netzbetrieb jeden Zugriff auf Daten und Funktionen von der Eingabe des gültigen Zugangspassworts abhängig machen. Im Betrieb nur am Arbeitsplatzrechner gibt es keine Anmeldung (E-5).
- **Eingaben:** Zugangspasswort (nur im Netzbetrieb). **Ausgaben:** Zugang zu allen Funktionen oder Ablehnung mit „Zugangspasswort falsch“.
- **Regeln:** Es gibt weder Benutzerkennung noch Benutzerkonto noch Rolle (E-4, E-5). Das System bietet keine Funktion zum Zurücksetzen des Zugangspassworts. Vergisst der Nutzer das Zugangspasswort, setzt es der Betreiber außerhalb der Funktionen des Systems zurück (E-5). Das erste Zugangspasswort legt ebenfalls der Betreiber bei der Einrichtung außerhalb der Funktionen des Systems fest [Vorschlag BA]. Die Regeln für das Zugangspasswort stehen in REQ-067. **Geltung eines erteilten Zugangs [Vorschlag BA]:** Nach Eingabe des gültigen Zugangspassworts gilt der Zugang nur für das Programm (z. B. Browser oder Anwendung) auf dem Gerät, in dem es eingegeben wurde, und zwar bis dieses Programm beendet wird. Eine Zeitgrenze und eine Abmeldung nach Inaktivität gibt es nicht (REQ-067). Nach einem Neustart des Programms und auf jedem anderen Gerät ist das Zugangspasswort erneut einzugeben. Eine Änderung des Zugangspassworts beendet alle anderen Zugänge (REQ-097). **Abgrenzung zum Betrieb nur am Arbeitsplatzrechner:** Ohne Zugangspasswort darf resellr nur am Arbeitsplatzrechner selbst nutzbar sein. Ist resellr von einem anderen Gerät aus erreichbar, liegt Netzbetrieb vor (Glossar), und das Zugangspasswort ist Pflicht (AC-REQ-001-07). Ob Netzbetrieb vorliegt, ergibt sich aus der Architektur (OP-15, OP-23); die Anforderung gilt in beiden Fällen.
- **Must-Begründung:** Owner-Entscheidung E-5. Im Netzbetrieb wären Preise, Einstellungen und Rechtstexte sonst für jeden zugänglich und änderbar, der resellr über das Netz erreicht (REQ-067).
- **Trace:** E-5, E-4, F-5 (produktfähig), Brief Kap. 9; REQ-067

#### REQ-002 – Benutzerkonten verwalten
- **Type:** Functional | **Status:** *Withdrawn in v0.3*
- **Begründung:** Es gibt genau einen Nutzer und keine Benutzerkonten (E-4, E-5). Zugehörige ACs AC-REQ-002-01 bis -03 sind ebenfalls zurückgezogen (Kap. 8). Inhalt bis v0.2: Revision `3275f25f` an MAR-114.

#### REQ-003 – Einstellungen nur für Administratoren
- **Type:** Functional | **Status:** *Withdrawn in v0.3*
- **Begründung:** Es gibt keine Rollen; der Nutzer darf alle Funktionen nutzen, auch das Ändern von Einstellungen (E-4, Kap. 10.3). Zugehörige ACs AC-REQ-003-01 bis -03 sind zurückgezogen.

#### REQ-096 – Initialpasswort vergeben
- **Type:** Functional | **Status:** *Withdrawn in v0.3*
- **Begründung:** Keine Benutzerkonten und kein Zurücksetzen durch das System (E-5). Das Zugangspasswort legt der Betreiber außerhalb der Funktionen des Systems fest (REQ-001). Zugehörige ACs AC-REQ-096-01 und -02 sind zurückgezogen.

#### REQ-097 – Zugangspasswort ändern
- **Type:** Functional | **Priorität:** Must | **Release:** 0.1 | **Rolle:** Nutzer | [Vorschlag BA] (Beibehaltung dieser Funktion für den Netzbetrieb)
- **Anforderung:** Der Nutzer kann im Netzbetrieb das Zugangspasswort ändern.
- **Eingaben:** bisheriges Zugangspasswort (Pflicht), neues Zugangspasswort (Pflicht, Regeln nach REQ-067, verschieden vom bisherigen), Wiederholung des neuen Zugangspassworts (Pflicht, gleich dem neuen). **Ausgaben:** Bestätigung „Zugangspasswort geändert“ oder Ablehnung mit Nennung der verletzten Regel.
- **Regeln:** Ein falsches bisheriges Zugangspasswort führt zur Ablehnung ohne Änderung. Nach der Änderung gilt nur noch das neue Zugangspasswort. **Wirkung auf bestehende Zugänge [Vorschlag BA]:** Mit der Änderung enden alle anderen bestehenden Zugänge (in anderen Programmen oder auf anderen Geräten); dort verlangt der nächste Funktionsaufruf das neue Zugangspasswort. Der Zugang, über den die Änderung erfolgt ist, bleibt bestehen. Das ist keine Abmeldung nach Inaktivität (REQ-067). Im Betrieb nur am Arbeitsplatzrechner gibt es diese Funktion nicht (REQ-001).
- **Must-Begründung:** Wird das Zugangspasswort im Netzbetrieb bekannt, muss der Nutzer es sofort selbst ersetzen können; ohne diese Funktion müsste der Betreiber jede Änderung vornehmen und der Zugang bliebe bis dahin offen (REQ-067).
- **Trace:** E-5, F-5, Brief Kap. 9; REQ-001, REQ-067

#### REQ-098 – Passwort zurücksetzen
- **Type:** Functional | **Status:** *Withdrawn in v0.3*
- **Begründung:** Kein Zurücksetzen durch das System (E-5); vergisst der Nutzer das Zugangspasswort, setzt es der Betreiber außerhalb der Funktionen des Systems zurück (REQ-001). Zugehörige ACs AC-REQ-098-01 und -02 sind zurückgezogen.

### 6.3 Gerätearten und Merkmale (Einstellung, LP-4)

#### REQ-004 – Geräteart anlegen und ändern
- **Type:** Functional | **Priorität:** Must | **Release:** 0.1 | **Rolle:** Nutzer
- **Anforderung:** Der Nutzer kann eine Geräteart anlegen, umbenennen und deaktivieren.
- **Eingaben:** Name (Pflicht, eindeutig ohne Beachtung von Groß-/Kleinschreibung, max. 50 Zeichen [Vorschlag BA]), Status aktiv/deaktiviert. **Ausgaben:** Geräteart steht bei Modellvorlagen zur Auswahl (wenn aktiv).
- **Regeln:** Eine deaktivierte Geräteart steht für neue Modellvorlagen nicht zur Auswahl; bestehende Modellvorlagen, Geräte und Modell-Inserate dieser Geräteart bleiben unverändert nutzbar. Eine Geräteart mit zugeordneten Modellvorlagen kann nicht gelöscht, nur deaktiviert werden.
- **Must-Begründung:** LP-4 und F-7a verlangen, dass neue Gerätearten per Einstellung entstehen (SC-07).
- **Trace:** LP-4, F-7a, SC-07, UC-02

#### REQ-005 – Merkmale einer Geräteart definieren
- **Type:** Functional | **Priorität:** Must | **Release:** 0.1 | **Rolle:** Nutzer
- **Anforderung:** Der Nutzer kann für eine Geräteart Merkmale anlegen, ändern, in ihrer Reihenfolge festlegen, deaktivieren und wieder aktivieren.
- **Eingaben je Merkmal:** Bezeichnung (Pflicht, eindeutig je Geräteart); Datentyp (Pflicht: *Text*, *Ganzzahl*, *Dezimalzahl*, *Ja/Nein*, *Auswahl aus Liste*, *Mehrfachangabe Anzahl × Typ* für Anschlüsse); Einheit (optional, z. B. GB, Zoll, GHz, W) mit Ausgabeschreibweise (mit oder ohne Leerzeichen zwischen Zahl und Einheit, z. B. „16 GB“ oder „16GB“); bei Zahlen optional Mindest- und Höchstwert; bei *Auswahl aus Liste* die Auswahlliste (REQ-007); Ebene (Pflicht: *Modell* oder *Gerät*); bei Ebene *Gerät* das Kennzeichen „variantenbildend“ ja/nein (Pflicht; für die Akkukapazität immer „nein“, A-16); Pflichtmerkmal ja/nein; Datenblatt-Block (Identifikation, Zustand, Lieferumfang, Technik, Anschlüsse, Software); Status aktiv/deaktiviert (ausdrücklich genannt seit v0.3.4).
- **Ausgaben:** Merkmal erscheint bei Modellvorlagen und Geräten dieser Geräteart und steht für Titelmuster, Beschreibungsvorlagen, Merkmalszuordnungen und Datenblatt zur Verfügung.
- **Regeln:** Eingaben werden gegen den Datentyp geprüft; das System wandelt Eingaben niemals in einen anderen Datentyp um (keine Datumsumwandlung, vgl. Excel-Befund). Ein deaktiviertes Merkmal wird für neue Daten nicht mehr abgefragt; vorhandene Werte bleiben gespeichert. **Wieder aktivieren (neu in v0.3.4, Change Request MAR-573):** Ein wieder aktiviertes Merkmal wird für neue Daten wieder abgefragt; gespeicherte Werte bleiben unverändert (das Aktivieren ergänzt, ändert und löscht keinen Wert). Fehlt einem bestehenden Datensatz der Wert eines wieder aktivierten Pflichtmerkmals, weil er während der Deaktivierung entstanden ist, wird der Wert nicht beim Aktivieren nachgefordert, aber verlangt, sobald der Nutzer eine Änderung nach einer dieser Anforderungen speichert: Modellvorlage ändern (REQ-010 mit REQ-008), Gerätewerte eines Geräts erfassen und ändern (REQ-014), Inseratswerte eines Modell-Inserats ohne Preise und Fotos ändern (REQ-088). Ein wieder aktiviertes Pflichtmerkmal ist ein aktives Pflichtmerkmal, und für diese Vorgänge gelten die bestehenden Pflichtregeln. Fehlt der Wert, wird das Speichern abgelehnt und das fehlende Merkmal benannt, auch wenn die Änderung ein anderes Feld betrifft. Alle anderen Vorgänge verlangen den Wert nicht; für sie gelten ihre bestehenden Regeln unverändert, insbesondere Preis erfassen (REQ-032), Fotos zuordnen (REQ-042), Modell-Inserat anlegen (REQ-019), Gerät zuordnen (REQ-017) und umbuchen (REQ-020), als verkauft markieren (REQ-021) und Verkaufsmarkierung zurücknehmen (REQ-084), WI-Nr korrigieren (REQ-092), stornieren (REQ-093) und Kanal-Inhalt freigeben (REQ-044). Solange das Merkmal deaktiviert ist, wird der Wert weder abgefragt noch verlangt (Lesart des freigegebenen Stands: A-39). Das Aktivieren wird nie abgelehnt. Es ändert das Kennzeichen „variantenbildend“ nicht und damit nicht die Menge der Variantenmerkmale (Glossar „Variantenmerkmal“); auf die Vergleichsregel (Kap. 6.0), REQ-018 und REQ-019 wirkt es nicht. Wie ein deaktiviertes Variantenmerkmal dort behandelt wird, bleibt unverändert (Lesart des freigegebenen Stands: A-38). Ändern des Datentyps oder der Ebene eines Merkmals, zu dem bereits Werte gespeichert sind, wird abgelehnt. Eine Änderung des Kennzeichens „variantenbildend“ wirkt auf alle Vergleiche nach der Vergleichsregel (Kap. 6.0), die nach der Änderung stattfinden (REQ-014, REQ-018, REQ-019, REQ-088); bestehende Zuordnungen von Geräten zu Modell-Inseraten und gespeicherte Inseratswerte bleiben unverändert. Würden nach der Änderung zwei oder mehr Modell-Inserate derselben Modellvorlage nach der Vergleichsregel übereinstimmende Variantenangaben haben, lehnt das System die Änderung ab und nennt je Modellvorlage die betroffenen Modell-Inserate; das Kennzeichen bleibt dann unverändert [Vorschlag BA]. Damit gilt die Regel „Zwei Modell-Inserate derselben Modellvorlage unterscheiden sich immer in ihren Variantenangaben“ (REQ-019) auch nach Änderungen der Einstellung.
- **Must-Begründung:** Feste Felder mit Datentyp sind die Grundlage für fehlerfreie Daten (GOAL-03) und für Gerätearten per Einstellung (LP-4).
- **Trace:** GOAL-03, LP-4, F-7a, SC-07, UC-02, F-4c (FIND-023); Wieder-Aktivieren: Change Request MAR-573 (v0.3.4)

#### REQ-006 – Startbelegung für vier Gerätearten
- **Type:** Functional | **Priorität:** Must | **Release:** 0.1 | **Rolle:** – (Auslieferungszustand), geprüft durch den Nutzer
- **Anforderung:** Das System muss bei Auslieferung eine Startbelegung enthalten, die abschließend aus folgenden Teilen besteht: (1) die Gerätearten Notebook, PC/Mini-PC, Tablet und Smartphone mit den Merkmalen, Ebenen, Variantenkennzeichen und Pflichtangaben aus Kap. 9.3; (2) die Titelmuster aus Kap. 9.3; (3) die Auswahllisten mit Startwerten aus Kap. 9.2; (4) die Kanäle Shop, Kleinanzeigen und eBay mit Titel-Höchstlänge und VB-Zulässigkeit aus Kap. 9.12; (5) die Merkmalszuordnungen je Kanal aus Kap. 9.8; (6) die Beschreibungsvorlagen je Kanal aus Kap. 9.12; (7) das Datenblatt-Layout aus Kap. 9.12.
- **Regeln:** Die Startbelegung ist selbst Einstellung und durch den Nutzer änderbar (REQ-004, REQ-005). Nicht Teil der Auslieferung sind kundenspezifische Inhalte (LP-1, REQ-074): Kategorie- und Zustandszuordnungen, Texte der Textbausteine, GPSR-Herstellerangaben, Händlermarke und Logo, Code-Übersetzungstabelle, Lieferanten. Diese erfasst der Nutzer vor Pilotbetrieb als Einstellung aus den Startdaten des Pilotkunden (V-03; Abnahmeeingabe). Der Inhalt der Startbelegung wird vor Pilotbetrieb mit dem Pilotkunden abgestimmt (A-21, OP-05).
- **Must-Begründung:** F-7a legt die vier Gerätearten für Phase 1 fest; ohne Startbelegung müsste der Pilotkunde alle Gerätearten, Merkmale und Vorlagen selbst anlegen, bevor er das erste Gerät erfassen kann.
- **Trace:** F-7a, Brief Kap. 7, UC-02

#### REQ-007 – Auswahllisten pflegen
- **Type:** Functional | **Priorität:** Must | **Release:** 0.1 | **Rolle:** Nutzer
- **Anforderung:** Der Nutzer kann die Werte von Auswahllisten (u. a. Zustand, Tastaturlayout, Netzteil, Akku; Startwerte Kap. 9.2) ergänzen, umbenennen, in der Reihenfolge ändern und deaktivieren.
- **Regeln:** Werte sind je Liste eindeutig (ohne Beachtung von Groß-/Kleinschreibung: „gebraucht“ und „GEBRAUCHT“ sind derselbe Wert). Ein deaktivierter Wert steht für neue Eingaben nicht zur Auswahl; bereits gespeicherte Werte bleiben erhalten. Eine Umbenennung wirkt auf alle Datensätze, die den Wert verwenden. Jeder Wert der Auswahlliste Akku trägt das Kennzeichen „Akku vorhanden“ ja/nein (Pflicht; Startwerte Kap. 9.2); Regeln, die vom Vorhandensein eines Akkus abhängen (REQ-014), richten sich nach diesem Kennzeichen und nicht nach dem Namen des Werts, sodass sie eine Umbenennung überstehen.
- **Must-Begründung:** Brief Kap. 7 verlangt Auswahllisten statt Freitext; LP-1 verlangt, dass ihr Inhalt Einstellung ist.
- **Trace:** GOAL-03, LP-1, Brief Kap. 7

### 6.4 Modell-Bibliothek

#### REQ-008 – Modellvorlage anlegen
- **Type:** Functional | **Priorität:** Must | **Release:** 0.1 | **Rolle:** Nutzer
- **Anforderung:** Der Nutzer kann eine Modellvorlage anlegen.
- **Eingaben:** Geräteart (Pflicht, aktive Geräteart); Hersteller (Pflicht, Auswahl aus den aktiven Herstellern oder Neuanlage nach REQ-100); Modellbezeichnung (Pflicht, max. 100 Zeichen [Vorschlag BA]); Typbezeichnung (optional, max. 50 Zeichen [Vorschlag BA], z. B. „A1989“); Herstellernummer (Pflicht: Wert oder ausdrücklich „unbekannt“, Regeln Kap. 9.6); Original-EAN (optional, Regeln Kap. 9.6); Werte der Merkmale der Ebene *Modell* (Pflichtmerkmale sind Pflicht); Vorbelegungswerte der Merkmale der Ebene *Gerät* (optional).
- **Ausgaben:** Gespeicherte Modellvorlage in der Modell-Bibliothek.
- **Regeln:** Fehlen Pflichtangaben, wird das Speichern abgelehnt und jedes fehlende Feld benannt. Ungültige Werte (Datentyp, Wertebereich, EAN-Prüfziffer) werden mit Nennung des Feldes und der Regel abgelehnt.
- **Must-Begründung:** Kern von UC-02 und des größten Einsparhebels (Brief Kap. 2c, „hoch“).
- **Trace:** UC-02, GOAL-01, GOAL-02, Brief Kap. 7

#### REQ-009 – Modellvorlage suchen
- **Type:** Functional | **Priorität:** Must | **Release:** 0.1 | **Rolle:** Nutzer
- **Anforderung:** Der Nutzer kann Modellvorlagen nach Hersteller, Modellbezeichnung, Typbezeichnung oder Herstellernummer suchen.
- **Eingaben:** Suchbegriff (mind. 2 Zeichen), optional Geräteart. **Ausgaben:** Liste der Treffer mit Geräteart, Hersteller, Modellbezeichnung, Typbezeichnung, Herstellernummer; bei keinem Treffer der Hinweis „Keine Modellvorlage gefunden“ und die Möglichkeit, eine Modellvorlage anzulegen (REQ-008).
- **Regeln:** Die Suche findet Teilübereinstimmungen und ignoriert Groß-/Kleinschreibung.
- **Must-Begründung:** Ohne Suche kann eine Modellvorlage nicht wiederverwendet werden (UC-01, UC-02).
- **Trace:** UC-01, UC-02, GOAL-01

#### REQ-010 – Modellvorlage ändern
- **Type:** Functional | **Priorität:** Must | **Release:** 0.1 | **Rolle:** Nutzer
- **Anforderung:** Der Nutzer kann die Angaben einer Modellvorlage ändern.
- **Regeln:** Es gelten dieselben Pflicht- und Validierungsregeln wie in REQ-008. Änderungen an Modelldaten (Kap. 6.0) wirken auf alle Modell-Inserate und alle Datenblätter dieser Modellvorlage, weil Modelldaten nur an der Modellvorlage gespeichert sind; das gilt auch für die Original-EAN bei Modell-Inseraten mit EAN-Kennzeichnung „Original“. Die Wirkung auf Kanal-Inhalte regelt Kap. 6.0 bzw. REQ-045. Änderungen an Vorbelegungswerten wirken nur auf künftig erfasste Geräte; Gerätewerte bereits erfasster Geräte und Inseratswerte bleiben unverändert. Die Geräteart einer Modellvorlage mit erfassten Geräten kann nicht geändert werden.
- **Must-Begründung:** Fehler in der Modellvorlage müssen an einer Stelle korrigierbar sein, sonst verbreiten sie sich in alle Inserate (GOAL-03).
- **Trace:** UC-02, GOAL-02, GOAL-03

#### REQ-011 – Hinweis auf mögliche doppelte Modellvorlage
- **Type:** Functional | **Priorität:** Should | **Release:** 0.1 | **Rolle:** Nutzer
- **Anforderung:** Das System muss beim Anlegen einer Modellvorlage darauf hinweisen, wenn bereits eine Modellvorlage mit gleichem Hersteller und gleicher Modellbezeichnung (ohne Beachtung von Groß-/Kleinschreibung und Leerzeichen) existiert.
- **Ausgaben:** Hinweis mit den gefundenen Modellvorlagen; der Nutzer kann eine davon verwenden oder das Anlegen bestätigen.
- **Trace:** GOAL-02, GOAL-03

#### REQ-100 – Hersteller anlegen
- **Type:** Functional | **Priorität:** Must | **Release:** 0.1 | **Rolle:** Nutzer
- **Anforderung:** Der Nutzer kann beim Anlegen oder Ändern einer Modellvorlage einen neuen Hersteller anlegen.
- **Eingaben:** Name des Herstellers (Pflicht, 1–50 Zeichen [Vorschlag BA]). **Ausgaben:** aktiver Hersteller, der sofort für Modellvorlagen auswählbar ist; Status „GPSR unvollständig“ (REQ-027).
- **Regeln:** Führende und abschließende Leerzeichen werden entfernt. Der Name ist eindeutig ohne Beachtung von Groß-/Kleinschreibung; existiert er bereits (z. B. „lenovo“ zu „Lenovo“), legt das System keinen zweiten Hersteller an, sondern weist auf den vorhandenen hin und verwendet ihn. Ist der vorhandene Hersteller deaktiviert, wird das Anlegen mit Hinweis auf den deaktivierten Hersteller abgelehnt. Die GPSR-Herstellerangaben pflegt der Nutzer über REQ-027; bis dahin ist keine Freigabe möglich (REQ-041).
- **Must-Begründung:** Ohne Neuanlage kann ein Modell eines bisher unbekannten Herstellers nicht als Modellvorlage angelegt werden (UC-02).
- **Trace:** UC-02, UC-08, GOAL-02; E-4

#### REQ-101 – Hersteller umbenennen und deaktivieren
- **Type:** Functional | **Priorität:** Should | **Release:** 0.1 | **Rolle:** Nutzer
- **Anforderung:** Der Nutzer kann den Namen eines Herstellers ändern und einen Hersteller deaktivieren.
- **Regeln:** Es gelten die Namensregeln aus REQ-100. Eine Umbenennung wirkt auf alle Modellvorlagen dieses Herstellers und damit nach Kap. 6.0 auf deren Kanal-Inhalte. Ein deaktivierter Hersteller steht für neue Modellvorlagen nicht zur Auswahl; bestehende Modellvorlagen bleiben unverändert nutzbar.
- **Trace:** UC-08, GOAL-03

### 6.5 Geräteerfassung, Modell-Inserat, Variantenangaben und Korrekturen

#### REQ-012 – Gerät per WI-Nr erfassen
- **Type:** Functional | **Priorität:** Must | **Release:** 0.1 | **Rolle:** Nutzer
- **Anforderung:** Der Nutzer kann ein Gerät mit seiner WI-Nr erfassen.
- **Eingaben:** WI-Nr (Pflicht), Lieferant (optional, Auswahl aus den aktiven Lieferanten nach REQ-099), Zustandscode (optional, REQ-015), Modellvorlage (Pflicht, Auswahl über REQ-009 oder Neuanlage über REQ-008).
- **Ausgaben:** Gespeichertes Gerät mit Bestandsstatus *verfügbar*, Erfassungsstatus, Zuordnung *nicht zugeordnet* und Erfassungsdatum.
- **Regeln:** WI-Nr nach Kap. 9.6 (Pflicht; eindeutig über alle Geräte mit Bestandsstatus *verfügbar* oder *verkauft*; die WI-Nr eines stornierten Geräts ist wieder frei, REQ-093). Ist die WI-Nr bereits vergeben, wird die Erfassung abgelehnt mit dem Hinweis auf das vorhandene Gerät und sein Modell-Inserat. Die Zuordnung zu einem Modell-Inserat erfolgt über REQ-017 oder REQ-019.
- **Must-Begründung:** Die WI-Nr ist die Identifikation jedes Geräts (F-4d) und der Einstieg in UC-01.
- **Trace:** UC-01, F-4d, GOAL-02

#### REQ-013 – Vorbelegung aus Modellvorlage mit Prüfmarkierung
- **Type:** Functional | **Priorität:** Must | **Release:** 0.1 | **Rolle:** Nutzer
- **Anforderung:** Das System muss beim Erfassen eines Geräts jedes Merkmal der Ebene *Gerät*, für das die Modellvorlage einen Vorbelegungswert hat, mit diesem Wert vorbelegen und mit einer Prüfmarkierung versehen.
- **Ausgaben:** Vorbelegte Gerätewerte; Liste der Werte mit Prüfmarkierung; Erfassungsstatus des Geräts. Die Modelldaten werden zur Information angezeigt; sie sind keine Gerätewerte und tragen keine Prüfmarkierung.
- **Regeln:** Eine Prüfmarkierung wird nur durch ausdrückliches Bestätigen oder Ändern des Werts durch den Nutzer aufgehoben. Solange ein Gerät Werte mit Prüfmarkierung hat, kann es gespeichert werden (Erfassungsstatus *unvollständig geprüft*), aber keinem Modell-Inserat zugeordnet werden (REQ-017, REQ-019) und es kann kein Datenblatt dafür erzeugt werden (REQ-050). Sind alle Prüfmarkierungen aufgehoben, ist der Erfassungsstatus *geprüft*.
- **Must-Begründung:** Brief Kap. 7: „damit nichts vom Vorgänger übrig bleibt“; verhindert den belegten Kopierfehler (GOAL-03).
- **Trace:** UC-01, UC-02, GOAL-01, GOAL-03, Brief Kap. 7

#### REQ-014 – Gerätespezifische Zustands- und Ausstattungsangaben erfassen
- **Type:** Functional | **Priorität:** Must | **Release:** 0.1 | **Rolle:** Nutzer
- **Anforderung:** Der Nutzer kann je Gerät die Gerätewerte erfassen und ändern: Zustand, Optik-Note, Zustandsbeschreibung, Tastaturlayout, Netzteil, Akku, Akkukapazität in Prozent und die Werte der übrigen Merkmale der Ebene *Gerät*.
- **Eingaben und Regeln:** Zustand (Pflicht, Auswahlliste); Optik-Note (Pflicht, ganze Zahl 1–5); Zustandsbeschreibung (optional, Freitext); Tastaturlayout (Pflicht, wenn die Geräteart das Merkmal hat; Auswahlliste); Netzteil (Pflicht, wenn die Geräteart das Merkmal hat; Auswahlliste); Akku (Pflicht, wenn die Geräteart das Merkmal hat; Auswahlliste); Akkukapazität (Pflicht, wenn der gewählte Akku-Wert das Kennzeichen „Akku vorhanden“ trägt, REQ-007; Startbelegung: „mit Akku“ und „mit Akku (defekt)“; zulässig: ganze Zahl 0–100 oder ausdrücklich „nicht ermittelbar“); Werte der übrigen Merkmale der Ebene *Gerät* nach ihrer Merkmalsdefinition (REQ-005). Werte außerhalb dieser Regeln werden mit Nennung des Feldes abgelehnt (z. B. Optik-Note „3 bis 4“). Die Zustandsbeschreibung umfasst max. 1.000 Zeichen [Vorschlag BA].
- **Ausgaben:** Gespeicherte Gerätewerte.
- **Regeln für zugeordnete Geräte:** Ändert der Nutzer eine Variantenangabe eines Geräts, das einem Modell-Inserat zugeordnet ist, und weicht sie danach nach der Vergleichsregel (Kap. 6.0) vom Modell-Inserat ab, zeigt das System die Abweichung wie in REQ-018; der Nutzer behält die Zuordnung bei (protokolliert wie „trotzdem zuordnen“) oder legt ein neues Modell-Inserat an (REQ-019). Das Umbuchen als weitere Wahl ergänzt REQ-020 (Should). Änderungen der Akkukapazität ändern nur Bestandsangaben (REQ-091).
- **Must-Begründung:** Brief Kap. 7 nennt diese Felder ausdrücklich als feste Felder mit Auswahllisten.
- **Trace:** UC-01, GOAL-03, Brief Kap. 7

#### REQ-015 – Zustandscode übersetzen
- **Type:** Functional | **Priorität:** Must | **Release:** 0.1 | **Rolle:** Nutzer
- **Anforderung:** Das System muss beim Erfassen eines Zustandscodes den Klartext aus der Code-Übersetzungstabelle (REQ-022) in die Zustandsbeschreibung des Geräts übernehmen.
- **Eingaben:** Zustandscode, optional Lieferant. **Ausgaben:** Klartext in der Zustandsbeschreibung; der Zustandscode bleibt am Gerät gespeichert.
- **Regeln:** Ist für den Lieferanten ein eigener Eintrag vorhanden, gilt dieser; sonst der Eintrag ohne Lieferant. Ist der Code unbekannt, zeigt das System „Zustandscode unbekannt“, übernimmt keinen Text und lässt die manuelle Eingabe der Zustandsbeschreibung zu. Enthält der Tabelleneintrag einen Vorschlag für Zustand oder Optik-Note, wird dieser vorbelegt und mit Prüfmarkierung versehen.
- **Must-Begründung:** UC-03 ist ein Brief-Use-Case der Phase 1; das Einbuchen in unter 2 Minuten (SC-01) setzt die Übersetzung voraus.
- **Trace:** UC-03, GOAL-01, SC-01

#### REQ-016 – Gerät per WI-Nr finden
- **Type:** Functional | **Priorität:** Must | **Release:** 0.1 | **Rolle:** Nutzer
- **Anforderung:** Der Nutzer kann ein Gerät über seine WI-Nr finden.
- **Eingaben:** WI-Nr oder Teil davon. **Ausgaben:** Gerät mit Modellvorlage, Modell-Inserat bzw. „nicht zugeordnet“, Bestandsstatus und Erfassungsstatus; bei keinem Treffer „Kein Gerät mit dieser WI-Nr“.
- **Must-Begründung:** UC-01 und UC-07 setzen das Auffinden per WI-Nr voraus.
- **Trace:** UC-01, UC-07, F-4d

#### REQ-017 – Gerät einem bestehenden Modell-Inserat zuordnen
- **Type:** Functional | **Priorität:** Must | **Release:** 0.1 | **Rolle:** Nutzer
- **Anforderung:** Der Nutzer kann ein nicht zugeordnetes Gerät einem bestehenden Modell-Inserat derselben Modellvorlage zuordnen.
- **Eingaben:** Gerät, Modell-Inserat (Auswahl aus den Modell-Inseraten der Modellvorlage, mit Variantenangaben und aktueller Stückzahl). **Ausgaben:** Stückzahl des Modell-Inserats um 1 erhöht; Bestandsangaben aktualisiert (REQ-091).
- **Regeln:** Ein Gerät gehört zu höchstens einem Modell-Inserat. Zugeordnet werden nur Geräte mit Bestandsstatus *verfügbar* und Erfassungsstatus *geprüft*; ein Gerät mit Prüfmarkierung wird mit „Erst Werte prüfen“ und Nennung der markierten Werte abgelehnt. Zuordnung zu einem Modell-Inserat einer anderen Modellvorlage wird abgelehnt. Ein bereits zugeordnetes Gerät wechselt nur über REQ-020 oder REQ-019. Vor der Zuordnung gilt REQ-018. Hat die Modellvorlage kein Modell-Inserat, bietet das System nur die Neuanlage an (REQ-019).
- **Must-Begründung:** Kern von UC-01 und der Owner-Entscheidung F-4c (ein Inserat pro Modell mit Stückzahl).
- **Trace:** UC-01, F-4c, GOAL-01, SC-01

#### REQ-018 – Abweichungen bei Zuordnung anzeigen
- **Type:** Functional | **Priorität:** Must | **Release:** 0.1 | **Rolle:** Nutzer
- **Anforderung:** Das System muss vor der Zuordnung eines Geräts zu einem Modell-Inserat (REQ-017, REQ-020) jede Abweichung zwischen den Variantenangaben des Geräts und den Variantenangaben des Modell-Inserats nach der Vergleichsregel in Kap. 6.0 anzeigen.
- **Ausgaben:** Liste der abweichenden Angaben mit Wert am Gerät und Wert am Modell-Inserat; bei abweichender Zustandsbeschreibung beide Texte vollständig. Der Nutzer wählt: „trotzdem zuordnen“ oder „neues Modell-Inserat anlegen“ (REQ-019).
- **Regeln:** Verglichen werden ausschließlich die Variantenangaben (Zustand, Optik-Note, Zustandsbeschreibung, Werte der Variantenmerkmale). Ohne Abweichung erfolgt die Zuordnung ohne Rückfrage. Abweichungen bei Merkmalen ohne Variantenkennzeichen, bei der Akkukapazität und bei der WI-Nr lösen keine Rückfrage aus. „Trotzdem zuordnen“ ändert die Inseratswerte nicht und wird mit Zeitpunkt und abweichenden Angaben im Änderungsprotokoll vermerkt (REQ-072).
- **Must-Begründung:** F-4c verlangt getrennte Inserate bei deutlich abweichendem Zustand; ohne Abweichungsanzeige landen Geräte unbemerkt im falschen Inserat, z. B. ein Gerät mit Display- statt Gehäuseschaden (GOAL-03).
- **Trace:** UC-01, F-4c, GOAL-03, A-15, OP-21

#### REQ-019 – Neues Modell-Inserat anlegen (auch für andere Variantenangaben)
- **Type:** Functional | **Priorität:** Must | **Release:** 0.1 | **Rolle:** Nutzer
- **Anforderung:** Der Nutzer kann aus einem Gerät ein neues Modell-Inserat anlegen, auch wenn für dieselbe Modellvorlage bereits Modell-Inserate bestehen.
- **Eingaben:** Gerät (Bestandsstatus *verfügbar*, Erfassungsstatus *geprüft*; zugeordnet oder nicht zugeordnet). Weitere Eingaben sind beim Anlegen nur nötig, wenn die WI-Nr bereits Artikelnummer eines anderen Modell-Inserats ist (dann Artikelnummer, Regeln Kap. 9.6); Lieferumfang, Artikelnummer und EAN ändert der Nutzer danach über REQ-088.
- **Ausgaben:** Modell-Inserat mit folgenden Inseratswerten: Variantenangaben und übrige inserierte Gerätewerte unverändert vom Gerät übernommen; Lieferumfang leer; Artikelnummer = WI-Nr des Geräts (A-05); EAN mit Kennzeichnung „Original“ (A-11); keine Preise, keine Fotos. Stückzahl 1 und je aktivem Kanal ein Kanal-Inhalt im Status *Entwurf*.
- **Regeln:** Bestehen für dieselbe Modellvorlage weitere Modell-Inserate, müssen sich die Variantenangaben des Geräts nach der Vergleichsregel (Kap. 6.0) von den Variantenangaben jedes dieser Modell-Inserate unterscheiden; sonst lehnt das System ab und verweist auf das Modell-Inserat mit gleichen Variantenangaben (Zuordnung über REQ-017). Ein Gerät mit Prüfmarkierung wird mit „Erst Werte prüfen“ abgelehnt. Ist das Gerät bereits einem anderen Modell-Inserat zugeordnet, wird es dort entfernt (Stückzahl −1). Ist die WI-Nr des Geräts bereits Artikelnummer eines anderen Modell-Inserats, wird das Anlegen mit „Artikelnummer bereits vergeben“ abgelehnt und der Nutzer kann eine andere Artikelnummer eingeben (Kap. 9.6).
- **Must-Begründung:** UC-01 („neue Zustandsvariante anlegen“) und F-4c; ohne Neuanlage gibt es kein Modell-Inserat und damit keinen Kanal-Inhalt.
- **Trace:** UC-01, UC-04, F-4c, A-05, A-11, A-15

#### REQ-020 – Gerät umbuchen
- **Type:** Functional | **Priorität:** Should | **Release:** 0.1 | **Rolle:** Nutzer
- **Anforderung:** Der Nutzer kann ein verfügbares Gerät von seinem Modell-Inserat einem anderen Modell-Inserat derselben Modellvorlage zuordnen.
- **Regeln:** Es gilt REQ-018. Die Stückzahl des bisherigen Modell-Inserats sinkt um 1, die des neuen steigt um 1; die Bestandsangaben beider werden aktualisiert (REQ-091). Ein verkauftes oder storniertes Gerät kann nicht umgebucht werden. Hat das bisherige Modell-Inserat danach keine zugeordneten Geräte, bleibt es mit Stückzahl 0 bestehen; gelöscht wird es nur über REQ-095. REQ-020 ergänzt die Abweichungsanzeige nach REQ-014 (Änderung einer Variantenangabe eines zugeordneten Geräts) um die Wahl „umbuchen“.
- **Trace:** UC-01, F-4c; FIND-022

#### REQ-021 – Gerät als verkauft markieren
- **Type:** Functional | **Priorität:** Must | **Release:** 0.1 | **Rolle:** Nutzer
- **Anforderung:** Der Nutzer kann ein verfügbares, einem Modell-Inserat zugeordnetes Gerät als verkauft markieren.
- **Eingaben:** Gerät (per WI-Nr), Kanal (Pflicht, aus den Kanälen), Verkaufsdatum (Pflicht, vorbelegt mit heute, nicht in der Zukunft). **Ausgaben:** Bestandsstatus *verkauft*; Stückzahl des Modell-Inserats um 1 verringert; Bestandsangaben aktualisiert (REQ-091).
- **Regeln:** Die Markierung wird im Änderungsprotokoll vermerkt (REQ-072). Ein bereits verkauftes oder storniertes Gerät kann nicht als verkauft markiert werden. Ein nicht zugeordnetes Gerät wird mit „Gerät keinem Modell-Inserat zugeordnet“ abgelehnt. Zurücknehmen regelt REQ-084.
- **Must-Begründung:** UC-07 verlangt „verkauft (manuell gepflegt)“ in Phase 1; ohne Verkaufspflege stimmt die Stückzahl nicht.
- **Trace:** UC-07, Brief Kap. 7, A-03

#### REQ-084 – Verkaufsmarkierung zurücknehmen
- **Type:** Functional | **Priorität:** Must | **Release:** 0.1 | **Rolle:** Nutzer
- **Anforderung:** Der Nutzer kann die Verkaufsmarkierung eines verkauften Geräts zurücknehmen.
- **Eingaben:** Gerät (per WI-Nr). **Ausgaben:** Bestandsstatus *verfügbar*; Verkaufskanal und Verkaufsdatum entfernt; Stückzahl des Modell-Inserats um 1 erhöht; Bestandsangaben aktualisiert (REQ-091).
- **Regeln:** Nur für Geräte mit Bestandsstatus *verkauft*; für andere Geräte lehnt das System mit „Gerät ist nicht als verkauft markiert“ ab. Das Zurücknehmen wird mit dem bisherigen Verkaufskanal und -datum im Änderungsprotokoll vermerkt (REQ-072).
- **Must-Begründung:** Eine irrtümliche Verkaufsmarkierung verringert sonst die Stückzahl dauerhaft falsch (GOAL-03); Rücknahmen und Rückgaben kommen im Handel vor.
- **Trace:** UC-07, GOAL-03, A-03

#### REQ-088 – Modell-Inserat ändern
- **Type:** Functional | **Priorität:** Must | **Release:** 0.1 | **Rolle:** Nutzer
- **Anforderung:** Der Nutzer kann die Inseratswerte eines Modell-Inserats ändern, mit Ausnahme von Preisen (REQ-032) und Fotos (REQ-042).
- **Eingaben (jeweils optional zu ändern):** Variantenangaben (Zustand, Optik-Note, Zustandsbeschreibung, Werte der Variantenmerkmale; Regeln wie REQ-014); übrige inserierte Gerätewerte (Regeln nach Merkmalsdefinition, REQ-005); Lieferumfang (Auswahl von null bis mehreren aktiven Textbausteinen der Art *Lieferumfang*, deren Geltungsbereich die Geräteart umfasst); Artikelnummer (Regeln Kap. 9.6); EAN-Kennzeichnung „Original“ oder „eigene“ und bei „eigene“ die EAN (Pflicht, Regeln Kap. 9.6).
- **Ausgaben:** Gespeicherte Inseratswerte; Kanal-Inhalte nach Kap. 6.0 neu gebildet bzw. gekennzeichnet (REQ-034 bis REQ-041, REQ-045).
- **Regeln:** Modelldaten sind am Modell-Inserat nicht änderbar (Hinweis auf REQ-010). Geänderte Variantenangaben müssen sich nach der Vergleichsregel (Kap. 6.0) weiterhin von denen jedes anderen Modell-Inserats derselben Modellvorlage unterscheiden; sonst lehnt das System ab und nennt das Modell-Inserat mit gleichen Variantenangaben. Weichen nach einer Änderung der Variantenangaben zugeordnete verfügbare Geräte vom Modell-Inserat ab, nennt das System diese Geräte mit den abweichenden Angaben und speichert erst nach Bestätigung; die Bestätigung wird protokolliert (REQ-072). Die Artikelnummer muss eindeutig bleiben. Bei EAN-Kennzeichnung „Original“ gilt die Original-EAN der Modellvorlage; eine eigene EAN wird dann nicht gespeichert. Ungültige Werte werden mit Nennung des Feldes und der Regel abgelehnt.
- **Must-Begründung:** Inseratswerte wie Zustandsbeschreibung, Lieferumfang und EAN müssen nach dem Anlegen korrigierbar sein, ohne das Modell-Inserat neu anzulegen; J-01, J-04 und J-06 sowie REQ-043 und REQ-045 setzen diese Funktion voraus (GOAL-03).
- **Trace:** UC-01, UC-04, GOAL-02, GOAL-03, F-4c, A-05, A-11, A-32

#### REQ-092 – WI-Nr eines Geräts korrigieren
- **Type:** Functional | **Priorität:** Should | **Release:** 0.1 | **Rolle:** Nutzer
- **Anforderung:** Der Nutzer kann die WI-Nr eines Geräts mit Bestandsstatus *verfügbar* oder *verkauft* korrigieren.
- **Eingaben:** Gerät, neue WI-Nr (Pflicht, Regeln Kap. 9.6). **Ausgaben:** Gerät mit neuer WI-Nr; Bestandsangabe `{WI-Nr}` aktualisiert (REQ-091).
- **Regeln:** Ist die neue WI-Nr bereits vergeben, wird die Korrektur wie in REQ-012 abgelehnt. Die Artikelnummer eines Modell-Inserats ändert sich dadurch nicht. Alte und neue WI-Nr werden protokolliert (REQ-072).
- **Trace:** F-4d, GOAL-03, UC-01

#### REQ-093 – Gerät stornieren (Fehlerfassung)
- **Type:** Functional | **Priorität:** Must | **Release:** 0.1 | **Rolle:** Nutzer
- **Anforderung:** Der Nutzer kann ein falsch erfasstes Gerät mit Bestandsstatus *verfügbar* stornieren.
- **Eingaben:** Gerät, Grund (Pflicht, Freitext 1–200 Zeichen [Vorschlag BA]). **Ausgaben:** Bestandsstatus *storniert*; Zuordnung zum Modell-Inserat aufgehoben (Stückzahl −1, Bestandsangaben aktualisiert, REQ-091); die WI-Nr ist für eine Neuerfassung wieder frei (REQ-012).
- **Regeln:** Verkaufte Geräte können nicht storniert werden (erst REQ-084). Ein Storno kann nicht zurückgenommen werden; das Gerät wird stattdessen neu erfasst. Das stornierte Gerät bleibt mit WI-Nr, Grund und Zeitpunkt nachvollziehbar (REQ-016 findet es mit Bestandsstatus *storniert*; Protokoll REQ-072). Der Korrekturweg für ein Gerät mit falscher Modellvorlage ist Storno und Neuerfassung (Kap. 14).
- **Must-Begründung:** Ohne Storno bleibt ein falsch erfasstes Gerät dauerhaft im Bestand und verfälscht Stückzahl und Bestandsangaben (GOAL-03); Geräte werden nie gelöscht (REQ-103).
- **Trace:** UC-01, GOAL-03, F-4d

#### REQ-094 – Nicht zugeordnete Geräte anzeigen
- **Type:** Functional | **Priorität:** Should | **Release:** 0.1 | **Rolle:** Nutzer
- **Anforderung:** Das System muss dem Nutzer auf Abruf alle Geräte mit Bestandsstatus *verfügbar* anzeigen, die keinem Modell-Inserat zugeordnet sind.
- **Ausgaben:** je Gerät WI-Nr, Modellvorlage, Erfassungsstatus, Erfassungsdatum; sortiert nach Erfassungsdatum, ältestes zuerst. Ohne solche Geräte: „Keine nicht zugeordneten Geräte“.
- **Trace:** UC-01, GOAL-03

#### REQ-095 – Modell-Inserate und Modellvorlagen löschen
- **Type:** Functional | **Priorität:** Should | **Release:** 0.1 | **Rolle:** Nutzer
- **Anforderung:** Der Nutzer kann ein Modell-Inserat oder eine Modellvorlage nach ausdrücklicher Bestätigung löschen.
- **Regeln:** Ein Modell-Inserat kann nur gelöscht werden, wenn ihm kein Gerät mit Bestandsstatus *verfügbar* oder *verkauft* zugeordnet ist und keiner seiner Kanal-Inhalte den Status *Veröffentlicht* hat; mit ihm werden seine Kanal-Inhalte gelöscht. Eine Modellvorlage kann nur gelöscht werden, wenn kein Gerät (in keinem Bestandsstatus) und kein Modell-Inserat auf sie verweist. Sonst lehnt das System mit Nennung des Grunds ab. Geräte löscht diese Funktion nicht; für den Datenerhalt (Geräte nie löschen, keine automatische Löschung) gilt REQ-103. Jede Löschung wird protokolliert (REQ-072).
- **Trace:** GOAL-02, GOAL-03, E-4; REQ-103

### 6.6 Code-Übersetzungstabelle und Zuordnungen je Kanal

#### REQ-022 – Code-Übersetzungstabelle pflegen
- **Type:** Functional | **Priorität:** Must | **Release:** 0.1 | **Rolle:** Nutzer
- **Anforderung:** Der Nutzer kann Einträge der Code-Übersetzungstabelle anlegen, ändern und löschen.
- **Eingaben:** Zustandscode (Pflicht, max. 20 Zeichen [Vorschlag BA], ohne Beachtung von Groß-/Kleinschreibung), Lieferant (optional, Auswahl aus den aktiven Lieferanten, REQ-099), Klartext (Pflicht, max. 500 Zeichen [Vorschlag BA]), Vorschlag Zustand (optional, Auswahlliste), Vorschlag Optik-Note (optional, 1–5).
- **Regeln:** Die Kombination aus Zustandscode und Lieferant ist eindeutig. Änderungen wirken nur auf künftig erfasste Codes; bereits gespeicherte Zustandsbeschreibungen bleiben unverändert.
- **Must-Begründung:** UC-03 („die Tabelle pflegt der Händler“) und LP-1 (Zustandscodes als Einstellung).
- **Trace:** UC-03, LP-1, Brief Kap. 7

#### REQ-099 – Lieferanten pflegen
- **Type:** Functional | **Priorität:** Must | **Release:** 0.1 | **Rolle:** Nutzer
- **Anforderung:** Der Nutzer kann Lieferanten anlegen, umbenennen und deaktivieren.
- **Eingaben:** Name (Pflicht, 1–100 Zeichen [Vorschlag BA], eindeutig ohne Beachtung von Groß-/Kleinschreibung), Status aktiv/deaktiviert. **Ausgaben:** Lieferant steht beim Erfassen eines Geräts (REQ-012) und in der Code-Übersetzungstabelle (REQ-022) zur Auswahl, wenn aktiv.
- **Regeln:** Ein deaktivierter Lieferant steht für neue Eingaben nicht zur Auswahl; gespeicherte Angaben bleiben erhalten. Ein Lieferant, auf den Geräte oder Tabelleneinträge verweisen, kann nicht gelöscht, nur deaktiviert werden. Beim Erfassen eines Geräts wählt der Nutzer den Lieferanten aus dieser Liste (A-25; ob stattdessen Freitext gewünscht ist, klärt OP-26).
- **Must-Begründung:** Lieferantenspezifische Zustandscodes (UC-03, A-14) setzen gepflegte Lieferanten voraus; LP-1 verlangt sie als Einstellung.
- **Trace:** UC-03, LP-1, A-14, A-25, OP-26

#### REQ-023 – Zustandszuordnung je Kanal pflegen
- **Type:** Functional | **Priorität:** Must | **Release:** 0.1 | **Rolle:** Nutzer
- **Anforderung:** Der Nutzer kann je Kanal festlegen, welche Zustandsbezeichnung des Kanals für eine Kombination aus Zustand und Optik-Note ausgegeben wird.
- **Eingaben:** Kanal, Zustand, Optik-Note (einzelne Note oder „alle Noten“), Zustandsbezeichnung des Kanals (Pflicht, Text, max. 100 Zeichen [Vorschlag BA]), optional Zusatzangabe des Kanals (Text, max. 100 Zeichen [Vorschlag BA], mit Platzhaltern nach Kap. 9.7, z. B. Shop: `Optisch {Optik-Note}`).
- **Regeln:** Je Kanal, Zustand und Optik-Note ist höchstens ein Eintrag gültig; ein Eintrag für eine einzelne Note hat Vorrang vor „alle Noten“. In der Zusatzangabe sind nur die Platzhalter zulässig, die Kap. 9.7 für Zusatzangaben freigibt; ein anderer oder unbekannter Platzhalter wird beim Speichern mit Nennung abgelehnt. Leere Platzhalter in der Zusatzangabe werden durch nichts ersetzt.
- **Must-Begründung:** Belegt unterschiedliche Bezeichnungen je Kanal (Brief Kap. 2b); eBay erlaubt „Refurbished“ nur eingeschränkt (Brief Kap. 3, 9).
- **Trace:** UC-04, GOAL-03, LP-1, Brief Kap. 7

#### REQ-024 – Kategoriezuordnung je Geräteart und Kanal pflegen
- **Type:** Functional | **Priorität:** Must | **Release:** 0.1 | **Rolle:** Nutzer
- **Anforderung:** Der Nutzer kann je Geräteart und Kanal eine Kategorie des Kanals als Vorschlag festlegen.
- **Eingaben:** Geräteart, Kanal, Kategoriebezeichnung bzw. Kategoriepfad des Kanals (Text, max. 255 Zeichen [Vorschlag BA]), optional Kategorie-Kennung des Kanals.
- **Regeln:** Je Geräteart und Kanal genau ein Vorschlag. Die Kategorielisten der Kanäle werden in Phase 1 von Hand gepflegt (keine Abfrage bei den Kanälen).
- **Must-Begründung:** UC-04 (Kategorievorschlag); belegter Fehler „Mini-PC in Laptops & Notebooks“ (GOAL-03); LP-1.
- **Trace:** UC-04, GOAL-03, LP-1, LP-4, SC-07

#### REQ-025 – Merkmalszuordnung je Kanal pflegen
- **Type:** Functional | **Priorität:** Must | **Release:** 0.1 | **Rolle:** Nutzer
- **Anforderung:** Der Nutzer kann je Kanal und Geräteart festlegen, welche Quellen unter welcher Feldbezeichnung des Kanals und in welcher Reihenfolge als Merkmalsfelder ausgegeben werden.
- **Eingaben:** Kanal, Geräteart, Liste aus (Feldbezeichnung des Kanals (Pflicht, max. 100 Zeichen [Vorschlag BA]); Quelle (Pflicht, genau eine Quelle aus der abschließenden Liste in Kap. 9.11); Reihenfolge; Pflichtfeld des Kanals ja/nein; optional Wertzuordnung von internem Wert zu Kanal-Wert).
- **Regeln:** Andere Quellen als die in Kap. 9.11 sind nicht zulässig. Die Reihenfolge der Merkmalsfelder bestimmt auch die Reihenfolge im Kopier-Assistenten (REQ-047).
- **Must-Begründung:** Brief Kap. 2b: dieselben Inhalte erscheinen je Kanal in eigenen Merkmalsfeldern; LP-2 verlangt kanaleigene Ausgabe.
- **Trace:** UC-04, UC-05, LP-1, LP-2

### 6.7 Textbausteine, GPSR-Herstellerangaben, Händlermarke

#### REQ-026 – Textbausteine pflegen
- **Type:** Functional | **Priorität:** Must | **Release:** 0.1 | **Rolle:** Nutzer
- **Anforderung:** Der Nutzer kann Textbausteine anlegen, ändern und deaktivieren.
- **Eingaben:** Name (Pflicht, eindeutig, max. 100 Zeichen [Vorschlag BA]), Art (Pflicht: *Akku-Hinweis*, *Lieferumfang*, *Abholung/Kontakt*, *Rechtliches*, *Sonstiges*), Text (Pflicht, max. 5.000 Zeichen [Vorschlag BA]), Platzhalter aus der Liste in Kap. 9.7, Geltungsbereich (alle oder ausgewählte Gerätearten; alle oder ausgewählte Kanäle), bei den Arten *Rechtliches* und *Akku-Hinweis* der Prüfstatus (REQ-054).
- **Regeln:** Ein unbekannter Platzhalter wird beim Speichern mit Nennung abgelehnt. Ein deaktivierter Textbaustein wird in neu erzeugte Kanal-Inhalte nicht mehr übernommen.
- **Must-Begründung:** UC-08, GOAL-04; der Akku-Hinweis steht heute kopiert in 19 von 25 Blättern.
- **Trace:** UC-08, GOAL-04, LP-1, Brief Kap. 7

#### REQ-027 – GPSR-Herstellerangaben je Hersteller pflegen
- **Type:** Functional | **Priorität:** Must | **Release:** 0.1 | **Rolle:** Nutzer
- **Anforderung:** Der Nutzer kann je Hersteller GPSR-Herstellerangaben pflegen.
- **Eingaben:** Herstellername (Pflicht; rechtlicher Name für die GPSR-Angaben, kann vom Namen des Herstellers nach REQ-100 abweichen), Postanschrift (Pflicht: Straße und Hausnummer, Postleitzahl, Ort, Land), elektronische Kontaktadresse (Pflicht: E-Mail-Adresse oder Internetadresse), verantwortliche Person in der EU (optional: Name, Postanschrift, elektronische Kontaktadresse).
- **Regeln:** Ein Hersteller gilt als „GPSR vollständig“, wenn alle Pflichtangaben vorliegen. Die endgültige Feldliste wird vor Pilotbetrieb rechtlich bestätigt (OP-14).
- **Must-Begründung:** GOAL-04 und Brief Kap. 3 (GPSR-Angaben auch bei Gebrauchtware, Abmahnrisiko).
- **Trace:** UC-08, GOAL-04, LP-1

#### REQ-028 – Händlerangaben und Händlermarke pflegen
- **Type:** Functional | **Priorität:** Must | **Release:** 0.1 | **Rolle:** Nutzer
- **Anforderung:** Der Nutzer kann Name der Händlermarke, Logo und Kontaktangaben des Händlers pflegen.
- **Eingaben:** Name der Händlermarke (Pflicht, max. 100 Zeichen [Vorschlag BA]), Logo (Bilddatei im Format PNG oder JPEG, max. 5 MB [Vorschlag BA]; Pflicht für das Datenblatt), Kontaktangaben (optional, Freitext max. 500 Zeichen [Vorschlag BA], als Platzhalter `{Händler-Kontakt}` verfügbar).
- **Regeln:** Eine Logo-Datei in einem anderen Format oder größer als 5 MB wird mit Nennung der zulässigen Formate und der Höchstgröße abgelehnt. Ein neues Logo ersetzt das bisherige. Die Druckqualität des Logos prüft das System nicht; sie stellt der Pilotkunde sicher (OP-13). Die Auslieferung enthält keine Händlermarke als feste Vorgabe (REQ-074); notebookers.de wird als Einstellung angelegt.
- **Must-Begründung:** Brief Kap. 7: Datenblatt mit aktueller Marke notebookers.de (F-7c); LP-1: Logo/Marke als Einstellung.
- **Trace:** UC-06, F-7c, LP-1

### 6.8 Kanäle und Vorlagen (LP-2)

#### REQ-029 – Kanäle verwalten
- **Type:** Functional | **Priorität:** Must | **Release:** 0.1 | **Rolle:** Nutzer
- **Anforderung:** Der Nutzer kann jeden Kanal aktivieren und deaktivieren und je Kanal dessen Einstellungen pflegen: Höchstlänge des Titels, Beschreibungsvorlage (REQ-031), Merkmalszuordnung (REQ-025), Zustandszuordnung (REQ-023), Kategoriezuordnung (REQ-024), Zulässigkeit des Zusatzes „Verhandlungsbasis“ (REQ-032), Preisregel (REQ-085), Feldreihenfolge des Kopier-Assistenten.
- **Regeln:** Titel-Höchstlänge: ganze Zahl 20–500 [Vorschlag BA]. Für einen deaktivierten Kanal werden keine neuen Kanal-Inhalte erzeugt; bestehende Kanal-Inhalte bleiben lesbar. Änderungen an den Einstellungen eines Kanals verändern keinen Kanal-Inhalt eines anderen Kanals. Auslieferung mit den Kanälen Shop, Kleinanzeigen und eBay, alle aktiv.
- **Must-Begründung:** LP-2 verlangt eigenständige Kanal-Bausteine; der Pilotkunde nutzt drei Kanäle mit eigenen Regeln.
- **Trace:** LP-2, UC-04, F-7b

#### REQ-030 – Titelmuster je Geräteart pflegen
- **Type:** Functional | **Priorität:** Must | **Release:** 0.1 | **Rolle:** Nutzer
- **Anforderung:** Der Nutzer kann je Geräteart ein Titelmuster festlegen, optional mit abweichendem Titelmuster je Kanal.
- **Eingaben:** Folge von Titelbestandteilen. Jeder Bestandteil ist entweder (a) ein Platzhalter (für Titelmuster zulässige Platzhalter nach Kap. 9.7) mit optionalem Präfix und optionalem Suffix (jeweils fester Text, z. B. Präfix „ (“ und Suffix „)“ oder Präfix „, “ und Suffix „ RAM“) oder (b) fester Text ohne Platzhalter. Je Bestandteil eine Kürzungspriorität (ganze Zahl ≥ 1; 1 = entfällt nie durch Kürzung).
- **Regeln:** Der Titel ist die Aneinanderreihung von Präfix, Wert und Suffix aller Bestandteile in der festgelegten Reihenfolge. Ist der Platzhalter eines Bestandteils leer, entfällt der ganze Bestandteil einschließlich Präfix und Suffix. Ein Titelmuster muss mindestens den Platzhalter Hersteller und den Platzhalter Modellbezeichnung enthalten, beide mit Kürzungspriorität 1. Bestandsplatzhalter (`{WI-Nr}`, `{Stückzahl}`, `{Akkukapazität}`) sind im Titelmuster nicht zulässig; ein Titelmuster mit einem solchen oder einem unbekannten Platzhalter wird beim Speichern mit Nennung abgelehnt.
- **Must-Begründung:** Brief Kap. 2b (festes Titelmuster, automatisch erzeugbar), LP-1 und LP-4 (Titelmuster als Einstellung je Geräteart).
- **Trace:** UC-04, LP-1, LP-4, SC-07

#### REQ-031 – Beschreibungsvorlage je Kanal pflegen
- **Type:** Functional | **Priorität:** Must | **Release:** 0.1 | **Rolle:** Nutzer
- **Anforderung:** Der Nutzer kann je Kanal eine Beschreibungsvorlage aus Abschnitten festlegen.
- **Eingaben:** Folge von Abschnitten; jeder Abschnitt hat eine optionale Überschrift und einen Inhalt aus folgenden Elementen: fester Text, Platzhalter (Kap. 9.7), ein bestimmter Textbaustein, alle gültigen Textbausteine einer Art (z. B. alle *Rechtliches*-Bausteine, deren Geltungsbereich Geräteart und Kanal umfasst); optional Geltung nur für bestimmte Gerätearten.
- **Regeln:** Eine Zeile, die mindestens einen Platzhalter enthält und deren Platzhalter alle leer sind, entfällt mitsamt ihrem festen Text. Ein Abschnitt, der mindestens einen Platzhalter oder Textbaustein enthält und dessen Platzhalter und Textbausteine alle leer sind, entfällt mitsamt Überschrift. Ein unbekannter Platzhalter wird beim Speichern mit Nennung abgelehnt.
- **Must-Begründung:** Brief Kap. 2b: derselbe Inhalt je Kanal anders verpackt (Shop: „Zustand“, „Lieferumfang“, „Artikeldetails“; Kleinanzeigen: Freitext mit WI-Nr, ProduktNr., Abholzeiten, Rechtsblock).
- **Trace:** UC-04, LP-1, LP-2

### 6.9 Inserat je Kanal erzeugen und freigeben

#### REQ-032 – Preis je Kanal erfassen
- **Type:** Functional | **Priorität:** Must | **Release:** 0.1 | **Rolle:** Nutzer
- **Anforderung:** Der Nutzer kann für ein Modell-Inserat je aktivem Kanal einen eigenen Preis erfassen.
- **Eingaben:** Preis in Euro (Dezimalzahl > 0, höchstens zwei Nachkommastellen); je Kanal optional der Zusatz „Verhandlungsbasis“, wenn die Einstellung des Kanals ihn zulässt (REQ-029; Startbelegung: nur Kleinanzeigen).
- **Regeln:** Ein Kanal-Inhalt ohne Preis kann nicht freigegeben werden (REQ-044). Das System ermittelt keine Preise (Preisfindung ist Out of Scope).
- **Must-Begründung:** Brief Kap. 2b und 7: „Preis je Kanal“ ist Pflicht.
- **Trace:** UC-04, Brief Kap. 7

#### REQ-033 – Preisvorschlag nach Kanal-Preisregel
- **Type:** Functional | **Priorität:** Should | **Release:** 0.1 | **Rolle:** Nutzer (empfängt den Vorschlag)
- **Anforderung:** Das System muss, wenn für einen Kanal eine Preisregel eingestellt ist (REQ-085), den Preis dieses Kanals aus dem Preis des Bezugskanals vorschlagen.
- **Ausgaben:** vorbelegter, änderbarer Preis des Kanals = Preis des Bezugskanals plus bzw. minus Auf- oder Abschlag.
- **Regeln:** Ein vom Nutzer geänderter Preis wird nicht mehr durch die Regel überschrieben. Ergibt die Regel einen Preis ≤ 0, wird kein Vorschlag gemacht.
- **Trace:** LP-1 (Preisregeln als Einstellung), A-04, OP-09

#### REQ-085 – Preisregel je Kanal pflegen
- **Type:** Functional | **Priorität:** Should | **Release:** 0.1 | **Rolle:** Nutzer
- **Anforderung:** Der Nutzer kann je Kanal eine Preisregel festlegen oder entfernen.
- **Eingaben:** Kanal; Bezugskanal (Pflicht, ein anderer aktiver Kanal); Auf- oder Abschlag in Euro (Pflicht, Dezimalzahl mit höchstens zwei Nachkommastellen, Vorzeichen bestimmt Auf- bzw. Abschlag). **Ausgaben:** gespeicherte Preisregel, wirksam für künftige Preiserfassungen (REQ-033).
- **Regeln:** Ein Kanal kann nicht sein eigener Bezugskanal sein; Regeln dürfen keinen Kreis bilden (z. B. Shop ← Kleinanzeigen und Kleinanzeigen ← Shop); beides wird mit Nennung abgelehnt. Bereits erfasste Preise bleiben unverändert.
- **Trace:** LP-1 (Preisregeln als Einstellung), A-04, OP-09

#### REQ-034 – Titel erzeugen
- **Type:** Functional | **Priorität:** Must | **Release:** 0.1 | **Rolle:** Nutzer (Auslöser), System
- **Anforderung:** Das System muss für jeden Kanal-Inhalt den Titel nach dem Titelmuster der Geräteart (bzw. dem kanaleigenen Titelmuster) aus den Modelldaten und Inseratswerten des Modell-Inserats bilden.
- **Regeln:** Ein Bestandteil mit leerem Platzhalter entfällt einschließlich Präfix und Suffix (REQ-030). Der Titel wird bei jeder Änderung einer zugrunde liegenden Inhaltsangabe nach Kap. 6.0 neu gebildet (im Status *Entwurf* und im Änderungsentwurf), sofern er nicht manuell angepasst ist (REQ-043).
- **Must-Begründung:** UC-04; Titel je Kanal sind heute Handarbeit × 3 (Brief Kap. 2c, „hoch“).
- **Trace:** UC-04, GOAL-01, GOAL-02, GOAL-03

#### REQ-035 – Titel je Kanal kürzen
- **Type:** Functional | **Priorität:** Must | **Release:** 0.1 | **Rolle:** System
- **Anforderung:** Das System muss einen Titel, der die Höchstlänge des Kanals überschreitet, durch Weglassen ganzer Titelbestandteile in absteigender Kürzungspriorität (höchste Zahl zuerst) kürzen, bis er die Höchstlänge einhält.
- **Regeln:** Bestandteile werden nie innerhalb eines Worts abgeschnitten. Überschreiten die Bestandteile mit Kürzungspriorität 1 allein die Höchstlänge, wird am letzten Wortende vor der Höchstlänge gekürzt und der Kanal-Inhalt mit dem Hinweis „Titel gekürzt, bitte prüfen“ versehen. Startwerte der Höchstlängen: Kleinanzeigen 65 Zeichen [Beleg], eBay 80 Zeichen und Shop 128 Zeichen [Annahme A-17]. Kürzen bedeutet: Der ganze Bestandteil entfällt einschließlich Präfix und Suffix.
- **Must-Begründung:** Brief Kap. 7: „Titel nach Muster mit sinnvoller Kürzung je Kanal“; heute wird bei Kleinanzeigen hart abgeschnitten („…512G“).
- **Trace:** UC-04, GOAL-03, Brief Kap. 2b

#### REQ-036 – Beschreibung erzeugen
- **Type:** Functional | **Priorität:** Must | **Release:** 0.1 | **Rolle:** System
- **Anforderung:** Das System muss für jeden Kanal-Inhalt die Beschreibung nach der Beschreibungsvorlage des Kanals aus den Modelldaten, Inseratswerten, Bestandsangaben und den gültigen Textbausteinen bilden.
- **Regeln:** Es werden nur aktive Textbausteine übernommen, deren Geltungsbereich Geräteart und Kanal umfasst. Für den Platzhalter `{Akkukapazität}` gilt A-16 einschließlich der Sonderfälle (Geräte mit „nicht ermittelbar“, Geräte ohne Akku; Kap. 9.7). Bestandsangaben werden nach REQ-091 stets aktuell ausgegeben. Neubildung bei Änderungen nach Kap. 6.0 und REQ-043.
- **Must-Begründung:** UC-04, GOAL-02.
- **Trace:** UC-04, GOAL-02, GOAL-04; A-16 (FIND-024)

#### REQ-037 – Merkmalsfelder je Kanal erzeugen
- **Type:** Functional | **Priorität:** Must | **Release:** 0.1 | **Rolle:** System
- **Anforderung:** Das System muss für jeden Kanal-Inhalt die Merkmalsfelder nach der Merkmalszuordnung des Kanals (REQ-025) mit den Werten der jeweiligen Quelle (Kap. 9.11) füllen.
- **Regeln:** Leere Merkmale werden im Kanal-Inhalt als leeres Feld ausgegeben; im Kopier-Assistenten erscheinen sie nicht (REQ-047). Änderung der mit v0.3 freigegebenen Regel in v0.3.2: bisher im Kopier-Assistenten als „leer“ gekennzeichnet, jetzt nicht mehr angezeigt; Quelle: Design-Annahme an MAR-126, vom Product Owner bestätigt; Bestätigung durch den Owner mit der Freigabe (Kennzeichnung berichtigt in v0.3.3). Ist für einen Wert eine Wertzuordnung hinterlegt, wird der Kanal-Wert ausgegeben.
- **Must-Begründung:** UC-04 und UC-05 (Kleinanzeigen-Merkmale), Brief Kap. 2b.
- **Trace:** UC-04, UC-05, GOAL-02

#### REQ-038 – Kategorievorschlag je Kanal
- **Type:** Functional | **Priorität:** Must | **Release:** 0.1 | **Rolle:** System (Ergebnis sieht der Nutzer)
- **Anforderung:** Das System muss für jeden Kanal-Inhalt die Kategorie aus der Kategoriezuordnung von Geräteart und Kanal vorschlagen.
- **Regeln:** Fehlt eine Kategoriezuordnung, bleibt die Kategorie leer und der Kanal-Inhalt zeigt „Kategorie fehlt“. Ohne Kategorie keine Freigabe (REQ-044). Eine vom Nutzer überschriebene Kategorie (REQ-086) wird durch spätere Änderungen der Kategoriezuordnung nicht ersetzt.
- **Must-Begründung:** UC-04; belegte Fehlkategorie (GOAL-03).
- **Trace:** UC-04, GOAL-03

#### REQ-086 – Kategorie je Kanal-Inhalt überschreiben
- **Type:** Functional | **Priorität:** Must | **Release:** 0.1 | **Rolle:** Nutzer
- **Anforderung:** Der Nutzer kann die Kategorie eines Kanal-Inhalts überschreiben.
- **Eingaben:** Kategoriebezeichnung bzw. -pfad des Kanals (Text, 1–255 Zeichen [Vorschlag BA]). **Ausgaben:** Kanal-Inhalt mit der eingegebenen Kategorie, gekennzeichnet als „Kategorie manuell“.
- **Regeln:** Die Änderung wirkt nur auf diesen Kanal-Inhalt. Der Nutzer kann die manuelle Kategorie verwerfen; dann gilt wieder der Vorschlag nach REQ-038. Das Überschreiben ist eine Änderung einer Inhaltsangabe und wirkt nach Kap. 6.0: im Status *Entwurf* direkt; bei *Freigegeben* Rückfall auf *Entwurf*; bei *Veröffentlicht* und *Beendet* im Änderungsentwurf, der freigegebene Stand bleibt bis REQ-089 maßgeblich.
- **Must-Begründung:** Der Brief verlangt einen Kategorie**vorschlag** (UC-04); Sonderfälle wie Defektware brauchen eine abweichende Kategorie, sonst ist das Inserat falsch einsortiert (GOAL-03).
- **Trace:** UC-04, GOAL-03

#### REQ-039 – Zustandsbezeichnung je Kanal
- **Type:** Functional | **Priorität:** Must | **Release:** 0.1 | **Rolle:** System
- **Anforderung:** Das System muss für jeden Kanal-Inhalt die Zustandsbezeichnung und ggf. die Zusatzangabe aus der Zustandszuordnung des Kanals für Zustand und Optik-Note des Modell-Inserats ausgeben.
- **Regeln:** Fehlt ein passender Eintrag, bleibt die Zustandsbezeichnung leer und der Kanal-Inhalt zeigt „Zustandszuordnung fehlt“. Ohne Zustandsbezeichnung keine Freigabe (REQ-044).
- **Must-Begründung:** Brief Kap. 7 (Zuordnungstabelle der Zustandsbezeichnungen je Kanal), GOAL-03.
- **Trace:** UC-04, GOAL-03

#### REQ-040 – Einheitliche Kennungen in allen Ausgaben
- **Type:** Functional | **Priorität:** Must | **Release:** 0.1 | **Rolle:** System
- **Anforderung:** Das System muss Herstellernummer, EAN, Artikelnummer und WI-Nr in Titel, Beschreibung, Merkmalsfeldern, GPSR-Angaben aller Kanal-Inhalte und im Datenblatt jeweils aus genau einer gespeicherten Angabe ausgeben.
- **Regeln:** Maßgebliche Angabe ist: Herstellernummer – die der Modellvorlage; EAN – die EAN des Modell-Inserats (bei Kennzeichnung „Original“ die Original-EAN der Modellvorlage, bei „eigene“ die am Modell-Inserat erfasste EAN), im Datenblatt die EAN des Modell-Inserats, dem das Gerät zugeordnet ist; Artikelnummer – die des Modell-Inserats; WI-Nr – in Kanal-Inhalten die Bestandsangabe `{WI-Nr}` (REQ-091), im Datenblatt die WI-Nr des Geräts. Ist die Herstellernummer „unbekannt“, wird sie in keinem Kanal-Inhalt und keinem Datenblatt ausgegeben; Platzhalter dafür bleiben leer.
- **Must-Begründung:** Belegter Fehler: zwei unterschiedliche Produktnummern auf derselben Seite (GOAL-03, SC-03).
- **Trace:** GOAL-03, SC-03, GOAL-02

#### REQ-041 – GPSR-Angaben im Kanal-Inhalt
- **Type:** Functional | **Priorität:** Must | **Release:** 0.1 | **Rolle:** System
- **Anforderung:** Das System muss in jeden Kanal-Inhalt die GPSR-Herstellerangaben des Herstellers des Modell-Inserats und die Produktidentifikation (A-26) übernehmen.
- **Regeln:** Ist der Hersteller nicht „GPSR vollständig“ (REQ-027), zeigt der Kanal-Inhalt „GPSR-Herstellerangaben fehlen“; Freigabe nicht möglich (REQ-044, A-20).
- **Must-Begründung:** GOAL-04; Kleinanzeigen hat eigene GPSR-Felder, die der Pilotkunde bereits füllt (Brief Kap. 2b).
- **Trace:** GOAL-04, UC-04, UC-05, UC-08

#### REQ-042 – Fotos dem Modell-Inserat zuordnen
- **Type:** Functional | **Priorität:** Must | **Release:** 0.1 | **Rolle:** Nutzer
- **Anforderung:** Der Nutzer kann einem Modell-Inserat Fotos hinzufügen, entfernen und ihre Reihenfolge festlegen.
- **Eingaben:** Bilddateien in den Formaten JPEG oder PNG, je Datei max. 20 MB [Vorschlag BA], max. 20 Fotos je Modell-Inserat [Vorschlag BA]. **Ausgaben:** Fotos in festgelegter Reihenfolge, für alle Kanal-Inhalte des Modell-Inserats gleich (Brief Kap. 2b: gleiche Fotos je Kanal).
- **Regeln:** Andere Dateiformate und größere Dateien werden mit Nennung des Grunds abgelehnt. Das System bearbeitet Fotos nicht (Out of Scope).
- **Must-Begründung:** Brief Kap. 7: „Fotos dem Inserat zuordnen“ im Kopier-Assistenten.
- **Trace:** UC-05, Brief Kap. 7, A-06

#### REQ-043 – Kanal-Inhalt manuell anpassen
- **Type:** Functional | **Priorität:** Should | **Release:** 0.1 | **Rolle:** Nutzer
- **Anforderung:** Der Nutzer kann Titel und Beschreibung eines Kanal-Inhalts manuell ändern.
- **Regeln:** Ein manuell geänderter Titel bzw. eine manuell geänderte Beschreibung wird als „manuell angepasst“ gekennzeichnet und bei Änderungen von Inhaltsangaben (auch durch Textbausteine, REQ-053) nicht automatisch neu gebildet; stattdessen zeigt das System „Daten geändert, manuell angepassten Text prüfen“, sobald sich der automatisch gebildete Text ändert, der der Anpassung zugrunde liegt. Ändert sich ein Textbaustein oder GPSR-Herstellerangaben (REQ-053), bleiben manuell angepasste Titel und Beschreibungen unverändert und erhalten diesen Hinweis; das System meldet sie nach dem Speichern in einer eigenen Gruppe „manuell angepasst, zur Prüfung“ zusätzlich zu den Gruppen aus REQ-053. Eine Änderung des automatisch gebildeten Texts unter einer manuellen Anpassung geht in den Kanal-Inhalt ein (REQ-045, Kap. 6.0). Der Nutzer kann die manuelle Anpassung verwerfen; dann wird der Text neu gebildet. Bestandsplatzhalter (`{WI-Nr}`, `{Stückzahl}`, `{Akkukapazität}`) bleiben in einer manuell angepassten Beschreibung als Platzhalter erhalten und werden weiter aktuell ausgegeben (REQ-091). Für einen manuell geänderten Titel gilt die Höchstlänge des Kanals; längere Eingaben werden abgelehnt. Eine manuelle Anpassung bleibt über Freigaben hinweg erhalten, bis der Nutzer sie verwirft. Die Anpassung ist eine Änderung einer Inhaltsangabe und wirkt nach Kap. 6.0: im Status *Entwurf* direkt; bei *Freigegeben* Rückfall auf *Entwurf*; bei *Veröffentlicht* und *Beendet* im Änderungsentwurf.
- **Trace:** UC-04 („Der Mensch prüft und gibt frei“); FIND-022

#### REQ-044 – Kanal-Inhalt freigeben
- **Type:** Functional | **Priorität:** Must | **Release:** 0.1 | **Rolle:** Nutzer
- **Anforderung:** Der Nutzer kann einen Kanal-Inhalt im Status *Entwurf* freigeben.
- **Regeln:** Die Freigabe wird abgelehnt, solange mindestens eine der folgenden **Freigabebedingungen** verletzt ist, und jede verletzte Bedingung wird benannt: Preis vorhanden (REQ-032); Kategorie vorhanden (REQ-038, REQ-086); Zustandsbezeichnung vorhanden (REQ-039); Hersteller „GPSR vollständig“ (REQ-041); Titel nicht länger als die Höchstlänge des Kanals; kein in der Merkmalszuordnung als Pflichtfeld des Kanals gekennzeichnetes Merkmalsfeld leer. Geräte mit Prüfmarkierung können einem Modell-Inserat nicht zugeordnet sein (REQ-017, REQ-019) und sind daher keine Freigabebedingung. Enthält der Kanal-Inhalt einen Textbaustein mit Prüfstatus *rechtlich ungeprüft*, gilt zusätzlich REQ-087. Bei erfolgreicher Freigabe speichert das System den freigegebenen Stand, Status *Freigegeben* und Zeitpunkt (kein Name, E-4) und entfernt eine Kennzeichnung „geändert seit Freigabe“.
- **Must-Begründung:** Brief Kap. 7 und 9: Freigabe jedes Inserats durch den Menschen, weil der Händler für die Richtigkeit verantwortlich bleibt.
- **Trace:** UC-04, GOAL-03, Brief Kap. 9

#### REQ-045 – Änderung von Inhaltsangaben nach Freigabe kennzeichnen
- **Type:** Functional | **Priorität:** Must | **Release:** 0.1 | **Rolle:** System (Ergebnis sieht der Nutzer)
- **Anforderung:** Das System muss einen Kanal-Inhalt im Status *Freigegeben*, *Veröffentlicht* oder *Beendet* als „geändert seit Freigabe“ kennzeichnen, sobald eine Änderung einer Inhaltsangabe in diesen Kanal-Inhalt eingeht.
- **Regeln:** Eine Änderung geht ein, wenn der neu gebildete Stand vom freigegebenen Stand abweicht (Bestandsangaben ausgenommen); bei manuell angepassten Texten gilt zusätzlich REQ-043. Änderungen von Bestandsangaben lösen nie eine Kennzeichnung aus (REQ-091). Wirkung je Status (Kap. 6.0): *Freigegeben* → Status *Entwurf* mit Kennzeichnung; *Veröffentlicht* und *Beendet* → Status bleibt, es entsteht ein Änderungsentwurf; Kopier-Assistent und Inserat-Übersicht zeigen weiter den freigegebenen Stand, bis der Änderungsentwurf nach REQ-089 freigegeben ist. Ein gekennzeichneter Kanal-Inhalt zeigt den freigegebenen und den neuen Stand mit den geänderten Angaben. Weitere Änderungen fließen in denselben Änderungsentwurf ein.
- **Must-Begründung:** Ohne Kennzeichnung bleiben veraltete Angaben unbemerkt auf den Kanälen (GOAL-03); ohne Änderungsentwurf gelangte ein ungeprüfter Stand über den Kopier-Assistenten auf den Kanal (Brief Kap. 9).
- **Trace:** GOAL-03, GOAL-04, SC-04, Brief Kap. 9

#### REQ-046 – Veröffentlichungsstatus je Kanal pflegen
- **Type:** Functional | **Priorität:** Must | **Release:** 0.1 | **Rolle:** Nutzer
- **Anforderung:** Der Nutzer kann den Kanal-Status eines Kanal-Inhalts entlang der Übergänge in Kap. 9.4 auf *Veröffentlicht* oder *Beendet* setzen.
- **Eingaben:** bei *Veröffentlicht* optional die Inseratsnummer oder Internetadresse des Inserats auf dem Kanal (max. 500 Zeichen [Vorschlag BA]) und das Veröffentlichungsdatum (Pflicht, vorbelegt mit heute, nicht in der Zukunft). **Ausgaben:** Status in der Inserat-Übersicht.
- **Regeln:** Zulässig sind *Freigegeben* → *Veröffentlicht*, *Veröffentlicht* → *Beendet* und *Beendet* → *Veröffentlicht*. Ein Kanal-Inhalt im Status *Entwurf* kann nicht als *Veröffentlicht* gekennzeichnet werden. *Beendet* → *Veröffentlicht* wird abgelehnt, solange die Kennzeichnung „geändert seit Freigabe“ besteht („Erst Änderung freigeben“, REQ-089). Beim Übergang *Veröffentlicht* → *Beendet* entfallen die Kennzeichnungen „Bestand auf Kanal anpassen“ und „Änderung auf Kanal übertragen“, weil auf dem beendeten Inserat nichts mehr anzupassen ist; eine Abgleich-Bestätigung (REQ-090) ist dafür nicht nötig. „Geändert seit Freigabe“ und ein bestehender Änderungsentwurf bleiben erhalten [Vorschlag BA]. Im Status *Beendet* setzt das System keine dieser beiden Kennzeichnungen (Kap. 6.0, REQ-089). Beim Übergang *Freigegeben* → *Veröffentlicht* und beim Übergang *Beendet* → *Veröffentlicht* gilt der freigegebene Stand mit den aktuellen Bestandsangaben als auf den Kanal übertragen; der Kanal-Inhalt trägt danach weder „Bestand auf Kanal anpassen“ noch „Änderung auf Kanal übertragen“.
- **Must-Begründung:** UC-07 verlangt je Inserat die Kanäle; ohne Status ist nicht erkennbar, wo ein Modell-Inserat aktiv ist.
- **Trace:** UC-07, Brief Kap. 7; FIND-020

#### REQ-089 – Änderungsentwurf freigeben
- **Type:** Functional | **Priorität:** Must | **Release:** 0.1 | **Rolle:** Nutzer
- **Anforderung:** Der Nutzer kann den Änderungsentwurf eines Kanal-Inhalts im Status *Veröffentlicht* oder *Beendet* freigeben.
- **Eingaben:** Kanal-Inhalt mit Kennzeichnung „geändert seit Freigabe“. **Ausgaben:** Änderungsentwurf wird zum freigegebenen Stand; Zeitpunkt gespeichert; Kennzeichnung „geändert seit Freigabe“ entfällt; der Kanal-Status bleibt unverändert. Bei *Veröffentlicht* setzt das System die Kennzeichnung „Änderung auf Kanal übertragen“.
- **Regeln:** Es gelten dieselben Freigabebedingungen wie in REQ-044 und ggf. REQ-087; bei Verletzung wird die Freigabe mit Nennung abgelehnt und der bisher freigegebene Stand bleibt maßgeblich. Ab der Freigabe zeigt der Kopier-Assistent den neuen freigegebenen Stand (REQ-047).
- **Must-Begründung:** Ohne erneute Freigabe könnte ein veröffentlichtes Inserat nach einer Änderung nie wieder korrekt übertragen werden; Brief Kap. 9 verlangt die Freigabe jedes Inhalts durch den Menschen.
- **Trace:** UC-04, GOAL-03, Brief Kap. 9

#### REQ-090 – Abgleich mit dem Kanal bestätigen
- **Type:** Functional | **Priorität:** Must | **Release:** 0.1 | **Rolle:** Nutzer
- **Anforderung:** Der Nutzer kann für einen Kanal-Inhalt im Status *Veröffentlicht* bestätigen, dass das Inserat auf dem Kanal dem freigegebenen Stand und den aktuellen Bestandsangaben entspricht.
- **Eingaben:** Kanal-Inhalt mit Kennzeichnung „Änderung auf Kanal übertragen“ oder „Bestand auf Kanal anpassen“. **Ausgaben:** beide Kennzeichnungen entfernt; Zeitpunkt des Abgleichs gespeichert und in der Inserat-Übersicht angezeigt.
- **Regeln:** Besteht keine der beiden Kennzeichnungen, ist keine Bestätigung nötig (Hinweis „Kanal ist abgeglichen“). Eine bestehende Kennzeichnung „geändert seit Freigabe“ bleibt unberührt, weil deren Änderungsentwurf noch nicht freigegeben ist. Die Bestätigung wird protokolliert (REQ-072).
- **Must-Begründung:** Phase 1 überträgt nur manuell (F-3); ohne Bestätigung bliebe offen, ob Änderungen und Bestand auf dem Kanal angekommen sind (GOAL-03, UC-07). Ob REQ-090 Must bleibt, vereinfacht wird oder entfällt, ist offen (OP-30); ohne REQ-090 ließen sich die beiden Kennzeichnungen nur über die Übergänge nach REQ-046 entfernen.
- **Trace:** UC-07, GOAL-03, F-3; OP-30

#### REQ-091 – Bestandsangaben stets aktuell ausgeben
- **Type:** Functional | **Priorität:** Must | **Release:** 0.1 | **Rolle:** System (Ergebnis sieht der Nutzer)
- **Anforderung:** Das System muss Bestandsangaben (Stückzahl, `{WI-Nr}`, `{Akkukapazität}`) in jedem Kanal-Inhalt, unabhängig von Kanal-Status und manueller Anpassung, stets mit dem aktuellen Wert ausgeben.
- **Regeln:** Bestandsangaben ändern sich durch Zuordnung, Umbuchung, Verkauf, Rücknahme, Storno, WI-Nr-Korrektur und Änderung der Akkukapazität eines zugeordneten Geräts. Solche Änderungen lösen weder „geändert seit Freigabe“ noch einen Statuswechsel aus (A-31, OP-29). Bei Kanal-Inhalten im Status *Veröffentlicht* setzt das System „Bestand auf Kanal anpassen“ (REQ-052). Bestandsplatzhalter sind im Titelmuster nicht zulässig (REQ-030). Hat das Modell-Inserat keine verfügbaren Geräte, sind `{WI-Nr}` und `{Akkukapazität}` leer und die Stückzahl ist 0.
- **Must-Begründung:** Ohne diese Regel müsste jeder Kanal-Inhalt nach jedem Einbuchen und Verkauf neu freigegeben werden (Konflikt mit REQ-062, ≤ 2 min) oder er zeigte veraltete WI-Nrn und Akkuwerte (GOAL-03).
- **Trace:** UC-01, UC-07, GOAL-01, GOAL-03, SC-01, A-16, A-31, OP-29

### 6.10 Kopier-Assistent (Shop, Kleinanzeigen, eBay)

#### REQ-047 – Kopier-Assistent: Felder einzeln übernehmen
- **Type:** Functional | **Priorität:** Must | **Release:** 0.1 | **Rolle:** Nutzer
- **Anforderung:** Das System muss für jeden Kanal-Inhalt im Status *Freigegeben*, *Veröffentlicht* oder *Beendet* einen Kopier-Assistenten bereitstellen, der jedes Feld des freigegebenen Stands mit Feldbezeichnung des Kanals in der eingestellten Reihenfolge anzeigt und mit einer einzigen Nutzeraktion je Feld in die Zwischenablage des Arbeitsplatzrechners übernimmt.
- **Felder (abschließend):** Titel; Beschreibung; Kategorie; Zustandsbezeichnung und ggf. Zusatzangabe; Preis (ggf. mit „VB“); jedes Merkmalsfeld der Merkmalszuordnung des Kanals, das einen Wert hat (darin je nach Startbelegung Kap. 9.8 u. a. Artikelnummer, EAN, Herstellernummer, Stückzahl); jede GPSR-Angabe einschließlich Produktidentifikation. Fotos regelt REQ-048.
- **Leere Merkmalsfelder (v0.3.2; Folge der Änderung der mit v0.3 freigegebenen Regel aus REQ-037, Bestätigung durch den Owner mit der Freigabe):** Ein Merkmalsfeld, das im angezeigten Stand keinen Wert hat, zeigt der Kopier-Assistent nicht als zu übernehmendes Feld an; es zählt auch im Übernahmefortschritt nicht mit (REQ-049). Die Regel gilt nur für Merkmalsfelder. Für Titel, Beschreibung, Kategorie, Zustandsbezeichnung mit Zusatzangabe, Preis und GPSR-Angaben gelten die übrigen Regeln dieser Anforderung unverändert; Preis, Kategorie, Zustandsbezeichnung und die Pflichtangaben der GPSR-Herstellerangaben sind im freigegebenen Stand durch die Freigabebedingungen stets vorhanden (REQ-044, REQ-041). Ein als Pflichtfeld des Kanals gekennzeichnetes Merkmalsfeld ist bei der Freigabe nicht leer (REQ-044). Weil der Kopier-Assistent die aktuellen Bestandsangaben zeigt (REQ-091), kann ein Merkmalsfeld mit der Quelle WI-Nr oder Akkukapazität (Kap. 9.11) nach der Freigabe leer werden oder wieder einen Wert erhalten; es entfällt bzw. erscheint dann nach dem aktuellen Stand.
- **Regeln:** Für Kanal-Inhalte im Status *Entwurf* steht der Kopier-Assistent nicht zur Verfügung (Hinweis „Erst freigeben“). Er zeigt immer den freigegebenen Stand mit aktuellen Bestandsangaben (REQ-091), nie einen nicht freigegebenen Änderungsentwurf; besteht „geändert seit Freigabe“, zeigt er zusätzlich den Hinweis „Neuer Stand noch nicht freigegeben“. Der übernommene Text entspricht zeichengenau dem angezeigten Feldwert (inkl. Zeilenumbrüchen der Beschreibung). Der Kopier-Assistent überträgt nichts automatisch an einen Kanal (REQ-079).
- **Must-Begründung:** F-3 (Kleinanzeigen nur per Kopier-Assistent); Brief Kap. 7: ebenso für Shop und eBay, solange die Direktanbindung fehlt.
- **Trace:** UC-05, F-3, F-7b, GOAL-01, Brief Kap. 7

#### REQ-048 – Kopier-Assistent: Fotos bereitstellen
- **Type:** Functional | **Priorität:** Must | **Release:** 0.1 | **Rolle:** Nutzer
- **Anforderung:** Das System muss im Kopier-Assistenten die Fotos des Modell-Inserats in ihrer Reihenfolge bereitstellen, sodass der Nutzer sie in das Formular des Kanals hochladen kann, ohne sie einzeln suchen zu müssen.
- **Ausgaben:** Alle Fotos des Modell-Inserats mit einer einzigen Nutzeraktion als Dateien auf dem Arbeitsplatzrechner, deren Dateinamen die Reihenfolge abbilden (beginnend mit „01“, „02“ usw.). Die Form der Bereitstellung legen UI/UX-Design und Architektur fest.
- **Regeln:** Hat das Modell-Inserat keine Fotos, zeigt der Kopier-Assistent „Keine Fotos zugeordnet“.
- **Must-Begründung:** Brief Kap. 7: Kopier-Assistent „inkl. Foto-Zuordnung“.
- **Trace:** UC-05, Brief Kap. 7

#### REQ-049 – Kopier-Assistent: Übernahmefortschritt
- **Type:** Functional | **Priorität:** Should | **Release:** 0.1 | **Rolle:** Nutzer
- **Anforderung:** Das System muss im Kopier-Assistenten jedes bereits übernommene Feld als „übernommen“ kennzeichnen und die Anzahl übernommener und offener Felder anzeigen.
- **Regeln:** Die Kennzeichnungen gelten für die laufende Nutzung des Kopier-Assistenten und werden bei einer neuen Freigabe (REQ-044, REQ-089) zurückgesetzt. Gezählt werden nur die Felder, die der Kopier-Assistent nach REQ-047 als zu übernehmende Felder anzeigt: Ein Merkmalsfeld ohne Wert zählt weder bei den übernommenen Feldern noch bei der Gesamtzahl (Klarstellung v0.3.2). Beispiel: Ergibt die Feldliste des Kanals 12 Felder, davon 2 Merkmalsfelder ohne Wert, lautet die Anzeige „x von 10 übernommen“.
- **Trace:** UC-05, GOAL-03, Brief-A-3

### 6.11 Datenblatt

#### REQ-050 – Datenblatt erzeugen
- **Type:** Functional | **Priorität:** Must | **Release:** 0.1 | **Rolle:** Nutzer
- **Anforderung:** Der Nutzer kann für ein Gerät ein Datenblatt drucken oder als PDF-Datei erzeugen.
- **Ausgaben:** A4-Hochformat mit Logo der Händlermarke in der Kopfzeile, den Kanalfeldern der Kopfzeile (Startbelegung „Shop:“, „eBay:“, „Kleinanzeigen:“) und den Blöcken Identifikation (WI-Nr, Hersteller, Modellbezeichnung, Herstellernummer, EAN), Zustand (Zustand, Optik-Note, Zustandsbeschreibung), Lieferumfang (inkl. Akku-Hinweis und Akkukapazität), Technik, Anschlüsse, Software, jeweils mit den Werten dieses Geräts.
- **Regeln:** Werte: Modelldaten aus der Modellvorlage; WI-Nr und Gerätewerte dieses Geräts; EAN und Lieferumfang des Modell-Inserats, dem das Gerät zugeordnet ist (REQ-040). Hat das Gerät Werte mit Prüfmarkierung, wird die Erzeugung mit dem Hinweis „Werte noch zu prüfen“ abgelehnt. Ist das Gerät keinem Modell-Inserat zugeordnet, wird sie mit „Gerät keinem Modell-Inserat zugeordnet“ abgelehnt; für stornierte Geräte mit „Gerät storniert“. Ist kein Logo gepflegt, wird die Erzeugung mit dem Hinweis „Logo der Händlermarke fehlt“ abgelehnt. Leere Merkmale erscheinen nicht. Die Akkukapazität und der Platzhalter `{Akkukapazität}` im Akku-Hinweis zeigen auf dem Datenblatt den Wert **dieses Geräts**, nicht die Spanne des Modell-Inserats: eine Zahl als „N %“, sonst „nicht ermittelbar“; hat das Gerät keinen Akku-Wert mit dem Kennzeichen „Akku vorhanden“ oder keine Akkukapazität, ist der Platzhalter leer [Vorschlag BA].
- **Must-Begründung:** UC-06 und Brief Kap. 7 (Datenblatt im bisherigen Layout mit Marke notebookers.de); SC-02 verlangt, dass keine Excel-Datenblätter mehr entstehen.
- **Trace:** UC-06, GOAL-02, SC-02, F-7c, A-10; FIND-024

#### REQ-051 – Datenblatt-Layout einstellen
- **Type:** Functional | **Priorität:** Must | **Release:** 0.1 | **Rolle:** Nutzer
- **Anforderung:** Der Nutzer kann für das Datenblatt die Kopfzeilentexte, die Reihenfolge der Blöcke und je Geräteart die Reihenfolge der Merkmale innerhalb eines Blocks festlegen.
- **Regeln:** Das Logo stammt aus den Händlerangaben (REQ-028).
- **Must-Begründung:** LP-1 nennt das Datenblatt-Layout ausdrücklich als Einstellung; neue Gerätearten brauchen ein Datenblatt ohne Entwicklung (LP-4).
- **Trace:** UC-06, LP-1, LP-4

### 6.12 Inserat-Übersicht

#### REQ-052 – Inserat-Übersicht
- **Type:** Functional | **Priorität:** Must | **Release:** 0.1 | **Rolle:** Nutzer
- **Anforderung:** Das System muss eine Inserat-Übersicht bereitstellen, die je Modell-Inserat den ungekürzten Titel nach dem Titelmuster der Geräteart, Geräteart, Variantenangaben, Stückzahl, Anzahl verkaufter Geräte je Kanal sowie je Kanal den Kanal-Status und die Kennzeichnungen (Kap. 9.4) anzeigt.
- **Eingaben:** optionale Filter nach Geräteart, Kanal-Status, „Stückzahl 0“, „geändert seit Freigabe“, „Änderung auf Kanal übertragen“ und „Bestand auf Kanal anpassen“; Suche nach WI-Nr, Hersteller oder Modellbezeichnung.
- **Ausgaben:** gefilterte Liste; Kennzeichnung „Bestand auf Kanal anpassen“ für jeden Kanal-Inhalt im Status *Veröffentlicht*, bei dem sich eine Bestandsangabe seit dem Setzen auf *Veröffentlicht* bzw. seit der letzten Abgleich-Bestätigung (REQ-090) geändert hat, mit Nennung der geänderten Bestandsangaben; Kanal-Inhalte im Status *Beendet* tragen diese Kennzeichnung nicht (REQ-046). Kennzeichnung „ausverkauft“ bei Stückzahl 0. Ohne Modell-Inserate zeigt die Übersicht „Noch keine Modell-Inserate“; ohne Treffer für Filter oder Suche „Keine Treffer“.
- **Regeln:** Für Kanal-Inhalte mit Änderungsentwurf zeigt die Übersicht den Status und die Angaben des freigegebenen Stands. Die Kennzeichnungen „Bestand auf Kanal anpassen“ und „Änderung auf Kanal übertragen“ entfallen durch die Abgleich-Bestätigung (REQ-090) oder durch den Übergang *Veröffentlicht* → *Beendet* (REQ-046).
- **Must-Begründung:** UC-07 und Brief Kap. 7 (Übersicht je Inserat: Kanal, Stückzahl, verkauft).
- **Trace:** UC-07, Brief Kap. 7, GOAL-05 (Vorbereitung, ohne Abgleich)

### 6.13 Wirkung zentraler Pflege und Nachvollziehbarkeit

#### REQ-053 – Wirkung von Änderungen an Textbausteinen und GPSR-Herstellerangaben
- **Type:** Functional | **Priorität:** Must | **Release:** 0.1 | **Rolle:** System
- **Anforderung:** Das System muss eine Änderung an einem Textbaustein oder an GPSR-Herstellerangaben ohne Einzelbearbeitung in alle danach erzeugten Kanal-Inhalte sowie in alle Kanal-Inhalte im Status *Entwurf* und alle Änderungsentwürfe übernehmen, die den Textbaustein bzw. Hersteller verwenden, soweit der betroffene Text nicht manuell angepasst ist.
- **Regeln:** Für freigegebene, veröffentlichte und beendete Kanal-Inhalte gilt REQ-045. Nach dem Speichern meldet das System die Anzahl betroffener Kanal-Inhalte in den Gruppen „aktualisiert“ (Kanal-Inhalte im Status *Entwurf* und Änderungsentwürfe, deren betroffener Text automatisch gebildet ist) und „zur erneuten Freigabe“ (bisher *Freigegeben*, *Veröffentlicht* oder *Beendet*). Manuell angepasste Titel und Beschreibungen und die zusätzliche Meldegruppe „manuell angepasst, zur Prüfung“ regelt REQ-043.
- **Must-Begründung:** SC-04 ist das Erfolgskriterium von GOAL-04 („wirkt auf alle künftigen Inserate ohne Einzelbearbeitung“).
- **Trace:** GOAL-04, SC-04, UC-08; FIND-022

#### REQ-054 – Prüfstatus rechtlicher Textbausteine führen
- **Type:** Functional | **Priorität:** Must | **Release:** 0.1 | **Rolle:** Nutzer
- **Anforderung:** Der Nutzer kann für jeden Textbaustein der Arten *Rechtliches* und *Akku-Hinweis* den Prüfstatus festlegen.
- **Eingaben:** Prüfstatus (*rechtlich ungeprüft* oder *rechtlich geprüft*); bei *rechtlich geprüft* Prüfdatum (Pflicht, nicht in der Zukunft) und prüfende Stelle (Pflicht, max. 100 Zeichen [Vorschlag BA]). **Ausgaben:** Prüfstatus beim Textbaustein.
- **Regeln:** Jede Textänderung an einem Textbaustein mit Prüfstatus *rechtlich geprüft* setzt den Prüfstatus auf *rechtlich ungeprüft* zurück. Neu angelegte Textbausteine dieser Arten haben den Prüfstatus *rechtlich ungeprüft*. Textbausteine anderer Arten haben keinen Prüfstatus.
- **Must-Begründung:** Brief Kap. 3 und 9: Akku- und Gewährleistungstexte vor Einführung rechtlich prüfen lassen; zentral verbreitete Bausteine multiplizieren Fehler (Brief Kap. 12, Risiken).
- **Trace:** GOAL-04, Brief Kap. 9, A-09, OP-14

#### REQ-087 – Freigabe mit ungeprüftem Rechtstext bestätigen
- **Type:** Functional | **Priorität:** Must | **Release:** 0.1 | **Rolle:** Nutzer
- **Anforderung:** Das System muss die Freigabe (REQ-044, REQ-089) eines Kanal-Inhalts, der einen Textbaustein mit Prüfstatus *rechtlich ungeprüft* enthält, erst nach der ausdrücklichen Bestätigung „Ungeprüfter Rechtstext enthalten – trotzdem freigeben“ durch den Nutzer ausführen.
- **Ausgaben:** Hinweis mit den Namen der ungeprüften Textbausteine; nach Bestätigung Freigabe; ohne Bestätigung bleibt der Kanal-Inhalt unverändert. Die Bestätigung wird mit Zeitpunkt protokolliert (REQ-072).
- **Must-Begründung:** Bis zur Rechtsprüfung (V-04) muss der Pilot mit ungeprüften Texten arbeiten können, ohne dass das Risiko unbemerkt bleibt (Brief Kap. 9, Brief Kap. 12 Risiken).
- **Trace:** GOAL-04, Brief Kap. 9, A-09, OP-14

#### REQ-055 – Änderungsprotokoll einsehen
- **Type:** Functional | **Priorität:** Should | **Release:** 0.1 | **Rolle:** Nutzer
- **Anforderung:** Der Nutzer kann das Änderungsprotokoll (REQ-072) nach Zeitraum und Art des Objekts gefiltert einsehen.
- **Ausgaben:** Einträge mit Zeitpunkt, Objekt, Aktion, altem und neuem Wert (kein Nutzer, E-4).
- **Trace:** GOAL-03, GOAL-04, REQ-072, E-4

### 6.14 Nice-to-have (Could)

#### REQ-056 – Übernahme vorhandener Excel-Datenblätter als Startbestand
- **Type:** Functional | **Priorität:** Could | **Release:** 0.1 (optional) | **Rolle:** Nutzer
- **Anforderung:** Der Nutzer kann Excel-Datenblätter im Format von `Datenblatt.xlsx` einlesen, um daraus Modellvorlagen anzulegen.
- **Regeln:** Jede eingelesene Modellvorlage erhält für alle Werte eine Prüfmarkierung und ist erst nach Bestätigung durch den Nutzer nutzbar, weil die Excel nachweislich Kopierfehler enthält. Nicht zuordenbare Labels werden in einem Einlesebericht aufgeführt; die Bezeichnungsvarianten aus Research Kap. 2 (4 für WI-Nr, 7 für Herstellernummer) werden erkannt.
- **Trace:** Brief Kap. 7 (Nice-to-have), Brief-A-4

#### REQ-057 – Importdatei für den Shop
- **Type:** Functional | **Priorität:** Could | **Release:** 0.1 (optional) | **Rolle:** Nutzer
- **Anforderung:** Der Nutzer kann für freigegebene Shop-Kanal-Inhalte eine Importdatei erzeugen, die der Pilotkunde über die Importfunktion seines PrestaShop 9.1.4 einlesen kann.
- **Regeln:** Inhalt und Spalten entsprechen dem Shop-Kanal-Inhalt (Titel, Beschreibung, Kategorie, Preis, Artikelnummer, EAN, Herstellernummer, Merkmale, Stückzahl). Das genaue Dateiformat wird im Architecture Baseline festgelegt.
- **Trace:** Brief Kap. 7 (Nice-to-have), Brief Kap. 9

#### REQ-058 – Plausibilitätswarnung: gleiche Herstellernummer
- **Type:** Functional | **Priorität:** Could | **Release:** 0.1 (optional) | **Rolle:** Nutzer
- **Anforderung:** Das System muss beim Speichern einer Modellvorlage warnen, wenn ihre Herstellernummer bereits in einer anderen Modellvorlage mit anderer Modellbezeichnung vorkommt.
- **Trace:** Brief Kap. 7 (Nice-to-have), GOAL-03 (Excel-Befund 20TD002MGE)

#### REQ-059 – Plausibilitätswarnung: Kategorie passt nicht zur Geräteart
- **Type:** Functional | **Priorität:** Could | **Release:** 0.1 (optional) | **Rolle:** Nutzer
- **Anforderung:** Das System muss warnen, wenn der Nutzer für einen Kanal-Inhalt eine Kategorie wählt, die in der Kategoriezuordnung desselben Kanals einer anderen Geräteart zugeordnet ist.
- **Trace:** Brief Kap. 7 (Nice-to-have), GOAL-03 (Mini-PC in „Laptops & Notebooks“)

### 6.15 Hinweis auf eigene Sicherung (E-7, neu in v0.3.2)

resellr sichert die Daten in Phase 1 nicht selbst. **Owner-Entscheidung E-7 (Kap. 11.1, RB-21):** OneDrive ja; die Sicherung ist freiwillig und nicht in Phase 1 eingebaut; resellr gibt immer einen klaren Hinweis, dass der Owner sie einrichten sollte, aber nicht als Pflicht; es gibt nur einen Hinweis mit Anleitung; eine Kopie ist nur bei beendetem resellr sicher brauchbar. **Abgeleitet aus E-7, zur ausdrücklichen Owner-Bestätigung (OP-17):** Der Owner sichert, indem er den einen Datenordner kopiert (REQ-106); damit er resellr vorher beenden kann, gibt es in resellr die Aktion „resellr beenden“ (REQ-105). Sicherungs- und Wiederherstellungsfunktionen sind außerhalb des Umfangs (Kap. 14).

#### REQ-104 – Hinweis „Sicherung einrichten“ anzeigen
- **Type:** Functional | **Priorität:** Must | **Release:** 0.1 | **Rolle:** Nutzer (empfängt den Hinweis)
- **Anforderung:** Das System muss bei jeder Nutzung deutlich sichtbar einen Hinweis anzeigen, dass resellr die Daten nicht selbst sichert und der Nutzer sie selbst sichern sollte, ohne die Bedienung zu blockieren.
- **Ausgaben:** Kurzüberschrift „Sicherung einrichten“ [Vorschlag BA; Bezeichnung des Hinweises im UI/UX-Design] und Hinweistext [Vorschlag BA]: „resellr sichert Ihre Daten nicht selbst. Bitte sichern Sie sie regelmäßig selbst, zum Beispiel in OneDrive. So geht es: 1. resellr beenden. 2. Den Datenordner vollständig an Ihren Sicherungsort kopieren. Der Datenordner liegt hier: {Speicherort des Datenordners}. Wichtig: Eine Kopie, die bei laufendem resellr entsteht, kann unbrauchbar sein.“ `{Speicherort des Datenordners}` ist der vollständige Speicherort des Datenordners nach REQ-106 [Vorschlag BA].
- **Regeln:** Der Text enthält stets diese vier Aussagen: (a) resellr sichert die Daten nicht selbst; (b) der Nutzer sollte sie selbst sichern, empfohlen z. B. in OneDrive; (c) wie: resellr beenden, dann den einen Datenordner kopieren; (d) eine Kopie bei laufendem resellr kann unbrauchbar sein. Bei jedem Öffnen von resellr ist der Hinweis sichtbar, ohne dass der Nutzer eine Aktion ausführt. Er gilt ohne Zeitablauf; es gibt keine Einstellung und keine Aktion, die ihn für künftige Nutzungen ausblendet (z. B. „nie wieder anzeigen“). Das System erkennt nicht, ob gesichert wurde, und ändert den Hinweis deshalb nie. Der Hinweis blockiert keine Funktion und verlangt keine Bestätigung; resellr läuft ohne Sicherung unverändert weiter. An welcher Stelle der Hinweis erscheint, legt das UI/UX-Design fest; Ziel ist, dass er bei jeder Nutzung deutlich sichtbar ist, ohne die Bedienung zu blockieren. Am Hinweis steht im Betrieb nur am Arbeitsplatzrechner die Aktion „resellr beenden“ (REQ-105). Im Netzbetrieb zeigt der Hinweis denselben Text ohne diese Aktion (Startannahme A-36, OP-31). Überschrift und Wortlaut bestätigt der Owner mit der Requirements-Freigabe (OP-17).
- **Must-Begründung:** Owner-Entscheidung E-7: resellr sichert in Phase 1 nicht selbst, und der Nutzer soll das jederzeit erkennen; ohne Hinweis bliebe unbemerkt, dass ein Ausfall des Arbeitsplatzrechners ohne eigene Sicherung alle Daten vernichtet (RI-13).
- **Trace:** E-7 (RB-21); RI-13; REQ-105, REQ-106

#### REQ-105 – resellr aus dem Hinweis heraus beenden
- **Type:** Functional | **Priorität:** Must | **Release:** 0.1 | **Rolle:** Nutzer
- **Anforderung:** Der Nutzer kann resellr im Betrieb nur am Arbeitsplatzrechner aus dem Hinweis „Sicherung einrichten“ (REQ-104) heraus mit einer Nutzeraktion geordnet beenden, damit er anschließend den Datenordner kopieren kann.
- **Eingaben:** Aufruf der Aktion „resellr beenden“; Bestätigung oder Abbruch der Rückfrage „resellr jetzt beenden? Nicht gespeicherte Eingaben gehen verloren. Danach können Sie den Datenordner kopieren.“ [Vorschlag BA]. **Ausgaben:** nach Bestätigung die Meldung „resellr ist beendet. Sie können den Datenordner jetzt kopieren.“ [Vorschlag BA]; danach ist resellr bis zum nächsten Start nicht nutzbar. Bei Abbruch läuft resellr unverändert weiter.
- **Regeln:** Die Rückfrage verhindert ein versehentliches Beenden. Geordnet beenden heißt: Alle bis zur Bestätigung gespeicherten Daten sind danach vollständig im Datenordner (REQ-106), sodass eine jetzt angelegte Kopie vollständig und brauchbar ist; nicht gespeicherte Eingaben werden verworfen. Gelingt das geordnete Beenden nicht, meldet das System das nach REQ-073 und läuft weiter; der Hinweis bleibt. Wie resellr danach wieder gestartet wird, ist nicht Teil dieser Anforderung. **Netzbetrieb (Startannahme A-36 [Vorschlag BA], OP-31):** Im Netzbetrieb gibt es diese Aktion nicht, weil sie alle Zugriffe beenden würde; das Beenden für eine Sicherung ist dort Sache des Betreibers außerhalb der Funktionen des Systems. Ob Netzbetrieb vorliegt, ergibt sich aus der Architektur (OP-15, OP-23).
- **Must-Begründung:** Nach E-7 ist eine Sicherung nur als Kopie bei beendetem resellr sicher brauchbar; ohne eine am Hinweis erreichbare Möglichkeit, resellr geordnet zu beenden, kann der Nutzer die vom Owner gewählte Sicherung nicht verlässlich anlegen.
- **Herkunft:** abgeleitet aus E-7, zur ausdrücklichen Owner-Bestätigung (OP-17). Owner-Wortlaut ist nur, dass eine Kopie bei beendetem resellr sicher brauchbar ist; dass resellr dafür eine eigene Aktion „resellr beenden“ mit Priorität Must hat, stammt aus dem Kommentar bb98a214 des Software Architect an MAR-125 nach der Antwort. Standardannahme: gilt wie beschrieben, falls der Owner nicht widerspricht.
- **Trace:** E-7 (RB-21); REQ-104, REQ-106; OP-31, OP-23

## 7. Nicht-funktionale Anforderungen

Schwellenwerte mit „[Vorschlag BA]“ sind nicht aus den Quellen ableitbar; sie werden mit der Requirements-Freigabe bestätigt oder geändert (OP-17). „[Brief]“ kennzeichnet Bestandteile, die aus dem Product Brief stammen. Bezugsvolumen für Leistungsanforderungen ist A-12. Offline-Betrieb und Echtzeit-Verhalten sind nicht erforderlich: Die Arbeit findet am Arbeitsplatzrechner mit Netzwerkzugang statt (E-6, A-02), die Kanal-Übertragung ist manuell. Zurückgezogene nicht-funktionale Anforderungen stehen mit ID am Ende der Tabelle (Withdrawn in v0.3); REQ-066 (Withdrawn in v0.3.2) bleibt an ihrer bisherigen Stelle.

| ID | Type | Bereich | Anforderung | Schwellenwert | Messmethode | Release | Trace |
| --- | --- | --- | --- | --- | --- | --- | --- |
| **REQ-060** | Non-functional | Performance | Das System muss alltägliche Nutzeraktionen (Speichern, Suchen, Öffnen eines Datensatzes, Zuordnen) zügig abschließen. | 95 % der Aktionen ≤ 2 s, keine Aktion > 5 s, beim Datenvolumen aus A-12 und 1 Nutzer (E-4) [Vorschlag BA] | Lasttest mit Testdatenbestand nach A-12; Zeit von Nutzeraktion bis vollständiger Anzeige, je Aktionstyp ≥ 50 Messungen | 0.1 | GOAL-01, SC-01 |
| **REQ-061** | Non-functional | Performance | Das System muss die Kanal-Inhalte eines Modell-Inserats für alle aktiven Kanäle erzeugen und ein Datenblatt erzeugen. | Kanal-Inhalte für 3 Kanäle ≤ 3 s; Datenblatt-PDF ≤ 5 s (je 95 %) [Vorschlag BA] | wie REQ-060, je ≥ 50 Messungen | 0.1 | GOAL-01, UC-04, UC-06 |
| **REQ-062** | Non-functional | Effizienz | Ein eingewiesener Nutzer muss ein Gerät zu einem bestehenden Modell-Inserat einbuchen können (J-02, ohne Fotos). | ≤ 2 Minuten im Median von 5 Einbuchungen (Brief SC-01 [Vorschlag]) | Zeitmessung beim Pilotkunden an 5 realen Geräten, Start: WI-Nr wird eingegeben, Ende: Stückzahl erhöht | 0.1 | SC-01, GOAL-01, UC-01 |
| **REQ-063** | Non-functional | Wirksamkeit | Das System muss die Zeit bis „auf allen Kanälen inseriert“ je neuem Modell-Inserat gegenüber der Baseline senken. | ≥ 50 % unter der vor Entwicklungsstart gemessenen Baseline (Brief SC-01 [Vorschlag]) | Gleiche Messmethode wie Baseline (V-01), 2–3 neue Modell-Inserate, 4 Wochen nach Pilotstart | 0.1 (Pilotbewertung) | GOAL-01, SC-01, Brief-A-1, Brief-A-2 |
| **REQ-064** | Non-functional | Kapazität | Das System muss das Datenvolumen aus A-12 ohne Verletzung von REQ-060 und REQ-061 verwalten. | mind. 2.000 Modellvorlagen, 10.000 Geräte, 3.000 Modell-Inserate, 60.000 Fotos [Annahme A-12] | Lasttest mit synthetischem Bestand dieser Größe | 0.1 | GOAL-01 |
| **REQ-065** | Non-functional | Verfügbarkeit | Das System muss während der Geschäftszeiten des Pilotkunden nutzbar sein. Gemessen wird je Betriebsmodell: im Netzbetrieb die Erreichbarkeit über das Netz; im Betrieb nur am Arbeitsplatzrechner, dass resellr startbar und nutzbar ist, solange der Arbeitsplatzrechner läuft [Vorschlag BA, OP-12]. | ≥ 99 % je Kalendermonat, Mo–Sa 8–18 Uhr MEZ/MESZ; geplante Wartung außerhalb dieser Zeiten [Vorschlag BA, OP-12]. Im Betrieb nur am Arbeitsplatzrechner zählen Zeiten, in denen der Arbeitsplatzrechner ausgeschaltet, gestört oder defekt ist, weder als Ausfall noch als Geschäftszeit [Vorschlag BA, OP-12]. In beiden Betriebsmodellen zählen Zeiten, in denen resellr nach einem vom Nutzer ausgelösten Beenden (REQ-105) oder, im Netzbetrieb, nach einem Beenden durch den Betreiber (A-36) bis zum nächsten Startversuch nicht läuft, weder als Ausfall noch als Geschäftszeit [Vorschlag BA, OP-12] | Netzbetrieb: monatliche Auswertung der Erreichbarkeit (automatische Prüfung mind. alle 5 Minuten); Zeiten nach einem Beenden durch den Betreiber (A-36) bis zum nächsten Startversuch werden mit Beginn und Ende erfasst und herausgerechnet [Vorschlag BA, OP-12]. Betrieb nur am Arbeitsplatzrechner: monatliche Auswertung eines Störungsprotokolls, in das der Nutzer jeden fehlgeschlagenen Start von resellr und jede Zeit, in der resellr bei laufendem Arbeitsplatzrechner nicht nutzbar war, mit Beginn und Ende sowie die Zeiten ohne laufenden Arbeitsplatzrechner und die Zeiten nach einem Beenden über REQ-105 bis zum nächsten Startversuch einträgt, abgeglichen mit dem Fehlerprotokoll nach REQ-073; Verfügbarkeit = 1 − Ausfallzeit ÷ Geschäftszeit bei laufendem Arbeitsplatzrechner ohne die Zeiten nach einem Beenden über REQ-105 [Vorschlag BA, OP-12] | 0.1 | GOAL-01, OP-12 |
| **REQ-066** | Non-functional | Datensicherung und -erhalt | *Withdrawn in v0.3.2*: Owner-Entscheidung E-7 (Kap. 11.1, RB-21). Die Sicherung ist freiwillig und Sache des Owners; resellr hat in Phase 1 keine Sicherungs- und keine Wiederherstellungsfunktion. Damit entfallen die mit v0.3 freigegebenen Werte Datenverlust höchstens 24 h (RPO), Wiederherstellung innerhalb von 2 Arbeitstagen (RTO) und 30 Tage Aufbewahrung sowie der Wiederherstellungstest (Wortlaut bis v0.3.1: Revision `d816223d` an MAR-114). An ihre Stelle treten der Hinweis REQ-104, die Aktion REQ-105 und die Datenhaltung in einem Datenordner REQ-106. | – | – | – | E-7 |
| **REQ-067** | Non-functional | Sicherheit | Das System muss im Netzbetrieb jeden Zugriff durch das Zugangspasswort schützen und das Zugangspasswort selbst schützen (E-5). Im Betrieb nur am Arbeitsplatzrechner gibt es keine Anmeldung (E-5); dort gilt nur, dass resellr von keinem anderen Gerät aus erreichbar ist (REQ-001). | Im Netzbetrieb: 100 % der Funktionen erst nach Eingabe des gültigen Zugangspassworts (REQ-001); Zugangspasswort mind. 12 Zeichen [Vorschlag BA]; das gilt für jedes neue Zugangspasswort (REQ-097; Prüfung durch das System) und ebenso für das erste und jedes vom Betreiber zurückgesetzte Zugangspasswort (REQ-001; die Einhaltung stellt der Betreiber beim Festlegen sicher, das System hat dafür keine Funktion) [Vorschlag BA]; Übertragung zwischen Arbeitsplatzrechner und System verschlüsselt; Zugangspasswort nicht im Klartext gespeichert (beides abgeleitet aus E-5: ein unverschlüsselt übertragenes oder im Klartext gespeichertes Passwort schützt nicht). Keine automatische Abmeldung nach Inaktivität (entfällt gegenüber v0.2). Im Betrieb nur am Arbeitsplatzrechner: 0 erfolgreiche Zugriffe von einem anderen Gerät | Sicherheitstest im Netzbetrieb: Aufruf aller Funktionen ohne Zugangspasswort (Erwartung: abgelehnt); Prüfung der Mindestlänge beim Ändern (AC-REQ-097-04); für das erste und jedes zurückgesetzte Zugangspasswort: Review der Einrichtungs- und Zurücksetzungsanweisung des Betreibers auf die Regel „mind. 12 Zeichen“ und schriftliche Bestätigung des Betreibers bei der Abnahme; Prüfung der Verschlüsselung der Verbindung; Review der Passwortspeicherung. Test im Betrieb nur am Arbeitsplatzrechner: Zugriffsversuch von einem anderen Gerät im selben lokalen Netz (Erwartung: nicht erreichbar, AC-REQ-001-07) | 0.1 | E-5, REQ-001, REQ-097 |
| **REQ-068** | Non-functional | Sicherheit | Das System darf in Release 0.1 keine Zugangsdaten zu PrestaShop, eBay oder Kleinanzeigen speichern. | 0 gespeicherte Plattform-Zugangsdaten | Review des Datenbestands und der Eingabefelder vor Abnahme | 0.1 | Brief Kap. 9 („Plattform-Zugänge verwaltet der Kunde“) |
| **REQ-069** | Non-functional | Datenschutz | Das System darf keine personenbezogenen Daten von Käufern und vom Nutzer speichern (E-4, E-5). Ausgenommen sind geschäftliche Kontaktangaben, die der Nutzer selbst als Inhalt pflegt: Kontaktangaben der Händlermarke (REQ-028) und GPSR-Herstellerangaben einschließlich der verantwortlichen Person in der EU (REQ-027) [Vorschlag BA, Abgrenzung]. | 0 Datenfelder für Käufer; 0 Benutzerkonten; 0 Angaben zum Nutzer in Protokolleinträgen, Freigaben, Abgleichen und Geräten | Review des Datenmodells (Kap. 9) gegen diese Liste vor Abnahme | 0.1 | E-4, E-5; F-5 und Brief Kap. 6b (produktfähig; Datenschutz als Produktanforderung genannt), Brief Kap. 7 Out of Scope (Bestellungen, Versand); abgeleitet aus DSGVO Art. 5 (Datenminimierung); Kap. 14 |
| **REQ-070** | Non-functional | Datenschutz | *Withdrawn in v0.3* [Vorschlag BA]: Die Anforderung (personenbezogene Daten nur in EU/EWR) entfällt, weil resellr keine personenbezogenen Daten von Käufern und vom Nutzer mehr speichert (REQ-069). Wo die Daten liegen, bleibt Thema von OP-23. | – | – | – | E-4, E-5; OP-23 |
| **REQ-071** | Non-functional | Barrierefreiheit | *Withdrawn in v0.3*: Owner-Entscheidung E-3, Barrierefreiheit wird ganz gestrichen. Es gibt keine Barrierefreiheitsanforderung, keinen Standard und keine Konformitätsstufe. | – | – | – | E-3 |
| **REQ-072** | Non-functional | Nachvollziehbarkeit | Das System muss Änderungen an Einstellungen, Modellvorlagen, Inseratswerten, Freigaben (einschließlich Bestätigungen nach REQ-087), Kanal-Status, Abgleich-Bestätigungen, Verkaufsmarkierungen und deren Rücknahme, Storno, WI-Nr-Korrekturen, Löschungen und „trotzdem zuordnen“-Entscheidungen protokollieren. Protokolleinträge enthalten keinen Nutzer und keine Passwörter (E-4, E-5). | 100 % dieser Änderungen mit Zeitpunkt, Objekt, Aktion, altem und neuem Wert. Jeder Eintrag bleibt 24 Monate erhalten und wird danach automatisch **gelöscht**, spätestens 7 Tage nach Ablauf der 24 Monate [Vorschlag BA]; es gibt keine Anonymisierung | (a) Testfall je Änderungsart (≥ 1 je Objektart in Kap. 9.5), Abgleich der Protokolleinträge; (b) Test mit rückdatierten Einträgen im Alter von 23 Monaten und von 24 Monaten plus 8 Tagen: Erwartung „vorhanden“ bzw. „gelöscht“ | 0.1 | GOAL-03, GOAL-04; E-4, E-5 (FIND-021) |
| **REQ-073** | Non-functional | Beobachtbarkeit (Betrieb) | Das System muss technische Fehler für den Betreiber erkennbar machen. | 100 % der vom System abgefangenen Fehler mit Zeitpunkt, betroffener Funktion, Fehlerbeschreibung und Referenznummer protokolliert; Aufbewahrung ≥ 30 Tage [Vorschlag BA]. Die Nutzermeldung erfüllt 100 % dieser Merkmale: deutscher Text; nennt die betroffene Funktion; nennt einen nächsten Schritt (erneut versuchen oder Betreiber mit Referenznummer informieren); enthält die Referenznummer des Protokolleintrags; enthält keine Fehlercodes, Stacktraces, Datei-, Klassen- oder Tabellennamen | Fehlerinjektion in 5 Funktionen (u. a. Datenblatt, Foto-Upload); Prüfung des Protokolleintrags und Abgleich jeder Nutzermeldung mit der Merkmalsliste | 0.1 | F-5 (produktfähig: betreibbar ohne Entwickler vor Ort); abgeleitete Betriebsanforderung, Begründung: Ohne Fehlerprotokoll sind Störungen im Pilotbetrieb nicht analysierbar (Brief Kap. 12, Risiko geringe Verbindlichkeit/Feedback) |
| **REQ-074** | Non-functional | Wartbarkeit / Konfigurierbarkeit (LP-1) | Das System darf keine kundenspezifischen Inhalte fest enthalten; alle Inhalte aus Kap. 9.5 sind Einstellungen. | 0 Vorkommen von „notebookers“, „defekte-IT“ oder Texten des Pilotkunden außerhalb der Einstellungen | Test: Händlermarke, Logo, Textbausteine, Zuordnungen und Titelmuster durch eine Testkonfiguration „Testhändler“ ersetzen, je Kanal einen Kanal-Inhalt und ein Datenblatt erzeugen und nach diesen Begriffen durchsuchen; jede Einstellung aus Kap. 9.5 einmal durch den Nutzer ändern, ohne Entwicklung | 0.1 | LP-1, F-5 |
| **REQ-075** | Non-functional | Wartbarkeit (LP-2) | Ein weiterer Kanal muss sich ergänzen lassen, ohne Erfassung, Modell-Bibliothek, Modell-Inserat oder die Ausgaben bestehender Kanäle zu verändern. | 0 Änderungen an diesen Bereichen beim Ergänzen eines Testkanals; 0 Abweichungen in den Kanal-Inhalten bestehender Kanäle vor/nach dem Ergänzen | (a) Architecture Baseline weist die Kanal-Bausteine nach (Review durch Owner); (b) Abnahmetest: Testkanal hinzufügen bzw. einen Kanal deaktivieren und die Kanal-Inhalte der übrigen Kanäle zeichengenau vergleichen | 0.1 | LP-2, F-5 |
| **REQ-076** | Non-functional | Wartbarkeit (LP-4) | Der Nutzer muss eine neue Geräteart mit eigenen Merkmalen, Titelmuster, Kategoriezuordnung und Datenblatt ohne Entwicklung anlegen und inserieren können. | [Brief, SC-07] Geräteart „Monitor“ mit eigenen Merkmalen, eigenem Titelmuster und eigener Kategoriezuordnung angelegt und inseriert (je Kanal ein freigegebener Kanal-Inhalt); 0 Entwicklungsschritte. [Vorschlag BA] zusätzlich: mind. 6 Merkmale (z. B. Bildschirmdiagonale, Auflösung, Panel, Anschlüsse, Höhenverstellbar, Lautsprecher); ein Datenblatt erzeugt; Zeitbedarf ≤ 60 min; durchgeführt vom Nutzer nach Einweisung | Abnahmetest mit Zeitmessung; Prüfung, dass keine Änderung an Programmcode, Datenbankstruktur oder Auslieferung erfolgt ist | 0.1 | LP-4, SC-07, F-7a |
| **REQ-077** | Non-functional | Plattform | Das System muss am Arbeitsplatzrechner des Nutzers nutzbar sein (E-6); Smartphones und Tablets werden in Version 1 nicht unterstützt (E-2). | Bildschirmauflösung ab 1366 × 768 Pixel ohne Funktionsverlust; auf der Betriebssystem- und Programmversion des Arbeitsplatzrechners (OP-24, A-34); Druck auf A4-Drucker; keine Unterstützung für Smartphone und Tablet (E-2) | Abnahmetest der Nutzerreisen J-01 bis J-06 auf dem Arbeitsplatzrechner des Nutzers und bei 1366 × 768 | 0.1 | E-2, E-6, A-02, OP-15, OP-24 |
| **REQ-078** | Non-functional | Sprache und Formate | Das System muss Bedienoberfläche, Meldungen, Kanal-Inhalte und Datenblatt auf Deutsch bereitstellen und deutsche Formate verwenden. | 100 % deutsche Texte; Dezimalkomma; Preise „1.234,56 €“; Datum TT.MM.JJJJ; Zeitzone Europe/Berlin | Review aller Funktionen und Ausgaben | 0.1 | Brief Kap. 9 („deutsche Inserate“) |
| **REQ-079** | Non-functional | Recht / Plattformregeln | Das System darf in Release 0.1 nicht automatisiert auf Kleinanzeigen zugreifen (kein Anmelden, Einstellen, Ändern, Auslesen). Dasselbe gilt für Shop und eBay in Release 0.1. | 0 Verbindungen des Systems zu Kleinanzeigen, eBay oder dem Shop | Netzwerkmitschnitt während der Nutzerreisen J-01 bis J-06; Review des Architecture Baseline | 0.1 | F-3, Brief Kap. 9 (Nutzungsbedingungen § 5, § 6) |
| **REQ-080** | Non-functional | Erlernbarkeit | Der Nutzer muss nach einer Einweisung die Nutzerreisen J-01 und J-02 ohne Hilfe durchführen können. | Einweisung ≤ 60 min; danach 4 von 5 Durchführungen von J-02 und 1 von 1 Durchführung von J-01 ohne Hilfe [Vorschlag BA] | Beobachteter Test mit dem Nutzer beim ersten Einsatz nach der Einweisung [Vorschlag BA] | 0.1 | Brief-A-3, Brief-A-4; E-4 |
| **REQ-081** | Non-functional | Ausgabequalität | Das Datenblatt muss bei der Startbelegung auf eine A4-Seite passen. | 1 Seite A4 Hochformat für alle Geräte der Startbelegung mit bis zu 40 befüllten Merkmalen und Anschlüssen (Excel-Referenz: bis 40 Zeilen) | Erzeugung von Datenblättern für 5 Testgeräte je Geräteart, Seitenzahl prüfen | 0.1 | UC-06 |
| **REQ-103** | Non-functional | Datenerhalt | Das System darf Geräte nie löschen; der Korrekturweg ist Storno (REQ-093). Modell-Inserate und Modellvorlagen darf es nur löschen, wenn der Nutzer das ausdrücklich veranlasst und bestätigt (REQ-095). Das System löscht keinen dieser Datensätze automatisch. Die Anforderung gilt unabhängig davon, ob REQ-095 (Should) umgesetzt wird; ohne REQ-095 löscht das System keine Modell-Inserate und Modellvorlagen. Die Löschfrist der Protokolleinträge regelt REQ-072. (Neu in v0.3.1, aus REQ-095 herausgelöst; Inhalt bis v0.2 in REQ-082.) | 0 gelöschte Geräte; 0 automatische Löschungen von Geräten, Modell-Inseraten und Modellvorlagen; 100 % der Löschungen nach REQ-095 protokolliert (REQ-072) | (a) Bestandsvergleich: Anzahl und Kennungen aller Geräte (in jedem Bestandsstatus), Modell-Inserate und Modellvorlagen vor und nach dem Durchlauf der Nutzerreisen J-01 bis J-06 einschließlich Storno (REQ-093), Verkauf (REQ-021), Umbuchen auf Stückzahl 0 (AC-REQ-020-03) und Übergang von Kanal-Inhalten nach *Beendet* (REQ-046): Es fehlt kein Datensatz außer den nach REQ-095 gelöschten; (b) Test mit rückdatierten Datensätzen im Alter von 25 Monaten (storniertes Gerät, verkauftes Gerät, Modell-Inserat mit Stückzahl 0, Modellvorlage ohne Gerät): nach 8 Tagen Betrieb alle vorhanden; (c) falls REQ-095 umgesetzt ist: Löschversuch für ein Modell-Inserat mit verkauftem Gerät (Erwartung: abgelehnt) und Protokollprüfung jeder Löschung | 0.1 | GOAL-02, GOAL-03, E-4; REQ-093, REQ-095 |
| **REQ-106** | Non-functional | Datenhaltung (Grundlage der eigenen Sicherung) | Das System muss alle Daten, also alle Entitäten aus Kap. 9.1 einschließlich Fotos, Logo und aller Einstellungen nach Kap. 9.5, in einem einzigen Datenordner halten, sodass eine Kopie dieses Ordners, die bei beendetem resellr angelegt wird (REQ-105), alle Daten enthält (E-7). (Neu in v0.3.2, aus der Owner-Entscheidung E-7 abgeleitet; zur ausdrücklichen Owner-Bestätigung (OP-17), gekennzeichnet in v0.3.3: Der Owner hat entschieden, dass eine Kopie nur bei beendetem resellr sicher brauchbar ist, nicht, dass alle Daten in einem einzigen Datenordner liegen. Standardannahme: gilt wie beschrieben, falls der Owner nicht widerspricht.) | 0 Daten außerhalb des Datenordners; eine bei beendetem resellr angelegte Kopie enthält 100 % der Daten: in der Stichprobe (20 Datensätze, 20 Fotos, Logo, jede Einstellung aus Kap. 9.5) 0 Abweichungen | Test vor Pilotstart (AC-REQ-106-01): Testbestand anlegen (je Entität aus Kap. 9.1 mind. 1 Datensatz, mind. 20 Fotos, Logo); resellr beenden, im Betrieb nur am Arbeitsplatzrechner durch den Nutzer über REQ-105, im Netzbetrieb durch den Betreiber außerhalb der Funktionen des Systems (A-36); Datenordner kopieren; in einer zweiten, leeren Installation derselben Version die Kopie als Datenordner verwenden und resellr starten; Stichprobe vergleichen. Das Einsetzen der Kopie ist nur Prüfschritt, keine Funktion des Systems (Kap. 14) | 0.1 | E-7 (RB-21); GOAL-02; REQ-104, REQ-105 |
| **REQ-082** | Non-functional | Datenerhalt | *Withdrawn in v0.3*: Die Prüfung nach Rollen („Löschversuch als Bearbeiter“) entfällt mit E-4. Gelöscht wird nur über REQ-095 durch den Nutzer; die Regel „keine automatische Löschung von Geräten, Modell-Inseraten und Modellvorlagen“ steht seit v0.3.1 in REQ-103 (in v0.3 in REQ-095), die Löschfrist der Protokolleinträge in REQ-072. | – | – | – | E-4 |
| **REQ-083** | Non-functional | Datenkonsistenz | *Withdrawn in v0.3* [Vorschlag BA]: Gleichzeitige Bearbeitung durch zwei Nutzer kommt nicht vor (E-4). Restrisiko: Bearbeitet der Nutzer denselben Datensatz in zwei Fenstern, kann eine Änderung überschrieben werden (RI-11). | – | – | – | E-4 |
| **REQ-102** | Non-functional | Datenschutz (Speicherbegrenzung) | *Withdrawn in v0.3*: Es gibt keine Benutzerkonten und keinen Nutzer in Protokolleinträgen, also nichts zu anonymisieren (Folge aus E-4, E-5; OP-28 erledigt). Protokolleinträge werden nach REQ-072 nach 24 Monaten gelöscht. | – | – | – | E-4, E-5 |

**Abdeckung nach Qualitätsstandard C4:** Performance REQ-060, REQ-061, REQ-062 (Antwortzeiten für Nutzeraktionen: REQ-060); Verfügbarkeit REQ-065; Sicherheit und Datenschutz REQ-067 (im Netzbetrieb), REQ-068, REQ-069, REQ-072; **Barrierefreiheit: nicht anwendbar** – Owner-Entscheidung E-3, es gibt keine Barrierefreiheitsanforderung und daher keinen anzuwendenden Standard und keine Konformitätsstufe; eine gesetzliche Pflicht ist nicht bekannt (internes Werkzeug eines Unternehmens, keine öffentliche Stelle, kein Verbraucherprodukt; vormals A-24); Beobachtbarkeit REQ-072, REQ-073; Wartbarkeit REQ-074 bis REQ-076; Datenerhalt REQ-103; Datenhaltung in einem Datenordner als Grundlage der eigenen Sicherung REQ-106 (eine Sicherung durch das System gibt es nicht: REQ-066 Withdrawn in v0.3.2, E-7). Offline und Echtzeit: nicht anwendbar (siehe Einleitung Kap. 7).

## 8. Akzeptanzkriterien

Testdaten, die mehrfach vorkommen (Merkmale, Ebenen und Variantenkennzeichen nach Startbelegung Kap. 9.3):

- **MV-A** (Modellvorlage, Notebook): Modelldaten Hersteller Apple, Modellbezeichnung „MacBook Pro 13“, Typbezeichnung „A1989“, Herstellernummer „MHGT3D/A“ (fiktive Zuordnung für Tests), Original-EAN „0194252146835“, Prozessor „intel Core i5-8279U“ (Ebene *Modell*), Farbe „Space Gray“ (Ebene *Modell*). Vorbelegungswerte (Ebene *Gerät*): RAM 16 GB, Speicherkapazität 512 GB (beide Variantenmerkmale, Ausgabeschreibweise ohne Leerzeichen, also „16GB“, „512GB“), Tastaturlayout „Deutsch (QWERTZ)“, Betriebssystem „macOS“, Akku „mit Akku“, Akkukapazität 85.
- **MI-A** (Modell-Inserat von MV-A), angelegt aus dem geprüften Gerät mit WI-Nr „626198“; Variantenangaben: Zustand „gebraucht“, Optik-Note 2, Zustandsbeschreibung „leichte Gebrauchsspuren“, RAM 16 GB, Speicherkapazität 512 GB, Speichertyp „SSD (NVMe)“, Tastaturlayout „Deutsch (QWERTZ)“, Betriebssystem „macOS“, Netzteil „mit Netzteil (original)“, Akku „mit Akku“; übrige inserierte Gerätewerte: Betriebssystem-Version „15.1“; EAN-Kennzeichnung „Original“; Artikelnummer „626198“.
- **MV-P** (Modellvorlage, PC/Mini-PC): Hersteller HP, Modellbezeichnung „ProDesk 600 G5 Desktop Mini“, keine Typbezeichnung, Prozessor „intel Core i5-9500T“, keine Farbe; Vorbelegungswerte RAM 16 GB, Speicherkapazität 256 GB.
- **Test-Titelmuster Notebook** (Bestandteile in Reihenfolge; Präfix/Suffix in Anführungszeichen; Kürzungspriorität in Klammern): `{Hersteller}` (1) · Präfix „ “ `{Modellbezeichnung}` (1) · Präfix „ (“ `{Typbezeichnung}` Suffix „)“ (1) · Präfix „, “ `{Prozessor}` (1) · Präfix „, “ `{RAM}` Suffix „ RAM“ (2) · Präfix „, “ `{Speicherkapazität}` (3) · Präfix „ “ `{Farbe}` (4). Kurzschreibweise: `{Hersteller} {Modellbezeichnung} ({Typbezeichnung}), {Prozessor}, {RAM} RAM, {Speicherkapazität} {Farbe}`. Dasselbe Muster gilt in Tests für PC/Mini-PC.
- **Testmenge TM-1** (Titel): MI-A; MI-A mit MV-A ohne Farbe; MI-A mit MV-A ohne Typbezeichnung; ein Modell-Inserat von MV-P. Ungekürzte Titel: „Apple MacBook Pro 13 (A1989), intel Core i5-8279U, 16GB RAM, 512GB Space Gray“ (77 Zeichen), „Apple MacBook Pro 13 (A1989), intel Core i5-8279U, 16GB RAM, 512GB“ (66), „Apple MacBook Pro 13, intel Core i5-8279U, 16GB RAM, 512GB Space Gray“ (69), „HP ProDesk 600 G5 Desktop Mini, intel Core i5-9500T, 16GB RAM, 256GB“ (68).

### REQ-001
- **AC-REQ-001-01** Given resellr im Netzbetrieb, When der Nutzer das gültige Zugangspasswort eingibt, Then hat er Zugang zu allen Funktionen.
- **AC-REQ-001-02** Given resellr im Netzbetrieb, When ein falsches Zugangspasswort eingegeben wird, Then wird der Zugang mit „Zugangspasswort falsch“ abgelehnt und es werden keine Daten angezeigt.
- **AC-REQ-001-03** *Withdrawn in v0.3* (deaktivierte Konten gibt es nicht mehr, E-4, E-5).
- **AC-REQ-001-04** Given resellr im Netzbetrieb und ein Programm, in dem seit seinem Start kein gültiges Zugangspasswort eingegeben wurde (z. B. nach einem Neustart des Programms oder auf einem anderen Gerät), When darin eine beliebige Funktion aufgerufen wird, Then wird der Aufruf abgelehnt und das Zugangspasswort verlangt.
- **AC-REQ-001-05** Given resellr im Betrieb nur am Arbeitsplatzrechner, When der Nutzer resellr aufruft, Then sind alle Funktionen ohne Anmeldung nutzbar, und das System bietet keine Funktion zum Anlegen von Benutzerkonten oder zum Zurücksetzen eines Passworts.
- **AC-REQ-001-06** Given resellr im Netzbetrieb, When die angebotenen Funktionen vollständig mit der Funktionsliste dieses Dokuments verglichen werden, Then gibt es keine Funktion zum Zurücksetzen des Zugangspassworts und keine Funktion zur Kontoverwaltung (Zurücksetzen nur durch den Betreiber außerhalb des Systems).
- **AC-REQ-001-07** Given resellr im Betrieb nur am Arbeitsplatzrechner und ein zweites Gerät im selben lokalen Netz, When von diesem Gerät aus auf resellr zugegriffen wird, Then ist resellr nicht erreichbar: Es werden keine Daten angezeigt und keine Funktion ausgeführt.
- **AC-REQ-001-08** Given resellr im Netzbetrieb und ein Programm, in dem das gültige Zugangspasswort eingegeben wurde, When der Nutzer 8 Stunden lang keine Aktion ausführt und danach eine Funktion aufruft, Then wird die Funktion ohne erneute Eingabe des Zugangspassworts ausgeführt.
- **AC-REQ-001-09** Given resellr im Netzbetrieb und ein Programm, in dem das gültige Zugangspasswort eingegeben wurde, When der Nutzer dieses Programm beendet, neu startet und eine Funktion aufruft, Then wird der Aufruf abgelehnt und das Zugangspasswort verlangt.

### REQ-002
- **AC-REQ-002-01**, **AC-REQ-002-02**, **AC-REQ-002-03** *Withdrawn in v0.3* (REQ-002 zurückgezogen, E-4, E-5).

### REQ-003
- **AC-REQ-003-01**, **AC-REQ-003-02**, **AC-REQ-003-03** *Withdrawn in v0.3* (REQ-003 zurückgezogen; keine Rollen, E-4).

### REQ-096
- **AC-REQ-096-01**, **AC-REQ-096-02** *Withdrawn in v0.3* (REQ-096 zurückgezogen, E-5).

### REQ-097
- **AC-REQ-097-01** *Withdrawn in v0.3* (Kennzeichen „Passwortänderung erforderlich“ entfällt mit REQ-096 und REQ-098).
- **AC-REQ-097-02** Given resellr im Netzbetrieb, When der Nutzer das richtige bisherige Zugangspasswort und zweimal dasselbe neue Zugangspasswort mit 12 Zeichen eingibt, Then zeigt das System „Zugangspasswort geändert“, der Zugang, über den die Änderung erfolgt ist, bleibt bestehen, und jeder neue Zugang (nach einem Neustart des Programms oder von einem anderen Gerät) gelingt nur mit dem neuen Zugangspasswort; das bisherige wird mit „Zugangspasswort falsch“ abgelehnt.
- **AC-REQ-097-03** Given resellr im Netzbetrieb, When der Nutzer ein falsches bisheriges Zugangspasswort eingibt, Then wird die Änderung abgelehnt und das bisherige Zugangspasswort bleibt gültig.
- **AC-REQ-097-04** Given resellr im Netzbetrieb, When die Wiederholung vom neuen Zugangspasswort abweicht, das neue dem bisherigen gleicht oder das neue kürzer als 12 Zeichen ist (z. B. „kurz123“), Then wird die Änderung mit Nennung der verletzten Regel abgelehnt.
- **AC-REQ-097-05** Given resellr im Netzbetrieb und zwei Programme mit erteiltem Zugang (Programm A und Programm B, z. B. auf zwei Geräten), When der Nutzer in Programm A das Zugangspasswort ändert und danach in Programm B eine Funktion aufruft, Then wird der Aufruf in Programm B abgelehnt und das Zugangspasswort verlangt; in Programm A ist die nächste Funktion ohne erneute Eingabe nutzbar.

### REQ-098
- **AC-REQ-098-01**, **AC-REQ-098-02** *Withdrawn in v0.3* (REQ-098 zurückgezogen, E-5).

### REQ-004
- **AC-REQ-004-01** Given der Nutzer, When er die Geräteart „Monitor“ anlegt, Then steht „Monitor“ beim Anlegen einer Modellvorlage zur Auswahl.
- **AC-REQ-004-02** Given die Geräteart „Notebook“ existiert, When der Nutzer eine weitere Geräteart „notebook“ anlegt, Then wird das abgelehnt mit „Name bereits vergeben“.
- **AC-REQ-004-03** Given eine Geräteart mit zugeordneten Modellvorlagen, When der Nutzer sie deaktiviert, Then steht sie für neue Modellvorlagen nicht mehr zur Auswahl, und bestehende Modell-Inserate dieser Geräteart erzeugen weiterhin Kanal-Inhalte.
- **AC-REQ-004-04** Given eine Geräteart mit zugeordneten Modellvorlagen, When der Nutzer sie löschen will, Then wird das abgelehnt mit dem Hinweis auf die Deaktivierung.

### REQ-005
- **AC-REQ-005-01** Given die Geräteart „Monitor“, When der Nutzer das Merkmal „Bildschirmdiagonale“ als Dezimalzahl mit Einheit „Zoll“, Bereich 10–60, Ebene *Modell*, Pflicht anlegt, Then wird das Merkmal beim Anlegen einer Monitor-Modellvorlage als Pflichtfeld abgefragt.
- **AC-REQ-005-02** Given ein Merkmal vom Typ Dezimalzahl, When ein Nutzer „14.01“ eingibt, Then wird der Wert als Zahl 14,01 gespeichert und erscheint nie als Datum.
- **AC-REQ-005-03** Given ein Merkmal vom Typ Ganzzahl mit Bereich 1–5, When ein Nutzer „3 bis 4“ eingibt, Then wird die Eingabe mit Nennung des Merkmals und des zulässigen Bereichs abgelehnt.
- **AC-REQ-005-04** Given ein Merkmal mit gespeicherten Werten, When der Nutzer dessen Datentyp ändern will, Then wird das abgelehnt.
- **AC-REQ-005-05** Given ein Merkmal vom Typ *Mehrfachangabe Anzahl × Typ*, When ein Nutzer „2 × USB-A 3.1“ und „1 × HDMI“ erfasst, Then werden beide Einträge mit Anzahl und Typ gespeichert und im Datenblatt im Block Anschlüsse ausgegeben.
- **AC-REQ-005-06** Given die Geräteart „Monitor“, When der Nutzer das Merkmal „Panel“ mit Ebene *Gerät* und Kennzeichen „variantenbildend“ anlegt, Then vergleicht REQ-018 dieses Merkmal bei Monitoren; ein Merkmal der Ebene *Modell* bietet das Kennzeichen nicht an.
- **AC-REQ-005-07** Given das Merkmal Akkukapazität, When der Nutzer es als „variantenbildend“ kennzeichnen will, Then wird das abgelehnt.
- **AC-REQ-005-08** Given das Merkmal RAM mit gespeicherten Werten, When der Nutzer die Ebene von *Gerät* auf *Modell* ändern will, Then wird das abgelehnt.
- **AC-REQ-005-09** Given MI-A (RAM 16 GB) und ein zweites Modell-Inserat von MV-A, das sich nur beim RAM unterscheidet (8 GB, AC-REQ-019-05), When der Nutzer beim Merkmal RAM der Geräteart Notebook das Kennzeichen „variantenbildend“ entfernen will, Then lehnt das System die Änderung ab, nennt MV-A mit MI-A und dem zweiten Modell-Inserat, und RAM bleibt Variantenmerkmal.
- **AC-REQ-005-10** Given keine Modellvorlage der Geräteart Notebook hat zwei Modell-Inserate, die sich nur beim Betriebssystem unterscheiden, und MI-A mit Betriebssystem „macOS“, When der Nutzer beim Merkmal Betriebssystem das Kennzeichen „variantenbildend“ entfernt und danach ein geprüftes Gerät aus MV-A, das nur beim Betriebssystem („Windows 11 Pro“) von MI-A abweicht, MI-A zuordnet, Then ist die Änderung gespeichert, die bestehenden Zuordnungen und Inseratswerte von MI-A sind unverändert, und die Zuordnung erfolgt ohne Abweichungsanzeige.
- **AC-REQ-005-11** *(neu in v0.3.4)* Given das Merkmal RAM der Geräteart Notebook (Ebene *Gerät*, variantenbildend) ist deaktiviert, und das Gerät „626198“ hat den gespeicherten RAM-Wert 16 GB, When der Nutzer RAM wieder aktiviert, Then wird das Aktivieren ohne Ablehnung ausgeführt, RAM wird beim Erfassen neuer Geräte der Geräteart Notebook wieder abgefragt, das Gerät „626198“ hat weiterhin RAM 16 GB, und RAM ist weiterhin Variantenmerkmal.
- **AC-REQ-005-12** *(neu in v0.3.4, FIND-035; Fall (c) ergänzt in Korrekturrunde 3, FIND-038)* Given das Pflichtmerkmal Prozessor der Geräteart Notebook (Ebene *Modell*) war deaktiviert, als die Modellvorlage „ThinkPad T14“ ohne Prozessor angelegt wurde, das Pflichtmerkmal RAM der Geräteart Notebook (Ebene *Gerät*) war deaktiviert, als ein nicht zugeordnetes Notebook ohne RAM-Wert erfasst und aus einem zweiten, geprüften Notebook ohne RAM-Wert das Modell-Inserat „MI-B“ ohne Preise angelegt wurde, und der Nutzer hat danach Prozessor und RAM wieder aktiviert, When der Nutzer (a) an „ThinkPad T14“ nur die Typbezeichnung ändert und speichert, (b) an dem nicht zugeordneten Notebook nur die Optik-Note ändert und speichert und (c) für „MI-B“ nur den Shop-Preis 499,00 € erfasst und speichert, Then hat „ThinkPad T14“ nach dem Aktivieren weiterhin keinen Prozessor, das Notebook und „MI-B“ haben weiterhin keinen RAM-Wert, das Speichern wird in (a) unter Nennung von „Prozessor“ und in (b) unter Nennung von „RAM“ abgelehnt, nach Eintragen des Prozessors bzw. des RAM-Werts wird die Änderung gespeichert, und in (c) wird der Shop-Preis 499,00 € gespeichert, ohne dass ein RAM-Wert verlangt wird.

### REQ-006
- **AC-REQ-006-01** Given ein neu ausgeliefertes System, When der Nutzer die Einstellungen aufruft, Then stimmen Gerätearten, Merkmale (mit Ebene, Variantenkennzeichen, Pflicht) und Titelmuster mit Kap. 9.3, die Auswahllisten mit Kap. 9.2, die Merkmalszuordnungen mit Kap. 9.8 und Kanäle, Beschreibungsvorlagen und Datenblatt-Layout mit Kap. 9.12 überein (Prüfung Eintrag für Eintrag gegen diese Kapitel).
- **AC-REQ-006-02** Given die Startbelegung, When der Nutzer ein Merkmal der Geräteart Notebook umbenennt, Then wird die Änderung gespeichert (Startbelegung ist Einstellung).
- **AC-REQ-006-03** Given ein neu ausgeliefertes System, When der Nutzer Kategoriezuordnungen, Zustandszuordnungen, Textbausteine, GPSR-Herstellerangaben, Händlerangaben, Code-Übersetzungstabelle und Lieferanten aufruft, Then sind diese leer; nach Erfassung der Startdaten des Pilotkunden aus V-03 (Abnahmeeingabe) lässt sich für MI-A je Kanal ein Kanal-Inhalt freigeben.

### REQ-007
- **AC-REQ-007-01** Given die Auswahlliste Tastaturlayout, When der Nutzer den Wert „Ungarisch (QWERTZ)“ ergänzt, Then steht er beim Erfassen eines Geräts zur Auswahl.
- **AC-REQ-007-02** Given die Auswahlliste Zustand enthält „gebraucht“, When der Nutzer „GEBRAUCHT“ ergänzt, Then wird das als doppelter Wert abgelehnt.
- **AC-REQ-007-03** Given ein Gerät mit Zustand „refurbished“, When der Nutzer diesen Wert deaktiviert, Then behält das Gerät den Wert, und für neue Geräte steht er nicht mehr zur Auswahl.
- **AC-REQ-007-04** Given der Akku-Wert „mit Akku (defekt)“ mit Kennzeichen „Akku vorhanden“, When der Nutzer ihn in „Akku defekt“ umbenennt und danach der Nutzer ein Gerät mit „Akku defekt“ ohne Akkukapazität speichert, Then wird das Speichern mit „Akkukapazität fehlt“ abgelehnt.

### REQ-008
- **AC-REQ-008-01** Given alle Pflichtangaben der Modellvorlage MV-A, When der Nutzer speichert, Then ist MV-A in der Modell-Bibliothek gespeichert und über REQ-009 auffindbar.
- **AC-REQ-008-02** Given Herstellernummer leer und nicht als „unbekannt“ gekennzeichnet, When der Nutzer speichert, Then wird das Speichern abgelehnt mit „Herstellernummer: Wert eingeben oder ‚unbekannt‘ wählen“.
- **AC-REQ-008-03** Given Herstellernummer als „unbekannt“ gekennzeichnet, When der Nutzer speichert, Then wird die Modellvorlage gespeichert und die Herstellernummer als „unbekannt“ angezeigt.
- **AC-REQ-008-04** Given eine Original-EAN „0194252146836“ (falsche Prüfziffer), When der Nutzer speichert, Then wird das Speichern mit „EAN-Prüfziffer ungültig“ abgelehnt.
- **AC-REQ-008-05** Given ein fehlendes Pflichtmerkmal der Ebene *Modell*, When der Nutzer speichert, Then wird das Speichern abgelehnt und das fehlende Merkmal benannt.

### REQ-009
- **AC-REQ-009-01** Given MV-A in der Modell-Bibliothek, When der Nutzer „macbook pro“ sucht, Then enthält die Trefferliste MV-A mit Geräteart, Hersteller, Modellbezeichnung, Typbezeichnung und Herstellernummer.
- **AC-REQ-009-02** Given MV-A, When der Nutzer „MHGT3“ sucht, Then enthält die Trefferliste MV-A.
- **AC-REQ-009-03** Given keine passende Modellvorlage, When der Nutzer „Zenbook“ sucht, Then zeigt das System „Keine Modellvorlage gefunden“ und bietet das Anlegen einer Modellvorlage an.
- **AC-REQ-009-04** Given ein Suchbegriff mit 1 Zeichen, When der Nutzer sucht, Then wird die Suche nicht ausgeführt und auf die Mindestlänge von 2 Zeichen hingewiesen.

### REQ-010
- **AC-REQ-010-01** Given MV-A mit Prozessor „intel Core i5-8279U“ (Ebene *Modell*) und MI-A mit allen Kanal-Inhalten im Status *Entwurf* ohne manuelle Anpassung, When der Nutzer den Prozessor in MV-A auf „intel Core i5-8259U“ ändert, Then zeigen Titel und Merkmalsfeld Prozessor aller Kanal-Inhalte von MI-A „intel Core i5-8259U“.
- **AC-REQ-010-02** Given MV-A mit zugeordneten Geräten, When der Nutzer die Geräteart ändern will, Then wird das abgelehnt.
- **AC-REQ-010-03** Given eine Änderung, die eine Pflichtangabe leert, When der Nutzer speichert, Then wird das Speichern abgelehnt und das Feld benannt.
- **AC-REQ-010-04** Given MI-A mit EAN-Kennzeichnung „Original“ und ein zweites Modell-Inserat von MV-A mit Kennzeichnung „eigene“ und EAN „4255867000014“, When der Nutzer die Original-EAN von MV-A auf „0190199256279“ korrigiert, Then zeigen die Kanal-Inhalte und Datenblätter von MI-A „0190199256279“ und die des zweiten Modell-Inserats weiter „4255867000014“.
- **AC-REQ-010-05** Given ein erfasstes Gerät aus MV-A mit RAM 16 GB, When der Nutzer den Vorbelegungswert RAM in MV-A auf 8 GB ändert, Then behält das erfasste Gerät RAM 16 GB, MI-A bleibt unverändert, und ein danach erfasstes Gerät ist mit 8 GB vorbelegt.

### REQ-011
- **AC-REQ-011-01** Given MV-A existiert, When der Nutzer eine Modellvorlage mit Hersteller Apple und Modellbezeichnung „MacBook  pro 13“ anlegt, Then zeigt das System MV-A als mögliche Dublette und lässt Verwenden oder Bestätigen zu.
- **AC-REQ-011-02** Given keine Modellvorlage mit gleichem Hersteller und gleicher Modellbezeichnung, When der Nutzer speichert, Then erscheint kein Dubletten-Hinweis.

### REQ-100
- **AC-REQ-100-01** Given kein Hersteller „Fujitsu“, When der Nutzer beim Anlegen einer Modellvorlage den Hersteller „ Fujitsu “ neu anlegt, Then besteht der aktive Hersteller „Fujitsu“ mit Status „GPSR unvollständig“ und ist für die Modellvorlage gewählt.
- **AC-REQ-100-02** Given der Hersteller „Lenovo“ existiert, When der Nutzer „lenovo“ neu anlegen will, Then legt das System keinen zweiten Hersteller an, weist auf „Lenovo“ hin und verwendet ihn.
- **AC-REQ-100-03** Given ein leerer Name oder ein Name mit 51 Zeichen, When der Nutzer den Hersteller anlegen will, Then wird das mit Nennung der Regel abgelehnt.

### REQ-101
- **AC-REQ-101-01** Given der Hersteller „Lenvo“ mit Modellvorlagen und Kanal-Inhalten im Status *Entwurf*, When der Nutzer ihn in „Lenovo“ umbenennt, Then zeigen die Titel dieser Kanal-Inhalte „Lenovo“.
- **AC-REQ-101-02** Given ein deaktivierter Hersteller, When der Nutzer eine neue Modellvorlage anlegt, Then steht er nicht zur Auswahl; bestehende Modellvorlagen dieses Herstellers bleiben nutzbar.

### REQ-012
- **AC-REQ-012-01** Given die WI-Nr „626198“ ist nicht vergeben, When der Nutzer ein Gerät mit dieser WI-Nr und MV-A erfasst, Then ist das Gerät mit Bestandsstatus *verfügbar*, Zuordnung „nicht zugeordnet“ und Erfassungsdatum gespeichert.
- **AC-REQ-012-02** Given ein Gerät mit WI-Nr „626198“ (auch verkauft), When der Nutzer ein weiteres Gerät mit „626198“ erfasst, Then wird das abgelehnt und das vorhandene Gerät mit seinem Modell-Inserat genannt.
- **AC-REQ-012-03** Given eine leere WI-Nr oder eine WI-Nr mit Leerzeichen, When der Nutzer speichert, Then wird das mit Nennung der WI-Nr-Regel abgelehnt.
- **AC-REQ-012-04** Given die WI-Nr „A637607“, When der Nutzer sie erfasst, Then wird sie akzeptiert (Buchstaben und Ziffern zulässig).
- **AC-REQ-012-05** Given ein storniertes Gerät mit WI-Nr „633641“, When der Nutzer ein neues Gerät mit „633641“ erfasst, Then wird es gespeichert, und die Suche nach „633641“ (REQ-016) zeigt beide Geräte mit ihrem Bestandsstatus.

### REQ-013
- **AC-REQ-013-01** Given MV-A mit Vorbelegungswerten Akku „mit Akku“ und Akkukapazität 85, When der Nutzer ein Gerät aus MV-A erfasst, Then sind Akku und Akkukapazität (und alle weiteren Merkmale der Ebene *Gerät* mit Vorbelegungswert) vorbelegt und mit Prüfmarkierung versehen, und der Prozessor (Ebene *Modell*) wird als Wert der Modellvorlage ohne Prüfmarkierung angezeigt.
- **AC-REQ-013-02** Given ein Gerät mit Prüfmarkierung an Akkukapazität, When der Nutzer den Wert unverändert bestätigt, Then ist die Prüfmarkierung aufgehoben.
- **AC-REQ-013-03** Given ein Gerät mit mindestens einer Prüfmarkierung, When der Nutzer es MI-A zuordnen (REQ-017) oder daraus ein Modell-Inserat anlegen (REQ-019) will, Then wird das mit „Erst Werte prüfen“ abgelehnt und die markierten Werte werden benannt.
- **AC-REQ-013-04** Given ein Gerät mit mindestens einer Prüfmarkierung, When der Nutzer speichert, Then wird das Gerät mit Erfassungsstatus *unvollständig geprüft* gespeichert; nach Aufheben aller Prüfmarkierungen ist der Erfassungsstatus *geprüft*.

### REQ-014
- **AC-REQ-014-01** Given ein Gerät der Geräteart Notebook, When der Nutzer Zustand „gebraucht“, Optik-Note 3, Tastaturlayout „Deutsch (QWERTZ)“, Netzteil „mit Netzteil (original)“, Akku „mit Akku“, Akkukapazität 77 erfasst, Then sind alle Werte gespeichert.
- **AC-REQ-014-02** Given Akku „mit Akku“, When der Nutzer Akkukapazität 101 eingibt, Then wird das mit „zulässig: 0–100 oder ‚nicht ermittelbar‘“ abgelehnt.
- **AC-REQ-014-03** Given Akku „mit Akku“ und BIOS-Passwort, When der Nutzer Akkukapazität „nicht ermittelbar“ wählt, Then wird das gespeichert.
- **AC-REQ-014-04** Given Optik-Note leer, When der Nutzer speichert, Then wird das Speichern mit „Optik-Note fehlt“ abgelehnt.
- **AC-REQ-014-05** Given Akku „ohne Akku“, When der Nutzer speichert, Then ist keine Akkukapazität erforderlich.
- **AC-REQ-014-06** Given Akku „mit Akku (defekt)“ und keine Akkukapazität, When der Nutzer speichert, Then wird das Speichern mit „Akkukapazität fehlt“ abgelehnt.
- **AC-REQ-014-07** Given ein MI-A zugeordnetes Gerät, When der Nutzer dessen Optik-Note von 2 auf 4 ändert, Then zeigt das System „Optik-Note: Gerät 4, Modell-Inserat 2“ mindestens mit der Wahl „Zuordnung beibehalten“ oder „neues Modell-Inserat anlegen“, und MI-A bleibt unverändert. (Die zusätzliche Wahl „umbuchen“ prüft AC-REQ-020-04.)
- **AC-REQ-014-08** Given ein MI-A zugeordnetes Gerät mit Akkukapazität 85, When der Nutzer sie auf 80 ändert, Then erscheint keine Abweichungsanzeige, und `{Akkukapazität}` in den Kanal-Inhalten von MI-A zeigt den neuen Wert (REQ-091).

### REQ-015
- **AC-REQ-015-01** Given ein Tabelleneintrag „DGS“ ohne Lieferant mit Klartext „Display- und Gehäuseschaden“ (Testwert), When der Nutzer beim Gerät den Code „dgs“ eingibt, Then steht „Display- und Gehäuseschaden“ in der Zustandsbeschreibung und „DGS“ ist als Zustandscode gespeichert.
- **AC-REQ-015-02** Given zusätzlich ein Eintrag „DGS“ für Lieferant „L1“ mit anderem Klartext, When der Nutzer Lieferant „L1“ und Code „DGS“ eingibt, Then wird der Klartext des Lieferanten „L1“ übernommen.
- **AC-REQ-015-03** Given der Code „XYZ“ ist nicht in der Tabelle, When der Nutzer ihn eingibt, Then zeigt das System „Zustandscode unbekannt“, übernimmt keinen Text und lässt die manuelle Eingabe der Zustandsbeschreibung zu.
- **AC-REQ-015-04** Given ein Tabelleneintrag mit Vorschlag Optik-Note 4, When der Code eingegeben wird, Then ist die Optik-Note mit 4 vorbelegt und mit Prüfmarkierung versehen.

### REQ-016
- **AC-REQ-016-01** Given ein Gerät mit WI-Nr „616027“, When der Nutzer „6160“ sucht, Then enthält die Trefferliste dieses Gerät mit Modellvorlage, Modell-Inserat (oder „nicht zugeordnet“), Bestandsstatus und Erfassungsstatus.
- **AC-REQ-016-02** Given keine passende WI-Nr, When der Nutzer sucht, Then zeigt das System „Kein Gerät mit dieser WI-Nr“.

### REQ-017
- **AC-REQ-017-01** Given MI-A mit Stückzahl 1 und ein geprüftes, nicht zugeordnetes Gerät aus MV-A ohne Abweichung in den Variantenangaben, When der Nutzer das Gerät zuordnet, Then hat MI-A Stückzahl 2.
- **AC-REQ-017-02** Given ein Gerät aus einer anderen Modellvorlage, When der Nutzer es einem Modell-Inserat von MV-A zuordnen will, Then wird das abgelehnt.
- **AC-REQ-017-03** Given MV-A hat kein Modell-Inserat, When der Nutzer ein Gerät aus MV-A zuordnen will, Then bietet das System nur das Anlegen eines neuen Modell-Inserats an.
- **AC-REQ-017-04** Given ein Gerät, das bereits einem Modell-Inserat zugeordnet ist, When der Nutzer es mit REQ-017 einem anderen Modell-Inserat zuordnen will, Then wird das abgelehnt und das Gerät bleibt dem bisherigen Modell-Inserat zugeordnet.

### REQ-018
- **AC-REQ-018-01** Given MI-A (Optik-Note 2) und ein geprüftes Gerät aus MV-A, das nur in der Optik-Note (4) abweicht, When der Nutzer das Gerät MI-A zuordnen will, Then zeigt das System „Optik-Note: Gerät 4, Modell-Inserat 2“ und die Wahl „trotzdem zuordnen“ oder „neues Modell-Inserat anlegen“.
- **AC-REQ-018-02** Given die Anzeige aus AC-REQ-018-01, When der Nutzer „trotzdem zuordnen“ wählt, Then steigt die Stückzahl von MI-A um 1, die Optik-Note von MI-A bleibt 2, und das Änderungsprotokoll enthält die Entscheidung mit Zeitpunkt und abweichender Angabe.
- **AC-REQ-018-03** Given ein geprüftes Gerät aus MV-A, dessen Variantenangaben mit MI-A übereinstimmen, das aber Akkukapazität 77 (MI-A-Gerät: 85), Betriebssystem-Version „14.6“ (MI-A: „15.1“) und Zustandsbeschreibung „ Leichte Gebrauchsspuren “ (abweichende Groß-/Kleinschreibung und Leerzeichen am Rand) hat, When der Nutzer zuordnet, Then erfolgt die Zuordnung ohne Rückfrage.
- **AC-REQ-018-04** Given MI-A (RAM 16 GB) und ein geprüftes Gerät aus MV-A mit RAM 8 GB, When der Nutzer zuordnen will, Then zeigt das System die Abweichung „RAM: Gerät 8GB, Modell-Inserat 16GB“.
- **AC-REQ-018-05** Given MI-A mit Zustandsbeschreibung „leichte Gebrauchsspuren“ und ein geprüftes Gerät aus MV-A mit gleichem Zustand und gleicher Optik-Note, dessen Zustandsbeschreibung per Zustandscode „DGS“ „Display- und Gehäuseschaden“ lautet, When der Nutzer zuordnen will, Then zeigt das System beide Zustandsbeschreibungen vollständig als Abweichung und ordnet erst nach der Wahl des Nutzers zu.
- **AC-REQ-018-06** Given MI-A (Tastaturlayout „Deutsch (QWERTZ)“) und ein geprüftes Gerät aus MV-A mit Tastaturlayout „Ungarisch“, When der Nutzer zuordnen will, Then zeigt das System die Abweichung beim Tastaturlayout.

### REQ-019
- **AC-REQ-019-01** Given ein geprüftes, nicht zugeordnetes Gerät mit WI-Nr „626198“ aus MV-A und kein Modell-Inserat von MV-A, When der Nutzer daraus ein neues Modell-Inserat anlegt, Then hat es Stückzahl 1, Artikelnummer „626198“, EAN-Kennzeichnung „Original“ (EAN „0194252146835“), leeren Lieferumfang, die Variantenangaben und übrigen inserierten Gerätewerte des Geräts und je aktivem Kanal einen Kanal-Inhalt im Status *Entwurf*.
- **AC-REQ-019-02** Given MI-A besteht, When der Nutzer aus einem geprüften Gerät aus MV-A mit denselben Variantenangaben wie MI-A ein weiteres Modell-Inserat anlegen will, Then wird das abgelehnt mit Verweis auf MI-A.
- **AC-REQ-019-03** Given MI-A besteht, When der Nutzer aus einem geprüften Gerät aus MV-A mit Optik-Note 4 und Zustandsbeschreibung „Display gebrochen“ (sonst wie MI-A) ein Modell-Inserat anlegt, Then bestehen für MV-A zwei Modell-Inserate.
- **AC-REQ-019-04** Given MI-A mit Artikelnummer „626198“ und ein zweites Modell-Inserat von MV-A, When der Nutzer dessen Artikelnummer über REQ-088 auf „626198“ ändern will, Then wird das mit „Artikelnummer bereits vergeben“ abgelehnt.
- **AC-REQ-019-05** Given MI-A (RAM 16 GB) und ein geprüftes Gerät aus MV-A, das nur beim RAM abweicht (8 GB), When der Nutzer in der Abweichungsanzeige „neues Modell-Inserat anlegen“ wählt, Then entsteht ein zweites Modell-Inserat von MV-A mit RAM 8 GB, dessen ungekürzter Shop-Titel „Apple MacBook Pro 13 (A1989), intel Core i5-8279U, 8GB RAM, 512GB Space Gray“ (76 Zeichen) lautet.
- **AC-REQ-019-06** Given MI-A und ein geprüftes Gerät aus MV-A, das nur beim Tastaturlayout abweicht („Ungarisch“), When der Nutzer ein neues Modell-Inserat anlegt, Then wird es angelegt (Tastaturlayout ist Variantenmerkmal).
- **AC-REQ-019-07** Given ein Gerät, das MI-A (Stückzahl 3) zugeordnet ist und dessen Optik-Note nachträglich auf 4 geändert wurde, When der Nutzer daraus ein neues Modell-Inserat anlegt, Then hat MI-A Stückzahl 2 und das neue Modell-Inserat Stückzahl 1.

### REQ-020
- **AC-REQ-020-01** Given Modell-Inserat X (Stückzahl 2) und Y (Stückzahl 1) derselben Modellvorlage, When der Nutzer ein verfügbares Gerät von X nach Y umbucht, Then hat X Stückzahl 1 und Y Stückzahl 2.
- **AC-REQ-020-02** Given ein verkauftes Gerät, When der Nutzer es umbuchen will, Then wird das abgelehnt.
- **AC-REQ-020-03** Given Modell-Inserat X mit Stückzahl 1 und ohne verkaufte Geräte, When der Nutzer das letzte Gerät nach Y umbucht, Then besteht X mit Stückzahl 0 weiter und wird nicht automatisch gelöscht.
- **AC-REQ-020-04** Given ein MI-A zugeordnetes Gerät und ein zweites Modell-Inserat von MV-A mit Optik-Note 4 (sonst wie MI-A), When der Nutzer die Optik-Note des Geräts von 2 auf 4 ändert (REQ-014), Then bietet die Abweichungsanzeige zusätzlich „umbuchen“ an; wählt der Nutzer das zweite Modell-Inserat, sinkt die Stückzahl von MI-A um 1 und die des zweiten Modell-Inserats steigt um 1.

### REQ-021
- **AC-REQ-021-01** Given ein verfügbares Gerät eines Modell-Inserats mit Stückzahl 2, When der Nutzer es als verkauft über Kanal Kleinanzeigen mit heutigem Datum markiert, Then hat das Modell-Inserat Stückzahl 1 und die Inserat-Übersicht zeigt 1 verkauftes Gerät bei Kleinanzeigen.
- **AC-REQ-021-02** Given ein Verkaufsdatum in der Zukunft, When der Nutzer speichert, Then wird das abgelehnt.
- **AC-REQ-021-03** *Withdrawn in v0.2* (Rücknahme ist eigene Anforderung REQ-084; ersetzt durch AC-REQ-084-01).
- **AC-REQ-021-04** Given ein verkauftes Gerät, When der Nutzer es erneut als verkauft markieren will, Then wird das abgelehnt.
- **AC-REQ-021-05** Given ein nicht zugeordnetes Gerät, When der Nutzer es als verkauft markieren will, Then wird das mit „Gerät keinem Modell-Inserat zugeordnet“ abgelehnt.
- **AC-REQ-021-06** Given ein verfügbares Gerät, When der Nutzer es als verkauft markiert, Then enthält das Änderungsprotokoll den Vorgang mit Kanal und Datum.

### REQ-084
- **AC-REQ-084-01** Given ein über Kleinanzeigen verkauftes Gerät von MI-A (Stückzahl 1), When der Nutzer die Verkaufsmarkierung zurücknimmt, Then ist das Gerät *verfügbar*, MI-A hat Stückzahl 2, die Übersicht zeigt bei Kleinanzeigen ein verkauftes Gerät weniger, und das Protokoll enthält die Rücknahme mit bisherigem Kanal und Datum.
- **AC-REQ-084-02** Given ein verfügbares Gerät, When der Nutzer eine Verkaufsmarkierung zurücknehmen will, Then wird das mit „Gerät ist nicht als verkauft markiert“ abgelehnt.

### REQ-088
- **AC-REQ-088-01** Given MI-A mit Kanal-Inhalten im Status *Entwurf*, When der Nutzer die Zustandsbeschreibung von MI-A in „leichte Gebrauchsspuren am Deckel“ ändert, Then enthalten die Beschreibungen aller Kanal-Inhalte, deren Beschreibungsvorlage `{Zustandsbeschreibung}` enthält, den neuen Text.
- **AC-REQ-088-02** Given MI-A und ein zweites Modell-Inserat von MV-A mit Optik-Note 4 (sonst gleich), When der Nutzer die Optik-Note von MI-A auf 4 ändern will, Then wird das abgelehnt mit Verweis auf das zweite Modell-Inserat.
- **AC-REQ-088-03** Given MI-A mit zwei zugeordneten verfügbaren Geräten mit Optik-Note 2, When der Nutzer die Optik-Note von MI-A auf 3 ändert, Then nennt das System beide Geräte mit „Optik-Note: Gerät 2, Modell-Inserat 3“ und speichert erst nach Bestätigung; die Bestätigung ist protokolliert.
- **AC-REQ-088-04** Given MI-A, When der Nutzer die EAN-Kennzeichnung auf „eigene“ setzt und „4255867000015“ (falsche Prüfziffer) eingibt, Then wird das mit „EAN-Prüfziffer ungültig“ abgelehnt; mit „4255867000014“ wird gespeichert und alle Kanal-Inhalte und Datenblätter von MI-A zeigen „4255867000014“.
- **AC-REQ-088-05** Given aktive Textbausteine der Art *Lieferumfang* „Netzkabel“ und „Originalverpackung“, When der Nutzer für MI-A beide als Lieferumfang wählt, Then gibt `{Lieferumfang}` in den Kanal-Inhalten von MI-A die Texte beider Textbausteine aus.
- **AC-REQ-088-06** Given MI-A, When der Nutzer am Modell-Inserat den Prozessor ändern will, Then ist das nicht möglich und das System verweist auf die Modellvorlage (REQ-010).

### REQ-092
- **AC-REQ-092-01** Given ein Gerät mit WI-Nr „626199“ in MI-A, When der Nutzer die WI-Nr auf „626189“ korrigiert, Then trägt das Gerät „626189“, `{WI-Nr}` in den Kanal-Inhalten von MI-A enthält „626189“ statt „626199“, und das Protokoll enthält alte und neue WI-Nr.
- **AC-REQ-092-02** Given ein anderes Gerät mit WI-Nr „626198“, When der Nutzer eine WI-Nr auf „626198“ korrigieren will, Then wird das wie in AC-REQ-012-02 abgelehnt.

### REQ-093
- **AC-REQ-093-01** Given ein verfügbares Gerät mit WI-Nr „633641“ in MI-A (Stückzahl 2), When der Nutzer es mit Grund „falsche Modellvorlage“ storniert, Then hat das Gerät Bestandsstatus *storniert*, MI-A Stückzahl 1, und der Vorgang ist mit Grund protokolliert.
- **AC-REQ-093-02** Given ein verkauftes Gerät, When der Nutzer es stornieren will, Then wird das abgelehnt.
- **AC-REQ-093-03** Given ein verfügbares Gerät, When der Nutzer es ohne Grund stornieren will, Then wird das mit „Grund fehlt“ abgelehnt.

### REQ-094
- **AC-REQ-094-01** Given zwei nicht zugeordnete verfügbare Geräte (erfasst am 03.11.2026 und 05.11.2026) und ein zugeordnetes Gerät, When der Nutzer die Liste aufruft, Then enthält sie genau die zwei Geräte, das vom 03.11.2026 zuerst, jeweils mit WI-Nr, Modellvorlage, Erfassungsstatus und Erfassungsdatum.
- **AC-REQ-094-02** Given kein nicht zugeordnetes Gerät, When der Nutzer die Liste aufruft, Then zeigt sie „Keine nicht zugeordneten Geräte“.

### REQ-095
- **AC-REQ-095-01** Given ein Modell-Inserat mit Stückzahl 0, ohne verkaufte Geräte und ohne veröffentlichten Kanal-Inhalt, When der Nutzer es nach Bestätigung löscht, Then sind Modell-Inserat und Kanal-Inhalte entfernt und die Löschung ist protokolliert.
- **AC-REQ-095-02** Given ein Modell-Inserat mit einem verkauften Gerät, When der Nutzer es löschen will, Then wird das mit Nennung des Grunds abgelehnt.
- **AC-REQ-095-03** Given eine Modellvorlage, auf die ein storniertes Gerät verweist, When der Nutzer sie löschen will, Then wird das abgelehnt.
- **AC-REQ-095-04** *Withdrawn in v0.3* (keine Rollen, E-4).

### REQ-022
- **AC-REQ-022-01** Given der Nutzer, When er „DGS“ mit Klartext anlegt, Then wird der Klartext bei der nächsten Erfassung des Codes übernommen (REQ-015).
- **AC-REQ-022-02** Given ein Eintrag „DGS“ ohne Lieferant, When der Nutzer einen zweiten Eintrag „dgs“ ohne Lieferant anlegt, Then wird das als doppelter Eintrag abgelehnt.
- **AC-REQ-022-03** Given ein Gerät mit übernommenem Klartext zu „DGS“, When der Nutzer den Klartext von „DGS“ ändert, Then bleibt die Zustandsbeschreibung des Geräts unverändert.
- **AC-REQ-022-04** Given ein Eintrag ohne Klartext, When der Nutzer speichert, Then wird das mit „Klartext fehlt“ abgelehnt.

### REQ-099
- **AC-REQ-099-01** Given der Nutzer, When er den Lieferanten „L1“ anlegt, Then steht „L1“ beim Erfassen eines Geräts und in der Code-Übersetzungstabelle zur Auswahl.
- **AC-REQ-099-02** Given der Lieferant „L1“ existiert, When der Nutzer „l1“ anlegt, Then wird das als doppelter Name abgelehnt.
- **AC-REQ-099-03** Given „L1“ wird von Geräten verwendet, When der Nutzer „L1“ deaktiviert, Then behalten die Geräte den Lieferanten, und für neue Geräte steht „L1“ nicht mehr zur Auswahl.
- **AC-REQ-099-04** *Withdrawn in v0.3* (keine Rollen, E-4).

### REQ-023
- **AC-REQ-023-01** Given Einträge für Kleinanzeigen „gebraucht/Note 2 → Gut“ und „gebraucht/alle Noten → In Ordnung“, When ein Modell-Inserat mit „gebraucht“ und Optik-Note 2 einen Kleinanzeigen-Kanal-Inhalt erzeugt, Then lautet die Zustandsbezeichnung „Gut“.
- **AC-REQ-023-02** Given dieselben Einträge, When das Modell-Inserat Optik-Note 4 hat, Then lautet die Zustandsbezeichnung „In Ordnung“.
- **AC-REQ-023-03** Given ein Eintrag für Kleinanzeigen „gebraucht/Note 2“ existiert, When der Nutzer einen zweiten Eintrag für dieselbe Kombination anlegt, Then wird das abgelehnt.
- **AC-REQ-023-04** Given ein neuer Eintrag mit Zusatzangabe „Bestand {Stückzahl}“, When der Nutzer speichert, Then wird das abgelehnt und `{Stückzahl}` als in Zusatzangaben unzulässiger Platzhalter benannt.

### REQ-024
- **AC-REQ-024-01** Given die Kategoriezuordnung „PC/Mini-PC → Kleinanzeigen: PCs“ (Testwert), When ein Modell-Inserat der Geräteart PC/Mini-PC einen Kleinanzeigen-Kanal-Inhalt erzeugt, Then lautet der Kategorievorschlag „PCs“.
- **AC-REQ-024-02** Given eine Kategoriezuordnung für Notebook und Shop existiert, When der Nutzer eine zweite für Notebook und Shop anlegt, Then ersetzt sie die bestehende nicht stillschweigend, sondern das System lehnt ab und verweist auf den vorhandenen Eintrag.

### REQ-025
- **AC-REQ-025-01** Given eine Merkmalszuordnung Kleinanzeigen/Notebook mit Feldern „Marke ← Hersteller“, „Prozessor ← Prozessor“, „Arbeitsspeicher ← RAM“ in dieser Reihenfolge, When ein Kanal-Inhalt erzeugt wird, Then enthält er genau diese Merkmalsfelder in dieser Reihenfolge mit den Werten des Modell-Inserats.
- **AC-REQ-025-02** Given eine Wertzuordnung „refurbished → Generalüberholt“ für ein Feld eines Kanals, When ein Kanal-Inhalt mit Wert „refurbished“ erzeugt wird, Then steht im Merkmalsfeld „Generalüberholt“.
- **AC-REQ-025-03** Given eine Merkmalszuordnung Shop/Notebook mit dem Feld „Menge ← Stückzahl“ und dem Feld „Typ ← fester Text ‚Notebook‘“, When der Shop-Kanal-Inhalt von MI-A (Stückzahl 2) erzeugt wird, Then lautet das Feld „Menge“ „2“ und das Feld „Typ“ „Notebook“.
- **AC-REQ-025-04** Given der Nutzer, When er als Quelle eines Felds etwas anderes als einen Eintrag der Liste in Kap. 9.11 angeben will, Then ist das nicht möglich.

### REQ-026
- **AC-REQ-026-01** Given der Nutzer, When er den Textbaustein „Akku-Hinweis“ der Art *Akku-Hinweis* mit Platzhalter `{Akkukapazität}` für alle Gerätearten mit Akku-Merkmal und alle Kanäle anlegt, Then erscheint der Text mit eingesetztem Wert in den danach erzeugten Kanal-Inhalten solcher Modell-Inserate.
- **AC-REQ-026-02** Given ein Text mit dem Platzhalter `{Garantiezeit}`, der nicht in Kap. 9.7 steht, When der Nutzer speichert, Then wird das abgelehnt und der unbekannte Platzhalter benannt.
- **AC-REQ-026-03** Given ein Textbaustein mit Geltungsbereich nur Kanal Kleinanzeigen, When ein Shop-Kanal-Inhalt erzeugt wird, Then enthält er den Textbaustein nicht.
- **AC-REQ-026-04** Given ein deaktivierter Textbaustein, When ein Kanal-Inhalt neu erzeugt wird, Then enthält er den Textbaustein nicht.

### REQ-027
- **AC-REQ-027-01** Given der Hersteller Lenovo ohne GPSR-Herstellerangaben, When der Nutzer Herstellername, vollständige Postanschrift und E-Mail-Adresse speichert, Then gilt Lenovo als „GPSR vollständig“.
- **AC-REQ-027-02** Given Postanschrift ohne Postleitzahl, When der Nutzer speichert, Then wird das Speichern nicht abgelehnt, aber der Hersteller gilt als nicht „GPSR vollständig“ und das fehlende Feld wird benannt.

### REQ-028
- **AC-REQ-028-01** Given der Nutzer, When er Händlermarke „notebookers.de“ und ein Logo speichert, Then erscheinen Name und Logo im nächsten erzeugten Datenblatt.
- **AC-REQ-028-02** Given eine Logo-Datei im Format GIF oder eine PNG-Datei mit 6 MB, When der Nutzer speichert, Then wird das mit Nennung der zulässigen Formate PNG und JPEG und der Höchstgröße 5 MB abgelehnt.

### REQ-029
- **AC-REQ-029-01** Given die Kanäle Shop, Kleinanzeigen und eBay sind aktiv, When der Nutzer eBay deaktiviert und danach ein Modell-Inserat angelegt wird, Then entstehen Kanal-Inhalte nur für Shop und Kleinanzeigen.
- **AC-REQ-029-02** Given eBay ist deaktiviert und es existieren eBay-Kanal-Inhalte, When der Nutzer ein Modell-Inserat öffnet, Then sind dessen eBay-Kanal-Inhalte weiterhin lesbar.
- **AC-REQ-029-03** Given Kanal-Inhalte für Shop und Kleinanzeigen, When der Nutzer die Titel-Höchstlänge von Kleinanzeigen ändert, Then sind alle Shop-Kanal-Inhalte zeichengleich zum Stand vorher.

### REQ-030
- **AC-REQ-030-01** Given das Test-Titelmuster und MI-A, When ein Shop-Kanal-Inhalt erzeugt wird, Then lautet der Titel „Apple MacBook Pro 13 (A1989), intel Core i5-8279U, 16GB RAM, 512GB Space Gray“ (77 Zeichen).
- **AC-REQ-030-02** Given ein Titelmuster ohne Platzhalter Modellbezeichnung, When der Nutzer speichert, Then wird das abgelehnt.
- **AC-REQ-030-03** Given ein kanaleigenes Titelmuster für eBay, When ein eBay-Kanal-Inhalt erzeugt wird, Then wird das kanaleigene Titelmuster verwendet und für Shop weiterhin das Titelmuster der Geräteart.
- **AC-REQ-030-04** Given ein Titelmuster mit dem Bestandteil `{WI-Nr}`, When der Nutzer speichert, Then wird das abgelehnt und `{WI-Nr}` als im Titelmuster unzulässiger Platzhalter benannt.
- **AC-REQ-030-05** Given das Test-Titelmuster und MI-A mit MV-A ohne Typbezeichnung, When ein Shop-Kanal-Inhalt erzeugt wird, Then lautet der Titel „Apple MacBook Pro 13, intel Core i5-8279U, 16GB RAM, 512GB Space Gray“ (69 Zeichen) ohne „()“ und ohne doppeltes Leerzeichen.

### REQ-031
- **AC-REQ-031-01** Given eine Shop-Beschreibungsvorlage mit den Abschnitten „Zustand“, „Lieferumfang“ und „Artikeldetails“, When ein Shop-Kanal-Inhalt erzeugt wird, Then enthält die Beschreibung diese drei Abschnitte in dieser Reihenfolge mit den Werten des Modell-Inserats.
- **AC-REQ-031-02** Given ein Abschnitt, dessen Platzhalter alle leer sind, When die Beschreibung erzeugt wird, Then fehlen Abschnitt und Überschrift.
- **AC-REQ-031-03** Given eine Kleinanzeigen-Beschreibungsvorlage, die mit `WI-Nr: {WI-Nr}` und `ProduktNr. {Herstellernummer}` beginnt, When ein Kanal-Inhalt mit Herstellernummer „unbekannt“ erzeugt wird, Then fehlt die Zeile „ProduktNr.“.

### REQ-032
- **AC-REQ-032-01** Given ein Modell-Inserat, When der Nutzer Shop 269,00 € und Kleinanzeigen 279,00 € erfasst, Then zeigt der Shop-Kanal-Inhalt 269,00 € und der Kleinanzeigen-Kanal-Inhalt 279,00 €.
- **AC-REQ-032-02** Given Kleinanzeigen lässt „Verhandlungsbasis“ zu, When der Nutzer 50 € mit Verhandlungsbasis erfasst, Then zeigt der Kleinanzeigen-Kanal-Inhalt „50,00 € VB“.
- **AC-REQ-032-03** Given ein Preis von 0 oder „12,345“, When der Nutzer speichert, Then wird das mit Nennung der Preisregel abgelehnt.
- **AC-REQ-032-04** Given Shop lässt „Verhandlungsbasis“ nicht zu, When der Nutzer den Shop-Preis erfasst, Then ist der Zusatz nicht wählbar.

### REQ-033
- **AC-REQ-033-01** Given Preisregel Kleinanzeigen = Shop + 10,00 €, When der Nutzer den Shop-Preis 289,00 € erfasst, Then ist der Kleinanzeigen-Preis mit 299,00 € vorbelegt.
- **AC-REQ-033-02** Given der Nutzer hat den Kleinanzeigen-Preis auf 290,00 € geändert, When er danach den Shop-Preis ändert, Then bleibt der Kleinanzeigen-Preis 290,00 €.
- **AC-REQ-033-03** Given Preisregel Kleinanzeigen = Shop − 100,00 € und Shop-Preis 89,00 €, When der Shop-Preis erfasst wird, Then wird kein Kleinanzeigen-Preis vorgeschlagen.

### REQ-085
- **AC-REQ-085-01** Given der Nutzer, When er für Kleinanzeigen die Preisregel Bezugskanal Shop, Aufschlag 10,00 € speichert, Then gilt AC-REQ-033-01 für danach erfasste Preise, und bereits erfasste Kleinanzeigen-Preise bleiben unverändert.
- **AC-REQ-085-02** Given Preisregel Kleinanzeigen ← Shop, When der Nutzer die Preisregel Shop ← Kleinanzeigen speichern will, Then wird das als Kreis abgelehnt.
- **AC-REQ-085-03** Given der Nutzer, When er Shop als Bezugskanal von Shop festlegen will, Then wird das abgelehnt.

### REQ-034
- **AC-REQ-034-01** Given MV-A ohne Farbe, When ein Shop-Kanal-Inhalt erzeugt wird, Then lautet der Titel „Apple MacBook Pro 13 (A1989), intel Core i5-8279U, 16GB RAM, 512GB“ ohne überzähliges Trennzeichen.
- **AC-REQ-034-02** Given ein Kanal-Inhalt von MI-A im Status *Entwurf* ohne manuelle Anpassung, When der Nutzer die Farbe in MV-A (Ebene *Modell*) auf „Silber“ ändert, Then endet der Titel mit „Silber“.

### REQ-035
- **AC-REQ-035-01** Given das Test-Titelmuster, MI-A und Kleinanzeigen-Höchstlänge 65, When ein Kleinanzeigen-Kanal-Inhalt erzeugt wird, Then entfallen erst der Bestandteil Farbe „ Space Gray“ (77 → 66 Zeichen) und dann der Bestandteil Speicherkapazität „, 512GB“ (66 → 59), und der Titel lautet „Apple MacBook Pro 13 (A1989), intel Core i5-8279U, 16GB RAM“ (59 Zeichen).
- **AC-REQ-035-02** Given ein Titel innerhalb der Höchstlänge, When der Kanal-Inhalt erzeugt wird, Then wird nichts weggelassen.
- **AC-REQ-035-03** Given Hersteller und Modellbezeichnung zusammen länger als die Höchstlänge, When der Kanal-Inhalt erzeugt wird, Then endet der Titel am letzten Wortende vor der Höchstlänge und der Kanal-Inhalt trägt „Titel gekürzt, bitte prüfen“.
- **AC-REQ-035-04** Given die Testmenge TM-1 und je Element die Höchstlängen 40, 65, 80 und 128 (16 Titel), When die Titel erzeugt werden, Then ist jeder Titel höchstens so lang wie seine Höchstlänge, jedes Wort jedes Titels ist ein vollständiges Wort des ungekürzten Titels (kein abgeschnittener Wortteil wie „512G“), und genau die Titel, bei denen die Bestandteile mit Kürzungspriorität 1 die Höchstlänge überschreiten (bei TM-1: alle vier Elemente mit Höchstlänge 40), tragen „Titel gekürzt, bitte prüfen“.

### REQ-036
- **AC-REQ-036-01** Given die Shop-Beschreibungsvorlage, ein aktiver Akku-Hinweis und ein Modell-Inserat mit einem Gerät (Akkukapazität 77), When der Shop-Kanal-Inhalt erzeugt wird, Then enthält die Beschreibung den Akku-Hinweis mit „77 %“.
- **AC-REQ-036-02** Given ein Textbaustein mit Geltung nur für Geräteart Smartphone, When ein Notebook-Kanal-Inhalt erzeugt wird, Then enthält die Beschreibung diesen Textbaustein nicht.
- **AC-REQ-036-03** Given ein Modell-Inserat mit zwei verfügbaren Geräten mit Akkukapazität 82 und 90, When die Beschreibung erzeugt wird, Then wird der Platzhalter Akkukapazität mit „82–90 %“ gefüllt (A-16).
- **AC-REQ-036-04** Given ein Modell-Inserat mit zwei verfügbaren Geräten mit Akku „mit Akku“, davon eines mit Akkukapazität 85 und eines mit „nicht ermittelbar“, und ein aktiver Akku-Hinweis mit `{Akkukapazität}`, When die Beschreibung erzeugt wird, Then lautet der eingesetzte Wert „85 % bzw. nicht ermittelbar“.
- **AC-REQ-036-05** Given ein Modell-Inserat mit zwei verfügbaren Geräten: eines mit Akku „mit Akku“ und Akkukapazität „nicht ermittelbar“, eines per „trotzdem zuordnen“ mit Akku „ohne Akku“ ohne Akkukapazität, When die Beschreibung erzeugt wird, Then lautet `{Akkukapazität}` „nicht ermittelbar“ (das Gerät ohne Akku geht nicht ein); wird das erste Gerät verkauft, ist `{Akkukapazität}` leer.

### REQ-037
- **AC-REQ-037-01** Given die Merkmalszuordnung aus AC-REQ-025-01 und ein Modell-Inserat ohne Wert für „Farbe“ (zugeordnet), When der Kanal-Inhalt erzeugt wird, Then ist das Feld „Farbe“ im Kanal-Inhalt leer und erscheint nach der Freigabe nicht in der Feldliste des Kopier-Assistenten (AC-REQ-047-07; geändert in v0.3.2 als Änderung der mit v0.3 freigegebenen Regel: bisher im Kopier-Assistenten als „leer“ gekennzeichnet, jetzt nicht mehr angezeigt; Quelle: Design-Annahme an MAR-126, vom Product Owner bestätigt; Bestätigung durch den Owner mit der Freigabe).

### REQ-038
- **AC-REQ-038-01** Given eine Kategoriezuordnung Notebook → Shop „Notebooks“, When ein Shop-Kanal-Inhalt eines Notebook-Modell-Inserats erzeugt wird, Then ist die Kategorie „Notebooks“ vorgeschlagen.
- **AC-REQ-038-02** *Withdrawn in v0.2* (Überschreiben ist eigene Anforderung REQ-086; ersetzt durch AC-REQ-086-01).
- **AC-REQ-038-03** Given keine Kategoriezuordnung für Geräteart Tablet und eBay, When ein eBay-Kanal-Inhalt eines Tablet-Modell-Inserats erzeugt wird, Then ist die Kategorie leer und der Kanal-Inhalt zeigt „Kategorie fehlt“.

### REQ-086
- **AC-REQ-086-01** Given ein Shop-Kanal-Inhalt im Status *Entwurf* mit dem Vorschlag „Notebooks“, When der Nutzer die Kategorie auf „Defektware“ ändert, Then zeigt der Kanal-Inhalt „Defektware“ mit „Kategorie manuell“, und Kanal-Inhalte anderer Kanäle bleiben unverändert.
- **AC-REQ-086-02** Given die manuelle Kategorie aus AC-REQ-086-01, When der Nutzer die Kategoriezuordnung Notebook → Shop in „Laptops“ ändert, Then bleibt „Defektware“; verwirft der Nutzer die manuelle Kategorie, gilt „Laptops“.
- **AC-REQ-086-03** Given ein Shop-Kanal-Inhalt im Status *Veröffentlicht* mit Kategorie „Notebooks“, When der Nutzer die Kategorie auf „Defektware“ ändert, Then bleibt der Status *Veröffentlicht*, der Kanal-Inhalt trägt „geändert seit Freigabe“, der Änderungsentwurf enthält „Defektware“ und der Kopier-Assistent zeigt weiter „Notebooks“.

### REQ-039
- **AC-REQ-039-01** Given eine Zustandszuordnung Shop „gebraucht/alle Noten → gebraucht“ mit Zusatzangabe „Optisch {Optik-Note}“, When ein Shop-Kanal-Inhalt eines Modell-Inserats mit Optik-Note 3 erzeugt wird, Then lautet die Zustandsbezeichnung „gebraucht“ mit Zusatzangabe „Optisch 3“.
- **AC-REQ-039-02** Given keine passende Zustandszuordnung für eBay, When ein eBay-Kanal-Inhalt erzeugt wird, Then ist die Zustandsbezeichnung leer und der Kanal-Inhalt zeigt „Zustandszuordnung fehlt“.

### REQ-040
- **AC-REQ-040-01** Given MV-A mit Herstellernummer „MHGT3D/A“, und Titelmuster, Beschreibungsvorlage und Merkmalszuordnung aller drei Kanäle enthalten die Herstellernummer, When alle Kanal-Inhalte und das Datenblatt erzeugt werden, Then kommt in allen Ausgaben ausschließlich die Zeichenfolge „MHGT3D/A“ als Herstellernummer vor.
- **AC-REQ-040-02** Given Herstellernummer „unbekannt“, When Kanal-Inhalte erzeugt werden, Then enthält kein Kanal-Inhalt das Wort „unbekannt“ als Herstellernummer.
- **AC-REQ-040-03** Given die Herstellernummer in MV-A wird korrigiert, When die Kanal-Inhalte neu erzeugt werden, Then zeigen alle Ausgaben den korrigierten Wert.
- **AC-REQ-040-04** Given MI-A mit EAN-Kennzeichnung „eigene“ und EAN „4255867000014“, When alle Kanal-Inhalte von MI-A und das Datenblatt eines MI-A zugeordneten Geräts erzeugt werden, Then enthalten alle Ausgaben als EAN ausschließlich „4255867000014“ und nirgends die Original-EAN „0194252146835“.

### REQ-041
- **AC-REQ-041-01** Given Hersteller Apple ist „GPSR vollständig“, When ein Kleinanzeigen-Kanal-Inhalt für MV-A erzeugt wird, Then enthält er die GPSR-Felder Herstellername, Postanschrift und elektronische Kontaktadresse von Apple und die Produktidentifikation nach A-26.
- **AC-REQ-041-02** Given Hersteller Medion ist nicht „GPSR vollständig“, When ein Kanal-Inhalt eines Medion-Modell-Inserats erzeugt wird, Then zeigt er „GPSR-Herstellerangaben fehlen“ und kann nicht freigegeben werden.

### REQ-042
- **AC-REQ-042-01** Given ein Modell-Inserat, When der Nutzer 5 JPEG-Fotos hinzufügt und das dritte an die erste Stelle setzt, Then haben alle Kanal-Inhalte dieselben 5 Fotos in der neuen Reihenfolge.
- **AC-REQ-042-02** Given eine Datei im Format GIF oder größer als 20 MB, When der Nutzer sie hinzufügt, Then wird das mit Nennung des Grunds abgelehnt.
- **AC-REQ-042-03** Given ein Modell-Inserat mit 20 Fotos, When der Nutzer ein weiteres hinzufügt, Then wird das mit Nennung der Höchstzahl abgelehnt.

### REQ-043
- **AC-REQ-043-01** Given ein Kanal-Inhalt im Status *Entwurf*, When der Nutzer die Beschreibung ändert, Then ist sie als „manuell angepasst“ gekennzeichnet.
- **AC-REQ-043-02** Given ein Kanal-Inhalt von MI-A im Status *Entwurf* mit manuell angepasster Beschreibung und eine Beschreibungsvorlage mit `{Optik-Note}`, When der Nutzer die Optik-Note von MI-A über REQ-088 ändert, Then bleibt die Beschreibung unverändert und der Kanal-Inhalt zeigt „Daten geändert, manuell angepassten Text prüfen“.
- **AC-REQ-043-03** Given Kleinanzeigen-Höchstlänge 65, When der Nutzer einen Titel mit 70 Zeichen eingibt, Then wird das abgelehnt.
- **AC-REQ-043-04** Given eine manuell angepasste Beschreibung, When der Nutzer die Anpassung verwirft, Then wird die Beschreibung neu nach der Beschreibungsvorlage gebildet.
- **AC-REQ-043-05** Given eine manuell angepasste Kleinanzeigen-Beschreibung von MI-A mit der Zeile `WI-Nr: {WI-Nr}` und dem Gerät „626198“, When ein weiteres Gerät „626199“ MI-A zugeordnet wird, Then lautet die Zeile „WI-Nr: 626198, 626199“, und der Kanal-Inhalt trägt weder „Daten geändert, manuell angepassten Text prüfen“ noch „geändert seit Freigabe“.
- **AC-REQ-043-06** Given ein veröffentlichter Kanal-Inhalt mit manuell angepasstem Titel, When der Nutzer die Farbe in MV-A ändert und der automatisch gebildete Titel dadurch anders lautet, Then trägt der Kanal-Inhalt „geändert seit Freigabe“ und „Daten geändert, manuell angepassten Text prüfen“, und der manuell angepasste Titel bleibt unverändert. (bis v0.2 AC-REQ-045-06)
- **AC-REQ-043-07** Given ein Textbaustein „Abholung“ in 10 Kanal-Inhalten im Status *Entwurf*, davon 2 mit manuell angepasster Beschreibung, und in 5 Kanal-Inhalten im Status *Veröffentlicht*, When der Nutzer den Text ändert (REQ-053), Then enthalten die 8 Entwürfe ohne manuelle Anpassung den neuen Text, die 2 manuell angepassten Beschreibungen bleiben unverändert und tragen „Daten geändert, manuell angepassten Text prüfen“, die 5 veröffentlichten tragen „geändert seit Freigabe“ mit Änderungsentwurf, und das System meldet „8 aktualisiert, 2 manuell angepasst zur Prüfung, 5 zur erneuten Freigabe“ (8 + 2 + 5 = 15 betroffene Kanal-Inhalte). (bis v0.2 Teil von AC-REQ-053-01)

### REQ-044
- **AC-REQ-044-01** Given ein Kanal-Inhalt im Status *Entwurf* mit Preis, Kategorie, Zustandsbezeichnung, „GPSR vollständig“, zulässiger Titellänge, ohne leeres Pflichtfeld des Kanals und ohne ungeprüften Rechtstext, When der Nutzer freigibt, Then hat der Kanal-Inhalt Status *Freigegeben* mit Zeitpunkt der Freigabe.
- **AC-REQ-044-02** Given ein Kanal-Inhalt ohne Preis und ohne Kategorie, When der Nutzer freigibt, Then wird die Freigabe abgelehnt und beide fehlenden Angaben werden benannt.
- **AC-REQ-044-03** Given ein Kanal-Inhalt, dessen Merkmalsfeld „Farbe“ in der Merkmalszuordnung als Pflichtfeld des Kanals gekennzeichnet und leer ist, When der Nutzer freigibt, Then wird die Freigabe abgelehnt und das Merkmal benannt.
- **AC-REQ-044-04** Given ein Kanal-Inhalt im Status *Entwurf*, When der Nutzer ihn nicht freigibt und sich danach Inhalts- oder Bestandsangaben ändern, Then bleibt er im Status *Entwurf* (keine automatische Freigabe).

### REQ-045
- **AC-REQ-045-01** Given ein Shop-Kanal-Inhalt von MI-A im Status *Freigegeben*, dessen Beschreibungsvorlage `{Zustandsbeschreibung}` enthält, When der Nutzer die Zustandsbeschreibung von MI-A über REQ-088 ändert, Then ist der Kanal-Inhalt im Status *Entwurf* mit Kennzeichnung „geändert seit Freigabe“ und zeigt alten und neuen Stand.
- **AC-REQ-045-02** Given ein Kleinanzeigen-Kanal-Inhalt von MI-A im Status *Veröffentlicht*, When der Nutzer die GPSR-Postanschrift von Apple ändert, Then behält der Kanal-Inhalt den Status *Veröffentlicht* mit Kennzeichnung „geändert seit Freigabe“, es besteht ein Änderungsentwurf mit der neuen Anschrift, und Kopier-Assistent und Inserat-Übersicht zeigen bis zur Freigabe nach REQ-089 die bisherige Anschrift.
- **AC-REQ-045-03** Given Kanal-Inhalte von MI-A im Status *Freigegeben* und *Veröffentlicht*, deren Beschreibungen `{WI-Nr}` und `{Akkukapazität}` enthalten, When ein weiteres Gerät MI-A zugeordnet wird, Then ändern sich nur Stückzahl, `{WI-Nr}` und `{Akkukapazität}`; kein Kanal-Inhalt erhält „geändert seit Freigabe“ und kein Status ändert sich.
- **AC-REQ-045-04** Given ein eBay-Kanal-Inhalt von MI-A im Status *Beendet*, When der Nutzer den eBay-Preis ändert, Then bleibt der Status *Beendet*, der Kanal-Inhalt trägt „geändert seit Freigabe“ und einen Änderungsentwurf mit dem neuen Preis.
- **AC-REQ-045-05** Given ein veröffentlichter eBay-Kanal-Inhalt von MI-A, dessen Beschreibungsvorlage, Titelmuster und Merkmalszuordnung die Zustandsbeschreibung nicht enthalten, When der Nutzer die Zustandsbeschreibung von MI-A ändert, Then erhält dieser eBay-Kanal-Inhalt keine Kennzeichnung „geändert seit Freigabe“.
- **AC-REQ-045-06** Given ein veröffentlichter Shop-Kanal-Inhalt von MI-A ohne manuelle Anpassung, dessen Titelmuster `{Farbe}` enthält, When der Nutzer die Farbe in MV-A von „Space Gray“ auf „Silber“ ändert, Then trägt der Kanal-Inhalt „geändert seit Freigabe“, der Änderungsentwurf enthält einen Titel mit „Silber“, und der Kopier-Assistent zeigt bis zur Freigabe nach REQ-089 weiter den Titel mit „Space Gray“. (Der Fall mit manuell angepasstem Titel ist AC-REQ-043-06.)

### REQ-046
- **AC-REQ-046-01** Given ein freigegebener Kanal-Inhalt, When der Nutzer ihn als *Veröffentlicht* mit Internetadresse kennzeichnet, Then zeigt die Inserat-Übersicht den Kanal als veröffentlicht mit Datum.
- **AC-REQ-046-02** Given ein Kanal-Inhalt im Status *Entwurf*, When der Nutzer ihn als *Veröffentlicht* kennzeichnen will, Then wird das abgelehnt.
- **AC-REQ-046-03** Given ein veröffentlichter Kanal-Inhalt, When der Nutzer ihn als *Beendet* kennzeichnet, Then zeigt die Inserat-Übersicht den Status *Beendet*.
- **AC-REQ-046-04** Given ein beendeter Kanal-Inhalt mit „geändert seit Freigabe“, When der Nutzer ihn auf *Veröffentlicht* setzen will, Then wird das mit „Erst Änderung freigeben“ abgelehnt; nach Freigabe des Änderungsentwurfs (REQ-089) ist der Übergang möglich.
- **AC-REQ-046-05** Given ein beendeter Kanal-Inhalt ohne „geändert seit Freigabe“, When der Nutzer ihn auf *Veröffentlicht* setzt, Then zeigt die Übersicht *Veröffentlicht* ohne „Bestand auf Kanal anpassen“ und ohne „Änderung auf Kanal übertragen“.
- **AC-REQ-046-06** Given ein Kanal-Inhalt im Status *Freigegeben*, When der Nutzer ihn auf *Beendet* setzen will, Then wird das abgelehnt.
- **AC-REQ-046-07** Given MI-A mit genau einem Kanal-Inhalt im Status *Veröffentlicht* (Kleinanzeigen), der nach dem Verkauf des letzten Geräts „Bestand auf Kanal anpassen“ trägt, und den übrigen Kanal-Inhalten im Status *Entwurf*, When der Nutzer den Kleinanzeigen-Kanal-Inhalt auf *Beendet* setzt, Then hat er den Status *Beendet* ohne „Bestand auf Kanal anpassen“, die Inserat-Übersicht mit Filter „Bestand auf Kanal anpassen“ zeigt MI-A nicht, und mit Filter „Stückzahl 0“ erscheint MI-A mit „ausverkauft“.
- **AC-REQ-046-08** Given ein veröffentlichter eBay-Kanal-Inhalt mit „Änderung auf Kanal übertragen“ und zusätzlich „geändert seit Freigabe“ mit einem noch nicht freigegebenen Änderungsentwurf, When der Nutzer ihn auf *Beendet* setzt, Then entfällt „Änderung auf Kanal übertragen“, „geändert seit Freigabe“ und der Änderungsentwurf bleiben bestehen, und der Übergang zurück auf *Veröffentlicht* wird wie in AC-REQ-046-04 erst nach der Freigabe nach REQ-089 zugelassen.

### REQ-089
- **AC-REQ-089-01** Given der Kanal-Inhalt aus AC-REQ-045-02, When der Nutzer den Änderungsentwurf freigibt, Then bleibt der Status *Veröffentlicht*, „geändert seit Freigabe“ entfällt, „Änderung auf Kanal übertragen“ ist gesetzt, der Zeitpunkt ist gespeichert, und der Kopier-Assistent zeigt die neue GPSR-Anschrift.
- **AC-REQ-089-02** Given ein veröffentlichter Kanal-Inhalt, dessen Änderungsentwurf keine Kategorie hat (manuelle Kategorie geleert und keine Kategoriezuordnung), When der Nutzer den Änderungsentwurf freigeben will, Then wird das mit „Kategorie fehlt“ abgelehnt, und der Kopier-Assistent zeigt weiter den bisher freigegebenen Stand.
- **AC-REQ-089-03** Given der Kanal-Inhalt aus AC-REQ-045-04 (*Beendet*), When der Nutzer den Änderungsentwurf freigibt, Then bleibt der Status *Beendet*, „geändert seit Freigabe“ entfällt und es wird keine Kennzeichnung „Änderung auf Kanal übertragen“ gesetzt.

### REQ-090
- **AC-REQ-090-01** Given ein veröffentlichter Kanal-Inhalt mit „Änderung auf Kanal übertragen“ und „Bestand auf Kanal anpassen“, When der Nutzer den Abgleich bestätigt, Then sind beide Kennzeichnungen entfernt, die Übersicht zeigt den Zeitpunkt des Abgleichs, und der Vorgang ist protokolliert.
- **AC-REQ-090-02** Given ein veröffentlichter Kanal-Inhalt mit „geändert seit Freigabe“ und „Bestand auf Kanal anpassen“, When der Nutzer den Abgleich bestätigt, Then entfällt nur „Bestand auf Kanal anpassen“; „geändert seit Freigabe“ bleibt.
- **AC-REQ-090-03** Given ein veröffentlichter Kanal-Inhalt ohne Kennzeichnung, When der Nutzer den Abgleich bestätigen will, Then zeigt das System „Kanal ist abgeglichen“.

### REQ-091
- **AC-REQ-091-01** Given MI-A mit den verfügbaren Geräten „626198“ (Akkukapazität 82) und „626199“ (Akkukapazität 90), ein freigegebener Kleinanzeigen-Kanal-Inhalt mit `WI-Nr: {WI-Nr}` und ein Shop-Kanal-Inhalt mit Merkmalsfeld Stückzahl, When „626199“ als verkauft markiert wird, Then lautet die Zeile im Kopier-Assistenten „WI-Nr: 626198“, `{Akkukapazität}` ergibt „82 %“, das Feld Stückzahl „1“, und keiner der Kanal-Inhalte ändert seinen Status.
- **AC-REQ-091-02** Given MI-A mit einem einzigen verfügbaren Gerät, When dieses verkauft wird, Then ist die Stückzahl 0, `{WI-Nr}` und `{Akkukapazität}` sind leer, und Zeilen, die nur diese Platzhalter enthalten, entfallen (REQ-031).

### REQ-047
- **AC-REQ-047-01** Given ein freigegebener Kleinanzeigen-Kanal-Inhalt, When der Nutzer den Kopier-Assistenten öffnet, Then sieht er alle Felder mit Feldbezeichnung des Kanals in der eingestellten Reihenfolge.
- **AC-REQ-047-02** Given der geöffnete Kopier-Assistent, When der Nutzer das Feld Beschreibung mit einer einzigen Aktion übernimmt und in ein leeres Textfeld eines anderen Programms einfügt, Then ist der eingefügte Text zeichengleich mit der angezeigten Beschreibung inkl. Zeilenumbrüchen.
- **AC-REQ-047-03** Given ein Kanal-Inhalt im Status *Entwurf*, When der Nutzer den Kopier-Assistenten öffnen will, Then zeigt das System „Erst freigeben“.
- **AC-REQ-047-04** Given je ein freigegebener Kanal-Inhalt für Shop und eBay, When der Nutzer den Kopier-Assistenten öffnet, Then steht er für beide Kanäle mit deren eigener Feldliste zur Verfügung.
- **AC-REQ-047-05** Given der Kanal-Inhalt aus AC-REQ-045-02 (veröffentlicht, Änderungsentwurf nicht freigegeben), When der Nutzer den Kopier-Assistenten öffnet, Then zeigt er die bisherige GPSR-Anschrift und den Hinweis „Neuer Stand noch nicht freigegeben“.
- **AC-REQ-047-06** Given ein freigegebener Shop-Kanal-Inhalt von MI-A mit der Startbelegung der Merkmalszuordnung (Kap. 9.8) und Stückzahl 2, When der Nutzer den Kopier-Assistenten öffnet, Then enthält die Feldliste das Feld Stückzahl mit dem Wert „2“ sowie Artikelnummer, EAN und Herstellernummer.
- **AC-REQ-047-07** (neu in v0.3.2) Given ein freigegebener Kleinanzeigen-Kanal-Inhalt eines Modell-Inserats von MV-A ohne Farbe (Merkmalszuordnung nach Kap. 9.8, Merkmalsfeld „Farbe“ ohne Wert), When der Nutzer den Kopier-Assistenten öffnet, Then enthält die Feldliste kein Feld „Farbe“, und die übrigen Felder nach REQ-047, darunter Titel, Beschreibung, Kategorie, Zustandsbezeichnung, Preis und jedes Merkmalsfeld mit Wert, werden wie bisher angezeigt.

### REQ-048
- **AC-REQ-048-01** Given ein Modell-Inserat mit 5 Fotos, When der Nutzer im Kopier-Assistenten die Fotos herunterlädt, Then erhält er 5 Dateien, deren Dateinamen mit „01“ bis „05“ in der festgelegten Reihenfolge beginnen.
- **AC-REQ-048-02** Given ein Modell-Inserat ohne Fotos, When der Nutzer den Kopier-Assistenten öffnet, Then zeigt er „Keine Fotos zugeordnet“.

### REQ-049
- **AC-REQ-049-01** Given ein Kopier-Assistent mit 12 Feldern, When der Nutzer 3 Felder übernommen hat, Then sind diese 3 als „übernommen“ gekennzeichnet und die Anzeige lautet „3 von 12 übernommen“.
- **AC-REQ-049-02** Given Kennzeichnungen „übernommen“, When der Kanal-Inhalt erneut freigegeben wird, Then sind alle Kennzeichnungen zurückgesetzt.
- **AC-REQ-049-03** (neu in v0.3.2) Given ein freigegebener Kanal-Inhalt, dessen Feldliste nach REQ-047 12 Felder ergibt, davon genau 1 Merkmalsfeld ohne Wert, When der Nutzer im Kopier-Assistenten 3 Felder übernommen hat, Then lautet die Anzeige „3 von 11 übernommen“, und das Merkmalsfeld ohne Wert wird weder als übernommen noch als offen gezählt.

### REQ-050
- **AC-REQ-050-01** Given ein Gerät ohne Prüfmarkierung und ein gepflegtes Logo, When der Nutzer das Datenblatt als PDF erzeugt, Then entsteht eine A4-Hochformat-Datei mit Logo und Kanalfeldern in der Kopfzeile und den Blöcken Identifikation, Zustand, Lieferumfang, Technik, Anschlüsse, Software mit den Werten dieses Geräts inkl. WI-Nr.
- **AC-REQ-050-02** Given ein Gerät mit Prüfmarkierung, When der Nutzer das Datenblatt erzeugen will, Then wird das mit „Werte noch zu prüfen“ abgelehnt.
- **AC-REQ-050-03** Given kein Logo gepflegt, When der Nutzer das Datenblatt erzeugen will, Then wird das mit „Logo der Händlermarke fehlt“ abgelehnt.
- **AC-REQ-050-04** Given ein Merkmal ohne Wert, When das Datenblatt erzeugt wird, Then erscheint dieses Merkmal nicht.
- **AC-REQ-050-05** Given ein Gerät, When der Nutzer das Datenblatt druckt, Then wird es auf dem gewählten Drucker als A4-Hochformat ausgegeben.
- **AC-REQ-050-06** Given ein geprüftes, nicht zugeordnetes Gerät, When der Nutzer das Datenblatt erzeugen will, Then wird das mit „Gerät keinem Modell-Inserat zugeordnet“ abgelehnt.
- **AC-REQ-050-07** Given ein MI-A zugeordnetes Gerät mit RAM 8 GB (per „trotzdem zuordnen“), When das Datenblatt erzeugt wird, Then zeigt es RAM „8GB“ (Gerätewert), Artikelnummer „626198“ und EAN „0194252146835“ von MI-A.
- **AC-REQ-050-08** Given MI-A mit den verfügbaren Geräten „626198“ (Akkukapazität 82) und „626199“ (Akkukapazität 90), deren Kanal-Inhalte für `{Akkukapazität}` „82–90 %“ zeigen, und ein aktiver Akku-Hinweis mit `{Akkukapazität}`, When das Datenblatt des Geräts „626199“ erzeugt wird, Then zeigen die Akkukapazität und der Akku-Hinweis „90 %“ und nirgends „82–90 %“; für ein Gerät mit „nicht ermittelbar“ zeigen beide „nicht ermittelbar“.

### REQ-051
- **AC-REQ-051-01** Given das Standard-Layout, When der Nutzer den Block Anschlüsse vor den Block Technik setzt, Then erscheint im nächsten Datenblatt Anschlüsse vor Technik.
- **AC-REQ-051-02** Given der Nutzer ändert den Kopfzeilentext „eBay:“ in „Ebay-Nr.:“, When ein Datenblatt erzeugt wird, Then enthält die Kopfzeile „Ebay-Nr.:“.

### REQ-052
- **AC-REQ-052-01** Given ein Modell-Inserat mit 3 zugeordneten Geräten, davon 1 über Shop verkauft, Shop *Veröffentlicht*, Kleinanzeigen *Freigegeben*, eBay *Entwurf*, When der Nutzer die Inserat-Übersicht öffnet, Then zeigt die Zeile Stückzahl 2, „Shop: 1 verkauft“ und je Kanal den Status.
- **AC-REQ-052-02** Given das Modell-Inserat aus AC-REQ-052-01, When ein weiteres Gerät als verkauft markiert wird, Then trägt der Shop-Kanal-Inhalt „Bestand auf Kanal anpassen“ mit Nennung der geänderten Stückzahl, bis der Nutzer den Abgleich bestätigt (REQ-090); der Kleinanzeigen-Kanal-Inhalt (*Freigegeben*) trägt diese Kennzeichnung nicht.
- **AC-REQ-052-03** Given ein Modell-Inserat mit Stückzahl 0, When die Inserat-Übersicht mit Filter „Stückzahl 0“ geöffnet wird, Then erscheint es mit „ausverkauft“.
- **AC-REQ-052-04** Given keine Modell-Inserate, When der Nutzer die Inserat-Übersicht öffnet, Then zeigt sie „Noch keine Modell-Inserate“.
- **AC-REQ-052-05** Given ein Gerät mit WI-Nr „626198“, When der Nutzer in der Übersicht nach „626198“ sucht, Then erscheint das Modell-Inserat dieses Geräts.
- **AC-REQ-052-06** Given ein veröffentlichter Kanal-Inhalt mit „geändert seit Freigabe“ und ein weiterer mit „Änderung auf Kanal übertragen“, When der Nutzer nach „geändert seit Freigabe“ filtert, Then erscheint nur das Modell-Inserat des ersten Kanal-Inhalts.
- **AC-REQ-052-07** Given Modell-Inserate vorhanden, When der Nutzer nach „Zenbook“ sucht und kein Modell-Inserat passt, Then zeigt die Übersicht „Keine Treffer“.

### REQ-053
- **AC-REQ-053-01** Given ein Textbaustein „Abholung“ in 8 Kanal-Inhalten im Status *Entwurf* ohne manuelle Anpassung und in 5 Kanal-Inhalten im Status *Veröffentlicht*, When der Nutzer den Text ändert, Then enthalten die 8 Entwürfe den neuen Text ohne Einzelbearbeitung, die 5 veröffentlichten tragen „geändert seit Freigabe“ mit Änderungsentwurf, und das System meldet „8 aktualisiert, 5 zur erneuten Freigabe“ (8 + 5 = 13 betroffene Kanal-Inhalte). (Der Fall mit manuell angepassten Beschreibungen ist AC-REQ-043-07.)
- **AC-REQ-053-02** Given ein geänderter Textbaustein, When danach ein neues Modell-Inserat angelegt wird, Then enthalten seine Kanal-Inhalte den neuen Text (SC-04).

### REQ-054
- **AC-REQ-054-01** *Withdrawn in v0.2* (Freigabebestätigung ist eigene Anforderung REQ-087; ersetzt durch AC-REQ-087-01).
- **AC-REQ-054-02** Given ein Textbaustein im Prüfstatus *rechtlich geprüft*, When der Nutzer den Text ändert, Then ist der Prüfstatus *rechtlich ungeprüft*.
- **AC-REQ-054-03** Given der Nutzer setzt *rechtlich geprüft* ohne Prüfdatum, When er speichert, Then wird das mit „Prüfdatum und prüfende Stelle erforderlich“ abgelehnt.
- **AC-REQ-054-04** Given ein neuer Textbaustein der Art *Akku-Hinweis*, When der Nutzer ihn speichert, Then hat er den Prüfstatus *rechtlich ungeprüft*; ein neuer Textbaustein der Art *Abholung/Kontakt* hat keinen Prüfstatus.

### REQ-087
- **AC-REQ-087-01** Given ein Kanal-Inhalt im Status *Entwurf* mit einem Textbaustein der Art *Rechtliches* im Prüfstatus *rechtlich ungeprüft*, When der Nutzer freigibt, Then verlangt das System die Bestätigung „Ungeprüfter Rechtstext enthalten – trotzdem freigeben“ mit dem Namen des Textbausteins und gibt erst nach Bestätigung frei; die Bestätigung ist protokolliert.
- **AC-REQ-087-02** Given dieselbe Lage, When der Nutzer die Bestätigung nicht gibt, Then bleibt der Kanal-Inhalt im Status *Entwurf*.
- **AC-REQ-087-03** Given ein Änderungsentwurf mit einem Textbaustein der Art *Akku-Hinweis* im Prüfstatus *rechtlich ungeprüft*, When der Nutzer ihn nach REQ-089 freigibt, Then verlangt das System dieselbe Bestätigung.

### REQ-055
- **AC-REQ-055-01** Given Protokolleinträge zu Textbausteinen und zu Modell-Inseraten aus Oktober und November 2026, When der Nutzer nach Art des Objekts „Textbaustein“ und Zeitraum November 2026 filtert, Then sieht er nur die Einträge zu Textbausteinen aus November 2026, jeweils mit Zeitpunkt, Objekt, Aktion, altem und neuem Wert und ohne Angabe eines Nutzers.
- **AC-REQ-055-02** *Withdrawn in v0.3* (keine Rollen, E-4).

### REQ-056
- **AC-REQ-056-01** Given die Datei `Datenblatt.xlsx` mit 25 Blättern, When der Nutzer sie einliest, Then entstehen Modellvorlagen mit Prüfmarkierung an allen Werten, und der Einlesebericht nennt jedes Blatt mit nicht zuordenbaren Labels.
- **AC-REQ-056-02** Given ein Blatt mit dem Label „Mod-Nr:“, When es eingelesen wird, Then wird der Wert als Herstellernummer übernommen.

### REQ-057
- **AC-REQ-057-01** Given 3 freigegebene Shop-Kanal-Inhalte, When der Nutzer die Importdatei erzeugt, Then enthält sie 3 Datensätze mit Titel, Beschreibung, Kategorie, Preis, Artikelnummer, EAN, Herstellernummer, Merkmalen und Stückzahl, und der PrestaShop-Import des Pilotkunden legt daraus 3 Artikel an (Test in einer Testumgebung des Shops).

### REQ-058
- **AC-REQ-058-01** Given eine Modellvorlage „ThinkPad E15 Gen 2“ mit Herstellernummer „20TD002MGE“, When der Nutzer die Modellvorlage „ThinkPad V15“ mit derselben Herstellernummer speichert, Then zeigt das System eine Warnung mit Verweis auf „ThinkPad E15 Gen 2“ und lässt Speichern nach Bestätigung zu.

### REQ-059
- **AC-REQ-059-01** Given die Kategoriezuordnung Notebook → Kleinanzeigen „Laptops & Notebooks“, When der Nutzer für einen Kanal-Inhalt der Geräteart PC/Mini-PC die Kategorie „Laptops & Notebooks“ wählt, Then zeigt das System eine Warnung, dass diese Kategorie der Geräteart Notebook zugeordnet ist.

### REQ-104
- **AC-REQ-104-01** Given resellr im Betrieb nur am Arbeitsplatzrechner, When der Nutzer resellr öffnet, Then ist ohne weitere Nutzeraktion der Hinweis mit der Überschrift „Sicherung einrichten“ sichtbar, und sein Text enthält die Aussagen (a) bis (d) aus REQ-104 sowie den Speicherort des Datenordners.
- **AC-REQ-104-02** Given der Hinweis wird angezeigt und der Nutzer reagiert nicht darauf, When er die Nutzerreise J-01 vollständig durchführt, Then sind alle Schritte ohne Bestätigung des Hinweises möglich, und keine Funktion wird durch den Hinweis gesperrt.
- **AC-REQ-104-03** Given der Nutzer hat jede am Hinweis und in den Einstellungen verfügbare Aktion außer „resellr beenden“ ausgeführt, When er resellr schließt und erneut öffnet, Then ist der Hinweis wieder sichtbar, und es gibt keine Einstellung und keine Aktion, die ihn für künftige Nutzungen ausblendet.
- **AC-REQ-104-04** Given das Systemdatum liegt 400 Tage nach der ersten Nutzung, When der Nutzer resellr öffnet, Then ist der Hinweis unverändert sichtbar.
- **AC-REQ-104-05** Given der Nutzer hat den Datenordner bei beendetem resellr vollständig kopiert, When er resellr wieder startet und öffnet, Then ist der Hinweis unverändert sichtbar.
- **AC-REQ-104-06** Given resellr im Netzbetrieb (Startannahme A-36), When der Nutzer resellr nach Eingabe des Zugangspassworts öffnet, Then ist der Hinweis mit derselben Überschrift und demselben Text sichtbar, aber ohne die Aktion „resellr beenden“.

### REQ-105
- **AC-REQ-105-01** Given resellr im Betrieb nur am Arbeitsplatzrechner mit sichtbarem Hinweis, When der Nutzer am Hinweis die Aktion „resellr beenden“ aufruft, Then zeigt das System die Rückfrage aus REQ-105, und resellr läuft weiter, bis der Nutzer bestätigt.
- **AC-REQ-105-02** Given die Rückfrage aus AC-REQ-105-01, When der Nutzer abbricht, Then läuft resellr unverändert weiter, und keine Daten sind verändert.
- **AC-REQ-105-03** Given der Nutzer hat für MI-A den Shop-Preis 279,00 € gespeichert, When er die Rückfrage bestätigt, Then zeigt das System „resellr ist beendet. Sie können den Datenordner jetzt kopieren.“, resellr ist bis zum nächsten Start nicht nutzbar, und nach dem nächsten Start ist der Shop-Preis von MI-A 279,00 €.
- **AC-REQ-105-04** Given resellr wurde nach AC-REQ-105-03 beendet, When der Nutzer den Datenordner kopiert und die Kopie nach AC-REQ-106-01 prüft, Then ist der Shop-Preis von MI-A in der Kopie 279,00 €.
- **AC-REQ-105-05** Given resellr im Netzbetrieb (Startannahme A-36), When der Nutzer alle angebotenen Funktionen mit der Funktionsliste dieses Dokuments vergleicht, Then gibt es keine Funktion, mit der der Nutzer resellr beendet.

### REQ-106
- **AC-REQ-106-01** Given ein Testbestand mit mind. 1 Datensatz je Entität aus Kap. 9.1, mind. 20 Fotos, einem Logo und mind. einer Änderung je Einstellung aus Kap. 9.5, When resellr beendet wird (im Betrieb nur am Arbeitsplatzrechner durch den Nutzer über REQ-105, im Netzbetrieb durch den Betreiber außerhalb der Funktionen des Systems nach A-36) und danach der Datenordner kopiert, die Kopie in einer zweiten, leeren Installation derselben Version als Datenordner verwendet und resellr dort gestartet wird, Then stimmen eine Stichprobe von 20 Datensätzen, die 20 Fotos, das Logo und jede geänderte Einstellung ohne Abweichung mit dem Testbestand überein.

## 9. Daten und Integrationen

### 9.1 Fachliche Entitäten und Schlüsselfelder

Die Entitäten beschreiben fachliche Inhalte, kein Datenbankschema.

| Entität | Schlüsselfelder (fachlich) | Bemerkung |
| --- | --- | --- |
| Zugangspasswort (nur im Netzbetrieb) | Zugangspasswort (nicht im Klartext); kein Benutzerkonto, keine Kennung, kein Name, keine Rolle (E-4, E-5). Die Entität „Benutzerkonto“ aus v0.2 entfällt. | REQ-001, REQ-067, REQ-097 |
| Händlerangaben | Name der Händlermarke, Logo, Kontaktangaben | REQ-028; genau ein Datensatz in Phase 1 |
| Geräteart | Name, Status, Merkmale, Titelmuster | REQ-004, REQ-005, REQ-030 |
| Merkmal | Bezeichnung, Datentyp, Einheit, Wertebereich, Auswahlliste, Ebene, Kennzeichen „variantenbildend“ (nur Ebene *Gerät*), Pflicht, Datenblatt-Block, Reihenfolge, Status (aktiv/deaktiviert) | REQ-005; Status ausdrücklich genannt seit v0.3.4 (Deaktivieren und Wieder-Aktivieren) |
| Auswahlliste | Name, Werte (Reihenfolge, Status; bei Liste Akku zusätzlich Kennzeichen „Akku vorhanden“) | REQ-007 |
| Hersteller | Name, Status, GPSR-Herstellerangaben (rechtlicher Herstellername, Anschrift, Kontakt, verantwortliche Person EU), „GPSR vollständig“ | REQ-027, REQ-100, REQ-101 |
| Modellvorlage | Modelldaten (Geräteart, Hersteller, Modellbezeichnung, Typbezeichnung, Herstellernummer bzw. „unbekannt“, Original-EAN, Werte der Merkmale der Ebene *Modell*); Vorbelegungswerte der Merkmale der Ebene *Gerät* | REQ-008, REQ-010 |
| Gerät | WI-Nr, Modellvorlage, Modell-Inserat (oder nicht zugeordnet), Lieferant, Zustandscode, Gerätewerte (Zustand, Optik-Note, Zustandsbeschreibung, Werte aller Merkmale der Ebene *Gerät* inkl. Tastaturlayout, Netzteil, Akku, Akkukapazität), Prüfmarkierungen, Erfassungsstatus, Bestandsstatus, Verkaufskanal, Verkaufsdatum, Storno-Grund, Erfassungsdatum (kein erfassender Nutzer, E-4) | REQ-012 bis REQ-021, REQ-084, REQ-092 bis REQ-094 |
| Modell-Inserat | Modellvorlage; Inseratswerte: Variantenangaben, übrige inserierte Gerätewerte, Lieferumfang (Auswahl von Textbausteinen), Artikelnummer, EAN-Kennzeichnung „Original“/„eigene“ und ggf. eigene EAN, Preise je Kanal, Fotos; Bestandsangaben (abgeleitet: Stückzahl, WI-Nrn, Akkukapazität) | REQ-019, REQ-032, REQ-042, REQ-088, REQ-091; Datenherkunft Kap. 6.0 |
| Kanal | Name, Status, Titel-Höchstlänge, VB zulässig, Beschreibungsvorlage, Merkmalszuordnung, Zustandszuordnung, Kategoriezuordnung, Preisregel, Feldreihenfolge Kopier-Assistent | REQ-029, REQ-085 |
| Kanal-Inhalt | Modell-Inserat, Kanal, aktueller Stand bzw. Entwurf (Titel, Beschreibung, Merkmalsfelder, Kategorie, Zustandsbezeichnung mit Zusatzangabe, Preis, GPSR-Angaben), freigegebener Stand, ggf. Änderungsentwurf, manuelle Anpassungen (Titel, Beschreibung, Kategorie), Kanal-Status, Kennzeichnungen (Kap. 9.4), letzte Freigabe (Zeitpunkt), Veröffentlichung (Datum, Inseratsnummer/Adresse), letzter Abgleich (Zeitpunkt); kein Nutzer (E-4) | REQ-034 bis REQ-047, REQ-086, REQ-089 bis REQ-091 |
| Lieferant | Name, Status | REQ-012, REQ-022, REQ-099 |
| Zustandscode-Eintrag | Code, Lieferant, Klartext, Vorschlag Zustand, Vorschlag Optik-Note | REQ-022 |
| Textbaustein | Name, Art, Text, Geltungsbereich, Status, Prüfstatus (Datum, prüfende Stelle) | REQ-026, REQ-054 |
| Datenblatt-Layout | Kopfzeilentexte, Blockreihenfolge, Merkmalsreihenfolge je Geräteart | REQ-051 |
| Protokolleintrag | Zeitpunkt, Objekt, Aktion, alter Wert, neuer Wert; kein Nutzer, keine Passwörter (E-4, E-5); gelöscht nach 24 Monaten (REQ-072) | REQ-072, REQ-055 |

**Datenordner (neu in v0.3.2, E-7):** Alle Entitäten dieser Tabelle einschließlich Fotos (A-06), Logo und Einstellungen liegen in einem einzigen Datenordner (REQ-106). resellr sichert ihn nicht selbst; der Owner kopiert ihn bei beendetem resellr (REQ-104, REQ-105).

### 9.2 Auswahllisten (Startwerte, abgeleitet aus `Datenblatt.xlsx` und den echten Inseraten; Einstellung nach REQ-007)

| Auswahlliste | Startwerte | Quelle / Status |
| --- | --- | --- |
| Zustand | gebraucht; defekt; refurbished | Excel: „gebraucht“ (17×), „DEFEKT“ (3×), „Refurbished“ (2×); A-19 |
| Optik-Note | 1, 2, 3, 4, 5 (feste Zahl, keine Liste) | Brief Kap. 7; Bedeutung je Note A-18 |
| Tastaturlayout | Deutsch (QWERTZ); Ungarisch; Englisch (QWERTY, US); Englisch (QWERTY, UK) | Excel: Deutsch, Deutsch (QWERTZ), Ungarisch; Englisch-Varianten [Vorschlag BA] |
| Netzteil | mit Netzteil (original); mit Netzteil (nicht original); ohne Netzteil | Excel: mit, ohne, „nicht Original“ |
| Akku | mit Akku (Akku vorhanden: ja); mit Akku (defekt) (Akku vorhanden: ja); ohne Akku (Akku vorhanden: nein) | Excel: mit, ohne, defekt; Kennzeichen „Akku vorhanden“ [Vorschlag BA] |
| Speichertyp | SSD (SATA); SSD (NVMe); HDD; eMMC | Excel: „NVMe“, „SSD“ [eMMC: Vorschlag BA] |
| Display-Oberfläche | matt; glänzend | Excel: „matt“ |
| Betriebssystem | Windows 11 Pro; Windows 11 Home; Windows 10 Pro; macOS; iOS; iPadOS; Android; ohne Betriebssystem | Excel und Inserate; Android, ohne BS [Vorschlag BA] |
| Anschlusstyp | USB-A 2.0; USB-A 3.x; USB-C; USB-C Thunderbolt; HDMI; DisplayPort; VGA; LAN (RJ45); Kartenleser; Audio (Kombi); Seriell | Excel (Anschlussblock) |
| Anschlussposition (nur PC/Mini-PC) | vorn; hinten | Excel (Desktops: VORN/HINTEN) |

### 9.3 Startbelegung der Gerätearten (REQ-006; vor Pilotbetrieb mit dem Pilotkunden abzustimmen, A-21)

Ebene: **M** = Modell, **G** = Gerät. Pflicht = P. **V** = Variantenmerkmal (Kennzeichen „variantenbildend“, nur bei Ebene G). Die Auswahl der Variantenmerkmale ist [Vorschlag BA] und wird mit dem Pilotkunden abgestimmt (A-15, A-21, OP-21).

| Merkmal | Datentyp / Einheit | Notebook | PC/Mini-PC | Tablet | Smartphone |
| --- | --- | --- | --- | --- | --- |
| Prozessor | Text (Bezeichnung) | M, P | M, P | M | M |
| Prozessorkerne | Ganzzahl | M | M | – | – |
| Prozessortakt | Dezimalzahl, GHz | M | M | – | – |
| RAM | Ganzzahl, GB (Arbeitsspeicher) | G, P, V | G, P, V | M | M |
| RAM-Typ | Text (z. B. DDR4) | G | G | – | – |
| Speicherkapazität | Ganzzahl, GB | G, P, V | G, P, V | M, P | M, P |
| Speichertyp | Auswahl | G, V | G, V | – | – |
| Zweiter Speicherplatz | Text (z. B. „frei“, „512 GB NVMe“) | G | G | – | – |
| Optisches Laufwerk | Text | M | M | – | – |
| Displaygröße | Dezimalzahl, Zoll | M, P | – | M, P | M, P |
| Auflösung | Text (Format „B × H“) | M | – | M | M |
| Display-Oberfläche | Auswahl | M | – | – | – |
| Touchscreen | Ja/Nein | M | – | – | – |
| Grafik 1 | Text | M | M | – | – |
| Grafik 2 | Text | M | M | – | – |
| Tastaturlayout | Auswahl | G, P, V | – | – | – |
| Tastaturbeleuchtung | Ja/Nein | M | – | – | – |
| Ziffernblock | Ja/Nein | M | – | – | – |
| Fingerprint | Ja/Nein | M | – | M | M |
| WLAN | Text (Standard, z. B. „Wi-Fi 6“) | M | M | M | M |
| Bluetooth | Text (Version) | M | M | M | M |
| Mobilfunk (LTE/5G) | Ja/Nein | M | – | M | M |
| LAN | Ja/Nein | M | M | – | – |
| Webcam | Text | M | – | M | M |
| Anschlüsse | Anzahl × Typ (× Position) | M | M | M | M |
| Betriebssystem | Auswahl | G, P, V | G, P, V | G, P, V | G, P, V |
| Betriebssystem-Version | Text (z. B. „25H2“, „iOS 27.0.1“) | G | G | G | G |
| Farbe | Text | M | M | M | M |
| Netzteil | Auswahl | G, P, V | – | G, P, V | G, V |
| Akku | Auswahl | G, P, V | – | G, P, V | G, P, V |
| Akkukapazität | Ganzzahl 0–100, % oder „nicht ermittelbar“ | G (nie V, A-16) | – | G | G |

**Titelmuster (Startbelegung, aus Brief Kap. 2b „Marke Modell (Typ), CPU, RAM, SSD, Extras“):**
- Notebook, PC/Mini-PC: `{Hersteller} {Modellbezeichnung} ({Typbezeichnung}), {Prozessor}, {RAM} RAM, {Speicherkapazität} {Farbe}`
- Tablet, Smartphone: `{Hersteller} {Modellbezeichnung} ({Typbezeichnung}), {Speicherkapazität}, {Betriebssystem-Version}, {Farbe}`

Bestandteile, Präfixe und Suffixe in der Notation von REQ-030: `{Typbezeichnung}` mit Präfix „ (“ und Suffix „)“; `{RAM}` mit Präfix „, “ und Suffix „ RAM“; `{Prozessor}`, `{Speicherkapazität}`, `{Betriebssystem-Version}` mit Präfix „, “; `{Farbe}` mit Präfix „ “ (Notebook, PC/Mini-PC) bzw. „, “ (Tablet, Smartphone). Kürzungsprioritäten [Vorschlag BA]: Notebook, PC/Mini-PC – Farbe 4, Speicherkapazität 3, RAM 2, alle anderen 1; Tablet, Smartphone – Farbe 4, Betriebssystem-Version 3, Speicherkapazität 2, alle anderen 1. `{Betriebssystem-Version}` ist kein Variantenmerkmal; im Titel erscheint der Inseratswert (Kap. 6.0).

**Kategorie- und Zustandszuordnungen:** nicht Teil der Auslieferung (kundenspezifisch, LP-1, REQ-006). Belege für die Pilot-Einstellungen: Shop „gebraucht“ + „Optisch N“, Kleinanzeigen „Gut“/„In Ordnung“, Kleinanzeigen-Kategorie „Laptops & Notebooks“. Vollständige Werte werden vor Pilotbetrieb mit dem Pilotkunden erhoben und als Einstellung erfasst (OP-05, V-03).

### 9.4 Kanal-Status und Kennzeichnungen

**Status und Übergänge (abschließend; Wirkung von Änderungen siehe Kap. 6.0)**

| Status | Bedeutung | Übergänge |
| --- | --- | --- |
| Entwurf | erzeugt bzw. nach Änderung zurückgefallen, (noch) nicht freigegeben | → Freigegeben (REQ-044) |
| Freigegeben | vom Nutzer geprüft, noch nicht auf dem Kanal gemeldet | → Entwurf (Änderung einer Inhaltsangabe, REQ-045); → Veröffentlicht (REQ-046) |
| Veröffentlicht | vom Nutzer als auf dem Kanal eingestellt gemeldet | → Beendet (REQ-046); dabei entfallen „Bestand auf Kanal anpassen“ und „Änderung auf Kanal übertragen“. Bei Änderung einer Inhaltsangabe bleibt der Status; Änderungsentwurf und Freigabe nach REQ-089 |
| Beendet | auf dem Kanal beendet | → Veröffentlicht (REQ-046), nur ohne „geändert seit Freigabe“. Bei Änderung einer Inhaltsangabe bleibt der Status; Änderungsentwurf und Freigabe nach REQ-089 |

Nicht zulässig sind insbesondere: Entwurf → Veröffentlicht, Freigegeben → Beendet, Entwurf → Beendet. Ein Kanal-Inhalt wird nie automatisch freigegeben.

**Übergänge und Abgleich-Kennzeichnungen [Vorschlag BA]:** „Bestand auf Kanal anpassen“ und „Änderung auf Kanal übertragen“ gibt es nur im Status *Veröffentlicht*. Beim Übergang *Veröffentlicht* → *Beendet* entfallen beide; „geändert seit Freigabe“ und ein Änderungsentwurf bleiben. Im Status *Beendet* werden sie nicht gesetzt (Kap. 6.0, REQ-089). Beim Übergang *Freigegeben* → *Veröffentlicht* und beim Übergang *Beendet* → *Veröffentlicht* gilt der freigegebene Stand mit den aktuellen Bestandsangaben als übertragen; der Kanal-Inhalt trägt danach keine der beiden Kennzeichnungen (REQ-046, AC-REQ-046-05, AC-REQ-046-07, AC-REQ-046-08).

**Kennzeichnungen (abschließend)**

| Kennzeichnung | gesetzt bei Status | gesetzt durch | entfernt durch |
| --- | --- | --- | --- |
| geändert seit Freigabe | Entwurf (nach Rückfall), Veröffentlicht, Beendet | Änderung einer Inhaltsangabe nach Freigabe (REQ-045) | Freigabe (REQ-044 bzw. REQ-089) |
| Änderung auf Kanal übertragen | Veröffentlicht | Freigabe eines Änderungsentwurfs (REQ-089) | Abgleich-Bestätigung (REQ-090) oder Übergang *Veröffentlicht* → *Beendet* (REQ-046) |
| Bestand auf Kanal anpassen | Veröffentlicht | Änderung einer Bestandsangabe (REQ-052, REQ-091) | Abgleich-Bestätigung (REQ-090) oder Übergang *Veröffentlicht* → *Beendet* (REQ-046) |
| manuell angepasst | alle | manuelle Änderung von Titel oder Beschreibung (REQ-043) | Verwerfen der Anpassung (REQ-043) |
| Daten geändert, manuell angepassten Text prüfen | alle | Änderung des automatisch gebildeten Texts unter einer manuellen Anpassung (REQ-043) | Verwerfen oder erneute manuelle Änderung der Anpassung (REQ-043) |
| Kategorie manuell | alle | Überschreiben der Kategorie (REQ-086) | Verwerfen (REQ-086) |
| Titel gekürzt, bitte prüfen | alle | Kürzung am Wortende (REQ-035) | Neubildung ohne diese Kürzung oder manuelle Anpassung des Titels (REQ-043) |
| Kategorie fehlt; Zustandszuordnung fehlt; GPSR-Herstellerangaben fehlen | alle | fehlende Angabe (REQ-038, REQ-039, REQ-041) | Angabe vorhanden |
| ausverkauft (Inserat-Übersicht, je Modell-Inserat) | – | Stückzahl 0 (REQ-052) | Stückzahl > 0 |

### 9.5 Konfigurierbarkeit (LP-1): was Einstellung ist

Alle Einstellungen pflegt der Nutzer (einzige Rolle, E-4).

| Einstellung | Anforderung |
| --- | --- |
| Händlermarke, Logo, Kontaktangaben | REQ-028 |
| Gerätearten mit Merkmalen | REQ-004, REQ-005 |
| Auswahllisten | REQ-007 |
| Titelmuster je Geräteart (optional je Kanal) inkl. Kürzungsprioritäten | REQ-030 |
| Textbausteine inkl. Prüfstatus | REQ-026, REQ-054 |
| Hersteller (Anlegen, Umbenennen, Deaktivieren) und GPSR-Herstellerangaben je Hersteller | REQ-027, REQ-100, REQ-101 |
| Lieferanten | REQ-099 |
| Code-Übersetzungstabelle (Zustandscodes) | REQ-022 |
| Zustandszuordnung je Kanal | REQ-023 |
| Kategoriezuordnung je Geräteart und Kanal | REQ-024 |
| Merkmalszuordnung und Feldreihenfolge je Kanal | REQ-025 |
| Beschreibungsvorlage je Kanal | REQ-031 |
| Kanäle (aktiv/inaktiv, Titel-Höchstlänge, VB zulässig) | REQ-029 |
| Preisregeln je Kanal | REQ-085 |
| Datenblatt-Layout | REQ-051 |

Die Zeile „Benutzerkonten“ aus v0.2 entfällt (REQ-002 zurückgezogen).

### 9.6 Validierungsregeln

| Feld | Regel | Quelle |
| --- | --- | --- |
| WI-Nr | Pflicht; 1–20 Zeichen [Annahme A-27]; nur Buchstaben und Ziffern, ohne Leerzeichen; eindeutig über alle Geräte mit Bestandsstatus *verfügbar* oder *verkauft* (stornierte Geräte geben ihre WI-Nr frei, REQ-093); Groß-/Kleinschreibung wird nicht unterschieden | Excel: „626198“, „A637607“, „633641MSGo“, „MD99563“; F-4d |
| Herstellernummer | Pflicht: Wert (1–40 Zeichen [Vorschlag BA]; Buchstaben, Ziffern, „-“, „/“, „.“) oder ausdrücklich „unbekannt“ | Brief Kap. 7; Beispiele „20TD002MGE“, „MHGT3D/A“, „6FY52AV“ |
| EAN (Original-EAN; eigene EAN am Modell-Inserat) | Original-EAN optional; eigene EAN Pflicht bei Kennzeichnung „eigene“; jeweils genau 8 oder 13 Ziffern mit gültiger GS1-Prüfziffer. Bei Kennzeichnung „Original“ gilt die Original-EAN der Modellvorlage (ggf. leer) | Brief Kap. 7; Beispiele 0194252146835, 0190199256279, 4255867000014 (gültig), 0194252146836, 4255867000015 (ungültig); A-11 |
| Artikelnummer | Pflicht am Modell-Inserat; 1–30 Zeichen [Annahme A-27], Buchstaben, Ziffern, „-“; eindeutig über alle Modell-Inserate (ohne Beachtung von Groß-/Kleinschreibung) | Beleg „616027-90“; A-05 |
| Optik-Note | Pflicht; ganze Zahl 1–5 | Brief Kap. 7 |
| Akkukapazität | Pflicht, wenn der Akku-Wert das Kennzeichen „Akku vorhanden“ trägt (Startbelegung: „mit Akku“, „mit Akku (defekt)“; REQ-007, REQ-014); ganze Zahl 0–100 oder „nicht ermittelbar“ | Brief Kap. 7 („Akku-% als Zahl“); Excel „siehe Batteryreport“ |
| Preis je Kanal | Pflicht zur Freigabe; Dezimalzahl > 0, max. 2 Nachkommastellen, Euro; „VB“ nur, wo der Kanal es zulässt | Brief Kap. 2b |
| Zahlenmerkmale | nur Zahl im Datentyp und Wertebereich des Merkmals; Dezimalkomma und -punkt werden als Dezimaltrennzeichen akzeptiert; keine Umwandlung in Datum | Excel-Befund (Datumsumwandlungen) |
| Fotos | JPEG oder PNG; je Datei ≤ 20 MB; ≤ 20 je Modell-Inserat [Vorschlag BA] | REQ-042 |
| Logo | PNG oder JPEG; ≤ 5 MB [Vorschlag BA] | REQ-028 |
| Namen von Hersteller, Lieferant, Geräteart | Pflicht; eindeutig ohne Beachtung von Groß-/Kleinschreibung; Leerzeichen am Rand werden entfernt; Hersteller und Geräteart 1–50, Lieferant 1–100 Zeichen [Vorschlag BA] | REQ-004, REQ-099, REQ-100 |
| Zugangspasswort (nur im Netzbetrieb) | mind. 12 Zeichen [Vorschlag BA], auch für das erste und jedes vom Betreiber zurückgesetzte Zugangspasswort [Vorschlag BA]: beim Ändern nach REQ-097 prüft das System die Regel, beim ersten und beim zurückgesetzten Zugangspasswort stellt der Betreiber sie außerhalb des Systems sicher; neues Zugangspasswort verschieden vom bisherigen | REQ-001, REQ-067, REQ-097 |

### 9.7 Platzhalter für Titelmuster, Zusatzangaben, Beschreibungsvorlagen und Textbausteine

| Gruppe | Platzhalter | Wert |
| --- | --- | --- |
| Modelldaten | `{Hersteller}`, `{Modellbezeichnung}`, `{Typbezeichnung}`, `{Herstellernummer}`, `{Geräteart}`, je Merkmal der Ebene *Modell* `{Merkmalsbezeichnung}` | aus der Modellvorlage; `{Herstellernummer}` leer bei „unbekannt“ (REQ-040) |
| Inseratswerte | `{Artikelnummer}`, `{EAN}`, `{Zustand}`, `{Optik-Note}`, `{Zustandsbeschreibung}`, `{Lieferumfang}`, `{Preis}`, je Merkmal der Ebene *Gerät* außer Akkukapazität `{Merkmalsbezeichnung}` | aus dem Modell-Inserat; `{EAN}` nach REQ-040; `{Lieferumfang}` = Texte der gewählten Lieferumfang-Textbausteine, je Baustein eine Zeile; `{Preis}` = Preis des jeweiligen Kanals |
| Kanal | `{Zustandsbezeichnung Kanal}` | aus der Zustandszuordnung des Kanals |
| Händler | `{Händlermarke}`, `{Händler-Kontakt}` | aus den Händlerangaben (REQ-028) |
| Zusammenstellungen | `{Merkmalsliste}`; `{Baustein:Name}` | `{Merkmalsliste}` = alle nicht leeren Merkmale der Geräteart (ohne Akkukapazität) als „Bezeichnung: Wert“, je Merkmal eine Zeile, in der Reihenfolge der Geräteart; `{Baustein:Name}` = Text des genannten aktiven Textbausteins |
| **Bestandsplatzhalter** | `{WI-Nr}`, `{Stückzahl}`, `{Akkukapazität}` | Bestandsangaben, stets aktuell (REQ-091): `{WI-Nr}` = WI-Nrn aller zugeordneten verfügbaren Geräte, durch „, “ getrennt; `{Stückzahl}`; `{Akkukapazität}` nach A-16 und den Regeln unten; auf dem Datenblatt eines Geräts gilt der Wert dieses Geräts (REQ-050) |

**Regeln für `{Akkukapazität}` in Kanal-Inhalten (A-16, ergänzt in v0.3) [Vorschlag BA]:**
1. Es gehen nur verfügbare Geräte des Modell-Inserats ein, die eine Akkukapazität haben (Zahl 0–100 oder „nicht ermittelbar“) und deren Akku-Wert, sofern die Geräteart das Merkmal Akku hat, das Kennzeichen „Akku vorhanden“ trägt. Geräte ohne Akku (z. B. per „trotzdem zuordnen“ mit „ohne Akku“) und Geräte ohne Akkukapazität gehen nicht ein.
2. Aus den eingehenden Geräten mit einer Zahl bildet das System den Zahlenteil: ein Wert oder mehrere gleiche Werte → „N %“ (z. B. „85 %“); verschiedene Werte → „min–max %“ (z. B. „82–90 %“).
3. Haben eingehende Geräte „nicht ermittelbar“: gibt es auch einen Zahlenteil → „Zahlenteil bzw. nicht ermittelbar“ (z. B. „85 % bzw. nicht ermittelbar“); gibt es keinen Zahlenteil → „nicht ermittelbar“ (ohne „%“).
4. Geht kein Gerät ein, ist `{Akkukapazität}` leer (Wirkung leerer Platzhalter nach REQ-030, REQ-031).

**Zulässigkeit je Verwendung** (ein unzulässiger oder unbekannter Platzhalter wird beim Speichern mit Nennung abgelehnt):

| Verwendung | zulässig | nicht zulässig |
| --- | --- | --- |
| Titelmuster (REQ-030) | Modelldaten; Inseratswerte außer `{Lieferumfang}` und `{Preis}` | Bestandsplatzhalter, Kanal, Händler, Zusammenstellungen |
| Zusatzangabe der Zustandszuordnung (REQ-023) | Modelldaten; Inseratswerte außer `{Lieferumfang}` und `{Preis}` | Bestandsplatzhalter, Kanal, Händler, Zusammenstellungen |
| Beschreibungsvorlage (REQ-031) | alle | – |
| Textbaustein (REQ-026) | alle außer `{Baustein:Name}` | `{Baustein:Name}` |

### 9.8 Kanal-Felder und Startbelegung der Merkmalszuordnungen (aus Brief Kap. 2b / Research Kap. 2b)

Jeder Kanal-Inhalt hat die festen Felder Titel, Beschreibung, Kategorie, Zustandsbezeichnung (mit Zusatzangabe), Preis, GPSR-Angaben (Herstellername, Anschrift, elektronische Kontaktadresse, ggf. verantwortliche Person EU, Produktidentifikation) und Fotos. Die **Merkmalsfelder** je Kanal legt die Merkmalszuordnung fest (REQ-025). Startbelegung, gleich für alle vier Gerätearten; ein Feld, dessen Merkmal die Geräteart nicht hat, entfällt für diese Geräteart. Quellen nach Kap. 9.11. In der Startbelegung ist kein Merkmalsfeld als Pflichtfeld des Kanals gekennzeichnet; das pflegt der Nutzer nach Klärung von OP-22.

| Kanal | Merkmalsfelder (Feldbezeichnung ← Quelle, in dieser Reihenfolge) |
| --- | --- |
| Shop (PrestaShop 9.1.4) | Artikelnummer ← Artikelnummer; EAN-13 ← EAN; Herstellernummer (MPN) ← Herstellernummer; Hersteller ← Hersteller; Prozessor ← Prozessor; RAM ← RAM; Speicher ← Speicherkapazität; Display ← Displaygröße; Anschlüsse ← Anschlüsse; Betriebssystem ← Betriebssystem; Stückzahl ← Stückzahl |
| Kleinanzeigen | Typ ← Geräteart (Kanal-Werte über Wertzuordnung, V-03); Marke ← Hersteller; Modell ← Modellbezeichnung; Zustand ← Zustandsbezeichnung des Kanals; Betriebssystem ← Betriebssystem; Prozessor ← Prozessor; RAM ← RAM; Speicher ← Speicherkapazität; Farbe ← Farbe |
| eBay (Nebenkanal, Kopier-Ausgabe) | Marke ← Hersteller; Modell ← Modellbezeichnung; Prozessor ← Prozessor; Bildschirmgröße ← Displaygröße; Arbeitsspeicher ← RAM; Speicherkapazität ← Speicherkapazität; Betriebssystem ← Betriebssystem; Farbe ← Farbe; Herstellernummer ← Herstellernummer; EAN ← EAN; Zustandsbeschreibung ← Zustandsbeschreibung |

Belegte Formularinhalte: Shop – Beschreibung mit Abschnitten Zustand, Lieferumfang, Artikeldetails; Zustand „gebraucht“ + „Optisch N“. Kleinanzeigen – Titel ≤ 65 Zeichen; Freitext mit WI-Nr, ProduktNr., Zustand, Lieferumfang, Abholzeiten, Rechtsblock; Preis optional VB; GPSR-Felder. eBay – Titel ≤ 80 Zeichen (A-17); Zustand und Zustandsbeschreibung; GPSR-Herstellerangaben.

### 9.9 Externe Systeme

| System | Beziehung in Release 0.1 | Spätere Releases |
| --- | --- | --- |
| PrestaShop 9.1.4 des Pilotkunden | keine technische Verbindung; Übertragung per Kopier-Assistent; optional Importdatei (REQ-057, Could) | 0.2 Direktveröffentlichung, 0.3 Stückzahl-Abgleich |
| Kleinanzeigen (gewerbliches Konto) | keine technische Verbindung (F-3, REQ-079); Kopier-Assistent | keine Automatisierung ohne schriftliche Zustimmung von Kleinanzeigen |
| eBay | keine technische Verbindung; Kopier-Assistent | Direktanbindung nur bei ausreichendem eBay-Anteil (Brief Kap. 8) |
| Excel `Datenblatt.xlsx` | optional einmalige Übernahme (REQ-056, Could) | – |
| Einkaufs-PDFs der Lieferanten | keine; Zustandscodes werden manuell eingegeben | 0.4 Einlesen |

### 9.10 Daten, die das System nicht halten darf oder nicht hält

- **Darf nicht:** Zugangsdaten zu Shop, eBay, Kleinanzeigen (REQ-068); Daten von Käufern (Namen, Anschriften, Bestellungen, Zahlungsdaten) (REQ-069); personenbezogene Daten des Nutzers, z. B. Benutzerkonten oder Namen in Protokoll, Freigaben und Abgleichen (REQ-069, E-4, E-5).
- **Nicht vorgesehen in Phase 1:** Einkaufspreise, Lieferantenrechnungen, Bestellungen, Versanddaten, Buchhaltungsdaten (Out of Scope, Kap. 14).

### 9.11 Zulässige Quellen für Merkmalsfelder (abschließend)

Ein Merkmalsfeld der Merkmalszuordnung (REQ-025) hat genau eine der folgenden Quellen:

| Nr. | Quelle | Wert |
| --- | --- | --- |
| Q-01 | ein Merkmal der Geräteart | Ebene *Modell*: Wert der Modellvorlage; Ebene *Gerät*: Inseratswert; Akkukapazität: Bestandsangabe nach A-16 |
| Q-02 | Hersteller, Modellbezeichnung, Typbezeichnung, Herstellernummer, Geräteart | Modelldaten (Herstellernummer leer bei „unbekannt“) |
| Q-03 | EAN | nach REQ-040 |
| Q-04 | Artikelnummer, Zustand, Optik-Note, Zustandsbeschreibung, Lieferumfang | Inseratswerte |
| Q-05 | Zustandsbezeichnung des Kanals, Zusatzangabe der Zustandszuordnung | Zustandszuordnung des Kanals (REQ-023, REQ-039) |
| Q-06 | Produktidentifikation | nach A-26 |
| Q-07 | Stückzahl, WI-Nr | Bestandsangaben (REQ-091) |
| Q-08 | fester Text | vom Nutzer eingegebener Text (max. 255 Zeichen [Vorschlag BA]) |

Auf jede Quelle kann eine Wertzuordnung (interner Wert → Kanal-Wert) angewendet werden (REQ-025).

### 9.12 Startbelegung von Kanälen, Beschreibungsvorlagen und Datenblatt-Layout (REQ-006)

Strukturen abgeleitet aus Brief Kap. 2b und Research Kap. 2b; Überschriften und Zeilen sind [Vorschlag BA] und werden vor Pilotbetrieb mit dem Pilotkunden abgestimmt (A-21, V-03). Texte der Textbausteine sind nicht Teil der Auslieferung (REQ-006).

**Kanäle** (alle aktiv, kein kanaleigenes Titelmuster, keine Preisregel)

| Kanal | Titel-Höchstlänge | Zusatz „Verhandlungsbasis“ zulässig |
| --- | --- | --- |
| Shop | 128 [Annahme A-17] | nein |
| Kleinanzeigen | 65 [Beleg] | ja [Beleg: „50 € VB“] |
| eBay | 80 [Annahme A-17] | nein [Vorschlag BA] |

**Beschreibungsvorlagen** (Abschnitte in Reihenfolge; „Bausteine Art X“ = alle gültigen Textbausteine dieser Art, REQ-031)

| Kanal | Abschnitte |
| --- | --- |
| Shop | „Zustand“: `{Zustandsbezeichnung Kanal}` / `{Zustandsbeschreibung}` · „Lieferumfang“: `{Lieferumfang}` / `Netzteil: {Netzteil}` / `Akku: {Akku}` / `Akkukapazität: {Akkukapazität}` / Bausteine Art *Akku-Hinweis* · „Artikeldetails“: `{Merkmalsliste}` · ohne Überschrift: Bausteine Art *Rechtliches* |
| Kleinanzeigen | ohne Überschrift: `WI-Nr: {WI-Nr}` / `ProduktNr. {Herstellernummer}` · „Zustand“: wie Shop · „Lieferumfang“: wie Shop · „Technische Daten“: `{Merkmalsliste}` · „Abholung und Kontakt“: Bausteine Art *Abholung/Kontakt* · ohne Überschrift: Bausteine Art *Rechtliches* |
| eBay | „Zustand“: wie Shop · „Lieferumfang“: wie Shop · „Technische Daten“: `{Merkmalsliste}` · ohne Überschrift: Bausteine Art *Rechtliches* |

**Datenblatt-Layout:** Kopfzeilentexte „Shop:“, „eBay:“, „Kleinanzeigen:“; Blockfolge Identifikation → Zustand → Lieferumfang → Technik → Anschlüsse → Software; Merkmalsreihenfolge je Geräteart wie in Kap. 9.3; Zuordnung der Merkmale zu Blöcken nach dem Datenblatt-Block des Merkmals (REQ-005).

## 10. UI-relevante Randbedingungen und UI-Umfang

### 10.1 Art der Benutzeroberfläche
Das Produkt hat eine **eigene interaktive Benutzeroberfläche**, die nicht in das PrestaShop-Backoffice eingebettet und nicht an dessen Gestaltung gebunden ist; ein PrestaShop-Modul ist ausgeschlossen (E-1). Dazu kommt eine druckbare Ausgabe (Datenblatt als A4-Druck/PDF). **Ob die Oberfläche als Webanwendung oder als Desktop-Anwendung entsteht, ist offen** und wird von Software Architect und Owner entschieden (E-1, Brief Kap. 6, OP-15). Bis zu dieser Entscheidung starten Architecture Baseline und UI/UX-Design mit der Startannahme A-33 (Kap. 13.1); die Entscheidung soll früh im Parallelschritt fallen und an das UI/UX-Design weitergegeben werden. Für den Kopier-Assistenten gilt unabhängig davon: Er wird parallel zum Formular des Kanals genutzt, das der Nutzer in einem anderen Programm geöffnet hat (A-02).

### 10.2 Plattformen und Geräte
- **Genau ein Arbeitsplatzrechner** (PC): Der Nutzer arbeitet immer am selben PC (E-6), mit Tastatur und Maus; Bildschirmauflösung ab 1366 × 768 (REQ-077).
- **Smartphones und Tablets werden in Version 1 nicht unterstützt** (E-2); mobile Nutzung ist nicht erforderlich. Gemeint sind Geräte zur Bedienung von resellr; Tablets und Smartphones als Gerätearten der inserierten Ware bleiben unverändert (F-7a, REQ-006).
- Betriebssystem und Programme des Arbeitsplatzrechners sind nicht bekannt (OP-24); Software Architect und UI/UX Designer starten mit der Startannahme A-34 (Kap. 13.1), die tatsächlichen Versionen liefert der Owner als Nutzer bis zum Abschluss des Architecture Baseline.
- Ob resellr nur am Arbeitsplatzrechner läuft oder über ein Netz erreichbar ist, ergibt sich aus der Architektur (OP-15, OP-23); Betrieb nur auf dem PC des Nutzers ist zulässig (A-35). Nur im Netzbetrieb gibt es ein Zugangspasswort (E-5, REQ-001).
- A4-Drucker für das Datenblatt.

### 10.3 Nutzerrollen und Rechte (E-4, E-5)

Es gibt **genau eine Rolle: Nutzer**. Mit resellr arbeitet genau eine Person (E-4). Der Nutzer darf alle Funktionen dieses Dokuments nutzen und alle Daten sehen, einschließlich aller Einstellungen (Kap. 9.5), des Änderungsprotokolls (REQ-055), des Löschens von Modell-Inseraten und Modellvorlagen (REQ-095) und der Excel-Übernahme (REQ-056). Es gibt keine Benutzerkonten, keine Rollenverwaltung, keine rollenabhängigen Sichten und keine Rechtetabelle (E-4, E-5).

| Rolle bzw. Akteur | darf sehen und tun |
| --- | --- |
| Nutzer | alle Funktionen und alle Daten; im Netzbetrieb erst nach Eingabe des Zugangspassworts (REQ-001), dort zusätzlich Zugangspasswort ändern (REQ-097) |
| System | bildet Ergebnisse ohne eigene Nutzeraktion (z. B. REQ-034 bis REQ-041, REQ-045, REQ-053, REQ-091); keine eigene Rolle |
| Betreiber | keine Rolle im System; richtet resellr außerhalb der Funktionen des Systems ein, legt im Netzbetrieb das Zugangspasswort fest und setzt es bei Bedarf zurück (REQ-001); beendet im Netzbetrieb resellr für eine Sicherung außerhalb der Funktionen des Systems (Startannahme A-36 [Vorschlag BA], OP-31) |

Geräte werden von niemandem gelöscht, sondern storniert (REQ-093, REQ-103). Weitere Rollen (z. B. für Mitarbeitende oder mehrere Händler) gibt es in Phase 1 nicht (Kap. 14).

### 10.4 Designvorgaben
- **Kein vorhandenes Designsystem und keine Komponentenbibliothek** für die Bedienoberfläche bekannt. Die Gestaltungsregeln des PrestaShop-Backoffice gelten nicht, weil resellr eine eigene Oberfläche ist (E-1).
- **Händlermarke notebookers.de** (F-7c) ist für das Datenblatt verbindlich (Logo in der Kopfzeile); das alte Logo defekte-IT.de darf nicht verwendet werden. Logo in Druckqualität und ggf. Farben/Schrift liefert der Pilotkunde (OP-13). Für die Bedienoberfläche selbst gibt es keine Markenvorgabe; sie darf nicht an notebookers.de gebunden sein (LP-1, REQ-074).
- **Datenblatt-Layout als Referenz:** `Datenblatt.xlsx` (Anhang an [MAR-113](/MAR/issues/MAR-113)): A4 Hochformat; Kopfzeile mittig mit Logo und darunter den Feldern „shop:“, „ebay:“, „Kleinenzeigen:“ (für handschriftliche Vermerke); Inhalt zweispaltig (Bezeichnung | Wert) in der Blockfolge Identifikation → Zustand/Beschreibung → Lieferumfang inkl. Akku-Hinweis → Technik → Anschlüsse (Anzahl × Typ) → Software. Ob das Layout exakt oder inhaltlich gleichwertig sein muss, ist offen (OP-01, A-10).
- **Barrierefreiheit:** keine Anforderung (E-3; REQ-071 zurückgezogen). Es ist kein Standard und keine Konformitätsstufe einzuhalten.

### 10.5 Sprache, Lokalisierung, Nutzungskontext
- Sprache: ausschließlich Deutsch (Bedienoberfläche, Meldungen, Kanal-Inhalte, Datenblatt; REQ-078).
- Formate: de-DE (Dezimalkomma, „1.234,56 €“, TT.MM.JJJJ), Währung Euro, Zeitzone Europe/Berlin.
- Nutzungskontext: eine Person (E-4) an einem Arbeitsplatzrechner (E-6); häufige, wiederkehrende Nutzung bei jedem Wareneingang und jedem Verkauf; Einbuchen eines Geräts soll ≤ 2 Minuten dauern (REQ-062); der Kopier-Assistent wird parallel zu den Formularen von Shop, Kleinanzeigen und eBay genutzt; Fotos entstehen außerhalb des Systems. Volumen: eher wenige neue Modell-Inserate pro Woche, mehrere Geräte je Modell-Inserat (Brief Kap. 2b, Schätzung; OP-03).

### 10.6 Erwarteter UI-Umfang

**Haupttätigkeiten des Nutzers** (einzige Rolle; die beiden Aufgabenlisten aus v0.2 sind zusammengelegt)
- Tägliche Arbeit: Gerät per WI-Nr erfassen und einbuchen (häufigste Tätigkeit); Modellvorlage suchen/anlegen, ggf. Hersteller anlegen; Prüfmarkierungen abarbeiten; Abweichungen der Variantenangaben bei Zuordnung entscheiden; Modell-Inserat mit Inseratswerten, Preisen und Fotos pflegen; Kanal-Inhalte je Kanal prüfen, ggf. anpassen, freigeben; Änderungsentwürfe prüfen und freigeben (alter und neuer Stand); Kopier-Assistent je Kanal; Veröffentlichungsstatus setzen und Abgleich bestätigen; Verkäufe markieren und ggf. zurücknehmen; Fehlerfassungen korrigieren (WI-Nr, Storno); Datenblatt drucken; Inserat-Übersicht mit Kennzeichnungen.
- Seltener: Einstellungen pflegen (15 Bereiche, Kap. 9.5); Änderungsprotokoll einsehen; Modell-Inserate/Modellvorlagen löschen; optional Excel-Übernahme; im Netzbetrieb Zugangspasswort eingeben und ändern; für die eigene Sicherung resellr beenden (REQ-105, nur im Betrieb nur am Arbeitsplatzrechner) und danach den Datenordner außerhalb von resellr kopieren (E-7).

**Art und ungefährer Umfang der Funktionen**
- Dateneingabe: 3 umfangreiche Erfassungen mit je Geräteart unterschiedlichen, per Einstellung definierten Feldern (Modellvorlage bis ca. 30 Merkmale, Gerät, Modell-Inserat) sowie kleinere Eingaben (Hersteller, Storno-Grund, im Netzbetrieb Zugangspasswort).
- Übersichten/Listen: Inserat-Übersicht mit Filtern und Kennzeichnungen; Trefferlisten Modellvorlagen und Geräte; Liste nicht zugeordneter Geräte; Änderungsprotokoll.
- Prüf- und Freigabe-Workflow: Der Nutzer prüft je Modell-Inserat bis zu 3 Kanal-Inhalte und gibt sie einzeln frei; fachlicher Bedarf ist, Angaben der Kanal-Inhalte eines Modell-Inserats vor der Freigabe miteinander und bei Änderungsentwürfen mit dem freigegebenen Stand vergleichen zu können; dazu Hinweise und Kennzeichnungen nach Kap. 9.4. Die Form legt das UI/UX-Design fest.
- Kopier-Assistent: 1 neuartige Arbeitsfunktion für 3 Kanäle mit je ca. 10–25 Feldern plus Fotos.
- Druckausgabe: Datenblatt.
- Einstellungen: ca. 15 Pflegebereiche (Kap. 9.5), darunter anspruchsvolle Pflegefunktionen (Merkmale je Geräteart mit Ebene und Variantenkennzeichen, Titelmuster mit Präfix/Suffix und Kürzungsprioritäten, Beschreibungsvorlagen mit Platzhaltern, Zuordnungstabellen).
- Zugang: nur im Netzbetrieb Eingabe und Änderung des Zugangspassworts; keine Benutzerverwaltung (E-4, E-5).
- Hinweis zur Sicherung (neu in v0.3.2, E-7): 1 dauerhaft sichtbarer Hinweis „Sicherung einrichten“ mit Text (REQ-104) und daran 1 Aktion „resellr beenden“ mit Rückfrage und Abschlussmeldung (REQ-105, nur im Betrieb nur am Arbeitsplatzrechner). Keine Sicherungs- oder Wiederherstellungsfunktion, keine Einstellungen dazu.

**Veränderung bestehender Oberflächen:** Es wird keine bestehende Software-Oberfläche geändert. Ersetzt wird die Arbeit mit `Datenblatt.xlsx` und das freie Abtippen in die Kanal-Formulare; die Formulare von Shop, Kleinanzeigen und eBay selbst bleiben unverändert und außerhalb des Systems.

**Bekannte Komplexitätstreiber**
- Felder je Geräteart sind nicht fest, sondern Einstellung (LP-4): Erfassungsmasken müssen aus Merkmalsdefinitionen entstehen.
- Mehrstufiger Ablauf Modellvorlage → Gerät → Modell-Inserat → 3 Kanal-Inhalte → Freigabe → Kopier-Assistent → Status → Abgleich (Kap. 6.0), mit Rücksprüngen (geändert seit Freigabe, Änderungsentwurf neben freigegebenem Stand).
- Prüfmarkierungen und Abweichungsentscheidungen (Variantenangaben) im Einbuchen, bei einem Zeitziel ≤ 2 Minuten.
- Effizienz des Kopier-Assistenten ist zentral für die Akzeptanz (Brief-A-3) und den Umstieg von Excel (Brief-A-4).
- Pflege der Einstellungen mit Platzhaltern muss für Nicht-Entwickler machbar sein (SC-07; REQ-076: neue Geräteart ≤ 60 min [Vorschlag BA]).
- Entfallen gegenüber v0.2: rollenabhängige Sichten (E-4).

## 11. Randbedingungen

### 11.1 Bestätigte Randbedingungen (Owner-Entscheidungen und Brief)

| ID | Randbedingung | Quelle |
| --- | --- | --- |
| RB-01 | Phase 1 = Richtung A „Inserat-Generator“; keine Direktveröffentlichung | F-1, Brief Kap. 6 |
| RB-02 | Kleinanzeigen nur per Kopier-Assistent, keine Automatisierung | F-3 |
| RB-03 | Inserat pro Modell mit Stückzahl; getrennte Inserate bei deutlich abweichendem Zustand | F-4c |
| RB-04 | WI-Nr = interne Warennummer zur Identifikation | F-4d |
| RB-05 | Pilot zuerst, produktfähig; LP-1 bis LP-4 verbindlich | F-5, Brief Kap. 6b |
| RB-06 | Kostenloser Pilot; Rechte am Ergebnis beim Owner | F-6 |
| RB-07 | Gerätearten Notebook, PC/Mini-PC, Tablet, Smartphone; weitere per Einstellung | F-7a |
| RB-08 | eBay ist Nebenkanal; in Phase 1 nur Kopier-Ausgabe | F-7b, Brief Kap. 7 |
| RB-09 | Händlermarke notebookers.de, nicht defekte-IT.de | F-7c |
| RB-10 | Kanäle: PrestaShop 9.1.4, eBay, Kleinanzeigen (gewerbliches Konto) | Brief Kap. 9, 12 |
| RB-11 | Deutsche Inserate; Freigabe jedes Inserats durch einen Menschen (REQ-044, REQ-089). Ausnahme, über die der Owner mit der Freigabe entscheidet: Bestandsangaben (Stückzahl, WI-Nrn, Akkukapazität) aktualisieren sich ohne neue Freigabe (OP-29, A-31, REQ-091) | Brief Kap. 9; OP-29 |
| RB-12 | Plattform-Zugänge verwaltet der Kunde | Brief Kap. 9 |
| RB-13 | Rechtliche Vorgaben: GPSR-Herstellerangaben auch bei Gebrauchtware; Gewährleistungs-/Garantie-Formulierungen abmahnträchtig; Kleinanzeigen-Nutzungsbedingungen § 2 Nr. 5 (gewerblich), § 5 Nr. 1 (keine automatisierten Mechanismen ohne Zustimmung), § 6 (Sperre); eBay „Refurbished“ eingeschränkt. Keine Rechtsberatung; Prüfung vor Pilotbetrieb (V-04). | Brief Kap. 3, 9; Research Kap. 3.1, 4 |
| RB-14 | Kein Mehrhändler-Betrieb, keine Selbstregistrierung, keine Abrechnung in Phase 1 | Brief Kap. 6b |
| RB-15 | **E-1:** Eigene Oberfläche, kein PrestaShop-Modul. Ob Web oder Desktop, entscheiden Software Architect und Owner (OP-15). | Owner, MAR-121, 06.11.2026 (Kommentar 17:09) |
| RB-16 | **E-2:** Keine Unterstützung für Smartphone und Tablet in Version 1. | Owner, MAR-121, 06.11.2026 (Kommentar 17:09) |
| RB-17 | **E-3:** Barrierefreiheit wird ganz gestrichen. | Owner, MAR-121, 06.11.2026 (Kommentar 17:27) |
| RB-18 | **E-4:** Mit resellr arbeitet genau eine Person, der Owner. Es gibt keine Mitarbeitenden. | Owner, MAR-121, 06.11.2026 (Kommentar 17:27) |
| RB-19 | **E-5:** Ein Zugangspasswort gibt es nur, wenn resellr über ein Netz erreichbar ist. Es gibt keine Konten, keine Rollen und kein Zurücksetzen. Läuft resellr nur auf dem PC, gibt es keine Anmeldung. | Owner, MAR-121, 06.11.2026 (Fragekarte, Antwort `passwort_wenn_netz`) |
| RB-20 | **E-6:** Gearbeitet wird immer am selben PC. | Owner, MAR-121, 06.11.2026 (Fragekarte, Antwort `ein_pc`) |
| RB-21 | **E-7 (Owner-Wortlaut):** OneDrive ja; die Sicherung ist freiwillig, in Phase 1 nicht eingebaut und keine Pflicht, resellr läuft ohne Sicherung normal weiter. resellr zeigt immer einen klaren Hinweis, dass der Owner die Sicherung einrichten sollte; in Phase 1 gibt es keine Sicherungsfunktion, nur einen Hinweis mit Anleitung. Eine Kopie ist nur bei beendetem resellr sicher brauchbar. **Abgeleitet aus E-7 (nicht Owner-Wortlaut; zur ausdrücklichen Owner-Bestätigung, OP-17):** Der Owner sichert durch Kopieren des einen Datenordners (REQ-106); resellr wird vorher über die Aktion „resellr beenden“ in resellr beendet (REQ-105, Must). Die Entscheidung reduziert die mit v0.3 freigegebene REQ-066 (Withdrawn in v0.3.2; umgesetzt durch REQ-104, dazu die Ableitungen REQ-105 und REQ-106). | Owner, [MAR-125](/MAR/issues/MAR-125), 06.11.2026 (Fragekarte `15ba6e78-50f2-45ae-bf5f-94ec9af39256` „Sicherung in Phase 1“, beantwortet 18:58 UTC, Antwort `hint_only` „(b) Nur Hinweis, ich sichere selbst“; Kommentar [317f1409](/MAR/issues/MAR-125#comment-317f1409-e70e-4acd-a9f7-8201121f5703)); Ableitung: Kommentar bb98a214 des Software Architect an MAR-125 nach der Antwort; Auftrag MAR-131/MAR-132 |

### 11.2 Offene Entscheidungen (Randbedingungen, noch nicht festgelegt)
- Art der Oberfläche: nur noch Web oder Desktop (eigene Oberfläche ist entschieden, E-1); Betriebsmodell/Hosting, Ort der Daten und damit, ob Netzbetrieb vorliegt: Software Architect und Owner (OP-15, OP-23).
- Budget und Zeitplan: in den Quellen nicht festgelegt; der Pilot ist kostenlos (F-6). Keine Annahme getroffen.

### 11.3 Abhängigkeiten

| ID | Abhängigkeit | Wirkung |
| --- | --- | --- |
| D-01 | Antworten des Owners/Kunden zu OP-01 bis OP-05 (die Fragen-Karte an [MAR-114](/MAR/issues/MAR-114) ist ohne Antwort abgelaufen; Stand 06.11.2026) | bestätigen oder ändern A-10 bis A-14 |
| D-02 | Kategorie- und Zustandswerte der Kanäle (Shop-Kategoriebaum, Kleinanzeigen-Kategorien, eBay-Kategorien und Zustände) | Startbelegung REQ-006, REQ-023, REQ-024 |
| D-03 | Textbausteine des Pilotkunden (Akku-Hinweis, Abholzeiten, Rechtsblock) und GPSR-Angaben der Hersteller im Bestand | Startbelegung REQ-026, REQ-027 |
| D-04 | Formular- und Feldregeln von Kleinanzeigen und eBay können sich ändern (Brief Kap. 12, Risiken) | Einstellungen (REQ-025, REQ-029) statt Entwicklung |

### 11.4 Voraussetzungen vor Entwicklungsstart und vor Pilotbetrieb

| ID | Voraussetzung | Wann | Verantwortlich | Quelle |
| --- | --- | --- | --- | --- |
| V-01 | Zeitmessung beim Pilotkunden: 2–3 neue Inserate und 5 Einbuchungen, nach Schritten aufgeteilt; neue Modelle/Monat aus der WI-Nr-Historie. Liefert die Baseline für REQ-063. Ergibt sie nur wenige Stunden Ersparnis pro Monat, empfiehlt der Brief, Phase 1 zu verkleinern oder nicht weiterzuverfolgen (Brief Kap. 13). | **vor Entwicklungsstart** | Pilotkunde, koordiniert durch Owner | Brief-A-1, Brief-A-2, Brief Kap. 13 |
| V-02 | Schriftliche Pilotvereinbarung: kostenlos, Rechte am Ergebnis beim Owner, Mitwirkung des Kunden (Zeitmessung, Beispieldaten, Feedback, ggf. Referenz); ggf. rechtlich prüfen lassen | **vor Entwicklungsstart** | Owner | LP-3, F-6, Brief Kap. 13 |
| V-03 | Startdaten: Logo in Druckqualität, Zustandscodes (aus 3–5 Einkaufs-PDFs), Kategorien und Zustandsbezeichnungen je Kanal, bestehende Textbausteine, Bestätigung der Startbelegung Kap. 9.2/9.3 | vor Pilotbetrieb (Logo und Codes möglichst vor Entwicklungsstart) | Pilotkunde | OP-05, OP-13, A-21 |
| V-04 | Rechtliche Prüfung der Textbausteine (Akku-Hinweis, Gewährleistung/„Garantie“, Rechtsblock), der GPSR-Feldliste und der Nutzung des Kopier-Assistenten bei Kleinanzeigen | vor Pilotbetrieb | Pilotkunde | Brief Kap. 9, OP-14 |
| V-05 | Prüfen, ob ein Auftragsverarbeitungsvertrag nötig ist, falls MarloNET das System betreibt (nach REQ-069 speichert resellr keine personenbezogenen Daten von Käufern und vom Nutzer; geschäftliche Kontaktangaben nach REQ-027 und REQ-028 sind ausgenommen) | vor Pilotbetrieb | Owner | OP-23 |

### 11.5 Risiken

| ID | Risiko | Wirkung | Gegenmaßnahme in dieser Spezifikation |
| --- | --- | --- | --- |
| RI-01 | Kontosperre bei Kleinanzeigen durch Automatisierung | Verlust eines Hauptkanals | REQ-047 (nur manuell), REQ-079 (keine Verbindung) |
| RI-02 | eBay ändert Kategorien und Zustandswerte | falsche Ausgaben | Zuordnungen als Einstellung (REQ-023, REQ-024) |
| RI-03 | Rechtliche Mängel in zentral verbreiteten Textbausteinen | Abmahnung in allen Inseraten zugleich | Prüfstatus (REQ-054), zentrale Korrektur (REQ-053), V-04 |
| RI-04 | Geringes Volumen begrenzt den Nutzen | Business Case trägt nicht | V-01 vor Entwicklungsstart; REQ-063 |
| RI-05 | Abhängigkeit von einem Pilotkunden; geringe Verbindlichkeit beim kostenlosen Pilot | fehlende Mitwirkung (Messung, Daten, Feedback) | V-02 (Mitwirkung schriftlich) |
| RI-06 | Flexibilitätsanspruch (Gerätearten, Einstellungen) bläht Phase 1 auf | Verzögerung | nur 4 Gerätearten ausliefern (REQ-006); Erweiterbarkeit nur über REQ-076 prüfen; feste Liste von Datentypen (REQ-005) |
| RI-07 | Kopier-Assistent im Alltag nicht akzeptiert (Brief-A-3); Kunde bleibt bei Excel (Brief-A-4) | Ziel SC-02 verfehlt | REQ-047 bis REQ-049, REQ-062, REQ-080; Excel-Übernahme (REQ-056, Could); Empfehlung im Brief: klickbarer Prototyp mit 2 echten Modellen |
| RI-08 | Viele Einstellungen überfordern den Nutzer | falsche Ausgaben, Supportaufwand | REQ-006 (sinnvolle Startbelegung), REQ-072 (Protokoll), REQ-076 (Zeitziel) |
| RI-09 | Annahmen zum Gruppieren von Geräten (A-15, A-16) passen nicht zur Praxis | falsche Stückzahlen oder Angaben | Variantenmerkmale als Einstellung (REQ-005), REQ-018 (Abweichungsanzeige), OP-21 |
| RI-10 | Startannahmen der Parallelphase (Kap. 13.1) erweisen sich als falsch, insbesondere zu Web oder Desktop (OP-15) und zum Betriebsmodell (OP-23) | Nacharbeit in Architecture Baseline und UI/UX-Design | Kap. 13.1 nennt je Annahme die Folge; frühe Entscheidung zu OP-15 im Parallelschritt |
| RI-11 | Bearbeitet der Nutzer denselben Datensatz gleichzeitig in zwei Fenstern, kann eine Änderung unbemerkt überschrieben werden (Folge der Rücknahme von REQ-083) | einzelne verlorene Änderung | Nur ein Nutzer (E-4); Restrisiko akzeptiert [Vorschlag BA]; Änderungsprotokoll REQ-072 macht den Verlust nachvollziehbar |
| RI-12 | Ein späterer Händler mit Mitarbeitenden braucht Benutzerkonten und Rollen (F-5, produktfähig) | Nacharbeit in einem späteren Release | Konten und Rollen sind ausdrücklich außerhalb von Release 0.1 (Kap. 14); Entscheidung bei der Produktentscheidung des Owners |
| RI-13 | Datenverlust bei Ausfall, Verlust oder Beschädigung des Arbeitsplatzrechners, wenn der Owner nicht oder nicht bei beendetem resellr sichert; resellr sichert in Phase 1 nicht selbst (E-7) | Verlust aller Daten seit der letzten eigenen Sicherung, ohne Sicherung aller Daten | Dauerhafter Hinweis (REQ-104), Aktion „resellr beenden“ (REQ-105), alle Daten in einem Datenordner (REQ-106). Restrisiko vom Owner getragen; Verantwortung beim Owner (Entscheidung E-7 vom 06.11.2026); eine Sicherungsfunktion ist Kandidat für ein späteres Release (Kap. 14) |

## 12. Annahmen

| ID | Annahme | Validierung | Verantwortlich | Folge, falls falsch |
| --- | --- | --- | --- | --- |
| A-01 | **Erledigt durch E-4 (06.11.2026):** Mit resellr arbeitet genau eine Person; es gibt keine Rollen. Bis v0.2: „1–3 Nutzer, zwei Rollen“ | – | – | – |
| A-02 | Der Arbeitsplatzrechner hat Netzwerkzugang; Offline-Betrieb ist nicht erforderlich. (Keine mobile Nutzung und ein einziger PC sind seit E-2 und E-6 entschieden; OP-07 erledigt.) | Architecture Baseline | Software Architect | Offline-Anforderung ergänzen; Kap. 7 und REQ-077 anpassen |
| A-03 | Verkäufe werden je Gerät (WI-Nr) mit Kanal und Datum gepflegt | Rückfrage Pilotkunde (OP-08) | Product Owner → Owner | REQ-021, REQ-052 auf Zähler je Kanal umstellen |
| A-04 | Preise werden je Kanal manuell erfasst; Preisregel nur als fester Auf-/Abschlag (Beleg: 269/279, 289/299 €) | Rückfrage Pilotkunde (OP-09) | Product Owner → Owner | REQ-033, REQ-085 anpassen |
| A-05 | Artikelnummer des Modell-Inserats = WI-Nr des anlegenden Geräts, änderbar über REQ-088; sie bleibt unverändert, wenn dieses Gerät verkauft oder storniert wird | Rückfrage Pilotkunde (OP-10) | Product Owner → Owner | REQ-019, REQ-088, Kap. 9.6 anpassen |
| A-06 | Fotos werden im System je Modell-Inserat abgelegt | Rückfrage Pilotkunde (OP-11) | Product Owner → Owner | REQ-042, REQ-048 auf Verweis umstellen; REQ-106 anpassen (Fotos lägen außerhalb des Datenordners und wären nicht Teil der Sicherung) |
| A-07 | **Aufgehoben durch E-7 (06.11.2026):** resellr sichert in Phase 1 nicht selbst; die Sicherung ist freiwillig und Sache des Owners (REQ-066 Withdrawn in v0.3.2; REQ-104 bis REQ-106). Bis v0.3.1: „Tragbarer Datenverlust ≤ 1 Arbeitstag, Wiederherstellung ≤ 2 Arbeitstage“ | – | – | – |
| A-08 | Pilotkunde liefert Logo in Druckqualität; sonst keine Designvorgaben | Rückfrage Pilotkunde (OP-13) | Product Owner → Owner | Kap. 10.4 ergänzen |
| A-09 | Pilotkunde lässt Rechtstexte vor Pilotbetrieb prüfen; bis dahin „rechtlich ungeprüft“ | Rückfrage (OP-14) | Pilotkunde | Pilotbetrieb nur mit ungeprüften Texten nach Bestätigung (REQ-054) |
| A-10 | Datenblatt ist ein internes Arbeits- und Lagerblatt je Gerät (Kopfzeile mit Feldern für handschriftliche Kanalvermerke); Layout inhaltlich gleichwertig zur Excel, nicht pixelgenau | Fragen-Karte MAR-114 (OP-01) | Product Owner → Owner | REQ-050, REQ-051, Kap. 10.4 anpassen |
| A-11 | Die EAN eines Modell-Inserats ist entweder die Original-EAN der Modellvorlage (Kennzeichnung „Original“, Standard beim Anlegen) oder eine am Modell-Inserat eingegebene eigene EAN (Kennzeichnung „eigene“); das System vergibt keine EANs; eigene EANs gelten je Modell-Inserat, nicht je Gerät | OP-02 | Product Owner → Owner | ggf. neue Anforderung EAN-Vergabe; EAN je Gerät würde Kap. 6.0, REQ-040 und REQ-088 ändern |
| A-12 | Datenvolumen bis 2.000 Modellvorlagen, 10.000 Geräte, 3.000 Modell-Inserate, 60.000 Fotos; 1 Nutzer (E-4) (Puffer über der öffentlichen Schätzung: Shop-IDs bis 177, 4 aktive Kleinanzeigen) | Fragen-Karte MAR-114 (OP-03) | Product Owner → Owner | REQ-060, REQ-064 anpassen |
| A-13 | Shop und Kleinanzeigen sind Hauptkanäle; eBay erhält denselben Kopier-Assistenten ohne eigene Zusatzfunktionen | Fragen-Karte MAR-114 (OP-04) | Product Owner → Owner | Priorität eBay-bezogener Startbelegung |
| A-14 | Zustandscodes sind kurze Kürzel, die je Lieferant verschieden sein können; ein Code ergibt einen Klartext | Einkaufs-PDFs (OP-05) | Pilotkunde | REQ-015, REQ-022 anpassen |
| A-15 | Modell-Inserate derselben Modellvorlage werden ausschließlich durch Variantenangaben getrennt (Zustand, Optik-Note, Zustandsbeschreibung, Variantenmerkmale; Startbelegung der Variantenmerkmale Kap. 9.3: RAM, Speicherkapazität, Speichertyp, Tastaturlayout, Betriebssystem, Netzteil, Akku). Die Zustandsbeschreibung wird zeichengleich verglichen (ohne Groß-/Kleinschreibung und Randleerzeichen). Akkukapazität, WI-Nr und übrige Gerätewerte dürfen abweichen. „Trotzdem zuordnen“ ist bei jeder Abweichung zulässig und wird protokolliert | Rückfrage Pilotkunde (OP-21) | Product Owner → Owner | Variantenkennzeichen per Einstellung ändern (REQ-005); bei anderer Vergleichsregel REQ-018, REQ-019, REQ-088 und Kap. 6.0 anpassen; falls „trotzdem zuordnen“ bei Variantenmerkmalen gesperrt werden soll, REQ-018 ergänzen |
| A-16 | Bei mehreren Geräten in einem Modell-Inserat wird die Akkukapazität als Spanne „min–max %“ der verfügbaren Geräte ausgegeben, bei einem Gerät oder gleichen Werten als Einzelwert. Ergänzt in v0.3 [Vorschlag BA]: Geräte mit „nicht ermittelbar“ gehen nicht in die Spanne ein, werden aber mit „bzw. nicht ermittelbar“ ausgewiesen; haben alle eingehenden Geräte „nicht ermittelbar“, lautet der Wert „nicht ermittelbar“; Geräte ohne Akku oder ohne Akkukapazität gehen nicht ein; ohne eingehendes Gerät ist der Wert leer (Regeln Kap. 9.7). Auf dem Datenblatt eines Geräts gilt der Wert dieses Geräts (REQ-050) | Rückfrage Pilotkunde (OP-21); Owner mit OP-17 | Product Owner → Owner | REQ-036, REQ-050 und Kap. 9.7 anpassen |
| A-17 | Titel-Höchstlängen: Kleinanzeigen 65 [Beleg], eBay 80, Shop 128 Zeichen [Modellwissen, Stand unbekannt] | Prüfung der aktuellen Kanalregeln vor Entwicklungsstart (OP-22) | Software Architect | Startwerte REQ-035 ändern (Einstellung) |
| A-18 | Optik-Note: 1 = sehr gut bis 5 = Display gebrochen (Research: „offenbar“); die Bedeutung je Note legt der Pilotkunde fest | Rückfrage Pilotkunde (OP-20) | Pilotkunde | Zustandszuordnungen und Texte anpassen |
| A-19 | Startwerte Zustand: gebraucht, defekt, refurbished | Rückfrage Pilotkunde (OP-20) | Pilotkunde | Startbelegung ändern (Einstellung) |
| A-20 | GPSR-Herstellerangaben sind für alle drei Kanäle Voraussetzung der Freigabe | Rechtsprüfung (OP-14) | Pilotkunde | REQ-041, REQ-044 auf Warnung statt Sperre umstellen |
| A-21 | Startbelegung (Kap. 9.2, 9.3, 9.8, 9.12) ist aus Excel und Inseraten abgeleitet und deckt den Bedarf | Abstimmung mit Pilotkunde (V-03) | Pilotkunde | Startbelegung ändern (Einstellung) |
| A-22 | Herstellernummer gehört zur Modellvorlage (nicht zum Gerät) | Rückfrage Pilotkunde (OP-21) | Product Owner → Owner | REQ-008, REQ-040 anpassen |
| A-23 | Die Anforderungen gelten unabhängig vom Betriebsmodell | Architecture Baseline | Software Architect | – |
| A-24 | **Erledigt durch E-3 (06.11.2026):** Barrierefreiheit ist ganz gestrichen (REQ-071 zurückgezogen). Bis v0.2: „keine gesetzliche Barrierefreiheitspflicht, WCAG 2.2 AA als Ziel“; die Begründung zur fehlenden gesetzlichen Pflicht steht als Hintergrund in Kap. 7 (Abdeckung C4) | – | – | – |
| A-25 | Lieferanten werden nur mit Namen als Einstellung geführt; der Nutzer pflegt sie (REQ-099) und wählt beim Erfassen eines Geräts aus der Liste. Offen ist nur noch, ob statt der Liste Freitext gewünscht ist (OP-26); die Frage nach Rechten ist mit E-4 erledigt | Einkaufs-PDFs (OP-05); OP-26 | Owner/Pilotkunde | bei Freitext: REQ-099 entfällt, REQ-012 und REQ-022 auf Freitext umstellen (lieferantenspezifische Codes dann unsicher) |
| A-26 | Produktidentifikation für GPSR = EAN des Modell-Inserats, sonst Herstellernummer, sonst Artikelnummer (Beleg: Kleinanzeigen nutzt die Shop-EAN) | Rechtsprüfung (OP-14) | Pilotkunde | REQ-041 anpassen |
| A-27 | Längengrenzen WI-Nr (20) und Artikelnummer (30) | Rückfrage Pilotkunde (OP-10) | Product Owner → Owner | Kap. 9.6 anpassen |
| A-28 | **Erledigt durch E-5 (06.11.2026):** keine Benutzerkonten, keine Initialpasswörter, kein Zurücksetzen durch das System. Im Netzbetrieb gibt es ein Zugangspasswort; vergisst der Nutzer es, setzt es der Betreiber außerhalb der Funktionen des Systems zurück (REQ-001). Bis v0.2: Passwortverfahren über Benutzerkonten | – | – | – |
| A-29 | **Erledigt durch E-4 (06.11.2026):** Der Nutzer legt Hersteller an und pflegt die GPSR-Herstellerangaben (REQ-100, REQ-027). Bis v0.2: Annahme zum Recht einer Rolle, Hersteller anzulegen | – | – | – |
| A-30 | **Erledigt durch E-4 und E-5 (06.11.2026):** resellr speichert keine personenbezogenen Daten von Käufern und vom Nutzer (REQ-069); es gibt nichts zu anonymisieren (REQ-102 zurückgezogen). Protokolleinträge werden nach 24 Monaten gelöscht (REQ-072). Bis v0.2: Anonymisierung nach 24 Monaten | – | – | – |
| A-31 | Bestandsangaben (Stückzahl, WI-Nrn, Akkukapazität) dürfen sich in freigegebenen und veröffentlichten Kanal-Inhalten ohne erneute Freigabe aktualisieren; die Freigabe deckt Inhaltsangaben ab, die Gerätewerte sind durch die Prüfmarkierung bereits geprüft | OP-29 | Owner | REQ-091 ändern: Bestandsangaben lösen „geändert seit Freigabe“ aus oder werden im freigegebenen Stand eingefroren; Folge: erneute Freigabe bei jedem Einbuchen (Konflikt mit REQ-062) oder veraltete WI-Nrn im Inserat |
| A-32 | Der Lieferumfang eines Modell-Inserats besteht aus null bis mehreren Textbausteinen der Art *Lieferumfang*; Netzteil und Akku werden als Merkmale ausgegeben | Abstimmung mit Pilotkunde (V-03) | Pilotkunde | REQ-088 und Kap. 9.7 um Freitext-Lieferumfang ergänzen |
| A-33 | Startannahme zu OP-15 (Kap. 13.1): Die eigene Oberfläche ist entschieden (E-1); offen ist nur Web oder Desktop. Bis zur Entscheidung: keine Festlegung auf Web oder Desktop; Bedienung am Arbeitsplatzrechner mit Tastatur und Maus ab 1366 × 768, parallel zu einem anderen geöffneten Programm (Kanal-Formular) | Entscheidung OP-15 | Software Architect und Owner | siehe Kap. 13.1 |
| A-34 | Startannahme zu OP-24 (Kap. 13.1): Der Arbeitsplatzrechner hat ein vom Hersteller noch unterstütztes Desktop-Betriebssystem und aktuelle Programmversionen; kein Altsystem | Angaben des Owners zu seinem Arbeitsplatzrechner (OP-24) | Owner (als Nutzer, E-4, E-6) | siehe Kap. 13.1 |
| A-35 | Startannahme zu OP-23 (Kap. 13.1): Der Datenbestand wird an einer Stelle gehalten. **Betrieb nur auf dem PC des Nutzers ist zulässig** (E-4, E-6). Ob ein Zugangspasswort nötig ist, ergibt sich aus der Architektur: nur im Netzbetrieb (E-5, REQ-001). Wer betreibt und wo die Daten liegen, ist offen | Entscheidung OP-23 | Owner mit Software Architect | siehe Kap. 13.1 |
| A-36 | Startannahme zu OP-31 (Kap. 13.1) [Vorschlag BA]: Die Aktion „resellr beenden“ (REQ-105) gibt es nur im Betrieb nur am Arbeitsplatzrechner. Im Netzbetrieb zeigt der Hinweis „Sicherung einrichten“ (REQ-104) denselben Text ohne Beenden-Aktion, weil das Beenden alle Zugriffe beenden würde; das Beenden für eine Sicherung ist dort Sache des Betreibers außerhalb der Funktionen des Systems | Entscheidung OP-31 (zusammen mit OP-23) | Owner mit Software Architect | siehe Kap. 13.1 |
| A-37 | Startannahme zu OP-32 (Kap. 13.1) [Vorschlag BA]: Eine automatische Kopie als Teil des Update-Vorgangs ist keine Sicherung im Sinne von Kap. 14 | Entscheidung OP-32 | Product Owner mit Software Architect, bei Bedarf Owner | siehe Kap. 13.1 |
| A-38 | Lesart des freigegebenen Stands zu REQ-005 (neu in v0.3.4): Deaktivieren und Wieder-Aktivieren eines Merkmals ändern keine seiner übrigen Angaben, insbesondere nicht das Kennzeichen „variantenbildend“. Ein Variantenmerkmal bleibt deshalb auch im deaktivierten Zustand Variantenmerkmal (Glossar „Variantenmerkmal“: Ebene *Gerät* und Kennzeichen, kein Status) und wird nach der Vergleichsregel (Kap. 6.0) weiter verglichen; ein während der Deaktivierung erfasstes Gerät ohne Wert weicht daher von einem Modell-Inserat mit Wert ab (REQ-018). Die Bezeichnung eines Merkmals ist je Geräteart eindeutig, ohne Ausnahme für deaktivierte Merkmale; beim Aktivieren kann daher kein Namenskonflikt entstehen | Requirements Review v0.3.4; Bestätigung durch den Owner mit der Freigabe (Freigabe-Briefing, kritische Annahme 3) | Business Analyst; Owner | Sollen deaktivierte Merkmale beim Vergleich nicht zählen, ist das eine neue Fachregel in Kap. 6.0, REQ-005, REQ-018 und REQ-019 (eigener Change); UI-027 und die Technische Spezifikation wären anzupassen |
| A-39 | Lesart des freigegebenen Stands zu REQ-005 (neu in v0.3.4, Korrekturrunde 2, FIND-035; Auslöser in Korrekturrunde 3 abschließend festgelegt, FIND-038): Ein wieder aktiviertes Pflichtmerkmal ist ein aktives Pflichtmerkmal. Das Aktivieren selbst fordert keinen Wert nach (REQ-005). Für jedes spätere Speichern einer Änderung an einer Modellvorlage nach REQ-010, an den Gerätewerten eines Geräts nach REQ-014 oder an den Inseratswerten eines Modell-Inserats nach REQ-088 (ohne Preise und Fotos) gelten die bestehenden Pflichtregeln: REQ-010 („dieselben Pflicht- und Validierungsregeln wie in REQ-008“; REQ-008: „Pflichtmerkmale sind Pflicht“, „Fehlen Pflichtangaben, wird das Speichern abgelehnt und jedes fehlende Feld benannt“; AC-REQ-008-05, AC-REQ-010-03), REQ-014 (Werte der übrigen Merkmale der Ebene *Gerät* „nach ihrer Merkmalsdefinition (REQ-005)“, zu der „Pflichtmerkmal ja/nein“ gehört; Fehlerpfad in Kap. 6.1, J-01: „Pflichtangaben fehlen → Ablehnung mit Nennung (REQ-008, REQ-014)“) und REQ-088 (Variantenangaben „Regeln wie REQ-014“, übrige inserierte Gerätewerte „nach Merkmalsdefinition, REQ-005“). Keine dieser Regeln macht eine Ausnahme für Datensätze, die während einer Deaktivierung entstanden sind; einem solchen Datensatz fehlt der Wert daher, bis er geändert und gespeichert wird, und dann wird der Wert verlangt. Betroffen sind nach der Startbelegung (Kap. 9.3) z. B. Prozessor (Notebook: Ebene *Modell*, Pflicht) und RAM (Notebook: Ebene *Gerät*, Pflicht, variantenbildend). Der freigegebene Stand kennt weder eine Liste der Datensätze mit fehlenden Werten noch eine Markierung solcher Datensätze; v0.3.4 ergänzt beides nicht. Nur diese drei Anforderungen prüfen Werte nach der Merkmalsdefinition; REQ-088 nimmt Preise und Fotos ausdrücklich aus. Alle anderen Vorgänge berührt die Lesart nicht; für sie gelten ihre Regeln unverändert, insbesondere Preis erfassen (REQ-032) und Fotos zuordnen (REQ-042), obwohl Preise und Fotos nach Glossar zu den Inseratswerten gehören, sowie Anlegen, Zuordnen und Umbuchen (REQ-019, REQ-017, REQ-020), Verkauf und Rücknahme (REQ-021, REQ-084), WI-Nr-Korrektur (REQ-092), Storno (REQ-093) und Freigabe (REQ-044). Keine dieser Anforderungen prüft Pflichtmerkmale nach REQ-005; die Freigabe prüft nur ihre eigenen Freigabebedingungen | Requirements Review v0.3.4, Runden 2 und 3; Bestätigung durch den Owner mit der Freigabe (Freigabe-Briefing, kritische Annahme 2) | Business Analyst; Owner | Sollen Datensätze aus der Zeit der Deaktivierung auch nach dem Aktivieren ohne den Wert gespeichert werden können, ist das eine Ausnahme von den Pflichtregeln in REQ-008/REQ-010, REQ-014 und REQ-088, also eine neue Fachregel (eigener Change); AC-REQ-005-12 entfiele, UI-027 und die Technische Spezifikation wären anzupassen. Soll der Wert auch bei anderen Vorgängen verlangt werden (z. B. Preis erfassen nach REQ-032), ist das ebenfalls eine neue Fachregel; Fall (c) von AC-REQ-005-12 entfiele |

## 13. Offene Fragen

„Blockierend“ bezieht sich auf den unabhängigen Review und die Requirements-Freigabe. Keine offene Frage blockiert diese. Durch E-1 bis E-6 erledigte Fragen bleiben mit ihrer ID als „erledigt“ in der Tabelle. Die Spalte „Klärung bis“ nennt den spätesten Zeitpunkt; für Fragen, die Architecture Baseline oder UI/UX-Design betreffen, gilt ab dem Start der Parallelphase die dokumentierte Startannahme aus Kap. 13.1, sodass beide Rollen gleichzeitig beginnen können.

| ID | Frage | Entscheider | Blockierend | Klärung bis | Annahme bis dahin |
| --- | --- | --- | --- | --- | --- |
| OP-01 | Wofür wird das gedruckte Datenblatt genutzt, wer liest es, muss das Layout exakt bleiben? | Owner/Pilotkunde | nein | Annahme gilt ab Start der Parallelphase (Kap. 13.1); Klärung bis Abschluss UI/UX-Design | A-10 |
| OP-02 | Vergibt der Pilotkunde eigene EANs (Präfix 4255867), nach welcher Regel, soll das System vergeben? | Owner/Pilotkunde | nein | vor Entwicklungsstart | A-11 |
| OP-03 | Volumen: Geräte/Monat, neue Modelle/Varianten, aktive Inserate je Kanal | Owner/Pilotkunde | nein | Annahme gilt ab Start der Parallelphase (Kap. 13.1); Klärung bis Abschluss Architecture Baseline | A-12 |
| OP-04 | Umsatzanteil je Kanal, insbesondere eBay | Owner/Pilotkunde | nein | vor Entwicklungsstart | A-13 |
| OP-05 | 3–5 Einkaufs-PDFs mit Zustandscodes; Lieferanten; Kategorie- und Zustandswerte der Kanäle | Pilotkunde | nein | vor Pilotbetrieb | A-14, A-25 |
| OP-06 | **Erledigt durch E-4 (06.11.2026):** genau ein Nutzer, keine Rollen. Bis v0.2: Anzahl Nutzer; Einstellungen nur für bestimmte Personen? | Owner | – | erledigt | – |
| OP-07 | **Erledigt durch E-2 und E-6 (06.11.2026):** keine Smartphones und Tablets in Version 1; immer derselbe PC. Bis v0.2: Arbeitsort Arbeitsplatzrechner oder auch Smartphone/Tablet? | Owner | – | erledigt | – |
| OP-08 | Verkaufspflege je Gerät oder als Zahl je Kanal? | Owner/Pilotkunde | nein | vor Entwicklungsstart | A-03 |
| OP-09 | Gibt es feste Preisregeln zwischen den Kanälen? | Owner/Pilotkunde | nein | vor Entwicklungsstart | A-04 |
| OP-10 | Welche Artikelnummer gilt bei Stückzahl > 1; Längen von WI-Nr und Artikelnummer? | Owner/Pilotkunde | nein | vor Entwicklungsstart | A-05, A-27 |
| OP-11 | Fotos im System ablegen oder nur Verweis auf Ablageort? | Owner/Pilotkunde | nein | Annahme gilt ab Start der Parallelphase (Kap. 13.1); Klärung bis Abschluss Architecture Baseline | A-06 |
| OP-12 | Geschäftszeiten für Verfügbarkeit; Messung der Verfügbarkeit im Betrieb nur am Arbeitsplatzrechner (REQ-065); Einordnung der Zeiten nach einem Beenden für eine Sicherung (REQ-105, A-36), [Vorschlag BA] in REQ-065: weder Ausfall noch Geschäftszeit. (Tragbarer Datenverlust und Wiederherstellungszeit sind seit v0.3.2 durch E-7 entfallen: REQ-066 Withdrawn, A-07 aufgehoben.) | Owner mit Software Architect | nein | Annahme gilt ab Start der Parallelphase (Kap. 13.1); Klärung bis Abschluss Architecture Baseline | REQ-065 |
| OP-13 | Logo in Druckqualität (zulässige Formate PNG/JPEG, max. 5 MB [Vorschlag BA]), ggf. Farben/Schrift von notebookers.de | Pilotkunde | nein | vor Entwicklungsstart | A-08 |
| OP-14 | Rechtsprüfung: Akku-/Gewährleistungstexte, GPSR-Feldliste und Produktidentifikation, GPSR-Pflicht je Kanal, Nutzung des Kopier-Assistenten bei Kleinanzeigen | Pilotkunde | nein | vor Pilotbetrieb | A-09, A-20, A-26 |
| OP-15 | Art der Oberfläche: **nur noch Webanwendung oder Desktop-Anwendung.** Die eigene Oberfläche ist entschieden, ein PrestaShop-Modul ausgeschlossen (E-1). | Software Architect und Owner (E-1, Brief Kap. 6) | nein | Annahme A-33 gilt ab Start der Parallelphase (Kap. 13.1); Entscheidung früh im Parallelschritt, Ergebnis an den UI/UX Designer weitergeben | A-33 |
| OP-16 | **Erledigt durch E-3 (06.11.2026):** Barrierefreiheit ganz gestrichen (REQ-071 zurückgezogen). Bis v0.2: WCAG 2.2 AA als Ziel bestätigen oder absenken? | Owner | – | erledigt | – |
| OP-17 | Alle mit „[Vorschlag BA]“ gekennzeichneten Werte bestätigen oder ändern (vollständige Liste unten) | Owner | nein | Requirements-Freigabe | Werte wie angegeben |
| OP-18 | Sollen in Phase 1 Suchbegriffe/SEO-Felder (z. B. Meta-Titel im Shop) erzeugt werden? Der Ist-Prozess nennt sie (Brief Kap. 2), der MVP-Umfang (Brief Kap. 7) nicht. | Owner | nein | Requirements-Freigabe | nicht in Phase 1 (Kap. 14) |
| OP-19 | Im Brief ist keine Owner-Entscheidung „F-2“ ausgewiesen (Kap. 12 nennt F-1, F-3 bis F-7). Ist das beabsichtigt? | Product Owner | nein | Requirements-Freigabe | F-2 existiert nicht oder ist nicht relevant |
| OP-20 | Bedeutung der Optik-Noten 1–5 und Startwerte Zustand | Pilotkunde | nein | vor Pilotbetrieb | A-18, A-19 |
| OP-21 | Gruppierregel für Modell-Inserate: Welche Merkmale sind Variantenmerkmale (Startbelegung Kap. 9.3)? Soll die Zustandsbeschreibung zeichengleich verglichen werden? Soll „trotzdem zuordnen“ auch bei abweichenden Variantenmerkmalen (z. B. RAM) erlaubt sein? Akkukapazität bei mehreren Geräten; Herstellernummer je Modell oder Gerät | Owner/Pilotkunde | nein | vor Entwicklungsstart | A-15, A-16, A-22 |
| OP-22 | Aktuelle Titel-Höchstlängen und Pflichtfelder von eBay und Shop | Software Architect | nein | vor Entwicklungsstart | A-17 |
| OP-23 | Betriebsmodell/Hosting (wer betreibt, wo liegen die Daten, Betrieb nur am Arbeitsplatzrechner oder Netzbetrieb); ggf. Auftragsverarbeitung (V-05) | Owner mit Software Architect | nein | Annahme A-35 gilt ab Start der Parallelphase (Kap. 13.1); Entscheidung im Architecture Baseline | A-23, A-35 |
| OP-24 | Betriebssystem und Programme (mit Versionen) am Arbeitsplatzrechner | Owner (liefert die Angaben als Nutzer, E-4, E-6) | nein | Annahme A-34 gilt ab Start der Parallelphase (Kap. 13.1); Erhebung bis Abschluss Architecture Baseline | A-34 |
| OP-25 | **Erledigt durch E-5 (06.11.2026):** Zugangspasswort nur im Netzbetrieb; keine Konten, keine Rollen, kein Zurücksetzen durch das System; ohne Netzbetrieb keine Anmeldung. Bis v0.2: Passwortverfahren mit Initialpasswort oder E-Mail-Einladung? | Owner | – | erledigt | – |
| OP-26 | Lieferanten: Auswahlliste, die der Nutzer pflegt (A-25), oder Freitext beim Erfassen? (Die Frage nach Rechten ist mit E-4 erledigt.) | Owner/Pilotkunde | nein | vor Entwicklungsstart | A-25 |
| OP-27 | **Erledigt durch E-4 (06.11.2026):** Der Nutzer legt Hersteller an (REQ-100). Bis v0.2: Wer darf Hersteller anlegen? | Owner | – | erledigt | – |
| OP-28 | **Erledigt durch E-4 und E-5 (06.11.2026):** keine personenbezogenen Daten von Käufern und vom Nutzer, keine Anonymisierung (REQ-102 zurückgezogen); Löschfrist der Protokolleinträge ist Teil von OP-17 (REQ-072). Bis v0.2: Höchstdauer personenbezogener Daten | Owner | – | erledigt | – |
| OP-29 | Dürfen sich Bestandsangaben (Stückzahl, WI-Nrn, Akkukapazität) in freigegebenen und veröffentlichten Kanal-Inhalten ohne erneute Freigabe aktualisieren (A-31)? Berührt den Grundsatz „Freigabe jedes Inserats durch den Menschen“ (Brief Kap. 9, RB-11). | Owner | nein | Requirements-Freigabe | A-31 |
| OP-30 | Abgleich-Bestätigung (REQ-090): als Must beibehalten, vereinfachen oder streichen? Laut Reviewer (Runde 2, Hinweis 1) am ehesten verzichtbar; ohne REQ-090 lassen sich „Bestand auf Kanal anpassen“ und „Änderung auf Kanal übertragen“ nur über die Übergänge nach REQ-046 entfernen (*Veröffentlicht* → *Beendet* bzw. *Beendet* → *Veröffentlicht*). | Product Owner und Owner | nein | Requirements-Freigabe | REQ-090 bleibt Must wie beschrieben |
| OP-31 | Aktion „resellr beenden“ (REQ-105) im Netzbetrieb: nur im Betrieb nur am Arbeitsplatzrechner anbieten (Startannahme), auch im Netzbetrieb anbieten (würde alle Zugriffe beenden) oder im Netzbetrieb den Hinweistext (REQ-104) anders fassen, z. B. mit Verweis auf den Betreiber? Hängt mit dem Betriebsmodell (OP-23) zusammen. (Neu in v0.3.2.) | Owner mit Software Architect | nein | Annahme A-36 gilt ab Start der Parallelphase (Kap. 13.1); Entscheidung mit OP-23 im Architecture Baseline | A-36 |
| OP-32 | Ist die automatische lokale Kopie vor jedem Update (Architecture Baseline, ADR-006) mit dem Ausschluss jeder Sicherungsfunktion in Kap. 14 vereinbar? (Neu in v0.3.3.) | Product Owner mit Software Architect, bei Bedarf Owner | nein | Annahme A-37 gilt ab Start der Parallelphase (Kap. 13.1); Klärung bis Abschluss Architecture Baseline | A-37 |

**OP-17 – vollständige Liste der Werte mit [Vorschlag BA] (Stand v0.3.3, gekürzt; die Punkte bis Stand v0.3 hat der Owner mit der Freigabe von v0.3 am 06.11.2026 bestätigt, offen sind nur die Punkte „Neu in v0.3.1“, „Neu in v0.3.2“ und „Neu in v0.3.3“):**
- Feldlängen und Formate: REQ-004 (Geräteart-Name 50); REQ-008 (Modellbezeichnung 100, Typbezeichnung 50); REQ-014 (Zustandsbeschreibung 1.000); REQ-022 (Zustandscode 20, Klartext 500); REQ-023 (Zustandsbezeichnung und Zusatzangabe je 100); REQ-024 und REQ-086 (Kategorie 255); REQ-025 (Feldbezeichnung 100), Kap. 9.11 (fester Text 255); REQ-026 (Name 100, Text 5.000); REQ-028 (Händlermarke 100, Kontakt 500, Logo PNG/JPEG ≤ 5 MB); REQ-029 (Titel-Höchstlänge 20–500); REQ-042 (Fotos ≤ 20 MB, ≤ 20 Stück); REQ-046 (Inseratsnummer/Adresse 500); REQ-054 (prüfende Stelle 100); REQ-093 (Storno-Grund 1–200); REQ-099 (Lieferant 1–100); REQ-100 (Hersteller 1–50); Kap. 9.6 (Herstellernummer 1–40). WI-Nr (20) und Artikelnummer (30) sind Annahmen (A-27, OP-10).
- Startbelegung: Kennzeichen „Akku vorhanden“ (Kap. 9.2); Variantenmerkmale und Kürzungsprioritäten (Kap. 9.3); Merkmalszuordnungen (Kap. 9.8, abgeleitet aus Belegen); Abschnitte der Beschreibungsvorlagen, VB-Einstellung eBay (Kap. 9.12); weitere einzeln gekennzeichnete Startwerte in Kap. 9.2.
- Nicht-funktionale Schwellenwerte: REQ-060, REQ-061, REQ-065, REQ-066 (seit v0.3.2 Withdrawn, E-7), REQ-067 (Zugangspasswort mind. 12 Zeichen im Netzbetrieb), REQ-072 (Löschung der Protokolleinträge nach 24 Monaten, spätestens 7 Tage danach), REQ-073 (30 Tage), REQ-076 (mind. 6 Merkmale, Datenblatt, ≤ 60 min, Durchführung durch den Nutzer; aus dem Brief stammen nur Geräteart, eigene Merkmale/Titelmuster/Kategorie, Inserieren, keine Entwicklung), REQ-080 (Werte und Messung beim ersten Einsatz des Nutzers).
- Neu in v0.3 (Vorschläge über die Owner-Entscheidungen hinaus): REQ-097 im Netzbetrieb beibehalten (Zugangspasswort ändern, Must); erstes Zugangspasswort durch den Betreiber außerhalb des Systems (REQ-001); REQ-070 zurückgezogen (Ort der Daten über OP-23); REQ-083 zurückgezogen mit Restrisiko RI-11; Abgrenzung geschäftlicher Kontaktangaben in REQ-069; Wegfall der Abgleich-Kennzeichnungen beim Übergang *Veröffentlicht* → *Beendet* (REQ-046, Kap. 9.4; FIND-020); Ablehnung einer Änderung des Kennzeichens „variantenbildend“, die Modell-Inserate ununterscheidbar machen würde (REQ-005; FIND-023); Sonderfälle von `{Akkukapazität}` (A-16, Kap. 9.7) und Gerätewert auf dem Datenblatt (REQ-050; FIND-024).
- **Neu in v0.3.1 (FIND-026, FIND-027; offen bis zur Owner-Freigabe von v0.3.1, bis dahin Standardannahme):** Geltung eines erteilten Zugangs nur für das Programm auf dem Gerät, in dem das Zugangspasswort eingegeben wurde, bis dieses Programm beendet wird, ohne Zeitgrenze und ohne Abmeldung nach Inaktivität (REQ-001); bei einer Änderung des Zugangspassworts enden alle anderen bestehenden Zugänge, der ändernde bleibt bestehen (REQ-097; Alternative: bestehende Zugänge gelten bis zum Programmende weiter); Mindestlänge 12 Zeichen auch für das erste und jedes vom Betreiber zurückgesetzte Zugangspasswort, Einhaltung durch den Betreiber, Nachweis bei der Abnahme (REQ-067, Kap. 9.6); Verfügbarkeit im Betrieb nur am Arbeitsplatzrechner: nutzbar, solange der Arbeitsplatzrechner läuft, Zeiten ohne laufenden Arbeitsplatzrechner zählen nicht, Messung über ein Störungsprotokoll des Nutzers (REQ-065, OP-12).
- **Neu in v0.3.2 (E-7; offen bis zur Owner-Freigabe von v0.3.2):** Kurzüberschrift „Sicherung einrichten“ und Wortlaut des Hinweises einschließlich Speicherort des Datenordners (REQ-104); Rückfrage „resellr jetzt beenden? …“ und Meldung „resellr ist beendet. …“ (REQ-105); Startannahme A-36: Aktion „resellr beenden“ nur im Betrieb nur am Arbeitsplatzrechner (REQ-105, OP-31). **Zur ausdrücklichen Owner-Bestätigung, aus E-7 abgeleitet und nicht Owner-Wortlaut (gekennzeichnet in v0.3.3, FIND-030):** die Aktion „resellr beenden“ in resellr mit Priorität Must (REQ-105) und die Datenhaltung in einem einzigen Datenordner (REQ-106); Standardannahme: beide gelten wie beschrieben, falls der Owner nicht widerspricht.
- **Neu in v0.3.3 (FIND-032, FIND-033; offen bis zur Owner-Freigabe von v0.3.3, bis dahin Standardannahme):** Zeiten, in denen resellr nach einem vom Nutzer ausgelösten Beenden (REQ-105) oder, im Netzbetrieb, nach einem Beenden durch den Betreiber (A-36) nicht läuft, zählen bei der Verfügbarkeit weder als Ausfall noch als Geschäftszeit (REQ-065, OP-12); Startannahme A-37: Eine automatische Kopie als Teil des Update-Vorgangs ist keine Sicherung im Sinne von Kap. 14 (OP-32).
- Weitere: Suchbegriff-Mindestlänge 2 Zeichen (REQ-009).
- Entfallen gegenüber v0.2 (durch E-1 bis E-6): REQ-071 (WCAG 2.2 AA), REQ-102 (24 Monate, 7 Tage), REQ-067 (60 min Inaktivität, Passwortregeln für Initialpasswörter), REQ-070 (EU/EWR), REQ-076 (Durchführung durch einen Nutzer des Pilotkunden).

### 13.1 Startannahmen für Architecture Baseline und UI/UX-Design

Architecture Baseline (Software Architect) und UI/UX-Design (UI/UX Designer) beginnen nach der Requirements-Freigabe parallel und unabhängig voneinander. Für die folgenden offenen Fragen gilt **ab dem Start beider Rollen die genannte Annahme**. Beide Rollen arbeiten mit derselben Annahme; weicht die spätere Klärung ab, gilt die genannte Folge, und der Business Analyst weist die betroffenen REQ-IDs und UI-relevanten Randbedingungen in einer neuen Dokumentversion aus (Kap. 15); eine geänderte freigegebene Fassung braucht erneut Review und Owner-Freigabe. Diese Annahmen nehmen keine Technologie- oder Gestaltungsentscheidung vorweg.

| OP | Startannahme (ab Start der Parallelphase) | betrifft vor allem | Folge, falls falsch | Klärung bis |
| --- | --- | --- | --- | --- |
| OP-01 | A-10: Datenblatt ist ein internes Arbeits- und Lagerblatt je Gerät; Layout inhaltlich gleichwertig zur Excel, nicht pixelgenau | UI/UX-Design (Datenblatt) | exakte Nachbildung des Excel-Layouts; REQ-050, REQ-051, Kap. 10.4 anpassen; Nacharbeit am Datenblatt-Entwurf | Abschluss UI/UX-Design |
| OP-03 | A-12: bis 2.000 Modellvorlagen, 10.000 Geräte, 3.000 Modell-Inserate, 60.000 Fotos, 1 Nutzer (E-4) | Architecture Baseline | REQ-060, REQ-061, REQ-064 neu dimensionieren; bei deutlich höherem Volumen andere Annahmen zu Speicher und Leistung | Abschluss Architecture Baseline |
| OP-06 | erledigt durch E-4 (genau ein Nutzer, keine Rollen); keine Startannahme mehr nötig | – | – | – |
| OP-07 | erledigt durch E-2 und E-6 (keine Smartphones und Tablets in Version 1; ein Arbeitsplatzrechner ab 1366 × 768); offen bleibt nur A-02 (kein Offline-Betrieb) | beide | Offline-Anforderung: Kap. 7 und REQ-077 ergänzen | Abschluss Architecture Baseline |
| OP-11 | A-06: Fotos werden im System je Modell-Inserat abgelegt (REQ-042, REQ-048) | beide | nur Verweis auf externen Ablageort: REQ-042, REQ-048, REQ-064, REQ-106 ändern; Foto-Funktionen im UI/UX-Design vereinfachen; Speicherbedarf in der Architektur sinkt | Abschluss Architecture Baseline |
| OP-12 | Werte aus REQ-065: Verfügbarkeit ≥ 99 % Mo–Sa 8–18 Uhr (im Betrieb nur am Arbeitsplatzrechner: bei laufendem Arbeitsplatzrechner, REQ-065); Zeiten nach einem Beenden für eine Sicherung (REQ-105, A-36) zählen weder als Ausfall noch als Geschäftszeit [Vorschlag BA]. Datenverlust und Wiederherstellung entfallen seit v0.3.2 (E-7; REQ-066 Withdrawn, A-07 aufgehoben) | Architecture Baseline | strengere Werte: höherer Betriebsaufwand, andere Betriebsannahmen | Abschluss Architecture Baseline |
| OP-15 | A-33: eigene Oberfläche (entschieden, E-1); Bedienung am Arbeitsplatzrechner mit Tastatur und Maus ab 1366 × 768; parallele Nutzung neben einem anderen Programm (Kanal-Formular, Kopier-Assistent); keine Festlegung auf Web oder Desktop | beide, besonders UI/UX-Design | Die Entscheidung für Web oder Desktop ändert die Plattformannahmen (REQ-077, OP-24) und kann die Frage Netzbetrieb ja/nein (E-5, REQ-001) beantworten. **Die Entscheidung soll früh im Parallelschritt durch Software Architect und Owner fallen (E-1, Brief Kap. 6) und an den UI/UX Designer weitergegeben werden.** | früh im Parallelschritt |
| OP-23 | A-35 und A-23: Datenbestand an einer Stelle; Betrieb nur auf dem PC des Nutzers ist zulässig; Zugangspasswort nur im Netzbetrieb (E-5); Betreiber und Ort der Daten offen | Architecture Baseline | Netzbetrieb: REQ-001, REQ-067 und REQ-097 werden wirksam (Zugangspasswort); ohne Netzbetrieb gibt es keine Anmeldung | Abschluss Architecture Baseline |
| OP-31 | A-36: Aktion „resellr beenden“ (REQ-105) nur im Betrieb nur am Arbeitsplatzrechner; im Netzbetrieb zeigt der Hinweis (REQ-104) denselben Text ohne Beenden-Aktion | beide, besonders UI/UX-Design | Aktion auch im Netzbetrieb: REQ-105 und AC-REQ-104-06, AC-REQ-105-05 ändern, Rückfrage um die Wirkung auf alle Zugriffe ergänzen, Beenden im Netzbetrieb in der Messmethode von REQ-106 und in AC-REQ-106-01 über REQ-105 statt durch den Betreiber; anderer Text im Netzbetrieb: REQ-104 ergänzen; Nacharbeit am Hinweis im UI/UX-Design | mit OP-23, Abschluss Architecture Baseline |
| OP-32 | A-37: Eine automatische Kopie als Teil des Update-Vorgangs ist keine Sicherung im Sinne von Kap. 14 | Architecture Baseline | Update-Kopie gilt als Sicherung: Sie entfällt, oder sie wird als eigene Anforderung aufgenommen und Kap. 14 entsprechend abgegrenzt; die Architecture Baseline (ADR-006) wird angepasst | Abschluss Architecture Baseline |
| OP-24 | A-34: Der Arbeitsplatzrechner hat ein vom Hersteller noch unterstütztes Desktop-Betriebssystem und aktuelle Programmversionen; kein Altsystem | beide | Altsystem oder Einschränkungen: Kompatibilitätsanforderungen in REQ-077 ergänzen; ggf. Einfluss auf OP-15 | Abschluss Architecture Baseline |

## 14. Außerhalb des Umfangs (Release 0.1)

- Direktveröffentlichung im PrestaShop (Release 0.2) und bei eBay (nach Bedarf, Brief Kap. 8).
- Automatischer Stückzahl-Abgleich zwischen Kanälen, GOAL-05/SC-05 (Release 0.3).
- Einlesen von Einkaufs-PDFs, Auslesen von Geräte- und Akkudaten (Release 0.4).
- Jede Automatisierung bei Kleinanzeigen (F-3), ohne schriftliche Zustimmung von Kleinanzeigen auch später.
- Vorgefertigte Vorlagen für weitere Gerätearten wie Zubehör, Monitore, Sonstiges (z. B. Nähmaschinen); Phase 1 muss sie nur ohne Entwicklung ermöglichen (REQ-076).
- Mehrere Händler im selben System, Selbstregistrierung, Abrechnung, weitere Kanäle.
- Preisfindung (Preisvorschläge aus Marktdaten), Bestellungen, Versand, Buchhaltung, Warenwirtschaft.
- Bildbearbeitung und KI-Fotoanalyse; KI-Texterzeugung.
- Automatisches Befüllen von Modellvorlagen aus Herstellerdatenbanken (Icecat, Lenovo PSREF; Research Kap. 3.3).
- Suchbegriffe/SEO-Felder, solange OP-18 nicht anders entschieden ist.
- Nachträgliches Ändern der Modellvorlage eines erfassten Geräts als eigene Funktion; Korrekturweg ist Storno (REQ-093) und Neuerfassung mit der richtigen Modellvorlage. Stornieren verkaufter Geräte; Rücknahme eines Stornos.
- Löschen von Geräten (Geräte werden storniert, REQ-093; Datenerhalt REQ-103).
- Benutzerkonten, Rollen und Rechteverwaltung, Mehrbenutzerbetrieb, Mitarbeitende (E-4, E-5); Zurücksetzen des Zugangspassworts durch das System, Initialpasswörter, E-Mail-Versand durch das System und Selbstbedienung „Passwort vergessen“ (E-5); Anmeldung im Betrieb nur am Arbeitsplatzrechner (E-5).
- Unterstützung von Smartphones und Tablets (E-2); Arbeit an mehreren Arbeitsplatzrechnern (E-6).
- Barrierefreiheit nach einem Standard (z. B. WCAG) (E-3).
- Umsetzung als PrestaShop-Modul bzw. Einbettung in das PrestaShop-Backoffice (E-1).
- Speichern personenbezogener Daten von Käufern und vom Nutzer (REQ-069).
- Jede Sicherungs- und Wiederherstellungsfunktion durch resellr (automatische oder vom Nutzer ausgelöste Sicherung, Zeitpläne, Aufbewahrung, Wiederherstellen aus einer Sicherung), eine Prüfung, ob gesichert wurde, und eine Anbindung an OneDrive oder ein anderes Sicherungsziel (E-7). In Phase 1 gibt es nur den Hinweis (REQ-104) und die Aktion „resellr beenden“ (REQ-105); der Owner sichert selbst. Eine Sicherungsfunktion ist Kandidat für ein späteres Release. Ob die automatische lokale Kopie vor jedem Update (Architecture Baseline, ADR-006) unter diesen Ausschluss fällt, ist offen (OP-32; Startannahme A-37: keine Sicherung im Sinne dieses Ausschlusses).
- Automatische Pflege der Kategorielisten der Kanäle (Abfrage bei den Kanälen); Kategorien werden als Einstellung von Hand gepflegt (REQ-024).
- Händlergespräche und Produktentscheidung (SC-06): Aufgabe des Owners, keine Systemfunktion.

## 15. Änderungshistorie

| Version | Zyklus | Datum | Änderung | Adressierte Findings |
| --- | --- | --- | --- | --- |
| v0.1 | Erstentwurf (vor Review-Zyklus 1) | 06.11.2026 | Erstellung auf Basis Product Brief v1.0 (Commit `45d5ef6`), Research v0.3 und `Datenblatt.xlsx` | – |
| v0.2 | Korrekturzyklus 1 (nach Review Runde 1, Verdikt `changes_requested`) | 06.11.2026 | Korrektur aller 19 Findings aus `requirements-review-r1` (Revision `23c36dba…`), keine Ablehnung; neue REQ-084 bis REQ-102; Startannahmen der Parallelphase (Kap. 13.1, Hinweise H-2/H-3); Details unten | FIND-001 bis FIND-019 |
| v0.3 | Neue Fassung nach Owner-Entscheidungen; danach Review-Zyklus 1 für v0.3 (Review Runde 2 zu v0.2 war `pass` mit fünf minor Findings) | 06.11.2026 | Einarbeitung der Owner-Entscheidungen E-1 bis E-6 nach der Änderungsanalyse an MAR-121 (Revision `5f87d5e9…`); neun REQs zurückgezogen (keine Umnummerierung); Rolle „Nutzer“ statt „Bearbeiter“/„Administrator“; Korrektur von FIND-020 bis FIND-024 aus `requirements-review-r2` (Revision `0f3fdb82…`); Hinweise RB-11 und H-2; neue OP-30; keine neuen REQ-IDs; Details Kap. 15.4 bis 15.9 | FIND-020 bis FIND-024 |
| v0.3.1 | Folgerevision zu v0.3 (Review v0.3 Runde 1 `pass`; v0.3 vom Owner am 06.11.2026 freigegeben); Delta-Review gemeinsam mit v0.3.2 an MAR-133: `pass` | 06.11.2026 | Basis Revision `170ca77f…` (v0.3). Ausschließlich Korrektur der minor Findings FIND-025 bis FIND-029 aus `requirements-review-v03-r1` (Revision `6adbad6c…`), Auftrag MAR-129: neue REQ-103 (Datenerhalt, aus REQ-095 herausgelöst); neue AC-REQ-001-07 bis -09 und AC-REQ-097-05; neue [Vorschlag BA] in OP-17; Vermerk zu Hinweis H-2 in Kap. 15.6; Metadaten. Keine Umnummerierung, keine Wiederverwendung von IDs, keine Änderung an Priorität oder Status einer REQ; E-1 bis E-6 unberührt (insbesondere keine Abmeldung nach Inaktivität); Details Kap. 15.10 | FIND-025 bis FIND-029 |
| v0.3.2 | Folgerevision zu v0.3.1 (Owner-Entscheidung, Änderung einer freigegebenen Regel und Klarstellung; kein Review-Finding); Delta-Review gemeinsam mit v0.3.1 an MAR-133: `pass` mit fünf minor Findings (FIND-030 bis FIND-034, korrigiert in v0.3.3) | 06.11.2026 | Basis Revision `d816223d…` (v0.3.1), Auftrag MAR-132 (Parent MAR-131). (1) Owner-Entscheidung E-7 zur Sicherung (Fragekarte `15ba6e78…` an MAR-125): REQ-066 *Withdrawn*; neue REQ-104 (Hinweis „Sicherung einrichten“), REQ-105 (Aktion „resellr beenden“, aus E-7 abgeleitet), REQ-106 (ein Datenordner, aus E-7 abgeleitet) mit AC; REQ-105 und REQ-106 zur ausdrücklichen Owner-Bestätigung (Kennzeichnung berichtigt in v0.3.3, FIND-030); A-07 aufgehoben; neue A-36, OP-31, RB-21, RI-13; OP-12 eingeengt. (2) Leere Merkmalsfelder im Kopier-Assistenten: Änderung der mit v0.3 freigegebenen Regel (REQ-037, AC-REQ-037-01, Folge in REQ-047; bisher im Kopier-Assistenten als „leer“ gekennzeichnet, jetzt nicht mehr angezeigt; Quelle: Design-Annahme an MAR-126, vom Product Owner bestätigt; Bestätigung durch den Owner mit der Freigabe) und Klarstellung beim Übernahmefortschritt (REQ-049); neue AC-REQ-047-07, AC-REQ-049-03 (Kennzeichnung berichtigt in v0.3.3, FIND-031). Keine Umnummerierung, keine Wiederverwendung von IDs; Details Kap. 15.11 | – (keine Findings; Owner-Entscheidung E-7 und Hinweis des Product Owner an MAR-126) |
| v0.3.3 | Folgerevision zu v0.3.2 (Delta-Review zu v0.3.1 und v0.3.2, Runde 1, `pass` mit fünf minor Findings); Delta-Review pending | 06.11.2026 | Basis Revision `e4b94794…` (v0.3.2), Auftrag MAR-137 (Parent MAR-135). Ausschließlich Korrektur der minor Findings FIND-030 bis FIND-034 aus `requirements-review-v032-r1` (Revision `b119fea9…`): Owner-Wortlaut und Ableitung bei E-7 getrennt, REQ-105 und REQ-106 als „abgeleitet aus E-7“ zur Owner-Bestätigung (FIND-030); Änderung der freigegebenen Regel zu leeren Merkmalsfeldern gekennzeichnet (FIND-031); neue OP-32 und A-37 zur Update-Kopie gegenüber Kap. 14 (FIND-032); REQ-065: Zeiten nach einem Beenden für eine Sicherung zählen weder als Ausfall noch als Geschäftszeit [Vorschlag BA] (FIND-033); REQ-106: Messmethode und AC-REQ-106-01 für beide Betriebsmodelle (FIND-034). Keine neue REQ- oder AC-ID, keine Umnummerierung, keine Wiederverwendung von IDs, keine Änderung an Priorität oder Status einer REQ; Details Kap. 15.12 | FIND-030 bis FIND-034 |
| v0.3.4 | Nachtrag nach Change Management (Change Request MAR-573, Gate MAR-574); Requirements Review Runde 1 `changes_requested` (FIND-035 bis FIND-037), korrigiert in Korrekturrunde 2; Requirements Review Runde 2 `changes_requested` (FIND-038), korrigiert in Korrekturrunde 3; Requirements Review Runde 3 pending | 12.11.2026 | Basis Revision `ce76d962…` (v0.3.3, vom Owner am 07.11.2026 freigegeben), Auftrag MAR-579 (Parent MAR-577). REQ-005: Wieder-Aktivieren eines Merkmals (Anforderung, Regel, Status als Angabe, Trace); neue AC-REQ-005-11; Kap. 9.1 (Status des Merkmals); neue A-38; Freigabe-Briefing (Delta); Metadaten, Kap. 15, Anhang B. Korrekturrunde 2 (Auftrag MAR-583, Parent MAR-582) zu `requirements-review-v034-r1` (Revision `b47a2769…`): REQ-005 um die Regel zu fehlenden Werten wieder aktivierter Pflichtmerkmale ergänzt (FIND-035), neue AC-REQ-005-12 und A-39 (FIND-035); Freigabe-Briefing, Annahme 2 und „Bewusst nicht enthalten“ korrigiert (FIND-035), Annahme 1 auf den Dokumentinhalt zurückgeführt (FIND-036), Briefing direkt nach den Metadaten (FIND-037). Korrekturrunde 3 (Auftrag MAR-592, Parent MAR-591) zu `requirements-review-v034-r2` (Revision `7bb1a59f…`): Auslöser der Nachforderung in REQ-005, A-39 und Freigabe-Briefing abschließend auf das Speichern nach REQ-010, REQ-014 und REQ-088 festgelegt, übrige Vorgänge ausdrücklich ausgenommen; AC-REQ-005-12 um Fall (c) ergänzt (FIND-038). Keine neue REQ-ID, keine Umnummerierung, keine Wiederverwendung von IDs, keine Änderung an Priorität oder Status einer REQ; Details Kap. 15.13 | FIND-035 bis FIND-037 (Korrekturrunde 2); FIND-038 (Korrekturrunde 3); Anlass: Change Request MAR-573 |

Kap. 15.1 bis 15.3 beschreiben v0.2 (unverändert). Kap. 15.4 bis 15.9 beschreiben v0.3. Kap. 15.10 beschreibt v0.3.1. Kap. 15.11 beschreibt v0.3.2. Kap. 15.12 beschreibt v0.3.3. Kap. 15.13 beschreibt v0.3.4.

### 15.1 Änderungen v0.2 je Finding

| Finding | Ergebnis | Änderung (REQ-IDs, Kapitel) |
| --- | --- | --- |
| FIND-001 (S1, major) | adressiert | Ein einziges Trennkriterium für Modell-Inserate: **Variantenangaben** (Zustand, Optik-Note, Zustandsbeschreibung, Werte der Variantenmerkmale) mit einer Vergleichsregel (Kap. 6.0); Zustandsbeschreibung wird zeichengleich verglichen und bei Abweichung vollständig angezeigt. Neues Merkmalskennzeichen „variantenbildend“ (REQ-005, Kap. 9.1, Startbelegung Kap. 9.3). Glossar: neue Begriffe Variantenmerkmal, Variantenangaben; „Zustandsvariante“ nur noch als Brief-Begriff mit Abbildung. Geändert: REQ-018, REQ-019 (einheitliche Regel), REQ-017 (nur geprüfte Geräte), REQ-014 (Abweichung bei Änderung zugeordneter Geräte), A-15, OP-21, Kap. 9.1. Neue ACs: AC-REQ-018-03 bis -06, AC-REQ-019-05 bis -07, AC-REQ-005-06 bis -08, AC-REQ-014-07/-08. |
| FIND-002 (C5, major) | adressiert | Neuer Kap. 6.0 „Fachlicher Grundablauf Modellvorlage → Gerät → Modell-Inserat → Kanal-Inhalt“ mit Datenherkunft je Angabe (gespeichert an, beim Anlegen, ändern über) und neuen Begriffen Modelldaten, Vorbelegungswert, Gerätewerte, Inseratswerte, Lieferumfang. (a) REQ-019: Inseratswerte werden unverändert vom anlegenden Gerät übernommen. (b) Neue **REQ-088 Modell-Inserat ändern** mit ACs. (c) REQ-010 neu gefasst: Modelldaten nur an der Modellvorlage, Vorbelegungswerte nur für künftige Geräte. (d) EAN: Kennzeichnung „Original“ verweist stets auf die Original-EAN der Modellvorlage, „eigene“ auf die EAN am Modell-Inserat; Datenblatt nutzt die EAN des Modell-Inserats (REQ-040, REQ-050, A-11, Kap. 9.6; AC-REQ-010-04, AC-REQ-040-04, AC-REQ-050-07). (e) AC-REQ-010-01 auf Prozessor (Ebene *Modell*) umgestellt; Testdaten MV-A/MI-A in Kap. 8 an Kap. 9.3 angeglichen. Ebenso J-01, J-02, J-04, neue J-06, REQ-013, Kap. 9.1. |
| FIND-003 (S1, major) | adressiert | Abschließende Regel in Kap. 6.0 (Tabelle „Wirkung von Änderungen“) mit Trennung **Inhaltsangaben** / **Bestandsangaben**. Neue **REQ-091**: Stückzahl, `{WI-Nr}`, `{Akkukapazität}` stets aktuell, ohne Kennzeichnung und ohne Statuswechsel; Bestandsplatzhalter im Titelmuster unzulässig (REQ-030, Kap. 9.7); bei *Veröffentlicht* Kennzeichnung „Bestand auf Kanal anpassen“ (REQ-052). REQ-045 präzisiert („geht ein“ = neu gebildeter Stand weicht vom freigegebenen ab). REQ-053 und REQ-043 abgestimmt: manuell angepasste Texte werden nicht überschrieben, sondern erhalten einen Prüfhinweis; Meldung in drei Gruppen. ACs: AC-REQ-045-03/-05/-06, AC-REQ-043-05, AC-REQ-053-01 (neu gefasst, nachgerechnet 8 + 2 + 5 = 15), AC-REQ-091-01/-02. Owner-Frage OP-29 / A-31. |
| FIND-004 (S1, major) | adressiert | Zustandsmodell vervollständigt (Kap. 9.4 mit Übergängen und abschließender Kennzeichnungsliste): Änderungen an veröffentlichten oder beendeten Kanal-Inhalten erzeugen einen **Änderungsentwurf**; Kopier-Assistent und Übersicht zeigen bis zur Freigabe den freigegebenen Stand (REQ-045, REQ-047, REQ-052). Neue **REQ-089 Änderungsentwurf freigeben** und **REQ-090 Abgleich mit dem Kanal bestätigen**. REQ-046: Übergänge abschließend; *Beendet* → *Veröffentlicht* erst nach Freigabe offener Änderungen. Neue Journey J-06. ACs: AC-REQ-045-02/-04, AC-REQ-046-04 bis -06, AC-REQ-047-05, AC-REQ-089-01 bis -03, AC-REQ-090-01 bis -03. |
| FIND-005 (U7, major) | adressiert | (a) Neue REQ-096 (Initialpasswort), REQ-097 (eigenes Passwort ändern, Pflicht nach Initialpasswort), REQ-098 (Zurücksetzen durch Administrator); Owner-Frage **OP-25**, Annahme A-28 mit Folge. (b) REQ-028: PNG/JPEG, ≤ 5 MB [Vorschlag BA], AC-REQ-028-02 konkretisiert; OP-13. (c) Neue REQ-099 Lieferanten pflegen (Administrator, Auswahlliste), REQ-012/REQ-022 angepasst, Kap. 9.5; Owner-Frage **OP-26**, A-25 erweitert. (d) Platzhalter in der Zusatzangabe zugelassen mit Zulässigkeitstabelle (REQ-023, Kap. 9.7), AC-REQ-023-04. (e) Neue REQ-100 Hersteller anlegen (Regeln: Pflicht, Länge, Eindeutigkeit ohne Groß-/Kleinschreibung, Randleerzeichen) und REQ-101 Hersteller umbenennen/deaktivieren (Administrator); Abgrenzung zu REQ-027 (rechtlicher Herstellername); Owner-Frage **OP-27**, A-29. Keine Owner-Entscheidung stillschweigend getroffen. |
| FIND-006 (S1, minor) | adressiert | Kennzeichen „Akku vorhanden“ je Wert der Auswahlliste Akku (REQ-007, Kap. 9.2); Pflichtregel in REQ-014 und Kap. 9.6 gleich formuliert („mit Akku“ und „mit Akku (defekt)“). AC-REQ-007-04, AC-REQ-014-06. |
| FIND-007 (S1, minor) | adressiert | Löschen nur durch Administrator: neue funktionale REQ-095; REQ-020 bietet kein Löschen mehr an (AC-REQ-020-03); REQ-082 und Kap. 10.3 angeglichen. |
| FIND-008 (C6, minor) | adressiert | Neue REQ-092 (WI-Nr korrigieren), REQ-093 (Gerät stornieren, WI-Nr wird frei), REQ-094 (nicht zugeordnete Geräte anzeigen), REQ-095 (Löschen). Zustand „nicht zugeordnet“ festgelegt (Kap. 6.0, Glossar; REQ-021, REQ-050 lehnen ab). Ändern der Modellvorlage eines Geräts bewusst ausgeschlossen (Kap. 14; Korrekturweg Storno + Neuerfassung). Neuer Begriff Bestandsstatus (*verfügbar*, *verkauft*, *storniert*) ersetzt „Verkaufsstatus“. |
| FIND-009 (S2, minor) | adressiert | Neuer Begriff **Erfassungsstatus** (*geprüft* / *unvollständig geprüft*) für Geräte (Glossar, REQ-013, REQ-016, AC-REQ-016-01). „Prüfstatus“ nur für Textbausteine, Geltungsbereich einheitlich *Rechtliches* und *Akku-Hinweis* (Glossar, REQ-026, REQ-054). |
| FIND-010 (S1, minor) | adressiert | Abschließende Quellenliste für Merkmalsfelder (neuer Kap. 9.11, Q-01 bis Q-08, inkl. Stückzahl, Geräteart, Zustandsbeschreibung, WI-Nr, Artikelnummer, Produktidentifikation, fester Text); REQ-025 verweist darauf; Kap. 9.8 als Zuordnungstabelle „Feldbezeichnung ← Quelle“; Feldliste in REQ-047 abschließend und an Kap. 9.8 angeglichen (Stückzahl als Merkmalsfeld). AC-REQ-025-03/-04, AC-REQ-047-06. |
| FIND-011 (C6, minor) | adressiert | Titelmuster-Modell mit Präfix/Suffix je Bestandteil; leerer Platzhalter entfällt mit Präfix und Suffix (REQ-030, REQ-034, REQ-035, Kap. 9.3, Testdaten Kap. 8). AC-REQ-030-05 (ohne Typbezeichnung, 69 Zeichen). |
| FIND-012 (T1, minor) | adressiert | REQ-006 zählt die Startbelegung abschließend auf und nennt die Prüfquellen (Kap. 9.2, 9.3, 9.8, neuer Kap. 9.12 für Kanäle, Beschreibungsvorlagen, Datenblatt-Layout); kundenspezifische Inhalte (u. a. Kategorie- und Zustandszuordnungen) sind ausdrücklich Abnahmeeingabe aus V-03. AC-REQ-006-01 neu gefasst, AC-REQ-006-03 neu. AC-REQ-035-04 mit festgelegter Testmenge TM-1 × 4 Höchstlängen (16 Titel). |
| FIND-013 (R1, minor) | adressiert | Alle BA-Werte als [Vorschlag BA] gekennzeichnet (u. a. REQ-004, REQ-008, REQ-014, REQ-022, REQ-024, REQ-026, REQ-046, Kap. 9.6 Herstellernummer) und vollständig in OP-17 gelistet; REQ-076 trennt [Brief, SC-07] von [Vorschlag BA]. |
| FIND-014 (R5, minor) | adressiert | Trace ergänzt: REQ-002 (Brief Kap. 9, UC-04, F-5), REQ-073 (F-5, als abgeleitete Betriebsanforderung begründet), REQ-069/REQ-070 (F-5, Brief Kap. 6b, Brief Kap. 7; als aus der DSGVO abgeleitet gekennzeichnet); Anhang A.4. |
| FIND-015 (C4, minor) | adressiert | Neue nicht-funktionale **REQ-102** (Anonymisierung nach 24 Monaten [Vorschlag BA]); REQ-002, REQ-072, REQ-082 angepasst; Owner-Frage **OP-28**, A-30. |
| FIND-016 (L4, minor) | adressiert | Kap. 10.6: „nebeneinander“ durch fachlichen Vergleichsbedarf ersetzt, „Vorschau“ entfernt (keine fachliche Anforderung); REQ-048 als Ergebnis „alle Fotos mit einer Nutzeraktion in Reihenfolge“ formuliert, Form offen für UI/UX-Design und Architektur. Anhang B entsprechend. |
| FIND-017 (L3, minor) | adressiert | REQ-073: prüfbare Merkmale der Nutzermeldung (Deutsch, Funktion, nächster Schritt, Referenznummer, keine Fehlercodes/Stacktraces/internen Namen) und Messmethode. |
| FIND-018 (L1, minor) | adressiert | Aufgeteilt ohne Umnummerierung: REQ-021 / neu REQ-084 (Rücknahme); REQ-033 / neu REQ-085 (Preisregel pflegen); REQ-038 / neu REQ-086 (Kategorie überschreiben); REQ-054 / neu REQ-087 (Freigabe mit ungeprüftem Rechtstext). ACs zugeordnet; AC-REQ-021-03, AC-REQ-038-02 und AC-REQ-054-01 als *Withdrawn* geführt und durch AC-REQ-084-01, AC-REQ-086-01, AC-REQ-087-01 ersetzt. |
| FIND-019 (C7, minor) | adressiert | Metadaten: maßgeblich ist jeweils die jüngste Revision des Dokuments `requirements` an MAR-114; MAR-115 als nicht maßgebliche, nicht fortgeschriebene Kopie geführt; Review-Referenz Runde 1 mit Revisionen. |

### 15.2 Weitere Änderungen in v0.2 (Folgeänderungen, keine eigenen Findings)

- **Startannahmen für Architecture Baseline und UI/UX-Design** (Hinweise H-2/H-3 des Reviewers, Auftrag MAR-118): neuer Kap. 13.1; Spalte „spätestens“ in Kap. 13 zu „Klärung bis“ umformuliert („Annahme gilt ab Start der Parallelphase“); neue Startannahmen A-33 (OP-15), A-34 (OP-24), A-35 (OP-23); RI-10; Kap. 10.1/10.2 verweisen darauf.
- Folge aus FIND-001: Geräte mit Prüfmarkierung können keinem Modell-Inserat zugeordnet werden (REQ-013, REQ-017, REQ-019); die entsprechende Freigabebedingung in REQ-044 entfällt, AC-REQ-013-03 neu gefasst.
- Folge aus FIND-003/-004: manuelle Anpassungen (Titel, Beschreibung, Kategorie) sind in jedem Status möglich und wirken wie Änderungen von Inhaltsangaben (REQ-043, REQ-086).
- REQ-031: Zeilen mit nur leeren Platzhaltern entfallen (macht AC-REQ-031-03 aus v0.1 durch eine Regel gedeckt); Inhaltselement „alle gültigen Textbausteine einer Art“; neuer Platzhalter `{Merkmalsliste}` (Kap. 9.7).
- REQ-072 um neue protokollpflichtige Vorgänge ergänzt; Kap. 9.1, Kap. 10.3, Kap. 10.6, Kap. 5.1/5.2, Kap. 4.1 und Anhang A an die neuen REQs angeglichen; D-01 vermerkt die abgelaufene Fragen-Karte.

### 15.3 Für Architektur und UI/UX-Design relevante Änderungen gegenüber v0.1

Geänderte REQs: REQ-002, REQ-005 bis REQ-007, REQ-010, REQ-012 bis REQ-014, REQ-016 bis REQ-023, REQ-025, REQ-026, REQ-028 bis REQ-031, REQ-033 bis REQ-040, REQ-043 bis REQ-050, REQ-052 bis REQ-054, REQ-067, REQ-069, REQ-070, REQ-072, REQ-073, REQ-076, REQ-082. Neue REQs: REQ-084 bis REQ-102. Geänderte UI-relevante Randbedingungen: Kap. 10.1, 10.2 (Startannahmen), 10.3 (Rechte), 10.6 (Umfang, Komplexitätstreiber).

### 15.4 Zurückgezogene Anforderungen und Akzeptanzkriterien (Withdrawn in v0.3)

IDs werden nicht umnummeriert und nicht wiederverwendet. Der Wortlaut bis v0.2 bleibt in Revision `3275f25f` an MAR-114 nachvollziehbar.

| ID | Type | Begründung | Herkunft |
| --- | --- | --- | --- |
| REQ-002 Benutzerkonten verwalten | Functional | genau ein Nutzer, keine Benutzerkonten | [Entschieden] E-4, E-5 |
| REQ-003 Einstellungen nur für Administratoren | Functional | keine Rollen; der Nutzer darf alles | [Entschieden] E-4, E-5 |
| REQ-096 Initialpasswort vergeben | Functional | keine Konten, kein Zurücksetzen durch das System; das Zugangspasswort legt der Betreiber außerhalb des Systems fest | [Entschieden] E-5 |
| REQ-098 Passwort zurücksetzen | Functional | Zurücksetzen nur durch den Betreiber außerhalb des Systems (wie bisher A-28) | [Entschieden] E-5 |
| REQ-070 Personendaten nur in EU/EWR | Non-functional | keine personenbezogenen Daten von Käufern und vom Nutzer mehr (REQ-069); Ort der Daten bleibt Thema von OP-23 | [Vorschlag BA] |
| REQ-071 Barrierefreiheit WCAG 2.2 AA | Non-functional | Barrierefreiheit ganz gestrichen | [Entschieden] E-3 |
| REQ-082 Datenerhalt | Non-functional | Prüfung nach Rollen entfällt; Löschen nur über REQ-095 durch den Nutzer. Die Regel „keine automatische Löschung von Geräten, Modell-Inseraten und Modellvorlagen“ steht seit v0.3.1 in der neuen REQ-103 (in v0.3 in REQ-095; FIND-029), die Löschfrist der Protokolleinträge in REQ-072. Die ID REQ-082 wird nicht wiederverwendet | [Entschieden] E-4 |
| REQ-083 Gleichzeitige Bearbeitung durch zwei Nutzer | Non-functional | kommt bei einem Nutzer nicht vor; Restrisiko zwei Fenster als RI-11 | [Vorschlag BA] |
| REQ-102 Anonymisierung nach 24 Monaten | Non-functional | nichts zu anonymisieren; Protokolleinträge werden nach REQ-072 gelöscht (löst FIND-021) | [Entschieden] Folge aus E-4, E-5 (OP-28) |
| AC-REQ-001-03 | AC | deaktivierte Konten gibt es nicht | E-4, E-5 |
| AC-REQ-002-01 bis -03, AC-REQ-003-01 bis -03, AC-REQ-096-01, -02, AC-REQ-098-01, -02 | AC | zugehörige REQ zurückgezogen | E-4, E-5 |
| AC-REQ-097-01 | AC | Kennzeichen „Passwortänderung erforderlich“ entfällt mit REQ-096/REQ-098 | E-5 |
| AC-REQ-055-02, AC-REQ-095-04, AC-REQ-099-04 | AC | prüften „Keine Berechtigung“ einer Rolle; keine Rollen mehr | E-4 |

### 15.5 Globale Änderung: Rollen „Bearbeiter“ und „Administrator“ → „Nutzer“

In allen Anforderungen, Akzeptanzkriterien, Nutzerreisen, Tabellen und Anhängen sind die Rollen „Bearbeiter“ und „Administrator“ durch die eine Rolle **Nutzer** ersetzt ([Entschieden] E-4; reine Umbenennung, wo unten nichts anderes steht). Wo eine Anforderung oder ein AC bis v0.2 „Bearbeiter“ oder „Administrator“ nannte, gilt dieselbe Aussage jetzt für den Nutzer. Tests nach Rolle („Keine Berechtigung“) entfallen (Kap. 15.4). Angaben zum handelnden Nutzer (erfassender Nutzer, freigebender Nutzer, Nutzer des Abgleichs, Nutzer im Protokoll) entfallen ([Entschieden] E-4); Zeitpunkte bleiben. Die Freigabe durch einen Menschen bleibt unverändert (Brief Kap. 9).

### 15.6 Änderungen je REQ-ID gegenüber v0.2

**Funktionale Anforderungen**

| REQ | Änderung | Warum |
| --- | --- | --- |
| REQ-001 | Neu gefasst: Im Netzbetrieb jeder Zugriff nur mit Zugangspasswort; im Betrieb nur am Arbeitsplatzrechner keine Anmeldung; keine Kennung, kein Konto, keine Rolle, kein Zurücksetzen durch das System. Das erste Zugangspasswort legt der Betreiber außerhalb des Systems fest. AC-REQ-001-01, -02, -04 neu gefasst; AC-REQ-001-05, -06 neu; AC-REQ-001-03 Withdrawn | [Entschieden] E-5; erstes Passwort durch den Betreiber [Vorschlag BA] |
| REQ-002, REQ-003, REQ-096, REQ-098 | Withdrawn (Kap. 15.4) | [Entschieden] E-4, E-5 |
| REQ-097 | Neu gefasst als „Zugangspasswort ändern“, nur im Netzbetrieb; Kennzeichen „Passwortänderung erforderlich“ entfällt; Priorität Must unverändert. AC-REQ-097-01 Withdrawn; -02 bis -04 neu gefasst (Mindestlänge in -04) | Netzbetrieb [Entschieden] E-5; Beibehaltung der Funktion [Vorschlag BA] |
| REQ-005 | Neue Regel: Eine Änderung des Kennzeichens „variantenbildend“ wird abgelehnt, solange sie Modell-Inserate derselben Modellvorlage ununterscheidbar macht; das System nennt die betroffenen. Neue AC-REQ-005-09, -10 | FIND-023; Lösungsweg [Vorschlag BA] |
| REQ-006, REQ-007, REQ-008 bis REQ-011, REQ-013, REQ-015, REQ-016, REQ-019, REQ-021 bis REQ-035, REQ-037 bis REQ-042, REQ-047 bis REQ-049, REQ-051, REQ-054, REQ-056 bis REQ-059, REQ-084 bis REQ-086, REQ-088, REQ-091, REQ-092, REQ-101 | nur Umbenennung der Rolle (Kap. 15.5) | E-4 |
| REQ-012 | „erfassender Nutzer“ entfällt; AC-REQ-012-01 angepasst | E-4 |
| REQ-014 | Die Wahl „umbuchen“ steht nicht mehr in der Must-Regel; sie ergänzt REQ-020. AC-REQ-014-07 so gefasst, dass es ohne REQ-020 besteht | FIND-022 |
| REQ-017 | AC-REQ-017-04 ohne Verweis auf das Umbuchen (REQ-020, Should); dieselbe Art Abhängigkeit wie in FIND-022, bei der Selbstprüfung gefunden | FIND-022 (gleicher Mangel) |
| REQ-018 | Protokoll von „trotzdem zuordnen“ ohne Nutzer; AC-REQ-018-02 angepasst | E-4 |
| REQ-020 | Ergänzt die Abweichungsanzeige nach REQ-014 um „umbuchen“; Löschen nur über REQ-095 statt „nur Administrator“. AC-REQ-020-03 neu gefasst; AC-REQ-020-04 neu (von AC-REQ-014-07 verschobener Teil) | FIND-022; E-4 |
| REQ-036 | Verweis auf die Sonderfälle von `{Akkukapazität}` (A-16, Kap. 9.7). Neue AC-REQ-036-04, -05 | FIND-024; Regeln [Vorschlag BA] |
| REQ-043 | Übernimmt alles, was von manuellen Anpassungen abhängt: Zusatzregel „Änderung geht ein“ und Meldegruppe „manuell angepasst, zur Prüfung“ bei REQ-053. Neue AC-REQ-043-06 (bis v0.2 AC-REQ-045-06) und AC-REQ-043-07 (bis v0.2 Teil von AC-REQ-053-01). Priorität Should unverändert | FIND-022 |
| REQ-044 | Freigabe speichert Zeitpunkt, keinen Nutzer; AC-REQ-044-01 angepasst, AC-REQ-044-04 neu gefasst (ohne „kein Bearbeiter“) | E-4 |
| REQ-045 | Regel „geht ein“ ohne Voraussetzung REQ-043 (Zusatz steht in REQ-043). AC-REQ-045-06 neu gefasst ohne manuelle Anpassung | FIND-022 |
| REQ-046 | Übergang *Veröffentlicht* → *Beendet*: „Bestand auf Kanal anpassen“ und „Änderung auf Kanal übertragen“ entfallen, „geändert seit Freigabe“ und Änderungsentwurf bleiben; Übertragung beim Setzen auf *Veröffentlicht* ausdrücklich für *Freigegeben* → *Veröffentlicht* und *Beendet* → *Veröffentlicht*. Neue AC-REQ-046-07, -08 | FIND-020; Wegfall der Kennzeichnungen [Vorschlag BA] |
| REQ-050 | `{Akkukapazität}` und Akkukapazität auf dem Datenblatt = Wert dieses Geräts. Neue AC-REQ-050-08 | FIND-024; [Vorschlag BA] |
| REQ-052 | Kanal-Inhalte im Status *Beendet* tragen „Bestand auf Kanal anpassen“ nicht; Entfernen auch durch den Übergang nach *Beendet* | FIND-020 |
| REQ-053 | Meldung in den Gruppen „aktualisiert“ und „zur erneuten Freigabe“; manuelle Anpassungen regelt REQ-043. AC-REQ-053-01 neu gefasst (8 + 5 = 13) | FIND-022 |
| REQ-055 | Filter nach Zeitraum und Art des Objekts, kein Nutzer. AC-REQ-055-01 neu gefasst; AC-REQ-055-02 Withdrawn | E-4 |
| REQ-087 | Protokoll der Bestätigung ohne Nutzer | E-4 |
| REQ-089 | Freigabe speichert Zeitpunkt, keinen Nutzer; AC-REQ-089-01 angepasst | E-4 |
| REQ-090 | Abgleich speichert Zeitpunkt, keinen Nutzer; Must-Begründung verweist auf die offene Entscheidung OP-30; AC-REQ-090-01 angepasst | E-4; OP-30 (Reviewer-Hinweis 1, Runde 2) |
| REQ-093 | Storno ohne Nutzer; Verweis auf REQ-095 statt REQ-082 | E-4 |
| REQ-094 | „erfassender Nutzer“ entfällt; AC-REQ-094-01 angepasst | E-4 |
| REQ-095 | Rolle Nutzer; übernimmt aus REQ-082 die Regel „keine automatische Löschung“; AC-REQ-095-04 Withdrawn | E-4 |
| REQ-099 | Rolle Nutzer; Regel „Bearbeiter wählen nur aus“ ersetzt durch Auswahl aus der Liste (OP-26 nur noch Liste oder Freitext); AC-REQ-099-04 Withdrawn | E-4 |
| REQ-100 | Bezug auf A-29/OP-27 entfällt; GPSR-Angaben pflegt der Nutzer | E-4 |

**Nicht-funktionale Anforderungen**

| REQ | Änderung | Warum |
| --- | --- | --- |
| REQ-060 | „3 gleichzeitige Nutzer“ → 1 Nutzer | [Entschieden] E-4 |
| REQ-067 | Nur im Netzbetrieb: Zugangspasswort, verschlüsselte Übertragung, nicht im Klartext gespeichert, Mindestlänge 12 Zeichen. Abmeldung nach 60 min Inaktivität entfällt | Netzbetrieb [Entschieden] E-5; Mindestlänge [Vorschlag BA] (Richtigstellung Abschnitt 5 der Analyse) |
| REQ-069 | resellr speichert keine personenbezogenen Daten von Käufern und vom Nutzer; ausgenommen geschäftliche Kontaktangaben nach REQ-027/REQ-028 | [Entschieden] E-4, E-5; Abgrenzung [Vorschlag BA] |
| REQ-070, REQ-071, REQ-082, REQ-083, REQ-102 | Withdrawn (Kap. 15.4) | E-3, E-4, E-5 bzw. [Vorschlag BA] |
| REQ-072 | Protokoll ohne Nutzer, ohne Konten, ohne Passwörter; Einträge werden nach 24 Monaten **gelöscht** (spätestens 7 Tage danach), keine Anonymisierung; Messmethode mit rückdatierten Einträgen | ohne Nutzer [Entschieden] E-4; Löschfrist [Vorschlag BA]; löst FIND-021 |
| REQ-073 | Nutzermeldung verweist auf den Betreiber statt auf einen Administrator | E-4 |
| REQ-074 | Messmethode: Änderung der Einstellungen durch den Nutzer | E-4 |
| REQ-076 | Durchführung durch den Nutzer statt „Administrator des Pilotkunden“ | E-4 |
| REQ-077 | Ein Arbeitsplatzrechner; keine Unterstützung für Smartphone und Tablet | [Entschieden] E-2, E-6 |
| REQ-080 | „neuer Bearbeiter“ → der Nutzer; gemessen beim ersten Einsatz nach der Einweisung | [Vorschlag BA] |

*Vermerk in v0.3.1 (Hinweis H-2 aus Review v0.3 Runde 1, keine inhaltliche Änderung):* In v0.2 waren bei REQ-067 „Übertragung verschlüsselt“ und „Zugangspasswort nicht im Klartext gespeichert“ als [Vorschlag BA] gekennzeichnet. Seit v0.3 sind beide als „abgeleitet aus E-5“ gekennzeichnet und stehen nicht mehr in OP-17. Diese Umkennzeichnung fehlte oben. Beide Punkte sind nicht Wortlaut von E-5, sondern eine Ableitung des BA: Ein unverschlüsselt übertragenes oder im Klartext gespeichertes Passwort schützt nicht.

### 15.7 Findings aus Review Runde 2 und Reviewer-Hinweise

| Finding | Ergebnis | Änderung |
| --- | --- | --- |
| FIND-020 (C5, minor) | adressiert | REQ-046, Kap. 6.0, Kap. 9.4 (Statustabelle, neuer Absatz, Kennzeichnungstabelle „entfernt durch“), J-03 Schritt 3, REQ-052: beim Übergang *Veröffentlicht* → *Beendet* entfallen „Bestand auf Kanal anpassen“ und „Änderung auf Kanal übertragen“ [Vorschlag BA]; „erneutes Setzen auf *Veröffentlicht*“ ist ersetzt durch die ausdrücklichen Übergänge *Freigegeben* → *Veröffentlicht* und *Beendet* → *Veröffentlicht*. Neue AC-REQ-046-07 (Übersichtsfilter) und AC-REQ-046-08. |
| FIND-021 (S1, minor) | adressiert | Löschen statt Anonymisieren: REQ-072 (24 Monate, danach gelöscht [Vorschlag BA]), REQ-082 und REQ-102 zurückgezogen, Kap. 9.1 (Protokolleintrag ohne Nutzer, Löschung nach REQ-072). Ein 25 Monate alter Eintrag fehlt; der Test ist eindeutig. |
| FIND-022 (M2, minor) | adressiert, Scope unverändert | Prioritäten von REQ-020 und REQ-043 bleiben Should. Must-ACs ohne Should-Funktion gefasst: AC-REQ-014-07, AC-REQ-045-06, AC-REQ-053-01, Tabelle „Wirkung von Änderungen“ in Kap. 6.0 (Zusatz bei manueller Anpassung als eigener Absatz), außerdem AC-REQ-017-04 (gleicher Mangel). Abhängige Teile verschoben: AC-REQ-020-04 (umbuchen), AC-REQ-043-06 (manueller Titel bei veröffentlichtem Kanal-Inhalt), AC-REQ-043-07 (Meldegruppe aus REQ-053). Es gab keine Stelle, an der das nicht sauber ging. |
| FIND-023 (S1, minor) | adressiert | REQ-005: Änderung des Kennzeichens „variantenbildend“ wird abgelehnt, solange Modell-Inserate derselben Modellvorlage ununterscheidbar würden; das System nennt sie [Vorschlag BA]. „Administrator“ heißt jetzt „Nutzer“. Neue AC-REQ-005-09, -10. |
| FIND-024 (C6, minor) | adressiert | A-16 und Kap. 9.7: Regeln für „nicht ermittelbar“, Geräte ohne Akku oder ohne Akkukapazität, gleiche Werte, leere Menge [Vorschlag BA]. REQ-050: Datenblatt zeigt den Wert des Geräts [Vorschlag BA]. Neue AC-REQ-036-04, -05 und AC-REQ-050-08. |
| Hinweis RB-11 (Runde 2, Bewertung Punkt 5) | umgesetzt | RB-11 verweist auf die Ausnahme nach OP-29 (Bestandsangaben ohne neue Freigabe); Anhang A.4 ebenso. |
| Hinweis H-2 (Runde 2) | umgesetzt | Kap. 5.3 grenzt die manuell geführte Kennzeichnung „Bestand auf Kanal anpassen“ von der Abgleichsfunktion in Release 0.3 ab. |
| Hinweis 1 / H-3 (Runde 2) | umgesetzt | Die Frage, ob REQ-090 bleibt, steht als OP-30 in Kap. 13 und in der Freigabe-Übersicht am Dokumentanfang. |

### 15.8 Für Architektur und UI/UX-Design relevante Änderungen gegenüber v0.2

- **Geänderte REQs:** REQ-001, REQ-005, REQ-012, REQ-014, REQ-017 (nur AC), REQ-018, REQ-020, REQ-036, REQ-043 bis REQ-046, REQ-050, REQ-052, REQ-053, REQ-055, REQ-060, REQ-067, REQ-069, REQ-072, REQ-073, REQ-074, REQ-076, REQ-077, REQ-080, REQ-087, REQ-089, REQ-090, REQ-093 bis REQ-095, REQ-097, REQ-099, REQ-100; alle übrigen REQs nur Umbenennung der Rolle.
- **Zurückgezogene REQs:** REQ-002, REQ-003, REQ-070, REQ-071, REQ-082, REQ-083, REQ-096, REQ-098, REQ-102. Neue REQ-IDs: keine.
- **Geänderte UI-relevante Randbedingungen:** Kap. 10.1 (eigene Oberfläche entschieden; nur Web oder Desktop offen), 10.2 (ein Arbeitsplatzrechner, keine Smartphones und Tablets, Netzbetrieb ja/nein aus der Architektur), 10.3 (eine Rolle, keine Konten, keine Rechtetabelle), 10.4 (keine PrestaShop-Gestaltungsregeln; keine Barrierefreiheit), 10.5 (eine Person, ein PC), 10.6 (Aufgabenlisten zusammengelegt; Benutzerverwaltung und rollenabhängige Sichten entfallen; Zugangspasswort nur im Netzbetrieb).
- **Startannahmen (Kap. 13.1):** OP-06 und OP-07 erledigt; A-33 (OP-15) auf Web oder Desktop eingeengt; A-35 (OP-23) erlaubt Betrieb nur auf dem PC des Nutzers.

### 15.9 Folgeänderungen in weiteren Kapiteln (v0.3)

- Metadaten, Lesehilfe und Übersicht der für die Freigabe offenen Punkte am Dokumentanfang; Kap. 1 (eine Person arbeitet mit resellr).
- Glossar: Owner, Nutzer neu gefasst; Bearbeiter/Administrator als entfallen geführt; neu Arbeitsplatzrechner, Netzbetrieb, Zugangspasswort, Betreiber.
- Kap. 3 Stakeholder; Kap. 5.1/5.2 (Withdrawn-Liste); Kap. 6 Einleitung; Kap. 6.1 (Zugangspasswort im Netzbetrieb, J-03 bis J-06); Kap. 7 Einleitung und C4-Abdeckung (Barrierefreiheit nicht anwendbar, E-3).
- Kap. 9.1 (Entität Benutzerkonto entfällt; Felder „erfassender Nutzer“, „Nutzer“ bei Freigabe, Abgleich und Protokoll entfallen), 9.5 (Spalte „Wer“ und Zeile Benutzerkonten entfallen), 9.6 (Zugangspasswort), 9.10.
- Kap. 11.1 (RB-11 mit Verweis auf OP-29; neue RB-15 bis RB-20 = E-1 bis E-6), 11.2, 11.4 (V-05), 11.5 (RI-10 angepasst, neue RI-11 und RI-12).
- Kap. 12: A-01, A-24, A-28, A-29, A-30 erledigt; A-02, A-12, A-16, A-25, A-33, A-35 angepasst (A-35: Betrieb nur auf dem PC ist zulässig; der Satz zum Widerspruch mit A-01 und REQ-083 entfällt).
- Kap. 13: OP-06, OP-07, OP-16, OP-25, OP-27, OP-28 erledigt; OP-15, OP-23, OP-26 eingeengt; OP-17 gekürzt und um die v0.3-Vorschläge ergänzt; neue OP-30. Kap. 13.1: OP-03, OP-06, OP-07, OP-15, OP-23 angepasst.
- Kap. 14 um Konten, Rollen, Mobilgeräte, Barrierefreiheit, PrestaShop-Modul und Personendaten ergänzt.
- Anhang A (A.1, A.2, A.4 angepasst; neue A.6 Owner-Entscheidungen); Anhang B an die neue Lage angepasst (Klassifikation weiter pending).

### 15.10 Änderungen in v0.3.1 (FIND-025 bis FIND-029)

Basis ist v0.3, Revision `170ca77f-9e3e-4ffc-b0ae-d8ffa0f0c9e4` (vom Owner freigegeben). Geändert ist nur, was die fünf minor Findings aus `requirements-review-v03-r1` (Revision `6adbad6c…`) verlangen, dazu Metadaten, Kap. 15 und der Vermerk zu H-2. Die vollständige Änderungsliste je ID mit UI- und Architekturrelevanz steht im Dokument `v031-aenderungsliste` an [MAR-129](/MAR/issues/MAR-129#document-v031-aenderungsliste).

| Finding | Ergebnis | Änderung |
| --- | --- | --- |
| FIND-025 (C1, minor) | adressiert | Kap. 8: doppelte, leere Überschrift `### REQ-004` vor AC-REQ-004-01 entfernt. |
| FIND-026 (T1, minor) | adressiert | (a) REQ-001: Abgrenzung zum Betrieb nur am Arbeitsplatzrechner (ohne Zugangspasswort nur am Arbeitsplatzrechner selbst nutzbar); neue AC-REQ-001-07 (von einem anderen Gerät nicht erreichbar); REQ-067: Anforderung, Schwellenwert und Messmethode um diesen Test ergänzt. (b) REQ-001: Geltung eines erteilten Zugangs je Programm auf einem Gerät bis zum Programmende, ohne Zeitgrenze und ohne Abmeldung nach Inaktivität [Vorschlag BA]; REQ-097: andere bestehende Zugänge enden bei einer Änderung des Zugangspassworts [Vorschlag BA]. AC-REQ-001-04 und AC-REQ-097-02 präzisiert; neue AC-REQ-001-08, -09 und AC-REQ-097-05. Kap. 6.1 (Einleitung) angeglichen. (c) REQ-067 und Kap. 9.6: Mindestlänge 12 Zeichen gilt auch für das erste und jedes vom Betreiber zurückgesetzte Zugangspasswort; die Einhaltung stellt der Betreiber sicher, Nachweis bei der Abnahme [Vorschlag BA]. Alle drei Punkte in OP-17 und in der Liste am Dokumentanfang. |
| FIND-027 (T2, minor) | adressiert | REQ-065: Messung je Betriebsmodell. Netzbetrieb wie bisher; Betrieb nur am Arbeitsplatzrechner: startbar und nutzbar, solange der Arbeitsplatzrechner läuft; Zeiten ohne laufenden Arbeitsplatzrechner zählen nicht; Messung über ein Störungsprotokoll des Nutzers und REQ-073 [Vorschlag BA, OP-12]. Schwellenwert 99 % unverändert. OP-12 und Kap. 13.1 (OP-12) angeglichen. |
| FIND-028 (S2, minor) | adressiert | Einheitlich *Arbeitsplatzrechner*: REQ-047 („Zwischenablage des Arbeitsplatzrechners“), REQ-048 („Dateien auf dem Arbeitsplatzrechner“), A-34, OP-24 und Kap. 13.1 (OP-24) in der Einzahl. Zuständig für OP-24 und A-34 ist der Owner, der als einziger Nutzer (E-4) die Angaben zu seinem Arbeitsplatzrechner (E-6) liefert; Kap. 10.2 angeglichen. Glossar: Arbeitsplatzrechner = PC des Owners; ob er beim Pilotkunden steht, ist nicht festgelegt; „PC des Nutzers“ und „PC“ in E-5/E-6 meinen ihn. Skript-Suche: „Arbeitsplatz“ ohne „-rechner“ steht nur noch im Glossar (Hinweis, dass das Wort nicht verwendet wird) und in Kap. 15. |
| FIND-029 (L1, minor) | adressiert | Neue nicht-funktionale **REQ-103 Datenerhalt** (nächste freie ID) mit Schwellenwert und Messmethode: Geräte nie löschen, keine automatische Löschung, Löschen von Modell-Inseraten und Modellvorlagen nur durch den Nutzer nach REQ-095; gilt auch ohne REQ-095. REQ-095 verweist nur noch auf REQ-103. Angeglichen: Must-Begründung REQ-093, Kap. 5.1, Kap. 7 (REQ-082 und C4-Abdeckung), Kap. 10.3, Kap. 14, Kap. 15.4 (REQ-082), Anhang A.1 (GOAL-02, GOAL-03) und A.6 (E-4). REQ-082 bleibt *Withdrawn*; keine ID wiederverwendet. |
| Hinweis H-2 (Review v0.3 R1) | vermerkt | Kap. 15.6: Vermerk zur Umkennzeichnung in REQ-067 (keine inhaltliche Änderung). |

**Bewusst nicht geändert:** Kap. 13 (OP-17 bis Stand v0.3, OP-18, OP-29, OP-30) und Anhang B stehen im Wortlaut von v0.3, obwohl der Owner diese Punkte und die Klassifikation *Material* mit der Freigabe von v0.3 bestätigt hat; den Stand nennen die Metadaten und die Liste am Dokumentanfang. Priorität und Status aller REQs sind unverändert. Umfang, Kanal-Statusmodell und Nutzerreisen J-01 bis J-06 sind fachlich unverändert.

**Für Architektur und UI/UX-Design relevant (gegenüber v0.3):** REQ-001 und REQ-097 (Geltung eines Zugangs, Wirkung der Passwortänderung, nur im Netzbetrieb), REQ-067 (Nicht-Erreichbarkeit im Betrieb nur am Arbeitsplatzrechner; Mindestlänge beim ersten Zugangspasswort durch den Betreiber), REQ-065 (Messung je Betriebsmodell), REQ-103 (Datenerhalt, inhaltlich wie v0.3 in REQ-095), REQ-047/REQ-048 (nur Wortlaut), A-34/OP-24 (zuständig: Owner). Geänderte UI-relevante Randbedingungen: Kap. 10.2 (Angaben zum Arbeitsplatzrechner liefert der Owner) und Kap. 10.3 (nur Verweis auf REQ-103).

### 15.11 Änderungen in v0.3.2 (Owner-Entscheidung E-7; Klarstellung leerer Merkmalsfelder)

Basis ist v0.3.1, Revision `d816223d-ea41-400e-b02c-5af7447bef10`. Die Änderungen von v0.3.1 (Kap. 15.10) und von v0.3.2 (dieses Kapitel) sind getrennt aufgeführt, damit der gemeinsame Delta-Review beide unterscheiden kann. Die vollständige Liste mit alten und neuen Wortlauten, den geprüften unveränderten Stellen und den offenen Punkten steht im Dokument `v032-aenderungsliste` an [MAR-132](/MAR/issues/MAR-132#document-v032-aenderungsliste).

**Teil 1: Owner-Entscheidung E-7 (Sicherung nur Hinweis).** Quelle: Fragekarte `15ba6e78-50f2-45ae-bf5f-94ec9af39256` an MAR-125, Titel „Sicherung in Phase 1“, vom Owner am 06.11.2026 um 18:58 UTC mit Option „(b) Nur Hinweis, ich sichere selbst“ beantwortet. Die Entscheidung reduziert die mit v0.3 freigegebene REQ-066 (RPO 24 h, RTO 2 Arbeitstage, 30 Tage Aufbewahrung als Pflicht des Systems).

| Stelle | Änderung | Herkunft |
| --- | --- | --- |
| REQ-066 (Kap. 7) | *Withdrawn in v0.3.2* mit Begründung; ID bleibt belegt. Zu REQ-066 gab es keine Akzeptanzkriterien in Kap. 8, daher ist kein AC zurückzuziehen | [Entschieden] E-7 |
| REQ-104 (neu, Kap. 6.15) | Functional, Must, Release 0.1: dauerhafter, nicht blockierender Hinweis „Sicherung einrichten“ mit den Aussagen (a) bis (d) und dem Speicherort des Datenordners; AC-REQ-104-01 bis -06 | [Entschieden] E-7; Überschrift, Wortlaut und Speicherort im Text [Vorschlag BA] |
| REQ-105 (neu, Kap. 6.15) | Functional, Must, Release 0.1: Aktion „resellr beenden“ am Hinweis mit Rückfrage, geordnetes Beenden; im Netzbetrieb nicht vorhanden (A-36); AC-REQ-105-01 bis -05. Als eigene REQ getrennt von REQ-104, weil Hinweis und Aktion zwei Verhaltensweisen sind (Klausel L1) | abgeleitet aus E-7 (Owner-Wortlaut: Kopie nur bei beendetem resellr sicher brauchbar), zur ausdrücklichen Owner-Bestätigung (OP-17; Kennzeichnung berichtigt in v0.3.3, FIND-030); Rückfrage, Meldungen und A-36 [Vorschlag BA] |
| REQ-106 (neu, Kap. 7) | Non-functional, Release 0.1: alle Daten in einem Datenordner; eine Kopie bei beendetem resellr enthält alle Daten; AC-REQ-106-01. **Aus der Owner-Entscheidung abgeleitet** (Grundlage von E-7, nicht deren Wortlaut) | abgeleitet aus E-7, zur ausdrücklichen Owner-Bestätigung (OP-17; ergänzt in v0.3.3, FIND-030) |
| Kap. 6.15 (neu) | Unterkapitel „Hinweis auf eigene Sicherung“ mit Einleitung, REQ-104, REQ-105 | E-7 |
| Kap. 7 | Einleitung (Stelle von REQ-066); Abdeckung nach C4 um REQ-106 ergänzt, Verweis auf REQ-066 Withdrawn | E-7 |
| Kap. 8 | neue Abschnitte REQ-104, REQ-105, REQ-106 | E-7 |
| Kap. 5.1, 5.2 | neuer Funktionsbereich REQ-104, REQ-105; nicht-funktionale Liste ohne REQ-066, mit REQ-106; Zeile und Absatz „Withdrawn in v0.3.2“ | E-7 |
| Glossar (Kap. 2.3) | „Betreiber“: „Datensicherung“ ersetzt durch „im Netzbetrieb das Beenden von resellr für eine Sicherung (A-36, OP-31)“; neu „Datenordner“ und „Sicherung“ | E-7; Betreiber im Netzbetrieb [Vorschlag BA] |
| Kap. 9.1 | Absatz „Datenordner“ nach der Entitätentabelle | E-7 |
| Kap. 10.3 | Zeile Betreiber: Beenden im Netzbetrieb für eine Sicherung (A-36) | [Vorschlag BA] |
| Kap. 10.6 | Haupttätigkeiten „Seltener“ um Sicherung ergänzt; Umfang um Hinweis und Aktion ergänzt | E-7 |
| Kap. 11.1 | neue RB-21 = E-7 mit Quelle | E-7 |
| Kap. 11.5 | neue RI-13 (Datenverlust ohne eigene Sicherung; Verantwortung beim Owner) | E-7 |
| Kap. 12 | A-07 aufgehoben; A-06 Folge um REQ-106 ergänzt; neue A-36 (Startannahme zu OP-31) | E-7; A-36 [Vorschlag BA] |
| Kap. 13 | OP-12 auf Geschäftszeiten und Messung eingeengt, Spalte „Annahme“ nur noch REQ-065; neue OP-31; OP-17 um „Neu in v0.3.2“ ergänzt, REQ-066 als Withdrawn vermerkt | E-7 |
| Kap. 13.1 | OP-11 Folge um REQ-106; OP-12 ohne Datenverlust und Wiederherstellung; neue Zeile OP-31 | E-7 |
| Kap. 14 | Sicherungs- und Wiederherstellungsfunktion, Prüfung auf Sicherung, Anbindung an OneDrive außerhalb des Umfangs; Kandidat für ein späteres Release | E-7 |
| Anhang A | A.1 GOAL-02: REQ-106 statt REQ-066; A.6 neue Zeile E-7 mit REQ-104 bis REQ-106 | E-7 |
| Anhang B | Absatz „Was sich durch v0.3.2 ändert“; Klasse unverändert | – |
| Metadaten, Lesehilfe, Liste am Dokumentanfang | Version, Status, Auftrag, Vorgänger, E-7 mit Quelle, Review und Freigabe pending | – |

**Geprüft und unverändert (Teil 1):** REQ-065 hängt nicht an RPO oder RTO; Geschäftszeiten, Schwellenwert und Messung bleiben in v0.3.2 unverändert, ebenso der Verweis auf OP-12. Berichtigung in v0.3.3 (FIND-033): REQ-065 hat eine Wechselwirkung mit der Sicherung, weil resellr nach einem Beenden für eine Sicherung (REQ-105; im Netzbetrieb durch den Betreiber, A-36) bis zum nächsten Start nicht nutzbar ist; v0.3.3 regelt in REQ-065, dass diese Zeiten weder als Ausfall noch als Geschäftszeit zählen [Vorschlag BA, OP-12]. Kap. 9.5 und 9.10 enthalten nichts zur Sicherung. Product Brief v1.0: keine Forderung nach Datensicherung in Zielen, Randbedingungen, Erfolgskriterien oder Risiken, daher kein Konflikt mit dem Brief.

**Teil 2: Klarstellung leerer Merkmalsfelder im Kopier-Assistenten.** Bezug: Design-Annahme im UI/UX-Design an MAR-126, vom Product Owner bestätigt; Auftrag MAR-132. Gekennzeichnet als Klarstellung; Hinweis des BA: REQ-037 und AC-REQ-037-01 verlangten bis v0.3.1 ausdrücklich, leere Merkmale im Kopier-Assistenten als „leer“ zu kennzeichnen. Die Klarstellung ersetzt diese Regel und ist insoweit eine kleine Verhaltensänderung gegenüber der freigegebenen Fassung. Berichtigung in v0.3.3 (FIND-031): REQ-037, AC-REQ-037-01 und die Folge in REQ-047 sind als Änderung der mit v0.3 freigegebenen Regel gekennzeichnet, zur Bestätigung durch den Owner mit der Freigabe; bei REQ-049 bleibt es eine Klarstellung.

| Stelle | Änderung |
| --- | --- |
| REQ-037 | Regel: leere Merkmale bleiben im Kanal-Inhalt leer und erscheinen im Kopier-Assistenten nicht (statt „als leer gekennzeichnet“) |
| AC-REQ-037-01 | Then-Teil angepasst: Feld „Farbe“ leer, erscheint nach der Freigabe nicht im Kopier-Assistenten |
| REQ-047 | Feldliste: nur Merkmalsfelder mit Wert; neue Regel „Leere Merkmalsfelder“ mit Abgrenzung zu den übrigen Feldern und Wechselwirkung mit Bestandsangaben; neue AC-REQ-047-07 |
| REQ-049 | Regel: Merkmalsfelder ohne Wert zählen weder bei „übernommen“ noch in der Gesamtzahl; Beispiel 12 Felder, 2 leer, „x von 10“; neue AC-REQ-049-03 |

**Für Architektur und UI/UX-Design relevant (gegenüber v0.3.1):** neue REQ-104 (Hinweis „Sicherung einrichten“), REQ-105 (Aktion „resellr beenden“, nur im Betrieb nur am Arbeitsplatzrechner), REQ-106 (ein Datenordner); REQ-066 zurückgezogen (keine Sicherungs- und Wiederherstellungsfunktion, keine RPO/RTO-Werte, kein Wiederherstellungstest); REQ-037, REQ-047, REQ-049 (leere Merkmalsfelder). Geänderte UI-relevante Randbedingungen: Kap. 10.3 (Betreiber im Netzbetrieb) und Kap. 10.6 (Hinweis und Aktion). Neue Startannahme A-36 zu OP-31 (Kap. 13.1).

### 15.12 Änderungen in v0.3.3 (FIND-030 bis FIND-034)

Basis ist v0.3.2, Revision `e4b94794-a239-47c3-83cc-ee3670691a4e`. Geändert ist nur, was die fünf minor Findings aus `requirements-review-v032-r1` an [MAR-133](/MAR/issues/MAR-133#document-requirements-review-v032-r1) (Revision `b119fea9-60fc-485a-b079-485276ba91c8`, Verdikt `pass`) verlangen, dazu Metadaten, die Liste am Dokumentanfang und Kap. 15. Inhalt, Priorität und Status von REQ-105 und REQ-106 sind unverändert. Die vollständige Liste mit Fundstellen vorher und nachher steht im Dokument `v033-aenderungsliste` an [MAR-137](/MAR/issues/MAR-137#document-v033-aenderungsliste).

| Finding | Ergebnis | Änderung |
| --- | --- | --- |
| FIND-030 (R3, minor) | adressiert | Owner-Wortlaut und Ableitung getrennt in RB-21 (Kap. 11.1, Quelle um Kommentar 317f1409 und die Ableitung aus Kommentar bb98a214 ergänzt), in der Einleitung von Kap. 6.15, im Glossar „Sicherung“ und in den Metadaten (Owner-Entscheidungen, E-7). REQ-105 mit neuer Zeile „Herkunft: abgeleitet aus E-7, zur ausdrücklichen Owner-Bestätigung“; REQ-106 im Vermerk ebenso. Kap. 15.11: REQ-105 nicht mehr „[Entschieden] E-7“, sondern „abgeleitet aus E-7“; REQ-106 dort ergänzt. Zeile v0.3.2 der Änderungshistorie angeglichen. REQ-105 und REQ-106 in der Liste am Dokumentanfang und in OP-17 („Neu in v0.3.2“) zur ausdrücklichen Owner-Bestätigung mit Standardannahme „gilt wie beschrieben, falls der Owner nicht widerspricht“. |
| FIND-031 (R4, minor) | adressiert | REQ-037 (Regel), AC-REQ-037-01 und REQ-047 (Vermerk „Leere Merkmalsfelder“) als Änderung der mit v0.3 freigegebenen Regel gekennzeichnet: bisher im Kopier-Assistenten als „leer“ gekennzeichnet, jetzt nicht mehr angezeigt; Quelle: Design-Annahme an MAR-126, vom Product Owner bestätigt; Bestätigung durch den Owner mit der Freigabe. Zeile v0.3.2 der Änderungshistorie, Dokumentversion in den Metadaten und Kap. 15.11 (Teil 2) angeglichen; in der Liste am Dokumentanfang eigener Punkt zur Owner-Bestätigung. REQ-049 bleibt „Klarstellung v0.3.2“. |
| FIND-032 (R2, minor) | adressiert | Neue OP-32 in Kap. 13 und 13.1 (Update-Kopie nach ADR-006 gegenüber dem Ausschluss in Kap. 14; Entscheider Product Owner mit Software Architect, bei Bedarf Owner; nicht blockierend) mit Startannahme A-37 [Vorschlag BA] in Kap. 12. Kap. 14: Verweis auf OP-32 am Ausschluss, der Ausschluss selbst ist unverändert. OP-32/A-37 in OP-17 („Neu in v0.3.3“) und in der Liste am Dokumentanfang. |
| FIND-033 (T2, minor) | adressiert | REQ-065, Schwellenwert und Messmethode: Zeiten, in denen resellr nach einem vom Nutzer ausgelösten Beenden (REQ-105) oder im Netzbetrieb nach einem Beenden durch den Betreiber (A-36) nicht läuft, zählen weder als Ausfall noch als Geschäftszeit [Vorschlag BA, OP-12]. OP-12 (Kap. 13), Kap. 13.1 (OP-12) und OP-17 („Neu in v0.3.3“) angeglichen. Kap. 15.11: Aussage „REQ-065 hängt nicht an Sicherung“ berichtigt. Sonst ist REQ-065 unverändert (99 %, Geschäftszeiten, übrige Messung). |
| FIND-034 (T2, minor) | adressiert | REQ-106, Messmethode, und AC-REQ-106-01: Beenden vor dem Kopieren für beide Betriebsmodelle, im Betrieb nur am Arbeitsplatzrechner durch den Nutzer über REQ-105, im Netzbetrieb durch den Betreiber außerhalb der Funktionen des Systems (A-36). REQ-106 gilt weiter ohne Beschränkung auf ein Betriebsmodell. Kap. 13.1, Folgenspalte von OP-31, um REQ-106 und AC-REQ-106-01 ergänzt. |

**Bewusst nicht geändert:** Inhalt, Priorität und Status aller REQs (außer den genannten Kennzeichnungen und den Messmethoden von REQ-065 und REQ-106); OP-17 „Neu in v0.3.1“ und „Neu in v0.3.2“ einschließlich der Anrede „Sie“ im Hinweistext; OP-31/A-36; Kap. 9.1, 10.3, 10.6, RI-13, Anhang A und Anhang B. Neue REQ- und AC-IDs gibt es nicht.

**Für Architektur und UI/UX-Design relevant (gegenüber v0.3.2):** REQ-105 und REQ-106 sind als Ableitung aus E-7 gekennzeichnet und stehen zur ausdrücklichen Owner-Bestätigung (Inhalt unverändert); REQ-065 (Messung: Zeiten nach einem Beenden für eine Sicherung zählen nicht; Schwellenwert unverändert); REQ-106 und AC-REQ-106-01 (Prüfung im Netzbetrieb durch Beenden durch den Betreiber); neue OP-32/A-37 (automatische Kopie vor einem Update gilt bis zur Klärung nicht als Sicherung im Sinne von Kap. 14; betrifft ADR-006). Keine weitere UI-relevante Randbedingung ist geändert.

### 15.13 Änderungen in v0.3.4 (Change Request MAR-573: Wieder-Aktivieren eines Merkmals)

Basis ist v0.3.3, Revision `ce76d962-cc37-46e1-9086-b2be8e08e752` an MAR-114, vom Owner am 07.11.2026 freigegeben ([MAR-142](/MAR/issues/MAR-142#document-owner-freigabeanfrage)). Anlass ist die Rückfrage des QA Lead ([MAR-571](/MAR/issues/MAR-571), PR #334, Issue #151) und die Entscheidung des Product Owner im Change Request [MAR-573](/MAR/issues/MAR-573): Wieder-Aktivieren eines Merkmals ist gewünscht. Gate [MAR-574](/MAR/issues/MAR-574), Auftrag [MAR-579](/MAR/issues/MAR-579) (Parent [MAR-577](/MAR/issues/MAR-577)). Anlass ist kein Review-Finding; die Korrekturrunde 2 (Auftrag [MAR-583](/MAR/issues/MAR-583), Parent [MAR-582](/MAR/issues/MAR-582)) behebt die Findings FIND-035 bis FIND-037 aus dem Review Runde 1, die Korrekturrunde 3 (Auftrag [MAR-592](/MAR/issues/MAR-592), Parent [MAR-591](/MAR/issues/MAR-591)) das Finding FIND-038 aus dem Review Runde 2 (siehe unten). Geändert ist nur, was die Aufträge verlangen; der Rest des Dokuments ist unverändert.

| Stelle | v0.3.3 | v0.3.4 |
| --- | --- | --- |
| Metadaten | Stand v0.3.3, Dokument an MAR-114 | Version, Status, Auftraggeber, Datum, Vorgängerfassung, Review-Referenz, Revision, Human Approval (v0.3.3 freigegeben am 07.11.2026, v0.3.4 pending), UI/UX-Klassifikation (Hinweis); maßgeblich ist ab v0.3.4 das Dokument an MAR-579 |
| Freigabe-Briefing | – | neu: Delta-Briefing für v0.3.4, direkt nach den Metadaten, mit vier kritischen Annahmen (Aktivieren nie abgelehnt; gespeicherte Werte beim Aktivieren unverändert, fehlende Pflichtwerte nur beim Speichern nach REQ-010, REQ-014 oder REQ-088 verlangt; Menge der Variantenmerkmale unverändert; Umfang ohne neue Fachregel) |
| Dokumentanfang nach dem Briefing | Lesehilfe und die beiden Listen direkt nach den Metadaten | Lesehilfe, Hinweis (Listen sind Stand v0.3.3) und die beiden Listen inhaltlich unverändert hinter dem Briefing, vor Kap. 1, unter der Überschrift „Lesehilfe und Owner-Punkte aus v0.3.3“; im Hinweis „Briefing unten“ → „Briefing oben“ |
| REQ-005, Anforderung | „… in ihrer Reihenfolge festlegen und deaktivieren.“ | „… in ihrer Reihenfolge festlegen, deaktivieren und wieder aktivieren.“ |
| REQ-005, Eingaben je Merkmal | Status nicht genannt | „Status aktiv/deaktiviert“ ergänzt |
| REQ-005, Regeln | nur Regel zum deaktivierten Merkmal | direkt danach neuer Absatz „Wieder aktivieren“: wieder abgefragt für neue Daten; gespeicherte Werte unverändert; fehlender Wert eines wieder aktivierten Pflichtmerkmals nicht beim Aktivieren nachgefordert, aber verlangt, und zwar nur beim Speichern nach REQ-010 mit REQ-008 (Modellvorlage), REQ-014 (Gerätewerte) oder REQ-088 (Inseratswerte ohne Preise und Fotos); alle anderen Vorgänge unverändert, insbesondere REQ-032, REQ-042, REQ-019, REQ-017, REQ-020, REQ-021, REQ-084, REQ-092, REQ-093 und REQ-044 (A-39); nie abgelehnt; Kennzeichen „variantenbildend“ und Menge der Variantenmerkmale unverändert, keine Wirkung auf Kap. 6.0, REQ-018, REQ-019 (A-38) |
| REQ-005, Trace | GOAL-03, LP-4, F-7a, SC-07, UC-02, F-4c | ergänzt um Change Request MAR-573 |
| Kap. 8, REQ-005 | AC-REQ-005-01 bis -10 | neu AC-REQ-005-11 (nach dem Change Request; zusätzlich geprüft: Aktivieren ohne Ablehnung, RAM bleibt Variantenmerkmal); neu AC-REQ-005-12 (fehlender Prozessor an einer Modellvorlage und fehlender RAM-Wert an einem Gerät werden beim nächsten Speichern nach REQ-010 bzw. REQ-014 verlangt; ein Preis an einem Modell-Inserat ohne RAM-Wert wird ohne Nachforderung gespeichert) |
| Kap. 9.1, Entität Merkmal | ohne Status | Status (aktiv/deaktiviert) |
| Kap. 12 | letzte Annahme A-37 | neu A-38 (Lesart des freigegebenen Stands: Deaktivieren und Aktivieren ändern das Kennzeichen „variantenbildend“ nicht; kein Namenskonflikt); neu A-39 (Lesart des freigegebenen Stands: für fehlende Werte wieder aktivierter Pflichtmerkmale gelten beim Speichern nach REQ-010, REQ-014 und REQ-088 die bestehenden Pflichtregeln; andere Vorgänge unverändert) |
| Kap. 15 | – | Zeile v0.3.4, Hinweissatz, dieses Kap. 15.13 |
| Anhang B | – | Absatz „Was sich durch v0.3.4 ändert“ |

**Geprüft, ohne Änderung:** Glossar „Merkmal“ und „Variantenmerkmal“ (kein Bezug auf den Status; die Definition trägt A-38); Kap. 6.0 (Vergleichsregel) sowie REQ-018 und REQ-019: Ein deaktiviertes Merkmal ist dort nicht gesondert geregelt; nach Glossar zählt für die Menge der Variantenmerkmale nur das Kennzeichen, nicht der Status. Diese Lesart ist als A-38 ausgewiesen und nicht umformuliert. Kap. 6.1 (J-05); Kap. 9.3 (Startbelegung) und 9.6; Kap. 9.5 (die Zeile „Gerätearten mit Merkmalen“ deckt das Aktivieren ab); REQ-072 und REQ-055 (das Aktivieren ist eine Änderung an einer Einstellung und wird bereits protokolliert); Kap. 10.1 bis 10.5 (unverändert); Kap. 10.6 (der Pflegebereich „Merkmale je Geräteart“ besteht schon, die Zahl der Pflegebereiche bleibt bei ca. 15); Kap. 11, 13 (keine neue offene Frage) und 14; Anhang A (REQ-005 ist bereits auf GOAL-03, LP-4, SC-07 und UC-02 zurückverfolgt; das Wieder-Aktivieren dient denselben Zielen, keine neue Zeile nötig). Ein Verzeichnis oder eine Zählung der Akzeptanzkriterien führt das Dokument nicht. In Korrekturrunde 2 zusätzlich geprüft, ohne Änderung: REQ-008 und REQ-010 (Pflichtregeln der Modellvorlage, AC-REQ-008-05, AC-REQ-010-03), REQ-014 (Werte nach Merkmalsdefinition), REQ-088 (Variantenangaben „Regeln wie REQ-014“), Kap. 6.1, J-01 (Fehlerpfad „Pflichtangaben fehlen“): Keine dieser Stellen kennt eine Ausnahme für Datensätze aus der Zeit einer Deaktivierung; die Folge ist als A-39 ausgewiesen, nicht als neue Regel. REQ-013 (Prüfmarkierung erlaubt das Speichern nur bei markierten, nicht bei fehlenden Werten; ein während der Deaktivierung nicht abgefragtes Merkmal trägt keine Prüfmarkierung). REQ-017 und REQ-044 (Zuordnen und Freigeben prüfen keine Pflichtmerkmale nach REQ-005; die Freigabe prüft Pflichtfelder des Kanals). Kap. 9.3 (Prozessor bei Notebooks Ebene *Modell*, Pflicht; RAM Ebene *Gerät*, Pflicht, variantenbildend). Anhang B (der neue Fall nutzt die bestehende Ablehnung beim Speichern; keine neue Funktion, keine Änderung der Einschätzung). In Korrekturrunde 3 zusätzlich geprüft, ohne Änderung: Glossar „Inseratswerte“ (umfasst Preise und Fotos; die Lesart grenzt auf REQ-088 ein, das Glossar bleibt unverändert); REQ-017, REQ-019, REQ-020, REQ-021, REQ-032, REQ-042, REQ-044, REQ-084, REQ-092 und REQ-093 (keine prüft Pflichtmerkmale nach der Merkmalsdefinition; ihre Regeln gelten unverändert); REQ-088 mit AC-REQ-088-02, REQ-020 und REQ-095 für die im Briefing genannte Folge an MI-B (tatsächlicher RAM-Wert gleich MI-A).

**Korrekturrunde 2 je Finding (Review `requirements-review-v034-r1` an [MAR-581](/MAR/issues/MAR-581#document-requirements-review-v034-r1), Revision `b47a2769-47a9-4fda-bc08-a26c369d84e0`):**

| Finding | Klausel, Schwere | Änderung |
| --- | --- | --- |
| FIND-035 | C6, major | REQ-005, Absatz „Wieder aktivieren“: fehlender Wert eines wieder aktivierten Pflichtmerkmals wird nicht beim Aktivieren nachgefordert, aber beim nächsten Speichern einer Änderung an Modellvorlage, Gerätewerten oder Inseratswerten verlangt (Ablehnung mit Nennung des Merkmals; Auslöser in Korrekturrunde 3 abschließend festgelegt, FIND-038). Als Lesart des freigegebenen Stands ausgewiesen (neue A-39, A-38 unverändert). Neue AC-REQ-005-12 (Modellvorlage/Prozessor und Gerät/RAM). Freigabe-Briefing: Kurzfassung, „So haben wir dich verstanden“ Zeile 2, kritische Annahme 2, „Weitere Annahmen“, „Entscheidungen der Agenten“, „Bewusst nicht enthalten“, „Was sich geändert hat“ und „Lesetipps“ nachgeführt. |
| FIND-036 | F3, minor | Freigabe-Briefing, kritische Annahme 1: „keine Rückfrage“ und „sofort“ gestrichen; Wortlaut auf das Dokument zurückgeführt („wird nie abgelehnt; es gibt keine Prüfung, die das Aktivieren verhindert“). Keine neue Vorgabe in REQ-005 oder A-38. |
| FIND-037 | F1, minor | Freigabe-Briefing direkt hinter die Metadaten-Tabelle gestellt; Lesehilfe, Hinweis v0.3.4 und die beiden Listen von v0.3.3 inhaltlich unverändert dahinter, vor Kap. 1 (eigene Überschrift; im Hinweis „unten“ → „oben“). |

**Korrekturrunde 3 je Finding (Review `requirements-review-v034-r2` an [MAR-586](/MAR/issues/MAR-586#document-requirements-review-v034-r2), Revision `7bb1a59f-5f35-407e-acf3-f258c4f13110`):**

| Finding | Klausel, Schwere | Änderung |
| --- | --- | --- |
| FIND-038 | C6, major | Auslöser der Nachforderung abschließend und einheitlich festgelegt, als Lesart des freigegebenen Stands: nur Speichern nach REQ-010 (Modellvorlage), REQ-014 (Gerätewerte) und REQ-088 (Inseratswerte ohne Preise und Fotos). Ausdrücklich ausgenommen, mit unveränderten Regeln: Preis erfassen (REQ-032), Fotos zuordnen (REQ-042), Anlegen, Zuordnen und Umbuchen (REQ-019, REQ-017, REQ-020), Verkauf und Rücknahme (REQ-021, REQ-084), WI-Nr-Korrektur (REQ-092), Storno (REQ-093), Freigabe (REQ-044). „Datensatz“ ersetzt in REQ-005, im Freigabe-Briefing (Kurzfassung, „So haben wir dich verstanden“ Zeile 2, kritische Annahme 2, „Weitere Annahmen“, „Bewusst nicht enthalten“) und in Kap. 15.13; A-39 auf „Inseratswerte nach REQ-088“ eingeschränkt und um die Ausnahmen ergänzt. AC-REQ-005-12 um Fall (c) ergänzt (Shop-Preis 499,00 € an MI-B ohne RAM-Wert wird gespeichert). Briefing zusätzlich: Beispiel „Preis für MI-B erfassen geht weiterhin“, Folge für MI-B bei tatsächlichem RAM-Wert gleich MI-A (Hinweis aus Review Abschnitt 5, gegen REQ-088, REQ-020 und REQ-095 geprüft), neue Zeile unter „Entscheidungen der Agenten“, „Was sich geändert hat“ nachgeführt. Keine neue Fachregel, keine offene Frage. |

**IDs:** Keine neue REQ-ID; zwei neue AC-IDs (AC-REQ-005-11, AC-REQ-005-12); zwei neue Annahmen (A-38, A-39); Korrekturrunde 3 fügt keine ID hinzu (AC-REQ-005-12 erweitert, A-39 eingegrenzt). Keine Umnummerierung, keine Wiederverwendung von IDs, keine Änderung an Priorität oder Status einer REQ.

**Für Architektur, UI/UX-Design und Technische Spezifikation relevant (gegenüber v0.3.3):** REQ-005 (Wieder-Aktivieren mit Regel; fehlende Werte wieder aktivierter Pflichtmerkmale werden nur beim Speichern nach REQ-010, REQ-014 oder REQ-088 verlangt, nicht beim Aktivieren; beim Erfassen von Preisen und Fotos, beim Anlegen, Zuordnen, Umbuchen, Verkauf und Rücknahme, WI-Nr-Korrektur, Storno und Freigabe entsteht kein neuer Fehlerzustand), AC-REQ-005-11, AC-REQ-005-12, Kap. 9.1 (Status des Merkmals), A-38, A-39. Die UI-relevanten Randbedingungen in Kap. 10.1 bis 10.5 sind unverändert. Zum erwarteten UI-Umfang (Kap. 10.6) kommt in der bestehenden Pflegefunktion „Merkmale je Geräteart“ die Aktion Wieder-Aktivieren für deaktivierte Merkmale hinzu. Laut Change Request setzen Technische Spezifikation (Kap. 2.1, CU-075) und API das Aktivieren bereits voraus; nachzuziehen sind UI-027 und die zugehörigen Zeilen der Technischen Spezifikation.

**Hinweis außerhalb des Auftrags (keine Änderung in v0.3.4):** REQ-004 (Gerätearten) und REQ-007 (Werte von Auswahllisten) nennen weiterhin nur das Deaktivieren, obwohl das freigegebene Design laut Change Request dort bereits einen Weg zurück vorsieht. Ob das in den Requirements nachgezogen werden soll, entscheidet der Product Owner gegebenenfalls in einem eigenen Change.

---

## Anhang A – Traceability-Matrix Brief → REQ

### A.1 Ziele

| Brief | REQ (funktional) | REQ (nicht-funktional) | Akzeptanz |
| --- | --- | --- | --- |
| GOAL-01 | REQ-008, REQ-009, REQ-013, REQ-015, REQ-017, REQ-034, REQ-047, REQ-091 | REQ-060 bis REQ-063, REQ-080 | AC-REQ-017-01, AC-REQ-045-03, REQ-062, REQ-063 |
| GOAL-02 | REQ-008, REQ-010, REQ-012, REQ-034, REQ-036, REQ-037, REQ-040, REQ-050, REQ-088, REQ-095, REQ-100 | REQ-103, REQ-106 (REQ-066 Withdrawn in v0.3.2) | AC-REQ-010-01, AC-REQ-010-04, AC-REQ-040-01 |
| GOAL-03 | REQ-005, REQ-007, REQ-013, REQ-018, REQ-023, REQ-024, REQ-035, REQ-038 bis REQ-040, REQ-044, REQ-045, REQ-058, REQ-059, REQ-084, REQ-086, REQ-088 bis REQ-095, REQ-101 | REQ-072, REQ-103 | AC-REQ-005-09, AC-REQ-013-03, AC-REQ-018-05, AC-REQ-040-01, AC-REQ-044-02, AC-REQ-045-02, AC-REQ-046-07, AC-REQ-047-05 |
| GOAL-04 | REQ-026, REQ-027, REQ-041, REQ-053, REQ-054, REQ-087 | REQ-072 | AC-REQ-053-01, AC-REQ-087-01 |
| GOAL-05 | nicht in Release 0.1 (Phase 2); Vorbereitung durch REQ-021, REQ-052 | – | – |

### A.2 Use Cases

| Use Case | REQ |
| --- | --- |
| UC-01 Gerät per WI-Nr einbuchen, Modell-Inserat zuordnen oder Zustandsvariante anlegen | REQ-012 bis REQ-020, REQ-062, REQ-088, REQ-091 bis REQ-094 |
| UC-02 Neues Modell einmalig anlegen | REQ-004 bis REQ-006, REQ-008 bis REQ-011, REQ-100 |
| UC-03 Zustandscodes übersetzen, Tabelle pflegt der Händler | REQ-015, REQ-022, REQ-099 |
| UC-04 Inserate je Kanal erzeugen, Mensch prüft und gibt frei | REQ-023 bis REQ-025, REQ-030 bis REQ-046, REQ-085 bis REQ-089, REQ-091 |
| UC-05 Kopier-Assistent Feld für Feld inkl. Merkmale und GPSR | REQ-025, REQ-037, REQ-041, REQ-042, REQ-047 bis REQ-049 |
| UC-06 Datenblatt drucken/PDF | REQ-028, REQ-050, REQ-051, REQ-081 |
| UC-07 Je Inserat Kanäle, Stückzahl, verkauft (manuell) | REQ-016, REQ-021, REQ-046, REQ-052, REQ-084, REQ-090, REQ-091 |
| UC-08 Textbausteine und Herstellerangaben zentral pflegen | REQ-026, REQ-027, REQ-053, REQ-054, REQ-087, REQ-100, REQ-101 |

### A.3 Erfolgskriterien

| SC | REQ | Bemerkung |
| --- | --- | --- |
| SC-01 | REQ-062 (Einbuchen ≤ 2 min), REQ-063 (≥ 50 % unter Baseline) | Baseline aus V-01 |
| SC-02 | REQ-050 (Datenblatt im System), REQ-047 (alle Kanäle aus dem System) | Messung 4 Wochen nach Pilotstart durch Pilotkunde/Owner; organisatorisch |
| SC-03 | REQ-040, REQ-023, REQ-024, REQ-044 | Stichprobe im Pilot |
| SC-04 | REQ-053 | AC-REQ-053-01, AC-REQ-053-02 |
| SC-05 | nicht in Release 0.1 | GOAL-05, Phase 2 |
| SC-06 | keine Systemanforderung | Validierung durch Owner |
| SC-07 | REQ-076 (Abnahmetest), REQ-004, REQ-005, REQ-024, REQ-030, REQ-051 | – |

### A.4 Leitplanken und Owner-Entscheidungen

| Brief | REQ / Abschnitt |
| --- | --- |
| LP-1 Einstellung statt fester Inhalt | Kap. 9.5; REQ-006, REQ-007, REQ-022 bis REQ-031, REQ-033, REQ-051, REQ-074, REQ-085, REQ-099 |
| LP-2 Kanäle als eigenständige, ergänzbare Ausgabe-Bausteine | REQ-025, REQ-029, REQ-031, REQ-075 |
| LP-3 Rechte beim Owner, schriftliche Pilotvereinbarung | keine Systemanforderung; V-02, RB-06 |
| LP-4 Gerätearten erweiterbar | REQ-004, REQ-005, REQ-006, REQ-024, REQ-030, REQ-051, REQ-076 |
| F-1 Richtung A | RB-01; gesamter Umfang Kap. 5 |
| F-2 | im Brief nicht ausgewiesen (OP-19) |
| F-3 Kleinanzeigen nur Kopier-Assistent | RB-02; REQ-047, REQ-079, REQ-090 |
| F-4a/b/e Volumen, Zeit, Zweck Datenblatt unbekannt | A-10, A-12; OP-01, OP-03; V-01 |
| F-4c pro Modell mit Stückzahl, Varianten | RB-03; Kap. 6.0; REQ-017, REQ-018, REQ-019, REQ-088 |
| F-4d WI-Nr | RB-04; REQ-012, REQ-016, REQ-092, REQ-093 |
| F-5 Pilot zuerst, produktfähig | RB-05; REQ-001, REQ-069, REQ-073 bis REQ-076, REQ-097; RI-12 |
| Brief Kap. 9 Freigabe jedes Inserats durch den Menschen | RB-11 (mit Verweis auf die Ausnahme nach OP-29); REQ-044, REQ-045, REQ-087, REQ-089, REQ-091; OP-29, A-31 |
| F-6 kostenlos, Rechte beim Owner | RB-06; V-02 |
| F-7a Gerätearten | RB-07; REQ-006, REQ-076 |
| F-7b eBay Nebenkanal | RB-08; REQ-029, REQ-047 |
| F-7c notebookers.de | RB-09; REQ-028, REQ-050 |

### A.6 Owner-Entscheidungen vom 06.11.2026 (E-1 bis E-6 an MAR-121, E-7 an MAR-125)

| Entscheidung | REQ / Abschnitt |
| --- | --- |
| E-1 Eigene Oberfläche, kein PrestaShop-Modul; Web oder Desktop offen | RB-15; Kap. 10.1, 10.4; A-33; OP-15; Kap. 14 |
| E-2 Keine Smartphones und Tablets in Version 1 | RB-16; REQ-077; Kap. 10.2; OP-07 (erledigt); Kap. 14 |
| E-3 Keine Barrierefreiheit | RB-17; REQ-071 (Withdrawn); Kap. 7 (Abdeckung C4), Kap. 10.4; A-24, OP-16 (erledigt); Kap. 14 |
| E-4 Genau ein Nutzer, keine Mitarbeitenden | RB-18; Glossar „Nutzer“; Kap. 3, 10.3, 10.6; REQ-002, REQ-003, REQ-082, REQ-083 (Withdrawn); REQ-012, REQ-018, REQ-044, REQ-055, REQ-060, REQ-069, REQ-072, REQ-080, REQ-089, REQ-090, REQ-093 bis REQ-095, REQ-100, REQ-103; A-01, A-29, OP-06, OP-27 (erledigt) |
| E-5 Zugangspasswort nur im Netzbetrieb; keine Konten, Rollen, kein Zurücksetzen | RB-19; REQ-001, REQ-067, REQ-097; REQ-096, REQ-098, REQ-102, REQ-070 (Withdrawn); REQ-069, REQ-072; A-28, A-30, OP-25, OP-28 (erledigt); A-35 |
| E-6 Immer derselbe PC | RB-20; REQ-077; Kap. 10.2, 10.5; A-02, A-35; OP-07 (erledigt) |
| E-7 Sicherung freiwillig durch den Owner (OneDrive), nur Hinweis, keine Sicherungsfunktion in Phase 1 | RB-21; REQ-104, REQ-105, REQ-106 (AC-REQ-104-01 bis -06, AC-REQ-105-01 bis -05, AC-REQ-106-01); REQ-066 (Withdrawn); Glossar „Datenordner“, „Sicherung“, „Betreiber“; Kap. 9.1, 10.3, 10.6; RI-13; A-07 (aufgehoben), A-36; OP-12, OP-31; Kap. 14 |

### A.5 Nice-to-have laut Brief

| Brief Kap. 7 Nice-to-have | REQ | Priorität |
| --- | --- | --- |
| Übernahme der Excel-Blätter als Startbestand | REQ-056 | Could |
| Importdatei für PrestaShop | REQ-057 | Could |
| Plausibilitätswarnungen | REQ-058, REQ-059 | Could |

## Anhang B – Einschätzung zur UI/UX-Klassifikation (Input für den Product Owner)

**Status der Klassifikation: pending** (Empfehlung durch den Product Owner, Bestätigung durch den Owner bei der Freigabe). Diese Einschätzung des Business Analyst ist nur Input; sie wurde an die Lage nach E-1 bis E-6 angepasst (nur noch eine Rolle, keine Konten, eigene Oberfläche).

**Einschätzung: Material** (unverändert gegenüber v0.2).

Begründung:
1. **Neues Produkt mit mehreren neuen Funktionsbereichen**: Erfassung (Gerät, Modellvorlage, Modell-Inserat), Prüfung und Freigabe von 3 Kanal-Inhalten einschließlich Änderungsentwürfen, Kopier-Assistent, Inserat-Übersicht mit Kennzeichnungen, Datenblatt sowie ca. 15 Einstellungsbereiche (Kap. 10.6). Es gibt keine bestehende Oberfläche, auf der aufgebaut wird; es ist eine eigene Oberfläche (E-1), also auch kein vorgegebener Gestaltungsrahmen eines PrestaShop-Backoffice.
2. **Bedeutende Nutzerflüsse, deren Effizienz der Kern des Nutzens ist**: Einbuchen ≤ 2 Minuten (SC-01, REQ-062) mit Prüfmarkierungen und Abweichungsentscheidung; Kopier-Assistent parallel zu fremden Formularen. Die riskantesten Annahmen des Brief (Brief-A-3 Akzeptanz des Kopier-Assistenten, Brief-A-4 Umstieg von Excel) sind UX-Fragen; der Brief empfiehlt dafür selbst einen klickbaren Prototyp.
3. **Dynamische, per Einstellung definierte Formulare** (LP-4) und Einstellungs-Editoren, die ein Nicht-Entwickler bedienen muss (SC-07, REQ-076).
4. Gegen „Minimal“ spricht, dass es sich nicht um einfache Formulare oder ein internes Admin-Werkzeug aus Standardkomponenten handelt, sondern um das Hauptarbeitswerkzeug des Nutzers mit mehrstufigem Ablauf.

**Was sich durch E-1 bis E-6 ändert:** Keiner der Gründe 1 bis 4 hängt an Rollen oder Konten. Von den Komplexitätstreibern in Kap. 10.6 entfällt nur einer, die rollenabhängigen Sichten (E-4); dazu entfallen Benutzerverwaltung und Passwortfunktionen bis auf das Zugangspasswort im Netzbetrieb (E-5). Mobile Bildschirmgrößen (E-2) und Barrierefreiheit (E-3) sind nicht zu gestalten; das senkt den Aufwand, ändert aber nach Einschätzung des BA die Klasse nicht.

**Was sich durch v0.3.2 ändert:** Hinzu kommen ein dauerhaft sichtbarer Hinweis „Sicherung einrichten“ (REQ-104) und eine Aktion „resellr beenden“ mit Rückfrage (REQ-105, nur im Betrieb nur am Arbeitsplatzrechner). Im Kopier-Assistenten entfallen leere Merkmalsfelder aus der Feldliste und dem Zähler (REQ-047, REQ-049). Beides ist klein und ändert nach Einschätzung des BA die Klasse *Material* nicht.

**Was sich durch v0.3.4 ändert:** In der bestehenden Pflegefunktion „Merkmale je Geräteart“ kommt das Wieder-Aktivieren eines deaktivierten Merkmals hinzu (REQ-005, AC-REQ-005-11). Das ist klein und ändert nach Einschätzung des BA die Klasse *Material* nicht.
