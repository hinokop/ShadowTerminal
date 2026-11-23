# Phase 5c – Bestandsaufnahme Zustands- und Profilschema

Stand: 23.11.2026. Die Bestandsaufnahme (Abschnitte 1 bis 7) entstand am 22.11.2026 auf `main` `c19b93b` (nach #108 und #107) und beschreibt diesen Zeitpunkt; sie wurde nicht fortgeschrieben. Seitdem umgesetzt: 5c1a (#110), 5c1b (#111, Abschnitt 8b), 5c2a (#116, Abschnitt 8c); 5c2b (a) mit #118 (Abschnitt 8d); 5c2b (b) mit #119 (Abschnitt 8e); Teststärkung der Entkopplungstests in Abschnitt 8f. Den aktuellen Stand von `main` nennt ausschließlich [AKTUELL.md](AKTUELL.md). Entscheidungen und Anforderungen in Abschnitt 7, Umsetzungen in Abschnitt 8, Prüfhistorie in Abschnitt 9.

Methode: Empirische Sonde (frischer Stand und geladenes Altprofil aus `tests/fixtures/altprofil-mission.json`: Felder, Typen, Größen), AST-gestützte Zählung aller Lese- und Schreibstellen je Feld und Funktion, gezielte Durchsicht der Lade-, Prüf-, Export- und Importpfade. Wo eine Aussage aus dem Code abgeleitet und nicht ausgeführt wurde, ist das vermerkt.

## 1. Speicherorte

| Ort | Inhalt | Lebensdauer |
|---|---|---|
| `localStorage` `fieldterminal.v1` | Sitzungszustand `STATE` (Format `STATE_VERSION`) | wird bei „Zurücksetzen“ neu aufgebaut |
| `fieldterminal.v1.profil` | Profil `PROFIL` (`v: 1`, `idv: 2`) – eigene Dossiers, Pins, Zonen, Recherche, Bilder usw. | übersteht Zurücksetzen; Gegenstand des Profilexports |
| `fieldterminal.v1.auth` | Kennung (gesalzener PBKDF2-Hash) | unberührt von Export und Zurücksetzen |
| `fieldterminal.v1.profil.ablage-eingang` | Datei-Eingang der Ablage (Metadaten) | |
| `fieldterminal.v1.kartenwahl` | Ebenen und Anbieter der Karte | |
| `fieldterminal.v1.dienste` | Zustand der inszenierten Relais-/Adressleiste | seit 5c1b fester Schlüssel `terminal` (alte Missionsschlüssel bleiben stehen) |
| `fieldterminal.v1.erkennung` | Protokoll der alten Dialogerkennung (bis 2.000 Einträge) | **Code liest es beim Start, nutzt es aber nicht mehr** |
| `fieldterminal.v1.defekt` | Rohinhalt eines nicht ladbaren Zustands (nur der letzte) | entsteht bei ungültigem Zustand |
| `fieldterminal.v1.v4-sicherung` (5c1b) | Rohtext des gespeicherten Zustands vor der Überführung nach Format 5; ein abweichender späterer Altstand unter `….v4-sicherung.<Zeit>` | wird nie überschrieben oder gelöscht |
| IndexedDB `fieldterminal.recherche` | Dateien der Unterlagen (Recherche) | übersteht Zurücksetzen |
| IndexedDB `fieldterminal.kacheln` | Kachelspeicher der Karte | |
| IndexedDB `fieldterminal.dok` | früher Dokumentanlagen; **keine Schreibstelle mehr**, wird bei „Zurücksetzen“ geleert | |

Größen der Sonde: frischer Stand `STATE` 6.207, `PROFIL` 1.018 Zeichen; Altprofil 13.522 bzw. 2.828 Zeichen.

## 2. Lade- und Prüfpfad (Kernbefund)

`init()` → `migrate(Store.load())` (Formatstufen 2→3→4) → `isValidState()` → bei Ungültigkeit: Rohinhalt nach `.defekt`, **neuer Zustand** über `buildInitialState()` und `profilEinspielen()`.

`isValidState()` verlangt die vollständige Missionsstruktur: `missionen` je Szenariomission mit Status, Ablehnungen, Zeitfenstern, Skript und Zielen; `kontext` als gültige Mission; `serie`, `melde`, `funkstille`, `agent.checkin`, `agent.dokumente`, `agent.ablehnungen`, `komm` mit allen Kanälen, `extraktion` mit Stufe 1–5 und Begründung, `berichte`, `plan`, `automatik`, `seq.nachricht`. Derselbe Test entscheidet beim **Zustandsimport** (Kopfzeile „Import“).

**Folge:** Wer Missionsfelder aus `buildInitialState()` entfernt, ohne Prüfung und Migration mitzuziehen, setzt jeden gespeicherten Stand beim nächsten Start stillschweigend zurück. Produktive Daten im Zustand (siehe 4) gingen dann verloren, soweit sie nicht im Profil gespiegelt sind.

## 3. Felder von `STATE`

Einordnung: **P** produktiv genutzt · **M** Missionsrest, der nur noch von Code gelesen wird, der ohne Missionsdaten nichts tut · **U** von keinem Code mehr gelesen (nur erzeugt, geprüft, mitgespeichert).

| Feld | Einordnung | Nutzung (Auswahl) | Hinweis |
|---|---|---|---|
| `version`, `idv`, `t0` | P (Format) | `isValidState`, `init`, `kantenStandT` | |
| `ui` | P | Navigation, Module, Adressleiste | |
| `seq` | P teilweise | `log`, `notiz`, `sichtung`, `eigen`, `kante` produktiv; `nachricht`, `bericht`, `plan` Mission | `seq.nachricht` wird geprüft |
| `dossiers` | P | 49 Funktionen: Entitätsdaten, Auswahl, eigene Dossiers und Verbindungen | Standarddossier-Daten zusätzlich in `PROFIL.dossierDaten` gespiegelt |
| `log` | P | Protokoll, Kartenprotokoll, Recherche-Erfassung | nur im Zustand |
| `agent.notizen`, `agent.einschraenkungen` | **P – nur im Zustand** | Profil, Felder „Notizen“ und „Operative Einschränkungen“ | **siehe Befund B2** |
| `agent.legende`, `agent.status`, `agent.dokumente` | P/M | Identität (`aktiveLegendeId`), Statusanzeige, Dokumentfristen (Spiegel in `PROFIL.dokFristen`) | |
| `agent.checkin`, `agent.ablehnungen` | M | Kartenmarker hinter Auftragsrahmen, Prüfung | |
| `alterung` | P (konstant) | `altS()`: Faktor 1; nur die entfernte Regie konnte ihn ändern | |
| `kontext` | M/P | Mission der Adressleiste (`Leiste`), `KM()`, Zellenanzeige | Adressleiste leitet ihren Dienst daraus ab |
| `missionen`, `serie`, `plan`, `automatik`, `kw`, `vorlauf`, `melde`, `funkstille`, `berichte`, `anreise`, `komm`, `verstaerkung`, `infozugang` | M | `freigeschaltet`, `MS`, `startVorziehen`, `planEntfernen`, `kanalDef`, `modKopf`, `meldeText`, `erkenntnisLage`, `namenNachziehen`, `VK`, `IZ` | alle geprüft oder mitgespeichert; `SITZUNG_START` schreibt `melde.geprueftBis` ohne Leser |
| `extraktion`, `akten`, `nachbereitung`, `pause`, `einweisung`, `abdruck`, `ereignisse` | U | keine Leser | `extraktion` wird von `isValidState` streng geprüft |

## 4. Felder von `PROFIL`

Alle 26 Felder sind produktiv in Gebrauch (Import, Export, Dossiers, Karte, Recherche, Identitäten), mit drei Ausnahmen: `v` und `idv` sind Formatkennungen; `tausch` wird nur noch beim Eingang alter Nachrichten gelesen (M). `dokFristen` wird von `identitaetUebernehmen` geschrieben, angezeigt nur über das im Produkt unerreichbare `dokZeile` (Test `identitaeten`). `karteBlanko` (Karte bereinigen) ist produktiv.

## 5. Export- und Importpfade

| Pfad | Inhalt | Prüfung |
|---|---|---|
| Kopfzeile „Export“ (`exportState`) | ganzer `STATE` einschließlich aller Missionsfelder | – |
| Kopfzeile „Import“ (`importFile` → `IMPORT`) | ersetzt `STATE` | `migrate` + `isValidState` (Missionsstruktur), Nummernabbildung eigener Dossiers |
| Profilexport/-import (`profilExportieren`, `PROFIL_IMPORT`) | `PROFIL` | eigene Abbildung von Dossiers, Pins, Zonen, Recherche |
| Fallpaket (`rchPaketBauen`/`rchPaketLaden`) | Fall mit Manifest und Prüfsummen | Vertrag `docs/datenvertrag.md` |
| Arbeitsstand F1/F2 | `PROFIL.arbeitsstand` | Identitätsprüfung von Fall und Dossier |

## 6. Befunde

- **B1 – Stiller Rücksetzer:** Wie in Abschnitt 2 beschrieben, ist die Missionsstruktur Ladebedingung. Das ist die zentrale Randbedingung jeder Schemaänderung.
- **B2 – Produktive Texte nur im Zustand:** „Notizen“ und „Operative Einschränkungen“ des Profils liegen in `STATE.agent`. **Ausgeführt und bestätigt:** Sie stehen nicht im Profil, fehlen damit im Profilexport und sind nach „Zurücksetzen“ leer.
- **B3 – Missionsreste mit Laufzeitbezug:** `startVorziehen`, `KM`, `MS`, `freigeschaltet`, `VK`, `IZ`, `kanalDef`/`modKopf` (Vorgangsanzeige), `namenNachziehen` (schreibt Umbenennungen in alte Nachrichten), die `def`-Zweige der Karte (`karteMarker`, `karteFenster`, `karteStrecke`, `karteHerkunft`, `karteGrundansicht`, `zeichneKarte`, `renderKarte`, `zoneLage`, `zielpersonenListe`) und Zonenaktionen in `index.html`. Statisch erreichbar, ohne Missionsdaten wirkungslos. Sie fallen weg, sobald das aktive Schema die Missionsfelder nicht mehr führt.
- **B4 – Tote Datenpfade:** `ERK` (Schlüssel `.erkennung`) wird beim Start geladen und nie genutzt; `fieldterminal.dok` hat keine Schreibstelle mehr.
- **B5 – Missionsdossiers:** `SCENARIO.entitaeten` enthält drei Dossiers der Mission M1 (`P-0001` Emre Kaya, `P-0002` „Kutscher“, `P-0003` „Händler“), die mit den 28 Standarddossiers als Beispiele erscheinen.
- **B7 – Speicherfehler unsichtbar (aus der Prüfung durch ChatGPT, im Code bestätigt):** `Store.save()` fängt Schreibfehler ab und liefert keinen Erfolgsstatus; das Sichern von `STATE` und das anschließende Schreiben von `PROFIL` sind keine gemeinsame Transaktion. Ein Autosave kann daher scheitern, ohne dass die Oberfläche es zeigt.
- **B8 – Unmittelbar erreichbare Altzugriffe (aus der Prüfung, im Code bestätigt):** `SITZUNG_START` schreibt `STATE.melde.geprueftBis`; `aktualisiereSchreibt()` liest bei jedem Rendern `STATE.plan`; `Leiste.init()` (Zugangsschirm, vor der Zustandsinitialisierung) und `Leiste.sync()` arbeiten mit `kontext`; `buildInitialState()` benötigt die Missionsdefinitionen; die Startprüfung verlangt eine nicht leere `SCENARIO.missionen`-Liste. Diese Stellen würden ohne Anpassung Laufzeitfehler auslösen, sobald die Felder den aktiven Zustand verlassen.
- **B6 – Adressleiste:** Die `.onion`-Adresse der URL-Leiste wird einmalig zufällig erzeugt und unter dem Schlüssel des Missionskontexts (`STATE.kontext`, stets `M1`) in `fieldterminal.v1.dienste` gespeichert; daher ist sie seit jeher konstant. Der Pfad folgt der Ansicht.

## 7. Entscheidungen und Anforderungen

**E1 – Zustandsformat 5 mit `STATE.altbestand`** (Zustimmung Master Wayne zum Plan, Zustimmung ChatGPT zum Konzept; Umsetzung als Draft 5c1b begonnen am 22.11.2026 auf Anweisung Master Wayne, siehe 8b). Aktiver Kern: `version`, `t0`, `idv`, `ui`, `seq`, `dossiers`, `log`, `agent`-Kern, `alterung`. Alle übrigen Felder wandern unverändert nach `STATE.altbestand`. Anforderungen:
1. **Sicherung des Originals vor jeder Änderung:** der **rohe gespeicherte Text** von `fieldterminal.v1`, nicht ein bereits durch `migrate()` verändertes Objekt, unter `fieldterminal.v1.v4-sicherung`; nur anlegen, wenn noch keine Sicherung existiert (die erste und einzige verwendbare Sicherung wird nie überschrieben).
2. **Erfolg prüfen:** Sicherung nach dem Schreiben erneut lesen und zeichengleich vergleichen. Scheitert das (z. B. `QuotaExceededError`), keine Migration und kein Speichern eines neuen Zustands; der alte Stand bleibt unverändert in Betrieb, die Oberfläche meldet den Grund.
3. **Speichern mit Erfolgsstatus:** `Store.save()` liefert künftig ein Ergebnis; der migrierte Zustand gilt erst als übernommen, wenn er gespeichert und zurückgelesen werden konnte. Ein teilweise geschriebener Stand gilt nicht als migriert.
4. **Idempotenz:** Ein Zustand im Format 5 wird beim Laden nicht weiter verändert; eine erneute Migration desselben Ausgangs liefert dasselbe Ergebnis.
5. **Prüfung für Format 5:** ohne Bezug auf Missionsstrukturen, aber streng für die produktiven Strukturen (Dossierdaten, Auswahl, Sequenzen, Protokoll, Agentenkern).
6. **Kein stiller Rücksetzer:** Ein nicht migrierbarer Stand führt nicht zu einem neuen Zustand ohne Hinweis; er bleibt erhalten, und die Anwendung zeigt die Lage an.
7. **Wiederherstellung praktisch getestet:** aus der Sicherung lässt sich der alte Zustand wiederherstellen (Testfall).
8. **Vor der realen Windows-Migration verpflichtend:** externer Export von Zustand und Profil; Anhänge in IndexedDB zusätzlich über Fallpakete. Die interne Sicherung ist nicht die einzige Rückfallebene.
9. **Alle unmittelbar erreichbaren Verbraucher (B8) werden im selben Schritt angepasst;** die Entfernung der übrigen toten Deklarationen folgt getrennt (5c2).

**E2 – Notizen und Operative Einschränkungen ins Profil** (höchste Priorität). Anforderungen:
1. Vorhandene Texte einschließlich der Änderungszeitpunkte (`notizenGeaendert`, `einschraenkungenGeaendert`) übernehmen.
2. Künftig primär im Profil speichern; über Neuladen und „Zustand zurücksetzen“ hinweg erhalten.
3. Im Profilexport enthalten und beim Profilimport berücksichtigt.
4. Beim Import älterer Zustandsdateien Konflikte mit vorhandenen Profiltexten kontrolliert behandeln (vorhandener Profiltext hat Vorrang; abweichender importierter Text geht nicht verloren, sondern wird gemeldet).
5. Ein bewusst geleertes Feld wird nicht durch ältere Werte zurückgeholt (Leerstand mit Zeitpunkt ist ein gültiger Wert).
6. Speicherfehler werden angezeigt, statt einen erfolgreichen Autosave vorzutäuschen.
7. **Entschieden (Master Wayne, 22.11.2026, Vorschlag übernommen):** „Profil leeren“ löscht beide Felder mit, ausdrücklich genannt im Bestätigungstext. „Zustand zurücksetzen“ löscht sie in keinem Fall; dessen Warntext wird entsprechend korrigiert.

**E3 – Zustandsimport.** Gespeicherte Zustände und importierte Dateien laufen durch dieselbe Migration. Formate 2 und 3 werden weiterhin über 4 nach 5 überführt (keine stillschweigende Einschränkung). Validierung vor dem Ersetzen; ein abgelehnter Import lässt Zustand und Profil unverändert. Die Migration einer importierten Datei überschreibt keine aktuellen Profildaten unbemerkt (siehe E2.4).

**E4 – Rest-Code (B3)** und **E5 – tote Datenpfade (B4):** in 5c2 nach Referenzprüfung entfernen; gespeicherte Daten (`.erkennung`, `fieldterminal.dok`) bleiben unangetastet. Keine produktiven Zugriffe oder Testhilfen versehentlich entfernen. Für die Karte gelten die bestehenden Vorgaben (nichts vereinfachen, alles erhalten); erneut strukturierte Vorher-/Nachher-Vergleiche wie in 5b9.

**E6 – Missionsdossiers P-0001 bis P-0003: entschieden** (Master Wayne, 22.11.2026; Empfehlung ChatGPT gleichlautend). Als Beispiele erhalten, vollständig vom Missionskontext gelöst, als Blankos. Kopplungen: siehe B5 und die fünf Punkte unten. **Wichtig:** `profilSpeichern()` klassifiziert über die Zugehörigkeit zu `SCENARIO.entitaeten`, nicht über `e.mission`; `mission: 'STD'` allein genügt daher nicht. Die Dossiers wechseln in den Standardbestand, ihre Speicherbehandlung (Status, Statuszeitpunkt, Notizen, Sichtungen) entspricht danach exakt der der Standarddossiers; vorhandene Daten aus Format 4 haben bei der Übernahme Vorrang. Unbedingt erhalten: alle Dossier- und Verbindungskennungen, Änderungen, Notizen, Kurzlagen, Sichtungen, Bilder, Kartenpositionen, Pins, Zonenbezüge, ausgeblendete Verbindungen, manuelle Sperren, verknüpfte Unterlagen und Fälle. Reihenfolge des Standardbestands und anfängliche Dossierauswahl unverändert; Beispielinhalte werden nicht umgeschrieben.
Kopplungen im heutigen Stand: (1) `mission: 'M1'` an den drei Dossiers und an `V-01` bis `V-07` (Korrektur bei der Umsetzung: tatsächlich `V-01` bis `V-10`); (2) Status wird als Missionsstatus nicht ins Profil gesichert; (3) `isValidState` verlangt sie im Zustand; (4) Sonderbehandlung in `migrate`; (5) Verweise aus der Missionsdefinition.

**E7 – Adressleiste: fester, neutraler Dienstschlüssel** (Klarstellung, keine Gestaltungsfrage; Zustimmung ChatGPT). Die vorhandene Adresse wird aus `fieldterminal.v1.dienste` unter dem alten Schlüssel `M1` übernommen, sofern noch kein kanonischer Eintrag existiert. `Leiste.init()` (Zugangsschirm, vor der Zustandsinitialisierung) und `Leiste.sync()` werden gemeinsam angepasst, sodass weder ein neuer Host entsteht noch eine scheinbare Neuverbindung ausgelöst wird. Host, Erstellungszeitpunkt und sichtbare Verbindungssimulation bleiben über Neuladen, Zurücksetzen und Migration stabil. Libelle, Farbschema und Inszenierung bleiben unverändert.

## 8. Schrittfolge und Abnahmekriterien

1. **5c1a – Schutz der Profiltexte (E2):** eigener Draft-PR vor dem Formatwechsel; Speicher- und Importsemantik getestet.
2. **5c1b – Zustandsformat 5 (E1, E3, E6, E7, B8):** Originalsicherung, verlustfreie Migration, Entschärfen aller unmittelbar erreichbaren Altzugriffe, Entkoppeln der Dossiers und des Adressschlüssels. Als überprüfbare Commitfolge.
3. **5c2 – Bereinigung (E4, E5):** verbliebene Altdeklarationen, historische Hilfsfunktionen, ungenutzte Speicheradapter.

Automatische Tests für 5c1 (mindestens): (1) frischer Zustand Format 5 und wiederholtes Laden; (2) gespeicherter vollständiger Zustand Format 4 mit echten Daten an P-0001 bis P-0003; (3) Import älterer Formate (2, 3, 4) und erneuter Import eines migrierten Zustands; (4) verlustfreie Übernahme aller historischen Felder in `altbestand`; (5) Erhalt von Notizen und Einschränkungen bei Zurücksetzen, Export, Import und Neuladen; (6) erzwungene Speicherfehler vor und während der Migration ohne stillen Datenverlust; (7) Erhalt von Kennungen, Sperren, Dossierbezügen, Fallakten, Pins und Profilzonen; (8) unveränderte Onion-Adresse; (9) identische produktive Karten- und Dossierdarstellung vor und nach der Migration (Differenzsonde wie 5b9); (10) vollständige Standardauswahl auf dem exakten PR-Head. Danach gebündelte Windows-Abnahme mit einer gesicherten Kopie des echten Profils.

## 8a. Umsetzung 5c1a (Draft)

- Neues Profilfeld `PROFIL.profiltexte` mit `{ text, t, verdraengt }` je Feld (`notizen`, `einschraenkungen`); `t = null` bedeutet „nie gesetzt“.
- **Übernahme:** beim ersten Start einmalig aus `STATE.agent` samt Änderungszeitpunkt; ein leerer Alttext gilt als nie gesetzt. Gelingt das Speichern nicht, erscheint ein Hinweis.
- **Schreiben:** `TEXT_GEAENDERT` schreibt ins Profil (auch ein geleertes Feld erhält einen Zeitpunkt) und ist Profilaktion, d. h. das Profil wird gespeichert und ein Fehler gemeldet. `STATE.agent` führt eine Spiegelung (Zustandsexport, Formatprüfung bis 5c1b); `profilEinspielen` spiegelt nach Zurücksetzen und Zustandsimport.
- **Importe:** Zustands- und Profilimport führen über `profiltexteZusammenfuehren` zusammen: ein nie gesetztes Feld übernimmt den Text; sonst hat der vorhandene Text Vorrang, ein abweichender wird unter `verdraengt` aufbewahrt, im Protokoll gemeldet und unter dem Feld angezeigt (nur lesbar).
- **„Profil leeren“** löscht beide Felder (E2.7); Bestätigungstext und Protokoll nennen sie. **Warntext „Zustand zurücksetzen“** berichtigt: genannt wird nur, was nachweislich erhalten bleibt (geprüft per Sonde: eigene Dossiers, Notizen, Sichtungen und Status der Standarddossiers). Der Status von P-0001 bis P-0003 geht beim Zurücksetzen bis 5c1b weiterhin verloren (E6) und wird im Text nicht zugesichert.
- **Befund bei der Umsetzung:** Die beiden Felder erscheinen im Profil nur noch als aufklappbarer Bereich „Bisherige Notizen“, wenn Text vorhanden ist; der Schutz betrifft damit vor allem vorhandenen Altbestand.
- **Korrektur nach Review (ChatGPT, #110):** Ein bewusst geleertes Feld (`text: ''`, `t` gesetzt) aus einem Profilexport wurde beim Import in ein frisches Profil als „nie gesetzt“ behandelt; ein danach importierter alter Zustand konnte den gelöschten Text zurückholen. Jetzt übernimmt ein nie gesetztes Feld beim **Profilimport** auch den Leerstand samt Zeitpunkt. Beim **Zustandsimport** gilt ein leeres Feld weiterhin nicht als „bewusst geleert“, weil Zustandsdateien im Format 4 einen Änderungszeitpunkt auch ohne jede Eingabe tragen (bewusste Abwägung: lieber einen Text aufbewahren als einen gelöschten zurückholen). `profiltexteSpiegeln` spiegelt den Zeitpunkt jetzt immer, auch `null`, sodass nach „Profil leeren“ kein veralteter Zeitpunkt im Zustand bleibt.
- **Getrennt erfasster Oberflächenpunkt (nicht Teil von 5c1a):** Sind beide Felder leer, wird der Bereich „Bisherige Notizen“ nicht angezeigt; in einem frischen Profil lassen sich dort keine Texte eingeben. Vorbestehendes Verhalten; Entscheidung offen, ob die Felder wieder regulär sichtbar sein sollen.
- **Test** `phase5c1a-profiltexte` (Standardauswahl): Übernahme, Autosave über die Oberfläche, Zurücksetzen, Neuladen, echter Download des Profilexports, Zustandsimport mit Konflikt und bewusst geleertem Feld, Profil leeren, Profilimport in ein leeres Profil, angezeigter Speicherfehler; dazu die Reihenfolge aus dem Review (setzen → leeren → exportieren → in frisches Profil importieren → alten Zustand importieren) für beide Felder und die Zeitpunkte im Spiegel nach „Profil leeren“. Gegenprobe gegen `main`: rot; Gegenprobe des Review-Falls gegen `d2b3bbd`: rot.

## 8b. Umsetzung 5c1b (Draft)

Commitfolge auf `refactor/phase5c1b-zustandsformat-20261122`: Store → E7 → E6 → Format 5 mit Altlesern → Testanpassungen → Abnahmetest → Rest B8 → Dokumentation und Workflow.

- **Format 5 (E1):** `STATE_VERSION = 5`. Aktiver Kern `version`, `t0`, `idv`, `ui`, `seq`, `dossiers`, `log`, `agent`, `alterung`. `agent` bleibt als Ganzes (Identität, Status, Dokumentfristen, Check-in, Ablehnungen, Profiltext-Spiegel), weil Identität, Karte und Prüfung ihn lesen; die Missionsanteile darin (`checkin`, `ablehnungen`) fallen in 5c2 an. Alle übrigen Felder gehen **unverändert** nach `STATE.altbestand`, ausdrücklich auch nicht aufgelistete (z. B. `aussagen`, `widerspruch`, `missionsbetrieb`). Einziger Zusatz: Protokolleintrag „Zustand überführt“ mit der Liste der Felder.
- **Sicherung (E1.1–E1.3):** `init()` sichert bei jedem Zustand älteren Formats zuerst den Rohtext (nicht das migrierte Objekt) unter `fieldterminal.v1.v4-sicherung` und prüft ihn durch Rücklesen. Eine vorhandene Sicherung wird nie überschrieben; ist sie mit dem aktuellen Rohtext identisch, wird sie weiterverwendet, weicht sie ab (anderer Altstand, z. B. nach manueller Wiederherstellung und Änderung), entsteht eine weitere unter `….v4-sicherung.<Zeit>`. Der überführte Zustand gilt erst nach Speichern und zeichengleichem Rücklesen (`Store.saveGeprueft`) als übernommen.
- **Fehlerfall (E1.2, E1.6), Auslegung:** Scheitert Sicherung oder Speichern, wird das Speichern des Zustands für die Sitzung ausgesetzt (`Store.sperren`); der gespeicherte Stand bleibt zeichengleich, die Kopfzeile zeigt „Sitzung nicht persistent“, die Statuszeile nennt den Grund. Die Sitzung arbeitet mit dem im Speicher überführten Zustand, damit die Anwendung bedienbar bleibt; Änderungen am Zustand gehen beim Schließen verloren (so gemeldet). Das Profil wird in einer gesperrten Sitzung ebenfalls nicht geschrieben (Änderung nach dem Review zu #111, siehe unten; die ursprüngliche Auslegung, es weiter zu speichern, ist überholt). Ein nicht verwendbarer Stand wird wie bisher roh unter `.defekt` abgelegt und durch einen Ausgangszustand mit Hinweis ersetzt; gelingt auch diese Ablage nicht und gibt es keine Altstandssicherung, wird nicht überschrieben (Sperre).
- **Idempotenz (E1.4):** Ein Zustand im Format 5 wird beim Laden nicht verändert (Test: gespeicherter Stand vor und nach Neuladen bis auf das Sitzungsprotokoll gleich). Eine erneute Überführung desselben Rohtexts liefert denselben Altbestand; abweichen kann nur der Zeitpunkt des Protokolleintrags.
- **Prüfung Format 5 (E1.5):** Formatkennung, gültiges `t0`, Ansicht, Protokollzähler, Agentenkern (Status, Identität, Check-in-Zeit, Dokumentfristen, beide Profiltext-Spiegel), Dossierbestand (Entitätsdaten als Objekt, eigene Dossiers und Kanten als Liste, gültige Auswahl, Eintrag mit Notizliste für jedes Beispieldossier), Protokoll, `alterung` und `altbestand` als Objekt, falls vorhanden. Bewusst nicht strenger, damit ein gültiger Stand im Format 4 nach der Überführung nie abgelehnt wird.
- **Import (E3):** gleiche Überführung und Prüfung; Formate 2 und 3 laufen weiter über 4. Abgelehnte Importe ändern weder Zustand noch Profil (Test).
- **E6:** `mission: 'STD'` an P-0001 bis P-0003 und V-01 bis V-10; `profilSpeichern` ohne Sonderfall, Status von P-0001 bis P-0003 übersteht damit „Zurücksetzen“ (wie bei den Standarddossiers). Die Missionsdefinition M1 und die Ablage-Unterlagen D-M1-01 bis -03 bleiben als historische Daten unverändert.
- **E7:** fester Schlüssel `terminal`; Übernahme von Adresse und Erstellungszeitpunkt aus dem alten Missionsschlüssel (Kontext des gespeicherten Zustands, sonst `M1`), alter Eintrag bleibt; `Leiste.sync()` vergleicht keinen Kontext mehr.
- **B8 und Altleser:** Leser historischer Felder greifen über `ALT()` nur noch lesend auf den Altbestand zu (`KM`, `MS` – Ergänzung fehlender Felder nur in einer Kopie –, `LM`, `freigeschaltet`, `meldeText`, `kanalDef`, `modKopf`, `fensterZelle`, `IZ`, `VK`, `erkenntnisLage`, `aussagenListe`, `widerspruchOffen`, `aktualisiereSchreibt`, `Dev.zeitplan`, Leistenpfad). `SITZUNG_START` schreibt kein Meldewesen mehr; `meldeText` wird nur noch berechnet, wenn eine Anzeige existiert; `startVorziehen` und `nachricht` verweigern ohne Plan bzw. Kanäle; `namenNachziehen` schreibt keine Umbenennungen mehr in alte Nachrichten (der Altbestand bleibt unverändert; die Nachrichten sind ohnehin nicht mehr sichtbar). Die einmalige Nummernumschreibung (`idv`) wirkt bei sehr alten Ständen weiterhin auf den gesamten Zustand einschließlich Altbestand, wie bisher.
- **Befund bei der Umsetzung – Wirkung historischer Daten auf die Darstellung:** Die Differenzsonde zeigt, dass alte Missionsdaten heute produktiv sichtbar sind: die Erkenntnislage zählt alte Berichte, Einschätzungen und Belege einer laufenden Mission als Spuren, der Reiter Sichtungen zeigt „Aussagen des Agenten“, Adresshinweise berücksichtigen Nachträge einer angenommenen Mission. 5c1b erhält diese Wirkung unverändert (Leser auf dem Altbestand). **Offene Entscheidung für 5c2:** belassen, in produktive Daten überführen oder aus der Darstellung nehmen (Daten bleiben in jedem Fall im Altbestand).
- **Prüfungen:** Abnahmetest `phase5c1b-zustandsformat` (Kriterien 1–8); Gegenprobe gegen `main`: rot; Mutationen (Sicherung überschreibt, Adresse ohne Übernahme, E6-Sonderfall zurück, Speichern trotz Sperre, schreibender Altleser): jeweils rot. Differenzsonde (Kriterium 9, außerhalb des Repos) mit Altprofil Format 4 (laufende Mission, Daten an P-0001 bis P-0003, Bericht, Einschätzung, Beleg, Aussage, Sperre, Pin, Profilzone, Fall) und mit frischem Zustand, feste Uhr: Dossierliste, alle Dossiers in allen drei Reitern samt Erkenntnislage, Adresshinweis, Bedrohung und Belegen, Karte mit Markern, Zonen, allen Popups und 3D-Daten, Ablage, Profil, Adresse und Fenstertitel: 171 bzw. 166 Werte, einzige Abweichung die Formatkennung. Gegenprobe der Sonde (Altleser abgeschaltet): 11 produktive Abweichungen. Vollständige Standardauswahl: siehe PR.
- **Nachbesserung nach Review zu #111 (Blocker und Absicherung):**
  - *Ladestatus statt `null`:* `Store.laden()` unterscheidet `fehlt` (Schlüssel nachweislich nicht vorhanden), `lesefehler`, `defekt` und `vorhanden`; `Store.load()` liest nur noch und hat keine Nebenwirkung mehr (zuvor sicherte es einen defekten Text beim Lesen). Vorher lieferte `load()` bei fehlgeschlagener Schreibprobe `null`, auch wenn der Zustand lesbar war; `init()` legte dann einen frischen Zustand an und überschrieb den vorhandenen ohne Sicherung. Jetzt: nur bei `fehlt` entsteht ein neuer Zustand ohne Sicherung. Bei `lesefehler`, fehlgeschlagener Schreibprobe mit vorhandenem Zustand, nicht lesbarem Text ohne verifizierte Ablage unter `.defekt` und gescheiterter Sicherung gilt die Schreibsperre. Die Ablage unter `.defekt` zählt erst nach zeichengleichem Rücklesen als gesichert. Bei vorhandenem Zustand und fehlgeschlagener Schreibprobe läuft die Sitzung mit dem vorhandenen (nötigenfalls im Speicher überführten) Zustand, nicht mit einem leeren.
  - *Leerer Schlüssel (Nachprüfung #6014282037):* `localStorage.getItem(KEY) === ''` belegt, dass der Schlüssel existiert. `Store.laden()` stuft nur noch `null` als `fehlt` ein; `''` gilt als `defekt` und wird vor dem Ersatz durch einen neuen Zustand mit Rückleseprüfung unter `.defekt` gesichert, sonst Schreibsperre. Eigene Ergänzung: Ein leerer Text überschreibt eine frühere, nicht leere Ablage unter `.defekt` nicht (er trägt keinen Inhalt; sonst ginge die frühere Sicherung verloren). Test `phase5c1b-ladefehler` Fälle H, H2, H3; auf `978d7a2` rot in H und H2, H3 ist der Schutz gegen eine Überkorrektur (Mutation ohne Guard: rot).
  - *Profil und Zustand als Einheit:* Während `init()` wird das Profil nicht geschrieben (Aufschub, `PROFIL_AUFSCHUB`), sondern erst nach geprüfter Zustandsspeicherung; bei Sperre unterbleibt es, und auch später schreibt `profilSpeichern()` in einer gesperrten Sitzung nicht. Damit entsteht keine Teilmigration. Preis: Änderungen am Profil in einer gesperrten Sitzung gehen beim Schließen verloren (die Statuszeile meldet das; Export bleibt möglich). Unverändert bleibt der zeitgesteuerte Verfall alter Kartenprotokoll-Einträge beim Laden von `karte-modul.js` (schreibt nur, wenn Einträge abgelaufen sind, unabhängig von der Überführung). Anhänge in IndexedDB sind davon nicht berührt.
  - *Nicht bestätigtes Speichern:* `Store.saveGeprueft` unterscheidet `ok`, `nicht-geschrieben` und `unbestaetigt`. Bei `unbestaetigt` wird das Original zurückgeschrieben (`Store.wiederherstellen`, zeichengleich geprüft); gelingt das nicht prüfbar, nennt die Meldung ausdrücklich, dass der gespeicherte Stand nicht bestätigt ist, und verweist auf die Sicherung, statt einen unveränderten Stand zu behaupten.
  - *Test* `phase5c1b-ladefehler` (Standardauswahl): Fälle A (Schreibprobe, Format 4), B (Schreibprobe, Format 5), C und C2 (ungültiges JSON mit misslungener bzw. gelungener Ablage), D (Rücklesefehler), E und E2 (Sicherung bzw. Speichern scheitert, Profil unverändert), F (Lesefehler), G (Normalfall). Auf dem Stand `2cb4185` rot in A, B, C, D, E, E2, F; C2 und G grün (Normalfälle). Mutation (Aufschub des Profils aus): D und E2 rot.
  - *Testlauf:* Die pauschale Einstufung von `lage-box` als „bekannt instabil“ gilt nur noch, wenn ausschließlich die Prüfung `animationKeinRueckfall` fehlschlägt (`BEKANNT_NUR` in `tests/runall.js`).
  - *Hinweis aus dem Review zu 5c2:* `buildInitialStateV4` und die Migration von Format 2 und 3 brauchen weiterhin `SCENARIO.missionen`; diese Definitionen werden in 5c2 nicht entfernt, solange keine gleichwertige, getestete Altformat-Interpretation vorhanden ist.
- **Vor der realen Windows-Migration (E1.8):** externer Export von Zustand (Kopfzeile „Export“) und Profil (Profilexport); Anhänge in IndexedDB zusätzlich über Fallpakete.

## 8c. Umsetzung 5c2a: Darstellung der verbliebenen Missionsdaten

**E8 – Entschieden (Master Wayne, 22.11.2026): Option C, ausblenden.** Anzeige und Zählung der verbliebenen Missionsdaten im Dossier entfallen; die Daten bleiben unverändert in `STATE.altbestand` (Speicher, Export und Zustandsimport unberührt). Anlass der Wahl: Der echte Datenbestand besteht nach Angabe von Master Wayne nur aus Test-Dossiers, Pins und Zonen. Ob der echte Altbestand tatsächlich leer ist, wurde nicht ausgelesen.

Umgesetzt in `index.html` (zwei Stellen):
1. `erkenntnisLage()` zählt nur noch eigene Sichtungen. Belege der laufenden Altmission, Berichte (`ALT().berichte`) und Einschätzungen (`ALT().infozugang`) fließen nicht mehr in die Erkenntnislage ein.
2. Im Sichtungsreiter entfallen die Tabelle „Aussagen des Agenten“ und der Hinweis „offener Widerspruch … Kanal Ansprechpartner“.

Bewusst nicht in 5c2a: Entfernen der danach ungenutzten Funktionen (`IZ()`, `aussagenListe()`, `widerspruchOffen()`) und des übrigen `ALT()`-Rest-Codes (Funkstille, Verstärkung, Plan, Briefing-Pfad, Entwicklerkonsole) sowie der Texte in `SCENARIO.abfragen.aussagen`; das folgt als 5c2b nach Referenzprüfung. Die Aussagen in `PROFIL.recherche.aussagen` (Fallpaket, ohne Oberfläche) sind nicht betroffen.

Test: `tests/phase5c2a-altdaten.js` (Zustand mit Altbestand: keine Aussagentabelle, kein Widerspruchshinweis, Erkenntnislage zählt nur die Sichtung, Altbestand im Speicher und gespeichert unverändert, auch nach echtem Neuladen). Rot-vor-Grün gegen den Stand vor der Änderung belegt; Gegenprobe mit nur halber Änderung ist ebenfalls rot.

Hinweis: Ein unverändert gespeicherter Erkenntnis-Standardtext wird nicht als eigener Eintrag geführt (`erkWert === null`); nur wer den Text im Dossier ausdrücklich gespeichert hat, behält seinen Wortlaut. Bereits gespeicherte eigene Texte werden nicht verändert.

### 8d. Umsetzung 5c2b (a): stillgelegter Ereignisblock und Helfer (#118, Freigabe Master Wayne 23.11.2026)

Freigegebener Umfang: den Ereignisblock in `tickModule` für `[data-melde]`, `[data-vk]` und `[data-fenster]` und die dadurch funktionslosen Helfer entfernen, soweit die Referenzprüfung ihre ausschließliche Verwendung dort bestätigt; außerdem `widerspruchOffen()`. Ausdrücklich ausgenommen: `IZ()`, `aussagenListe()`, `ALT()`, `LM()`, `KM()`, `MS()`, `missionDef()`, `SCENARIO.missionen`, die Entwicklerkonsole und jede Änderung an gespeicherten Daten.

Referenzprüfung (Quelltextsuche über das gesamte Repository, danach Ausführung):
- Die Attribute `data-melde`, `data-vk`, `data-fenster` kommen im Produktivcode nur in `tickModule` (Abfrage) und in `fensterZelle` (Lesen) vor; kein Modul, keine Vorlage und keine Szenariodatei erzeugt sie. Dynamisch zusammengesetzte Attributnamen (`'data-' + …`, `dataset[…]`) gibt es für diese Namen nicht. Nutzerinhalte können sie nicht einschleusen: `kurzlageInhalt()` baut Inhalte aus erlaubten Elementen ohne Attribute neu auf (einzige Ausnahme `data-unterlage`).
- `meldeText` und `meldungLiegtVor` wurden nur im Tick-Block und gegenseitig aufgerufen, `VK` und `vkStatus` nur dort und gegenseitig, `fensterZelle` nur dort, `widerspruchOffen` nirgends.
- Außerhalb der Standardauswahl verweisen vier Testskripte (`vk`, `flow2`, `kb`, `zz`) auf die entfernten Helfer. Alle vier brachen schon auf unverändertem `main` ab, an Stellen vor dem Zugriff auf diese Helfer und aus anderen Gründen: `vk` wartet auf das längst entfernte Feld `#vk-zweck`, `flow2` benötigt das nicht installierte Paket `jsdom`, `kb` liest einen leeren Wert (`haltung` von `null`), `zz` ruft die nicht mehr vorhandene Funktion `begruendungPruefen` auf. Der Befund ist ausgeführt (Basislauf vor der Änderung, Fehlerstellen `kb.js:7` und `zz.js:6` nach der Änderung unverändert). Die Skripte werden in diesem Schritt nicht verändert; ob sie ausgemustert werden, bleibt eine eigene Entscheidung.

Entfernt in `index.html`: Tick-Block, `meldungLiegtVor`, `meldeText`, `fensterZelle`, der Kommentarblock „Modul 8: Verstärkung“ mit `VK` und `vkStatus`, `widerspruchOffen`. Keine Hinzufügungen. Nicht angefasst, obwohl nun ohne Aufrufer in der Anwendung: `fensterNach`, `fensterListe`, `fristMs`, `fmtRest`, `fmtDauer`; sie gehören nicht zum freigegebenen Umfang und werden bei 5c2b (b) bzw. (c) neu bewertet (Aufruferprüfung dann erneut).

Test: `tests/phase5c2b-tickblock.js` (entfernte Funktionen nicht mehr vorhanden, ausgenommene Funktionen erhalten, fremde Elemente mit den früheren Attributen bleiben unberührt, Takt ohne Seitenfehler, Altbestand mit Aussagen, Widerspruch, Berichten, Einschätzung und Verstärkungseintrag im Speicher und gespeichert unverändert, auch nach Neuladen, Karte und Terminal funktionsfähig). Rot-vor-Grün: Gegen `index.html` von `main` rot, nach der Änderung grün; der Tick-Abschnitt allein ist auf `main` ebenfalls rot (`data-melde` wird dort tatsächlich beschrieben).

### 8e. Umsetzung 5c2b (b): `IZ()` und `aussagenListe()` (#119, Freigabe Master Wayne 23.11.2026)

Freigegebener Umfang: `IZ()` und `aussagenListe()` entfernen, nachdem die Tests umgestellt sind. Vorgaben: Gruppe-3-Schreibzugriffe nur entfernen, wenn je Test belegt ist, dass sie auf einem frischen Zustand ohne Altbestand nur temporäre Objekte verändern; keine neuen Schreibzugriffe auf `STATE.altbestand.infozugang`, um diese Vorbereitung künstlich zu erhalten; alle übrigen Referenzen einzeln nach historischem und produktivem Zweck klassifizieren; lesende Zugriffe bei tatsächlich vorhandenen historischen Daten semantisch gleichwertig auf `STATE.altbestand` umstellen; Tests und Produktivcode in getrennten Commits; gezielte Absicherung eines frischen Zustands; Prüfung der Karte mit Altbestand anhand einer Migrationsfixture. Unberührt: `ALT()`, `LM()`, `KM()`, `MS()`, `missionDef()`, `SCENARIO.missionen`, Entwicklerkonsole, Altformatmigration, gespeicherter Altbestand.

Messmethode (ausgeführt): `IZ()` und `aussagenListe()` wurden in einer Wegwerfkopie so instrumiert, dass jeder Aufruf protokolliert, ob zu diesem Zeitpunkt ein Altbestand existiert. `ALT()` liefert ohne Altbestand das eingefrorene leere `ALT_LEER`; `IZ()` gab dann bei jedem Aufruf ein neues leeres Objekt zurück, Schreibzugriffe gingen verloren. Zusätzlich wurde `IZ()` probeweise so ersetzt, dass es Schreibzugriffe verwirft; in dieser Probe kippte nur `phase5b2-recherchezugang`.

| Skript | Aufrufe | Altbestand bei Aufruf | Zweck | Behandlung |
|---|---|---|---|---|
| `kt`, `kv3`, `kt2`, `kt3` (Karte) | 6, 6, 6, 3 | nein | Vorbedingung aus der Missionszeit (`status:'frei'`), ohne Wirkung | Schreibzugriff entfernt |
| `un`, `emp2` | je 31 | nein | wie oben, über alle Dossiers | Schreibzugriff entfernt |
| `phase5b4-arbeitszugang`, `sichtung-export`, `terminal-namensnavigation` | je 2 | nein | Entkopplungsnachweis „alter Kenntnisstand ohne Wirkung“, historisch gedacht, aber seit 5c1b ohne Datengrundlage | Schreib- und Lesezugriff entfernt, Meldungen angepasst, Kommentar im Test |
| `terminal-sudo` | 1 (Lesen vor dem direkten Schreiben des Altbestands) | nein | Auswahl eines Dossiers | immer wahre Bedingung entfernt; die echten Altbestandsprüfungen des Tests bleiben |
| `phase5b2-recherchezugang` | 1 (Lesen) | ja, 1 Eintrag | Nachweis „Altfeld erhalten“ | direkter Lesezugriff auf `STATE.altbestand.infozugang` |
| `phase5b3-dossieroberflaeche` | 1 (Lesen) | ja, 1 Eintrag | Auswahl eines Dossiers ohne alten Eintrag | direkter Lesezugriff auf `STATE.altbestand.infozugang` |
| `phase5c1b-zustandsformat` (`aussagenListe`) | 1 | ja, 1 Aussage, `STATE.aussagen` nicht vorhanden | „frühere Aussage bleibt lesbar“ nach der Migration | Zählung direkt aus `STATE.altbestand.aussagen`, semantisch gleich |

Befund, der eine Entscheidung verdient: Die Entkopplungsnachweise von `phase5b4-arbeitszugang`, `sichtung-export` und `terminal-namensnavigation` laufen seit 5c1b auf einem Zustand ohne Altbestand und belegen daher nur das Verhalten ohne alte Freigabestufen. Mit echtem Altbestand sichern die Entkopplung `phase5b2-recherchezugang`, `phase5b3-dossieroberflaeche`, `terminal-sudo` und `phase5c1b-zustandsformat`. Diese drei Tests wurden in diesem Schritt nicht gestärkt, weil das die Testsemantik ändern würde; ob sie einen echten Altbestand aus einer Migrationsfixture erhalten, ist offen.

Außerhalb der Standardauswahl nutzen 50 weitere Skripte `IZ()` (11 als historisch markiert, 39 sonst). Sie waren vor diesem Schritt auf `main` alle rot (gemessen) und bleiben unverändert; sie schlagen künftig an der fehlenden Funktion fehl. Ausmusterung ist eine eigene Entscheidung.

Neue Tests: `tests/phase5c2b-frischer-zustand.js` (beide Funktionen entfernt, `ALT()` ohne Altbestand eingefroren leer, frischer Zustand bleibt nach der Vorbereitung der früheren Gruppe-3-Tests, Speichern und Neuladen ohne Altbestand, die umgestellten Skripte enthalten weder `IZ(` noch `altbestand`) und `tests/phase5c2b-karte-altbestand.js` (Karte gegen den Altbestand der Fixture `altprofil-mission.json`: Pin-, Dossier- und Sichtungsmarker, Markermenge mit und ohne Altbestand identisch, Altbestand unverändert auch nach Neuladen). Mutationsproben (jeweils rot): Produktivcode vor der Entfernung, `ALT()` legt Altbestand an, ein Gruppe-3-Skript enthält `altbestand`, die Karte blendet bei Altbestand einen Marker aus, die Karte verändert den Altbestand.

### 8f. Teststärkung 5c2b (b): Entkopplungstests gegen migrierten Altbestand (Freigabe Master Wayne 23.11.2026)

Anlass: Die Entkopplungsnachweise `phase5b4-arbeitszugang`, `sichtung-export` und `terminal-namensnavigation` liefen seit 5c1b auf einem Zustand ohne Altbestand (Abschnitt 8e). Auf Weisung von Master Wayne erhalten sie zusätzlich einen migrierten Format-4-Zustand mit tatsächlich vorhandenen historischen Freigabestufen. Die bestehenden Frischzustandsprüfungen bleiben unverändert; Produktivcode, Altbestand, Export und Migration wurden nicht geändert.

Aufbau: Neuer Helfer `tests/_altzustand.js` schreibt die Fixture `tests/fixtures/altprofil-mission.json` (Format 4) vor der Anmeldung in den Speicher und ergänzt `infozugang` für vier Standard-Personendossiers (die ersten vier Personen des Szenarios, im Lauf `P-0004` bis `P-0007`):

| Dossier | historische Stufe | Eintrag in `infozugang` | später |
|---|---|---|---|
| `P-0004` | bekannt | `{ status: 'bekannt' }` | – |
| `P-0005` | frei | `{ status: 'frei' }` | – |
| `P-0006` | unbekannt | kein Eintrag (so ergab `wissen()` vor 5b7 die Stufe) | – |
| `P-0007` | frei | `{ status: 'frei' }` | manuell gesperrt |

Die Stufen wurden aus der Fassung von `wissen()` vor 5b7 (Commit `c7d9c2d`) abgeleitet: Einträge mit `status: 'frei'` und `'bekannt'`; ein Standarddossier ohne Eintrag galt als `unbekannt`. Ein ausdrücklich gespeicherter Status `'unbekannt'` wurde nicht erfunden und nicht getestet.

Jeder Test prüft zuerst, dass die Migration tatsächlich `STATE.altbestand.infozugang` mit allen drei Stufen erzeugt hat (sonst wäre der Abschnitt wieder wirkungslos), und danach:

- `phase5b4-arbeitszugang`: `wissen()` 'frei', keine Freigabesperre, `zielZugang` nur nach manueller Sperre, Fall-X-Auswahl und Verknüpfung, Arbeitsstand und Ablage-Eingang für alle vier Dossiers; manuelle Sperre auf `P-0007` (historisch 'frei') bleibt in Fall, Arbeitsstand, Recherche und Eingang wirksam, die anderen Dossiers bleiben zugänglich; Entsperren stellt den Zugriff wieder her.
- `sichtung-export`: Export einer Sichtung (`kartenTxtExport`) für die drei nicht gesperrten Stufen nicht blockiert; manuelle Sperre auf `P-0007` blockiert ohne Download; nach dem Entsperren exportierbar.
- `terminal-namensnavigation`: `open "<Name>"` und Tab-Ergänzung für alle Stufen; gesperrter Name auch mit historischer Freigabe weder per `open`, `sudo open` noch per Tab auflösbar und im Scrollback maskiert; nach dem Entsperren live navigierbar.
- Alle drei: der Altbestand ist am Ende im Speicher und im gespeicherten Zustand gleich dem Zustand nach der Migration; keine Seitenfehler.

Gegenproben (temporäre Änderung, danach per Kopie zurückgestellt; die alten Testfassungen aus `5c5a545` liefen zum Vergleich mit):

| Mutation | alte Fassung | neue Fassung |
|---|---|---|
| M2: `dossierGesperrt` sperrt zusätzlich bei historischer Stufe 'bekannt' | grün (alle drei) | rot (alle drei: `phase5b4-arbeitszugang`, `sichtung-export`, `terminal-namensnavigation`) |
| M3: `dossierGesperrt` ignoriert die manuelle Sperre bei historischer Stufe 'frei' | grün (alle drei) | rot in `phase5b4-arbeitszugang` und `terminal-namensnavigation`; `sichtung-export` bleibt grün |
| M3b: dasselbe nur in der ersten Sperrprüfung von `kartenTxtExport` (`PROFIL.gesperrt`) | grün | `sichtung-export` bleibt grün |
| M3c: M3 und M3b zugleich | grün | `sichtung-export` rot („manuelle Sperre blockiert trotz historischer Freigabe“) |
| M2b: `kartenTxtExport` sperrt zusätzlich bei historischer Stufe 'bekannt' | grün | `sichtung-export` rot (Zeitüberschreitung beim Warten auf den Download) |

Befund zu M3/M3b: Der Sichtungs-Export prüft die manuelle Sperre zweifach (direkt über `PROFIL.gesperrt` und über `dossierGesperrt`). Eine Mutation nur einer der beiden Prüfungen wird von der jeweils anderen aufgefangen; erst beide zusammen (M3c) lassen die historische Freigabe wirken, und das erkennt der Test. Das ist eine bewusste Doppelabsicherung im Produktivcode und kein Testmangel.

Grenzen: Geprüft wird ein kontrollierter Migrationsbestand aus der Fixture, nicht ein echtes Nutzerprofil. Der lokale Volllauf kann acht Standardtests wegen der Sandbox-Umgebung nicht bestätigen (identisch auf unverändertem `main`); maßgeblich ist die CI.

## 9. Prüfhistorie

- 22.11.2026: Bestandsaufnahme (Claude, `f29bad8`).
- 22.11.2026: Entscheidung E6 und Klarstellung E7 nach Rückfrage Master Wayne (`847dac2`). Die zuvor übermittelte Zusammenfassung nannte beide noch als offen; maßgeblich ist dieses Dokument.
- 22.11.2026: Unabhängige Quelltextprüfung durch ChatGPT. Zustimmung zum Konzept, präzisierte Anforderungen (eingearbeitet in Abschnitt 7 und 8), Befunde B7 und B8. Von Claude gegen den Code geprüft: alle überprüfbaren Aussagen zutreffend. Ausdrücklich keine Merge-Freigabe.
- 22.11.2026: Entscheidung E2.7 („Profil leeren“ löscht die Profiltexte mit) durch Master Wayne; Beginn 5c1a.
- 22.11.2026: Review von ChatGPT zu #110 (Leerstand beim Profilimport, Spiegelzeitpunkt); korrigiert, Merge-Freigabe durch Master Wayne nach erfolgreicher Prüfung.
- 22.11.2026: Beginn 5c1b auf Anweisung Master Wayne; Umsetzung als Draft (Abschnitt 8b).
- 22.11.2026: Unabhängiges Review von ChatGPT zu #111 (Review 6014052284, Head `2cb4185`): Blocker (Ladepfad `Store.load` → `init`) und drei Absicherungen; von Claude gegen den Code geprüft und am Verhalten reproduziert (Test A auf dem alten Stand: vorhandener Zustand durch einen frischen ersetzt). Korrektur in Abschnitt 8b. Keine Merge-Freigabe.
- 22.11.2026: Nachprüfung von ChatGPT zu #111 (Review 6014282037, Head `978d7a2`): Hauptpfade behoben, Restfall leerer Schlüssel; von Claude am Code bestätigt und korrigiert (siehe 8b). Keine Merge-Freigabe.
- 22.11.2026: Entscheidung E8 (Option C) durch Master Wayne; Beginn 5c2a (Abschnitt 8c).
- Korrektur: Mehrere Dokumente dieser Phase trugen irrtümlich das Datum 23.11.2026; berichtigt auf 22.11.2026. Die Branchnamen der PRs #105 bis #109 enthalten dasselbe falsche Datum (`…-20261123`); sie bleiben aus Nachvollziehbarkeitsgründen unverändert.
- 23.11.2026: Freigabe von 5c2b (a) durch Master Wayne (Umfang und Ausschlüsse in Abschnitt 8d); Grundsatz: Entfernung nur bei nachgewiesener Unerreichbarkeit oder fehlender fachlicher Bedeutung, nicht bei bloß wenigen Referenzen. Umsetzung als Draft #118. Für 5c2b (b) gilt: bei `IZ()` je Test unterscheiden, ob er historisches Verhalten dokumentiert oder eine produktive Funktion absichert; kein pauschales Ersetzen. 5c2b (c) bleibt zurückgestellt.
- 23.11.2026: Unabhängige Prüfung von #118 durch ChatGPT (Review 6021844935 auf Head `c40b5b9`): vollständige CI anhand des GitHub-Protokolls bestätigt (94 grün); die lokalen Rot-vor-Grün-Gegenproben wurden nicht wiederholt; kein weiteres Windows-Testpaket nötig. Merge-Freigabe durch Master Wayne, Merge erst nach diesem Dokumentationsnachtrag und grüner CI auf dem Nachtragsstand.
- 23.11.2026: Freigabe von 5c2b (b) durch Master Wayne mit den Vorgaben aus Abschnitt 8e (Gruppe 3 nur nach Einzelnachweis entfernen, keine neuen Schreibzugriffe auf den Altbestand, Einzelklassifikation, getrennte Commits, gezielter Test für den frischen Zustand, Karte mit Altbestand per Fixture prüfen). Umsetzung als Draft #119.
- 23.11.2026: Unabhängige Tiefenprüfung von #119 durch ChatGPT (Review 6025309864 auf Head `484ec7c`): Produktivcode unverändert ausreichend, vollständige CI (96 grün) bestätigt. Als verbleibende Risiken genannt: die 50 Nicht-Standardskripte wurden nicht unabhängig reproduziert und sind, besonders die 39 nicht als historisch klassifizierten, einzeln zu bewerten, bevor sie ausgemustert werden; drei Entkopplungstests prüfen nur den Zustand ohne Altbestand. Merge-Freigabe durch Master Wayne nach Kontrolle; Merge erst nach diesem Dokumentationsnachtrag und grüner CI auf dem Nachtragsstand.
- 23.11.2026: Freigabe der Teststärkung (Abschnitt 8f) durch Master Wayne; Umsetzung als Draft. Merge-Commit von #119: `5c5a545af952a85c2aef53ced2b489e1306975f1`.
