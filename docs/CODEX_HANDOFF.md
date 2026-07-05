# Handoff für KI-Coding-Tools (Codex, Claude Code, …)

Dieses Dokument bringt ein KI-Tool ohne Vorwissen auf Stand.
Es gibt keine Claude-spezifischen Strukturen – alles ist Standard-Expo + TypeScript.

## Was bereits gebaut wurde (MVP-Gerüst, Stand 2026-07-03)

- Expo SDK 57 / React Native 0.86 / TypeScript strict, Bottom-Tab-Navigation mit 6 Screens:
  Chat, Agent, Dateien, E-Mail, Browser, Settings.
- **Agent-Plan-System:** LLM erzeugt JSON-Pläne (`src/agent/planner.ts`),
  strenges Parsen/Validieren, max. 10 Schritte.
- **Tool-Executor** (`src/agent/executor/toolExecutor.ts`): führt Schritte aus,
  erzwingt Nutzerbestätigung für riskante Tools (fail closed über
  `executor/confirmation.ts` + `components/ConfirmActionModal.tsx`).
- **Tool-Registry** (`src/agent/tools/definitions.ts`): alle 25 Tools mit
  `risky`- und `mock`-Flags. Der Planner-Prompt wird daraus generiert.
- **Datei-Tools: echt implementiert**, sandboxed auf `<documentDirectory>/sandbox/`
  (`services/storage/sandboxFs.ts` + Pfad-Validierung in `utils/paths.ts`).
- **E-Mail: echte Gmail-Anbindung über Provider-Schicht** (Stand 2026-07-05):
  `services/email/emailService.ts` delegiert an den aktiven Provider –
  `providers/gmailProvider.ts` (echte Gmail API v1, OAuth 2.0 + PKCE über
  `auth/gmailOAuth.ts`, Tokens nur in `tokenStore.ts`/SecureStore) oder
  `providers/mockEmailProvider.ts` (In-Memory-Fallback, bewusst erhalten).
  Client-IDs: Platzhalter in `src/config/googleOAuth.ts` (lokal füllen,
  README "Gmail einrichten"). Scope nur `gmail.modify`. OAuth-Test braucht
  einen Development Build (`npx expo run:android`), nicht Expo Go.
- **Browser-Tools: echt** (Stand 2026-07-05) – `browserService.ts` hat eine
  Promise-basierte Script-Bridge (Request-IDs, Timeouts, feste Templates,
  Argumente via JSON.stringify – nie freier Code). Implementiert: `read_page`
  (strukturierter PageSnapshot), `click_element` (Selektor → Text-Fallback),
  `type_text` (Events; verweigert Passwortfelder), `submit_form` (risky!),
  `scroll_page`, `wait_for_page`, `open_url` (risky), `go_back`.
  Stubs: `screenshot_page`, `download_file`. Hinweis: Browser-Tab muss einmal
  geöffnet worden sein, sonst liefern DOM-Tools einen klaren Fehler.
- **Settings:** API-Key (SecureStore, verschlüsselt), Base-URL + Modell
  (AsyncStorage). Client: `services/ai/openaiClient.ts`
  (POST `{baseUrl}/chat/completions`, OpenAI-kompatibel).
- `npm run typecheck` läuft fehlerfrei.

## Wichtige Dateien (in dieser Reihenfolge lesen)

1. `docs/ARCHITECTURE.md` – Gesamtbild + Sicherheitsmodell
2. `src/types/tools.ts` + `src/agent/tools/definitions.ts` – was der Agent kann
3. `src/agent/executor/toolExecutor.ts` – wie Schritte ausgeführt werden
4. `src/agent/planner.ts` – Prompt-Erzeugung und Plan-Validierung
5. `src/screens/AgentScreen.tsx` – UI-Fluss Plan → Review → Ausführung
6. `src/services/email/` – Provider-Schicht: `types.ts` (Interface),
   `emailService.ts` (Dispatch), `providers/`, `auth/gmailOAuth.ts`,
   `tokenStore.ts`
7. `docs/TASKS.md` – was als Nächstes ansteht

## Wie weiterarbeiten

- Konventionen: TypeScript strict, keine neuen Dependencies ohne Eintrag in
  `docs/DECISIONS.md`, Kommentare/Code Englisch, UI-Texte Deutsch.
- Neues Tool hinzufügen = 3 Stellen: Name in `src/types/tools.ts`,
  Definition in `agent/tools/definitions.ts`, Handler in der passenden
  `agent/tools/*Tools.ts`. Der Compiler erzwingt Vollständigkeit
  (Record über die Tool-Namen), der Planner-Prompt aktualisiert sich selbst.
- Mock durch echte Implementierung ersetzen = nur den Service unter
  `src/services/` umbauen; Tool-Handler und UI bleiben stabil.
- Vor jedem Commit: `npm run typecheck`.
- Jede Architekturentscheidung in `docs/DECISIONS.md` dokumentieren,
  erledigte Aufgaben in `docs/TASKS.md` abhaken.

## Nächste Features (Details in docs/TASKS.md)

1. Gmail-Verbindung auf Gerät testen (Client-IDs eintragen, Dev-Build).
2. Agent-Loop V2: Tool-Ergebnisse zurück ans LLM (act → observe → replan) –
   die Browser-Tools liefern dafür bereits strukturierte `data`-Payloads.
3. YouTube-Transcript-Spezialtool (auf read_page/Bridge aufbauend).
4. Chat- und Agent-Verlauf persistieren (AsyncStorage).
5. Full Access Mode (bewusst aktivierbar, nur innerhalb verbundener Dienste).
6. Outlook/Microsoft als zweiter echter Provider (separater Meilenstein).

## Wichtig bei E-Mail-Änderungen

- Agent-Tools und UI reden NUR mit `emailService.ts`, nie direkt mit einem
  Provider oder der Gmail API.
- Tokens bleiben in `tokenStore.ts` (SecureStore) und in
  `gmailProvider.ts`-internen Aufrufen. Kein Interface, kein Tool-Output,
  kein Log darf Tokens enthalten.
- Der Mock-Provider darf nicht entfernt werden (Fallback + Referenz).
- Scope bleibt `gmail.modify`; `https://mail.google.com/` ist tabu.
- Kein Client-Secret einführen – PKCE braucht keines.

## Sicherheitsregeln – dürfen NIE gebrochen werden

1. **Kein direkter Ausführungspfad:** LLM-Output ist immer Daten (JSON-Plan),
   wird nie evaluiert oder als Code ausgeführt.
2. **Bestätigungspflicht bleibt:** `risky: true`-Tools (senden, löschen,
   verbinden, externe URL, Formular, Download) laufen nur über
   `requestConfirmation`. Niemals einen Bypass, kein "Auto-Approve" einbauen.
3. **Fail closed:** Ohne registrierten Bestätigungs-Handler wird abgelehnt.
4. **Sandbox-Grenze:** Jeder Dateipfad geht durch `sanitizeSandboxPath()`.
   Keine Dateizugriffe an `services/storage/sandboxFs.ts` vorbei.
5. **Keine Android-Systemsteuerung:** keine Accessibility-Services, keine
   Intents in fremde Apps, keine zusätzlichen Permissions ohne Nutzer-Diskussion.
6. **Secrets:** API-Keys/Tokens nur in `expo-secure-store`. Nie hardcoden,
   nie loggen, nie in die Datei-Sandbox schreiben.
7. **Browser:** nur `https:`; die URL-Validierung in `browserService.validateUrl`
   nicht aufweichen.
