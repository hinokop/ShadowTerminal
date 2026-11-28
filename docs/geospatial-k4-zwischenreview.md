# Geospatial K1–K4: Zwischenreview vor Abnahme

Basis: `fd1ac91e251802d8983f493e37a1a5378406f1e9` (PR #142, Draft). Geospatial CI 46083477344 erfolgreich, vollständige CI 46083477341 zum Prüfzeitpunkt noch laufend. Abgleich mit Claude-Review [6092620931](https://github.com/hinokop/ShadowTerminal/pull/142#pullrequestreview-6092620931) auf dc4e98a. Dies ist eine eigene gezielte Code-Gegenprüfung des Implementierungsassistenten, kein zweiter unabhängiger Prüfer und kein neuer lokaler Vollbrowserlauf.

| Priorität | Befund | Status / nächste Maßnahme |
|---|---|---|
| Hoch für Umschaltung | `karteRendererDatenAktualisieren` beendet sich ohne aktiven SVG-Adapter. V2 wäre nach Entfernung der SVG-Karte von Modellaktualisierungen abgeschnitten. | K4e-1 trennt Guard und SVG-Aktualisierung; expliziter Solo-Modus, Browserregression. |
| Mittel | Doppelte Karte zeichnet SVG bei V2 moveend neu; bei aktivem Alt-Online-Modus sind parallele Kachelabrufe möglich. | K4e-1 lässt SVG im Solo-Modus gar nicht entstehen. |
| Mittel | V2 fehlte ein eigener Escape-Werkzeugabbruch; Claude L-K3-5. Messaktivierung ließ Pin-/Zonenmodus aktiv. | K4e-1: Werkzeug zuerst, Vollbild danach, gegenseitiger Ausschluss; Browserregression. |
| Mittel | Vollbild verdeckt Systemmeldungen (Claude L-K3-3). | K4e-1 spiegelt Meldung im Panel; echte Sichtbarkeit bei Scrollen und kleinem Fenster noch visuell prüfen. |
| Mittel / offen | Kartenstartfehler sind abgesichert, aber asynchroner Fehler bei Installation eigener Layer (Renderer onError) setzt nur Hinweis; tatsächliche Wiederherstellung lokaler Objekte und ehrlicher Status bei Fehler noch prüfen. | Eigener gezielter Fehlerpfadtest vor Umschaltung. |
| Mittel / offen | Gemeinsame Kamera: halbe Zoomstufe ist historischer Offset, keine nachgewiesene Maßstabsparität zwischen 960er SVG-ViewBox und frei skalierter MapLibre-Fläche. Unmount speichert aktuelle Kamera, Mount übernimmt nur Pitch/Bearing; bei unterbrochener Bewegung ist letzte geteilte Mitte ggf. veraltet. | Messung und gezielte Prüfung; explizite Navigationsziele dürfen nicht überschrieben werden. |
| Low / offen | Große Markergruppen, Rand- und Nachbargruppen-Kollisionen; 100-ms-Drosselung begrenzt Updates, garantiert aber keine Bildrate. Komplett identische Punkte benötigen ggf. mehrere Ringe. | 100/1000 synthetische Objekte, realer Windows-Test; keine hypothetischen Leistungswerte. |
| Low / offen | Browser-Anbindungstest ist sehr lang (über 1100 Zeilen); viele aufeinander aufbauende Fixtures. | Nach K4 thematisch trennen, nicht durch Timeouts kaschieren. Schnelllauf weiterhin getrennt. |
| Low / offen | V2-Filterwahl korrigiert (L-K3-4), alter Filter-Speicherpfad kann weiterhin implizit einen Dateischlüssel mitspeichern; V2-Filterpfad tut dies nicht. Wetterwahl ist Dokument-RAM, bestehende Alt-Freigabe bleibt Default. | Explizite Schlüssel- und Consent-Semantik vor Standardwechsel klären; keine ungefragte Migration. |

## Abgleich früherer Claude-Befunde

M-K3-1 Protokollzähler, M-K3-2 transitive Ketten, L-K3-2 Missionswerkzeug-Fallback und L-K3-4 Filterpersistenz wurden nach Review bearbeitet. L-K3-1 teilweise (Randkorrektur, keine Weltkopien, Zwischenaktualisierung); große Gruppen verbleiben. L-K3-6 Fixture/Fullscreen-Stub/Ketten/Zähler nachgeführt; reale Datumsgrenze im Einweltmodus und Overlay-Überlappung weiter prüfen. Die Anbindung ist in Controller (210 Zeilen vor K4e), Quellensteuerung (315) und Oberfläche (269) aufgeteilt. Die früheren tageszeitabhängigen Terminaltests wurden separat korrigiert.

## Nächste Freigabestufen

1. K4e-1 Geospatial CI und vollständige CI. Keine Änderung der Standardstartoption.
2. Fehlerzustände und messbare Leistung (100/1000 Objekte), Kamera-/Quellen-/Sperrparität.
3. Windows-Testpaket auf exakt grünem Head, Vergleich Solo vs. bisheriger Start, reale Anbieter, 2D/3D, Zoom, Vollbild, Offline und Profilbestand.
4. Claude-Gesamtreview auf exakt demselben Head gegen main und bisherige Reviews; unabhängige Prüfung zuerst ohne Kenntnis der neuen Bewertung, anschließend Befunde abgleichen. Keine Mergefreigabe ohne Nutzerentscheidung.

K5 Geometrievertrag bleibt gesondert; K6 optional. Keine Behauptung vollständiger Zeilenprüfung aller historischen Dateien oder aktueller Claude-Ausführung.
