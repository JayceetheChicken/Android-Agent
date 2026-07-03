# Agent Instructions (Claude Code, OpenAI Codex, etc.)

Kontrollierte KI-Agent-Sandbox als Expo/React-Native-App. Der In-App-Agent darf
nur innerhalb der App arbeiten (Datei-Sandbox, Mock-E-Mail, WebView-Browser) –
niemals das Android-System steuern.

## Zuerst lesen

1. `docs/CODEX_HANDOFF.md` – aktueller Stand + Arbeitsweise
2. `docs/ARCHITECTURE.md` – Struktur und Sicherheitsmodell
3. `docs/TASKS.md` – was als Nächstes zu tun ist

## Regeln

- TypeScript strict; `npm run typecheck` muss vor jedem Commit sauber sein.
- Keine neuen Dependencies ohne Begründung in `docs/DECISIONS.md`.
- Sicherheitsregeln in `docs/CODEX_HANDOFF.md` ("dürfen NIE gebrochen werden")
  sind nicht verhandelbar: JSON-Pläne statt direkter Ausführung,
  Bestätigungspflicht für riskante Tools, Pfad-Validierung, Secrets nur in
  SecureStore.
- Kommentare/Code auf Englisch, UI-Texte auf Deutsch.
- Wichtige Entscheidungen in `docs/DECISIONS.md` dokumentieren,
  erledigte Aufgaben in `docs/TASKS.md` abhaken.

## Expo-Hinweis

Expo SDK 57 – bei API-Fragen die versionierten Docs nutzen:
https://docs.expo.dev/versions/v57.0.0/
(insbesondere expo-file-system: neue klassenbasierte API mit `File`/`Directory`/`Paths`).
