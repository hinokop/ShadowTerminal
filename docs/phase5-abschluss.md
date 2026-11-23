# Phase 5: Abschluss und Backlog

Stand: 23.11.2026. Dieses Dokument schließt die Phase 5 (Abbau der alten Missionsmechanik) fachlich ab und hält fest, was bewusst offen bleibt. Der laufende Stand von `main` steht in [AKTUELL.md](AKTUELL.md); die Umsetzungsgeschichte in [phase5c-schemainventar.md](phase5c-schemainventar.md) und [phase5-missionsinventar.md](phase5-missionsinventar.md).

## 1. Grundlage des Abschlusses

Gesamturteil von Master Wayne am 23.11.2026 (Empfehlung der unabhängigen Prüfung, Freigabe erteilt): Es liegen genügend Informationen vor, um die große Bereinigungsphase kontrolliert zu beenden; die verbliebenen Schwächen rechtfertigen keinen unbefristeten Aufschub der Weiterentwicklung.

In `main` integriert am 23.11.2026 nach technischer Freigabe und Review durch ChatGPT: #121 (Teststärkung 5c2b (b), Merge-Commit `5501b38`), #122 (Inventur der Nicht-Standardskripte, `d6753b8`) und #120 (Analyse 5c2b (c), `072c2d3`). Die Dokumente #120 und #122 gelten als Entscheidungsdokumentation mit den dort ausdrücklich genannten Messgrenzen: Alle Messwerte stammen aus einzelnen Läufen des Autors in einer Sandbox und wurden nicht unabhängig reproduziert; „grün“ im Messwerkzeug bedeutet nur Exit-Code 0 ohne Fehlermuster; Abdeckungshinweise beruhen auf Textsuche.

## 2. Umgesetzt (Phase 5, Auswahl nach Teilphase)

Die vollständige Tabelle mit Pull-Request-Nummern steht in Abschnitt 1 von [AKTUELL.md](AKTUELL.md). Ergebnis: Der aktive Zustand (`STATE_VERSION = 5`) enthält keine Missionsfelder; Altdaten liegen unverändert in `STATE.altbestand`; Zugriff auf Dossiers, Pins und Zonen richtet sich nur nach manuellen Dossiersperren; der Missionsbetrieb ist stillgelegt und der Missionskern entfernt. Mit #121 sind die drei Entkopplungstests zusätzlich gegen einen migrierten Format-4-Zustand mit historischen Freigabestufen abgesichert.

## 3. Entscheidungen aus der Analyse zu 5c2b (c)

| Nr. | Entscheidung (Empfehlung der Prüfung, von Master Wayne freigegeben) | Stand |
|---|---|---|
| D1 | Entwicklerkonsole nicht pauschal entfernen; `Dev.startJetzt()` als unbrauchbar kennzeichnen und in einem getrennten, geprüften Mini-PR entfernen oder durch eine Diagnosemeldung ersetzen | Backlog |
| D2 | Doppelte Deklaration `sichtungText` beseitigen, Exportverhalten erhalten | Umgesetzt als Draft #123 (Merge nach CI und Freigabe) |
| D3 | `SCENARIO.abfragen` und `dokumentPruefung` erst nach D2 und erneuter Referenzprüfung entfernen; Szenariotext bleibt in der Git-Historie; keine Nutzer- oder Altbestandsdaten löschen; keine Voraussetzung für Phase 6 | Backlog |
| D4 | Tote Funktionen `fensterNach`, `fensterListe`, `fristMs`, `neuverbinden` als kleiner, eigener, testgesicherter Cleanup zulässig; `fmtRest` und `fmtDauer` bleiben | Backlog |
| D5 | `dokZeile`, `legendeListe`, `missionsbetrieb`, `karteOhneMission` vorerst als testgestützte Invarianten behalten, nicht allein wegen fehlender produktiver Aufrufer entfernen | Entschieden: behalten |

## 4. Backlog (nicht Voraussetzung für Phase 6)

Jeder Punkt ist eine eigene Entscheidung und wird, wenn überhaupt, als eigener Draft-PR mit Test umgesetzt.

