# Karte – Beobachtungen und vorgemerkte Optimierungen

Stand: 22.11.2026. Sammeldokument, keine Umsetzung ohne eigenen Draft-PR und Freigabe durch Master Wayne.

**Produktentscheidung (Übergabe 22.11.2026):** Der Stand der Karte gilt als sehr gut. Nicht vereinfachen, keine Ebenen, Funktionen oder Interaktionen reduzieren. Pins, Profilzonen (ZO sind keine Pins), Messung, Kachelwahl, Protokolle, Dossierbezüge und 2D/3D-Parität erhalten. Vor Änderungen aktuelles Rendering und reale Windows-Bedienung prüfen.

## Konsolenbefunde aus der Windows-Abnahme von #106 (Edge)

Nach der Abnahme aller Prüfpunkte von Shadow aufgenommen; Herkunft im Code nachgeprüft. Keiner der Befunde wurde durch Phase 5b8 verursacht.

| Meldung | Herkunft | Wirkung | Vorschlag | Priorität |
|---|---|---|---|---|
| `Image "gate" could not be loaded …` und 16 weitere Symbolnamen (`atm`, `bollard`, `bicycle_parking`, `office`, `sports_centre`, `athletics`, `hackerspace`, `multi`, `ferry_terminal`, `brownfield`, `recycling`, `cycle_barrier`, `lift_gate`, `motorcycle_parking`, `running`, `yoga`) | 3D-Ansicht lädt den externen Stil „Liberty“ von OpenFreeMap (`karte3d.html:38`). Dessen POI-Ebene verlangt Symbole, die im zugehörigen Sprite fehlen. Eigene Symbole (`addImage`, `karte3d.html:76/81`) sind nicht betroffen. | Betroffene Orte erscheinen in 3D ohne Symbol; sonst keine. | Ereignis `styleimagemissing` abfangen und ein neutrales Ersatzsymbol registrieren (oder ein transparentes, um nur die Meldungen zu unterdrücken). Alternativ eine eigene Kopie des Stils. | niedrig |
| `Expected value to be of type number, but found null instead.` (3×, aus dem MapLibre-Worker `blob:…`) | Eigene Ebenen geprüft: Der einzige Zahlenausdruck aus Objekteigenschaften (`symbol-sort-key` über `prio`) erhält stets eine Zahl (`m.stufe \|\| 0`, `karte3d.html:93`). Daher vermutlich ein Ausdruck im Liberty-Stil. **Unbestätigt, Plausibilität hoch**; nicht reproduziert, weil die Testumgebung OpenFreeMap nicht erreicht. | Einzelne Kartenobjekte erhalten ggf. keinen Stilwert; sichtbar nichts aufgefallen. | Bei Bedarf über `map.on('error')` und gezieltes Abschalten von Stil-Ebenen eingrenzen. | niedrig |
| `Tracking Prevention blocked access to storage for <URL>` (8×) | Trackingschutz von Edge gegenüber Drittanbieter-Ressourcen (MapLibre von `unpkg.com`, Stil, Kacheln und Schriften von Fremdservern). | Keine Funktionsstörung festgestellt. | Keine Maßnahme nötig; entfällt teilweise, wenn MapLibre lokal mitgeliefert wird (siehe unten). | keine |

**Nicht die Karte betreffend, aber in derselben Ausgabe:**

| Meldung | Herkunft | Wirkung | Vorschlag | Priorität |
|---|---|---|---|---|
| `Failed to load resource: net::ERR_FILE_NOT_FOUND` für `bilder/l-9052.jpg` und `bilder/l-9053.jpg` (mehrfach) | Die Beispieldossiers L-0002 und L-0003 (`szenario.js:273` und `:276`) verweisen auf Bilddateien aus der früheren Nummerierung. Einen Ordner `bilder/` gab es im Repository nie. Geladen wird über `bildPfad()` in der Dossiermaske (`bildFeld`) und als Knotenbild in der Beziehungsansicht, bei jedem Neuzeichnen erneut. | Platzhalter statt Bild; wiederholte Meldungen. | Entweder die beiden Bildangaben im Szenario entfernen oder die Bilddarstellung bei Ladefehler auf den Platzhalter zurückfallen lassen (robuster, gilt auch für Nutzerbilder). Entscheidung offen. | niedrig |

## Weitere Befunde aus der Sichtung

- **MapLibre zur Laufzeit von einem CDN:** `maplibre-gl@4.7.1` (Skript und CSS) wird von `unpkg.com` geladen (`karte3d.html:4/25`), ohne Integritätsprüfung (SRI). Ohne Netz bleibt die 3D-Ansicht leer, und der Code wird bei jedem Start von einem Fremdserver bezogen. Vorschlag: die Version lokal mitliefern (Lizenz BSD-3-Clause; die CI installiert sie bereits per npm), `file://`-kompatibel, Windows-Startpfade unverändert. Stil, Kacheln und Schriften blieben online.

## Vorgemerkte Verbesserungen (Übergabe 22.11.2026)

- Höhere visuelle Auflösung (HiDPI), ggf. bessere Kachelschärfe.
- Höherer sinnvoller Zoom unter Beachtung realer Kachel- und Datenquellengrenzen.
- Präzisere Kamera- und Zoomsteuerung in 2D und 3D, geschmeidigeres Handling, Bedienbarkeit und Performance.
- **Messung:** Straßenstrecke wird pauschal als Luftlinie × 1,25 geschätzt, Fahrzeit mit durchschnittlich 70 km/h (`karte-modul.js:1281–1283`). Als Schätzung kenntlich halten oder später durch echte Routingdaten ergänzen; keine falsche Exaktheit.
- Offen in 3D laut `CLAUDE.md` (dort als veraltet eingestuft, nicht nachgeprüft): Luftbild, Verbindungen, Route, Sichtungs-Unschärfe, Zeitfenster.
