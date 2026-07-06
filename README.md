# Android Agent Sandbox

Eine React-Native/Expo-App, die einen KI-Agenten in einer **kontrollierten Sandbox** ausführt.
Der Agent kann innerhalb der App Dateien verwalten, (Mock-)E-Mails bearbeiten und einen
eingebauten Mini-Browser bedienen – **niemals** das Android-System außerhalb der App.

## Projektidee

- Die App ist ein "Mini-Computer" in der App: Datei-Sandbox, Gmail/Mock-E-Mail,
  Google Drive, WebView-Browser.
- Ein LLM (beliebige OpenAI-kompatible API) entscheidet im Agent-Loop jeweils
  **einen** JSON-Schritt oder eine finale Antwort.
- Ein Tool-Executor führt jeden Schritt aus; das Ergebnis geht als Observation
  zurück ans Modell, danach wird neu geplant.
- Riskante Aktionen (E-Mail senden, Datei löschen, Drive-Dateien hoch-/
  herunterladen, verschieben oder in den Papierkorb legen, externe URL öffnen,
  Formular abschicken, Konto verbinden) erfordern **immer** eine explizite
  Nutzerbestätigung im Dialog.
- Alle Dateipfade werden validiert; der Agent kann die App-Sandbox nicht verlassen.
- User Memory wird lokal in der App gespeichert und ist unabhängig vom jeweils
  ausgewählten KI-Modell.

Details: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) · Entscheidungen: [docs/DECISIONS.md](docs/DECISIONS.md) · Aufgaben: [docs/TASKS.md](docs/TASKS.md) · Handoff für KI-Tools: [docs/CODEX_HANDOFF.md](docs/CODEX_HANDOFF.md)

## Setup

