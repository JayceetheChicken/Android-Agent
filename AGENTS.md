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

Expo SDK 56 – bei API-Fragen die versionierten Docs nutzen:
https://docs.expo.dev/versions/v56.0.0/
(insbesondere expo-file-system: neue klassenbasierte API mit `File`/`Directory`/`Paths`).

**Warum SDK 56 und nicht 57:** SDK 57 war zum Zeitpunkt des Projektstarts (2026-07-03)
gerade erst auf npm veröffentlicht; die Expo-Go-App im Play Store hatte den Rollout
noch nicht nachgezogen ("Project is incompatible with this version of Expo Go").
SDK 56 ist stabil etabliert und mit der aktuell installierbaren Expo-Go-App kompatibel.
Vor einem Upgrade auf SDK 57 (oder neuer) prüfen, ob Expo Go im Play Store das SDK
bereits unterstützt.
