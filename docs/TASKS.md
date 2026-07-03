# Aufgaben & Roadmap

## Meilenstein 1 – MVP-Gerüst ✅ (2026-07-03)

- [x] Expo-Projekt (SDK 56, TypeScript strict)
- [x] Navigation + 6 Screens (Chat, Agent, Dateien, E-Mail, Browser, Settings)
- [x] TypeScript-Typen für Tools, Pläne, Chat, E-Mail, Settings
- [x] Tool-Registry mit `risky`/`mock`-Flags (23 Tools)
- [x] Tool-Executor mit Bestätigungspflicht (fail closed)
- [x] Agent-Plan-System (LLM → JSON-Plan → Validierung → Review → Ausführung)
- [x] Datei-Sandbox real (list/read/write/move/rename/create/delete) inkl. Pfad-Validierung
- [x] Mock-E-Mail-Service + Screen
- [x] Mini-Browser (WebView) + Command-Bridge (`open_url`, `go_back`)
- [x] Settings-Screen (API-Key in SecureStore, Base-URL/Modell in AsyncStorage)
- [x] ConfirmActionModal für riskante Aktionen
- [x] Doku (README, ARCHITECTURE, CODEX_HANDOFF, TASKS, DECISIONS)

## Meilenstein 2 – Agent nutzbar machen

- [ ] `read_page` echt: Text der aktuellen Seite per WebView-JS-Injection extrahieren
- [ ] Agent-Loop V2: Tool-Ergebnisse zurück ans LLM (plan → act → observe → replan)
- [ ] Chat-Verlauf und Agent-Läufe persistieren (AsyncStorage)
- [ ] Fehler-Retry im Planner (ungültiges JSON → eine Korrektur-Runde)
- [ ] Settings: "Verbindung testen"-Button
- [ ] Datei-Editor im Dateien-Tab (Textdatei bearbeiten, nicht nur ansehen)

## Meilenstein 3 – Browser-Agent

- [ ] `click_element`, `type_text`, `submit_form` via injectJavaScript + postMessage
- [ ] `download_file` mit `File.downloadFileAsync` in die Sandbox (Pfad validiert, bestätigungspflichtig)
- [ ] `screenshot_page` (benötigt neue Dependency, vorher in DECISIONS.md begründen)
- [ ] Domain-Allowlist/Blocklist für den Mini-Browser

## Meilenstein 4 – Echte E-Mail

- [ ] E-Mail-Service-Interface extrahieren (Mock als eine Implementierung)
- [ ] Gmail über OAuth 2.0 (PKCE, `expo-auth-session`), Tokens in SecureStore
- [ ] Entwürfe/Senden über Gmail API; `send_email` bleibt bestätigungspflichtig
- [ ] Bestätigungsdialog zeigt Empfänger + Betreff prominent

## Später / Ideen

- [ ] Mehrere Agent-Profile (unterschiedliche System-Prompts)
- [ ] Audit-Log: alle ausgeführten Tools mit Zeitstempel in der Sandbox protokollieren
- [ ] Export/Import der Sandbox als ZIP
- [ ] Streaming-Antworten im Chat
- [ ] Unit-Tests für `sanitizeSandboxPath` und `parsePlan` (Jest einführen)
