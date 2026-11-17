# Lagebriefing in X (Skizze, Stand nach Prüfung)

Ziel: Beim Öffnen eines Falls steht oben in X ein Block mit dem, was bereits erfasst ist, und später mit zwei manuell gepflegten Angaben. Der Block erzeugt keine Inhalte und führt keine zweite Kurzlage.

## 1. Festgelegte Richtung (Freigabe Shadow und ChatGPT)

- Block oben in X: ja.
- Offene Fragen: zunächst rein manuell, ohne Verweis auf Aussagen.
- Keine Zähler zu Aussagen (offen, widersprüchlich, ohne Fundstelle). Das Aussagenregister hat keine Oberfläche mehr, die Aussagen liegen nur als Altdaten vor; ein Zähler hätte kein Sprungziel. Eine Aussagenansicht wird für das Briefing nicht wieder eingeführt.
- Kein Verlaufsprotokoll. Ablösung von `START_3D.bat` und Verwerfen von Altdaten sind getrennte Vorhaben.

## 2. Reihenfolge (je Schritt eigener Branch und PR)

1. **Anzeige.** Vorhandene Kurzlage (Feld `frage`, nur Anzeige) und bis zu fünf zuletzt erfasste, zugängliche Unterlagen des Falls, jüngste zuerst nach `erfasst`. Jede führt zum bestehenden Eintrag in der Unterlagenliste. Unterlagen, deren Dossier gesperrt oder nicht lesbar ist, erscheinen nicht. Überschrift „Zuletzt hinzugefügt“, nicht „Letzte Änderungen“. Keine neuen Datenfelder.
2. **Nächster Schritt.** Ein manuell gepflegter Eintrag je Fall (höchstens 200 Zeichen) mit Änderungszeitpunkt: `naechsterSchritt: { text, am }`, optional. Speichern über `xSchreiben` mit Rücknahme bei Speicherfehlern.
3. **Manuelle Fragen.** Anlegen, abhaken, wieder öffnen, entfernen: `fragen: [{ text, erledigt, erfasst }]`, optional. Keine sichtbaren fortlaufenden Nummern; intern ein Schlüssel, der keine Wiedervergabe braucht, solange nichts auf eine Frage verweist.

## 3. Fallpaket

Der Export übernimmt das Fallobjekt und prüft es per Prüfsumme. Neue optionale Felder können so ohne Änderung im Paket landen. Mit Schritt 2 wird ein Test ergänzt: Export mit anschließendem Import erhält den Eintrag; ein altes Paket ohne die Felder bleibt importierbar; ein neues Paket in der alten Fassung zeigt, was passiert (Ablehnung, Ignorieren oder Erhalt). Ob die Manifestversion angehoben wird, entscheidet dieses Testergebnis, nicht eine Vorannahme.

## 4. Schwächen und Risiken

- Ein veralteter „Nächster Schritt“ wird nicht erkannt; die Anzeige des Änderungszeitpunkts ist die einzige Gegenmaßnahme.
- „Zuletzt hinzugefügt“ nach `erfasst`: Unterlagen aus Importen tragen ihren Erfassungszeitpunkt aus dem Paket, nicht den Importzeitpunkt (nicht geprüft; vor Schritt 1 im Test belegt oder streichen). Die Reihenfolge entspricht dann ggf. der Erfassung am Ursprungsort.
- Die Kurzlage ist auf 300 Zeichen begrenzt; eine Erhöhung betrifft Import-Grenzen und Tests und gehört, wenn gewünscht, in einen eigenen Schritt.
- Die Begrenzung auf fünf Einträge ist eine Anzeigeentscheidung; die vollständige Liste bleibt darunter im Panel „Unterlagen“.