1. **D1, D3, D4** wie in Abschnitt 3.
2. **Nicht-Standardskripte** ([phase5c2b-inventur-nichtstandard.md](phase5c2b-inventur-nichtstandard.md), Abschnitt 7): 31 nicht historisch markierte Skripte mit entferntem Funktionsumfang als Rückbaukandidaten vormerken (keine automatische Löschung); die elf historisch markierten aufbewahren; die acht produktnahen Fälle (`ks`, `kv2`, `kv4`, `rt`, `ag`, `ed`, `th`, `tn`) vor jeder Ausmusterung auf bestehende Abdeckung prüfen und gegebenenfalls als Standardtest neu formulieren; `zp` (historisch markiert, Kartenbezug) bei dieser Prüfung mitsehen; `karten-txt-export` und `eigene-zonen` (rot, Ursache nicht untersucht) gesondert behandeln. Die Nicht-Standardskripte erweitern die CI nicht automatisch.
3. **Testhygiene in der Standardauswahl:** `sichtung-export` und `terminal-namensnavigation` rufen entfernte Aktionstypen (`MISSION_ZUGEWIESEN`, `MISSION_ANGENOMMEN`) per `dispatch` auf, die ohne Wirkung bleiben; gezielt entfernen, ohne die Frischzustandsprüfungen zu verändern. Im Hilfsmodul `tests/_altzustand.js` ist die Formulierung „bytegleich“ zu stark (verglichen wird strukturell per `deepEqual`); bei Gelegenheit in „strukturell unverändert“ ändern.
4. **TXT-Export einer Sichtung, Zeile „Güte“** (neuer Befund, bei der Prüfung von D2 festgestellt, nicht geändert): Die Zeile enthält zurzeit `[object HTMLSpanElement]`, weil `gueteLabel()` ein DOM-Element liefert, das `karte-modul.js` als Text verkettet; außerdem ruft `karte-modul.js` `sichtungGuete(e, si)` auf, die Funktion in `index.html` hat nur den Parameter `s`. Gesonderte Entscheidung über den gewünschten Text nötig; der Test `phase5c2b-sichtungtext` normalisiert diese Zeile ausdrücklich.
5. **Veraltete Texte im Code:** Dateikopf von `akten-modul.js`; Startfehlermeldung in `index.html` nennt `dialog.js` und `klassifikator.js`; Kopf von `phase5c-schemainventar.md` („Reine Bestandsaufnahme“).
6. **Repository:** Branches gemergter Pull Requests bereinigen, #55 schließen, Branch-Schutz für `main`: jeweils nur nach ausdrücklicher Freigabe.
7. **Produktideen und Vormerkungen** (unverändert aus [AKTUELL.md](AKTUELL.md), Abschnitt 5): Passwortsperre für das Modul Profil; Notizfelder nur bei vorhandenem Text; Lichtbilder `l-9052` und `l-9053`; lokale Bereitstellung von MapLibre.

## 5. Offene Risiken und Grenzen

- Das Verhalten mit echten, umfangreichen Nutzerprofilen über die Fixture hinaus ist durch die Windows-Abnahme von #111 abgedeckt, nicht durch spätere Änderungen; für umfassende GUI-Änderungen bleibt ein Windows-Testpaket vorgesehen (Regel im Entwicklungsplan).
- Lokal sind in der Entwicklungsumgebung des Autors acht Standardtests auch auf unverändertem `main` rot; maßgeblich ist die CI.
- Die Inventur und die Analyse sind einzelne Messungen; sie belegen keine Qualität und keine Testabdeckung.

## 6. Phase 6 (eröffnet mit Merge dieses Dokuments)

Rückkehr zur funktionalen Weiterentwicklung gemäß [terminal-entwicklungsplan-2026-11.md](terminal-entwicklungsplan-2026-11.md): Unix-/Linux-Realismus im Terminal („reale Vorbilder vor Sonderbefehlen“), schrittweise Englischumstellung der sichtbaren Terminalmeldungen und Oberfläche (jede Etappe mit Dokumentation und wortlautabhängigen Tests) und modulweise Modernisierung der Oberfläche. Die erste Etappe wird auf Vorschlag von Claude und Entscheidung von Master Wayne festgelegt; hier ist noch nichts beschlossen.
