# Shadow Terminal – aktueller Stand

**Stand:** 22.11.2026, geprüft gegen `main` `2a73008c736df94e508e2b2319955bfa83c45962` und GitHub (Pull Requests, Branches, Workflows).

Diese Datei ist die zentrale Statusdatei. Sie trennt streng zwischen dem, was **in `main`** gilt, und dem, was nur in **offenen Pull Requests** vorliegt. Pflege: bei jedem Merge in `main` aktualisieren, Stand und `main`-Commit nachführen. Entwicklungsregeln stehen in [CLAUDE.md](../CLAUDE.md), nicht hier.

## 1. Stand von `main`

**Produkt:** Lokales Recherchewerkzeug (Vanilla JavaScript, ohne Build-Schritt, `file://`-fähig) in der Oberfläche eines Feldterminals. Früher ein Spiel, heute ein Werkzeug. Module: Profil, Dossiers, Karte, Ablage, X; dazu ein Terminal (Profanity, tmux, PPP, PREDICT, echtes Nmap über die lokale Brücke). Die Karte (2D und 3D, Pins, Profilzonen, Ebenen, Messung, Protokoll, Wetter, Verknüpfungen) ist ausdrücklich nicht zu vereinfachen; verbessert werden dürfen Auflösung, Zoom, Bedienung und Performance. Visuelle Identität einschließlich Libelle bleibt erhalten.

**Zustandsformat:** `STATE_VERSION = 4` (`index.html`). Der Zustand enthält weiterhin die Felder der alten Missionsstruktur; `SCENARIO.missionen` wird für die Überführung älterer Formate (2 und 3) benötigt und bleibt.

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

