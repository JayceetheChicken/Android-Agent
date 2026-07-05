# Architekturentscheidungen (ADR-Light)

Jede wichtige Entscheidung wird hier festgehalten: Kontext → Entscheidung → Begründung.
Neue Einträge unten anhängen, alte nie löschen (höchstens als "überholt" markieren).

---

## 1. Agent erzeugt nur JSON-Pläne (2026-07-03)

**Entscheidung:** Das LLM liefert ausschließlich einen JSON-Plan
(`{ goal, steps: [{ tool, params, reason }] }`). Ausführung passiert getrennt im Tool-Executor.

**Warum:**
- LLM-Output ist damit *Daten*, nie Code – kein `eval`, keine Prompt-Injection,
  die direkt Aktionen auslöst.
- Der Nutzer kann den kompletten Plan **vor** der Ausführung prüfen (Review-Phase).
- Pläne sind validierbar (bekannte Tools, Schritt-Limit) und deterministisch abarbeitbar.
- Einfach zu debuggen und zu testen (Plan-Parsing ist eine pure Function).

## 2. Riskante Aktionen brauchen Nutzerbestätigung (2026-07-03)

**Entscheidung:** Tools mit Außenwirkung oder Datenverlust (`send_email`,
`submit_form`, `delete_file`, `connect_email_account`, `open_url`,
`download_file`) tragen `risky: true` und laufen immer durch `requestConfirmation`.
Ohne registrierten UI-Handler wird abgelehnt (fail closed).

**Warum:**
- LLMs halluzinieren und sind über Web-/Mail-Inhalte manipulierbar
  (Prompt Injection). Die letzte Entscheidung über irreversible oder nach
  außen sichtbare Aktionen muss beim Menschen liegen.
- Fail closed statt fail open: Ein Programmierfehler (vergessener Handler)
  darf nie zu unbeaufsichtigter Ausführung führen.

## 3. Agent arbeitet nur in der App-Sandbox (2026-07-03)

**Entscheidung:** Alle Dateioperationen laufen über `sandboxFs.ts` und sind auf
`<documentDirectory>/sandbox/` beschränkt; `sanitizeSandboxPath()` blockt
absolute Pfade, Laufwerksbuchstaben, URI-Schemata und `..`. Keine
Android-Systemsteuerung (keine Accessibility-Services, keine fremden Intents).

**Warum:**
- Die App soll ein kontrollierter "Mini-Computer" sein, kein Autopilot für das
  Gerät. Schadenspotenzial ist damit strukturell begrenzt, nicht nur per Prompt.
- Path-Traversal ist die naheliegendste Angriffs-/Fehlerklasse bei
  LLM-generierten Pfaden – zentrale Validierung an einer Stelle statt in jedem Tool.

## 4. Tool-Registry als Single Source of Truth (2026-07-03)

**Entscheidung:** `agent/tools/definitions.ts` definiert alle Tools inkl.
Beschreibung, Parametern und `risky`-Flag. Der Planner-System-Prompt wird
daraus generiert; die Handler-Records sind über die Tool-Namen typisiert.

**Warum:** Prompt, Executor und UI können nicht auseinanderlaufen. Ein neues
Tool ohne Handler ist ein Compile-Fehler, ein Tool außerhalb der Registry wird
vom Parser abgelehnt.

## 5. E-Mail und Browser-DOM zuerst als Mock/Stub (2026-07-03)

**Entscheidung:** `emailService.ts` ist ein In-Memory-Mock mit finaler
Schnittstelle. Browser-DOM-Tools (`click_element`, `type_text`, `submit_form`,
`screenshot_page`, `download_file`) sind Stubs, die `ok: false` melden.

**Warum:** Erst die Architektur (Plan → Bestätigung → Ausführung) stabilisieren,
ohne OAuth-Komplexität und echte Nebenwirkungen. Die Tool-Signaturen sind final,
später wird nur der Service-Unterbau ausgetauscht (siehe ARCHITECTURE.md).

**Teilweise überholt durch Entscheidung 12:** E-Mail hat seit 2026-07-05 einen
echten Gmail-Provider; der Mock bleibt als Fallback/Test-Provider erhalten.
Browser-DOM-Tools sind weiterhin Stubs.

## 6. Secrets nur in expo-secure-store (2026-07-03)

**Entscheidung:** Der API-Key liegt ausschließlich in `expo-secure-store`
(Android Keystore). Base-URL/Modell (keine Secrets) in AsyncStorage.
Keine Keys in Code, Config-Dateien, Logs oder der Datei-Sandbox.

**Warum:** AsyncStorage ist unverschlüsselt; Code/Repo sind öffentlich
kopierbar. SecureStore ist der plattformübliche sichere Speicher.

