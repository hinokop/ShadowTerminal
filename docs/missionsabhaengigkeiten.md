# Missionsabhängigkeiten: Bestandsaufnahme und erste Trennung

Stand: `main` 00c47ad plus Branch `refactor/missionsautomatik-trennen`. Quelle: Lektüre des Codes und Messung mit Playwright
(frisches Profil, Altprofil mit laufender Mission). Zahlen zu Fundstellen sind Zählungen im Quelltext, keine Bewertung.

## 1. Beim Start

| Stelle | Abhängigkeit von der Mission | Zustand |
|---|---|---|
| Ende von `index.html` | Der Start bricht mit `szenarioFehlt()` ab, wenn `SCENARIO.missionen` fehlt oder leer ist. | unverändert |
| `isValidState()` | Ein gespeicherter Zustand gilt nur als gültig, wenn die gesamte Missionsstruktur stimmt (`missionen`, `kontext`, Zeitfenster, `komm`, `extraktion`, `plan`, `automatik` und weitere). Ein Zustand ohne diese Struktur wird als `.defekt` gesichert und durch einen neuen ersetzt. | unverändert |
| `buildInitialState()` | Erzeugt Missionsstände für alle Missionen, Kanäle, Extraktion, Spurenmodell und die Dossiers des Szenarios. Frischer Zustand: `vorlauf: true`, Status `Ruhend`, leerer Plan. | unverändert |
| `SITZUNG_START` | Meldefenster der Abwesenheit und Rückstau-Bereinigung des Plans (verwirft Nachfragen, staffelt fällige Einträge). | **jetzt nur im Missionsbetrieb** |
| `SITZUNG_START` | `profilEinspielen(STATE)`: überträgt das Profil in den Zustand. Das ist Recherchebetrieb. | unverändert |
| `init()` → `planeAlle()` | Zustellzeitgeber für eigene Nachrichten im Kommunikationsmodul (Status zugestellt, gelesen). Betrifft nur Nachrichten, die es im Recherchebetrieb nicht gibt. | unverändert |
| `init()` → `setInterval(tick, 1000)` | Sekundentakt, siehe 2. | siehe 2. |
| Kopfzeile und Arbeitsmodule | Alte Einstufung, Standortfreigabe und Vorgangsnummer sind aus dem Arbeitsgerüst entfernt. | **R2** |
| Kartenebenen | Im Recherchebetrieb zeigt die Karte eigene Objekte und Dossiers ohne Auftragsmarker oder -werkzeuge. | **R2**, siehe 4b |

## 2. Im Hintergrund (Sekundentakt `tick()`)

Ohne Bedingung bleiben: Zugangs-Leerlauf (`Zugang.leerlauf`), Kanalanzeige, Uhr und Diagnoseterminal-Aktualisierung (`renderClock`).

| Auslöser im Takt | Wirkung | Zustand |
|---|---|---|
| `LZ_ANSETZEN` (Lebenszeichen bei Standby) | Plan, Nachfrage des Ansprechpartners | **jetzt nur im Missionsbetrieb** |
| `BELASTUNG_PRUEFUNG` (Belastung ab 70/85) | Hinweis, Sperre, Protokoll | **jetzt nur im Missionsbetrieb** |
| `MISSION_ZUGEWIESEN` (Folgeauftrag) | Weist den nächsten Auftrag zu | **jetzt nur im Missionsbetrieb** |
| `FAELLIG` (Planeinträge, Antworten, Skript, Freigaben) | Nachrichten, Statuswechsel, Protokoll | **jetzt nur im Missionsbetrieb** |
| `ZONEN_EREIGNIS` (Zonenmeldungen alle 8 min im Einsatz) | Sichtungen und Protokoll an Missionszonen | **jetzt nur im Missionsbetrieb** |
| `MELDEFENSTER_PRUEFUNG` | Versäumnisse, Spuren, Protokoll | **jetzt nur im Missionsbetrieb** |

Nicht im Takt, aber zeitgesteuert: das Zeitfenster-Overlay der Karte („Wiedergabe“) läuft nur auf Knopfdruck und gehört zur Kartenbedienung.

## 3. Rückwirkung der Recherche auf die Mission (Hook in `dispatch`)

Jede protokollierte Handlung ging bisher durch `zustandAus()` (Ereignisregeln, Spurenmodell, Vertrauens- und Belastungswerte) und `abdPruefen()`.
Dadurch konnte eine Recherchehandlung Missionsfolgen auslösen. Gemessen: `SICHTUNG_HINZU` mit `quelle: 'Meldung'` legt über die Ereignisregel
`E-sichtung-quelle` einen Planeintrag mit Rückfrage des Ansprechpartners an. Auf einem frischen Profil ohne Mission geschieht das bei den üblichen
Recherchehandlungen nicht (gemessen: Plan, Nachrichten und Protokollmodule unverändert nach Dossier, Sichtung, Pin, Zone).

