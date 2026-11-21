# Phase 5 – Inventar der alten Mission und Abbau in kleinen Schritten

Stand: 22.11.2026. Basis: `main` nach Merge von #98 (`a54ef5f82ac1`).
**Arbeitsdokument für Phase 5; Phase 5a abgeschlossen, Phase 5b1 ist ein neuer, noch ungeprüfter Draft. Keine Behauptung einer vollständig entfernten Missionsmechanik.**
Vor weiteren Codeänderungen gegen den aktuellen Head überprüfen. Historische Bestandsaufnahme: [missionsabhaengigkeiten.md](missionsabhaengigkeiten.md).

## Trennlinien

**Behalten (produktives Recherchewerkzeug):**
- Profilweite Dossiers (auch `SCENARIO.entitaeten` und `SCENARIO.standard.dossiers`, soweit für vorhandene Profile als Grundbestand benötigt), ihre Kennungen, Karte, Sichtungen, eigene Pins und Profilzonen, Fall-/Dossierverknüpfungen.
- `PROFIL.gesperrt`, `dossierGesperrt`, `pinGesperrt`, `zoneGesperrt`, `zielZugang` mit manueller Sperre, Passwortabfrage über `sudo`, verbundene Archivberechtigung und Scrollbackbereinigung.
- Profilimport/-export, gespeicherte Altbestände, Fallpakete, lokale Anlagen, Prüfsummen, Recherche- und Arbeitsstandmodule.
- Terminal- und Satellitenkette unabhängig von Mission, weiterhin nur die bewusst freigegebene lokale Brücke und kein allgemeiner Host-Shell-Zugang.

**Entfernen (historische Spiel-/Auftragsmechanik):**
- Missions-/Ansprechpartnerfreigabe nach `wissen` / `infoGesperrt` / `STATE.infozugang`, Rudiment-/Anfrage-/Freigabemasken.
- Auftragsfortschritt, Zuweisung und Status, `MISSIONS_AKTIONEN`, Missionsreducer und Handler, `zustandAus`/`abdPruefen`, Kontakt-/Nachrichten-/Extraktions-/Melde- und andere Timer der ursprünglichen Missionskette.
- Kartenebenen, Buttons und Tests, die nur den historischen Auftragsmodus aktivieren.

**Altdaten zunächst tolerieren:** `STATE.infozugang`, `STATE.missionsbetrieb`, `STATE.missionen`, `STATE.plan`, `STATE.komm`, `STATE.extraktion`, `STATE.kw` und weitere Altfelder. Nicht still löschen oder bei einem Import verwerfen. Die tatsächliche Datenmigration wird gesondert implementiert und getestet.

## Relevante Fundstellen und Risiken

