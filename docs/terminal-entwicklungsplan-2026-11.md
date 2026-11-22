# Shadow Terminal – verbindlicher Entwicklungs- und Prüfplan

**Statusvermerk (22.11.2026):** Die Schritte 1 bis 5b (PR #97, #95, #96, Phase 5a und 5b, PR #98 bis #108) sind in `main` integriert; die in diesem Plan genannten Pull-Request-Nummern und Draft-Hinweise sind Historie. Fortgeschrieben wird der Stand in [AKTUELL.md](AKTUELL.md). Die Leitprinzipien und Regeln dieses Plans gelten weiter, solange keine neuere ausdrückliche Entscheidung von Shadow vorliegt.

Stand: 2026-11-21. Durch Shadow („Master Wayne“) freigegebene **Reihenfolge der Arbeiten**. Dieses Dokument beschreibt geplante Änderungen; es behauptet nicht, dass diese bereits implementiert oder getestet sind. Bei Abweichungen gelten neuere ausdrückliche Entscheidungen des Eigentümers. Immer die tatsächlich ausgecheckten Branches/SHAs prüfen.

## Leitprinzipien

1. **Zuerst Stabilität und nachvollziehbare Tests, dann Realismus.** Kein großer gleichzeitiger Umbau von Terminal, Mission und Oberfläche.
2. **Reale Vorbilder vor Sonderbefehlen.** Künftige Terminaloperationen orientieren sich nach Möglichkeit an existierenden Unix-/Linux-Werkzeugen, Dateisystem- und Prozesskonzepten. Das reduziert eigens erfundene Syntax, Hilfetexte und Fehlersituationen. Die Umsetzung bleibt zunächst eine kontrollierte Simulation – kein unbeschränkter Host-Shell-Zugang.
3. **Kein Verhalten fälschlich als echt ausgeben.** Reale Schnittstellen (z. B. die lokale Dateibrücke und Nmap) sind von simulierten Werkzeugen zu unterscheiden. Fiktive VAULT-Begriffe und Ausgaben sind Übergangszustand, keine Zielarchitektur.
4. **Daten- und Bedienkompatibilität.** Vorhandene Profilformate, Exportdateien, Dossiernummern, Pin-/Zonenkennungen, Kartenverknüpfungen und die funktionierende PPP-/tmux-/PREDICT-Kette erhalten, soweit keine Änderung ausdrücklich freigegeben wurde.
5. **Schrittweise Englischumstellung.** Zunächst Terminalbefehle, Hilfe, Status- und Fehlermeldungen, anschließend weitere sichtbare UI-Bereiche. Zu jedem Textwechsel gleichzeitig Tests und Dokumentation aktualisieren. Kommunikation und interne Arbeitsdokumentation dürfen vorläufig Deutsch bleiben.
6. **Branch und Draft-PR pro zusammenhängender Änderung** mit überprüfbarem Diff und klar dokumentierten Abhängigkeiten. Keine automatischen Merges, keine Force-Pushes und keine Profil-/Dateilöschungen ohne Freigabe.

## Verbindliche Schrittfolge

### 1. Baseline auf `main` stabilisieren

- `tests/terminal-pin-suche.js`: Die Annahme, ein abgeschnittener `PIN-00x`-Bezeichner lasse sich bei mehreren `PIN-00x`-Objekten eindeutig per Tab ergänzen, ist falsch.
- Nur die widersprüchliche Testerwartung korrigieren; die vorhandene Auswahllisten-Prüfung (einschließlich gesperrter ID ohne Klarnamen) beibehalten. Keine Produktcodeänderung zur Befriedigung eines falschen Tests.
- Gezielter Test `terminal-pin-suche`; danach relevante Regressionstests und Standardauswahl. Bekannte unabhängige `m1flow`-/Lastinstabilitäten getrennt ausweisen.
- Dieser Fix und der vorliegende Arbeitsplan befinden sich in einem gemeinsamen vorbereitenden Draft-PR. Erst nach Abnahme nach `main` übernehmen, bevor die anderen Drafts neu basiert werden.

### 2. PR #95: Namensnavigation kontrolliert fertigstellen

- Direktes `map <Name>` / `open <Name>`, Aliase und Tab-Ergänzung prüfen: exakter Treffer vor Präfix; bei Mehrdeutigkeit keine automatische Navigation.
- **Verbindlicher Merge-Blocker für #95:** Die noch wirksame Altlogik `infoGesperrt` darf keine Dossier-Klarnamen über direkte Namensauflösung, Tab-Ergänzung oder Mehrdeutigkeits-/Trefferlisten preisgeben. Bis Phase 5 nur vollständig freigegebene Dossiers in solche Namensindizes aufnehmen; vorhandene Kennungs-/Sperrregeln beachten. Dafür gezielten Regressionstest mit einem durch `infoGesperrt` beschränkten Dossier ergänzen. **#95 nicht vor diesem Fix mergen.** Der Missionsaspekt ist als Produktentscheidung entfallen, aber noch im Code; Phase 5 entfernt die Altlogik rückwärtskompatibel. Das ist kein akzeptiertes Übergangsleck.
- Kollision „gesperrter exakter Name“ vs. „sichtbarer längerer Präfix“ explizit behandeln; keine stille falsche Navigation.
- Maskierung des bereits angezeigten Scrollbacks und Verhalten bei erneuter Entsperrung testen. Keine ungezielte Löschung anderer Befehlsausgaben.
- Regressionstests und Dokumentation auf denselben Commit abstimmen. Ein umfassendes Windows-GUI-Testpaket erst an einem geeigneten Integrations-Meilenstein erstellen, nicht verpflichtend für jeden isolierten #95-Fix. #95 bleibt Draft bis zur Abnahme.

### 3. PR #96: Archiv und getrennte Objektnavigation kontrolliert fertigstellen

- **Freigegebene Semantik unbedingt erhalten:** `map PIN-...` öffnet Pin auf Karte; `map ZO-...` öffnet Zone auf Karte. `open PIN-...` / `open ZO-...` öffnen das zugehörige Dossier; ohne Link `No linked dossier`. `open P-/O-/L-...` öffnet direkt das Dossier.
- `map pins` zeigt nur Pins; `map zones` nur Profilzonen (ZO). Dass Zonen keine Pins sind, gilt auch für Suche, Tab und Navigation.
- Der vorläufige `exports` / `open export`-Katalog darf keinen zweiten Berechtigungspfad schaffen: `cat` über die lokale Archivbrücke und andere Wege auf dieselben geschützten Dateien gehören in die Sicherheitsprüfung. Technische Grenze klar benennen: Eine Terminal-UI-Sperre allein ist kein Schutz gegenüber direktem Dateisystemzugriff.
- Die derzeitige 500-Einträge-Grenze der `ls`-Brücke darf keine still ausgelassenen archivierten Datensätze verursachen. Vollständige/deterministische Erfassung oder eine überprüfbare paginierte Lösung.
- SHA-256, Auswahl registrierter Fassung, Revisionen, nachträgliche Sperrung und Scrollback mit echten Brückenoperationen sowie Windows testen. Mocks allein belegen keine echte Archivbrücke.
- Die widersprüchlichen Annahmen über eindeutige Präfixergänzung in `tests/terminal-vault.js` und `tests/terminal-objektnavigation.js` nach dem Baseline-Fix anhand der tatsächlich vorhandenen Mehrfachtreffer korrigieren; Auswahllisten- und Sperrprüfungen erhalten. Testfehler nicht durch fehlerhafte Produktlogik beheben.
- Test-/Dokumentationsabweichungen nach jedem Commit korrigieren. #96 hängt von #95 ab; nach dessen Merge Basis kontrolliert aktualisieren.

### 4. Abnahme und Merge-Reihenfolge

1. PR #97: Baseline-Fix gezielt testen und nach dokumentierter Freigabe nach `main` integrieren.
2. PR #95: Die Änderung aus #97 übernehmen, temporären `infoGesperrt`-Namensfilter samt Regressionstest ergänzen, anschließend gezielte Tests und vollständige Standardauswahl; erst nach separater Abnahme mergen. Kein neues Namensleck auf `main` zulassen.
3. PR #96: Zuerst #95-Stand übernehmen; die beiden verbliebenen widersprüchlichen Tab-Testzeilen korrigieren und Archiv-/Brückenbefunde prüfen, dann gezielte und vollständige Tests; nach gesonderter Abnahme mergen. Keine vorgezogenen Extra-Branches für eng gekoppelte Änderungen erforderlich.
4. Gebündelten Windows-Oberflächentest ansetzen, sobald der integrierte Anwendungsstand praxisreif ist oder ein konkreter Eingriff ihn erfordert.

**Sichtungen/PR-Reviews** benötigen keinen automatischen Volltest; Quelltextbefunde sind ausdrücklich als nicht ausgeführt bzw. statisch geprüft zu kennzeichnen. Bei **Merge-Freigaben** genügt ein erfolgreicher Einzeltest nicht: gezielte Regressionen und die volle Standardauswahl sind mit Branch-SHA und bekannten unabhängigen Fehlern zu dokumentieren. Ergebnisstatus **bestätigt / fehlgeschlagen / nicht ausgeführt**; keine ungeprüfte Merge-Freigabe.

### 5. Alte Missions-/Ansprechpartnerlogik ausbauen

- **Ausdrücklich freigegeben:** der Missionsaspekt soll entfallen; `infoGesperrt`, `wissen`, `STATE.infozugang`, alte Freigabemasken, Reducer-Pfade und Missionshinweise in Tests/Dokumentation vor Entfernung vollständig inventarisieren.
- Ehemals missionsabhängige „Freigabe durch Ansprechpartner“ soll nicht beibehalten werden.
- **Beibehalten:** manuelle Dossiersperren, konsistente PIN-/ZO-Zugriffsregeln, Benutzeridentitäten, beabsichtigte Passwortabfragen und Prüfsummen.
- Gespeicherte Profile, Fallpakete und Altbestände rückwärtskompatibel lesen. Keine übergreifende Funktionsentfernung allein wegen ähnlicher Namen.
- Eigener PR mit gezielten automatisierten Tests für Altdaten; umfassende Windows-Oberflächenabnahme erst als gebündelter Integrationsschritt.

### 6. Realismus- und Sprachphase in kleinen PRs

- Zunächst eine Befehls-/Verhaltensmatrix erstellen: Wo existiert ein reales Vorbild (`find`, `grep`, `ls`, `cat`, `stat`, `sha256sum`, `sudo`) und welche Daten/Kommandos sind aus Kompatibilitätsgründen app-spezifisch? Realistische Ausgabe nur dort beanspruchen, wo Semantik stimmt.
- Darauf aufbauend virtuelle Verzeichnisstruktur, konsistente Exit-Codes, Datei-/Prozesszustände, Zugriffsmodell und Hilfe ausarbeiten. Vorhandene `exports`-/VAULT-Funktionalität **ablösen oder unterlegen**, ohne archivierte Dateien umzubenennen oder Karten-/Dossierbezüge zu beschädigen.
- `sudo` langfristig an realistischere Autorisierung einzelner Operationen annähern statt stiller dauerhafter globaler Entsperrung; gesonderte Entscheidung und Migration nötig.
- Oberfläche/Terminal in nachvollziehbaren Etappen Englisch übersetzen, jede Etappe mitsamt Dokumentation und wortlautabhängigen Tests.
- Kein echter Host-Befehlsinterpreter, kein freier Zugriff auf das Betriebssystem und keine zusätzlichen Netz-/Dateirechte als unbeabsichtigter „Realismus“-Effekt.

## Windows-Testpaket-Regel – präzisiert durch Shadow am 2026-11-21

**Ein versioniertes Windows-Testpaket wird erstellt, wenn Shadow die gesamte Oberfläche bzw. einen umfassenden integrierten Anwendungsstand unter Windows testen soll.** Gemeint ist ein zusammenhängender manueller Abnahmedurchlauf durch Navigation, Terminal, Karte (einschließlich 3D, soweit relevant), Dossiers, Profil, Archiv und lokale Dateibrücke. Der Umfang wird je Meilenstein ausdrücklich festgelegt.

Für kleine isolierte Codeänderungen oder Testkorrekturen **kein obligatorisches neues Testpaket**. Stattdessen gezielte automatische Regressionen, dokumentierter Test-/Review-Stand und, soweit sinnvoll, eine kurze manuelle Einzelprüfung im PR. Ein Windows-spezifischer Fehler kann ausnahmsweise auch zwischen den großen Meilensteinen einen kurzen Praxistest erforderlich machen; dies ist keine Pflicht zur vollständigen Oberflächeabnahme.

Ein umfassendes Windows-Testpaket enthält:
- exakten Branch/Commit, separaten Testordner und Testprofil/Backup, lokale `kartenschluessel.js` (niemals committen) und `START_TERMINAL.bat`;
- reproduzierbare Testdaten und eine geordnete Schrittfolge durch die zu prüfenden UI-Bereiche; Eingaben/Befehle, Sollzustände, Fehlerfälle und Regressionsfälle;
- relevante Playwright-Kommandos und Standardauswahl, Voraussetzungen, Ergebnisvorlage und bekannte Einschränkungen;
- klare Trennung zwischen statischer Prüfung, ausgeführten Automatentests und tatsächlich unter Windows bestätigter Bedienung.

Das für den vorbereitenden Test-Fix bereits angelegte `TESTPAKET_04_PIN_TAB_BASELINE.md` ist eine **optionale gezielte Prüfanleitung**, kein Präzedenzfall für ein Testpaket pro Commit. Über Abnahme und Merge entscheidet Shadow nach ChatGPT-Prüfung.

## Kontrollpunkte für Claude und ChatGPT

- Vor jeder Änderung aktuellen `main`-Stand, #95/#96-Heads und PR-Basis verifizieren: ältere Review-SHAs dürfen nicht ungeprüft als aktuell gelten.
- Jeden Befund als **Code-defekt / Testfehler / Altlast / gewünschte Verhaltensänderung / ungeprüfte Hypothese** klassifizieren.
- Nur explizit abgenommene Semantik umsetzen, insbesondere die oben genannte `map`/`open`-Trennung.
- Keine Arbeit an späteren Phasen vor Abschluss der aktuellen Phase, sofern Shadow keine neue Reihenfolge verfügt.
- Referenzen: `CLAUDE.md`, `docs/terminal.md`, `docs/datenvertrag.md`, `tests/runall.js` und zugehörige PR-Testpakete.