Voraussetzungen: Node.js ≥ 20, npm, ein Android-Gerät mit [Expo Go](https://expo.dev/go)
oder ein Android-Emulator.

```bash
npm install
```

## Starten

```bash
npm start          # Expo Dev Server (QR-Code mit Expo Go scannen)
npm run android    # direkt auf Android-Gerät/-Emulator starten
npm run typecheck  # TypeScript prüfen (strict, muss immer sauber sein)
```

Danach in der App unter **Settings** eintragen:

- **API-Key** – wird verschlüsselt via `expo-secure-store` gespeichert
- **Base-URL** – z. B. `https://api.openai.com/v1` (jede OpenAI-kompatible API funktioniert)
- **Modellname** – z. B. `gpt-4o-mini`

## User Memory

Die App speichert eine einfache lokale **User Memory** in AsyncStorage. Diese
Memory gehört der App, nicht OpenAI, DeepSeek oder einem lokalen Modell. Wenn
du das Modell wechselst, kann der neue Anbieter dieselbe lokale Memory als
Kontext nutzen.

- Es gibt bewusst nur eine User Memory für `local-user` - keine Project Memory
  und keine Session Memory.
- Chat und Agent-Planer laden vor jedem Modellaufruf bis zu 10 relevante oder
  sehr wichtige Memories und geben sie als zusätzlichen Kontext an das Modell.
- Der normale Chat erkennt klare lokale Merk-Anweisungen wie `merk dir ...`,
  `bitte merk dir: ...` oder `remember this: ...` und speichert sie ohne
  Agent-Tool-Ausführung.
- Fast identische Memories werden per lokaler Token-Ähnlichkeit erkannt und
  zusammengeführt statt doppelt gespeichert.
- Die Relevanzsuche nutzt weiterhin keine Embeddings, bewertet aber Phrase,
  Token-Overlap, Tags, Wichtigkeit, Aktualität und `lastUsedAt`.
- Der Agent kann über `remember`, `search_memory`, `list_memory` und
  `forget_memory` mit der Memory arbeiten; `forget_memory` ist
  bestätigungspflichtig.
- Im Settings-Tab kann der Nutzer Memories einsehen und einzelne oder alle
  Memories löschen.
- Keine Secrets speichern: keine Passwörter, API-Keys, OAuth-Tokens,
  Bankdaten oder Kreditkartendaten.
- Embeddings/Vektorsuche sind eine mögliche spätere Erweiterung, aber aktuell
  nicht Teil der Implementierung.

## Agent Loop V2 und Browser

Der Agent-Tab nutzt jetzt einen iterativen Loop:
`plan -> act -> observe -> replan -> finish`. Nach jedem Tool-Aufruf wird das
Tool-Ergebnis kompakt in den nächsten Modellkontext gegeben. Browser-Aufgaben
können dadurch öffnen, warten, lesen, klicken, wieder lesen und dann neu
entscheiden, statt nur einen statischen Plan abzuarbeiten.

Der Browser ist ausschließlich die interne WebView der App. Der Browser-Tab wird
beim App-Start gemountet, damit Agent-Tools ohne manuellen Tab-Wechsel
funktionieren. Die WebView-Navigation erlaubt nur `https:` und internes
`about:blank`; `javascript:`, `file:`, `intent:`, `market:`, `tel:`, `mailto:`
und ähnliche Schemes werden blockiert. `screenshot_page` und `download_file`
sind weiterhin bewusst nicht umgesetzt.

## Gmail einrichten (OAuth 2.0 mit PKCE)

Die Gmail-Verbindung nutzt **kein Passwort und keinen API-Key**, sondern
OAuth 2.0 mit PKCE: Der Login passiert auf Googles eigener Seite im
System-Browser, die App erhält nur Tokens und speichert sie verschlüsselt in
`expo-secure-store`. Es gibt **kein Client-Secret** – der PKCE-Flow für
installierte Apps braucht keines.

### 1. Google Cloud Console konfigurieren

Auf https://console.cloud.google.com:

1. **Projekt anlegen** (oder bestehendes auswählen).
2. **Gmail API aktivieren:** APIs & Services → Library → „Gmail API" → Enable.
3. **OAuth-Zustimmungsbildschirm:** APIs & Services → OAuth consent screen →
   User Type **External** → App-Name/E-Mail ausfüllen → unter **Test users**
   die eigene Gmail-Adresse hinzufügen.
   *Hinweis: Solange die App im Status „Testing" ist, können sich nur
   Test-User anmelden und Refresh-Tokens laufen nach 7 Tagen ab – für die
   Entwicklung ausreichend.*
4. **Client-IDs anlegen:** APIs & Services → Credentials → Create Credentials
   → OAuth client ID:
   - Typ **Android** → Package name: `com.androidagent.sandbox` (aus
     `app.json`), SHA-1 des Debug-Keys (siehe unten) → ergibt die
     **androidClientId**
   - optional Typ **iOS** (Bundle-ID) → **iosClientId**
   - optional Typ **Web** → **webClientId**

SHA-1 des Debug-Keystores ermitteln (nach dem ersten `npx expo run:android`
oder mit dem Standard-Android-Debug-Key):

```bash
keytool -list -v -keystore %USERPROFILE%\.android\debug.keystore -alias androiddebugkey -storepass android
```

### 2. Client-IDs in der App eintragen

In `src/config/googleOAuth.ts`:

```ts
export const GOOGLE_OAUTH_CONFIG = {
  webClientId: '',
  androidClientId: '1234567890-abc123.apps.googleusercontent.com', // deine ID
  iosClientId: '',
};
```

Scope: Es wird nur `https://www.googleapis.com/auth/gmail.modify` angefragt
(lesen, Entwürfe, senden, archivieren, labeln). Der Vollzugriff-Scope
`https://mail.google.com/` wird bewusst **nicht** verwendet.

### 3. Development Build starten (wichtig!)

Der OAuth-Redirect nutzt das App-Scheme `androidagent` – das funktioniert
**nicht in Expo Go** (Expo Go hat sein eigenes Scheme, Google akzeptiert
keine `exp://`-Redirects). Zum Testen der Gmail-Verbindung daher einen
Development Build verwenden:

```bash
npx expo run:android   # baut die App nativ (Android Studio/SDK nötig)
```

Alles andere (Chat, Agent, Datei-Sandbox, Mock-E-Mail, Browser) funktioniert
weiterhin auch in Expo Go.

### 4. In der App verbinden

E-Mail-Tab → **„Gmail verbinden"** → Google-Login im Browser → fertig.
Der Status zeigt das verbundene Konto; „Test: Inbox suchen" lädt echte
E-Mails. **„Gmail trennen"** widerruft den Zugriff und löscht die Tokens.

## Google Drive einrichten (OAuth 2.0 mit PKCE)

Die Drive-Verbindung nutzt dieselben Google OAuth-Client-IDs wie Gmail, aber
einen eigenen TokenStore und den Scope `https://www.googleapis.com/auth/drive`.
Dieser Scope gibt vollen Zugriff auf Google Drive: Dateien listen, suchen,
herunterladen/exportieren, Sandbox-Dateien hochladen, verschieben, Ordner
erstellen, umbenennen und in den Papierkorb legen. Das ist für private
Test-Apps gewollt; für eine öffentliche Veröffentlichung ist der Scope
restricted und in der Regel verifizierungspflichtig.

In der Google Cloud Console:

1. **Google Drive API aktivieren:** APIs & Services -> Library -> "Google Drive API" -> Enable.
2. **OAuth Consent Screen:** Den Scope
   `https://www.googleapis.com/auth/drive` hinzufügen und die eigene Adresse
   als Test-User eintragen.
3. **Client-IDs:** Die Werte in `src/config/googleOAuth.ts` werden gemeinsam
   von Gmail und Drive genutzt. Kein Client-Secret eintragen.

Zum Testen braucht auch Drive wegen des App-Schemes `androidagent` einen
Development Build (`npx expo run:android`). Danach im **Drive**-Tab
**"Drive verbinden"** tippen und mit **"Root-Dateien laden"** prüfen.

## Architektur (Kurzfassung)

```
src/
  main/              App-Root + Bottom-Tab-Navigation
  screens/           Chat, Agent, Dateien, E-Mail, Browser, Settings
  components/        MessageBubble, PlanStepCard, ConfirmActionModal, Theme
  agent/
    loop/            Agent Loop V2: plan -> act -> observe -> replan (aktiv)
    planner.ts       Statischer JSON-Planer (eigenständig, nicht in der UI)
    tools/           Tool-Registry (Single Source of Truth) + Handler
    executor/        Tool-Executor + Bestätigungs-Bridge (fail closed)
  services/
    ai/              OpenAI-kompatibler Client (POST /chat/completions)
    storage/         Settings (SecureStore/AsyncStorage) + Datei-Sandbox
    memory/          Lokale modellunabhängige User Memory (AsyncStorage)
    email/           Provider-Schicht: Gmail (OAuth/PKCE) + Mock-Fallback
    drive/           Google Drive (OAuth/PKCE), Drive API v3, Sandbox-Transfer
    browser/         Script-Bridge + Browser-Steuerung (WebView, nur https)
  types/             Gemeinsame TypeScript-Typen
  utils/             Pfad-Validierung, JSON-Extraktion
  config/            Konstanten (keine Secrets!)
```

Ablauf im Agentic Mode:
**Aufgabe -> Agent Loop (LLM, nur JSON-Entscheidungen) -> Tool-Executor ->
Observation zurück ans Modell -> Replan -> finale Antwort.** Riskante Schritte
laufen weiterhin über den Bestätigungsdialog.

## GitHub einrichten (manuell)

Die GitHub CLI (`gh`) war beim Setup nicht installiert, deshalb wurde noch kein
Remote-Repository angelegt. So verbindest du das Projekt manuell:

```bash
# Variante A: mit GitHub CLI (empfohlen)
winget install GitHub.cli     # einmalig installieren, dann Terminal neu öffnen
gh auth login                 # bei GitHub anmelden
gh repo create android-agent-sandbox --private --source=. --remote=origin --push

# Variante B: ohne GitHub CLI
# 1. Auf https://github.com/new ein leeres Repo "android-agent-sandbox" anlegen (ohne README)
# 2. Dann:
git remote add origin https://github.com/<DEIN_USERNAME>/android-agent-sandbox.git
git branch -M main
git push -u origin main
```

## Sicherheitsregeln (nicht verhandelbar)

1. Der Agent erzeugt nur JSON-Pläne, nie direkt ausgeführten Code.
2. Riskante Tools laufen nur nach expliziter Nutzerbestätigung (`ConfirmActionModal`).
3. Alle Dateioperationen bleiben in `<documentDirectory>/sandbox/` (Pfad-Validierung).
4. Google Drive ist ein verbundener Dienst: Zugriff nur über die Drive-Tools,
   Tokens nur in `expo-secure-store`, riskante Aktionen mit Bestätigung.
5. Keine Steuerung des Android-Systems außerhalb der App.
6. API-Keys niemals im Code – nur verschlüsselt in `expo-secure-store`.
7. User Memory darf keine Secrets oder sehr sensiblen privaten Informationen enthalten.
