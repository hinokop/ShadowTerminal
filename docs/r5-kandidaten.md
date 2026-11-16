# R5 – Kandidatenliste für die nächste Bereinigung

Stand: `main` 867f774. Reine Bestandsaufnahme durch Lektüre und Suche im Quelltext; nichts wurde gelöscht oder geändert. Ein roter Test ist kein Löschgrund. Entscheidend ist, ob noch unterstütztes Verhalten betroffen ist. Entfernt wird erst nach ausdrücklicher Freigabe, Produktionscode und Tests getrennt.

## Bereits erledigt (siehe `r5-bereinigung.md`)

`wk`, `ev2`, `st`, `fc`, `sk`, `kv4` und `ed` sind aus der Standardauswahl genommen und bleiben als Dateien erhalten. Dazu ist hier nichts offen, solange die Dateien nicht gelöscht werden sollen.

## Kandidaten

| Kandidat | Beleg | Risiko | Vorschlag |
| --- | --- | --- | --- |
| `haltungDossierPanel` (`index.html`) | Genau eine Fundstelle: die Definition. Kein Aufruf in den Modulen, in `szenario.js` oder in `tests/`. | gering; ein Aufruf über einen berechneten Namen wurde nicht gefunden, aber nicht ausgeschlossen (Quelltextsuche, kein Laufzeitnachweis) | entfernen, Standardauswahl vergleichen |
| `tests/main_check.js` | 4285 Zeilen, Kopie eines älteren Hauptskripts. Weder in `runall.js` noch in README oder `docs/` referenziert. | gering; dient nur als Vergleichsstand | entfernen, Stand bleibt in der Git-Historie |
| `PROFIL.seq.galerie` | `ACTIONS.DOSSIER_FOTO_HINZU` liest den Zähler nicht mehr (Nummern je Dossier aus dem Bestand). Verbleibende Stellen: Vorbelegung in `PROFIL` (zwei Stellen) und das Mitführen beim Profilimport (`['eigen','kante','galerie','ausgang']`). `tests/dossier-galerie-nummern.js` setzt ihn absichtlich auf 999, um zu zeigen, dass er ignoriert wird. | mittel; ältere Profil- und Importdateien enthalten das Feld, es darf beim Lesen nicht fehlschlagen | zuerst nur die Verwendung beim Import und die Vorbelegung entfernen, das Feld in alten Daten tolerieren, Altprofil- und Importtest ergänzen. Nicht im selben Schritt wie die Löschung toter Funktionen. |
| `rudimentAnsicht` (`index.html`) | Wird in `dossierAnsicht` bei `wissen(e) === 'bekannt'` aufgerufen. Ob dieser Zweig im Arbeitsbetrieb noch erreichbar ist, wurde nicht nachgewiesen. Der zugehörige Test `wk` ist aus der Standardauswahl genommen. | mittel; nicht nachweislich tot | nicht entfernen, bevor die Erreichbarkeit von `wissen(e)` im Recherchebetrieb gemessen ist |
| `bedrohung()` | Wird an mindestens acht Stellen in `index.html` aufgerufen (Abfragen, Kartenlogik, Sortierung, Meldungstexte). Nicht tot. | hoch | nicht anfassen; die frühere Annahme "toter Code" trifft nicht zu |
| Freigabelogik (`wissen`, `infoGesperrt`, `freigeschaltet`) | Laut `missionsabhaengigkeiten.md` Abschnitt 5 bewusst unberührt, von der Dossiermechanik genutzt (`dossierAnsicht`). | hoch | nicht anfassen |

## Reihenfolge

1. `haltungDossierPanel` und `tests/main_check.js` getrennt voneinander, je mit voller Standardauswahl.
2. `seq.galerie` mit ergänzten Alt- und Importtests.
3. `rudimentAnsicht` erst nach Messung.

## Nicht geprüft

- Laufzeitaufrufe über dynamische Namen.
- Echte Altprofile aus längerem Gebrauch.
