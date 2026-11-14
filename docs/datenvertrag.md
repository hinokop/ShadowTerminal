# Datenvertrag Fallkern (Entwurf 1)

Stand 13. November 2026. Gilt für das Recherchewerkzeug ohne Szenario, Handler, Mission und Timer. Der Vertrag beschreibt Daten, keinen Code. Änderungen daran werden zuerst hier vorgenommen und von zwei Seiten geprüft (Umsetzung und unabhängige Gegenprüfung).

## 1. Grundregeln

1. **Stabile IDs.** Jedes Objekt erhält bei der Anlage eine ID, die nie wiederverwendet wird, auch nicht nach Löschen, Leeren oder Import. Anzeigenummern sind davon getrennt. Der Zähler ist Teil der gespeicherten Daten und wird bei Export und Import mitgeführt.
2. **Eine Aussage ohne Fundstelle darf als Entwurf gespeichert werden.** Sie erscheint nie als belegt und erhält beim Export keine Ersatzquelle. Fehlende Angaben werden als fehlend angezeigt, nie ersetzt.
3. **Drei getrennte Zeitangaben.** Ereigniszeit (wann geschah es), Veröffentlichungszeit (wann wurde es veröffentlicht), Erfassungszeit (wann wurde es eingetragen). Jede darf fehlen. Eine ungefähre Angabe wird als Intervall gespeichert, nicht als Punkt.
4. **Unbewertet ist der Ausgangswert.** Quellengüte und Informationsglaubwürdigkeit (A–F / 1–6) werden getrennt gespeichert und je mit Begründung. Ohne Eintrag gilt „unbewertet“, nie „gesichert“.
5. **Verweise auf konkrete Fassungen.** Eine Quelle verweist auf eine Fassung (Hash, Abrufzeit). Wird ein Dokument aktualisiert, entsteht eine neue Fassung. Frühere Vermerke bleiben an ihrer Fassung.
6. **Originale bleiben unverändert.** Der Anhang einer Quelle wird bytegetreu gespeichert. Vorschauen und abgeleitete Texte sind eigene Objekte und als abgeleitet gekennzeichnet.
7. **Kein stilles Verwerfen.** Jeder Import meldet, was übernommen, als identisch erkannt, als Konflikt behandelt oder abgelehnt wurde. Ein fehlerhafter Import ändert den Zielbestand nicht.
8. **Getrennter Speicher.** Der Fallspeicher ist unabhängig vom Altprofil. Altdaten werden nur lesend und nach Vorschau übernommen, mit Kennzeichnung „Legacy, Herkunft ungeprüft“.

## 2. Objekte

| Objekt | Pflichtfelder | Weitere Felder |
| --- | --- | --- |
| Fall | id, titel, frage, zustand (offen, ruhend, abgeschlossen) | erfasst, geaendert, notiz |
| Quelle | id, fall, art (Datei, Link, Text, Eigenbeobachtung) | herkunft, url, abruf, aktuelleFassung, guete (A–F, Begruendung), kette (siehe 3) |
| Fassung | id, quelle, erfasst | hash (SHA-256), dateiname, groesse, typ, anhang (Schlüssel im Binärspeicher, `false` ohne Datei), veroeffentlicht |
| Beobachtung | id, fassung, fundstelle | zitat, ereignis (Intervall), ort (siehe 4), dossiers[] (profilweite Dossier-IDs), erfasst |
| Aussage | id, fall, text, status (entwurf, offen, abgeschlossen), einschaetzung (siehe 2a, Ausgangswert „nicht eingeschätzt“) | stuetzend[], widersprechend[], begruendung, prueft (siehe 2a) |
| Dossier | id, typ (Person, Organisation, Ort, Sache), name | aliase[], notizen. Profilweit (gehört keinem Fall); Aussagen verweisen auf Dossiers, nicht umgekehrt. |
| Ereignis | id, fall, bezug (Objekt-ID) | ereignis (Intervall), veroeffentlicht, erfasst, beschreibung |

Die Fundstelle besteht aus Typ (Seite, Absatz, Zeitmarke, Zeichenbereich, ganze Datei) und Wert. „Ganze Datei“ ist erlaubt, wird aber als schwächste Fundstelle gekennzeichnet.

### 2a. Einschätzung einer Aussage und Prüfstand

- **Status** beschreibt nur den Arbeitsstand: Entwurf, offen, abgeschlossen.
- **Einschätzung** ist fünfstufig und unabhängig von der Quellengüte: widerlegt, spricht dagegen, unentschieden, spricht dafür, gestützt. Ohne Eintrag gilt „nicht eingeschätzt“. „Strittig“ ist keine Stufe, sondern wird berechnet, wenn stützende und widersprechende Belege nebeneinander stehen.
- Die Einschätzung ist immer die des Nutzers, mit Begründung. Die Anwendung berechnet keinen Wert und schlägt keine Stufe vor.
- **Prüfstand** je Beleg: „eingetragen“ (Fundstelle gesetzt) oder „geprüft“ (Nutzer hat die Fundstelle geöffnet und bestätigt). Beide Zustände werden getrennt angezeigt.

### 2b. Fassungen ohne Mehraufwand

Beim Erfassen von Text, Link oder Eigenbeobachtung entsteht die erste Fassung automatisch und unsichtbar. Die Oberfläche zeigt Fassungen erst, wenn es mehr als eine gibt oder ein Anhang vorliegt.

### 2c. Zuordnung zu einem Fall

