# Android Agent Sandbox

Eine React-Native/Expo-App, die einen KI-Agenten in einer **kontrollierten Sandbox** ausführt.
Der Agent kann innerhalb der App Dateien verwalten, (Mock-)E-Mails bearbeiten und einen
eingebauten Mini-Browser bedienen – **niemals** das Android-System außerhalb der App.

## Projektidee

- Die App ist ein "Mini-Computer" in der App: Datei-Sandbox, Mock-Postfach, WebView-Browser.
- Ein LLM (beliebige OpenAI-kompatible API) erzeugt aus einer Aufgabe **nur einen JSON-Plan**.
- Ein Tool-Executor führt den Plan Schritt für Schritt aus.
- Riskante Aktionen (E-Mail senden, Datei löschen, externe URL öffnen, Formular abschicken,
  Konto verbinden) erfordern **immer** eine explizite Nutzerbestätigung im Dialog.
- Alle Dateipfade werden validiert; der Agent kann die App-Sandbox nicht verlassen.

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

## Architektur (Kurzfassung)

```
src/
  app/               App-Root + Bottom-Tab-Navigation
  screens/           Chat, Agent, Dateien, E-Mail, Browser, Settings
  components/        MessageBubble, PlanStepCard, ConfirmActionModal, Theme
  agent/
    planner.ts       Aufgabe -> JSON-Plan (LLM), Parsen + Validieren
    tools/           Tool-Registry (Single Source of Truth) + Handler
    executor/        Tool-Executor + Bestätigungs-Bridge (fail closed)
  services/
    ai/              OpenAI-kompatibler Client (POST /chat/completions)
    storage/         Settings (SecureStore/AsyncStorage) + Datei-Sandbox
    email/           Mock-E-Mail-Service (echte Provider kommen später)
    browser/         Command-Bridge zwischen Agent und WebView
  types/             Gemeinsame TypeScript-Typen
  utils/             Pfad-Validierung, JSON-Extraktion
  config/            Konstanten (keine Secrets!)
```

Ablauf im Agentic Mode:
**Aufgabe → Planner (LLM, nur JSON) → Review durch Nutzer → Tool-Executor →
riskante Schritte: Bestätigungsdialog → Ergebnis pro Schritt sichtbar.**

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
4. Keine Steuerung des Android-Systems außerhalb der App.
5. API-Keys niemals im Code – nur verschlüsselt in `expo-secure-store`.
