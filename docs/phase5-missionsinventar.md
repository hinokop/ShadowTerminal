# Phase 5 – Inventar der alten Mission und Abbau in kleinen Schritten

Stand: 22.11.2026. Basis: `main` nach Merge von #101 (`dca5059da6e0`).
**Arbeitsdokument für Phase 5; Phasen 5a, 5b1, 5b2 und 5b3 in `main`, Phase 5b4 als Draft. Keine Behauptung einer vollständig entfernten Missionsmechanik.**
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

## Phase 5b1 – erster isolierter Berechtigungspfad (PR #99 integriert)

**Befund aus `main` nach #98:** `karte-modul.js` → `kartenTxtExport` hat für `sichtung` bislang `infoGesperrt(entitaet(x.dossier))` geprüft. Bei ausdrücklich aktivierter Altmission blockiert dieser historische Ansprechpartnerstatus selbst eine gültige, *nicht manuell gesperrte* Sichtung. Das widerspricht dem in 5a festgelegten Recherchezugang.

**Änderung in 5b1:** Für den TXT-Export wird ausschließlich das Vorhandensein des verknüpften Dossiers sowie die **manuelle Dossiersperre** geprüft. Die Prüfung erfolgt weiterhin vor der Exportaktion und im Brückenmodus erneut vor dem Schreiben. Dateiidentität, Hash, Versionierung, Brückenrechte und die tatsächliche manuelle Sperre bleiben unverändert.

**Gezielter Test:** `tests/sichtung-export.js` aktiviert die Historienflagge, verwendet ein vorhandenes Standarddossier mit `wissen='bekannt'` und `infoGesperrt=true`, legt testweise eine Sichtung an und überprüft erfolgreichen Download. Anschließend sperrt er das Dossier manuell und prüft Fehlermeldung sowie das Ausbleiben des Downloads. Der restliche bestehende Sichtungs- und Brückenexporttest bleibt erhalten.

**Bewusst zurückgestellt:** Weitere `infoGesperrt`-Schranken in `karteMarker`, `karteBezugVon`, `renderDossier` und den Aktionen `VERBINDUNG_GELOESCHT`, `DOSSIER_BEARBEITET`, `DOSSIER_KURZLAGE` sowie `rudimentAnsicht`, `tick`, `MISSIONS_AKTIONEN`. Diese dürfen erst nach eigenem Nutzungsstellen- und Testabgleich fallen. Insbesondere darf die Historienkenntnis `wissen` weiterhin nicht pauschal überschrieben werden.

**Prüfung:** `node tests/runall.js sichtung-export terminal-archiv-zugriff karte-sperre-pins terminal-sudo al zb ds2`; danach vollständige Standardauswahl mit präzisem Head. Ein neuer Draft-PR erhält keinen automatischen Merge.

## Phase 5b2 – Karte und Dossierzusatzansichten (PR #100 integriert)

**Ausgangslage:** Nach PR #99 zeigten Karte und Dossier bei explizitem Altmissionsstatus weiterhin Zugriffsreste: `karteMarker`, `karteBezugVon` und Kartenortauflösung prüften `infoGesperrt`/das historische `pool()`; Dossier-Graph und Verbindungen waren über `kantenPool` an `wissen()`/`dossierOffen` gekoppelt; `renderDossier` blendete unabhängige Recherche- und Graph-Panels für ein bloß historisch beschränktes Dossier aus. Einige Dossier-Schreibaktionen verweigerten Änderungen allein wegen einer nicht angenommenen Mission.

**Geplanter Rückbau:**

- Kartenmarker (Dossiers, Sichtungen), Lagebezug, benannte Ortsauflösung und Dossierauswahl für Pin/Zone verwenden `dossierRechercheBestand`. `infoGesperrt` entfällt bei diesen Zugriffen. Gesperrte Dossiers und deren Sichtungen bleiben ausgeblendet; Dossier-Klarnamen sind in der Auswahl bei manueller Sperre maskiert.
- `dossierRechercheKanten` stellt eine eigene Beziehungsmenge aus `dossierKantenBestand` bereit, die nach manueller Sperre beider Endpunkte filtert und alle alten Wissens-/Missionsfreigaben ignoriert. Kartenverbindungen, Graph und Dossier-Verbindungstabelle nutzen sie; der historische `kantenPool` bleibt unangetastet.
- `renderDossier` zeigt unabhängige Recherche- und Beziehungsansicht auch bei `infoGesperrt`, solange das Dossier manuell nicht gesperrt ist.
- Dossier-Schreibaktionen `DOSSIER_STATUS`, `DOSSIER_BILD`, `DOSSIER_FOTO_HINZU`, `DOSSIER_ORT`, `DOSSIER_BEARBEITET`, `DOSSIER_KURZLAGE`, `VERBINDUNG_ANGELEGT`, `VERBINDUNG_GELOESCHT` und `KANTE_BESTAETIGT` werden vom historischen Missions-/Kenntniszustand abgekoppelt. Für die angepassten Schreibpfade gelten manuelle Sperren.
- Ein neuer Test `phase5b2-recherchezugang` aktiviert die historische Freigabesperre, prüft Karte, Sichtung, Verbindung, Bearbeitung, Recherchepanel, manuelle Sperre und Entsperren. Er ist zusätzlich zur Einzelprüfung in `tests/runall.js` aufgenommen.

