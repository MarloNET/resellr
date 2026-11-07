# ADR-003 – Technologie-Stack: TypeScript, Node.js, Fastify, React

- **Status:** approved (Owner-Freigabe 2026-11-07 mit Architecture Baseline v0.3.2, Revision `2876806d-48b2-4ec3-b961-2f4d370d9b2e`, [MAR-142](/MAR/issues/MAR-142#document-owner-freigabeanfrage))
- **Kontext:** Nach ADR-001 braucht es einen lokalen Server und eine Browser-Oberfläche. Zielplattform ist Windows 11 x64 mit Google Chrome (OD-04); ein plattformneutraler Stack ist kein Muss mehr, erleichtert aber CI, Review und QA unter Linux (Kap. 11.3) und den späteren Betrieb auf einem Server (ADR-002). Der Stack muss Formulare aus Einstellungen erzeugen können (LP-4), PDF und Bildverarbeitung bieten und vom Owner ohne Entwickler betreibbar sein.
- **Betroffene Anforderungen:** REQ-005, REQ-047, REQ-050, REQ-060, REQ-061, REQ-073, REQ-076 bis REQ-078.
- **Optionen:**
  - (A) TypeScript durchgängig: Node.js und Fastify, React-SPA.
  - (B) Python: FastAPI, SQLAlchemy, WeasyPrint, React- oder htmx-Oberfläche.
  - (C) .NET: ASP.NET Core mit Blazor.
  - (D) Java: Spring Boot mit SPA.
- **Bewertung:**
  - (A) bietet eine Sprache für Server und Oberfläche und gemeinsame Validierungsschemas, also dieselben Regeln an beiden Stellen. Die Laufzeit ist klein und mitlieferbar, das Ökosystem für SPAs sehr groß.
  - (B) ist gleichwertig für den Server, braucht aber zwei Sprachen. Dazu kommt Paketierung einer Python-Laufzeit mit nativen Abhängigkeiten (WeasyPrint).
  - (C) ist stark unter Windows, aber Blazor hat ein deutlich kleineres Ökosystem an UI-Komponenten.
  - (D) hat die größte Laufzeit und den meisten Aufwand für eine Einzelplatz-Anwendung.
- **Entscheidung (Vorschlag):** **(A)**, mit den Bausteinen aus Kap. 3.
- **Konsequenzen:**
  - Native Module (`better-sqlite3`, `sharp`) brauchen Builds für das Zielsystem, in Release 0.1 nur Windows x64 (AR-10).
  - Mit OD-04 (Windows) gewinnt (C) .NET an Gewicht. Für (A) sprechen weiterhin eine Sprache in Server und Oberfläche, gemeinsame Validierungsschemas und das größere Angebot an UI-Komponenten. Die Entscheidung bleibt deshalb bei (A).
  - JavaScript-Zahlen sind Gleitkommazahlen, deshalb Geld in Cent und Dezimalwerte als Zeichenkette (Kap. 4.4).
  - Die exakten Versionen legt die Technical Specification fest.
- **Risiken:** AR-10.
- **Referenzen:** Owner-Antwort zu OD-04 vom 06.11.2026; Architecture Review Runde 1 (FIND-109, Kontext in v0.3 nachgeführt); Freigabe pending.

---
Veröffentlicht aus der Architecture Baseline v0.3.2 (Kapitel 15), `docs/architecture/architecture-baseline.md`.
