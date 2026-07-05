# Aufgaben & Roadmap

## Meilenstein 1 – MVP-Gerüst ✅ (2026-07-03)

- [x] Expo-Projekt (SDK 57, TypeScript strict)
- [x] Navigation + 6 Screens (Chat, Agent, Dateien, E-Mail, Browser, Settings)
- [x] TypeScript-Typen für Tools, Pläne, Chat, E-Mail, Settings
- [x] Tool-Registry mit `risky`/`mock`-Flags (29 Tools)
- [x] Tool-Executor mit Bestätigungspflicht (fail closed)
- [x] Agent-Plan-System (LLM → JSON-Plan → Validierung → Review → Ausführung)
- [x] Datei-Sandbox real (list/read/write/move/rename/create/delete) inkl. Pfad-Validierung
- [x] Dateien-Tab nutzbarer: Breadcrumbs, Umbenennen, Verschieben, Import von
      Gerätedateien als Sandbox-Kopien
- [x] Mock-E-Mail-Service + Screen
- [x] Mini-Browser (WebView) + Command-Bridge (`open_url`, `go_back`)
- [x] Settings-Screen (API-Key in SecureStore, Base-URL/Modell in AsyncStorage)
- [x] Lokale modellunabhängige User Memory (AsyncStorage, Settings-Verwaltung,
      Agent-Tools, Chat-/Planner-Kontext)
- [x] ConfirmActionModal für riskante Aktionen
- [x] Doku (README, ARCHITECTURE, CODEX_HANDOFF, TASKS, DECISIONS)

## Meilenstein 2 – Agent nutzbar machen

- [x] `read_page` echt: sichtbarer Text, Headings, Links, Buttons, Inputs per
      WebView-JS-Injection (2026-07-05)
- [ ] Agent-Loop V2: Tool-Ergebnisse zurück ans LLM (plan → act → observe → replan)
- [ ] Chat-Verlauf und Agent-Läufe persistieren (AsyncStorage)
- [ ] Memory-Relevanz später optional mit Embeddings/Vektorsuche verbessern
      (keine neue Dependency im aktuellen einfachen Stand)
- [ ] Fehler-Retry im Planner (ungültiges JSON → eine Korrektur-Runde)
- [ ] Settings: "Verbindung testen"-Button
- [ ] Datei-Editor im Dateien-Tab (Textdatei bearbeiten, nicht nur ansehen)
- [ ] Safe Mode / Full Access Mode für `write_file`: Überschreiben bestehender
      Dateien je nach Modus bestätigen oder erlauben

## Meilenstein 3 – Browser-Agent – Kern fertig 2026-07-05

- [x] JS-Bridge WebView ↔ browserService: Request-IDs, Promise-basiert,
      Timeouts, Fehler-Propagation (`executeScript` + `handleBridgeMessage`)
- [x] `click_element`: CSS-Selektor zuerst, Fallback auf sichtbaren Text
      (Links, Buttons, role=button, summary, label, onclick)
- [x] `type_text`: Input/Textarea/contenteditable mit input+change-Events;
      verweigert Passwortfelder
- [x] `submit_form`: requestSubmit/submit, Fallback Enter-Key auf fokussiertem
      Input; bleibt `risky` (Bestätigungspflicht)
- [x] `scroll_page` (up/down, ca. eine Bildschirmhöhe)
- [x] `wait_for_page` (100–10000 ms, meldet readyState/URL/Titel)
- [ ] YouTube-Transcript-Spezialtool (auf read_page/Bridge aufbauend)
- [ ] `download_file` mit `File.downloadFileAsync` in die Sandbox (Pfad validiert, bestätigungspflichtig)
- [ ] `screenshot_page` (benötigt neue Dependency, vorher in DECISIONS.md begründen)
- [ ] Domain-Allowlist/Blocklist für den Mini-Browser
- [ ] Browser-Tab automatisch fokussieren, wenn der Agent Browser-Tools nutzt

## Meilenstein 4 – Echte E-Mail (Gmail) – Kern fertig 2026-07-05

- [x] E-Mail-Service-Interface extrahieren (`services/email/types.ts`, Mock als eine Implementierung)
- [x] Gmail über OAuth 2.0 (PKCE, `expo-auth-session`), Tokens nur in SecureStore (`tokenStore.ts`)
- [x] Gmail API v1: Suche, Lesen, Entwürfe, Antwort-Entwürfe, Senden, Archivieren, Labeln
- [x] EmailScreen: Status, Gmail verbinden/trennen, Mock verbinden, Inbox-Test
- [x] Agent-Tools auf Provider-Schicht umgestellt (Tool-Namen unverändert)
- [ ] Google-Client-IDs eintragen (`src/config/googleOAuth.ts`) und auf Gerät testen (Dev-Build!)
- [ ] Bestätigungsdialog zeigt bei `send_email` Empfänger + Betreff prominent
- [ ] Token-Refresh verbessern: Ablauf des Refresh-Tokens sauber behandeln
      (Testing-Status: 7 Tage), Nutzer aktiv zum Re-Login auffordern
- [ ] Suche: Gmail-Query-Syntax (`from:`, `label:`, `newer_than:`) im Planner-Prompt dokumentieren
- [ ] Pagination für mehr als 15 Suchergebnisse

## Meilenstein 5 – Full Access Mode

- [ ] Konzept: bewusste Aktivierung (eigener Settings-Schalter + Warndialog)
- [ ] Scope: nur Aktionen INNERHALB verbundener Dienste (z. B. Gmail senden/
      archivieren/labeln) ohne Einzelbestätigung; Datei-Löschen bleibt bestätigungspflichtig?
      → Entscheidung dokumentieren
- [ ] Nie ohne Bestätigung: Konto verbinden/trennen, alles außerhalb der App-Sandbox
- [ ] Audit-Log verpflichtend, sobald Full Access aktiv ist
- [ ] Umsetzung am TODO-Anker in `src/agent/executor/toolExecutor.ts`

## Meilenstein 6 – Outlook/Microsoft (später)

- [ ] `outlookProvider.ts` gegen Microsoft Graph API (OAuth 2.0 + PKCE, MSAL-kompatibel)
- [ ] Gleiches `EmailProvider`-Interface, keine Tool-/UI-Änderungen
- [ ] Provider-Auswahl in den Settings (Mock/Gmail/Outlook)

## Später / Ideen

- [ ] Mehrere Agent-Profile (unterschiedliche System-Prompts)
- [ ] Audit-Log: alle ausgeführten Tools mit Zeitstempel in der Sandbox protokollieren
- [ ] Export/Import der Sandbox als ZIP
- [ ] Export einzelner Sandbox-Dateien zurück in Downloads
- [ ] Streaming-Antworten im Chat
- [ ] Unit-Tests für `sanitizeSandboxPath` und `parsePlan` (Jest einführen)
