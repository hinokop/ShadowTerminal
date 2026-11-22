# Phase 5c – Bestandsaufnahme Zustands- und Profilschema

Stand: 23.11.2026, Basis `main` `c19b93b` (nach #108 und #107). **Reine Bestandsaufnahme, kein Code geändert.** Entscheidungen am Ende; Umsetzung erst nach Freigabe durch Master Wayne.

Methode: Empirische Sonde (frischer Stand und geladenes Altprofil aus `tests/fixtures/altprofil-mission.json`: Felder, Typen, Größen), AST-gestützte Zählung aller Lese- und Schreibstellen je Feld und Funktion, gezielte Durchsicht der Lade-, Prüf-, Export- und Importpfade. Wo eine Aussage aus dem Code abgeleitet und nicht ausgeführt wurde, ist das vermerkt.

## 1. Speicherorte

| Ort | Inhalt | Lebensdauer |
|---|---|---|
| `localStorage` `fieldterminal.v1` | Sitzungszustand `STATE` (Format `STATE_VERSION`) | wird bei „Zurücksetzen“ neu aufgebaut |
| `fieldterminal.v1.profil` | Profil `PROFIL` (`v: 1`, `idv: 2`) – eigene Dossiers, Pins, Zonen, Recherche, Bilder usw. | übersteht Zurücksetzen; Gegenstand des Profilexports |
| `fieldterminal.v1.auth` | Kennung (gesalzener PBKDF2-Hash) | unberührt von Export und Zurücksetzen |
| `fieldterminal.v1.profil.ablage-eingang` | Datei-Eingang der Ablage (Metadaten) | |
| `fieldterminal.v1.kartenwahl` | Ebenen und Anbieter der Karte | |
| `fieldterminal.v1.dienste` | Zustand der inszenierten Relais-/Adressleiste | |
| `fieldterminal.v1.erkennung` | Protokoll der alten Dialogerkennung (bis 2.000 Einträge) | **Code liest es beim Start, nutzt es aber nicht mehr** |
| `fieldterminal.v1.defekt` | Rohinhalt eines nicht ladbaren Zustands (nur der letzte) | entsteht bei ungültigem Zustand |
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
- **B6 – Adressleiste:** Die `.onion`-Adresse der URL-Leiste wird einmalig zufällig erzeugt und unter dem Schlüssel des Missionskontexts (`STATE.kontext`, stets `M1`) in `fieldterminal.v1.dienste` gespeichert; daher ist sie seit jeher konstant. Der Pfad folgt der Ansicht.

## 7. Entscheidungsvorlage

**E1 – Zielbild des Zustands.** Vorschlag: Zustandsformat 5 mit schlankem Kern (`version`, `t0`, `idv`, `ui`, `seq`, `dossiers`, `log`, `agent`-Kern, `alterung`). Eine Migration 4→5 verschiebt alle Missionsfelder **unverändert** nach `STATE.altbestand`. Zusätzlich wird vor der ersten Migration der vollständige alte Zustand einmalig unter `fieldterminal.v1.v4-sicherung` abgelegt. Es geht nichts verloren, und der Code liest Missionsfelder danach nicht mehr. *Alternativen:* (a) Missionsfelder nur aus der Prüfung nehmen und weiter mitführen (kleinster Eingriff, Altlast bleibt); (b) Missionsfelder bei der Migration verwerfen (nur nach ausdrücklicher Entscheidung).

**E2 – Notizen und Operative Einschränkungen ins Profil.** Vorschlag: nach `PROFIL` verlagern (übersteht Zurücksetzen, Teil des Profilexports), bestehende Texte bei der Migration übernehmen.

**E3 – Zustandsimport.** Vorschlag: Dateien im Format 4 über dieselbe Migration annehmen, Format 5 direkt; keine Prüfung der Missionsstruktur mehr.

**E4 – Rest-Code (B3).** Vorschlag: nach E1 in einem eigenen Schritt (5c2) entfernen, mit Differenztests für Karte und Dossiers wie in 5b9.

**E5 – Tote Datenpfade (B4).** Vorschlag: Code entfernen, Daten unter `.erkennung` und in `fieldterminal.dok` **liegen lassen** (kein Löschen ohne Entscheidung).

**E6 – Missionsdossiers P-0001 bis P-0003 (B5). Entschieden (Master Wayne, 23.11.2026):** Sie bleiben als Beispiele erhalten und werden **vollständig vom Missionskontext gelöst**, sodass sie als Blankos dienen. Kopplungen im heutigen Stand: (1) `mission: 'M1'` an den drei Dossiers und an ihren sieben Verbindungen `V-01` bis `V-07`; (2) ihr Status wird von `profilSpeichern` als Missionsstatus behandelt und **nicht ins Profil gesichert**, geht also beim Zurücksetzen verloren; (3) `isValidState` verlangt sie im Zustand; (4) Sonderbehandlung in `migrate`; (5) Verweise aus der Missionsdefinition (Schlüsselpersonen, Asset). Umsetzung: in den Standardbestand überführen (`mission: 'STD'`, ebenso die Verbindungen), Status wie bei Standarddossiers sichern, Kennungen `P-0001` bis `P-0003` unverändert lassen (Notizen, Sichtungen, Pins und Verknüpfungen in Profilen bleiben gültig). Die Missionsdefinition selbst wird nicht mehr gelesen.

**E7 – Adressleiste (B6). Klarstellung:** keine Gestaltungsfrage. Wenn `STATE.kontext` in den Altbestand wandert, braucht die URL-Leiste einen festen Schlüssel für ihre gespeicherte Adresse. Die vorhandene Adresse wird dabei übernommen; **sichtbar ändert sich nichts**.

## 8. Vorgeschlagene Reihenfolge

1. **5c1:** E2 und E1 mit Migration, Sicherung und angepasster Prüfung; Tests mit dem Altprofil-Fixture und einem künstlich gealterten Stand; Windows-Abnahme mit Ihrem echten Profil (Integrationsmeilenstein).
2. **5c2:** E3 bis E5 sowie der Rest-Code (B3), mit Differenztests.
E6 und E7 gehören zu 5c1 (Dossiers und Adressschlüssel hängen am selben Umbau).
