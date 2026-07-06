# Handoff fuer KI-Coding-Tools (Codex, Claude Code, ...)

Dieses Dokument bringt ein KI-Tool ohne Vorwissen auf Stand.
Es gibt keine Claude-spezifischen Strukturen - alles ist Standard-Expo + TypeScript.

## Was bereits gebaut wurde (Stand 2026-07-05)

- Expo SDK 57 / React Native 0.86 / TypeScript strict, Bottom-Tab-Navigation mit
  7 Screens: Chat, Agent, Dateien, Drive, E-Mail, Browser, Settings.
- **Statischer Agent-Planer:** `src/agent/planner.ts` erzeugt weiterhin
  validierte JSON-Plaene mit maximal 10 Schritten. Das Modul bleibt erhalten,
  ist aber nicht mehr der Haupt-Flow im Agent-Tab.
- **Agent Loop V2:** `src/agent/loop/agentLoop.ts` + `loopPlanner.ts` arbeiten
  iterativ: `plan -> act -> observe -> replan -> finish`. Der Loop laedt lokale
  User Memory einmal am Anfang, fuehrt pro Iteration genau ein Tool ueber
  `executeStep()` aus, gibt das `ToolResult` als Observation zurueck ins Modell
  und stoppt spaetestens nach `MAX_AGENT_LOOP_STEPS` (12) mit ehrlicher
  Zwischenantwort.
- **Tool-Executor** (`src/agent/executor/toolExecutor.ts`): fuehrt Schritte aus,
  erzwingt Nutzerbestaetigung fuer riskante Tools (fail closed ueber
  `executor/confirmation.ts` + `components/ConfirmActionModal.tsx`).
- **Tool-Registry** (`src/agent/tools/definitions.ts`): alle Tools mit `risky`-
  und `mock`-Flags. `describeToolsForPrompt()` speist statischen Planer und Loop.
- **Datei-Tools: echt implementiert**, sandboxed auf `<documentDirectory>/sandbox/`
  (`services/storage/sandboxFs.ts` + Pfad-Validierung in `utils/paths.ts`).
- **E-Mail: echte Gmail-Anbindung ueber Provider-Schicht** (Stand 2026-07-05):
  `services/email/emailService.ts` delegiert an Gmail OAuth/PKCE oder Mock.
  Tokens liegen nur in SecureStore. Scope bleibt `gmail.modify`.
- **Google Drive: echte Drive-Anbindung** (Stand 2026-07-05):
  eigene Schicht `services/drive/` mit `driveService.ts`,
  `providers/googleDriveProvider.ts`, `tokenStore.ts`, `types.ts`. OAuth 2.0 +
  PKCE nutzt `services/google/oauth.ts`; Scope:
  `https://www.googleapis.com/auth/drive`. Agent-Tools koennen verbinden,
  Status lesen, listen, suchen, in die Sandbox herunterladen/exportieren, aus
  der Sandbox hochladen, verschieben, Ordner erstellen, Papierkorb und
  umbenennen. Tokens bleiben in SecureStore; Outputs enthalten nur Metadaten.
  Drive-Downloads ueberschreiben keine bestehenden Sandbox-Pfade.
- **Browser-Tools: echt** (Stand 2026-07-06): `read_page`, `click_element`,
  `type_text` (verweigert Passwortfelder und secret-artige Eingaben),
  `submit_form` (risky), `scroll_page`, `wait_for_page`, `browser_get_state`,
  `stop_loading`, `open_url` (risky), `go_back`. `wait_for_page` und
  `browser_get_state` lesen nativen WebView-State ohne JS-Injection; `read_page`
  nutzt weiter die Script-Bridge, ist aber ein leichter Extractor ohne
  `body.innerText`, mit Meta-/Link-Fallback, laengerem Timeout und besserer
  Diagnose mit URL/loading/error-State. Der Browser-Tab wird per `lazy: false` beim App-Start gemountet;
  `ensureBrowserReady()` wartet bei Bedarf kurz auf die WebView. WebView-
  Navigation wird mit `onShouldStartLoadWithRequest` auf `https:` und internes
  `about:blank` begrenzt. Externe Android-Intents/Schemes werden blockiert.
  Stubs: `screenshot_page`, `download_file`.
- **Settings:** API-Key (SecureStore), Base-URL + Modell (AsyncStorage).
- **User Memory:** lokale, modellunabhaengige User Memory in AsyncStorage
  (`services/memory/memoryService.ts`, `DEFAULT_USER_ID = 'local-user'`).
  Chat und Agent laden relevante Memories vor Modellaufrufen. Keine Secrets
  speichern.
- `npm run typecheck` muss vor jedem Commit sauber sein.

## Wichtige Dateien (in dieser Reihenfolge lesen)

