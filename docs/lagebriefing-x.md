# Lagebriefing in X (Skizze, kein Code)

Stand: Entwurf zur Prüfung. Ziel: Beim Öffnen eines Falls steht oben in einem Block, was gilt, was offen ist und was als Nächstes zu tun ist. Der Block ersetzt keine Eingaben und erzeugt keine Inhalte; er zeigt vorhandene Angaben und nimmt zwei neue, manuell gepflegte Angaben auf.

## 1. Inhalt des Blocks

1. **Kurzlage:** das bestehende Feld `frage` (Kurzlage / Leitfrage, höchstens 300 Zeichen). Keine neue Eingabe.
2. **Offene Punkte (abgeleitet, nur Anzeige):** Zahlen aus dem Bestand des Falls, wie in `docs/datenvertrag.md` Abschnitt 5 vorgesehen: offene Aussagen, Aussagen mit Widerspruch, Aussagen ohne Fundstelle. Jede Zahl führt per Klick zur betreffenden Liste im Fall. Zahl 0 wird als „keine“ angezeigt, nicht ausgeblendet.
3. **Offene Fragen (manuell):** kurze Liste je Fall, jede Frage mit Text und Erledigt-Haken. Erledigte bleiben sichtbar (durchgestrichen), bis sie entfernt werden.
4. **Nächster Schritt (manuell):** ein Freitextfeld (höchstens 200 Zeichen) mit Zeitpunkt der letzten Änderung. Genau ein Eintrag je Fall.
5. **Zuletzt hinzugefügt:** die jüngsten Unterlagen des Falls (Quelle oder Fassung, nach `erfasst`), höchstens fünf. Der Titel lautet bewusst nicht „Letzte Änderungen“, weil dort keine Änderungen verfolgt werden.

## 2. Datenmodell (Erweiterung des Falls)

- `naechsterSchritt: { text, am }` (optional)
- `fragen: [{ id, text, erledigt: bool, erfasst }]` (optional); Kennung `Q-nnn` je Fall, aus dem Bestand des Falls vergeben, nicht aus einem Zähler (siehe Wiedervergabe unten).
- Beides optional. Fälle ohne diese Felder bleiben gültig und zeigen leere Felder.

## 3. Festlegungen, die ich vorschlage

- Kein Verlaufsprotokoll. Geändert wird ersetzend; frühere Fassungen werden nicht aufbewahrt.
- Keine automatisch erzeugten Fragen oder Schritte, kein Text aus Heuristiken.
- Fallpaket: Die neuen Felder gehören in Export und Import, Manifestversion entsprechend anheben. Ein Import ohne die Felder bleibt gültig. Ein Paket mit höherer Version als bekannt wird abgelehnt, wie bisher.
- Arbeitsstand: unverändert; der Block ist reine Ansicht des geöffneten Falls.
- Speichern atomar wie bisher (`xSichern`-Weg mit Rücknahme bei Fehlschlag), damit „Änderung nicht gespeichert“ nicht zu stillem Verlust führt.

## 4. Schwächen und Risiken des Entwurfs

- **Wiedervergabe von Kennungen:** Wie bei Fall-Nummern und eigenen Dossiers würden `Q-nnn` bei Löschung der letzten Frage wiedervergeben. Für Fragen ohne Verweise von außen unkritisch; sobald etwas auf eine Frage verweist (z. B. eine Aussage), braucht es dieselbe Identitätsprüfung wie beim Arbeitsstand.
- **Doppelte Wahrheit:** „Offene Fragen“ (manuell) und „offene Aussagen“ (abgeleitet) können sich überschneiden. Der Entwurf hält sie getrennt, damit nichts stillschweigend verknüpft wird; ob eine Frage auf eine Aussage verweisen darf, ist offen.
- **Länge:** 300 Zeichen für die Kurzlage sind knapp. Eine Erhöhung betrifft Import-Grenzen und Tests und gehört, wenn gewünscht, in einen eigenen Schritt.
- **Aktualität:** Der Block zeigt nur, was eingetragen ist. Ein veralteter „Nächster Schritt“ wird nicht erkannt; die Anzeige des Änderungszeitpunkts ist die einzige Gegenmaßnahme.

## 5. Umsetzungsschritte (jeweils eigener Branch und PR)

1. Block mit Kurzlage, abgeleiteten Zahlen und „Zuletzt hinzugefügt“ (nur Anzeige, keine neuen Daten).
2. „Nächster Schritt“ mit Speichern, Rücknahme und Test.
3. „Offene Fragen“ mit Kennung, Speichern und Test.
4. Fallpaket: Export, Import, Manifestversion, Test mit altem und neuem Paket.

## 6. Entscheidung für Shadow

Ob „Offene Fragen“ rein manuell bleiben (Entwurf) oder optional auf eine Aussage verweisen dürfen. Empfehlung: zunächst manuell, Verweis später und nur mit Identitätsprüfung.