| Bereich | Tatsächliche Abhängigkeiten | Rückbau / Risiko |
| --- | --- | --- |
| Dossiers und Namensauflösung | `index.html`: `wissen`, `infoFrei`, `infoGesperrt`, `dossierOffen`, `pool`, `dossierAnsicht`, `rudimentAnsicht`; `profil-modul.js`: `terminalDossierNameLesbar` | **5a:** Eigenen Recherchebestand sowie manuelle Terminalzugriffsprüfung einführen. Historische Wissenszustände für Missions-/Admiralty-Abläufe vorläufig erhalten. Die eingeschränkte Rudimentansicht und weitere Missionstore erst in 5b nach Tests entfernen |
| Altprofil und Erststart | `index.html`: `buildInitialState`, `isValidState`, `migrate`, `init`, `szenarioFehlt`; Szenariodaten `szenario.js` | **5c:** Forschungsdaten von Missionsschema entkoppeln; Altprofile ohne Datenverlust importieren. Kein Löschen von Szenariodossiers |
| Ereignisse und Hintergrund | `dispatch`, `MISSIONS_AKTIONEN`, `missionsbetrieb`, `tick`, `zustandAus`, `abdPruefen`, `SITZUNG_START` | **5b:** Zeitgeber, Auftrags- und Kontaktfolgen sauber isolieren/entfernen; allgemeine Uhr, Zugang-Leerlauf und Terminal-Schutz-Hook erhalten |
| Karte und Dossier-Extras | `karte-modul.js`: `karteOhneMission`, `karteAuftragsansicht`, `VIEW.missionsansicht`; `index.html`: `freigeschaltet`, `bedrohung`, historische Nachträge | **5b/5c:** Legacy-Ausgaben mit ihren Datenherkünften inventarisieren; keine alten Missionsbehauptungen ungeprüft als aktuelle Recherchebelege übernehmen |
| Freigabe-/Auftragsmasken | `rudimentAnsicht`, `IZ`, `infoStufe`, Freigabe-/Nachfrageaktionen und Dialogregeln | **5b:** UI-/Reducer-Fundstellen nach geprüftem 5a entfernen. Nur missionseigene Funktionen löschen, nicht ähnliche Produktfunktionen |
| Tests | `terminal-sudo`, `terminal-namensnavigation` prüfen bisher den alten Kontaktmechanismus; `al`, `zb`, `ds2` prüfen den Wissensstand sowie Admiralty-Einschätzungen, Skriptübergänge und die Rudimentoberfläche; `missionstrennung`, `m1flow` den historischen Ablauf | **5a:** Zugriffs- und Erkenntniszustand separat testen, alle alten Regressionen unverändert in der Standardauswahl behalten. Historische Ablauftests erst bei explizitem 5b-Abbau einzeln klassifizieren, nicht zur Verschleierung fehlschlagender Tests entfernen |
| Weitere Altdaten | `docs/datenvertrag.md` definiert Fallpakete und unabhängigen Recherchekern | Import-/Exportintegrität, alte Dossiernummern und ursprüngliche JSON-Felder durch Regression schützen |

## Phase 5a – abgeschlossen mit PR #98

1. **Rücknahme des fehlerhaften Prototyps:** `wissen(e)` und `dossierOffen(mid)` sind gegenüber `main` unverändert. Eine pauschale Rückgabe `'frei'` hatte nach Claudes Lauf drei reproduzierbare Regressionen ausgelöst: `al`, `zb`, `ds2` (Admiralty-Einschätzung, Skriptereignis, Rudimentansicht). Diese Verknüpfungen gelten als **produktive/legacy-relevante Abhängigkeiten** und werden nicht stillgelegt.
2. `dossierRechercheBestand()` trennt den Rechercheindex vom historischen `pool()` und von alten Missionsfreigaben. Die Dossierliste und der gewählte Dossierbezug nutzen diesen Bestand. `zielZugang` verwendet den Bestand und setzt für Dossiers `info: false`; die **manuelle Sperre** bleibt maßgeblich.
3. Namensauflösung, Tab-Ergänzung und Verlaufsbereinigung im Terminal verwenden denselben Recherchebestand und die manuelle Sperre, nicht `infoGesperrt`. Auch eine historische Einstufung `bekannt` darf die Navigation nicht verweigern.
4. `terminal-sudo` und `terminal-namensnavigation` prüfen sowohl unveränderte historische Erkenntniszustände (`wissen`, `infoGesperrt`) als auch unabhängigen Terminalzugang, manuelle Sperren, Tab und Namenskollisionen.
5. **Bewusst noch vorhanden:** `dossierAnsicht` (Rudiment und Freigabemaske bei aktivierter historischer Mission), `infoGesperrt`-Prüfungen einiger Dossieraktionen und die Legacy-Kommunikations-/Missionslogik. Das schränkt die frühere Missionsansicht weiterhin ein und ist in 5b separat zu entfernen; für den gewöhnlichen Recherchebetrieb gelten diese alten Restriktionen bereits nicht. **5a ist nur eine sichere Entkopplungsstufe, keine vollständige Freigabe-Entfernung.**

**Prüfung vor Merge:** zuerst die kritischen Erkenntnis-/Missionsregressionen `node tests/runall.js al zb ds2 missionstrennung terminal-sudo terminal-namensnavigation`, dann `node tests/runall.js terminal-navigation terminal-pin-suche terminal-objektnavigation terminal-archiv-zugriff karte-sperre-pins dossier-einheitlich fallpaket sichtung-import`, schließlich `node tests/runall.js` auf exakt dokumentiertem Head. Alte `m1flow`-Fehler und neu auftretende Missionstestfehler ausdrücklich trennen. Keine automatischen Testergebnisse behaupten, bevor sie tatsächlich gelaufen sind. Windows-Gesamtpaket erst für die spätere zusammenhängende UI-Abnahme.