Zustand: **jetzt nur im Missionsbetrieb**.

## 4. Was „Missionsbetrieb“ bedeutet

`STATE.missionsbetrieb === true`. Das Feld wird gesetzt, sobald eine der Aktionen `STATUS_GESETZT`, `MISSION_ZUGEWIESEN`, `MISSION_ANGENOMMEN`,
`MISSION_BEGINN_JETZT`, `MISSIONSSTATUS_GESETZT` oder `AUTOMATIK_GESETZT` ein Ergebnis liefert. Frische Profile und alle geladenen Altprofile haben das
Feld nicht und sind damit im Recherchebetrieb. Der neue Profilstatus (Offline, Standby, Aktiv) liegt in `PROFIL.arbeitsstatus` und löst keine dieser Aktionen aus.

Gespeicherte Felder werden nicht entfernt und nicht verändert; ein Altprofil mit laufender Mission behält Mission, Plan, Status und alle Zähler.
Zur Rückkehr in den Missionsbetrieb genügt eine Missionsaktion; die Tests des Missionsablaufs (Standardauswahl) nutzen genau diesen Weg.

## 4a. Folge für Altprofile

Ein Altprofil mit laufender Mission friert ab: fällige Planeinträge, Folgeaufträge, Meldefristen und Zonenmeldungen werden nicht mehr abgearbeitet. Es gibt in
der Oberfläche keinen Weg mehr, darauf zu antworten (Missionsreiter und Kürzel sind seit PR #17 entfernt).

## 4b. R2 – Arbeitsoberfläche

- Die Lage-Box zeigt Objektbezug oder Kartenmitte, Position, ggf. den Zonenstand und den Protokollsprung sowie Licht und Wetter. Sie liest keine Auftragszeilen, auch im internen Missionsablauf.
- Die 2D-Karte und ihre 3D-Daten zeigen im Recherchebetrieb weder Missionsstandorte und -zonen noch Check-in-, Ziel- oder Stufenmarkierungen. Arbeitsdossiers mit Geokoordinaten bleiben Kartenobjekte. Pins, eigene Zonen, Ausgangsorte, Sichtungen und der TXT-Export bleiben verfügbar.
- Ein bereits gespeichertes `STATE.missionsbetrieb` öffnet nach Laden oder Import keine historische Kartenansicht. Für die internen Abläufe und ihre Tests wird diese Ansicht lediglich nach einer erfolgreichen ausdrücklichen Missionsannahme in derselben Sitzung geöffnet. Der Speicherschalter, der den alten Hintergrundablauf steuert, ist unverändert.
- Keine Änderung am Datenformat, an der Dossier-Freigabemechanik, an der Kennwortmaske, am Profil oder am Windows-Start.

## 5. Bewusst noch nicht angefasst

- Der Zustand `STATE` bleibt vollständig an die Missionsstruktur gebunden (`isValidState`, `buildInitialState`, `migrate`).
- Die Standarddossiers und Missionsdossiers (`SCENARIO.entitaeten`, `SCENARIO.standard.dossiers`) liegen in `szenario.js`; das Dossiermodul liest sie von dort.
- Dossier-Freigabemechanik (`wissen`, `infoGesperrt`, `freigeschaltet`, ARGUS-Freigabe), Funkruhe, Kennwortprüfung (`kw`), Extraktion, Anreiseplanung.
- Kommunikations-, Handler-, Regie- und Missionsmodule im Code (ohne Einstieg in der Oberfläche).
- Zählung im Quelltext: `LM()`, `KM()`, `missionDef(`, `MS(` kommen in `index.html` etwa 197-mal vor, in `karte-modul.js` 16-mal, in den übrigen Modulen nicht; `STATE.vorlauf` in `index.html` 11-mal und in `karte-modul.js` 9-mal.

## 6. Nicht geprüft

- Der Altprofil-Test nutzt einen Zustand, der mit dem Stand vor den Umbauten (c276654) erzeugt wurde. Ein anderer Altstand (zum Beispiel mit Extraktion oder Funkstille) wurde nicht getestet.
- Die Dateianhänge der Unterlagen (eigene IndexedDB) sind nicht Teil des Altprofil-Tests.
- Echte Browserprofile aus längerem Gebrauch, Windows-Start, 3D-Ansicht.