1. `docs/ARCHITECTURE.md` - Gesamtbild + Sicherheitsmodell
2. `src/types/tools.ts` + `src/agent/tools/definitions.ts` - was der Agent kann
3. `src/agent/executor/toolExecutor.ts` - wie Schritte ausgefuehrt werden
4. `src/agent/loop/agentLoop.ts` + `src/agent/loop/loopPlanner.ts` - Loop V2
5. `src/screens/AgentScreen.tsx` - UI-Fluss Loop-Schritte + finale Antwort
6. `src/services/browser/browserService.ts` + `src/screens/BrowserScreen.tsx`
7. `src/services/email/` - Provider-Schicht (Gmail/Mock)
8. `docs/TASKS.md` - was als Naechstes ansteht

## Wie weiterarbeiten

- Konventionen: TypeScript strict, keine neuen Dependencies ohne Eintrag in
  `docs/DECISIONS.md`, Kommentare/Code Englisch, UI-Texte Deutsch.
- Neues Tool hinzufuegen = 3 Stellen: Name in `src/types/tools.ts`, Definition
  in `agent/tools/definitions.ts`, Handler in der passenden
  `agent/tools/*Tools.ts`. Der Compiler erzwingt Vollstaendigkeit.
- Mock durch echte Implementierung ersetzen = nur den Service unter
  `src/services/` umbauen; Tool-Handler und UI bleiben stabil.
- Vor jedem Commit: `npm run typecheck`.
- Jede Architekturentscheidung in `docs/DECISIONS.md` dokumentieren, erledigte
  Aufgaben in `docs/TASKS.md` abhaken.

## Naechste Features (Details in docs/TASKS.md)

1. Gmail-Verbindung auf Geraet testen (Client-IDs eintragen, Dev-Build).
2. YouTube-Transcript-Spezialtool (auf read_page/Bridge aufbauend).
3. `download_file` in die Sandbox und `screenshot_page` (neue Dependency erst
   begruenden, siehe DECISIONS.md).
4. Chat- und Agent-Verlauf persistieren (AsyncStorage).
5. Memory-Relevanz optional mit Embeddings/Vektorsuche verbessern.
6. Full Access Mode (bewusst aktivierbar, nur innerhalb verbundener Dienste).
7. Outlook/Microsoft als zweiter echter Provider (separater Meilenstein).

## Wichtig bei E-Mail-Aenderungen

- Agent-Tools und UI reden NUR mit `emailService.ts`, nie direkt mit einem
  Provider oder der Gmail API.
- Tokens bleiben in `tokenStore.ts` (SecureStore) und in
  `gmailProvider.ts`-internen Aufrufen. Kein Interface, kein Tool-Output,
  kein Log darf Tokens enthalten.
- Der Mock-Provider darf nicht entfernt werden (Fallback + Referenz).
- Scope bleibt `gmail.modify`; `https://mail.google.com/` ist tabu.
- Kein Client-Secret einfuehren - PKCE braucht keines.

## Wichtig bei Drive-Aenderungen

- Agent-Tools und UI reden NUR mit `driveService.ts`, nie direkt mit dem
  Provider oder der Drive API.
- Tokens bleiben in `services/drive/tokenStore.ts` (SecureStore) und in
  `googleDriveProvider.ts`-internen Aufrufen. Kein Tool-Output, UI-Listing,
  Log oder Sandbox-File darf Tokens enthalten.
- Drive darf Dateien aktiv verwalten. `risky: true` bedeutet
  Nutzerbestaetigung, nicht Blockade.
- Downloads in die Sandbox muessen weiter ueber `sandboxFs.ts` laufen und
  bestehende Ziele ablehnen statt still zu ueberschreiben.
- Uploads duerfen nur aus der Sandbox lesen. Kein Android-Dateizugriff ausserhalb
  von `services/storage/sandboxFs.ts`.

## Sicherheitsregeln - duerfen NIE gebrochen werden

1. **Kein direkter Ausfuehrungspfad:** LLM-Output ist immer Daten (JSON-Plan
   oder JSON-Loop-Decision), wird nie evaluiert oder als Code ausgefuehrt.
2. **Bestaetigungspflicht bleibt:** `risky: true`-Tools laufen nur ueber
   `requestConfirmation`. Niemals einen Bypass, kein Auto-Approve.
3. **Fail closed:** Ohne registrierten Bestaetigungs-Handler wird abgelehnt.
4. **Sandbox-Grenze:** Jeder Dateipfad geht durch `sanitizeSandboxPath()`.
   Keine Dateizugriffe an `services/storage/sandboxFs.ts` vorbei.
5. **Keine Android-Systemsteuerung:** keine Accessibility-Services, keine
   Intents in fremde Apps, keine zusaetzlichen Permissions ohne Nutzer-Diskussion.
6. **Secrets:** API-Keys/Tokens nur in `expo-secure-store`. Nie hardcoden,
   nie loggen, nie in die Datei-Sandbox schreiben.
7. **Browser:** nur `https:`; weder `browserService.validateUrl` noch
   `validateNavigationUrl`/`onShouldStartLoadWithRequest` aufweichen.
