# Shadow Terminal – aktueller Stand

**Stand:** 24.11.2026. Zuletzt geprüft gegen `main` `ec313af` (Merge von #132; davor #130 als `639c21d`, #129 als `95b3388`, #128 als `210a422`, #127 als `b9bf8d2`, #126 als `c6dd00d`, #125 als `4db60d6`, #124 als `696784b6ce9c`, #123 als `67e1279`, #120 als `072c2d3`, #122 als `d6753b8`, #121 als `5501b38`, #119 als `5c5a545`, #118 als `1cb1195`, #116 als `ebe44f6`, #115 als `036f4eb`, #117 als `9205644`, #113 als `75f2592`, #114 als `c9e48ab`, #111 als `dc78f0c`) und GitHub (Pull Requests, Branches, Workflows). Die genannte SHA ist ein Prüfstand und nach jedem weiteren Merge historisch.

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
| 5c2a | Verbliebene Missionsdaten im Dossier ausgeblendet (Entscheidung C), Daten unverändert in `STATE.altbestand` | #116 |
| 5c2b (a) | Stillgelegter Ereignisblock in `tickModule` und seine Helfer (`meldeText`, `meldungLiegtVor`, `VK`, `vkStatus`, `fensterZelle`) sowie `widerspruchOffen()` entfernt | #118 |
| 5c2b (b) | `IZ()` und `aussagenListe()` entfernt, Tests auf direkte Altbestand-Zugriffe umgestellt; neue Tests `phase5c2b-frischer-zustand` und `phase5c2b-karte-altbestand` | #119 |
| 5c2b (b), Tests | `phase5b4-arbeitszugang`, `sichtung-export`, `terminal-namensnavigation` zusätzlich gegen migrierten Format-4-Zustand mit historischen Freigabestufen | #121 |
| 5c2b (c), Analyse | Entwicklerkonsole, `SCENARIO.abfragen`, ungenutzte Helfer ([phase5c2b-c-analyse.md](phase5c2b-c-analyse.md)); nur Dokumentation | #120 |
| 5c2b (c), D2 | Überlagerte zweite Deklaration `sichtungText(e)` aus `index.html` entfernt; neuer Standardtest `phase5c2b-sichtungtext` (Merge-Commit `67e1279`) | #123 |
| 5c2b, Export | Sichtungs-TXT-Export: `Güte` (gespeicherte Bewertung) und `Aktualität` (Alter) getrennt, Objekttext `[object HTMLSpanElement]` behoben; Standardtests `phase5c2b-sichtungtext` und `sichtung-export` angepasst | #125 |
| 6a, Plan | Plan zur Unix-Semantik von `pwd`, `cd`, `ls` ([phase6a-plan-pwd-cd-ls.md](phase6a-plan-pwd-cd-ls.md)) und Messsonde; nur Dokumentation, Entwurf | #126 |
| 6a, Architektur | Abschnitt 9 des Plans: Dateisystem-Schnittstelle, Befehlskontext, Zugriffsentscheidung, Konformitätsklassen, Etappe 6a-0; Entscheidung Variante B als Zielverhalten; nur Dokumentation | #127 |
| 6a-0 | Dateisystem-Schnittstelle `TERMINAL_FS`, Befehlskontext mit `args`, explizitem `cwd`, Exit-Code, stdout/stderr; `pwd`, `cd`, `ls` ohne Verhaltensänderung; Tests `terminal-fs-ist`, `-schnittstelle`, `-vergleich` | #128 |
| 6a-1 | `pwd` als Bash-Builtin (Optionen, Fehler, Hilfe, Rückgabewerte); Entscheidungen zu Abschnitt 7 des Plans (7.1); Test `terminal-pwd-bash`; `docs/terminal.md` | #130 |
| 6a-2 | `cd` als Bash-Builtin, strenge Schreibweise der Archivpfade (nur für `cd`), interner `OLDPWD`, Sitzungsende setzt Arbeitsverzeichnis zurück; Test `terminal-cd-bash`; Windows-Abnahme erfolgreich | #132 |
| 5c2b, Inventur | 50 Nicht-Standardskripte mit `IZ(` ([phase5c2b-inventur-nichtstandard.md](phase5c2b-inventur-nichtstandard.md)); Dokumentation und Messwerkzeuge | #122 |

Vorangegangen: Terminal-`sudo`, Namensnavigation und Archivkatalog sowie Test-Baseline und Entwicklungsplan (#93 bis #97); Doku zu Karten-Konsolenbefunden (#107). Manuelle Dossiersperren, Pin- und Zonenzugriff über `zielZugang` und Profilkompatibilität sind erhalten.

**Tests:** `node tests/runall.js` führt die Standardauswahl aus (89 Skripte bis #110, 91 mit #111, 92 seit #115 mit `dossier-sperre`, 93 seit 5c2a mit `phase5c2a-altdaten`, 94 seit 5c2b (a) mit `phase5c2b-tickblock`, 96 seit 5c2b (b) mit `phase5c2b-frischer-zustand` und `phase5c2b-karte-altbestand`, 97 seit D2 (#123) mit `phase5c2b-sichtungtext` , 100 seit #128 mit `terminal-fs-ist`, `terminal-fs-schnittstelle`, `terminal-fs-vergleich` ; 101 seit #130 mit `terminal-pwd-bash`, 102 seit #132 mit `terminal-cd-bash`; Playwright, Passwort `pw-test-123`). Historische Skripte des stillgelegten Missionsablaufs sind nur namentlich aufrufbar. Als instabil bekannt: `wk3`, `dp`, `m1flow` (Missionsablauf, auch auf `main` rot) und `lage-box` unter Parallellast. Bestätigung der Läufe erfolgt über GitHub Actions: der dauerhafte Workflow `ci.yml` (seit #114) führt Python-Brückentest, Syntaxprüfung und die vollständige Standardauswahl bei jedem Pull Request gegen `main` und bei jedem Push auf `main` aus (Push-Lauf 45075611403 auf `c9e48ab`: 91 grün, 0 unerwartet rot). Für den Merge-Commit `dc78f0c` von #111 selbst lief keine Standardauswahl; bestätigt war dort der Lauf 45067956391 auf dem Head `477cfaa` des gemergten Branches.

**Abnahme #111:** Die Windows-Abnahme mit gesicherter Kopie der echten Profildaten wurde laut Master Wayne vor dem Merge durchgeführt und als erfolgreich gemeldet; das Ergebnisblatt ist nicht Teil des Repositorys und wurde von Claude nicht eingesehen.

**Windows:** Start über `START_TERMINAL.bat` (Python 3, lokale Dateibrücke; ruft `START_3D.bat` auf) oder `START_3D.bat` allein (ohne Brücke). Linux: `START.sh`. Die lokale, nicht versionierte `kartenschluessel.js` (Kartenschlüssel) wird von `index.html` eingebunden und soll neben `index.html` liegen; ihr Fehlen wurde für diese Dokumentation nicht getestet. Zustand, Profil und Anhänge liegen im Browserprofil im Ordner `profil` neben dem Starter, das lokale Archiv im Ordner `pgcl-eu3.arch07`.

## 2. Offene Pull Requests (nicht in `main`)

| PR | Inhalt | Stand |
|---|---|---|
| #55 | alter Entwurf zu `CLAUDE.md` | veraltet, durch die neue `CLAUDE.md` (#112) ersetzt; Schließen erst nach Freigabe |

Zurzeit ist außer #55 kein Pull Request offen (Stand 24.11.2026, nach dem Merge von #131 und #132). Pull Requests werden hier nur geführt, solange sie offen sind. Was nur in einem offenen PR gilt, gehört nicht in Abschnitt 1.

## 3. Reihenfolge der nächsten Schritte (bestätigt am 22.11.2026)

Phase 5 gilt mit dem Merge von #124 als abgeschlossen (Reihenfolge: zuerst #123, `67e1279`, dann #124); die verbleibenden optionalen Bereinigungen stehen als Backlog in [phase5-abschluss.md](phase5-abschluss.md), Phase 6 ist damit eröffnet (Punkt 5). Erledigt, jeweils in `main`: #111 (Phase 5c1b), die Dokumentationsstände #112 und #113, die dauerhafte CI #114, die Entfernung der phasengebundenen Workflows #115, die Tageszeit-Korrektur des Tests `terminal-link-kette` #117 Phase 5c2a #116 (verbliebene Missionsdaten im Dossier ausgeblendet, Entscheidung C) und Phase 5c2b (a) #118 (stillgelegter Tick-Block, Helfer und `widerspruchOffen()` entfernt).

1. **5c2b** (verbliebenen `ALT()`-Rest-Code nach Referenzprüfung entfernen; Altformatmigration `SCENARIO.missionen`, `buildInitialStateV4` und gespeicherter Altbestand bleiben geschützt, Punkt 3). Grundsatz (Master Wayne, 23.11.2026): Eine Funktion wird nur bei nachgewiesener Unerreichbarkeit oder fehlender fachlicher Bedeutung entfernt, nicht wegen weniger Referenzen. Aufteilung:
   - **(a)** stillgelegter Tick-Block, seine Helfer und `widerspruchOffen()`: erledigt (#118; Review von ChatGPT und Merge-Freigabe durch Master Wayne am 23.11.2026).
   - **(b)** `aussagenListe()` und `IZ()`: Tests auf direkte Altbestand-Zugriffe umstellen; bei `IZ()` je Test unterscheiden, ob er historisches Verhalten dokumentiert oder eine produktive Funktion absichert, kein pauschales Ersetzen. erledigt (#119; Review von ChatGPT und Merge-Freigabe durch Master Wayne am 23.11.2026). Die drei Entkopplungstests `phase5b4-arbeitszugang`, `sichtung-export` und `terminal-namensnavigation` prüfen seitdem ausdrücklich nur den Zustand ohne Altbestand; die Teststärkung mit einem migrierten Format-4-Zustand ist mit #121 umgesetzt. Die 50 Nicht-Standardskripte mit `IZ()` waren auf `main` bereits rot und sind einzeln zu bewerten, bevor sie ausgemustert werden (eigene Entscheidung).
   - **(c)** Entwicklerkonsole (`Dev.startJetzt()`, `START_VORGEZOGEN`, `einsatzLaeuft()`) und Texte in `SCENARIO.abfragen.aussagen`: analysiert (#120); Entscheidungen D1 bis D5 in [phase5-abschluss.md](phase5-abschluss.md), D2 umgesetzt als #123, der Rest ist Backlog.
2. **CI-Konsolidierung** (abgeschlossen mit #114 und #115): `.github/workflows/ci.yml` ist der einzige Workflow (Pull Requests gegen `main`, Push auf `main`, manuell; Python-Brückentest, Syntaxprüfung, vollständige Standardauswahl). Die zwölf früheren phasengebundenen Workflows sind entfernt und in der Git-Historie einsehbar. Der Sonderlauf von `dossier-sperre` ist in die Standardauswahl übernommen; die übrigen Sondertests der alten Workflows (`zn`, `zev`, `al`, `zb`, `ds2`, `ak2`) sind als historisch markiert und nur namentlich aufrufbar. Offen: Branch-Schutz (nur auf Entscheidung von Master Wayne) und die weitere Absicherung der `lage-box`-Einschränkung (`BEKANNT_NUR`) im Test-Runner.
3. **5c2:** in zwei Schritten, Daten im Altbestand bleiben erhalten. **5c2a** ist erledigt (Darstellung ausgeblendet, #116). **5c2b** baut auf dem integrierten Stand von 5c2a auf; (a) und (b) sind erledigt (#118, #119, Teststärkung #121), (c) ist analysiert (#120) und mit D2 (#123) teilweise umgesetzt.
4. **Branch-Bereinigung:** nur nach Abgleich und ausdrücklicher Freigabe.
5. **Phase 6 (eröffnet):** Unix-/Linux-Realismus im Terminal und schrittweise Englischumstellung ([terminal-entwicklungsplan-2026-11.md](terminal-entwicklungsplan-2026-11.md)), Modernisierung der Oberfläche modulweise. Phase 6a (Beginn mit `pwd`, `cd`, `ls`): Plan (#126) und Architekturabschnitt (#127) sind in `main`. Entschieden (Master Wayne, 23.11.2026): vertikaler Durchstich 6a-0 vor den GNU-konformen Verhaltensänderungen; Sichtbarkeit gesperrter Archivobjekte: Zielverhalten Variante B (Name ebenfalls geschützt), Umsetzung als eigene spätere Etappe. Die sechs Fragen aus Abschnitt 7 des Plans sind entschieden (Plan 7.1). `pwd` ist mit #130 als Bash-Builtin umgesetzt; `cd` ist mit #132 (`ec313af`) in `main`: Bash-Builtin, Archivpfade streng mit Groß- und Kleinschreibung (Entscheidung Master Wayne, 24.11.2026; nur für `cd`, `ls`/Tab/`cat` folgen mit späteren Etappen). Als Nächstes folgen `ls` (6a-3, 6a-4), vorab der Sicherheits-PR für Variante B, danach die Variablen (6a-5). 6a-0 ist mit #128 (`210a422`) in `main`; als Nächstes folgen getrennte, kleinere PRs für die GNU-konformen Änderungen (`pwd`, dann `cd`, dann `ls`) sowie die Umsetzung von Variante B. Die Entscheidung zum Sichtungs-Export ist mit #125 umgesetzt.

Weder die Bestätigung dieser Reihenfolge noch eine erfolgreiche CI ist eine Freigabe für Merge oder Löschung.

## 4. Repository, Branches und CI

- **Prüfstand 24.11.2026, gemessen über die GitHub-Schnittstelle vor dem Merge von #131 und nach dem Merge von #132:** 80 Branches (`main` und 79 weitere), 131 Pull Requests: 126 gemergt, 2 offen (#55, #131), 3 geschlossen ohne Merge (#48, #50, #75). Nach dem Merge von #131 rechnerisch 127 gemergt und 1 offen (#55). Die Branches gemergter PRs bestehen noch. Diese Zahlen sind nach jedem Merge zu prüfen.
- Von den 53 Branches gemergter PRs (Zählung vor den Merges von #111 und #112, deren Branches nicht eingerechnet sind) haben 52 keinen Commit, der nicht in `main` liegt. `test/parallelitaet` (PR #73) wurde per Squash gemergt; sein Inhalt ist in `main` enthalten (Diff des PR und des Merge-Commits zeilengleich). Gelöscht wird nichts ohne ausdrückliche Freigabe.
- Workflows: ausschließlich `ci.yml`. Die früheren zwölf `phase5*-regression.yml` wurden mit #115 entfernt; ihre damaligen Läufe (zuletzt 5c1b, 45067956391) bleiben als Nachweis auf GitHub einsehbar.

## 5. Offene Entscheidungen und Produktideen

1. **Alte Missionsdaten in der Darstellung:** entschieden am 22.11.2026 (Option C, ausblenden; Daten bleiben unverändert in `STATE.altbestand`) und mit 5c2a (#116) umgesetzt (Abschnitt 8c in [phase5c-schemainventar.md](phase5c-schemainventar.md)); die Entfernung des Rest-Codes erfolgte als 5c2b: (a) #118, (b) #119 und #121, (c) analysiert (#120), D2 als #123, Rest Backlog.
2. **Passwortsperre für das Modul Profil** (Produktidee, nicht Teil von Phase 5c): analog zur Sperre einzelner Dossiers, Entsperren über Eingabe oder Terminal. Offen für Vorschläge.
3. **Weitere Vormerkungen:** Notizfelder nur als „Bisherige Notizen“ sichtbar, wenn Text vorhanden ist; Entscheidung zu den Lichtbildern `l-9052` und `l-9053`; lokale Bereitstellung von MapLibre.
4. **Testbestand und Nicht-Standardskripte:** Umsetzungsstand und Backlog in [phase5-abschluss.md](phase5-abschluss.md), Abschnitte 3 und 4 (Teststärkung #121 und Inventur #122 sind in `main`; Ausmusterung, Abdeckungsprüfung und Testhygiene sind Backlog, jeweils eigene Entscheidung, nichts gelöscht).
5. **Veraltete Texte im Code** (nicht Gegenstand dieses Dokumentations-PR): der Dateikopf von `akten-modul.js` beschreibt noch Akten, Schwärzungen und Einsichtsanträge, produktiv zeigt die Ablage nur den lokalen Eingang (`renderAkten`); die Startfehlermeldung in `index.html` nennt noch `dialog.js` und `klassifikator.js`, die nicht mehr existieren. Bereinigung gehört zu 5c2 oder einer eigenen Runde. Ebenso trägt der Kopf von `docs/phase5c-schemainventar.md` noch „Reine Bestandsaufnahme, kein Code geändert“ mit Basis `c19b93b`; das Dokument ist Entscheidungshistorie, wird aber seit #111 auch für die Umsetzung herangezogen und sollte im Zuge von 5c2 aktualisiert werden.

## 6. Dokumentenlandkarte

| Gruppe | Dokumente |
|---|---|
| Verbindlich | [CLAUDE.md](../CLAUDE.md) (Regeln), diese Datei (Stand), [terminal-entwicklungsplan-2026-11.md](terminal-entwicklungsplan-2026-11.md) (Prinzipien, Windows-Testpaketregel; die genannten PRs #95 bis #97 sind Historie), [datenvertrag.md](datenvertrag.md) (Fälle, Recherche, Fallpakete), [karte-optimierungen.md](karte-optimierungen.md) (einschließlich Verbot der Kartenvereinfachung), [terminal.md](terminal.md) (Terminalsemantik) |
| Entscheidungshistorie | [phase5c-schemainventar.md](phase5c-schemainventar.md) (Migration und Prüfhistorie), [phase5-missionsinventar.md](phase5-missionsinventar.md) |
| Historisch (Archiv) | [missionsabhaengigkeiten.md](missionsabhaengigkeiten.md), [r5-bereinigung.md](r5-bereinigung.md), [r5-kandidaten.md](r5-kandidaten.md), die Testpakete `TESTPAKET_01` bis `04` im Hauptordner, Screenshots unter `pr/` |
| Prüfanleitung | [windows-einzeltest-archivnamen.md](windows-einzeltest-archivnamen.md) (Archivdateinamen und Dossiersperre unter Windows) |

Historische Dokumente werden nicht gelöscht; eine Umorganisation nach `docs/historie/` erfolgt erst nach einer Prüfung der Verweise.
