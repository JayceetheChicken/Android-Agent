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
- [x] Memory V2: Chat speichert explizite Merk-Anweisungen lokal,
      Dedupe/Merge per Token-Ähnlichkeit, besseres Scoring ohne Embeddings
- [x] ConfirmActionModal für riskante Aktionen
- [x] Doku (README, ARCHITECTURE, CODEX_HANDOFF, TASKS, DECISIONS)

## Meilenstein 2 – Agent nutzbar machen

- [x] `read_page` echt: sichtbarer Text, Headings, Links, Buttons, Inputs per
      WebView-JS-Injection (2026-07-05)
- [x] Agent-Loop V2: iterativ plan → act → observe → replan → finish
      (`src/agent/loop/`, max. 12 Schritte, Observations zurück ans Modell,
      ehrliche Zwischenantwort beim Limit) (2026-07-05)
- [ ] Chat-Verlauf und Agent-Läufe persistieren (AsyncStorage)
- [ ] Memory-Relevanz später optional mit Embeddings/Vektorsuche verbessern
      (keine neue Dependency im aktuellen einfachen Stand)
- [x] Fehler-Retry bei ungültigem JSON: eine Korrektur-Runde im Agent-Loop
      (`decideNextStep`) (2026-07-05)
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
      verweigert Passwortfelder UND secret-artige Eingaben (API-Keys/Tokens)
- [x] `submit_form`: requestSubmit/submit, Fallback Enter-Key auf fokussiertem
      Input; bleibt `risky` (Bestätigungspflicht)
- [x] `scroll_page` (up/down, ca. eine Bildschirmhöhe)
- [x] `wait_for_page` (100–10000 ms, meldet readyState/URL/Titel)
- [x] Browser-Tab automatisch verfügbar: `lazy: false` mountet die WebView beim
      App-Start; `ensureBrowserReady()` als Sicherheitsnetz (2026-07-05)
- [x] WebView-Navigation gehärtet: `onShouldStartLoadWithRequest` +
      `validateNavigationUrl` erlauben nur https/about:blank, blocken
      javascript:/file:/intent:/market:/tel:/mailto: (2026-07-05)
- [ ] YouTube-Transcript-Spezialtool (auf read_page/Bridge aufbauend)
- [ ] `download_file` mit `File.downloadFileAsync` in die Sandbox (Pfad validiert, bestätigungspflichtig)
- [ ] `screenshot_page` (benötigt neue Dependency, vorher in DECISIONS.md begründen)
- [ ] Domain-Allowlist/Blocklist für den Mini-Browser (über https hinaus)

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

## Meilenstein 4b – Google Drive – Kern fertig 2026-07-05

- [x] Gemeinsame Google-OAuth-Hilfe für frei übergebene Scopes
      (`services/google/oauth.ts`), Gmail weiterhin kompatibel
- [x] Drive-Service-Schicht (`services/drive/driveService.ts`,
      `providers/googleDriveProvider.ts`, `tokenStore.ts`, `types.ts`)
- [x] Drive OAuth 2.0 + PKCE mit Scope `https://www.googleapis.com/auth/drive`,
      Tokens nur in SecureStore
- [x] Agent-Tools: verbinden, Status, listen, suchen, Download in Sandbox,
      Upload aus Sandbox, verschieben, Ordner erstellen, Papierkorb, umbenennen
- [x] Risky-Flags für alle Drive-Aktionen mit Außenwirkung; `drive_get_status`,
      `drive_list_files`, `drive_search_files` bleiben ohne Bestätigung
- [x] Sandbox-Binärzugriff ergänzt (`readBinaryFile`, `writeBinaryFile`,
      `getFileInfo`); Drive-Downloads überschreiben bei Namenskollision nicht
- [x] DriveScreen mit Status, Verbinden/Trennen und Root-Dateien-Test
- [x] README/ARCHITECTURE/DECISIONS aktualisiert
- [ ] Auf echtem Android-Development-Build mit eingetragenen Google-Client-IDs
      gegen ein echtes Drive-Konto testen

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
