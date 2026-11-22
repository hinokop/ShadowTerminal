# Shadow Terminal – aktueller Stand

**Stand:** 22.11.2026. Zuletzt geprüft gegen `main` `c9e48ab67646e936a8bcbb7f693114829bea0ebb` (Merge von #114; davor #111 als `dc78f0c` und #112 als `7a28ca7`) und GitHub (Pull Requests, Branches, Workflows). Die genannte SHA ist ein Prüfstand und nach jedem weiteren Merge historisch.

Diese Datei ist die zentrale Statusdatei. Sie trennt streng zwischen dem, was **in `main`** gilt, und dem, was nur in **offenen Pull Requests** vorliegt. Pflege: bei jedem Merge in `main` aktualisieren, Stand und `main`-Commit nachführen. Entwicklungsregeln stehen in [CLAUDE.md](../CLAUDE.md), nicht hier.

## 1. Stand von `main`

**Produkt:** Lokales Recherchewerkzeug (Vanilla JavaScript, ohne Build-Schritt, `file://`-fähig) in der Oberfläche eines Feldterminals. Früher ein Spiel, heute ein Werkzeug. Module: Profil, Dossiers, Karte, Ablage, X; dazu ein Terminal (Profanity, tmux, PPP, PREDICT, echtes Nmap über die lokale Brücke). Die Karte (2D und 3D, Pins, Profilzonen, Ebenen, Messung, Protokoll, Wetter, Verknüpfungen) ist ausdrücklich nicht zu vereinfachen; verbessert werden dürfen Auflösung, Zoom, Bedienung und Performance. Visuelle Identität einschließlich Libelle bleibt erhalten.

**Zustandsformat:** `STATE_VERSION = 5` (`index.html`, seit #111). Der aktive Zustand enthält keine Missionsfelder mehr; Zustände der Formate 2 bis 4 werden beim Laden verlustfrei überführt, die Missionsfelder liegen unverändert in `STATE.altbestand` und werden nur über `ALT()` gelesen. Vor der Überführung wird der bisherige Rohstand unter `fieldterminal.v1.v4-sicherung` gesichert; bei Lese-, Schreib- oder Sicherungsfehlern wird in der Sitzung nichts überschrieben (Sperre mit Meldung, ungültiger Stand unter `fieldterminal.v1.defekt`). `SCENARIO.missionen` wird für die Überführung älterer Formate benötigt und bleibt.

**Rückweg:** Ein auf Format 5 überführtes Profil darf nicht mehr mit einem Stand vor #111 geöffnet werden. Der ältere Stand erkennt Format 5 nicht, legt den Zustand roh unter `fieldterminal.v1.defekt` ab und beginnt mit einem neuen Zustand. Rückweg nur über eine Kopie des Ordners `profil` oder die Sicherung `fieldterminal.v1.v4-sicherung`.

**Phase 5 (Abbau der alten Mission) in `main`:**

| Phase | Inhalt | PR |
|---|---|---|
| 5a | Recherchezugang von historischer Missionsfreigabe entkoppelt (nur manuelle Dossiersperren) | #98 |
| 5b1 | Ansprechpartnerfilter beim Sichtungs-TXT-Export entfernt | #99 |
| 5b2 | Karten- und Dossierrecherche von Missionsfreigaben gelöst | #100 |
| 5b3 | Rudiment- und Freigabemaske aus der Dossieroberfläche entfernt | #101 |
| 5b4 | Registratur aus der Ablage entfernt, Recherchezugriffe entkoppelt | #102 |
| 5b5 | Missionsnachträge aus der produktiven Dossieransicht entfernt | #103 |
| 5b6 | Modul Dossiers im Altzustand identisch zum Recherchebetrieb | #104 |
| 5b7 | Missionsbetrieb stillgelegt (`missionsbetrieb()` liefert `false`) | #105 |
| 5b8 | Unerreichbarer Code entfernt (erste Tranche) | #106 |
| 5b9 | Missionskern entfernt | #108 |
| 5c0 | Bestandsaufnahme Zustands- und Profilschema ([phase5c-schemainventar.md](phase5c-schemainventar.md)) | #109 |
| 5c1a | Notizen und Operative Einschränkungen als Profiltexte | #110 |
| 5c1b | Zustandsformat 5 mit Altbestand, Rohsicherung, abgesicherte Lade- und Speicherpfade, Entkopplung von P-0001 bis P-0003 und der Adresse in der Kopfzeile | #111 |

Vorangegangen: Terminal-`sudo`, Namensnavigation und Archivkatalog sowie Test-Baseline und Entwicklungsplan (#93 bis #97); Doku zu Karten-Konsolenbefunden (#107). Manuelle Dossiersperren, Pin- und Zonenzugriff über `zielZugang` und Profilkompatibilität sind erhalten.

**Tests:** `node tests/runall.js` führt die Standardauswahl aus (89 Skripte bis #110, 91 mit #111; Playwright, Passwort `pw-test-123`). Historische Skripte des stillgelegten Missionsablaufs sind nur namentlich aufrufbar. Als instabil bekannt: `wk3`, `dp`, `m1flow` (Missionsablauf, auch auf `main` rot) und `lage-box` unter Parallellast. Bestätigung der Läufe erfolgt über GitHub Actions: der dauerhafte Workflow `ci.yml` (seit #114) führt Python-Brückentest, Syntaxprüfung und die vollständige Standardauswahl bei jedem Pull Request gegen `main` und bei jedem Push auf `main` aus (Push-Lauf 45075611403 auf `c9e48ab`: 91 grün, 0 unerwartet rot). Für den Merge-Commit `dc78f0c` von #111 selbst lief keine Standardauswahl; bestätigt war dort der Lauf 45067956391 auf dem Head `477cfaa` des gemergten Branches.

**Abnahme #111:** Die Windows-Abnahme mit gesicherter Kopie der echten Profildaten wurde laut Master Wayne vor dem Merge durchgeführt und als erfolgreich gemeldet; das Ergebnisblatt ist nicht Teil des Repositorys und wurde von Claude nicht eingesehen.

**Windows:** Start über `START_TERMINAL.bat` (Python 3, lokale Dateibrücke; ruft `START_3D.bat` auf) oder `START_3D.bat` allein (ohne Brücke). Linux: `START.sh`. Die lokale, nicht versionierte `kartenschluessel.js` (Kartenschlüssel) wird von `index.html` eingebunden und soll neben `index.html` liegen; ihr Fehlen wurde für diese Dokumentation nicht getestet. Zustand, Profil und Anhänge liegen im Browserprofil im Ordner `profil` neben dem Starter, das lokale Archiv im Ordner `pgcl-eu3.arch07`.

## 2. Offene Pull Requests (nicht in `main`)

| PR | Inhalt | Stand |
|---|---|---|
| #55 | alter Entwurf zu `CLAUDE.md` | veraltet, durch die neue `CLAUDE.md` (#112) ersetzt; Schließen erst nach Freigabe |

Dokumentations-PRs werden hier nur geführt, solange sie offen sind. Was nur in einem offenen PR gilt, gehört nicht in Abschnitt 1; ein Dokumentations-PR wie dieser ist nach seinem Merge nicht mehr aufzuführen.

## 3. Reihenfolge der nächsten Schritte (bestätigt am 22.11.2026)

Erledigt: #111 (Phase 5c1b), der Dokumentationsstand #112 und die dauerhafte CI #114, alle in `main`.

1. **Dokumentationsnachtrag** zu #111 und #114 (PR #113).
2. **CI-Konsolidierung** vor 5c2: Schritt 1 (dauerhafte Prüfung, `.github/workflows/ci.yml`) ist mit #114 in `main` (`c9e48ab`); der erste Push-Lauf auf `main` (45075611403) ist grün (91 grün, 0 unerwartet rot). Als Nächstes: wiederholt erfolgreiche Läufe abwarten, dann die zwölf phasengebundenen Workflows in einem eigenen PR entfernen; Branch-Schutz erst danach und nur auf Entscheidung von Master Wayne. Vorgemerkt: die Einschränkung von `lage-box` (`BEKANNT_NUR`) im Test-Runner weiter absichern.
3. **5c2:** in zwei Schritten, Daten im Altbestand bleiben erhalten. **5c2a:** Darstellung ausblenden (Entscheidung C, Draft). **5c2b:** danach ungenutzte Funktionen und verbliebenen `ALT()`-Rest-Code nach Referenzprüfung entfernen.
4. **Branch-Bereinigung:** nur nach Abgleich und ausdrücklicher Freigabe.
5. **Phase 6:** Unix-/Linux-Realismus im Terminal und schrittweise Englischumstellung ([terminal-entwicklungsplan-2026-11.md](terminal-entwicklungsplan-2026-11.md)), Modernisierung der Oberfläche modulweise.

Weder die Bestätigung dieser Reihenfolge noch eine erfolgreiche CI ist eine Freigabe für Merge oder Löschung.

## 4. Repository, Branches und CI

- 62 Branches (`main` und 61 weitere), 113 Pull Requests: 108 gemergt, 2 offen (#55, #113 dieser Doku-Nachtrag), 3 geschlossen ohne Merge (#48, #50, #75). Die Branches der gemergten PRs #111, #112 und #114 bestehen noch. `main` ist nicht geschützt.
- Von den 53 Branches gemergter PRs (Zählung vor den Merges von #111 und #112, deren Branches nicht eingerechnet sind) haben 52 keinen Commit, der nicht in `main` liegt. `test/parallelitaet` (PR #73) wurde per Squash gemergt; sein Inhalt ist in `main` enthalten (Diff des PR und des Merge-Commits zeilengleich). Gelöscht wird nichts ohne ausdrückliche Freigabe.
- Auf `main` liegen der dauerhafte Workflow `ci.yml` (Pull Requests gegen `main`, Push auf `main`, manuell) und zwölf phasenbezogene Workflows (5a, 5b1 bis 5b9, 5c1a, 5c1b), die ausschließlich bei Pushes auf ihre gemergten Entwicklungsbranches auslösen und damit praktisch wirkungslos sind; ihre Entfernung steht aus.

## 5. Offene Entscheidungen und Produktideen

1. **Alte Missionsdaten in der Darstellung:** entschieden am 22.11.2026 (Option C, ausblenden; Daten bleiben unverändert in `STATE.altbestand`). Umsetzung als Draft 5c2a (Abschnitt 8c in [phase5c-schemainventar.md](phase5c-schemainventar.md)); die Entfernung des Rest-Codes folgt als 5c2b.
2. **Passwortsperre für das Modul Profil** (Produktidee, nicht Teil von Phase 5c): analog zur Sperre einzelner Dossiers, Entsperren über Eingabe oder Terminal. Offen für Vorschläge.
3. **Weitere Vormerkungen:** Notizfelder nur als „Bisherige Notizen“ sichtbar, wenn Text vorhanden ist; Entscheidung zu den Lichtbildern `l-9052` und `l-9053`; lokale Bereitstellung von MapLibre.
4. **Veraltete Texte im Code** (nicht Gegenstand dieses Dokumentations-PR): der Dateikopf von `akten-modul.js` beschreibt noch Akten, Schwärzungen und Einsichtsanträge, produktiv zeigt die Ablage nur den lokalen Eingang (`renderAkten`); die Startfehlermeldung in `index.html` nennt noch `dialog.js` und `klassifikator.js`, die nicht mehr existieren. Bereinigung gehört zu 5c2 oder einer eigenen Runde. Ebenso trägt der Kopf von `docs/phase5c-schemainventar.md` noch „Reine Bestandsaufnahme, kein Code geändert“ mit Basis `c19b93b`; das Dokument ist Entscheidungshistorie, wird aber seit #111 auch für die Umsetzung herangezogen und sollte im Zuge von 5c2 aktualisiert werden.

## 6. Dokumentenlandkarte

| Gruppe | Dokumente |
|---|---|
| Verbindlich | [CLAUDE.md](../CLAUDE.md) (Regeln), diese Datei (Stand), [terminal-entwicklungsplan-2026-11.md](terminal-entwicklungsplan-2026-11.md) (Prinzipien, Windows-Testpaketregel; die genannten PRs #95 bis #97 sind Historie), [datenvertrag.md](datenvertrag.md) (Fälle, Recherche, Fallpakete), [karte-optimierungen.md](karte-optimierungen.md) (einschließlich Verbot der Kartenvereinfachung), [terminal.md](terminal.md) (Terminalsemantik) |
| Entscheidungshistorie | [phase5c-schemainventar.md](phase5c-schemainventar.md) (Migration und Prüfhistorie), [phase5-missionsinventar.md](phase5-missionsinventar.md) |
| Historisch (Archiv) | [missionsabhaengigkeiten.md](missionsabhaengigkeiten.md), [r5-bereinigung.md](r5-bereinigung.md), [r5-kandidaten.md](r5-kandidaten.md), die Testpakete `TESTPAKET_01` bis `04` im Hauptordner, Screenshots unter `pr/` |
| Prüfanleitung | [windows-einzeltest-archivnamen.md](windows-einzeltest-archivnamen.md) (Archivdateinamen und Dossiersperre unter Windows) |

Historische Dokumente werden nicht gelöscht; eine Umorganisation nach `docs/historie/` erfolgt erst nach einer Prüfung der Verweise.
