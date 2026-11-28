# K4e-3b – Auswertung der synthetischen Kartenlast

Stand: 28.11.2026. Messbasis: `ecb83e8573cf438b874b41ce615f6912f0fde134` (PR #142, Draft).
- [Geospatial CI 46137650247](https://github.com/hinokop/ShadowTerminal/actions/runs/46137650247), Job 140956456832: **25/25 grün**.
- [Standard-CI 46137650202](https://github.com/hinokop/ShadowTerminal/actions/runs/46137650202), Job 140956456656: **136/136 grün**.
- Beide: null ungeprüfte, fehlende oder unerwartet rote Tests. Werte aus den tatsächlichen Joblogs, auf eine Nachkommastelle gerundet (Heap auf zwei).

## Messbedingungen

| | Geospatial | Standard |
|---|---|---|
| CPU (Runner-Angabe) | Intel Xeon Platinum 8573C | Intel Xeon 6975P-C |
| Logische/verfügbare CPUs | 4/4 | 4/4 |
| Gesamtspeicher (MiB) | 15983 | 15702 |
| OS / Browser | Linux x64 / Chromium 143.0.7499.4 | Linux x64 / Chromium 143.0.7499.4 |

Beide: 1100 × 800 CSS-Pixel, DPR 1, ANGLE/SwiftShader angefordert (keine separate Verifikation des tatsächlichen GPU-Treibers), leere Basiskarte, ein produktiver MapLibre-Adapter pro frischem Browserkontext, keine echte Anwendungsoberfläche und kein Profil. Je Laststufe genau ein Messlauf pro Runner. 100 bzw. 1000 Objekte: 80/800 Marker, 10/100 Zonen, 10/100 Kanten. Die Marker belegen aufsteigend verschiedene Bereiche des gleichen Rasters; die Laststufen unterscheiden sich dadurch auch räumlich. Kein kontrollierter A/B-Hardwarebenchmark, keine allgemeine FPS-Aussage.

## Messwerte

Alle Zeitwerte in ms; vier Spalten entsprechen den einzelnen Läufen, keine nachträgliche Mittelwertbildung.

| Metrik | Geo 100 | Geo 1000 | Standard 100 | Standard 1000 |
|---|---:|---:|---:|---:|
| Initial bis Anchor-Treffbarkeit inkl. Map-Konstruktion und Fixture | 418,7 | 462,1 | 395,7 | 405,6 |
| Synchrone Modellübergabe (vor Style-/Worker-Fertigstellung) | 1,0 | 3,4 | 0,5 | 2,3 |
| Sichtbare eindeutige Marker beim Initialtest | 80 | 800 | 80 | 800 |
| Pan: Dauer | 1048,9 | 1019,3 | 939,1 | 995,4 |
| Pan: rAF-Samples | 25 | 29 | 27 | 30 |
| Pan: Frameintervall P50 | 16,7 | 16,7 | 16,7 | 16,7 |
| Pan: P95 | 200,1 | 150,1 | 83,3 | 116,6 |
| Pan: Maximum | 299,9 | 166,7 | 183,3 | 116,7 |
| Pan: setData Punkte/Leitlinien | 4/4 | 5/5 | 5/5 | 6/6 |
| Zoom: Dauer | 947,9 | 978,1 | 970,9 | 957,3 |
| Zoom: rAF-Samples | 9 | 7 | 11 | 9 |
| Zoom: P50 | 100,0 | 116,7 | 83,3 | 83,3 |
| Zoom: P95 | 183,3 | 150,0 | 150,0 | 200,1 |
| Zoom: Maximum | 183,3 | 150,0 | 150,0 | 200,1 |
| Zoom: setData Punkte/Leitlinien | 2/2 | 2/2 | 2/2 | 2/2 |
| Neigung/Drehung: Dauer | 942,0 | 935,4 | 924,3 | 920,0 |
| Neigung/Drehung: rAF-Samples | 8 | 6 | 12 | 8 |
| Neigung/Drehung: P50 | 100,0 | 129,5 | 66,6 | 99,9 |
| Neigung/Drehung: P95 | 116,7 | 150,0 | 83,4 | 183,3 |
| Neigung/Drehung: Maximum | 116,7 | 150,0 | 83,4 | 183,3 |
| Neigung/Drehung: setData Punkte/Leitlinien | 5/5 | 4/4 | 4/4 | 5/5 |
| Klick: DOM-Event bis Callback | 2,2 | 1,6 | 2,0 | 2,3 |
| Klick: Playwright-Roundtrip | 8,8 | 5,1 | 3,5 | 3,8 |
| Filter: synchrone Leerung | 5,8 | 5,1 | 0,8 | 5,5 |
| Wiederaufbau bis Anchor-Treffbarkeit | 389,0 | 343,9 | 83,4 | 109,4 |
| Hauptthread-V8-Heap vor Map (MiB) | 2,43 | 2,43 | 2,44 | 2,46 |
| Hauptthread-V8-Heap initial geladen (MiB) | 8,63 | 14,84 | 6,88 | 12,48 |
| Hauptthread-V8-Heap nach Wiederaufbau (MiB) | 16,45 | 31,44 | 15,42 | 27,62 |
| Externe HTTP-Anfragen | 0 | 0 | 0 | 0 |

Move-Events Pan/Zoom/Neigung: Geo 100 = 25/10/9, Geo 1000 = 29/8/7; Standard 100 = 27/12/13, Standard 1000 = 30/10/9. In allen Fällen war die Kameraänderung tatsächlich nachgewiesen. Die Testanimationen waren mit 900 ms angefordert. rAF-Intervalle erfassen den Browser-Hauptthread einschließlich Render-/Scheduling-Einflüssen, keine gemessenen GPU-Bildraten. Die Initial- und Wiederaufbauzeit enthält das Warten auf die tatsächliche gerenderte Treffbarkeit des Referenzmarkers; kein Nachweis vollständiger Aktualisierung aller Geometrien in genau dieser Zeit. Heap-Snapshots ohne erzwungenen GC; weder Gesamtprozess- noch Worker-/GPU-Speicher.

## Befunde und Entscheidung

1. **Funktional bestanden.** Alle 100/1000 erwarteten Identitäten im Modell, initial sämtliche 80/800 Marker sichtbar. Reale Kameraänderungen, exakter Anchor-Klick, unmittelbare Ungültigkeit des entfernten Treffers, sichtbare Markerleerung und anschließende Wiederherstellung bestanden. Keine externen HTTP-Anfragen oder gemeldeten Seiten-/Map-Fehler.
2. **Initiale Interaktivität und Klick:** auf beiden Läufen bei 1000 Objekten innerhalb 406–462 ms erster nachgewiesener Anchor-Treffer; Klickcallback 1,6–2,3 ms. Dies sind synthetische Stichproben, keine Zusage für vollständige Anwendung oder beliebige Profile.
3. **Animation: offen für reale Hardware.** Bei 1000 Objekten Zoom-P50 83,3–116,7 ms, Neigung-P50 99,9–129,5 ms; bereits 100 Objekte zeigen deutliche Frameabstände. Die Runs unterscheiden sich selbst bei geringer Last und beim Wiederaufbau erheblich. Die geringe Samplezahl begrenzt insbesondere P95-Aussagen. Softwaregrafik/Runner-Last und Rendering sind plausible Einflussfaktoren, jedoch nicht isoliert gemessen. Keine Annahme eines bestimmten Engpasses und kein unbelegtes FPS-Ziel.
4. **Z2 bleibt bestätigt:** die separate kontrollierte flache Pan-Probe auf diesem Head liefert auf beiden Runnern [0,0] Worker-Übergaben und [1,1] beim Zoom (16/14 Pan-Move-Events). Dichte Lastfixture mit randabhängiger Gruppenbildung liefert dagegen 4–6 Updates je Punkte-/Leitlinienquelle während Pan. Nicht derselbe Versuch; der dichte Versuch belegt keinen Rückfall in numerisches Rauschen. Ursache der einzelnen Updates nicht separat profiliert. Keine pauschale Unterdrückung legitimer Positionsänderungen.
5. **Speicher: beobachten.** Der Hauptthread-Heap steigt mit Objektzahl und Wiederaufbau; GC-Zustand unbekannt, nur je eine Folge. Kein Nachweis eines Lecks oder einer Speicherobergrenze. Bei Auffälligkeit wiederholte Filter-/Stil-/Modulzyklen mit vergleichbaren Zuständen und separater Speicherdiagnose.
6. **K4e-3 abgeschlossen als synthetische Baseline.** Keine vorsorgliche Produktionsoptimierung anhand unisolierter Software-Runner-Daten. K4f muss die wahrgenommene Bedienbarkeit auf tatsächlicher Windows-Hardware prüfen. Falls dort relevante Ruckler reproduzierbar bleiben: getrenntes Profiling von Layoutberechnung, GeoJSON-Worker-/Renderlast und Basis-/Gebäudelayern; erst danach gezielte Korrektur. Kein pauschales Absenken der Darstellungsqualität oder Auslassen von Objekten.

## Übergabe an K4f

- Gemeinsamer Review-Kandidat für Claude und ChatGPT: exakt benannter, vollständig grüner Head. Reviewbasis bisheriger gemessener Produktions-/Teststand `ecb83e8573cf438b874b41ce615f6912f0fde134`; dieser Bericht ändert ausschließlich Dokumentation. Bei späteren Änderungen erneut auf identischem SHA vergleichen. Claude-Zwischenreview bekannt; keine Verblindung behaupten.
- Auf Windows: frisches Quellarchiv, separates fiktives Testprofil, START_GEOSPATIAL_SOLO.bat für normale V2-Oberfläche, Vergleich mit START_GEOSPATIAL_V2.bat und bisherigem Standard nur bei Bedarf. Bestehende Starter bleiben bis K4g bestehen. Keine echten Schlüssel/Profildaten in Bericht oder Archiv.
- Zusätzlich zu K3-Funktionsabnahme besonders Fenster-/Vollbildwechsel, Suchsprung, Pan/Zoom/Neigung (Gebäude aus/an), dicht liegende Marker, Filter und Auswahl, Modul-/Reiterwechsel, Arbeitsstand und Offline-/Online-Rückfall. Reale Luftbild-/Hybrid-/Vektorstile getrennt von lokalem Stil prüfen. Terminal-/Dossier-/Exportverträge und keine verdeckten SVG-Kachelanfragen im Solo-Modus erneut prüfen.
- Optional wiederholbarer synthetischer Test ohne echte Daten in einer installierten Node-22/Playwright-Umgebung: im Ordner tests `npm install --no-save --no-package-lock playwright@1.57.0 maplibre-gl@4.7.1`, `npx playwright install chromium`, `node geospatial-k4-last.js`. Dieser Test fordert weiterhin SwiftShader an und ersetzt nicht den realen Edge-/GPU-Test über START_GEOSPATIAL_SOLO.bat.
- Dokumentieren: Windows-/Edge-Version, CPU/GPU, RAM, Auflösung/Skalierung, Stil, Zoom, Neigung, Gebäude, Anzahl fiktiver Objekte, betroffene Aktion und reproduzierbare Auffälligkeiten. Keine Pflicht zur manuellen Anlage von 1000 Objekten. Für belastbare größere Last auf echter GPU ggf. separate Testfixture ohne erzwungene Softwaregrafik vorbereiten.
- Offene Review-Befunde Z4–Z6 (RAM-Rückfall, Key-Provenienz, gespeicherte Offline-Freigabe) bleiben **Sperrkriterien vor K4g**. Vor Standardumstellung lösen und erneut prüfen. Kein Merge, keine Standardumstellung, keine Launcher-Bereinigung, kein K5 vor den vereinbarten Abnahmen.
