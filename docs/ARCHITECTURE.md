# Architektur

## Überblick

Die App ist eine kontrollierte Sandbox für einen KI-Agenten. Drei Schichten:

```
UI (screens/, components/)
        │  zeigt Pläne, Ergebnisse, Bestätigungsdialoge
        ▼
Agent (agent/)
  planner.ts        Aufgabe -> JSON-Plan (LLM-Aufruf, Parsen, Validieren)
  tools/            Tool-Registry + Handler (Dateien real, E-Mail/Browser teils Mock)
  executor/         Führt Plan-Schritte aus, erzwingt Bestätigungen
        │  ruft ausschließlich Services auf
        ▼
Services (services/)
  ai/openaiClient   POST {baseUrl}/chat/completions
  storage/          SecureStore (API-Key), AsyncStorage (Settings), Datei-Sandbox, Import
  email/            Mock-Postfach (API-kompatibel zu späterer echter Integration)
  browser/          Command-Bridge zur WebView
```

Grundsatz: **Die UI führt nie selbst Tools aus, der Agent rendert nie UI.**
Beide treffen sich nur im Tool-Executor und in der Bestätigungs-Bridge.

## App-Struktur

| Pfad | Zweck |
| --- | --- |
| `App.tsx` (Root) | Re-Export von `src/main/App.tsx` (Expo-Konvention) |
| `src/main/App.tsx` | NavigationContainer, Theme, SafeArea |
| `src/main/navigation.tsx` | Bottom-Tabs: Chat, Agent, Dateien, E-Mail, Browser, Settings |
| `src/screens/*` | Ein Screen pro Modul, keine Business-Logik in Screens außer UI-State |
| `src/components/*` | Wiederverwendbare UI: `MessageBubble`, `PlanStepCard`, `ConfirmActionModal`, `theme.ts` |
| `src/types/*` | Alle geteilten Typen; `types/tools.ts` definiert die Tool-Namen als Const-Arrays |
| `src/config/constants.ts` | Konstanten und Limits – **niemals Secrets** |
| `src/utils/paths.ts` | `sanitizeSandboxPath()` – zentrale Pfad-Validierung |

Zusätzlich gehört `src/services/storage/importService.ts` zur Storage-Schicht:
Der Service öffnet den Android-Dateipicker nur durch eine UI-Aktion und kopiert
ausgewählte Gerätedateien als neue Sandbox-Dateien.

## Agentic Mode

Ablauf (siehe `src/screens/AgentScreen.tsx`):

1. **Aufgabe eingeben** – freier Text.
2. **Planen** – `agent/planner.ts` schickt System-Prompt + Aufgabe an die API.
   Der System-Prompt wird aus der Tool-Registry generiert (`describeTools()`),
   dadurch können Prompt und Executor nie auseinanderlaufen.
3. **Parsen & Validieren** – `parsePlan()` akzeptiert nur:
   - ein JSON-Objekt mit `goal: string` und `steps: []`
   - bekannte Tool-Namen (`isToolName`)
   - maximal `MAX_PLAN_STEPS` (10) Schritte
   Alles andere wird mit Fehlermeldung abgelehnt – **nichts wird ausgeführt**.
4. **Review** – der Nutzer sieht alle Schritte (Tool, Parameter, Begründung)
   und startet die Ausführung explizit.
5. **Ausführung** – Schritt für Schritt über den Tool-Executor; Status und
   Ergebnis jedes Schritts sind live sichtbar.

## Tool-Executor

`src/agent/executor/toolExecutor.ts` ist die **einzige** Stelle, an der ein
Plan-Schritt zu einer echten Aktion wird. Garantien:

1. Unbekannte Tools werden abgelehnt.
2. Tools mit `risky: true` (aus `agent/tools/definitions.ts`) durchlaufen
   **immer** `requestConfirmation()`. Ist kein UI-Handler registriert,
   wird abgelehnt (**fail closed**), nie stillschweigend ausgeführt.
3. Exceptions aus Handlern werden zu `{ ok: false }`-Ergebnissen – ein
   kaputter Schritt crasht nie die App.

Die Bestätigungs-Bridge (`executor/confirmation.ts`) entkoppelt Executor und
UI: `AgentScreen` registriert beim Mounten einen Handler, der das
`ConfirmActionModal` öffnet und ein Promise mit der Nutzerentscheidung auflöst.

### Riskante Tools (Stand jetzt)

`delete_file`, `connect_email_account`, `send_email`, `open_url`,
`submit_form`, `download_file`.

## Sicherheitsmodell

- **Pläne sind Daten, kein Code.** Die LLM-Antwort wird geparst und validiert,
  nie evaluiert.