**Absichtliche Grenze:** `wissen()`, `dossierOffen()`, `kantenPool()`, `rudimentAnsicht()`, der Dossier-Hauptpanel-Zweig in `dossierAnsicht` sowie historische Nachrichten- und Missionsreducer/Timer bleiben für `al`, `zb`, `ds2` und weitere Legacy-Tests vorerst erhalten. `VERBINDUNG_GELOESCHT` schreibt bei laufender Altmission historische Szenario-Kanten weiterhin nicht um (zusätzliche Schutzregel unabhängig vom alten Ansprechpartnerfilter). Die komplette Entfernung dieser Pfade erfordert einen separaten UI-/Testmigrationsschritt.

**Abnahme:** Einzeltest `node tests/runall.js phase5b2-recherchezugang`, gezielte Karte-/Dossier-/Altmissionstests und vollständige Standardauswahl. Vor Ende des CI-Laufs keine Erfolgsbehauptung. Windows-Altprofile und reale Archivbrücke werden bei einer späteren Integrationsabnahme geprüft. Kein automatischer Merge.

## Phase 5b3 – Dossier-Hauptansicht ohne historische Freigabemasken (PR #101 integriert)

**Sichtbarer Produkt-Effekt:** `dossierAnsicht(e)` verzweigt nach der Prüfung von `dossierGesperrt(e)` künftig direkt zu den regulären Tabs (`Übersicht`, `Sichtungen`, `Chronik`). Die zwei vorherigen UI-Weichen `wissen(e)==='bekannt' → rudimentAnsicht(e)` und `infoGesperrt(e) → Zugriff beschränkt / Ansprechpartner` entfallen. Dies gilt auch für ein ausdrücklich aktiviertes Altprofil mit nicht angenommenen Missionen oder alten `infozugang`-Stufen. Der unabhängige Recherche- und Beziehungsblock aus 5b2 bleibt erhalten.

**Sperrschutz:** Manuelle Dossiersperren werden **zuerst** geprüft und verhindern weiterhin die reguläre Ansicht, Bearbeitung, Unterlagen und Graphdarstellung. Entsperren stellt die vollständigen Tabs wieder her.

**Historische Testabgrenzung:** Die alten `wissen()`, `infoGesperrt()`, `rudimentAnsicht()` und Missionsaktionen bleiben im Code. In `tests/al.js` prüft der Alt-Test das historische Frischeformular als nicht angehängtes DOM-Element; in `tests/ds2.js` aktiviert ausschließlich das historische Testskript den alten Rudimentrenderer durch einen lokalen Browser-Override. **Kein produktiver Renderpfad montiert die alte UI.** So können die alten Protokolltests weiterhin laufen, ohne die verschwundene Oberfläche als Produktanforderung zu verankern.

**Neue Abnahme:** `tests/phase5b3-dossieroberflaeche.js` setzt zwei konkrete Altmissions-/Wissenszustände, überprüft das reale Dossier-UI einschließlich Tabs, Bearbeiten, Kurzlage, Unterlagen und Graph **ohne** Freigabemaske; prüft außerdem die manuelle Sperre mit erfolgreichem Entsperren. `phase5b2-recherchezugang` erwartet nun ebenfalls die volle Ansicht. Beide sind Teil der obligatorischen Standardauswahl.

**Bewusst offen:** Die historischen Kommunikations-/Missionsaktionen, Zeitgeber, gespeicherten Altfelder, `rudimentAnsicht()` als nicht produktiv eingebundene Alt-Testfunktion sowie weitere Legacy-Texte in Protokoll und Sichtungen werden in späteren separaten Schritten geprüft. Dieser Schritt beansprucht weder vollständige Entkernung noch Profilschemamigration.

## Phase 5b4 – Aktive Recherchebereiche und Ablage ohne Registratur (Draft)