Vorangegangen: Terminal-`sudo`, Namensnavigation und Archivkatalog sowie Test-Baseline und Entwicklungsplan (#93 bis #97); Doku zu Karten-Konsolenbefunden (#107). Manuelle Dossiersperren, Pin- und Zonenzugriff über `zielZugang` und Profilkompatibilität sind erhalten.

**Tests:** `node tests/runall.js` führt die Standardauswahl aus (in `main` 89 Skripte, Playwright, Passwort `pw-test-123`). Historische Skripte des stillgelegten Missionsablaufs sind nur namentlich aufrufbar. Als instabil bekannt: `wk3`, `dp`, `m1flow` (Missionsablauf, auch auf `main` rot) und `lage-box` unter Parallellast. Bestätigung der Läufe erfolgt über GitHub Actions; die Workflows sind phasen- und branchgebunden (siehe Abschnitt 4).

**Windows:** Start über `START_TERMINAL.bat` (Python 3, lokale Dateibrücke; ruft `START_3D.bat` auf) oder `START_3D.bat` allein (ohne Brücke). Linux: `START.sh`. Die lokale, nicht versionierte `kartenschluessel.js` (Kartenschlüssel) wird von `index.html` eingebunden und soll neben `index.html` liegen; ihr Fehlen wurde für diese Dokumentation nicht getestet. Zustand, Profil und Anhänge liegen im Browserprofil im Ordner `profil` neben dem Starter, das lokale Archiv im Ordner `pgcl-eu3.arch07`.

## 2. Offene Pull Requests (nicht in `main`)

| PR | Inhalt | Stand |
|---|---|---|
| #111 | Phase 5c1b: Zustandsformat 5 mit Altbestand (`STATE.altbestand`), Rohsicherung, verlustfreie Überführung, Entkopplung von P-0001 bis P-0003 und der Adresse in der Kopfzeile | **Draft.** Head `477cfaa`. Actions-Lauf 45067956391: gezielte Regression 21 und Standardauswahl 91 grün. Unabhängiges Review (ChatGPT) positiv. **Offen:** Windows-Abnahme mit gesicherter Kopie echter Daten; Merge-Freigabe durch Master Wayne. |
| #55 | alter Entwurf zu `CLAUDE.md` | veraltet, wird durch die neue `CLAUDE.md` ersetzt; Schließen erst nach Freigabe |

Alles, was nur #111 betrifft, gilt **nicht** für `main`. Insbesondere Format 5 und `ALT()` existieren dort noch nicht.

**Hinweis zu #111 für die spätere Nutzung:** Ein auf Format 5 überführtes Profil darf nicht mehr mit einem Stand vor #111 geöffnet werden. Der ältere Stand erkennt Format 5 nicht, legt den Zustand roh unter `fieldterminal.v1.defekt` ab und beginnt mit einem neuen Zustand. Rückweg nur über eine Kopie des Ordners `profil` oder die Sicherung `fieldterminal.v1.v4-sicherung`.

## 3. Reihenfolge der nächsten Schritte (bestätigt am 22.11.2026)

1. **#111:** Windows-Abnahme mit gesicherter Kopie der Profildaten, danach Entscheidung über den Merge durch Master Wayne.
2. **Dokumentation** (dieser PR) parallel zur Windows-Abnahme; nur Dokumentation.
3. **CI-Konsolidierung** nach dem Merge von #111 und vor 5c2: dauerhafte Prüfung für Pull Requests und `main`, danach Entfernen der phasengebundenen Workflows und erst dann Branch-Schutz.
4. **5c2:** verbliebene Altzugriffe auf Missionsfelder entfernen, Daten im Altbestand bewahren. Vorher gesonderte Entscheidung (Abschnitt 5, Punkt 1).
5. **Branch-Bereinigung:** nur nach Abgleich und ausdrücklicher Freigabe.
6. **Phase 6:** Unix-/Linux-Realismus im Terminal und schrittweise Englischumstellung ([terminal-entwicklungsplan-2026-11.md](terminal-entwicklungsplan-2026-11.md)), Modernisierung der Oberfläche modulweise.

Weder die Bestätigung dieser Reihenfolge noch eine erfolgreiche CI ist eine Freigabe für Merge oder Löschung.

## 4. Repository, Branches und CI

- 59 Branches (`main` und 58 weitere), 110 Pull Requests: 105 gemergt, 2 offen (#55, #111), 3 geschlossen ohne Merge (#48, #50, #75). `main` ist nicht geschützt.
- Von den 53 Branches gemergter PRs haben 52 keinen Commit, der nicht in `main` liegt. `test/parallelitaet` (PR #73) wurde per Squash gemergt; sein Inhalt ist in `main` enthalten (Diff des PR und des Merge-Commits zeilengleich). Gelöscht wird nichts ohne ausdrückliche Freigabe.
- Auf `main` liegen elf phasenbezogene Workflows (5a, 5b1 bis 5b9, 5c1a), der zwölfte (5c1b) nur auf dem Branch von #111. Alle laufen ausschließlich bei Pushes auf ihren Entwicklungsbranch.

## 5. Offene Entscheidungen und Produktideen

1. **Alte Missionsdaten in der Darstellung** (vor 5c2): Sie fließen heute in Erkenntnislage, die Tabelle „Aussagen des Agenten“, Belege und Adresshinweise ein. Optionen: belassen, in eigene Dossierdaten überführen oder ausblenden. Die Daten selbst bleiben in jedem Fall erhalten.
2. **Passwortsperre für das Modul Profil** (Produktidee, nicht Teil von Phase 5c): analog zur Sperre einzelner Dossiers, Entsperren über Eingabe oder Terminal. Offen für Vorschläge.
3. **Weitere Vormerkungen:** Notizfelder nur als „Bisherige Notizen“ sichtbar, wenn Text vorhanden ist; Entscheidung zu den Lichtbildern `l-9052` und `l-9053`; lokale Bereitstellung von MapLibre.
4. **Veraltete Texte im Code** (nicht Gegenstand dieses Dokumentations-PR): der Dateikopf von `akten-modul.js` beschreibt noch Akten, Schwärzungen und Einsichtsanträge, produktiv zeigt die Ablage nur den lokalen Eingang (`renderAkten`); die Startfehlermeldung in `index.html` nennt noch `dialog.js` und `klassifikator.js`, die nicht mehr existieren. Bereinigung gehört zu 5c2 oder einer eigenen Runde.

## 6. Dokumentenlandkarte

| Gruppe | Dokumente |
|---|---|
| Verbindlich | [CLAUDE.md](../CLAUDE.md) (Regeln), diese Datei (Stand), [terminal-entwicklungsplan-2026-11.md](terminal-entwicklungsplan-2026-11.md) (Prinzipien, Windows-Testpaketregel; die genannten PRs #95 bis #97 sind Historie), [datenvertrag.md](datenvertrag.md) (Fälle, Recherche, Fallpakete), [karte-optimierungen.md](karte-optimierungen.md) (einschließlich Verbot der Kartenvereinfachung), [terminal.md](terminal.md) (Terminalsemantik) |
| Entscheidungshistorie | [phase5c-schemainventar.md](phase5c-schemainventar.md) (Migration und Prüfhistorie), [phase5-missionsinventar.md](phase5-missionsinventar.md) |
| Historisch (Archiv) | [missionsabhaengigkeiten.md](missionsabhaengigkeiten.md), [r5-bereinigung.md](r5-bereinigung.md), [r5-kandidaten.md](r5-kandidaten.md), die Testpakete `TESTPAKET_01` bis `04` im Hauptordner, Screenshots unter `pr/` |
| Prüfanleitung | [windows-einzeltest-archivnamen.md](windows-einzeltest-archivnamen.md) (Archivdateinamen und Dossiersperre unter Windows) |

Historische Dokumente werden nicht gelöscht; eine Umorganisation nach `docs/historie/` erfolgt erst nach einer Prüfung der Verweise.
