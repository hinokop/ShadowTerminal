# Paket 4, M5: Inventar des Archivordners `pgcl-eu3.arch07`

Stand 25.11.2026, Branch `docs/paket4-m4-vertrag-20261125` (#140). Grundlage: Konzept §6 und F6. **Keine Löschung, Umbenennung oder Migration**; dieses Dokument beschreibt und schlägt vor.

## 1. Bestand im Repository

Geprüft mit `ls` und `cat` im Arbeitsbaum und `git log` (alle fünf Dateien seit Commit `f9dfce4` unverändert).

| Pfad | Inhalt | Einordnung |
|---|---|---|
| `dossiers/dossier-index.txt` | „DOSSIER-INDEX / Beispielablage. Keine aktiven Einträge.“ (55 B) | statische Beispieldatei; **nicht** der Live-Index (`/intel/dossiers/index`) |
| `dokumente/referenzmaterial.txt` | „DOKUMENTENREGISTER / D-001 · Referenzmaterial · Beispieldatei“ (62 B) | statische Beispieldatei |
| `ops/lagebericht.txt` | „LAGEBERICHT / Interne Ablage · Beispieldatei.“ (45 B) | statische Beispieldatei |
| `kontakte/kontaktliste.txt` | „KONTAKTLISTE / K-001 · Beispielkontakt · keine Kontaktdaten“ (60 B) | statische Beispieldatei aus dem früheren Spiel |
| `freigaben/freigabeprotokoll.txt` | „FREIGABEPROTOKOLL / Keine offenen Freigaben.“ (43 B) | statische Beispieldatei aus dem früheren Spiel |

## 2. Nutzung im Code

- **Dateinamen:** Keine der fünf Dateien wird im Produktionscode namentlich gelesen (Suche über `*.js`, `index.html`, `terminal_lokal.py`). Sie sind nur über die Brücke erreichbar (`ls`, `cat`, `wget`, `/sendfile`).
- **Ordner `dokumente` und `ops`:** Diese beiden Ordner sind fachlich in Gebrauch. Sie sind die einzigen Ziele des Hostexports (`terminal_lokal.py`, `export-txt`; `karte-modul.js`, Kartenexport) und die Quelle des VAULT-Katalogs (`exports`, `open export`, Erkennung von `lageblatt-PIN-…`, `zone-ZO-…`, `sichtung-…`).
- **Ordner `dossiers`, `kontakte`, `freigaben`:** Diese drei Ordner haben keinen Bezug im Code. `dossiers` ist im Terminal ein Name von `/intel/dossiers`, nicht dieser Ordner.
- **Tests:** `terminal-link-kette` arbeitet mit einem Brücken-Double unter `ops`, `terminal-paket4-review` mit eigenen Dateien in einem temporären Archiv; das echte Repository-Archiv wird von keinem Test gelesen.

## 3. Nicht inventarisierbar

Eine Prüfung der Windows-Installation hat nicht stattgefunden. Echte Nutzerdateien (eigene Ablage, Hostexporte `lageblatt-…`, `zone-…`, `sichtung-…`, eventuell Versionen `-vN`) liegen nur dort. Sie lassen sich im Terminal mit `ls -R /pgcl-eu3.arch07` erfassen. Ihre Herkunft ist nicht rekonstruierbar (Review 2 zu #140), es gibt keine Migration.

## 4. Vorschlag (zur Entscheidung, nicht umgesetzt)

1. Archiv als Hostbrücke erhalten (F6). Es bleibt der einzige Weg zu echten Windows-Dateien und das Ziel der Hostexporte.
2. Live-Daten über `/intel` und Momentaufnahmen über `/exports` bevorzugen. Die Beispieldateien bleiben, könnten aber in einer späteren Runde eine Kopfzeile „historische Beispieldatei“ erhalten oder aus der Auslieferung entfallen. Das ist eine Entscheidung von Shadow; es gibt keine Löschung auf Verdacht.
3. `kontakte` und `freigaben` stammen aus dem Missionsbetrieb und werden nicht mehr genutzt. Sie sollten in die spätere Phase-5c-Migration der Altbestände aufgenommen werden, nicht in Paket 4.
4. Der Befehl `exports` (VAULT-Katalog über Hostexporte im Archiv) und der Einhängepunkt `/exports` (verwaltete Momentaufnahmen) haben ähnliche Namen. Eine Vereinheitlichung oder Umbenennung braucht eine eigene Entscheidung; VAULT wird nicht umdefiniert (Konzept §6).