**Nutzerentscheidung:** Der Reiter `Ablage → Registratur` gehört zur früheren Missions-/Freigabestruktur und soll aus dem produktiven Arbeitsbereich entfernt werden. `Ablage` öffnet künftig unmittelbar den lokalen **Eingang** mit Dateiablage, Vorschau, Fall- und Dossierzuordnung; es gibt weder Reiter „Registratur“/„Eingang“ noch historische Aktenlisten, Schwärzungs- und Einsichtsantragsmasken in der laufenden Ablage. Auch ein importiertes `VIEW.akte.reiter='registratur'` hat darauf keinen Einfluss.

**Gleichzeitig verbleibende reale Zugangsschranken entkoppeln:**

- `arbeitsstand-modul.js`: gespeicherte Dossierauswahl aus dem tatsächlichen Recherchebestand wiederherstellen; für eigene Dossiers weiterhin Registeridentität prüfen und manuelle Sperre beachten.
- `fall-modul.js`: Dossierverknüpfungen, Dossierauswahl, Verweise und Unterlagen in Modul X richten sich nach Recherchebestand und manuellen Sperren, nicht nach `wissen`, `dossierOffen` oder `infoGesperrt`.
- `akten-modul.js`: Datei-Eingang und dessen Dossierpicker nehmen den Recherchebestand und prüfen manuelle Sperren vor und während der asynchronen Übernahme; keine historische Ansprechpartnerfreigabe.
- `recherche-modul.js`: Unterlagen-Erfassung und -Entfernung bleiben trotz altem Missions-/Kontaktstatus möglich; **neue** ausdrückliche Prüfung der manuellen Sperre auch vor `RECHERCHE_BELEG`.

**Daten- und Legacy-Grenze:** `renderAkten` zeigt im produktiven Pfad ausschließlich `akEingangAnsicht`. Die bisherige Akten-/Registraturansicht wird als `renderRegistraturLegacy` nur für historische Tests bewahrt (Test `ak2` wählt diesen Renderer in der isolierten Browserinstanz ausdrücklich). `SCENARIO.akten`, `STATE.akten`, Einsichts-/Schwärzungsregeln und gespeicherte Altdaten werden in diesem Schritt **weder gelöscht noch automatisch migriert**. Ihre endgültige Bereinigung benötigt gesonderte Kompatibilitäts- und Migrationstests.

**Regression:** Neuer verpflichtender Test `phase5b4-arbeitszugang` deckt bekannte/unbekannte historische Freigabestufen, Modul X, Arbeitsstand, Inbox-Eingang, Unterlagenzuordnung und -Entfernung, Registratur-Abwesenheit, manuelle Sperre und Entsperren ab. `ablage-eingang` erwartet nun sofortige Eingangsansicht ohne alte Register; `ak2` prüft historische Einsicht nur noch als Legacy-Renderer. Standardauswahl plus isolierte und gezielte CI-Prüfungen müssen vollständig bestehen. Vor vollständigem Ergebnis keine Merge-Empfehlung.

## Nächste isolierte Schritte nach Abnahme von 5a

- **5b:** Kontakt-/Freigabemasken, ungenutzte Missionsaktionen und die nur missionsgebundenen Nebenwirkungen/Timer entfernen; vorher Nutzungsstellen und automatisierte Tests je Einheit auflisten. Die `missionstrennung`- und `m1flow`-Tests dann bewusst in neu klassifizierte historische Tests überführen und positive Tests für nicht vorhandene Missionsfolgen anlegen.
- **5c:** Von der Missionsstruktur abhängige `isValidState`-/`buildInitialState`-/`migrate`- und Startbedingungen ablösen, bei Altprofilen erhaltene Dossiers und Recherchebestände nachweislich beibehalten. Erst danach ein großer Windows-Oberflächen- und Profilmigrationstest.
- **Anschließend Phase 6:** reale Unix-/Linux-Befehlsmatrix, konsistentes Dateisystem und berechenbare Exit-Codes; schrittweise englische UI. Die temporäre VAULT-Sprache ist dafür kein Zielzustand.

## Grenzen dieser Bestandsaufnahme

Basiert auf aktuellem `main`, dem früheren roten Claude-Testbericht (Head `c9c90b5`) und der abgeschlossenen CI-Prüfung von PR #98 (Head `8a16021`, 100 grün, null unerwartet rot). Echte Windows-Altprofile wurden nicht geprüft. Die vollständige Entfernung darf erst nach diesen Tests und einer eigenen Schlussabnahme behauptet werden.