- **Capability-basiert:** Der Agent kann nur, was als Tool registriert ist.
  Es gibt keinen generischen "führe Code aus"-Pfad.
- **Bestätigungspflicht** für alles, was nach außen wirkt oder zerstört
  (senden, löschen, verbinden, externe Seiten, Formulare, Downloads).
- **Sandbox-Grenze:** `sanitizeSandboxPath()` verbietet absolute Pfade,
  Laufwerksbuchstaben, URI-Schemata und `..`-Segmente. Alle Dateizugriffe
  laufen durch `services/storage/sandboxFs.ts`, das ausschließlich unter
  `<documentDirectory>/sandbox/` arbeitet.
- **Kein System-Zugriff:** Es sind keine Android-Permissions für Kontakte,
  SMS, Accessibility o. Ä. konfiguriert; die App nutzt nur ihren privaten
  Speicher und Netzwerkzugriff.
- **Secrets:** API-Key nur in `expo-secure-store` (verschlüsselter Keystore),
  nie in Code, Config, Logs oder der Datei-Sandbox.
- **Browser:** nur `https:`-URLs (`validateUrl`), WebView ohne
  Multi-Window-Support.

## Datei-Sandbox

Gerätedateien werden nie direkt bearbeitet. Der Dateien-Tab ruft
`importService.importDeviceFiles()` auf, das `expo-document-picker` mit
`getDocumentAsync({ copyToCacheDirectory: true, multiple: true })` nutzt und
die ausgewählten Dateien in den aktuellen Sandbox-Ordner kopiert.
Originaldateien auf dem Gerät bleiben unverändert.

- Wurzel: `<documentDirectory>/sandbox/` (privater App-Speicher, wird beim
  ersten Zugriff angelegt).
- API: `listEntries`, `readTextFile`, `writeTextFile`, `createFolder`,
  `deleteEntry`, `moveEntry`, `renameEntry` – alles in
  `services/storage/sandboxFs.ts`, alles nach Pfad-Validierung.
- Der Dateien-Tab und die Agent-Datei-Tools nutzen exakt dieselbe API, der
  Nutzer sieht also sofort, was der Agent getan hat.
- `sandboxFs.ts` stellt dafür zusätzlich `existsInSandbox()` und
  `copyExternalFileIntoSandbox()` bereit; Zielpfade laufen weiter durch
  `sanitizeSandboxPath()`.
- Bei Namenskollisionen wählt `importService.ts` automatisch einen freien Namen
  wie `datei (1).txt` statt zu überschreiben.
- Der Agent bekommt kein Tool, um den Android-Speicher zu durchsuchen oder den
  Picker automatisch zu öffnen. Nach dem Import arbeitet er ausschließlich mit
  der Sandbox-Kopie.
- Später kann ein Export zurück in Downloads ergänzt werden.

## E-Mail-Provider-Schicht (implementiert)

```
Agent-Tool (emailTools.ts)          EmailScreen
        │                                │
        └────────────┬───────────────────┘
                     ▼
        services/email/emailService.ts     ← einziger Einstiegspunkt
                     │  (aktiver Provider)
        ┌────────────┴────────────┐
        ▼                         ▼
  providers/gmailProvider   providers/mockEmailProvider
        │                         (In-Memory-Fallback/Test)
        ├── auth/gmailOAuth.ts    (OAuth 2.0 + PKCE, expo-auth-session)
        └── tokenStore.ts         (Tokens NUR in SecureStore)
```

- **Interface:** `services/email/types.ts` definiert `EmailProvider`
  (connect/disconnect/isConnected/search/read/draft/reply/send/archive/label).
  Neue Provider (Outlook, IMAP-über-Proxy) implementieren dasselbe Interface;
  Tools und UI bleiben unverändert.
- **Umschalten:** `emailService.ts` hält den aktiven Provider. Beim App-Start
  stellt `initEmailService()` Gmail wieder her, wenn Tokens existieren; sonst
  ist der Mock aktiv. `connectGmail()`/`disconnectGmail()` wechseln explizit.
- **Mock bleibt:** Der Mock-Provider ist bewusst erhalten – Tests ohne echte
  Zugangsdaten und Referenz-Implementierung des Interfaces.

### Gmail OAuth (PKCE)

- Flow: `AuthRequest` (expo-auth-session) mit `usePKCE: true` →
  Google-Login im System-Browser (expo-web-browser) → Authorization Code →
  `exchangeCodeAsync` mit `code_verifier` → Access- + Refresh-Token.
- **Kein Client-Secret** (PKCE für installierte Apps braucht keines),
  **kein Passwort-Handling** (Login nur auf Google-Seiten), **kein API-Key**.