Quellen, Fassungen, Beobachtungen, Aussagen und Ereignisse gehören zu genau einem Fall. Es gibt keinen stillen Standardfall: Beim ersten Beleg zeigt die Oberfläche, welchem Fall er zugeordnet wird, und verlangt eine ausdrückliche Wahl oder die Anlage eines Falls. Belege am Dossier ohne laufenden Auftrag laufen über einen eigenen Schreib- und Lesepfad. Der alte Missionspfad (`DOKUMENT_EINGEREICHT`, `MS(def.id).dokumente`) bleibt unverändert, bis die Mission entfällt. In der Übergangszeit liest die Dossieransicht beide Pfade getrennt und kennzeichnet die Herkunft; neue Belege gehen ausschließlich in den neuen Pfad. Der alte Pfad wird mit der Mission entfernt, nicht vorher umgebaut (Begründung: er hängt an Bewertung, Quellenliste und Dossierstatus der Spiellogik).

## 3. Quellenketten und Abhängigkeit

Eine Quelle kann angeben, dass sie von einer anderen Quelle abgeleitet ist (`kette`: Liste von Quellen-IDs mit Begründung). Abhängige Quellen zählen bei der Anzeige von Belegen als eine Stützung, nicht als mehrere. Gleicher Dateihash ist ein starker Hinweis auf gleiche Bytes. Ähnlicher Text oder gleiche Herkunft ist nur ein Vorschlag und wird nie automatisch zusammengeführt.

## 4. Orte

Gespeichert werden getrennt: Rohtext der Ortsangabe, gewählte Geometrie (Punkt, Fläche oder keine), Genauigkeit (exakt, Gebäude, Ortsteil, Ortsmittelpunkt, Region) und die Herkunft der Zuordnung (manuell, Vorschlag bestätigt). Bei Mehrdeutigkeit wird kein Punkt gesetzt, sondern eine Auswahl mit Begründung verlangt. Ein Ortsmittelpunkt wird als solcher gekennzeichnet.

## 5. Zustand eines Falls (Mindestansicht)

Die Startansicht zeigt je Fall: Frage, letzte Änderung, Zahl offener Aussagen, Aussagen mit Widerspruch, Aussagen ohne Fundstelle, Ortszuordnungen offen. Diese Zahlen werden aus den Daten berechnet, nie gespeichert.

## 6. Fallpaket (Export und Import)

- Ein Paket ist eine einzelne Datei mit Manifest: Versionsnummer, Fall-ID, Liste aller Objekte, je Anhang Hash und Größe, Zählerstände.
- Der Import prüft zuerst das gesamte Paket (Manifest, Hashes, Verweise) und übernimmt erst danach. Bei Fehlern bleibt der Zielbestand unverändert.
- Gleiche ID mit anderem Inhalt gilt als Konflikt. Konflikte werden unter neuer ID übernommen, mit Verweis auf die Herkunft (`importVon`). Dieselbe Datei erzeugt beim zweiten Import keine weiteren Kopien.
- **Dossiers im Fallexport:** Verweist eine Aussage auf ein profilweites Dossier, bringt das Paket genau die dafür nötigen Dossierdaten (ID, Typ, Name, Aliase, die verwiesenen Notizen) mit, damit es in einem frischen Profil lesbar ist. Das gesamte Profil wird nie exportiert. Beim Import gilt die Konfliktregel von oben: gleiche ID mit anderem Inhalt wird unter neuer ID übernommen.
- Ein Altexport ohne Binärdateien markiert fehlende Anhänge ausdrücklich.
- Ein selektiver Bericht (Zitatstellen, Gegenbelege, Stichtag, offene Fragen) ist ein eigenes Produkt. Ausgeblendete Inhalte sind im Bericht nicht enthalten.

## 7. Abnahmekriterien für den ersten Stand

1. Start im leeren Profil ohne `szenario.js`, ohne simulierte Startsequenz, ohne erzeugte Fallinhalte, ohne Netzwerk.
2. Ein Fall mit zwei widersprechenden Quellen und einem Originalanhang lässt sich erfassen, schließen und exportieren.
3. Das Paket lässt sich in einem zweiten, frischen Profil bytegetreu wiederherstellen (Hash gleich).
4. Jede Aussage führt zu ihrer Fundstelle zurück. Eine Aussage ohne Fundstelle wird als Entwurf angezeigt.
5. Zwei Quellen, die denselben Bericht abschreiben, erscheinen als eine Kette.
6. Ein fehlerhaftes Paket verändert den Zielbestand nicht.
7. Der Testlauf liefert einen Exit-Code und bricht bei fehlenden Pfaden ab, statt auf Ersatzpfade auszuweichen.

## 7a. Stand der Umsetzung

Umgesetzt (Modul 8, `recherche-modul.js`): Fall, Quelle, Fassung, Beobachtung, Fundstelle, Dossierbezug, Prüfsumme, eigener Dateispeicher, Rücknahme bei Speicherfehler. Offen: Aussage mit Einschätzung und Prüfstand, Quellenketten, Ereigniszeit-Eingabe, Orte mit Genauigkeit, Fallpaket (Export, Import), Fall-Startansicht, Lösung der Missionsbindung (siehe 2c).

## 8. Offene Fragen

- Verschlüsselung: entschieden, nicht gefordert. Das Werkzeug ist ein privates Einzelnutzer-Werkzeug auf privaten Geräten und im privaten Repository. Die Zugangskulisse (Kennwort, Startsequenz) bleibt Stilmittel und wird nicht als Schutz dargestellt. Die Oberfläche zeigt „lokaler Speicher“, ohne Sicherheitsversprechen.
- Karte: bleibt wie sie ist (2D und 3D, Start über `START_3D.bat`). Der Vertrag macht dazu keine Vorgabe.
- Referenzfall: Radweg (Beschluss Juni, Pressemitteilung Juli, zwei Medien zitieren dieselbe Mitteilung).
