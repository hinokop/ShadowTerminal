# Zielarchitektur des Dateisystems und Vision des Terminals (Vorbereitung)

Stand 24.11.2026. Dies ist **kein Entwurf und keine Entscheidung**, sondern die Liste der Fragen, die gemeinsam mit Master Wayne zu klären sind, bevor weitere Terminalbefehle detailgetreu nachgebildet werden. Ergebnis soll ein Architekturdokument mit Entscheidungen und anschließend größere, logisch abgegrenzte Entwicklungspakete mit praktisch testbarem Mehrwert sein.

## Fragen

1. **Quellen der Dateien:** Welche Dateien sind virtuell (Terminal-eigen), welche real (lokale Dateibrücke, Archivordner), welche dynamisch aus dem Anwendungszustand erzeugt (Dossiers, Fälle, Pins, Zonen, Sichtungen)? Wo verläuft die Grenze zwischen Simulation und echtem Zugriff (siehe `docs/terminal.md`)?
2. **Verzeichnisstruktur:** Wie sieht der Baum aus (home, etc, var, mnt, opt, tmp und fachliche Bereiche wie Dossiers, Fälle, Geodaten)? Was bleibt aus dem heutigen Aufbau (`/etc`, `/var`, Archiv im Wurzelverzeichnis)?
3. **Schreiboperationen:** Können Dateien und Verzeichnisse angelegt, verschoben, bearbeitet und gelöscht werden? Wo liegen sie (IndexedDB, Dateibrücke, Fallpaket)? Was gehört zum Fallpaket-Export?
4. **Integration:** Dossiers, Fälle (X), Karte (Pins, Zonen, Sichtungen), Ablage und Arbeitsstand über das Dateisystem erreichbar (`open`, `map` bleiben)? Welche Sperren und Zugriffsregeln (manuelle Dossiersperre, Archivschutz) gelten in welcher Form?
5. **Import und Export:** Kann das Terminal einen Fall exportieren oder eine Sichtung importieren? Verhältnis zum bestehenden Fallpaket und zur Dateibrücke.
6. **Konfiguration:** Eigene Konfigurationsdateien für KESTREL, PPP und andere Systeme.
7. **Bedienkonzept:** Wie weit soll das Terminal die grafische Oberfläche perspektivisch ersetzen können? Welche Arbeitsabläufe sollen rein per Terminal möglich sein?
8. **Realismusgrad:** Welche Unix-Semantik ist für den Produktnutzen nötig (Rechte, Eigentümer, Zeit, Locale), welche ist Selbstzweck? Maßstab: unmittelbar wahrnehmbarer, praktisch testbarer Mehrwert.

## Vorgehen (vorgeschlagen, zur Abstimmung)

- Zuerst Vision und Bedienkonzept, dann Dateisystemarchitektur, dann abgegrenzte Produktabschnitte, zuletzt technische Verfeinerung.
- Größere Entwicklungspakete, gezielte Zwischentests während der Entwicklung, vollständige CI und unabhängiges Review am Integrationsmeilenstein; sicherheitskritische Änderungen bleiben gesondert abgesichert (eigener PR, eigene Regressionen, eigenes Review).
- Die Abstraktionsschicht `TERMINAL_FS` (Phase 6a-0) bleibt die Grundlage; vorhandene Tests (Sicherheit, `ls`/`cd`/`pwd`) bleiben Regressionsschutz.