## Phase 5b1 – erster isolierter Berechtigungspfad (Draft)

**Befund aus `main` nach #98:** `karte-modul.js` → `kartenTxtExport` hat für `sichtung` bislang `infoGesperrt(entitaet(x.dossier))` geprüft. Bei ausdrücklich aktivierter Altmission blockiert dieser historische Ansprechpartnerstatus selbst eine gültige, *nicht manuell gesperrte* Sichtung. Das widerspricht dem in 5a festgelegten Recherchezugang.

**Änderung in 5b1:** Für den TXT-Export wird ausschließlich das Vorhandensein des verknüpften Dossiers sowie die **manuelle Dossiersperre** geprüft. Die Prüfung erfolgt weiterhin vor der Exportaktion und im Brückenmodus erneut vor dem Schreiben. Dateiidentität, Hash, Versionierung, Brückenrechte und die tatsächliche manuelle Sperre bleiben unverändert.

**Gezielter Test:** `tests/sichtung-export.js` aktiviert die Historienflagge, verwendet ein vorhandenes Standarddossier mit `wissen='bekannt'` und `infoGesperrt=true`, legt testweise eine Sichtung an und überprüft erfolgreichen Download. Anschließend sperrt er das Dossier manuell und prüft Fehlermeldung sowie das Ausbleiben des Downloads. Der restliche bestehende Sichtungs- und Brückenexporttest bleibt erhalten.

**Bewusst zurückgestellt:** Weitere `infoGesperrt`-Schranken in `karteMarker`, `karteBezugVon`, `renderDossier` und den Aktionen `VERBINDUNG_GELOESCHT`, `DOSSIER_BEARBEITET`, `DOSSIER_KURZLAGE` sowie `rudimentAnsicht`, `tick`, `MISSIONS_AKTIONEN`. Diese dürfen erst nach eigenem Nutzungsstellen- und Testabgleich fallen. Insbesondere darf die Historienkenntnis `wissen` weiterhin nicht pauschal überschrieben werden.

**Prüfung:** `node tests/runall.js sichtung-export terminal-archiv-zugriff karte-sperre-pins terminal-sudo al zb ds2`; danach vollständige Standardauswahl mit präzisem Head. Ein neuer Draft-PR erhält keinen automatischen Merge.

## Nächste isolierte Schritte nach Abnahme von 5a

- **5b:** Kontakt-/Freigabemasken, ungenutzte Missionsaktionen und die nur missionsgebundenen Nebenwirkungen/Timer entfernen; vorher Nutzungsstellen und automatisierte Tests je Einheit auflisten. Die `missionstrennung`- und `m1flow`-Tests dann bewusst in neu klassifizierte historische Tests überführen und positive Tests für nicht vorhandene Missionsfolgen anlegen.
- **5c:** Von der Missionsstruktur abhängige `isValidState`-/`buildInitialState`-/`migrate`- und Startbedingungen ablösen, bei Altprofilen erhaltene Dossiers und Recherchebestände nachweislich beibehalten. Erst danach ein großer Windows-Oberflächen- und Profilmigrationstest.
- **Anschließend Phase 6:** reale Unix-/Linux-Befehlsmatrix, konsistentes Dateisystem und berechenbare Exit-Codes; schrittweise englische UI. Die temporäre VAULT-Sprache ist dafür kein Zielzustand.

## Grenzen dieser Bestandsaufnahme

Basiert auf aktuellem `main`, dem früheren roten Claude-Testbericht (Head `c9c90b5`) und der abgeschlossenen CI-Prüfung von PR #98 (Head `8a16021`, 100 grün, null unerwartet rot). Echte Windows-Altprofile wurden nicht geprüft. Die vollständige Entfernung darf erst nach diesen Tests und einer eigenen Schlussabnahme behauptet werden.