- `access_type=offline` + `prompt=consent` liefern einen Refresh-Token;
  `gmailProvider` erneuert Access-Tokens automatisch (60 s vor Ablauf sowie
  einmaliger Retry bei HTTP 401).
- Scope: nur `gmail.modify`. `https://mail.google.com/` (Vollzugriff inkl.
  endgültigem Löschen) ist bewusst ausgeschlossen (docs/DECISIONS.md).
- Client-IDs kommen aus `src/config/googleOAuth.ts` (Platzhalter, lokal
  füllen); Redirect über das App-Scheme `androidagent` (app.json). Testen
  erfordert einen Development Build – Expo Go kann keine eigenen Schemes.

### Warum der Agent Tokens nie sieht

Tokens existieren ausschließlich in `tokenStore.ts` (SecureStore) und werden
nur innerhalb von `gmailProvider.ts` an `fetch` übergeben. Das
`EmailProvider`-Interface gibt ausschließlich `EmailMessage`/`EmailDraft`/
`EmailAccount`-Daten zurück – es gibt keinen Codepfad, über den ein Plan,
ein Tool-Ergebnis oder das LLM an Tokens gelangen kann. Tool-Outputs
enthalten nur Mail-Metadaten/-Inhalte, nie Credentials.

### Sicherheits-Modi (geplant)

- **Safe Mode (heute, Default):** riskante E-Mail-Aktionen (`send_email`,
  `connect_email_account`) erfordern Einzelbestätigung im Dialog.
- **Full Access Mode (geplant, siehe TASKS.md):** Nach bewusster Aktivierung
  darf der Agent innerhalb *verbundener Dienste* ohne Einzelbestätigung
  handeln (Gmail senden/archivieren/labeln). Grenzen bleiben: kein
  Android-Systemzugriff, Sandbox-Pfadvalidierung, https-only-Browser.
  Noch nicht implementiert – aktuell bestätigt jede riskante Aktion
  (TODO-Anker in `toolExecutor.ts`).

## Browser-Control-Layer (implementiert)

`services/browser/browserService.ts` hat zwei Kanäle:

1. **Command-Bus** (`open_url`, `go_back`): fire-and-forget; der Browser-Tab
   abonniert und wendet die Kommandos auf seine WebView an.
2. **Script-Bridge** (Promise-basiert): `executeScript()` erzeugt pro Befehl
   eine eindeutige Request-ID, baut aus **festen Skript-Templates** das
   Seiten-Skript, der Screen injiziert es per `injectJavaScript`, die Seite
   antwortet über `window.ReactNativeWebView.postMessage`, und
   `handleBridgeMessage()` löst das passende Promise auf. Fehler in der Seite
   werden als abgelehnte Promises propagiert; Timeouts (6–10 s) fangen den
   Fall ab, dass die Seite navigiert, bevor sie antwortet.

Darauf implementiert: `readPage()` (sichtbarer Text max. 6000 Zeichen,
Headings/Links/Buttons/Inputs je max. 50, unsichtbare Elemente gefiltert),
`clickElement()` (CSS-Selektor, Fallback sichtbarer Text), `typeText()`
(input/change-Events, **verweigert Passwortfelder**), `submitForm()`
(requestSubmit, Fallback Enter-Key; Tool bleibt bestätigungspflichtig),
`scrollPage()`, `waitForPage()`.

Sicherheitsgrenzen des Browsers:
- Die WebView ist der einzige Ort, an dem DOM-Aktionen laufen; Agent-Tools
  kennen weder Ref noch Screen. Es wird nie freier (LLM- oder Nutzer-)Code
  injiziert – nur die festen Templates, Argumente via `JSON.stringify`.
- `open_url` (externe Seite) und `submit_form` (rechtlich/sicherheitsrelevant:
  Logins, Käufe, Kündigungen) bleiben `risky` → ConfirmActionModal.
- Kein Auto-Ausfüllen von Passwortfeldern (`type_text` bricht ab).

Noch offen (siehe TASKS.md):
- `screenshot_page`: `react-native-view-shot` (neue Dependency, erst dann
  hinzufügen, wenn wirklich gebraucht – siehe DECISIONS.md).
- `download_file`: `File.downloadFileAsync` aus `expo-file-system`,
  Ziel **immer** über `sanitizeSandboxPath` validieren.
- Agent-Loop V2 (`act → observe → replan`) setzt auf `read_page`/
  `wait_for_page` auf; die Tool-Ergebnisse sind dafür bereits strukturiert
  (`data`-Feld mit `PageSnapshot`).