## 7. Minimale Dependencies, keine UI-Bibliothek (2026-07-03)

**Entscheidung:** Nur React Navigation (Tabs), WebView, AsyncStorage,
SecureStore, expo-file-system. Styling per StyleSheet + kleinem Token-Modul
(`components/theme.ts`), Icons als Emoji.

**Warum:** Jede Dependency ist Update- und Audit-Aufwand und erschwert die
Zusammenarbeit mehrerer KI-Tools. Neue Dependencies nur mit Eintrag hier.

## 8. React Navigation statt Expo Router (2026-07-03)

**Entscheidung:** Klassisches React Navigation (`createBottomTabNavigator`)
mit explizitem `src/main/navigation.tsx`, kein dateibasiertes Routing.
Der Ordner heißt bewusst `src/main` statt `src/app`, weil die Expo CLI einen
Ordner namens `app`/`src/app` automatisch als Expo-Router-Root interpretiert
("Using src/app as the root directory for Expo Router") – auch ohne
installiertes expo-router. Der neutrale Name vermeidet diese Magie.

**Warum:** 6 statische Tabs brauchen kein File-Routing. Explizite Navigation
ist für KI-Tools leichter nachzuvollziehen (eine Datei statt Ordner-Konvention),
und `src/`-Struktur bleibt frei von Framework-Magie.

## 9. Nur https im Mini-Browser (2026-07-03)

**Entscheidung:** `browserService.validateUrl` erlaubt ausschließlich `https:`;
`open_url` ist zusätzlich bestätigungspflichtig.

**Warum:** Kein Klartext-HTTP, keine `file:`/`intent:`/`javascript:`-Schemata –
letztere wären ein Sandbox-Escape Richtung System oder lokale Dateien.

## 10. Downgrade von Expo SDK 57 auf SDK 56 (2026-07-03)

**Entscheidung:** Das Projekt wurde initial mit SDK 57 (`~57.0.2`) angelegt,
noch am selben Tag aber auf SDK 56 (`^56.0.0`, per `npx expo install --fix`
konsistent aufgelöst) zurückgestuft.

**Warum:** SDK 57 war zum Zeitpunkt der Anlage gerade erst auf npm
veröffentlicht. Die Expo-Go-App im Play Store hatte den Rollout für SDK 57
noch nicht nachgezogen, obwohl expo.dev/go es bereits als aktuell listete –
ein bekannter Lag zwischen npm-Release und App-Store-Rollout. Symptom war
der Fehler "Project is incompatible with this version of Expo Go" auch nach
Neuinstallation der App. SDK 56 ist stabil etabliert und funktioniert
garantiert mit der aktuell installierbaren Expo-Go-App. Die verwendete
`expo-file-system`-API (`File`/`Directory`/`Paths`-Klassen) ist in SDK 56
identisch zu SDK 57, daher war keine Code-Änderung nötig – nur
`package.json`/`app.json` (Config-Plugin-Eintrag für `expo-status-bar`
kam durch `expo install --fix` hinzu).

**Überholt durch Entscheidung 11** – die Annahme "Play Store hat SDK 57 noch
nicht ausgerollt" ließ sich nicht bestätigen; der Fehler bestand nach dem
Downgrade auf dem Testgerät weiter unverändert fort.

## 11. Zurück auf Expo SDK 57 (2026-07-03)

**Entscheidung:** Downgrade aus Entscheidung 10 rückgängig gemacht
(`npx expo install expo@^57.0.0 --fix`); Projekt läuft wieder auf SDK 57
(`react-native` 0.86.0, `expo-file-system`/`expo-secure-store`/`expo-status-bar`
`~57.0.0`).

