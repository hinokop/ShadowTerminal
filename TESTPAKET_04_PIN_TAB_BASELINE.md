# Testpaket 04 – PIN-Tab-Baseline und Entwicklungsplan

**Statusvermerk (22.11.2026):** PR #97 ist in `main` gemergt. Historisches Dokument; der Inhalt unten beschreibt den Stand zum Zeitpunkt der Erstellung und wurde nicht aktualisiert. Den aktuellen Stand führt [docs/AKTUELL.md](docs/AKTUELL.md).

**Hinweis (Präzisierung vom 21.11.2026):** Dies ist eine bereits angelegte **optionale Einzelprüfanleitung** für die Baseline. Nach der aktuellen Projektregel werden neue nummerierte Windows-Testpakete grundsätzlich nur noch erstellt, wenn ein umfassender manueller Oberflächen-/Integrationstest unter Windows geplant ist. Für diesen reinen Test-Fix ist kein vollständiger Windows-Praxistest nötig.

**Branch:** `fix/pin-tab-test-und-entwicklungsplan-20261121` (Draft-PR gegen `main`).  
**Änderungsart:** ausschließlich Testkorrektur und Dokumentation; kein Produktcode geändert.  
**Geprüfter Commit:** bitte beim Test mit `git rev-parse HEAD` beziehungsweise mit der GitHub-PR-Head-SHA erfassen; nicht nur den Branchnamen protokollieren.  
**Automatisierte Ausführung durch den PR-Ersteller:** noch **nicht erfolgt**; die Anpassung wurde anhand des bestehenden Tests und der Auflösung mehrdeutiger PIN-Kennungen geprüft.

## Vorbereitung auf Windows 11

1. Branch-ZIP von GitHub in einen **separaten Testordner** entpacken (nicht die bestehende Installation überschreiben); alternativ den Branch auschecken.
2. Die private, lokal vorhandene `kartenschluessel.js` in den Testordner kopieren. Diese Datei nie committen oder weitergeben. Für Testdaten ggf. ein separates Profil verwenden; vorher vorhandene Profile sichern.
3. Node.js und die zum Projekt gehörende Playwright-Testinstallation bereitstellen. Die Benutzeranmeldung der Tests verwendet `pw-test-123`.
4. `START_TERMINAL.bat` ist für einen manuellen Funktionsblick verfügbar, für die isolierte Korrektur eines Testskripts jedoch **nicht zwingend** erforderlich.

## Gezielter Test (PowerShell)

Aus dem Wurzelverzeichnis:

```powershell
cd tests
$env:FT_PARALLEL = "2"
node runall.js terminal-pin-suche
```

**Soll:** `terminal-pin-suche` grün. Das Skript legt mehrere Pins an, darunter einen an ein gesperrtes Dossier gebundenen PIN. Der Präfix `PIN-00` führt bei mehreren passenden Kennungen in eine Auswahlliste. Die Kennung des gesperrten Pins muss dort vorhanden bleiben, sein Klarname darf nicht erscheinen. `Tab`/ `Enter` übernehmen lediglich einen Kandidaten; die Auswahl darf keinen Befehl ausführen. Spätere Sperr- und Entsperrprüfungen bleiben wirksam.

**Wichtige Negativbedingung:** Der Test darf keine eindeutige automatische Ergänzung aus einem mehrdeutigen Präfix verlangen. Die Produktlogik wird nicht verändert.

## Regressionen

```powershell
node runall.js terminal-pin-suche terminal-navigation terminal-sudo karte-sperre-pins terminal-befehlstabelle terminal-auswahlliste terminal-vorschlag-ergaenzung
node runall.js
```

Die vollständige Standardauswahl kann historisch unabhängige Probleme ausweisen (`m1flow`, unter Umständen `dp`, `wk3` und Parallelitätsinstabilitäten). Jeden roten Test mit genauer Meldung dokumentieren und nicht pauschal der hier vorgenommenen Testkorrektur zuschreiben. Werden Produktfehler gefunden, ist ein neuer gezielter Fix erforderlich.

## Optionaler manueller Test im Terminal

In einem separaten Profil mehrere Pins (`PIN-001`, `PIN-002` usw.) anlegen, mindestens einen an ein manuell gesperrtes Dossier binden. Terminal öffnen und `map PIN-00<Tab>` eingeben.

**Soll:** Auswahl mehrerer Kennungen statt willkürlicher Vervollständigung; gesperrte Kennung sichtbar, geschützter Name nicht. Erneute Eingabe einer vollständigen gesperrten Kennung ohne Berechtigung muss `Permission denied` liefern. Der bisherige `map`-/`open`-Funktionsumfang von `main` bleibt unverändert. Die in Draft #96 geplante Trennung ist ausdrücklich **noch nicht** Bestandteil dieses Testpakets.

## Rückmeldung

- Testdatum / Windows- und Browser-Version:
- Branch / Commit (SHA):
- Gezielter Test: grün / rot / nicht ausgeführt:
- Regressionsauswahl: grün / rot / nicht ausgeführt:
- Vollständige Standardauswahl: grün / rot / nicht ausgeführt:
- Bei rot: Skript, exakte Assertion, Screenshot/Log:
- Abweichungen gegenüber `main`:
- Freigabe zur Integration: ausdrücklich durch Shadow und ChatGPT nach Code-/Testergebnisprüfung.
