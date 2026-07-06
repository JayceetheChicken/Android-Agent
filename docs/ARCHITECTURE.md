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
  memory/           Lokale modellunabhängige User Memory (AsyncStorage)
  email/            Gmail/Mock-Provider-Schicht
  drive/            Google Drive (OAuth/PKCE, Drive API v3)
  browser/          Command-Bridge zur WebView
```

Grundsatz: **Die UI führt nie selbst Tools aus, der Agent rendert nie UI.**
Beide treffen sich nur im Tool-Executor und in der Bestätigungs-Bridge.

## App-Struktur

| Pfad | Zweck |
| --- | --- |
| `App.tsx` (Root) | Re-Export von `src/main/App.tsx` (Expo-Konvention) |
| `src/main/App.tsx` | NavigationContainer, Theme, SafeArea |
| `src/main/navigation.tsx` | Bottom-Tabs: Chat, Agent, Dateien, Drive, E-Mail, Browser, Settings |
| `src/screens/*` | Ein Screen pro Modul, keine Business-Logik in Screens außer UI-State |
| `src/components/*` | Wiederverwendbare UI: `MessageBubble`, `PlanStepCard`, `ConfirmActionModal`, `theme.ts` |
| `src/types/*` | Alle geteilten Typen; `types/tools.ts` definiert die Tool-Namen als Const-Arrays |
| `src/config/constants.ts` | Konstanten und Limits – **niemals Secrets** |
| `src/utils/paths.ts` | `sanitizeSandboxPath()` – zentrale Pfad-Validierung |

Zusätzlich gehört `src/services/storage/importService.ts` zur Storage-Schicht:
Der Service öffnet den Android-Dateipicker nur durch eine UI-Aktion und kopiert
ausgewählte Gerätedateien als neue Sandbox-Dateien.

`src/services/memory/memoryService.ts` verwaltet eine einzige lokale User
Memory für `local-user`. Sie liegt in AsyncStorage, ist unabhängig vom
ausgewählten Modellanbieter und wird vor Chat- und Agent-Planer-Aufrufen als
zusätzlicher Kontext geladen, wenn sie relevant ist.
`src/services/memory/memoryIntent.ts` erkennt im normalen Chat nur explizite
Merk-/Speicher-Formulierungen lokal und deterministisch; der Chat bekommt
dadurch nicht das komplette Agent-Tool-System.

## Agentic Mode – Agent Loop V2

`AgentScreen` nutzt den **iterativen Agent-Loop** (`src/agent/loop/`):
`plan → act → observe → replan → … → finish`. Der Agent führt nicht mehr einen
großen statischen Plan aus, sondern entscheidet nach jedem Tool-Ergebnis neu.

Ablauf (siehe `src/agent/loop/agentLoop.ts`):

1. **Aufgabe eingeben** – freier Text.
2. **Kontext einmal laden** – `getRelevantMemoryContext(task)` wird **einmal**
   am Anfang geladen; danach treiben die Observations die weiteren Iterationen.
3. **Einen Schritt planen** – `loopPlanner.buildLoopSystemPrompt()` (aus der
   Tool-Registry generiert) + Aufgabe + bisherige Observations. Das Modell gibt
   **genau eine** Entscheidung als JSON zurück:
   `{ "type": "tool", "tool", "params", "reason" }` oder `{ "type": "final", "answer" }`.
4. **Parsen & Validieren** – `parseLoopDecision()` akzeptiert nur bekannte Tools
   bzw. eine nicht-leere finale Antwort. Bei ungültigem JSON gibt es **eine**
   Korrektur-Runde, sonst Fehler. LLM-Output ist immer Daten, nie Code.
5. **Ausführen** – über **denselben** `executeStep()` wie der statische Planer:
   riskante Tools (`open_url`, `submit_form`, `send_email`, …) durchlaufen weiter
   den `ConfirmActionModal` (fail closed).
6. **Beobachten** – das Tool-Ergebnis (`ok`, `output`, `data`) wird als
   Observation gespeichert und im nächsten Prompt kompakt zurückgegeben
   (`buildObservationsMessage`, jede Ausgabe auf ~1800 Zeichen gekürzt, keine
   riesigen JSON-Dumps).
7. **Wiederholen** bis `type: "final"` oder bis `MAX_AGENT_LOOP_STEPS` (12).
   Beim Limit erzeugt der Loop eine **ehrliche** Zwischenantwort aus den
   Observations statt einfach abzubrechen.

Die UI zeigt jedes Tool (Name, Grund, Ergebnis) live und am Ende die finale
Antwort. Der alte statische Planer (`src/agent/planner.ts`, `parsePlan`,
`MAX_PLAN_STEPS`) bleibt als eigenständiges Modul erhalten (u. a. für Tests),
wird von der UI aber nicht mehr genutzt.

### Browser-Verfügbarkeit im Agentic Mode

Der Browser-Tab wird über `lazy: false` (`src/main/navigation.tsx`) **beim
App-Start gemountet**. Damit sind Command-Bus und Script-Bridge sofort bereit –
der Nutzer muss den Browser-Tab nicht erst manuell öffnen. Die WebView läuft
auch im Hintergrund (während der Nutzer auf dem Agent-Tab die Schrittliste
verfolgt); man kann jederzeit auf den Browser-Tab wechseln und zusehen.
`browserService.ensureBrowserReady()` wartet zur Sicherheit kurz auf die
WebView-Initialisierung und liefert sonst eine klare Fehlermeldung, statt
still zu hängen. Weil Bottom-Tabs nach dem Mounten mounted bleiben, funktioniert
auch der `ConfirmActionModal` (von `AgentScreen` gerendert) unabhängig davon,
welcher Tab gerade vorne ist.

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

`delete_file`, `connect_email_account`, `send_email`, `connect_drive_account`,
`drive_download_to_sandbox`, `drive_upload_from_sandbox`, `drive_move_file`,
`drive_create_folder`, `drive_trash_file`, `drive_rename_file`, `open_url`,
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
- **Google Drive als verbundener Dienst:** Der Agent darf nach OAuth-Verbindung
  aktiv Drive-Dateien listen, suchen, herunterladen/exportieren, Sandbox-Dateien
  hochladen, Dateien verschieben, Ordner erstellen, umbenennen und Dateien in
  den Papierkorb legen. Diese Aktionen laufen ausschließlich über die
  Drive-Tools; alle riskanten Drive-Tools bleiben bestätigungspflichtig.
- **User Memory ohne Secrets:** Lokale Memories dürfen keine Passwörter,
  API-Keys, OAuth-Tokens, Bankdaten, Kreditkartendaten oder sehr sensible
  private Informationen enthalten. Der Nutzer kann sie im Settings-Tab sehen
  und löschen.
- **Browser:** nur `https:`-URLs (`validateUrl`), WebView ohne
  Multi-Window-Support.

## User Memory

- Speicherort: AsyncStorage unter `STORAGE_KEYS.userMemory`; Standardnutzer:
  `DEFAULT_USER_ID = 'local-user'`.
- Struktur: `id`, `userId`, `content`, `importance` (1-5), `tags`,
  `createdAt`, `updatedAt`, optional `lastUsedAt`.
- Chat-Speichern: `parseRememberIntent()` akzeptiert klare Formulierungen wie
  `merk dir ...`, `speichere ...`, `remember this ...` und extrahiert den
  zu speichernden Inhalt. Reine Memory-Anweisungen sparen den Modellaufruf;
  gemischte Nachrichten speichern zuerst und schicken nur die verbleibende
  Frage/Aufgabe ans Modell.
- Dedupe/Merge: `addMemoryWithMerge()` berechnet lokale Token-Jaccard-
  Ähnlichkeit nach Normalisierung. Ab `0.85` wird die bestehende Memory
  aktualisiert: `updatedAt`, höhere Wichtigkeit und zusammengeführte Tags.
- Suche: Volltext- und Tag-Suche mit Scoring für exakte Phrase,
  Token-Overlap, Tag-Treffer, Wichtigkeit, Aktualität und `lastUsedAt`. Es
  gibt keine Embeddings und keine Vektordatenbank.
- Kontext: `getRelevantMemoryContext()` liefert maximal 10 relevante oder sehr
  wichtige Memories als Textblock `Local user memory:`. Chat und Agent-Planer
  hängen diesen Block als System-Kontext an den jeweiligen Modellaufruf an.
- Tools: `remember`, `search_memory`, `list_memory`, `forget_memory`.
  `forget_memory` ist `risky: true` und läuft über den Bestätigungsdialog.
- UI: Settings zeigt alle Memories, Tags, Wichtigkeit und IDs; einzelne oder
  alle Memories können gelöscht werden.
- Später möglich: Embeddings/Vektorsuche oder bessere Relevanzbewertung. Das
  ist bewusst nicht Teil der aktuellen einfachen Implementierung.

## Datei-Sandbox

Gerätedateien werden nie direkt bearbeitet. Der Dateien-Tab ruft
`importService.importDeviceFiles()` auf, das `expo-document-picker` mit
`getDocumentAsync({ copyToCacheDirectory: true, multiple: true })` nutzt und
die ausgewählten Dateien in den aktuellen Sandbox-Ordner kopiert.
Originaldateien auf dem Gerät bleiben unverändert.

- Wurzel: `<documentDirectory>/sandbox/` (privater App-Speicher, wird beim
  ersten Zugriff angelegt).
- API: `listEntries`, `readTextFile`, `writeTextFile`, `readBinaryFile`,
  `writeBinaryFile`, `getFileInfo`, `createFolder`, `deleteEntry`,
  `moveEntry`, `renameEntry` – alles in
  `services/storage/sandboxFs.ts`, alles nach Pfad-Validierung.
- Der Dateien-Tab und die Agent-Datei-Tools nutzen exakt dieselbe API, der
  Nutzer sieht also sofort, was der Agent getan hat.
- `sandboxFs.ts` stellt dafür zusätzlich `existsInSandbox()` und
  `copyExternalFileIntoSandbox()` bereit; Zielpfade laufen weiter durch
  `sanitizeSandboxPath()`.
- Bei Namenskollisionen wählt `importService.ts` automatisch einen freien Namen
  wie `datei (1).txt` statt zu überschreiben.
- Drive-Downloads in die Sandbox überschreiben dagegen nicht automatisch:
  `drive_download_to_sandbox` erwartet einen freien Zielpfad und meldet bei
  Kollision einen Fehler. So bleibt der vom Agenten geplante Zielpfad
  eindeutig und der Nutzer sieht unerwartete Konflikte.
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

## Google-Drive-Schicht (implementiert)

```
Agent-Tool (driveTools.ts)          DriveScreen
        │                                │
        └────────────┬───────────────────┘
                     ▼
        services/drive/driveService.ts   ← einziger Einstiegspunkt
                     │
                     ▼
        providers/googleDriveProvider.ts
          ├── services/google/oauth.ts   (OAuth 2.0 + PKCE)
          ├── services/drive/tokenStore.ts (Tokens NUR SecureStore)
          └── services/storage/sandboxFs.ts (validierte Sandbox-Transfers)
```

- **Scope:** `https://www.googleapis.com/auth/drive`. Das ist bewusst breit:
  Der Agent darf nach Nutzerverbindung bestehende Drive-Dateien verwalten, nicht
  nur App-eigene Dateien.
- **Tools:** `connect_drive_account`, `drive_get_status`, `drive_list_files`,
  `drive_search_files`, `drive_download_to_sandbox`,
  `drive_upload_from_sandbox`, `drive_move_file`, `drive_create_folder`,
  `drive_trash_file`, `drive_rename_file`.
- **Bestätigung:** Alle Drive-Aktionen mit Außenwirkung oder Datenänderung sind
  `risky: true` und laufen über `ConfirmActionModal`. `risky` bedeutet hier
  Freigabe durch den Nutzer, kein Verbot.
- **Tokens:** Drive-Tokens liegen separat von Gmail in
  `services/drive/tokenStore.ts` und verlassen den Provider nicht. Tool-Outputs
  enthalten nur Metadaten wie ID, Name, MIME-Type, Größe, Parents und
  Papierkorbstatus.
- **Download:** Normale Dateien laufen über `files.get?alt=media`; Google
  Docs/Sheets/Slides über `files.export` (Standard `application/pdf`, optional
  überschreibbar). Zielpfade gehen durch `sandboxFs.writeBinaryFile()` und
  dürfen nicht existieren.
- **Upload:** `drive_upload_from_sandbox` liest ausschließlich über
  `sandboxFs.readBinaryFile()` aus `<documentDirectory>/sandbox/` und nutzt den
  Drive-Multipart-Upload-Endpunkt.
- **Verschieben:** `drive_move_file` liest zuerst die aktuellen Parents und
  nutzt `files.update` mit `addParents` und `removeParents`.
- **Papierkorb:** `drive_trash_file` setzt nur `trashed: true`; permanentes
  Löschen ist nicht Teil des MVP.

## Browser-Control-Layer (implementiert)

`services/browser/browserService.ts` hat drei Kanäle:

1. **Command-Bus** (`open_url`, `go_back`): fire-and-forget; der Browser-Tab
   abonniert und wendet die Kommandos auf seine WebView an.
2. **Native WebView-State:** `BrowserScreen` meldet `onLoadStart`,
   `onLoadEnd`, `onError`, `onHttpError`, `onNavigationStateChange` und
   geblockte Navigation in den Service. `wait_for_page` und
   `browser_get_state` lesen diesen State ohne JavaScript-Injection und
   koennen deshalb auch waehrend langer Ladevorgaenge antworten.
3. **Script-Bridge** (Promise-basiert): `executeScript()` erzeugt pro Befehl
   eine eindeutige Request-ID, baut aus **festen Skript-Templates** das
   Seiten-Skript, der Screen injiziert es per `injectJavaScript`, die Seite
   antwortet über `window.ReactNativeWebView.postMessage`, und
   `handleBridgeMessage()` löst das passende Promise auf. Fehler in der Seite
   werden als abgelehnte Promises propagiert; Timeouts (6–10 s) fangen den
   Fall ab, dass die Seite navigiert, bevor sie antwortet.

Darauf implementiert: `readPage()` als leichter DOM-Extractor (kein
`document.body.innerText`, sichtbarer Text max. 6000 Zeichen, Meta-Description
und Links als Fallback, Headings max. 30, Links max. 40, Buttons/Inputs max. 30),
`clickElement()` (CSS-Selektor, Fallback sichtbarer Text), `typeText()`
(input/change-Events, **verweigert Passwortfelder**), `submitForm()`
(requestSubmit, Fallback Enter-Key; Tool bleibt bestätigungspflichtig),
`scrollPage()`, `waitForPage()` (native State, keine JS-Injection),
`browser_get_state`, `stop_loading` und `fetch_current_page_text`.
`fetch_current_page_text` ist der robuste Fallback, wenn die WebView-DOM-
Bridge bei grossen/dynamischen Seiten nicht antwortet: Es nimmt nur die
aktuelle `https:`-URL aus dem Browser-State, laedt sie per HTTP `fetch` mit
HTML-Accept-Headern und extrahiert ohne Dependency Titel, Meta-Description,
H1-H3, bis zu 40 Links und groben Text aus dem HTML. Es ersetzt `read_page`
nicht, sondern liefert Teildaten, wenn DOM-Injection zu langsam ist.

Sicherheitsgrenzen des Browsers:
- Die WebView ist der einzige Ort, an dem DOM-Aktionen laufen; Agent-Tools
  kennen weder Ref noch Screen. Es wird nie freier (LLM- oder Nutzer-)Code
  injiziert – nur die festen Templates, Argumente via `JSON.stringify`.
- `open_url` (externe Seite) und `submit_form` (rechtlich/sicherheitsrelevant:
  Logins, Käufe, Kündigungen) bleiben `risky` → ConfirmActionModal.
- Kein Auto-Ausfüllen von Passwortfeldern oder secret-artigen Strings
  (`type_text` bricht ab).
- `BrowserScreen` nutzt `onShouldStartLoadWithRequest` mit
  `browserService.validateNavigationUrl()`. Erlaubt sind nur `https:` und das
  interne `about:blank`; `javascript:`, `file:`, `intent:`, `market:`, `tel:`,
  `mailto:` usw. werden geblockt. Die letzte geblockte URL wird im UI und über
  `wait_for_page` sichtbar, damit der Agent nicht blind weiterplant.

Noch offen (siehe TASKS.md):
- `screenshot_page`: `react-native-view-shot` (neue Dependency, erst dann
  hinzufügen, wenn wirklich gebraucht – siehe DECISIONS.md).
- `download_file`: `File.downloadFileAsync` aus `expo-file-system`,
  Ziel **immer** über `sanitizeSandboxPath` validieren.
- YouTube-Transcript-Spezialtool (auf `read_page`/Bridge aufbauend).
- Domain-Allowlist/Blocklist über `https:` hinaus.