**Warum:** Der Fehler "Project is incompatible with this version of Expo Go"
trat auf dem Testgerät unabhängig vom Projekt-SDK auf – der Downgrade auf
SDK 56 hat das Symptom nicht behoben. Die offizielle Expo-Go-Download-Seite
(https://expo.dev/go) listet SDK 57 als aktuelle Version; die Android-Client-
Version 57.0.2 existiert und ist direkt als APK verfügbar. Ursache war also
vermutlich nicht ein fehlender Play-Store-Rollout, sondern eine veraltete
oder unvollständig aktualisierte Expo-Go-Installation auf dem Testgerät.
**Lektion:** Bei "incompatible"-Fehlern zuerst die exakte, tatsächlich
installierte Expo-Go-Version auf dem Gerät prüfen (App → Profil), statt das
Projekt-SDK zu verändern. Passende APKs pro SDK-Version gibt es direkt unter
https://expo.dev/go, unabhängig vom Play-Store-Rollout.

## 12. Gmail über OAuth 2.0 mit PKCE, hinter einer Provider-Schicht (2026-07-05)

**Entscheidung:** Die echte Gmail-Anbindung läuft über OAuth 2.0 mit PKCE
(`expo-auth-session` + `expo-crypto`, Login im System-Browser via
`expo-web-browser`) – nicht über Passwort, nicht über API-Key, ohne
Client-Secret. Tokens (Access + Refresh) liegen ausschließlich in
`expo-secure-store` (`services/email/tokenStore.ts`). Alle E-Mail-Zugriffe
gehen durch die Provider-Schicht `emailService.ts` → `gmailProvider.ts` /
`mockEmailProvider.ts` (gemeinsames Interface in `services/email/types.ts`).
Scope: nur `https://www.googleapis.com/auth/gmail.modify`.

**Warum:**
- **Kein Passwort/API-Key:** Die App sieht nie Gmail-Zugangsdaten; der Login
  passiert auf Googles Seiten. PKCE (RFC 7636) ist der Standard-Flow für
  installierte Apps und braucht kein Client-Secret – ein Secret im App-Code
  wäre ohnehin extrahierbar und damit wertlos.
- **Agent sieht nie Tokens:** Tokens verlassen `tokenStore.ts`/
  `gmailProvider.ts` nicht. Das Provider-Interface liefert nur Mail-Daten.
  Selbst ein manipulierter Plan (Prompt Injection) hat keinen Codepfad zu
  Credentials.
- **Scope-Minimierung:** `gmail.modify` deckt alle Agent-Tools ab (lesen,
  Entwürfe, senden, archivieren, labeln). `https://mail.google.com/`
  (Vollzugriff inkl. endgültigem Löschen) ist bewusst ausgeschlossen;
  engere Alternativen (`gmail.readonly`, `gmail.send`) sind in
  `src/config/googleOAuth.ts` dokumentiert.
- **Provider-Schicht:** Tools/UI bleiben stabil, wenn Provider wechseln
  (Mock bleibt als Fallback/Test, Outlook folgt als eigener Provider).

**Neue Dependencies (Begründung gemäß Regel):** `expo-auth-session`
(OAuth/PKCE-Flow), `expo-crypto` (PKCE-Verifier, Peer-Dependency),
`expo-web-browser` (sicherer System-Browser-Tab für den Login). Alle drei
sind offizielle Expo-SDK-Module, versioniert mit SDK 57.

## 13. Eine lokale modellunabhängige User Memory (2026-07-05)

**Entscheidung:** Die App bekommt genau eine User Memory für den lokalen
Standardnutzer `local-user`. Sie liegt in AsyncStorage
(`STORAGE_KEYS.userMemory`) und wird über `services/memory/memoryService.ts`
verwaltet. Es gibt keine Project Memory, keine Session Memory und keine
separate Memory pro Modellanbieter.

**Warum:**
- Die Memory gehört der App, nicht OpenAI, DeepSeek oder einem lokalen Modell.
  Ein Modellwechsel behält dadurch denselben lokalen Kontext.
- AsyncStorage reicht für einfache Notizen und braucht keine neue Dependency.
- Eine einzige Memory hält das Sicherheits- und Produktmodell verständlich:
  Nutzer können sie im Settings-Tab sehen und löschen.
- Secrets sind ausgeschlossen: Passwörter, API-Keys, OAuth-Tokens, Bankdaten
  und Kreditkartendaten dürfen nicht gespeichert werden.
- Embeddings oder Vektorsuche bleiben eine spätere Erweiterung; aktuell reicht
  einfache Text-/Tag-Suche mit Sortierung nach Relevanz, Wichtigkeit und
  Aktualität.

## 14. Chat-Memory bleibt lokal-deterministisch statt Tool-Ausführung (2026-07-05)

**Entscheidung:** Der normale Chat bekommt nicht den Agent-Tool-Executor.
Stattdessen erkennt `memoryIntent.ts` nur ausdrückliche Merk-/Speicher-
Formulierungen lokal per Regex und ruft dann `addMemoryWithMerge()` auf.
Fast identische Memories werden per Token-Jaccard-Ähnlichkeit ab `0.85`
zusammengeführt. Die Relevanzsuche bleibt ohne Embeddings und kombiniert
Phrase, Token-Overlap, Tags, Wichtigkeit, Aktualität und `lastUsedAt`.

**Warum:**
- Chat bleibt ein einfacher Chat ohne Tool-Ausführungsfläche.
- Nur klare Nutzerabsicht speichert Memory; normale Aussagen werden nicht
  automatisch persistiert.
- Dedupe verhindert Memory-Spam ohne neue Dependency oder Vektordatenbank.
- Embeddings/Vektorsuche bleiben eine spätere, bewusst zu entscheidende
  Erweiterung.
