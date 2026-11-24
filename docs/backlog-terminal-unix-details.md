# Backlog: Unix-Detailsemantik des Terminals (Stand 24.11.2026)

Entscheidung von Master Wayne (24.11.2026): Die Entwicklungsreihenfolge ändert sich. Phase 6a (pwd, cd, ls) ist mit #134 (6a-3) und #135 (6a-4a) abgeschlossen. Weitere isolierte Unix-Detailverbesserungen werden **nicht begonnen**, bis Zielarchitektur des Dateisystems und funktionale Vision des Terminals erarbeitet sind (siehe [terminal-zielarchitektur-vorbereitung.md](terminal-zielarchitektur-vorbereitung.md)). Begründung: Die Detailtreue (Kollation, Rechte, Zeitformate) hängt an Architekturentscheidungen, die noch offen sind (virtuelles, beschreibbares Dateisystem, Quellen virtuell, real oder dynamisch).

Die folgenden Punkte sind dokumentierter Backlog, keine Planung. Jeder Punkt wird nach der Architekturentscheidung neu bewertet und gegebenenfalls verworfen.

| Nr. | Punkt | Stand und Bezug | Hängt ab von |
|---|---|---|---|
| B1 | Langformat von `ls -l` (`total`, Rechte, Linkzahl, Eigentümer, Gruppe, Größe, Zeit) | bisher eigenes Format (`dr-x`/`-r--`, Größe, Zeit in UTC); im virtuellen Baum zeigt `-l` nur Namen; Plan 9.12/9.13 | Rechtemodell, Quellenmodell (virtuell, real, dynamisch) |
| B2 | Dateirechte und Eigentümer (fiktive Unix-Rechte) | derzeit unklar, ohne Produktnutzen; Rechtebits wären erfunden | Schreiboperationen, Benutzermodell (`raizo`, `sudo`) |
| B3 | Zeitformat (`Nov 24 16:40` bis sechs Monate, sonst `Nov 24  2025`) | **UTC bleibt vorerst der Zeitstandard** (Entscheidung 24.11.2026); keine Zeitzonenumstellung | Zeitmodell, `date`/`stat` |
| B4 | Sortierung der Tab-Vorschläge nach en_US.UTF-8 | `ls` sortiert seit #135, Tab nicht (bash sortiert Vervollständigungen ebenfalls nach Locale) | Dateisystemschnittstelle |
| B5 | Shell-Variablen `$HOME`, `$PWD`, `$OLDPWD` (Plan 6a-5), Locale über `LANG`/`LC_ALL`/`LC_COLLATE` konfigurierbar | vorgesehen, nicht umgesetzt; `terminal-locale.js` ist fest `en_US.UTF-8` | Shell-Umgebungsmodell |
| B6 | Weitere `ls`-Optionen (`-r -t -S -X -U -R -q --color` u. a.) | werden als unbekannt gemeldet (Planentscheidung) | Metadaten der Quellen |
| B7 | Archivschutz mit strukturierten Ausgabemetadaten statt Basisnamen-Parsing | Empfehlung der unabhängigen Prüfung (#134): der Schutz hängt am Ausgabeformat | Ausgabemodell, Langformat |
| B8 | Zeichen außerhalb des Kollations-Repertoires, kombinierende Zeichen | dokumentierte Abweichung (#135) | Namensmodell bei Schreiboperationen |
| B9 | Optionale Regenerierungsprüfung der Kollationstabelle im CI nachweisbar machen | im CI-Log nicht belegt, ob die glibc-Quelle vorhanden war (#135) | CI-Umgebung |
| B10 | Windows-Abnahme der Etappen 6a-3 und 6a-4a | nicht erfolgt | Windows-Testpaket |

Unverändert gilt: Manuelle Dossiersperren und die Sicherheitsregressionen aus #133 bleiben erhalten; Pfadauflösung bleibt streng (Groß-/Kleinschreibung) und unabhängig von der Sortierung.
