/* =====================================================================
   szenario.js – Szenariodaten für das Field Terminal (index.html)
   Klassisches Script, ausschließlich Daten. Definiert das globale Objekt SCENARIO.
   Sämtliche Personen, Firmen, Aktenzeichen und Referenznummern sind frei erfunden;
   Straßennamen sind verfremdet, Hausnummern frei gewählt.

   Aufbau
   - Übergreifend: laender, bedrohungsstufen, admiralty, verbindungstypen, agent, kommunikation.kanaele,
     extraktion (Freigabe, Meldungstexte), serie (Texte der Auftragsabfolge), antworten (Antworttabelle).
   - entitaeten, verbindungen: globaler Pool; das Feld "mission" steuert die Freischaltung bei Annahme.
     nachtraege an einer Entität ergänzen das Dossier, sobald die genannte Mission angenommen ist.
   - antworten: Stichwortstämme (^ = Wortanfang, Leerzeichen = Wortfolge, sonst Teilwort) und Antworten je Kanal.
   - dossierStatus: Statuswerte der Dossiers. Ziele können ein Feld "meldung" tragen (Entität und Status, die mit
     der Meldung des Ziels gesetzt werden).
   - bilder: Jede Entität und jede Identität hat ein Feld "bild" (Pfad relativ zu index.html, z. B. 'bilder/p-0001.jpg',
     oder null). Mit bilder.automatisch = true sucht das Terminal ohne Einzelangabe nach bilder/<id>.<endung>
     (Kleinbuchstaben, Identitäten als legende-<id>); fehlende Dateien vermerkt der Browser dann in seiner Konsole.
   - missionen: alles Missionsspezifische (Auftrag, Freigabekette, Identität, Standorte, Ziele, ROE, Zeitfenster,
     Risiken, Kontakte, Partnerstelle, Nachrichtenverlauf, Skript, Extraktionsoptionen, Meldewesen).
   Zeitangaben: *Min = Versatz in Minuten ab Start (Annahme + vorlaufMin), gueltigTage ab erstem Laden,
   ausloeser.sek = Verzögerung in Sekunden nach dem Auslöser (zeit: ab Annahme; checkin; ziel: Abhaken des Ziels).
   ===================================================================== */
var SCENARIO = {
  dienst: 'Shadow Terminal',
  laender: { DE: 'Deutschland', AT: 'Österreich', CH: 'Schweiz', NL: 'Niederlande', BE: 'Belgien', FR: 'Frankreich', LU: 'Luxemburg', PL: 'Polen', CZ: 'Tschechien', DK: 'Dänemark', GB: 'Vereinigtes Königreich', US: 'Vereinigte Staaten', TR: 'Türkei', AE: 'Vereinigte Arabische Emirate', LB: 'Libanon', RU: 'Russland', CN: 'China', JP: 'Japan', TH: 'Thailand', NG: 'Nigeria', MX: 'Mexiko', RS: 'Serbien', IN: 'Indien', EG: 'Ägypten', KR: 'Südkorea', SG: 'Singapur' },
  bedrohungsstufen: { 1: 'Unbedenklich', 2: 'Auffällig', 3: 'Sicherheitsrelevant', 4: 'Gefährlich', 5: 'Akut gefährlich' },
  bedrohungsHinweise: { 1: 'Keine Gefährdung für Auftrag oder Personal erkennbar.', 2: 'Beobachten; Kontakt nur mit Anlass.', 3: 'Eigene Sicherungsmaßnahmen oder Gegenaufklärung möglich; Kontakt nur nach Abstimmung.', 4: 'Aktive Gegenmaßnahmen zu erwarten; Annäherung nur mit Freigabe des Ansprechpartners.', 5: 'Unmittelbare Gefahr für Personal; Annäherung ausgeschlossen, Extraktionsbereitschaft herstellen.' },
  verbindung: 'Kanal: gesichert, Ende-zu-Ende',
  quellenarten: ['Eigene Beobachtung', 'Asset vor Ort', 'Unterstützung (Support)', 'Dokument oder Foto', 'Dritte Person vor Ort', 'Öffentliche Quelle', 'Hörensagen oder Gerücht'],
  admiralty: {
    quelle: {
      A: 'uneingeschränkt zuverlässig',
      B: 'überwiegend zuverlässig',
      C: 'bedingt zuverlässig',
      D: 'überwiegend unzuverlässig',
      E: 'unzuverlässig',
      F: 'nicht beurteilbar'
    },
    information: { 1: 'bestätigt', 2: 'wahrscheinlich richtig', 3: 'möglicherweise richtig', 4: 'zweifelhaft', 5: 'unwahrscheinlich', 6: 'nicht beurteilbar' }
  },
  verbindungstypen: ['Leitung', 'Beschäftigung', 'Unterstellung', 'Finanzierung', 'Zugehörigkeit', 'Kontakt', 'Nutzung', 'Aufenthalt', 'Transport'],
  agent: {
    codename: 'RAIZO',
    id: 'FA-4471',
    freigabe: 'Zugangsstufe 2, je Vorgang vergeben',
    statusStart: 'Aktiv',
    ausruestung: [
      { kategorie: 'Kommunikation', zustand: 'einsatzbereit', hinweis: 'Primär- und Ausweichweg geprüft' },
      { kategorie: 'Dokumente', zustand: 'eingeschränkt', hinweis: 'Gutachterausweis gültig; Ausweichidentität vollständig hinterlegt' },
      { kategorie: 'Mobilität', zustand: 'einsatzbereit', hinweis: 'Mietfahrzeug auf Hauptidentität, Bahn' },
      { kategorie: 'Unterkunft', zustand: 'einsatzbereit', hinweis: 'Unterkunft Neukölln, Ausweichunterkunft Potsdam' },
      { kategorie: 'Finanzmittel', zustand: 'einsatzbereit', hinweis: 'Budget für 14 Tage hinterlegt' },
      { kategorie: 'Medizinische Grundausstattung', zustand: 'einsatzbereit', hinweis: 'Standardsatz' }
    ],
    notizenStart: 'Meldefenster 0600Z und 1800Z, Frist 30 Minuten. Treffen mit KIEBITZ nur in den vereinbarten Zeitfenstern.',
    einschraenkungenStart: 'Keine Gewalt, kein Eingriff in den Transport. Keine Annäherung an Begleitfahrzeuge. Keine Anzeige bei Behörden.'
  },
  kommunikation: {
    kanaele: [
      {
        id: 'handler',
        name: 'Ansprechpartner',
        gegenstelle: 'ARGUS',
        verfahren: 'Ende-zu-Ende, symmetrisches Verfahren mit Sitzungsschlüsseln',
        schluesselalterStd: 9,
        integritaet: 'geprüft'
      },
      {
        id: 'support',
        name: 'Support Element',
        gegenstelle: 'DISPO',
        verfahren: 'Ende-zu-Ende, symmetrisches Verfahren mit Sitzungsschlüsseln',
        schluesselalterStd: 21,
        integritaet: 'geprüft'
      },
      {
        id: 'asset',
        name: 'Kontakt vor Ort',
        gegenstelle: 'KIEBITZ',
        verfahren: 'Ende-zu-Ende, vereinfachtes Verfahren für Fremdgeräte',
        schluesselalterStd: 46,
        integritaet: 'geprüft'
      }
    ],
    textbausteine: [
      { titel: 'Lage', text: 'Erbitte Lage.' },
      { titel: 'Hinweise', text: 'Weitere Hinweise?' },
      { titel: 'Ergebnis', text: 'Ziel  erledigt.' },
      { titel: 'Meldefenster', text: 'Nächstes Meldefenster?' }
    ]
  },
  extraktion: {
    freigabe: { erforderlich: true, kanal: 'handler', durch: 'ARGUS' },
    freigabeNachSek: 45,
    durchfuehrungNachSek: 60,
    meldungen: {
      freigabe: 'Extraktionsanforderung {O} freigegeben. Bereitschaft des Support Elements wird hergestellt. Weitere Weisung abwarten.',
      durchfuehrung: '{O} in Durchführung. Weisungen folgen ausschließlich über diesen Kanal.',
      ablehnung: 'Extraktionsanforderung {O} nicht freigegeben. Auftrag wird fortgeführt. Lage zum nächsten Meldefenster neu melden.',
      aufhebung: '{O} aufgehoben. Regelbetrieb wird wieder aufgenommen, Meldefenster gelten unverändert.',
      abschluss: '{O} abgeschlossen. Status Standby bis zur Nachbesprechung.'
    }
  },
  serie: {
    start: 'M1',
    folgeNachSek: 90,
    /* Erststart: leeres Terminal. Die Meldungen treffen nach Sekunden ein (auto = automatisierte Systemmeldung,
       sonst menschlich formuliert); der erste Auftrag wird nach einweisungFolgeSek zugewiesen. */
    einweisung: [
      { kanal: 'handler', sek: 4, auto: true, text: 'Verbindung hergestellt. Kanal Ansprechpartner aktiv, Sitzungsschlüssel ausgetauscht.' },
      { kanal: 'support', sek: 9, auto: true, text: 'Kanal Support Element aktiv. Schlüsselalter 0 h. Integrität geprüft.' },
      { kanal: 'handler', sek: 40, auto: false, text: 'Hier ARGUS. Du bist aufgeschaltet. Bitte kurz den Empfang bestätigen. Der erste Auftrag ist in Vorbereitung und kommt im Bereich Auftrag.' }
    ],
    einweisungFolgeSek: 120,
    /* Nachbereitung nach Abschluss eines Auftrags; erst danach folgt der nächste Auftrag. */
    nachbereitung: [
      { id: 'legende', titel: 'Identität zurückgeben', text: 'Aktive Identität und zugehörige Dokumente werden an das Support Element (ARCHIV) übergeben und gesperrt.', vermerk: 'Identität und Dokumente an ARCHIV übergeben, Identität gesperrt' },
      { id: 'geraet', titel: 'Endgerät und Schlüssel zurücksetzen', text: 'Sitzungsschlüssel werden verworfen, das Einsatzgerät wird auf Werkszustand zurückgesetzt.', vermerk: 'Sitzungsschlüssel verworfen, Gerät zurückgesetzt' },
      { id: 'asset', titel: 'Kontakt zum lokalen Kontakt beenden', text: 'Letzte Kontaktaufnahme gemäß Abbruchprotokoll; der Kanal wird danach geschlossen.', vermerk: 'Kontakt zum lokalen Kontakt beendet, Kanal geschlossen' },
      { id: 'standort', titel: 'Unterkunft räumen, Standort abmelden', text: 'Unterkunft und Ausweichunterkunft werden übergeben, der Standort wird abgemeldet.', vermerk: 'Unterkünfte übergeben, Standort abgemeldet' },
      { id: 'nachbesprechung', titel: 'Nachbesprechung mit dem Ansprechpartner', text: 'Mündliche Auswertung mit dem Ansprechpartner. Erst nach den übrigen Schritten möglich.', vermerk: 'Nachbesprechung mit dem Ansprechpartner durchgeführt' }
    ],
    missionszustaende: ['offen', 'zugewiesen', 'laufend', 'abgeschlossen', 'abgelehnt', 'abgebrochen'],
    arbeitsstaende: ['Planung', 'Laufend', 'Pausiert'],
    texte: {
      annahme: 'Systemmeldung: Auftrag {OP} angenommen. Identität, Standorte und Meldewesen gemäß Auftrag gesetzt.',
      ablehnung1: 'Ablehnung {OP} zur Kenntnis genommen. Aktenvermerk {AV} angelegt. Der Auftrag bleibt zugewiesen. Status bis zur Entscheidung: Standby.',
      ablehnung2: 'Zweite Ablehnung {OP}. Aktenvermerk {AV} ergänzt. Abberufung gemäß Option A wird eingeleitet. Weitere Aufträge werden nicht zugewiesen.',
      abschluss: 'Abschlussbericht {OP} eingegangen und zu den Akten genommen. Nachbereitung im Auftrag durchführen.',
      neustart: 'Du bist wieder aktiv. Ich sehe nach, was anliegt. Das dauert einen Moment.',
      nachbereitungHinweis: 'Gut gemacht. Geh die Nachbereitung in Ruhe durch, vom Gerät bis zur Identität. Danach melde ich mich wegen des nächsten Vorgangs.',
      nachbereitungEnde: 'Nachbereitung vermerkt. Die Kanalverläufe zu {OP} sind bereinigt, die Dossiers archiviert.',
      serienende: 'Phase 1 ist abgeschlossen. Phase 2 wird gesondert zugewiesen. Status Standby bis auf Weiteres.',
      abbruch: 'Abbruch {OP} zur Kenntnis genommen. Aktenvermerk {AV} angelegt. Die Übergabe an die Ersatzkraft wird eingeleitet.',
      zielmeldung: 'Ziel {Z} erledigt.',
      vollzugsmeldung: 'Auftrag gemäß Freigabe vollzogen. Ziel {Z} erledigt.'
    }
  },
  antworten: {
    prioritaet: ['extraktion', 'evakuierung', 'erledigt', 'funkstille', 'ziel', 'meldung', 'dokumente', 'lage', 'hinweise'],
    staemme: {
      extraktion: ['extrakt', 'extrahier'],
      evakuierung: ['evakuier', 'evakuir'],
      erledigt: ['erledigt'],
      funkstille: ['funkstille'],
      ziel: ['^ziel', '^z-p', '^z-s', '^z2-', '^z3-'],
      meldung: ['meldefenster', 'check-in', 'checkin', '^meldung'],
      dokumente: ['^legende', '^dokument', '^ausweis', 'akkreditierung'],
      lage: ['^lage', '^status', 'sachstand', 'bedrohung', 'sitrep', 'lagebild'],
      hinweise: ['hinweis', 'noch was', 'noch etwas', 'sonst noch', 'neuigkeit', 'was neues', 'etwas neues', 'nichts neues', 'gibt es neues', 'sonst neues', 'weiteres']
    },
    negation: ['nicht', 'kein', 'noch nicht', 'nie'],
    negationsfensterWoerter: 3,
    verzoegerungSek: [2, 4],
    quittung: ['Empfang bestätigt.', 'Empfang bestätigt. Bearbeitung folgt.'],
    extraktion: {
      handler: ['Verstanden. Anforderung bitte formal über Modul 5.', 'Verstanden. Ohne formale Anforderung über Modul 5 keine Freigabe.'],
      support: ['Bereitschaft hergestellt. Freigabe liegt beim Ansprechpartner.', 'Bereitschaft hergestellt. Wir warten auf die Freigabe des Ansprechpartners.'],
      asset: ['Wer hat das angeordnet? Ich bleibe im Betrieb.', 'Davon weiß ich nichts. Ich bleibe, wo ich bin.']
    },
    bestehendeAnforderung: ['Anforderung {O} liegt vor, Stand: {S}.', 'Zu {O} liegt bereits eine Anforderung vor. Stand: {S}.'],
    evakuierung: {
      handler: ['Lage melden. Ortsangabe nötig.', 'Lage und Ort melden, dann Entscheidung.'],
      support: ['Fahrzeug am Übergabepunkt, Wartezeit 40 Minuten.', 'Fahrzeug wird zum Übergabepunkt verlegt, Wartezeit 40 Minuten.'],
      asset: ['Ich kann hier nicht weg. Schichtbeginn in zwei Stunden.', 'Ich kann jetzt nicht weg. Meine Schicht beginnt in zwei Stunden.']
    },
    erledigt: {
      handler: ['Welches Ziel? Zielkennung nennen.', 'Bitte Zielkennung nennen.'],
      support: ['Vermerkt.', 'Zur Kenntnis genommen und vermerkt.'],
      asset: ['Verstanden. Ich melde mich nicht mehr.', 'Gut. Von mir kommt nichts mehr.']
    },
    zielkennung: { vermerkt: 'Ziel {Z} als gemeldet vermerkt.', abgehakt: 'Ziel {Z} ist bereits abgehakt.', unbekannt: 'Ziel {Z} ist diesem Auftrag nicht zugeordnet.' },
    funkstilleEnde: 'Vermerkt. Funkstille beendet. Rückzug gemäß Plan.',
    funkstille: {
      handler: ['Funkstille gilt nur auf Anordnung. Derzeit ist keine angeordnet.', 'Keine Funkstille angeordnet. Meldefenster gelten.'],
      support: ['Funkstille ordnet nur der Ansprechpartner an.', 'Dazu liegt uns keine Anordnung vor. Bitte an den Ansprechpartner.'],
      asset: ['Verstanden. Ich schreibe nur, wenn sich etwas ändert.', 'Gut. Dann höre ich erst einmal auf.']
    },
    ziel: {
      handler: ['{OFFEN} von {GESAMT} Zielen offen. Zielkennung nennen.', 'Stand {OP}: {OFFEN} von {GESAMT} Zielen offen.'],
      support: ['Ergebnisen gehen an den Ansprechpartner.', 'Dafür ist der Ansprechpartner zuständig. Wir vermerken nichts.'],
      asset: ['Damit kann ich nichts anfangen.', 'Welches Ziel? Ich mache hier nur meine Arbeit.']
    },
    zielstand: { offen: 'Ziel {Z} ist offen. Meldung nach Erledigung.', abgehakt: 'Ziel {Z} ist abgehakt.' },
    meldung: {
      handler: ['Nächstes Meldefenster {FENSTER}. Letzter Standort laut Check-in: {STANDORT}.', 'Meldefenster {FENSTER}. Check-in wie vereinbart.'],
      support: ['Meldefenster führt der Ansprechpartner. Bei uns liegt nichts an.', 'Kein Meldebedarf uns gegenüber.'],
      asset: ['Das sagt mir nichts.', 'Was für ein Fenster?']
    },
    dokumente: {
      handler: ['Fragen zur Identität an das Support Element.', 'Dokumente führt das Support Element.'],
      support: [
        'Dokumente der aktiven Identität geprüft und hinterlegt. Ablaufende Stücke sind bei ARCHIV in Arbeit.',
        'Identität steht. Ersatz für ablaufende Dokumente ist angefordert.'
      ],
      asset: ['Welche Dokumente? Ich weiß von nichts.', 'Mit Papieren habe ich nichts zu tun.']
    },
    lage: {
      handler: ['Bedrohungsstufe {STUFE} ({STUFENNAME}), letzte Bewertung {BEWERTET}. Weisung unverändert.', 'Lage unverändert seit {BEWERTET}: Stufe {STUFE} ({STUFENNAME}).'],
      support: ['Unterkunft, Ausweichunterkunft und Übergabepunkt unverändert bereit.', 'Bei uns keine Änderung. Fahrzeug steht.'],
      asset: ['Hier ist alles wie immer.', 'Nichts Besonderes. Normaler Betrieb.']
    },
    hinweise: {
      handler: ['Keine weiteren Hinweise. {OFFEN} von {GESAMT} Zielen offen.', 'Derzeit nichts. Du hörst von mir, sobald sich die Lage ändert.'],
      support: ['Von uns nichts Neues. Meldung folgt bei Änderung.', 'Keine neuen Erkenntnisse aus der Auswertung.'],
      asset: ['Im Moment nichts. Ich melde mich.', 'Nichts Neues. Wenn ich etwas höre, schreibe ich.']
    },
    keinAuftrag: ['Kein laufender Auftrag. Zuweisung abwarten.', 'Derzeit kein Auftrag. Weisung folgt.']
  },
  /* Standard-Dossier: steht immer zur Verfügung (Schlüsselfiguren in Berlin, Hamburg, NRW und Brandenburg samt Verbindungen); eigene Einträge legt der Agent im Terminal an. Bilder: bilder/<kennung>.jpg (Kleinbuchstaben). */
  standard: {
    dossiers: [
      { id: 'P-0004', typ: 'Person', land: 'DE', mission: 'STD', name: 'Dr. Mehmet Yıldırım', bild: 'bilder/p-9051.jpg', aliase: ['M. Yildirim'], reg: 'ohne',
        verteiler: 'Standard-Dossier', rolle: 'Immobilienentwickler und Treuhänder für Beteiligungsgesellschaften, Berlin. Hält Objekte für Dritte über mehrere Gesellschaften.',
        eckdaten: ['Jahrgang 1969', 'Wohnlage Charlottenburg', 'Beirat bei O-0001'], bedrohung: { stufe: 3, begruendung: 'Verschleiert wirtschaftlich Berechtigte; gut beraten und kaum angreifbar.' }, nachtraege: [] },
      { id: 'P-0005', typ: 'Person', land: 'DE', mission: 'STD', name: 'Anja Kowalczyk', bild: 'bilder/p-9052.jpg', aliase: [], reg: 'ohne',
        verteiler: 'Standard-Dossier', rolle: 'Steuerberaterin mit Mandanten im Mittelstand und Handel, Berlin.',
        eckdaten: ['Jahrgang 1977', 'Kanzlei in Berlin-Mitte', 'betreut mehrere Gesellschaften aus dem Umfeld von O-0001'], bedrohung: { stufe: 2, begruendung: 'Rechtlich unauffällig; Wert liegt in der Aktenführung ihrer Mandanten.' }, nachtraege: [] },
      { id: 'P-0006', typ: 'Person', land: 'DE', mission: 'STD', name: 'Dmitri Petrenko', bild: 'bilder/p-9053.jpg', aliase: ['Dima'], reg: 'ohne',
        verteiler: 'Standard-Dossier', rolle: 'Inhaber eines IT-Sicherheitsdienstleisters, Berlin. Betreibt Netze und Server für Kunden aus dem Handel.',
        eckdaten: ['Jahrgang 1983', 'Wohnlage Kreuzberg', 'zuvor Rechenzentrumsbetrieb'], bedrohung: { stufe: 3, begruendung: 'Technisch versiert, verschlüsselte Kommunikation, Auftragslage nicht zuordenbar.' }, nachtraege: [] },
      { id: 'P-0007', typ: 'Person', land: 'DE', mission: 'STD', name: 'Nguyen Thi Lan', bild: 'bilder/p-9054.jpg', aliase: ['Lan Nguyen'], reg: 'ohne',
        verteiler: 'Standard-Dossier', rolle: 'Großhändlerin für Textilien und Elektronik, Berlin. Beliefert Händler in Berlin und Brandenburg.',
        eckdaten: ['Jahrgang 1974', 'Wohnlage Lichtenberg', 'Lieferanten in Vietnam und Polen'], bedrohung: { stufe: 2, begruendung: 'Weitreichendes Händlernetz, überwiegend Bargeldgeschäft; Aussagebereitschaft unbekannt.' }, nachtraege: [] },
      { id: 'P-0008', typ: 'Person', land: 'DE', mission: 'STD', name: 'Henrik Brandt', bild: 'bilder/p-9055.jpg', aliase: ['H. Brandt'], reg: 'ohne',
        verteiler: 'Standard-Dossier', rolle: 'Speditionsagent und Hafenmakler, Hamburg. Vermittelt Umschlag, Lagerung und Weitertransport.',
        eckdaten: ['Jahrgang 1966', 'Wohnlage Eppendorf', 'Inhaber hinter O-0002'], bedrohung: { stufe: 3, begruendung: 'Kennt Umschlag und Papiere; geht mit Fremden vorsichtig um.' }, nachtraege: [] },
      { id: 'P-0009', typ: 'Person', land: 'DE', mission: 'STD', name: 'Samira El-Khoury', bild: 'bilder/p-9056.jpg', aliase: [], reg: 'ohne',
        verteiler: 'Standard-Dossier', rolle: 'Rechtsanwältin für Außenwirtschaftsrecht, Hamburg. Mandate im Hafen- und Handelsumfeld.',
        eckdaten: ['Jahrgang 1981', 'Wohnlage Altona', 'Kanzlei in der Innenstadt'], bedrohung: { stufe: 2, begruendung: 'Das Berufsgeheimnis schützt ihre Mandanten; Kontakte zu Zoll und Reedereien.' }, nachtraege: [] },
      { id: 'P-0010', typ: 'Person', land: 'DE', mission: 'STD', name: 'Jan-Ole Petersen', bild: 'bilder/p-9057.jpg', aliase: ['J.-O. Petersen'], reg: 'ohne',
        verteiler: 'Standard-Dossier', rolle: 'Zolldienstleister für Sammelladungen, Hamburg.',
        eckdaten: ['Jahrgang 1972', 'Wohnlage Winterhude', 'Anmeldungen für mehrere Speditionen'], bedrohung: { stufe: 3, begruendung: 'Hinweise auf beschleunigte Abfertigung gegen Gefälligkeiten.' }, nachtraege: [] },
      { id: 'P-0011', typ: 'Person', land: 'DE', mission: 'STD', name: 'Murat Aydın', bild: 'bilder/p-9058.jpg', aliase: ['M. Aydin'], reg: 'ohne',
        verteiler: 'Standard-Dossier', rolle: 'Gebrauchtwagenhändler mit Export nach Afrika und Osteuropa, Duisburg.',
        eckdaten: ['Jahrgang 1975', 'Wohnlage Marxloh', 'Verladung im Hafenumfeld'], bedrohung: { stufe: 3, begruendung: 'Barzahlungen; Fahrzeuge verlassen das Land teils ohne vollständige Papiere.' }, nachtraege: [] },
      { id: 'P-0012', typ: 'Person', land: 'DE', mission: 'STD', name: 'Katarina Schwarz', bild: 'bilder/p-9059.jpg', aliase: [], reg: 'ohne',
        verteiler: 'Standard-Dossier', rolle: 'Geschäftsführerin eines Chemiehandels für Lösungsmittel und Vorprodukte, Köln.',
        eckdaten: ['Jahrgang 1971', 'Wohnlage Ehrenfeld', 'Treuhandkunde von O-0003'], bedrohung: { stufe: 2, begruendung: 'Branchenüblich; Endverbleib der Ware nicht immer geprüft.' }, nachtraege: [] },
      { id: 'P-0013', typ: 'Person', land: 'DE', mission: 'STD', name: 'Wladimir Kremer', bild: 'bilder/p-9060.jpg', aliase: ['Wolodja', 'W. Kremer'], reg: 'ohne',
        verteiler: 'Standard-Dossier', rolle: 'Inhaber eines Sicherheitsdienstes, Dortmund. Stellt Objektschutz und Begleitpersonal.',
        eckdaten: ['Jahrgang 1967', 'Wohnlage Nordstadt', 'früher Objektschutz und Türdienste'], bedrohung: { stufe: 4, begruendung: 'Verfügt über kampferprobte Kräfte; hohe Aufmerksamkeit gegenüber Beobachtern.' }, nachtraege: [] },
      { id: 'P-0014', typ: 'Person', land: 'DE', mission: 'STD', name: 'Fatima Haidari', bild: 'bilder/p-9061.jpg', aliase: [], reg: 'ohne',
        verteiler: 'Standard-Dossier', rolle: 'Freie Journalistin, Düsseldorf. Recherchiert zu Briefkastenfirmen und Treuhandstrukturen.',
        eckdaten: ['Jahrgang 1988', 'Wohnlage Pempelfort', 'schreibt für überregionale Medien'], bedrohung: { stufe: 1, begruendung: 'Eigene Interessen; kann Hinweise weitergeben, aber auch veröffentlichen.' }, nachtraege: [] },
      { id: 'P-0015', typ: 'Person', land: 'DE', mission: 'STD', name: 'Ralf Neumann', bild: 'bilder/p-9062.jpg', aliase: [], reg: 'ohne',
        verteiler: 'Standard-Dossier', rolle: 'Betreiber eines Logistikparks in Ludwigsfelde, Brandenburg. Vermietet Hallenflächen an Dritte.',
        eckdaten: ['Jahrgang 1970', 'Wohnlage Ludwigsfelde', 'Mieter wechseln häufig'], bedrohung: { stufe: 3, begruendung: 'Vermietet an wechselnde Mieter; Kontrolle der Lagerinhalte begrenzt.' }, nachtraege: [] },
      { id: 'P-0016', typ: 'Person', land: 'DE', mission: 'STD', name: 'Ewa Zielińska', bild: 'bilder/p-9063.jpg', aliase: ['E. Zielinska'], reg: 'ohne',
        verteiler: 'Standard-Dossier', rolle: 'Leiterin einer Spedition für den Grenzverkehr nach Polen, Frankfurt (Oder).',
        eckdaten: ['Jahrgang 1979', 'Wohnlage Frankfurt (Oder)', 'Fuhrpark mit Verkehr über die Oder'], bedrohung: { stufe: 3, begruendung: 'Kennt die Grenzabläufe; viele Fahrer, wenig Aktenführung.' }, nachtraege: [] },
      { id: 'P-0017', typ: 'Person', land: 'DE', mission: 'STD', name: 'Dr. Tobias Hellwig', bild: 'bilder/p-9064.jpg', aliase: [], reg: 'ohne',
        verteiler: 'Standard-Dossier', rolle: 'Referent in einer Landesbehörde, Potsdam. Zuständig für Genehmigungen im Gewerbebereich.',
        eckdaten: ['Jahrgang 1976', 'Wohnlage Babelsberg', 'Sachbearbeitung für Gewerbeansiedlungen'], bedrohung: { stufe: 2, begruendung: 'Mutmaßlich nicht eingeweiht; Verfahrensakten machen Zusammenhänge sichtbar.' }, nachtraege: [] },
      { id: 'O-0001', typ: 'Organisation', land: 'DE', mission: 'STD', name: 'Havelstahl Handels GmbH', bild: 'bilder/o-9051.jpg', aliase: [], reg: 'ohne',
        verteiler: 'Standard-Dossier', rolle: 'Handel mit Stahl und Metallen, Berlin und Brandenburg.',
        eckdaten: ['Gegründet 2011', 'Sitz Berlin-Mitte, Friedrichstraße 131', 'rund 35 Beschäftigte'], bedrohung: { stufe: 3, begruendung: 'Warenströme mit unklarem Endverbleib.' }, nachtraege: [] },
      { id: 'O-0002', typ: 'Organisation', land: 'DE', mission: 'STD', name: 'Nordwerk Logistik GmbH', bild: 'bilder/o-9052.jpg', aliase: [], reg: 'ohne',
        verteiler: 'Standard-Dossier', rolle: 'Spedition und Umschlagbetrieb im Hamburger Hafenumfeld.',
        eckdaten: ['Gegründet 2006', 'Sitz Hamburg-Billbrook, Billbrookdeich 187', 'rund 60 Beschäftigte'], bedrohung: { stufe: 3, begruendung: 'Umschlag in Teilen nicht nachvollziehbar.' }, nachtraege: [] },
      { id: 'O-0003', typ: 'Organisation', land: 'DE', mission: 'STD', name: 'Rheinkontor Treuhand AG', bild: 'bilder/o-9053.jpg', aliase: [], reg: 'ohne',
        verteiler: 'Standard-Dossier', rolle: 'Treuhand- und Verwaltungsgesellschaft für Beteiligungen, Düsseldorf.',
        eckdaten: ['Gegründet 1999', 'Sitz Düsseldorf, Speditionstraße 22', 'rund 25 Beschäftigte'], bedrohung: { stufe: 2, begruendung: 'Übliche Branchenpraxis; Eigentümerketten schwer nachzuvollziehen.' }, nachtraege: [] },
      { id: 'O-0004', typ: 'Organisation', land: 'DE', mission: 'STD', name: 'Ruhrschild Sicherheitsdienste GmbH', bild: 'bilder/o-9054.jpg', aliase: [], reg: 'ohne',
        verteiler: 'Standard-Dossier', rolle: 'Sicherheitsdienst für Objekte, Veranstaltungen und Transporte, Dortmund.',
        eckdaten: ['Gegründet 2008', 'Sitz Dortmund-Hörde, Hörder Burgstraße 18', 'rund 120 Beschäftigte'], bedrohung: { stufe: 4, begruendung: 'Bewaffnetes Personal im Hintergrund; enge Bindung an die Inhaberfamilie.' }, nachtraege: [] },
      { id: 'O-0005', typ: 'Organisation', land: 'DE', mission: 'STD', name: 'Oderland Transit GmbH', bild: 'bilder/o-9055.jpg', aliase: [], reg: 'ohne',
        verteiler: 'Standard-Dossier', rolle: 'Speditionsunternehmen für den Grenzverkehr nach Polen, Frankfurt (Oder).',
        eckdaten: ['Gegründet 2014', 'Sitz Frankfurt (Oder)', 'rund 40 Fahrzeuge'], bedrohung: { stufe: 3, begruendung: 'Fahrer wechseln häufig; Frachtpapiere lückenhaft.' }, nachtraege: [] },
      { id: 'L-0001', typ: 'Ort', land: 'DE', mission: 'STD', name: 'Büroetage Friedrichstraße, Berlin-Mitte', bild: 'bilder/l-9051.jpg', aliase: [], reg: 'ohne',
        verteiler: 'Standard-Dossier', rolle: 'Geschäftsadresse von O-0001.',
        eckdaten: ['Friedrichstraße 131', 'Büroetage im vierten Obergeschoss', 'Zutritt über Empfang'], bedrohung: { stufe: 2, begruendung: 'Besucher werden erfasst.' }, nachtraege: [] },
      { id: 'L-0002', typ: 'Ort', land: 'DE', mission: 'STD', name: 'Kfz-Betrieb Sonnenallee, Berlin-Neukölln', bild: 'bilder/l-9052.jpg', aliase: [], reg: 'ohne',
        verteiler: 'Standard-Dossier', rolle: 'Werkstatt und Lager im Hinterhof, genutzt von Händlern aus dem Umfeld von P-0007.',
        eckdaten: ['Sonnenallee 187', 'Zufahrt durch Tordurchfahrt', 'Nutzung überwiegend abends'], bedrohung: { stufe: 2, begruendung: 'Unübersichtlich, mehrere Nutzer.' }, nachtraege: [] },
      { id: 'L-0003', typ: 'Ort', land: 'DE', mission: 'STD', name: 'Lagerhalle Billbrookdeich, Hamburg', bild: 'bilder/l-9053.jpg', aliase: [], reg: 'ohne',
        verteiler: 'Standard-Dossier', rolle: 'Umschlaglager von O-0002.',
        eckdaten: ['Billbrookdeich 187', 'Hallenkomplex mit Rampen', 'Zufahrt über Pforte, Kameraüberwachung'], bedrohung: { stufe: 3, begruendung: 'Pforte mit Besuchererfassung, Fahrzeuge werden registriert.' }, nachtraege: [] },
      { id: 'L-0004', typ: 'Ort', land: 'DE', mission: 'STD', name: 'Kontor Brooktorkai, Hamburg', bild: 'bilder/l-9054.jpg', aliase: [], reg: 'ohne',
        verteiler: 'Standard-Dossier', rolle: 'Büro im Speicherviertel, genutzt von P-0008.',
        eckdaten: ['Brooktorkai 9', 'Zugang über Treppenhaus', 'Gegensprechanlage'], bedrohung: { stufe: 2, begruendung: 'Wenig Publikumsverkehr, Anwesenheit fällt auf.' }, nachtraege: [] },
      { id: 'L-0005', typ: 'Ort', land: 'DE', mission: 'STD', name: 'Hafenspeicher Ruhrort, Duisburg', bild: 'bilder/l-9055.jpg', aliase: [], reg: 'ohne',
        verteiler: 'Standard-Dossier', rolle: 'Lager für Fahrzeuge und Container im Ruhrorter Hafen.',
        eckdaten: ['Hafenstraße 41', 'Freigelände mit Zaun', 'Verladung überwiegend nachts'], bedrohung: { stufe: 3, begruendung: 'Gelände eingezäunt; wechselnde Wachposten.' }, nachtraege: [] },
      { id: 'L-0006', typ: 'Ort', land: 'DE', mission: 'STD', name: 'Büro Speditionstraße, Düsseldorf', bild: 'bilder/l-9056.jpg', aliase: [], reg: 'ohne',
        verteiler: 'Standard-Dossier', rolle: 'Büroadresse von O-0003 im Medienhafen.',
        eckdaten: ['Speditionstraße 22', 'Büroetage mit Empfang', 'Besprechungsräume für Mandanten'], bedrohung: { stufe: 2, begruendung: 'Empfang prüft Besucher.' }, nachtraege: [] },
      { id: 'L-0007', typ: 'Ort', land: 'DE', mission: 'STD', name: 'Gewerbehof Hörde, Dortmund', bild: 'bilder/l-9057.jpg', aliase: [], reg: 'ohne',
        verteiler: 'Standard-Dossier', rolle: 'Standort von O-0004 mit Wachleuten und Fahrzeugen.',
        eckdaten: ['Hörder Burgstraße 18', 'Umzäuntes Gelände', 'Zutritt nur nach Anmeldung'], bedrohung: { stufe: 4, begruendung: 'Bewachtes Gelände mit eigener Kontrolle.' }, nachtraege: [] },
      { id: 'L-0008', typ: 'Ort', land: 'DE', mission: 'STD', name: 'Logistikpark Ludwigsfelde', bild: 'bilder/l-9058.jpg', aliase: [], reg: 'ohne',
        verteiler: 'Standard-Dossier', rolle: 'Hallenflächen von P-0015 mit wechselnden Mietern.',
        eckdaten: ['Industriestraße 9', 'Mehrere Hallen mit Mietern', 'Zufahrt über Schranke'], bedrohung: { stufe: 3, begruendung: 'Viel Fahrzeugverkehr, Zufahrt kontrolliert.' }, nachtraege: [] },
      { id: 'L-0009', typ: 'Ort', land: 'DE', mission: 'STD', name: 'Gastronomie Oderpromenade, Frankfurt (Oder)', bild: 'bilder/l-9059.jpg', aliase: [], reg: 'ohne',
        verteiler: 'Standard-Dossier', rolle: 'Wiederkehrender Treffpunkt im Umfeld von P-0016.',
        eckdaten: ['Öffentlich zugänglich', 'Nähe zur Stadtbrücke', 'Abendliche Spitzenzeiten'], bedrohung: { stufe: 1, begruendung: 'Öffentlich, keine Kontrolle.' }, nachtraege: [] }
    ],
    verbindungen: [
      { id: 'V-S1', mission: 'STD', von: 'P-0004', nach: 'O-0001', typ: 'Zugehörigkeit', richtung: 'gerichtet', bewertung: 'B2', quelle: 'Beiratsmandat' },
      { id: 'V-S2', mission: 'STD', von: 'O-0001', nach: 'L-0001', typ: 'Nutzung', richtung: 'gerichtet', bewertung: 'A1', quelle: 'Standard-Dossier' },
      { id: 'V-S3', mission: 'STD', von: 'P-0005', nach: 'O-0001', typ: 'Zugehörigkeit', richtung: 'gerichtet', bewertung: 'B2', quelle: 'Steuerberatungsmandat' },
      { id: 'V-S4', mission: 'STD', von: 'O-0001', nach: 'O-0005', typ: 'Finanzierung', richtung: 'gerichtet', bewertung: 'C3', quelle: 'Zahlungswege' },
      { id: 'V-S5', mission: 'STD', von: 'P-0008', nach: 'O-0002', typ: 'Leitung', richtung: 'gerichtet', bewertung: 'A1', quelle: 'Standard-Dossier' },
      { id: 'V-S6', mission: 'STD', von: 'O-0002', nach: 'L-0003', typ: 'Nutzung', richtung: 'gerichtet', bewertung: 'A1', quelle: 'Standard-Dossier' },
      { id: 'V-S7', mission: 'STD', von: 'P-0008', nach: 'L-0004', typ: 'Aufenthalt', richtung: 'gerichtet', bewertung: 'B2', quelle: 'Standard-Dossier' },
      { id: 'V-S8', mission: 'STD', von: 'P-0009', nach: 'O-0002', typ: 'Zugehörigkeit', richtung: 'gerichtet', bewertung: 'B3', quelle: 'Mandat' },
      { id: 'V-S9', mission: 'STD', von: 'P-0010', nach: 'P-0008', typ: 'Kontakt', richtung: 'beidseitig', bewertung: 'C3', quelle: 'Standard-Dossier' },
      { id: 'V-S10', mission: 'STD', von: 'P-0011', nach: 'L-0005', typ: 'Nutzung', richtung: 'gerichtet', bewertung: 'B2', quelle: 'Standard-Dossier' },
      { id: 'V-S11', mission: 'STD', von: 'P-0011', nach: 'P-0010', typ: 'Kontakt', richtung: 'beidseitig', bewertung: 'D4', quelle: 'unbestätigt' },
      { id: 'V-S12', mission: 'STD', von: 'P-0013', nach: 'O-0004', typ: 'Leitung', richtung: 'gerichtet', bewertung: 'A1', quelle: 'Standard-Dossier' },
      { id: 'V-S13', mission: 'STD', von: 'O-0004', nach: 'L-0007', typ: 'Nutzung', richtung: 'gerichtet', bewertung: 'A1', quelle: 'Standard-Dossier' },
      { id: 'V-S14', mission: 'STD', von: 'O-0004', nach: 'O-0002', typ: 'Kontakt', richtung: 'gerichtet', bewertung: 'C3', quelle: 'Auftragsverhältnis' },
      { id: 'V-S15', mission: 'STD', von: 'P-0012', nach: 'O-0003', typ: 'Zugehörigkeit', richtung: 'gerichtet', bewertung: 'B3', quelle: 'Treuhandmandat' },
      { id: 'V-S16', mission: 'STD', von: 'O-0003', nach: 'L-0006', typ: 'Nutzung', richtung: 'gerichtet', bewertung: 'A1', quelle: 'Standard-Dossier' },
      { id: 'V-S17', mission: 'STD', von: 'P-0014', nach: 'P-0012', typ: 'Kontakt', richtung: 'gerichtet', bewertung: 'D4', quelle: 'unbestätigt' },
      { id: 'V-S18', mission: 'STD', von: 'P-0014', nach: 'O-0003', typ: 'Kontakt', richtung: 'gerichtet', bewertung: 'C3', quelle: 'Recherche' },
      { id: 'V-S19', mission: 'STD', von: 'P-0015', nach: 'L-0008', typ: 'Leitung', richtung: 'gerichtet', bewertung: 'A1', quelle: 'Standard-Dossier' },
      { id: 'V-S20', mission: 'STD', von: 'P-0016', nach: 'O-0005', typ: 'Leitung', richtung: 'gerichtet', bewertung: 'A1', quelle: 'Standard-Dossier' },
      { id: 'V-S21', mission: 'STD', von: 'P-0016', nach: 'L-0009', typ: 'Aufenthalt', richtung: 'gerichtet', bewertung: 'D4', quelle: 'unbestätigt' },
      { id: 'V-S22', mission: 'STD', von: 'P-0015', nach: 'P-0016', typ: 'Kontakt', richtung: 'beidseitig', bewertung: 'C3', quelle: 'Standard-Dossier' },
      { id: 'V-S23', mission: 'STD', von: 'P-0017', nach: 'P-0015', typ: 'Kontakt', richtung: 'gerichtet', bewertung: 'D5', quelle: 'unbestätigt' },
      { id: 'V-S24', mission: 'STD', von: 'P-0006', nach: 'O-0001', typ: 'Nutzung', richtung: 'gerichtet', bewertung: 'C3', quelle: 'Netzbetrieb' },
      { id: 'V-S25', mission: 'STD', von: 'P-0007', nach: 'L-0002', typ: 'Aufenthalt', richtung: 'gerichtet', bewertung: 'C3', quelle: 'Standard-Dossier' },
      { id: 'V-S26', mission: 'STD', von: 'P-0007', nach: 'P-0006', typ: 'Kontakt', richtung: 'gerichtet', bewertung: 'D4', quelle: 'unbestätigt' },
      { id: 'V-S27', mission: 'STD', von: 'P-0013', nach: 'P-0011', typ: 'Kontakt', richtung: 'beidseitig', bewertung: 'C4', quelle: 'Standard-Dossier' }
    ]
  },
  entitaeten: [
    {
      id: 'P-0001', typ: 'Person', land: 'DE', mission: 'M1', name: 'Emre Kaya', bild: null, aliase: ['KIEBITZ'],
      rolle: 'Kontakt vor Ort. Kfz-Mechaniker im Kfz-Betrieb L-0002, sieht, wer abends kommt und was geladen wird.',
      eckdaten: ['Jahrgang 1990', 'wohnhaft in Neukölln', 'Schulden bei einem Händler aus dem Umfeld von P-0007', 'zuverlässig, aber erpressbar'],
      bedrohung: { stufe: 2, begruendung: 'Kein eigener Zugriff auf die Kette; seine Lage macht ihn verwundbar.' },
      reg: 'S9-Reg. 26-0201/0101', verteiler: 'Zugangskreis V-26/0201; keine Weitergabe', aktMin: -900
    },
    {
      id: 'P-0002', typ: 'Person', land: 'DE', mission: 'M1', name: 'Unbekannt (Deckname "Kutscher")', bild: null, aliase: ['Kutscher'],
      rolle: 'Fahrer des Transporters. Identität nicht bekannt, mutmaßlich im Umfeld von P-0016.',
      eckdaten: ['männlich, mittleres Alter', 'fährt abends zwischen L-0002 und L-0008', 'Kennzeichen wechselnd'],
      bedrohung: { stufe: 3, begruendung: 'Bewegt die Ladung selbst; Verhalten bei Annäherung unbekannt.' },
      reg: 'S9-Reg. 26-0201/0102', verteiler: 'Zugangskreis V-26/0201', aktMin: -600
    },
    {
      id: 'P-0003', typ: 'Person', land: 'DE', mission: 'M1', name: 'Unbekannt (Deckname "Händler")', bild: null, aliase: ['Händler'],
      rolle: 'Mutmaßlicher Auftraggeber der Kette. Tritt nicht selbst auf; Weisungen erreichen die Beteiligten über Mittelsleute.',
      eckdaten: ['Identität nicht bekannt', 'Kontakt über verschlüsselte Kanäle', 'Zahlungsweg über O-0001 vermutet'],
      bedrohung: { stufe: 4, begruendung: 'Verfügt über Mittel und Begleitschutz; Annäherung nur mit Freigabe des Ansprechpartners.' },
      reg: 'S9-Reg. 26-0201/0103', verteiler: 'Zugangskreis V-26/0201', aktMin: -600
    }
  ],
  verbindungen: [
    { id: 'V-01', mission: 'M1', von: 'P-0001', nach: 'L-0002', typ: 'Beschäftigung', richtung: 'gerichtet', bewertung: 'A1', quelle: 'Eigenangabe Kontakt, belegt' },
    { id: 'V-02', mission: 'M1', von: 'P-0001', nach: 'P-0007', typ: 'Kontakt', richtung: 'beidseitig', bewertung: 'B2', quelle: 'Kontakt KIEBITZ' },
    { id: 'V-03', mission: 'M1', von: 'P-0002', nach: 'L-0002', typ: 'Aufenthalt', richtung: 'gerichtet', bewertung: 'B2', quelle: 'Kontakt KIEBITZ' },
    { id: 'V-04', mission: 'M1', von: 'P-0002', nach: 'L-0008', typ: 'Transport', richtung: 'gerichtet', bewertung: 'C3', quelle: 'Einschätzung Ansprechpartner' },
    { id: 'V-05', mission: 'M1', von: 'P-0002', nach: 'P-0016', typ: 'Kontakt', richtung: 'beidseitig', bewertung: 'C3', quelle: 'Einschätzung Ansprechpartner' },
    { id: 'V-06', mission: 'M1', von: 'P-0003', nach: 'P-0006', typ: 'Kontakt', richtung: 'beidseitig', bewertung: 'D4', quelle: 'Support Element, unbestätigt' },
    { id: 'V-07', mission: 'M1', von: 'P-0003', nach: 'O-0001', typ: 'Finanzierung', richtung: 'gerichtet', bewertung: 'C3', quelle: 'Finanzauswertung Support Element' },
    { id: 'V-08', mission: 'M1', von: 'L-0002', nach: 'L-0008', typ: 'Transport', richtung: 'gerichtet', bewertung: 'C3', quelle: 'Einschätzung Ansprechpartner' },
    { id: 'V-09', mission: 'M1', von: 'L-0008', nach: 'O-0005', typ: 'Transport', richtung: 'gerichtet', bewertung: 'C3', quelle: 'Einschätzung Ansprechpartner' },
    { id: 'V-10', mission: 'M1', von: 'O-0005', nach: 'L-0009', typ: 'Transport', richtung: 'gerichtet', bewertung: 'D4', quelle: 'Einschätzung Ansprechpartner, unbestätigt' }
  ],
  missionen: [
    {
      id: 'M1',
      /* Schlüsselfiguren der Phase 1: zu Missionsbeginn nur als Rudiment bekannt (Rolle, Bedrohungsbewertung). Vollzugriff nach Einreichung: Sichtung, Einschätzung, Prüfung durch den Ansprechpartner. */
      schluessel: ['P-0002', 'P-0003', 'P-0007', 'P-0016'],
      nummer: 'V-26/0201',
      name: 'Transportlinie Ost',
      art: 'Observation',
      dienstbezeichnung: 'Aufklärung, Phase 1 von 3',
      einstufung: 'Zugang Stufe 2',
      schauplatz: { einsatzraum: 'Berlin, Brandenburg, Oderraum', schwerpunkt: 'Berlin-Neukölln, Ludwigsfelde, Frankfurt (Oder), Grenze zu Polen' },
      gegenstand: 'Aufklärung einer Transportkette für Güter, die die Dienststelle bewusst nicht im Einzelnen benennt. Intern ist von "Ware" und "Kisten" die Rede. Die Strecke beginnt in Berlin-Neukölln und endet an der polnischen Grenze.',
      ausgangslage: 'Eine Ladung verlässt in absehbarer Zeit Berlin-Neukölln und soll über ein Zwischenlager in Brandenburg bis zur Grenze gebracht werden. Wer die Kette trägt, wer davon weiß und wo sie verwundbar ist, liegt weitgehend im Dunkeln. Die Dienststelle will keinen Bericht, sondern einen Zugriff. Dafür braucht der Ansprechpartner Gesichter, Belege und eine Strecke, die sich lesen lässt. Der Termin steht fest und wartet nicht auf uns.',
      laufzeit: { vonMin: -1440, bisMin: 11520 },
      abstreitbarkeit: { stufe: 3, text: 'Stufe 3 von 3: Es gibt keine Anzeige und keine Beteiligung einer Behörde. Wird der Agent enttarnt, kennt ihn keine Stelle.' },
      freigabekette: [
        { stufe: 1, stelle: 'Ansprechpartner ARGUS', referenz: 'HA-26/0412', vermerk: 'Auftrag erteilt' },
        { stufe: 2, stelle: 'Teamleitung R4', referenz: 'RL-26/0119', vermerk: 'gebilligt, ohne Ablage außerhalb der Dienststelle' },
        { stufe: 3, stelle: 'Führungsstab', referenz: 'FS-26/0144', vermerk: 'Freigabe der Aufklärung im Inland, ohne Anzeige' }
      ],
      funkstille: null,
      abbruch: true,
      abbruchkriterium: 'Der Agent kann jederzeit abbrechen. Begründung ist Pflicht. Der Ansprechpartner lässt eine Ersatzkraft übernehmen; der Agent gilt für diesen Vorgang danach als abgelöst.',
      ersatz: {
        name: 'SPERBER',
        handler: 'Übergabe an SPERBER bestätigt. Für diesen Vorgang bist du raus. Alles, was du hochgeladen und gemeldet hast, bleibt hier und geht an SPERBER. Was du im Kopf hast, bleibt bei dir.',
        asset: 'Hier SPERBER. Übergabe von ARGUS ist durch. Ich übernehme Dossiers, Unterlagen und Strecke und führe ab jetzt KIEBITZ. Von mir hörst du nichts mehr.'
      },
      termin: {
        min: 10080,
        titel: 'Transporttermin',
        text: 'Der Transport läuft zum festen Termin an. Bis dahin muss Phase 1 stehen.',
        verstrichen: 'Der Termin ist verstrichen. Die Ladung ist unterwegs, mit oder ohne unsere Erkenntnisse. Offene Ziele bleiben offen; wer jetzt noch liefert, liefert zu spät. Bewertung folgt im Abschlussbericht.'
      },
      verstaerkung: { kontingent: 4, maxKraefte: 4, gesperrt: ['zugriff'], gesperrtText: 'Der Einsatz einer Einheit ist der Phase 3 vorbehalten und nicht Teil dieses Auftrags. Dazu sage ich nichts mehr.' },
      folgeNachSek: 60,
      vorlaufMin: 1440,
      anreise: {
        herkunft: 'Ausgangsort gemäß Planung',
        unterkunft: { haupt: 'S-01', ausweich: 'S-07' },
        optionen: [
          { id: 'bahn', name: 'Bahn, Fahrkarte auf Identität', dauerMin: 240, spur: 1, hinweis: 'Fahrkarte und Zahlungsmittel laufen auf den Namen der Identität.' },
          { id: 'auto', name: 'Mietwagen auf Hauptidentität', dauerMin: 270, spur: 2, hinweis: 'Kennzeichenerfassung möglich; Fahrzeug steht danach im Region zur Verfügung.' },
          { id: 'flug', name: 'Linienflug mit Übergang', dauerMin: 180, spur: 3, hinweis: 'Passagierlisten; schnell, aber mit den meisten Spuren.' },
          { id: 'bus', name: 'Fernbus', dauerMin: 420, spur: 0, hinweis: 'Kaum Spuren, lange Fahrzeit.' }
        ]
      },
      aktenvermerk: 'AV-26/0301',
      auftragsnachricht: 'Auftrag V-26/0201 Transportlinie Ost zugewiesen. Zugang Stufe 2. Es geht um eine Ladung, Details brauchst du nicht. Du lieferst Gesichter, Belege und die Strecke. Meldefenster täglich 0600Z und 1800Z, Frist 30 Minuten. Der Termin steht fest.',
      kanalGegenstelle: { asset: 'KIEBITZ' },
      /* Zustandsmodell: Dossier des Kontakts und sein Umfeld (Orte, an denen eine Verstärkung ihn gefährdet) */
      haltung: { asset: { dossier: 'P-0001', umfeld: ['P-0001', 'L-0002', 'S-01', 'S-02'] } },
      zielpersonen: ['P-0002', 'P-0003'],
      legenden: [
        {
          id: 'haupt', bezeichnung: 'Hauptidentität', land: 'DE', name: 'Daniel Rohde', bild: null, nationalitaet: 'deutsch', wohnsitz: 'Hannover',
          beruf: 'Gebrauchtwagen-Gutachter, selbständig',
          legende: 'Bewertet Fahrzeuge und Werkstattbestände für wechselnde Auftraggeber; Besuche bei Hinterhofbetrieben und Händlern sind für diesen Beruf unauffällig.',
          tiefe: 'Stufe 3 von 3 (tief): Gewerbeanmeldung, Geschäftskonto, belegbare Gutachten der letzten zwei Jahre, zwei Referenzkunden.',
          dokumente: [
            { id: 'H-01', dokument: 'Personalausweis', land: 'DE', nummer: 'PA-DE-XXXX-4417', gueltigTage: 1800, zustand: 'gültig' },
            { id: 'H-02', dokument: 'Führerschein (Scheckkarte)', land: 'DE', nummer: 'FS-DE-XXXX-2203', gueltigTage: 3200, zustand: 'gültig' },
            { id: 'H-03', dokument: 'Sachverständigenausweis (Berufsverband)', land: 'DE', nummer: 'SV-DE-XXXX-0951', gueltigTage: 500, zustand: 'gültig' },
            { id: 'H-04', dokument: 'Gewerbeschein', land: 'DE', nummer: 'GW-DE-XXXX-7188', gueltigTage: null, zustand: 'gültig' },
            { id: 'H-05', dokument: 'Zahlungskarte (Geschäftskonto)', land: 'DE', nummer: 'ZK-DE-XXXX-6045', gueltigTage: 640, zustand: 'gültig' }
          ]
        },
        {
          id: 'ausweich', bezeichnung: 'Ausweichidentität', land: 'DE', name: 'Sven Albrecht', bild: null, nationalitaet: 'deutsch', wohnsitz: 'Cottbus',
          beruf: 'Fahrer im Subunternehmen für Stückgut, angestellt',
          legende: 'Fährt Touren für wechselnde Frachtführer; Aufenthalte an Rampen und in Speditionen sind für diese Rolle unauffällig.',
          tiefe: 'Stufe 1 von 3 (flach): Dokumente und Meldeadresse, Arbeitgeber nur telefonisch hinterlegt; ausgelegt für Aufenthalte bis 72 h.',
          dokumente: [
            { id: 'A-01', dokument: 'Personalausweis', land: 'DE', nummer: 'PA-DE-XXXX-8820', gueltigTage: 1300, zustand: 'gültig' },
            { id: 'A-02', dokument: 'Führerschein (Klasse C/CE)', land: 'DE', nummer: 'FS-DE-XXXX-5576', gueltigTage: 2600, zustand: 'gültig' },
            { id: 'A-03', dokument: 'Fahrerqualifizierungsnachweis', land: 'DE', nummer: 'FQ-DE-XXXX-3012', gueltigTage: 900, zustand: 'gültig' },
            { id: 'A-04', dokument: 'Zahlungskarte (Privatkonto)', land: 'DE', nummer: 'ZK-DE-XXXX-1190', gueltigTage: 420, zustand: 'gültig' }
          ]
        },
        {
          id: 'grenz', bezeichnung: 'Grenzidentität', land: 'PL', name: 'Piotr Wasilewski', bild: null, nationalitaet: 'polnisch', wohnsitz: 'Słubice',
          beruf: 'Disponent in einer Spedition für Grenzverkehr, angestellt',
          legende: 'Plant Touren zwischen Frankfurt (Oder), Słubice und Berlin; Pendelverkehr über die Grenze, Aufenthalte in Speditionen und Gaststätten an der Oder sind für diese Rolle unauffällig.',
          tiefe: 'Stufe 2 von 3 (mittel): Meldeadresse, Arbeitsvertrag mit Rückfragekontakt in der Spedition, Pendlerhistorie von etwa sechs Monaten; belastbar für Aufenthalte bis etwa zwei Wochen.',
          dokumente: [
            { id: 'G-01', dokument: 'Personalausweis (Dowód osobisty)', land: 'PL', nummer: 'PL-XXXX-3391', gueltigTage: 1500, zustand: 'gültig' },
            { id: 'G-02', dokument: 'Führerschein (Prawo jazdy)', land: 'PL', nummer: 'PJ-PL-XXXX-7724', gueltigTage: 2100, zustand: 'gültig' },
            { id: 'G-03', dokument: 'Beschäftigungsnachweis der Spedition', land: 'PL', nummer: 'BN-PL-XXXX-0418', gueltigTage: 240, zustand: 'gültig' },
            { id: 'G-04', dokument: 'Zahlungskarte (Girokonto, Słubice)', land: 'PL', nummer: 'ZK-PL-XXXX-5502', gueltigTage: 700, zustand: 'gültig' }
          ]
        }
      ],
      legendeStart: 'haupt',
      standorte: [
        { id: 'S-01', name: 'Unterkunft Neukölln, Umfeld Reuterkiez', land: 'DE' },
        { id: 'S-02', name: 'Sonnenallee, Umfeld Kfz-Betrieb (L-0002)', land: 'DE' },
        { id: 'S-03', name: 'Ludwigsfelde, Umfeld Logistikpark (L-0008)', land: 'DE' },
        { id: 'S-04', name: 'Rastplatz am südlichen Berliner Ring', land: 'DE' },
        { id: 'S-05', name: 'Frankfurt (Oder), Umfeld Oderpromenade (L-0009)', land: 'DE' },
        { id: 'S-06', name: 'Grenzübergang Frankfurt (Oder), Umfeld Stadtbrücke', land: 'DE' },
        { id: 'S-07', name: 'Ausweichunterkunft Potsdam', land: 'DE' }
      ],
      checkinStart: { standortId: 'S-01', nachFensterMin: 4 },
      ziele: [
        { id: 'Z-P1', art: 'primär', text: 'Mindestens vier Personen der Transportkette mit Lichtbild im Dossier führen.', zaehler: { art: 'fotos', soll: 4, einheit: 'Personen mit Lichtbild' } },
        { id: 'Z-P2', art: 'primär', text: 'Mindestens zwei Belegdokumente einreichen und je einem Dossier zuordnen.', zaehler: { art: 'dokumente', soll: 2, einheit: 'Dokumente' } },
        { id: 'Z-P3', art: 'primär', text: 'Transportroute analysieren: mindestens drei Zugriffspunkte setzen und zur Bewertung einreichen.', zaehler: { art: 'zugriff', soll: 3, einheit: 'bewertete Zugriffspunkte' } },
        { id: 'Z-S1', art: 'sekundär', text: 'Den Wissensstand von mindestens drei Personen klären; der Ansprechpartner muss die Einschätzung bestätigen.', zaehler: { art: 'wissen', soll: 3, einheit: 'bestätigte Einschätzungen' } },
        { id: 'Z-S2', art: 'sekundär', text: 'Eine Begegnung mit einer Person der Kette im Bericht melden.', zaehler: { art: 'treffen', soll: 1, einheit: 'gemeldete Begegnungen' } },
        { id: 'Z-S3', art: 'sekundär', text: 'Für eine bislang unbekannte Person ein eigenes Dossier anlegen.', zaehler: { art: 'eigene', soll: 1, einheit: 'eigene Dossiers' } }
      ],
      roe: [
        'Keine Gewalt, kein Eingriff in den Transport. Phase 1 ist Aufklärung.',
        'Der Begriff der Ware wird nicht in Klartext gemeldet; es gilt die Codewortliste (Akte D-M1-03).',
        'Kontakt zu KIEBITZ nur über den vereinbarten Kanal. KIEBITZ ist ein Werkzeug. Fällt er auf, kennen wir ihn nicht.',
        'Begegnungen mit Personen der Kette sind vorher mit dem Ansprechpartner abzustimmen und anschließend zu melden.',
        'Keine Offenlegung der Zugehörigkeit zur Dienststelle; es gibt keine Anzeige bei Behörden.',
        'Meldefenster 0600Z und 1800Z, Frist jeweils 30 Minuten. Erstes Versäumnis: Nachmeldung auf Anforderung. Nach zwei Versäumnissen in Folge leitet die Gegenstelle Option E ein.',
        'Ab Bedrohungsstufe 4 Abstimmung mit dem Ansprechpartner vor jeder weiteren Maßnahme. Stufe 4 und 5 gelten für P-0013 und sein Umfeld.',
        'Dienstliche Unterlagen werden nicht in Papierform geführt.'
      ],
      zeitfenster: [
        { id: 'W-01', titel: 'Verladung in L-0002 (angekündigt, abends); Transporttermin', vonMin: 9900, bisMin: 10080 },
        { id: 'W-02', titel: 'Treffen mit KIEBITZ (P-0001) in der Werkstatt', vonMin: 600, bisMin: 660 },
        { id: 'W-03', titel: 'Zwischenlagerung in L-0008 (Dauer unbekannt, vermutet)', vonMin: 10080, bisMin: 10500 },
        { id: 'W-04', titel: 'Übergabe in der Nähe von L-0009 vor der Grenze (vermutet)', vonMin: 10500, bisMin: 11100 }
      ],
      risiken: [
        { id: 'R-01', risiko: 'P-0013 und sein Sicherheitsdienst erkennen die Beobachtung', wahrscheinlichkeit: 'mittel', auswirkung: 'hoch',
          gegenmassnahme: 'Keine Annäherung an Begleitfahrzeuge; Anmarschwege wechseln; Ausweichidentität bereithalten.' },
        { id: 'R-02', risiko: 'KIEBITZ wird in der Werkstatt enttarnt', wahrscheinlichkeit: 'mittel', auswirkung: 'sehr hoch',
          gegenmassnahme: 'Kontakt auf vereinbarte Fenster begrenzen; keine Nachfragen im Betrieb.' },
        { id: 'R-03', risiko: 'Termin wird kurzfristig vorverlegt', wahrscheinlichkeit: 'niedrig', auswirkung: 'hoch',
          gegenmassnahme: 'Phase 1 früh abschließen; Ansprechpartner meldet Terminänderungen, ohne dafür zu garantieren.' },
        { id: 'R-04', risiko: 'Strecke wird nicht wie vermutet gefahren', wahrscheinlichkeit: 'mittel', auswirkung: 'mittel',
          gegenmassnahme: 'Alternativrouten in die Analyse aufnehmen; Zugriffspunkte nicht nur an einer Straße setzen.' },
        { id: 'R-05', risiko: 'Fehlbewertung einer unwissentlich beteiligten Person', wahrscheinlichkeit: 'mittel', auswirkung: 'mittel',
          gegenmassnahme: 'Wissensstand mit Belegen unterlegen; der Ansprechpartner gleicht mit der Quellenlage ab.' }
      ],
      assets: [
        { name: 'ARGUS', rolle: 'Ansprechpartner (Führung, Freigaben, Bewertung)', kontaktweg: 'Kanal Ansprechpartner' },
        { name: 'DISPO', rolle: 'Support Element (Auswertung, Dokumente, Logistik)', kontaktweg: 'Kanal Support Element' },
        { name: 'KIEBITZ', rolle: 'Kontakt vor Ort (P-0001), Mechaniker und Zuträger in L-0002', kontaktweg: 'Kanal Kontakt vor Ort, Treffen gemäß W-02' },
        { name: 'SPERBER', rolle: 'Ersatzkraft; übernimmt, wenn der Agent abbricht', kontaktweg: 'ausschließlich über ARGUS' },
        { name: 'ARCHIV', rolle: 'Dokumentenstelle (Ausweispapiere)', kontaktweg: 'ausschließlich über DISPO' }
      ],
      partnerstelle: {
        kurz: 'keine Abstimmung',
        angezeigt: false,
        status: 'Keine Anzeige, keine Beteiligung einer Behörde; die Tätigkeit ist abstreitbar',
        standMin: -1400,
        ansprechstelle: 'keine; im Inland arbeitet die Dienststelle ohne Partnerstelle',
        beschraenkungen: [
          'Kein Auftreten als Amtsträger, kein Hinweis auf eine Behörde.',
          'Erkenntnisse werden nicht an Polizei, Zoll oder Staatsanwaltschaft weitergegeben.',
          'Angaben zu KIEBITZ (P-0001) sind von jeder Weitergabe ausgenommen.',
          'Der Ansprechpartner entscheidet, ob und wann eine Einheit eingesetzt wird.'
        ]
      },
      verlauf: {
        handler: [
          { min: -1440, von: 'gegenstelle', text: 'V-26/0201 Transportlinie Ost ist für dich. Zugang Stufe 2. Es geht um eine Ladung, mehr musst du nicht wissen. Gesucht sind Gesichter, Belege und die Strecke. Der Termin steht.', auftrag: true },
          { min: -1300, von: 'agent', text: 'Auftrag verstanden. Anreise wird geplant.' },
          { min: -1200, von: 'gegenstelle', text: 'Wichtiger als die Ladung ist, wer sie bewegt. Fotos, Papiere und deine Einschätzung zur Strecke reichen erstmal.' }
        ],
        support: [
          { min: -1100, von: 'gegenstelle', text: 'Standard-Dossier ist um die Transportkette ergänzt. Mehrere Personen ohne Lichtbild. Fotos bitte im Dossier hinterlegen.' },
          { min: -200, von: 'gegenstelle', text: 'Ausweichunterkunft Potsdam bereit. Fahrzeug steht ab 0500Z am Übergabepunkt. Dokumente der Ausweichidentität vollständig hinterlegt.' }
        ],
        asset: [
          { min: -900, von: 'gegenstelle', text: 'Abends ist die Werkstatt voll. Es kommen Leute, die ich nicht kenne. Ich halte mich raus.' },
          { min: -880, von: 'agent', text: 'Verstanden. Wir sprechen uns vor Ort.' }
        ]
      },
      skript: [
        { kanal: 'asset', lagerelevant: true, text: 'Heute Abend standen zwei Transporter im Hof. Beim zweiten war die Plane neu. Die Kisten sind schwerer als normale Ersatzteile.', ausloeser: { typ: 'zeit', sek: 90 } },
        { kanal: 'handler', lagerelevant: false, text: 'Der Termin bleibt. Wenn du noch etwas brauchst, bitte jetzt melden und nicht erst am Vortag.', ausloeser: { typ: 'zeit', sek: 180 } },
        { kanal: 'support', lagerelevant: false, text: 'Hinweis: Dokumente und Chatverläufe können im Dossier eingereicht werden. DISPO wertet aus, sobald der Ansprechpartner den Eingang bestätigt hat.', ausloeser: { typ: 'zeit', sek: 240 } },
        { kanal: 'asset', lagerelevant: true, text: 'Der Chef der Werkstatt hat heute jemanden aus Ludwigsfelde angerufen, ich habe nur den Namen {P-0015|nach} verstanden.', nennt: ['P-0015'], ausloeser: { typ: 'zeit', sek: 420 } },
        { kanal: 'handler', lagerelevant: true, text: '{P-0015|nach} passt zum Zwischenlager. Bitte prüfen, wer sonst dort ein- und ausgeht.', nennt: ['P-0015'], ausloeser: { typ: 'checkin', sek: 15 } },
        { kanal: 'support', lagerelevant: false, text: 'Der Logistikpark in Ludwigsfelde wechselt auffällig oft den Mieter. Ob das hier Zufall ist, kann ich nicht belegen.', ausloeser: { typ: 'zeit', sek: 600 } },
        { kanal: 'asset', lagerelevant: true, text: 'Ein Mann mit Sicherheitsjacke war heute da. Er hat nichts gesagt, nur den Hof gesehen und fotografiert.', ausloeser: { typ: 'ziel', ziel: 'Z-P1', sek: 25 } },
        { kanal: 'handler', lagerelevant: true, text: 'Die Strecke zählt mehr als einzelne Namen. Wenn wir sie lesen können, müssen wir nicht jeder Person hinterher.', ausloeser: { typ: 'ziel', ziel: 'Z-P3', sek: 20 } }
      ],
      extraktion: {
        stufeStart: 2,
        begruendungStart: 'Ausgangsbewertung des Ansprechpartners: Begleitschutz durch P-0013 vermutet, kein Hinweis auf Erfassung der Hauptidentität.',
        optionen: [
          { id: 'A', titel: 'Geplanter Abzug', vorlauf: '24 bis 72 h', text: 'Geordnete Beendigung unter aktiver Identität, Abreise über reguläre Verkehrswege.' },
          { id: 'B', titel: 'Beschleunigter Abzug', vorlauf: 'unter 12 h', text: 'Verkürzte Beendigung, Abholung durch das Support Element am Übergabepunkt Potsdam.' },
          { id: 'C', titel: 'Sofortige Rückholung', vorlauf: 'unverzüglich', text: 'Unmittelbare Herauslösung durch das Support Element; Identität und Unterkunft werden aufgegeben.' },
          { id: 'D', titel: 'Verlagerung innerhalb des Regions', vorlauf: '2 bis 6 h', text: 'Wechsel in die Ausweichunterkunft Potsdam, Auftrag wird fortgeführt.' },
          { id: 'E', titel: 'Kontaktpause mit definiertem Wiederaufnahmefenster', vorlauf: 'sofort wirksam', text: 'Einstellung aller Kontakte; Wiederaufnahme im nächsten vereinbarten Meldefenster.' }
        ]
      },
      meldewesen: {
        fensterStundenUtc: [6, 18],
        fristMin: 30,
        roeNr: 6,
        eskalationOption: 'E',
        kennwortverfahren: 'Kennwortverfahren aktiv',
        kennwortHinweis: 'Das Kennwort wird im Terminal weder geführt noch angezeigt.',
        eskalation: {
          1: 'Erstes Versäumnis: Gegenstelle fordert Nachmeldung an; Status "Erhöhtes Risiko", sofern zuvor "Aktiv".',
          2: 'Zweites Versäumnis in Folge: Gegenstelle leitet Option E (Kontaktpause) ein.'
        }
      },
      /* Verdeckte Lage: wird dem Agenten nie angezeigt. Der Ansprechpartner gleicht Einschätzungen des Agenten damit ab. */
      wahrheit: {
        'P-0004': 'wissentlich', 'P-0005': 'unbeteiligt', 'P-0006': 'wissentlich', 'P-0007': 'unwissentlich', 'P-0011': 'unwissentlich',
        'P-0013': 'wissentlich', 'P-0015': 'wissentlich', 'P-0016': 'wissentlich', 'P-0017': 'unwissentlich'
      },
      /* Route der Analyse: Stationen der Strecke in Reihenfolge (Ortsdossiers) */
      strecke: ['L-0002', 'L-0008', 'O-0005', 'L-0009'],
      route: {
        titel: 'Vermutete Transportroute',
        hinweis: 'Rekonstruiert aus Aussagen und Standorten. Reihenfolge der Stationen: belegt durch den Kontakt. Fahrweg und Zeiten: errechnet, nicht beobachtet.',
        abschnitte: [{"id":"A1","von":"L-0002","nach":"L-0008","bewertung":"C3","titel":"Neukölln – Ludwigsfelde","text":"Übergabe der Ware im Kfz-Betrieb, danach Umschlag im Logistikpark. Die Reihenfolge der Stationen ist durch KIEBITZ belegt, der gefahrene Weg ist errechnet und nicht beobachtet.","km":32.1,"min":35,"haupt":[[52.4755,13.4528],[52.4768,13.4502],[52.4716,13.4605],[52.4643,13.4551],[52.4607,13.4171],[52.4635,13.4031],[52.4597,13.4109],[52.4517,13.4152],[52.4525,13.4078],[52.4402,13.3952],[52.4393,13.3816],[52.4258,13.3741],[52.406,13.3569],[52.385,13.3344],[52.3801,13.3144],[52.3697,13.2989],[52.3547,13.2923],[52.343,13.283],[52.3084,13.288],[52.2891,13.2809],[52.2964,13.2661],[52.3017,13.2609]],"alternative":{"km":44.5,"min":37,"pts":[[52.4755,13.4528],[52.4768,13.4502],[52.4716,13.4605],[52.4633,13.4534],[52.4506,13.4639],[52.4298,13.5061],[52.4253,13.5212],[52.4119,13.5236],[52.3974,13.5187],[52.3793,13.5418],[52.3722,13.5472],[52.3598,13.5482],[52.3454,13.5551],[52.3207,13.5536],[52.3189,13.5488],[52.3192,13.507],[52.3068,13.4454],[52.306,13.4288],[52.3079,13.35],[52.3057,13.3234],[52.3078,13.2921],[52.3115,13.2881],[52.3196,13.2889],[52.3197,13.2858],[52.304,13.2784],[52.3058,13.2686],[52.3017,13.2609]]}},{"id":"A2","von":"L-0008","nach":"L-0009","bewertung":"D4","titel":"Ludwigsfelde – Frankfurt (Oder)","text":"Fernstück nach Osten. Fahrweg vermutet; die Alternative über den östlichen Berliner Ring wäre bei Sperrung oder Kontrolle plausibel und ist länger.","km":95.4,"min":65,"haupt":[[52.3017,13.2609],[52.2941,13.2708],[52.2965,13.2766],[52.2959,13.284],[52.3054,13.2882],[52.3073,13.2932],[52.3055,13.3254],[52.3078,13.3503],[52.3061,13.441],[52.3193,13.5094],[52.3197,13.583],[52.3114,13.6078],[52.3108,13.6481],[52.3246,13.7153],[52.3228,13.7647],[52.3103,13.8239],[52.313,13.872],[52.3164,13.8969],[52.313,13.9227],[52.3116,13.959],[52.3156,13.9911],[52.3299,14.0418],[52.3343,14.0641],[52.3364,14.147],[52.3439,14.1797],[52.3372,14.2111],[52.3354,14.2486],[52.328,14.2717],[52.3241,14.2936],[52.3202,14.4025],[52.3199,14.5063],[52.318,14.5205],[52.3206,14.5206],[52.3227,14.5301],[52.3259,14.5346],[52.3332,14.5347],[52.34,14.5403],[52.3463,14.5393],[52.3473,14.5535],[52.3473,14.5506],[52.3491,14.5514],[52.3481,14.5536]],"alternative":{"km":135.6,"min":121,"pts":[[52.3017,13.2609],[52.2941,13.2708],[52.2965,13.2766],[52.2959,13.284],[52.3054,13.2882],[52.3073,13.2932],[52.3055,13.3254],[52.3078,13.3503],[52.3061,13.441],[52.3193,13.5094],[52.3197,13.583],[52.3114,13.6078],[52.3108,13.6481],[52.3144,13.6714],[52.3243,13.7123],[52.325,13.7457],[52.3299,13.751],[52.3665,13.7634],[52.3878,13.7863],[52.4204,13.7854],[52.4247,13.7887],[52.4258,13.8249],[52.4356,13.837],[52.4402,13.8517],[52.4476,13.8562],[52.4522,13.8667],[52.4833,13.8483],[52.4975,13.8433],[52.507,13.8461],[52.5102,13.8759],[52.5084,13.8956],[52.5223,13.899],[52.5171,13.8987],[52.5255,13.9211],[52.525,13.9284],[52.5225,13.9303],[52.5074,13.9302],[52.5003,13.922],[52.4807,13.9112],[52.4801,13.9627],[52.4773,13.9737],[52.4942,14.0224],[52.4943,14.0438],[52.497,14.0596],[52.4998,14.1037],[52.4907,14.1246],[52.4928,14.157],[52.463,14.2052],[52.4542,14.209],[52.4517,14.2203],[52.4278,14.243],[52.4248,14.2593],[52.4084,14.2941],[52.4048,14.328],[52.4011,14.3386],[52.3863,14.3373],[52.3755,14.3426],[52.3614,14.3432],[52.3528,14.3506],[52.3407,14.3545],[52.3212,14.3516],[52.3212,14.3495],[52.3205,14.4758],[52.318,14.5205],[52.3206,14.5206],[52.3227,14.5301],[52.3259,14.5346],[52.3332,14.5347],[52.34,14.5403],[52.3463,14.5393],[52.3473,14.5535],[52.3473,14.5506],[52.3491,14.5514],[52.3481,14.5536]]}},{"id":"A3","von":"L-0009","nach":"S-06","bewertung":"E5","titel":"Frankfurt (Oder) – Grenzübergang","text":"Letzter Abschnitt vor der Grenze. Nur als Annahme geführt; ob die Ladung hier tatsächlich übergeht, ist nicht belegt.","km":1.4,"min":3,"haupt":[[52.3481,14.5536],[52.3472,14.5506],[52.3479,14.5637]],"alternative":null}]
      },
      zugriffTypen: ['Zugriff', 'Eingriff', 'Eliminierung'],
      wissensOptionen: ['wissentlich', 'unwissentlich', 'unbeteiligt', 'unklar']
    }
  ],
  dossierStatus: [
    { id: 'beobachtet', label: 'beobachtet', klasse: 's-accent' },
    { id: 'relevant', label: 'relevant', klasse: 's-warn' },
    { id: 'abgeschlossen', label: 'abgeschlossen', klasse: 's-dim' },
    { id: 'archiviert', label: 'archiviert', klasse: 's-dim' },
    { id: 'beendet', label: 'Vorgang beendet', klasse: 's-dim', kritisch: true },
    { id: 'eliminiert', label: 'Eliminiert', klasse: 's-crit', kritisch: true }
  ],
  /* Akten für den Dokumentenviewer. Absätze bestehen aus Text und Schwärzungen:
     { r: Kennung, t: geschwärzter Text, stufe: erforderliche Zugangsstufe, antrag: 'gewaehrt' | 'abgelehnt' | 'nie' (nicht beantragbar), antwort: Rückmeldung des Ansprechpartners (optional) }.
     Eine Schwärzung ist sichtbar, wenn stufe <= zugang der Akte oder die Freigabe vorliegt. zugang = Zugangsstufe des zugehörigen Vorgangs. */
  akten: [
    {
      id: 'D-STD-01', mission: 'STD', titel: 'Dienstvorschrift Feldarbeit und verdeckte Informationsgewinnung, Teil B: Durchführung im Einsatzgebiet', reg: 'S9-DV 4/2, Teil B', art: 'Dienstvorschrift', stand: 'Ausgabe 2026 (Neufassung)', zugang: 2,
      einstufung: 'NUR FÜR DEN DIENSTGEBRAUCH',
      verlauf: [{ stand: 'Ausgabe 2023', text: 'Erstfassung' }, { stand: 'Nachtrag 1/2025', text: 'Abschnitt 3 um Kanalprüfung und Zwangslage ergänzt' }, { stand: 'Ausgabe 2026', text: 'Neufassung, Abschnitte 4 und 5 überarbeitet' }],
      anlagen: [{ titel: 'Ablaufschema Meldewesen' }, { titel: 'Verfahren bei Verlust der Verbindung' }],
      verteiler: 'Alle Einsatzkräfte; Ansprechpartner; Support; Registratur',
      abschnitte: [
        { ueberschrift: 'Abschnitt 1: Allgemeines', absaetze: [
          ['101. Diese Vorschrift regelt die Durchführung verdeckter Maßnahmen im Einsatzgebiet. Sie gilt für jede Einsatzkraft ab Zuweisung eines Auftrags bis zum Abschluss der Nachbereitung.'],
          ['102. Es gilt der Grundsatz der Abschottung. Kenntnisse über Gesamtzusammenhänge, parallele Maßnahmen oder Personalien dritter Beteiligter werden nur insoweit erteilt, wie sie zur unmittelbaren Auftragserfüllung zwingend erforderlich sind. Gespräche über den Auftrag außerhalb der zugewiesenen Kanäle sind untersagt.'],
          ['103. Die Einsatzkraft handelt innerhalb des erteilten Auftrags. Eine Abweichung ist vorab beim Ansprechpartner anzuzeigen und von ihm zu billigen; im Zweifel unterbleibt die Maßnahme.']
        ] },
        { ueberschrift: 'Abschnitt 2: Tarnung und Identität', absaetze: [
          ['201. Jede Einsatzkraft führt eine genehmigte und aktenkundig gemachte Identität. Sie wird nur so tief ausgebaut, wie der Auftrag es verlangt. Dokumente und Zahlungsmittel laufen ausschließlich auf den Namen der Identität.'],
          ['202. Vor Antritt wird die gesamte mitgeführte Ausstattung auf Widerspruchsfreiheit zur Identität geprüft (Bereinigung). Das Mitführen von Unterlagen oder Gegenständen, die auf die tatsächliche Person oder die entsendende Stelle schließen lassen, ist untersagt.'],
          ['203. Ein Wechsel der Identität während eines Auftrags erfolgt nur auf Weisung des Ansprechpartners. Die Ausweichidentität ist für Aufenthalte bis zu 72 Stunden ausgelegt und wird danach als verbrannt geführt.'],
          ['204. Bei Verlust der Tarnung oder Anhaltspunkten für eine Enttarnung ist die Maßnahme unverzüglich abzubrechen und der Ansprechpartner zu unterrichten.']
        ] },
        { ueberschrift: 'Abschnitt 3: Verbindung und Meldewesen', absaetze: [
          ['301. Meldungen an den Ansprechpartner erfolgen ausschließlich über die zugewiesenen, gesicherten Kanäle und in den festgelegten Meldefenstern. Öffentliche Netze und private Geräte sind für dienstliche Belange nicht zu nutzen.'],
          ['302. Kann ein Meldefenster nicht bedient werden, zeigt die Einsatzkraft dies vorab beim Ansprechpartner an. Wird ein Fenster versäumt, benachrichtigt der Ansprechpartner nach Ablauf der Frist zunächst den Support. ',
            'Nach einer weiteren Frist von zwei Stunden ohne Lebenszeichen wird das Bergungsverfahren eingeleitet; ab diesem Zeitpunkt trägt die Einsatzkraft das Risiko allein.'],
          ['303. Der Ansprechpartner kann die Kanalprüfung anordnen. Er stellt dazu einen beiläufigen Satz; die Einsatzkraft antwortet mit dem zugeordneten Wort aus dem eigenen Notizheft. Zwei falsche Antworten schließen den Kanal; die Freigabe erfolgt über den Support.'],
          ['304. Steht die Einsatzkraft unter Zwang, nennt sie statt der Antwort das zugeordnete Zwangswort. Der Ansprechpartner bestätigt nach außen unverändert, stellt die Auftragsvergabe zurück und schweigt, bis die Lage geklärt ist. Alle Angaben ab diesem Zeitpunkt gelten als nicht verwertbar.'],
          ['305. Funkstille wird vom Ansprechpartner angeordnet oder mit einem Kontakt vereinbart. Während der Funkstille werden keine Meldungen erwartet und keine Nachrichten gesendet. Sie endet nur durch Ablauf, durch Anordnung oder mit der Vollzugsmeldung.'],
          ['306. Die Notfallkennung wird ausschließlich mündlich übermittelt und nicht schriftlich geführt. Das Abbruchwort schließt den Kanal zum Ansprechpartner und leitet den Abbruch des Auftrags ein, auch während einer Funkstille.']
        ] },
        { ueberschrift: 'Abschnitt 4: Zusammenarbeit mit Verbindungen und Kontakten', absaetze: [
          ['401. Verbindungen (Quellen) werden nur über den vereinbarten Kanal angesprochen. Sie sind Werkzeug des Auftrags; fällt eine Verbindung auf, kennt der Dienst sie nicht. Der Kontakt zu Dritten ist auf das Notwendige zu beschränken.'],
          ['402. Beobachtungen werden als Sichtung mit Ort, Zeit und Gütebewertung im Dossier erfasst. Eine bloße Meinung ist keine Sichtung. Bei Auffälligkeiten ist der Ansprechpartner sofort zu unterrichten, nicht erst im Abschlussbericht.'],
          ['403. Persönliche Begegnungen mit Personen des Auftrags sind vorab mit dem Ansprechpartner abzustimmen und anschließend zu melden. Vor jedem Treffen ist die Umgebung auf Beobachtung zu prüfen; bei Feststellung einer Observation unterbleibt der Kontakt.'],
          ['404. Dokumente, Fotos und Sachmittel werden über die Dokumentablage eingereicht und dem Dossier zugeordnet. Die Prüfung durch den Support ist formal und ersetzt keine eigene Bewertung.']
        ] },
        { ueberschrift: 'Abschnitt 5: Nachbereitung und Abschluss', absaetze: [
          ['501. Nach jedem Auftrag werden Identität, Gerät, Kontakt und Standort bereinigt. Notizen werden nicht aufbewahrt. Die Dossiers werden archiviert, die Kanalverläufe gelöscht. Jeder Schritt wird einzeln bestätigt.'],
          ['502. Binnen 24 Stunden nach Abschluss erfolgt die Abschlussbefragung. Vorkommnisse, Abweichungen vom Einsatzplan und Sicherheitsvorfälle sind lückenlos zu berichten.'],
          ['503. Die im Rahmen der Identität ausgegebenen Dokumente und Belege sind gegen Quittung zurückzugeben. Die Akte wird nach Auswertung des Abschlussberichts geschlossen.']
        ] }
      ]
    },
    {
      id: 'D-M1-01', mission: 'M1', titel: 'Auftragsakte V-26/0201 Transportlinie Ost', reg: 'S9-Reg. 26-0201/AK-01', art: 'Auftragsakte', stand: 'bei Zuweisung', zugang: 2,
      anlagen: [{ titel: 'Lagevermerk Transportstrecke', doc: 'D-M1-02' }, { titel: 'Codewortliste', doc: 'D-M1-03' }],
      abschnitte: [
        { ueberschrift: '1 Gegenstand', absaetze: [[
          'Aufklärung einer Transportkette von Berlin-Neukölln bis zur polnischen Grenze. Phase 1 ist beobachtend. Die Art der Ladung wird in dieser Akte nicht ausgeführt; sie lautet ',
          { r: 'a', t: 'Kleinwaffen und Munition in Kisten mit der Bezeichnung Ersatzteile', stufe: 3, antrag: 'gewaehrt', antwort: 'Die Ladung: Kleinwaffen und Munition, getarnt als Ersatzteile. Das ist der Grund, warum ich keine Fehler dulde.' },
          '.'
        ]] },
        { ueberschrift: '2 Veranlassung', absaetze: [[
          'Auslöser sind mehrere voneinander unabhängige Hinweise. Der Auftraggeber der Kette ist ',
          { r: 'b', t: 'nicht bekannt; die Auswertung vermutet ein Netzwerk aus dem Umfeld von O-0001', stufe: 4, antrag: 'abgelehnt', antwort: 'Das liegt über deiner Zugangsstufe. Antrag abgelehnt.' },
          '. Die Dienststelle klärt auf, ohne dass die Tätigkeit einer Behörde zugeordnet werden kann.'
        ]] },
        { ueberschrift: '3 Folgephasen', absaetze: [[
          'Die Phasen 2 und 3 werden gesondert zugewiesen. Über Art und Zeitpunkt entscheidet allein der Ansprechpartner. ',
          { r: 'c', t: 'Phase 3 sieht den Einsatz einer Einheit vor, die die Ladung stoppt und die Beteiligten festsetzt oder ausschaltet', stufe: 4, antrag: 'abgelehnt', antwort: 'Zu Phase 3 gebe ich dir nichts. Was du nicht weißt, kannst du nicht verraten.' },
          '.'
        ]] },
        { ueberschrift: '4 Hauptrisiko', absaetze: [[
          'Die Strecke wird vermutlich von einem Sicherheitsdienst begleitet. Eine Beobachtung, die auffällt, kostet die Aufklärung, möglicherweise auch KIEBITZ.'
        ]] }
      ]
    },
    {
      id: 'D-M1-02', mission: 'M1', titel: 'Lagevermerk Transportstrecke', reg: 'S9-Reg. 26-0201/LV-01', art: 'Lagevermerk', stand: 'zu Beginn des Auftrags', zugang: 2,
      abschnitte: [
        { ueberschrift: '1 Strecke', absaetze: [[
          'Vermutete Strecke: Kfz-Betrieb Neukölln (L-0002), Logistikpark Ludwigsfelde (L-0008), Oderland Transit (O-0005), Umfeld Frankfurt (Oder) (L-0009), danach Grenze. Die Reihenfolge ist belegt, die Fahrwege dazwischen sind es nicht.'
        ]] },
        { ueberschrift: '2 Offene Fragen', absaetze: [[
          'Unklar sind der genaue Termin des Starts am Abend, die Dauer der Zwischenlagerung und der Weg über den Berliner Ring. ',
          { r: 'a', t: 'Es liegt ein Hinweis vor, dass die Ladung in Ludwigsfelde auf ein anderes Fahrzeug umgeladen wird', stufe: 3, antrag: 'gewaehrt', antwort: 'Der Hinweis ist nicht belegt, aber ich rechne damit. Plane den Umschlag ein.' },
          '.'
        ]] }
      ]
    },
    {
      id: 'D-M1-03', mission: 'M1', titel: 'Codewortliste Transportlinie Ost', reg: 'S9-Reg. 26-0201/CW-01', art: 'Codewörter', stand: 'bei Zuweisung', zugang: 2,
      abschnitte: [
        { ueberschrift: '1 Gebrauch', absaetze: [[
          'In allen Nachrichten über die Kanäle werden die folgenden Begriffe verwendet; Klartext wird vermieden. Ware heißt ',
          { r: 'a', t: 'Ersatzteile', stufe: 2, antrag: 'gewaehrt' },
          ', Munition heißt ',
          { r: 'b', t: 'Schrauben', stufe: 3, antrag: 'gewaehrt', antwort: 'Schrauben heißt Munition. Verwende das Wort nie im Klartext.' },
          ', Waffen heißen ',
          { r: 'c', t: 'Werkzeug', stufe: 3, antrag: 'gewaehrt', antwort: 'Werkzeug heißt Waffen. Ja, ich weiß, wie das klingt.' },
          '. Eine Einheit heißt ',
          { r: 'd', t: 'Wartungsteam', stufe: 4, antrag: 'abgelehnt', antwort: 'Das ist nicht dein Begriff. Antrag abgelehnt.' },
          '.'
        ]] }
      ]
    }
  ],
  /* Karte: ungefähre Koordinaten [Breite, Länge] der Standorte und Orte (Adressen sind verfremdet), Zuordnung der Zeitfenster zu Orten, Ausgangsorte der Anreise */
  karte: {
    koord: {
      'S-01': [52.4905, 13.4260], 'S-02': [52.4738, 13.4515], 'S-03': [52.3010, 13.2600], 'S-04': [52.3600, 13.3330], 'S-05': [52.3445, 14.5545], 'S-06': [52.3480, 14.5640], 'S-07': [52.3990, 13.0660],
      /* Akteure des Auftrags (ungefähr) */
      'P-0001': [52.4737, 13.4513], 'P-0002': [52.3012, 13.2612],
      /* Standard-Dossier (Deutschland): Personen auf Stadtteilebene, Firmen und Orte auf Straßenebene, ungefähr */
      'P-0004': [52.5087, 13.3007], 'P-0005': [52.5214, 13.4041], 'P-0006': [52.4941, 13.4209], 'P-0007': [52.5392, 13.5074], 'P-0008': [53.5904, 9.9914], 'P-0009': [53.5427, 9.9364], 'P-0010': [53.5999, 10.0038], 'P-0011': [51.5011, 6.7718], 'P-0012': [50.9559, 6.9154], 'P-0013': [51.5291, 7.4731], 'P-0014': [51.2326, 6.7707], 'P-0015': [52.3051, 13.261], 'P-0016': [52.3377, 14.5611], 'P-0017': [52.3992, 13.1035], 'O-0001': [52.5157, 13.3907], 'O-0002': [53.5389, 10.0816], 'O-0003': [51.2162, 6.7514], 'O-0004': [51.4923, 7.5053], 'O-0005': [52.3424, 14.5536], 'L-0001': [52.5145, 13.3892], 'L-0002': [52.4755, 13.4528], 'L-0003': [53.5377, 10.0801], 'L-0004': [53.5452, 10.0014], 'L-0005': [51.4543, 6.7409], 'L-0006': [51.215, 6.7499], 'L-0007': [51.4911, 7.5038], 'L-0008': [52.3016, 13.261], 'L-0009': [52.3482, 14.554]
    },
    fensterOrt: { 'W-01': 'L-0002', 'W-02': 'S-02', 'W-03': 'L-0008', 'W-04': 'L-0009' },
    herkunft: { M1: { name: 'Hannover', koord: [52.376, 9.738] } },
    zonen: { 'S-01': { r: 350 }, 'S-02': { r: 300 }, 'S-03': { r: 450 }, 'S-04': { r: 250 }, 'S-05': { r: 350 }, 'S-06': { r: 300 }, 'S-07': { r: 350 } }
  },
  /* Anreiseplanung: Bewertungstexte des Ansprechpartners (Platzhalter {PUFFER}, {ANKUNFT}, {FAKTOR}) */
  /* Reisemodelle für Ausgangsorte: Dauer = Fixzeit + Luftlinie x Umwegfaktor / Tempo (+ 30 min je pauseKm). Flug erst ab minKm. */
  anreiseModelle: {
    bahn:      { name: 'Bahn, Fahrkarte auf Identität', spur: 1, umweg: 1.25, kmh: 100, fixMin: 60, hinweis: 'Fahrkarte und Zahlungsmittel laufen auf den Namen der Identität; Sitzplatzreservierung vermeiden.' },
    auto:      { name: 'Mietwagen auf Identität', spur: 2, umweg: 1.25, kmh: 85, fixMin: 20, pauseKm: 250, hinweis: 'Kennzeichenerfassung an Autobahnen und Grenzübergängen möglich; Fahrzeug steht danach im Region zur Verfügung.' },
    chauffeur: { name: 'Chauffeur des Teams', spur: 1, umweg: 1.25, kmh: 90, fixMin: 15, extra: { text: 'Chauffeur ist ein zusätzlicher Mitwisser', punkte: 6 }, hinweis: 'Fahrzeug und Fahrer des Teams: keine Mietspur und keine Fahrpausen des Agenten, aber ein Mitwisser mehr.' },
    flug:      { name: 'Linienflug mit Übergang', spur: 3, umweg: 1.05, kmh: 700, fixMin: 210, minKm: 350, hinweis: 'Passagierlisten und Gepäckkontrolle; schnell, aber mit den meisten Spuren. Erst ab größerer Entfernung sinnvoll.' },
    bus:       { name: 'Fernbus', spur: 0, umweg: 1.3, kmh: 70, fixMin: 30, pauseKm: 300, hinweis: 'Kaum Spuren, lange Fahrzeit.' }
  },
  /* Rückmeldungen des Ansprechpartners zu Zusatzakteuren: {E} Kennung und Name, {ROLLE} Rolle, {AUFLAGE} Auflage, {GRUND} Begründung */
  zusatzTexte: {
    aufgenommen: [
      'Notiert: {E} als {ROLLE}. Mehr Rückendeckung gibt es dafür nicht.',
      'Aufgenommen: {E}, {ROLLE}. Das läuft ab jetzt über dich.',
      'Ok, {E} gehört zum Vorgang. Fehler gehen dann auf deine Seite.'
    ],
    auflage: [
      'Mit Auflage zugelassen: {E}, {ROLLE}. {AUFLAGE}',
      '{E} bleibt drin, aber nur unter Bedingung. {AUFLAGE} Bitte daran halten.',
      'Ok, mit Einschränkung: {E}. {AUFLAGE}'
    ],
    abgelehnt: [
      'Abgelehnt: {E}. {GRUND}',
      'Nein zu {E}. {GRUND} Bitte beim Auftrag bleiben.',
      '{E} ist abgelehnt. {GRUND}'
    ]
  },
  assetRuhe: {
    nachSchweigen: ['Bin wieder erreichbar. Schreib kurz, was du brauchst.', 'Ich kann wieder. Nur das Nötigste.'],
    nachFunkruhe: ['Bin wieder erreichbar.', 'Funkstille vorbei. Ich kann wieder schreiben.', 'Ich bin wieder da.']
    ,
    /* Handler-Hinweis (zufällig, höchstens einmal je Schweigephase): der Asset meldet sich nicht, Meldungen bleiben zurückgestellt */
    zurueckgehalten: [
      'KIEBITZ ist seit einiger Zeit nicht erreichbar. Möglich, dass er Meldungen zurückhält. Prüfung oder Bewertung liegt bei dir.',
      'Von KIEBITZ kommt nichts. Es kann sein, dass er Beobachtungen vorerst für sich behält. Entscheide, ob du nachprüfst.',
      'Kein Eingang von KIEBITZ. Ob er Informationen zurückhält, wissen wir nicht. Einschätzung nach deinem Ermessen.'
    ]
  },
  anreiseTexte: {
    abfahrtStunden: [1, 3, 6, 9, 12, 18, 24, 30, 36, 42, 47],
    niedrig: ['Reiseplan geprüft. Ankunft {ANKUNFT}, Puffer {PUFFER}. Keine Einwände.', 'Plan liegt vor und ist stimmig. Ankunft {ANKUNFT}. Melde dich nach dem Bezug der Unterkunft.'],
    mittel: ['Reiseplan geprüft. Vertretbar, aber nicht unauffällig: {FAKTOR}. Änderung bis zur Abreise möglich.', 'Plan angenommen, Vorbehalt: {FAKTOR}. Die Verantwortung für die Ausführung liegt bei dir.'],
    hoch: ['Reiseplan geprüft. Das Risiko ist mir zu hoch: {FAKTOR}. Ändere den Plan, solange du nicht abgereist bist.', 'Nicht tragfähig: {FAKTOR}. Bis zur Abreise nachbessern.'],
    ohnePlan: 'Zum Start liegt keine Reisemeldung vor. Ich setze dich als vor Ort an, ohne Plan und ohne Rückfallebene. Das wird vermerkt.',
    ankunft: 'Ankunft registriert, Standort {ORT}. Weiter nach Auftrag.',
    fruehCheckin: ['Check-in {ORT} registriert.', '{ORT} notiert.', 'Registriert, {ORT}.']
  },
  /* Verstärkung: Arten der Kräfte (Modul 8). Sperren, Kontingent und Höchstzahl gleichzeitiger Kräfte stehen je Auftrag in missionen[].verstaerkung. */
  verstaerkung: {
    arten: [
      { id: 'beobachter', name: 'Observationsteam', kraefte: 2, vorlaufH: 6, rufzeichen: ['Obs A', 'Obs B', 'Obs C'], text: 'Zwei Beobachter mit Fahrzeug. Sie sehen und melden, sie greifen nicht ein.' },
      { id: 'fahrer', name: 'Fahrer mit Fahrzeug', kraefte: 1, vorlaufH: 3, rufzeichen: ['Fahrer A', 'Fahrer B', 'Fahrer C'], text: 'Ein Fahrer mit sauberem Fahrzeug, ohne Bindung an die Identität des Agenten.' },
      { id: 'technik', name: 'Technikteam (Funk, Kamera, Ortung)', kraefte: 2, vorlaufH: 12, rufzeichen: ['Technik A', 'Technik B', 'Technik C'], text: 'Funkaufklärung, feste Kamera, Ortung. Aufbau braucht Zeit und hinterlässt Spuren.' },
      { id: 'extraktion', name: 'Rückholbereitschaft', kraefte: 2, vorlaufH: 4, rufzeichen: ['Rückhol A', 'Rückhol B', 'Rückhol C'], text: 'Zwei Kräfte in Bereitschaft für den Abzug des Agenten oder einer Quelle.' },
      { id: 'zugriff', name: 'Einheit (Zugriff)', kraefte: 4, vorlaufH: 24, rufzeichen: ['Zugriff A', 'Zugriff B'], text: 'Zugriffskräfte für das Stoppen der Ladung und das Festsetzen oder Ausschalten Beteiligter.' }
    ]
  },
  bilder: { ordner: 'bilder/', endung: 'jpg', automatisch: false }
};

/* Mission M1: Nachträge am Standard-Dossier (Rolle und Eckdaten im Zusammenhang mit der Transportlinie). */
(function () {
  var N = { "P-0004": [ "Mutmaßlicher Geldgeber hinter der Transportkette; über O-0001 fließen Zahlungen an O-0005.", "Zahlungsweg in Tranchen", "Wissensstand ungeklärt" ], "P-0005": [ "Führt die Bücher von O-0001; Beteiligung an der Kette nicht erkennbar.", "Wissensstand ungeklärt" ], "P-0006": [ "Richtet verschlüsselte Absprachekanäle der Kette ein; mutmaßlich Terminkoordination.", "Wissensstand ungeklärt" ], "P-0007": [ "Ihre Händler nutzen L-0002 als Verladeort; die Ware wird in Warenkisten getarnt. Kenntnis vom Inhalt ungeklärt.", "Wissensstand ungeklärt" ], "P-0011": [ "Beschafft mutmaßlich die Fahrzeuge für den Transport; Kontakt zu P-0013 belegt.", "Wissensstand ungeklärt" ], "P-0013": [ "Sein Sicherheitsdienst stellt mutmaßlich den Begleitschutz auf der Strecke Ludwigsfelde bis Frankfurt (Oder).", "Annäherung nur mit Freigabe" ], "P-0015": [ "Stellt die Zwischenlagerung in L-0008; Termin und Dauer unbekannt.", "Wissensstand ungeklärt" ], "P-0016": [ "Organisiert den Weitertransport über O-0005 bis zur Grenze; Übergabe in der Nähe von L-0009 vermutet.", "Wissensstand ungeklärt" ], "P-0017": [ "Mutmaßlich Zugang zu Genehmigungen (Durchfahrt, Ausnahmen); Kenntnis ungeklärt.", "Wissensstand ungeklärt" ], "O-0001": [ "Mutmaßliche Zahlungsstelle der Kette.", "Zahlungsweg zu O-0005" ], "O-0005": [ "Frachtführer für den Weitertransport bis zur Grenze nach Polen.", "Fahrzeuge mit wechselnden Kennzeichen" ], "L-0002": [ "Startpunkt der Strecke: Verladung abends, Zufahrt durch die Tordurchfahrt.", "Beobachtung aus dem Umfeld nötig" ], "L-0008": [ "Zwischenlager; mutmaßlich Umschlag auf ein anderes Fahrzeug.", "Dauer der Lagerung unbekannt" ], "L-0009": [ "Mutmaßlicher Übergabepunkt vor der Grenze.", "Nutzung durch O-0005 vermutet" ] };
  SCENARIO.standard.dossiers.forEach(function (e) {
    if (N[e.id]) e.nachtraege.push({ mission: 'M1', rolle: N[e.id][0], eckdaten: N[e.id].slice(1) });
  });
}());

/* Kanalprüfung (Kennwortverfahren) und Check-in-Bestätigung.
   Der Ansprechpartner schreibt gelegentlich einen beiläufigen Satz. Die passende Antwort steht im Notizheft des Agenten (Kennwortliste.txt).
   Normal = richtige Antwort. Zwang = Notwort: sieht für den Agenten aus wie Erfolg, löst im Hintergrund Schutzmaßnahmen aus.
   Hinweis: Die Antworten stehen im Klartext in dieser Datei. */
SCENARIO.kennwort = {
  /* Abbruchwort: in den Kanal Ansprechpartner geschrieben, schließt es die Verbindung und leitet den Abbruch ein */
  abbruchwort: 'Eisvogel',
  paare: [
    { id: 'K-01', satz: 'Der Regen hat in Leipzig heute früher angefangen.', antwort: 'Zimt', zwang: 'Brombeere' },
    { id: 'K-02', satz: 'Bei uns ist die Heizung wieder ausgefallen.', antwort: 'Anker', zwang: 'Kupfer' },
    { id: 'K-03', satz: 'Hast du die Rechnung vom Elektriker noch?', antwort: 'Lorbeer', zwang: 'Segel' },
    { id: 'K-04', satz: 'Der Kaffee im Büro schmeckt seit Montag anders.', antwort: 'Wacholder', zwang: 'Pappel' },
    { id: 'K-05', satz: 'Die Lieferung aus Hamburg kommt erst morgen.', antwort: 'Kiesel', zwang: 'Mohn' },
    { id: 'K-06', satz: 'Im Treppenhaus riecht es schon wieder nach Farbe.', antwort: 'Fenchel', zwang: 'Granit' },
    { id: 'K-07', satz: 'Mein Bruder hat sich ein neues Fahrrad gekauft.', antwort: 'Quitte', zwang: 'Laterne' },
    { id: 'K-08', satz: 'Der Zug nach Kassel hatte wieder Verspätung.', antwort: 'Hafer', zwang: 'Tinte' },
    { id: 'K-09', satz: 'Die Nachbarn haben den Hund abgegeben.', antwort: 'Salbei', zwang: 'Bernstein' },
    { id: 'K-10', satz: 'Hast du morgen Zeit für den Termin beim Zahnarzt?', antwort: 'Ginster', zwang: 'Walnuss' },
    { id: 'K-11', satz: 'Im Keller steht noch Wasser vom Wochenende.', antwort: 'Distel', zwang: 'Messing' },
    { id: 'K-12', satz: 'Die Fenster im ersten Stock klemmen seit dem Frost.', antwort: 'Rübe', zwang: 'Koralle' }
  ],
  /* Texte des Ansprechpartners */
  zuerst: ['Bitte zuerst bestätigen.', 'Erst bestätigen, dann weiter.', 'Ich warte noch auf deine Bestätigung.'],
  wiederholung: ['Das passt nicht. Noch einmal: {SATZ}', 'Falsche Antwort. Der Satz war: {SATZ}'],
  ok: ['Verstanden. Weiter.', 'Passt. Kanal ist offen.', 'In Ordnung.'],
  abbruchKanal: 'Verbindung geschlossen.',
  abbruch: 'Die Antwort passt wieder nicht. Ich schließe den Kanal. Melde dich über Support, dort wird er neu freigegeben.',
  startVorziehen: { ack: ['Verstanden. Ich ziehe den Start vor.', 'Alles klar, du bist also schon vor Ort. Ich passe den Plan an.'], fertig: 'Zeitplan angepasst, der Einsatz läuft. Der Reiseplan entfällt. Check-in innerhalb von 45 Minuten nachreichen, sonst führe ich dich ohne Meldung.' },
  supportAntwort: 'Freigabe für den Ansprechpartner ist beantragt. Er meldet sich gleich.',
  /* Check-in-Bestätigung */
  bestaetigung: {
    plan: ['Check-in angekommen. Standort bestätigt.', 'Check-in verifiziert, {ORT}.', 'Ist angekommen, passt.', 'Standort stimmt. Danke.'],
    ohneFreigabe: ['Check-in eingegangen. Keine Ortsprüfung, die Freigabe ist aus.', 'Eingegangen. Ich kann den Ort nicht gegenprüfen, die Freigabe ist aus.'],
    ausweich: ['Check-in eingegangen. {ORT} steht nicht im Plan, ich vermerke ihn als Ausweichort.', 'Ausweichort {ORT} notiert. Der war nicht vorgesehen.'],
    reise: 'In {MIN} von {VON} nach {NACH}, das sind {KM} km? Bitte prüfen.',
    nahe: 'Der Ort liegt nahe an {DOSSIER}. Behalte das im Auge.'
  }
};

/* Ruhephase: Lebenszeichen auf Standby, Ausrüstungspflege, Belastung des Agenten */
SCENARIO.ruhe = {
  lebenszeichen: {
    abstandMin: [8, 25], fristMin: 20,
    fragen: [
      'Kurze Frage zwischendurch: Alles ruhig bei dir?',
      'Ich wollte nur wissen, ob du erreichbar bist. Ein Wort reicht.',
      'Wie sieht es bei dir aus? Bitte kurz melden.',
      'Stichprobe: Bist du am Gerät und erreichbar?',
      'Alles in Ordnung bei dir? Kurze Rückmeldung genügt.'
    ],
    ack: ['Danke, notiert.', 'Gut. Dann bis später.', 'Passt, danke.', 'Alles klar.'],
    nachfass: 'Auf meine Frage von vorhin kam nichts. Ich vermerke das. Melde dich bitte, wenn du wieder am Gerät sind.'
  },
  verschleiss: {
    'Kommunikation': ['Sitzungsschlüssel veraltet, Austausch fällig', 'Zweites Gerät lädt nicht mehr zuverlässig'],
    'Dokumente': ['Eine Identität braucht neue Lichtbilder und einen Abgleich', 'Ausweisetui und Kartenhüllen abgenutzt, Ersatz nötig'],
    'Mobilität': ['Mietfahrzeug zurückgegeben, neues muss bereitgestellt werden', 'Bahnkarte abgelaufen'],
    'Unterkunft': ['Schlüssel und Zugangscode der Unterkunft verbraucht', 'Ausweichunterkunft nicht mehr bestätigt'],
    'Finanzmittel': ['Budget zu großen Teilen verbraucht, Nachschuss nötig', 'Bargeldreserve aufgebraucht'],
    'Medizinische Grundausstattung': ['Verbandsmaterial angebrochen, Ergänzung fällig', 'Standardsatz unvollständig']
  },
  ausruestung: {
    angenommen: 'Anfrage {KAT} ist bei uns angekommen. Rückmeldung folgt.',
    fertig: '{KAT} ist wieder in Ordnung. Alles ergänzt und geprüft.',
    vorwurf: 'Du hast den Auftrag angenommen, obwohl noch offen ist: {LISTE}. Das hätte ich vorher geklärt. Hol es nach, sobald es geht.',
    hinweis: {
      'Kommunikation': 'Schlüssel erneuert, Gegenprobe bestanden',
      'Dokumente': 'Alle Identitäten abgeglichen, Lichtbilder aktuell',
      'Mobilität': 'Fahrzeug und Bahnkarte bereitgestellt',
      'Unterkunft': 'Zugang bestätigt, Ausweichunterkunft gebucht',
      'Finanzmittel': 'Budget für 14 Tage wieder hinterlegt',
      'Medizinische Grundausstattung': 'Standardsatz vollständig'
    }
  },
  belastung: {
    hinweis: 'Ich habe den Eindruck, du bist seit längerem stark belastet. Wenn es geht, leg eine Pause ein. Setze dazu den Status auf Ruhend, ich melde mich dann nicht.',
    hinweisEinsatz: 'Ich habe den Eindruck, du bist seit längerem stark belastet. Im Einsatz kannst du nicht in die Pause, Ruhend geht erst nach Abschluss oder Abbruch. Eine kurze Atempause geht auch im Einsatz: schreib es mir (zum Beispiel "ich brauche kurz eine Pause") oder nutze den Knopf im Profil. Danach nimm dir die Zeit.',
    sperre: 'Solange du so stark belastet bist, schicke ich dir nichts Neues. Eine kurze Atempause hilft, schreib es mir oder nutze den Knopf im Profil.'
  }
};

/* Erkennung 2.0: Texte der Rückfragen */
SCENARIO.erkennung = {
  rest: {
    handler: 'Beim Rest bin ich nicht sicher, was du meinst.',
    support: 'Beim Rest bin ich nicht sicher, was Sie meinen.',
    asset: 'Den Rest habe ich nicht verstanden.'
  },
  klaerung: {
    handler: 'Meinst du {A} oder {B}?',
    support: 'Meinen Sie {A} oder {B}?',
    asset: 'Wen meinst du, {A} oder {B}?'
  }
};

/* KIEBITZ und angekündigte Verstärkung: vorgewarnt bleibt er ruhig, ohne Vorwarnung meldet er sich selbst */
SCENARIO.kiebitz = {
  vorgewarnt: [
    'Ich sehe sie. Wie besprochen. Ich halte mich zurück und frage nichts.',
    'Sind angekommen. Ich tue so, als wüsste ich von nichts.',
    'Danke für die Vorwarnung. Das macht es leichter.'
  ],
  ueberrascht: [
    'Hier stehen plötzlich Leute, die nicht hierher gehören. Gehören die zu dir?',
    'Seit einer Weile sitzt jemand im Auto gegenüber. Sag mir, dass das deine sind.',
    'Ich mag keine Überraschungen. Was ist da draußen los?'
  ]
};

/* Abfragen per Text (Standort, Zeit, Alias, Phase, Verstärkung, Erreichbarkeit); Du-Form für ARGUS */
SCENARIO.abfragen = {
  keinAuftrag: 'Dazu liegt gerade kein laufender Auftrag vor.',
  zeit: {
    noch: '{FENSTER}: noch {REST}, Beginn {VON}.',
    laeuft: '{FENSTER}: läuft seit {SEIT}, Ende in {REST} ({BIS}).',
    vorbei: '{FENSTER} ist vorbei, Ende war {BIS}.',
    zusatz: ['Der Termin gilt als gesetzt, eine Vorverlegung kann ich nicht ausschließen.', 'Plane mit Puffer.']
  },
  phase: {
    M1: ['Du bist in Phase 1 von 3, Aufklärung. Phase 2 (Einschleusung) wird gesondert zugewiesen, sobald Phase 1 steht. Zu Phase 3 sage ich nichts.',
         'Aktuell Phase 1 von 3: Gesichter, Belege, Strecke. Was danach kommt, wird gesondert zugewiesen.']
  },
  alias: { keine: '{E} {N}: keine Aliase bekannt.', ja: '{E} {N}, auch geführt als: {A}.' },
  standort: {
    sichtung: '{E} {N}: letzte Sichtung {T}{O}{X}{G}. {ANZ}',
    adresse: '{E} {N}: keine Sichtung eingetragen. Hinterlegt: {H}.',
    nichts: '{E} {N}: keine Sichtung und keine Adresse hinterlegt. Sichtungen trägst du im Dossier ein.',
    gesperrt: '{E}: Diese Kennung ist dir nicht zugänglich.',
    unbekannt: '{E}: Diese Kennung kenne ich nicht. Prüf die Schreibweise.',
    ort: '{E} {N} ist ein fester Ort: {H}.'
  },
  verstaerkung: {
    keine: 'Es liegt keine Anforderung von dir vor. Verstärkung läuft über den Bereich Verstärkung.',
    pruefung: '{ID} ({KRAEFTE}) ist noch in Prüfung. Das dauert, drängeln hilft nicht.',
    unterwegs: '{ID} {RZ} ist unterwegs, Eintreffen {AN}. Schneller wird es durch Nachfragen nicht.',
    vorOrt: '{ID} {RZ} ist vor Ort bei {ORT} und wartet auf Weisung.',
    abgelehnt: '{ID} wurde abgelehnt. Grund steht im Bereich Verstärkung.',
    zurueck: '{ID} ist zurückgezogen.',
    beeilen: 'Ich gebe den Wunsch weiter. Am Eintreffen ändert das nichts.'
  },
  erreichbar: {
    handler: ['Ich bin da.', 'Erreichbar. Was liegt an?'],
    support: ['Die DISPO ist über den Kanal Support Element erreichbar. Dort steht jemand auf Bereitschaft.', 'DISPO ist besetzt. Wende dich direkt an den Kanal Support Element, Fahrzeuge und Strecke laufen dort.'],
    asset: ['KIEBITZ ist über den Kanal Kontakt vor Ort erreichbar, aber nicht immer sofort. Schreib kurz.', 'Er liest mit Verzögerung. Auf Fenster begrenzen.']
  },
  freigabe: {
    unbekannt: 'Die Kennung {E} sagt mir nichts. Prüf die Schreibweise.',
    gesperrt: 'Auf {E} hast du keinen Zugang, das liegt außerhalb deines Auftrags. Antrag nicht möglich.',
    wofuer: 'Freigabe wofür bei {E} {N}? Observation, Abfangen, Sabotage, Festsetzung, Eliminierung. Oder soll {E} dem Auftrag zugeordnet werden?',
    begruendung: 'Verstanden: {M} gegen {E} {N}. Dafür brauche ich eine Begründung: Anlass, Beleg, Nutzen, in ganzen Sätzen.',
    zuordnung: 'Zuordnung von {E} {N} zum Auftrag eingereicht. Rückmeldung folgt.',
    schonMitglied: '{E} gehört bereits zum Auftrag. Eine Zuordnung ist nicht nötig. Welche Maßnahme meinst du?',
    keinAuftrag: 'Freigaben gibt es nur zu einem laufenden Auftrag.',
    eingereicht: 'Anfrage {M} gegen {E} aufgenommen. Die Entscheidung kommt gesondert.',
    verworfen: 'Dann lassen wir es. Die Anfrage ist zurückgenommen.',
    nachfrage: 'Ich brauche eine Begründung oder ein "abbrechen". Sonst bleibt die Anfrage offen.'
  }
};

SCENARIO.abfragen.dossier = {
  wohin: 'Zu welchem Dossier gehört die Meldung? Nenne die Kennung oder den Namen.',
  welches: 'Das passt auf mehrere Dossiers: {LISTE}. Welches soll es sein?',
  quittung: ['Vermerkt bei {E} {N}.', 'Aufgenommen: {E}, Sichtung {SI}.', 'Notiert im Dossier {E}.'],
  notizQuittung: ['Notiert bei {E} {N}.', 'Notiz {DN} im Dossier {E} abgelegt.', 'Vermerkt als Notiz bei {E}.'],
  ohneOrt: ' Einen Ort habe ich nicht erkannt. Setz die Adresse in Anführungszeichen, dann trage ich sie ein.',
  unbestaetigt: ' Eingetragen als unbestätigt.',
  zweitquelle: ' Das widerspricht einer früheren Sichtung. Wir prüfen es.',
  verworfen: 'Verworfen. Es wurde nichts eingetragen.'
};
SCENARIO.guete = {
  unbewertet: { label: 'unbewertet', klasse: 's-dim', text: 'noch nicht eingestuft' },
  gesichert: { label: 'gesichert', klasse: 's-accent', text: 'eigene Beobachtung' },
  plausibel: { label: 'plausibel', klasse: 's-dim', text: 'aus zweiter Hand, schlüssig' },
  unbestaetigt: { label: 'unbestätigt', klasse: 's-warn', text: 'ohne Beleg' },
  widerspruechlich: { label: 'widersprüchlich', klasse: 's-crit', text: 'steht gegen eine andere Sichtung' },
  veraltet: { label: 'veraltet', klasse: 's-dim', text: 'älter als 24 Stunden' }
};

SCENARIO.abfragen.aussagen = {
  wissenJa: 'weiß Bescheid', wissenNein: 'weiß nichts davon',
  vermerkt: ['Vermerkt zu {E} {N}: {W}.', 'Aufgenommen: {E} {W}.'],
  frageWissen: 'Zu {E} {N}: Vorhin hast du gemeldet, die Person {ALT}. Jetzt sagst du das Gegenteil. Was gilt?',
  frageOrt: 'Zu {E} {N}: Vorhin {A} ({ZA}), jetzt {B}. Das passt nicht zusammen. Welcher Ort stimmt?',
  geklaertWissen: 'Verstanden. {E} führe ich als: {W}. Die andere Angabe steht verworfen im Register.',
  geklaertOrt: 'Verstanden, {O} gilt. {X} bleibt als unbestätigt vermerkt.',
  offen: 'Dann bleibt es offen. Beide Angaben stehen als unklar im Register.',
  nachfrage: 'Ich brauche eine klare Angabe zu {E}: welche Aussage gilt?'
};

SCENARIO.abfragen.modul = {
  freigaben: { keine: 'Von dir liegt keine Freigabeanfrage vor.', kopf: 'Deine Freigabeanfragen: ' },
  ausruestung: 'Ausrüstung: {OK} einsatzbereit{WARTUNG}.',
  zustand: ['Dein Zustand: Belastung {BEL}. {RAT}', 'Belastung {BEL}. {RAT}'],
  zustandRat: { niedrig: 'Kein Handlungsbedarf.', mittel: 'Behalte es im Blick.', hoch: 'Leg eine Pause ein, sobald es der Auftrag zulässt.' },
  identitaet: 'Aktive Identität: {B}, {N} ({L}).',
  termine: { kopf: 'Anstehend: ', keine: 'Im Moment steht nichts Fixes an.' },
  berichte: 'Von dir liegen {N} Berichte zu diesem Auftrag vor.'
};

/* Ereignisregeln (Schritt 4): Ein Ereignis (Protokollaktion) löst nach einer Verzögerung eine Nachricht der Gegenstelle aus, wenn die Bedingung zum Zustand passt.
   von: handler (ARGUS, Du), asset (KIEBITZ, Du), support (DISPO, Sie). minV/maxV: Vertrauen der Gegenstelle, minD: Druck bzw. Belastung. {ID}: erste Kennung aus dem Ereignis. */
SCENARIO.ereignisregeln = [
  { id: 'E-sichtung-quelle', aktion: 'Sichtung gemeldet', von: 'handler', maxV: 70, verz: [90, 180], einmal: true,
    texte: ['Zur Sichtung bei {ID}: Selbst gesehen oder aus zweiter Hand? Das entscheidet, wie ich sie führe.'], rueck: 'quelle' },
  { id: 'E-dokument-auswertung', aktion: 'Dokument eingereicht', von: 'support', verz: [150, 300], einmal: false,
    texte: ['Zu {ID}: Das eingereichte Dokument ist formal unauffällig. Der Abgleich läuft noch, Sie hören von uns über den Ansprechpartner.'] },
  { id: 'E-begegnung-kiebitz', aktion: 'Begegnung gemeldet', enthaelt: 'P-0001', von: 'handler', maxV: 70, verz: [60, 120], einmal: true,
    texte: ['Kontakt zu KIEBITZ nur in den vereinbarten Fenstern. Kein Alleingang im Betrieb.'] },
  { id: 'E-verstaerkung-druck', aktion: 'Verstärkung angefordert', enthaelt: 'Entscheidung: genehmigt', von: 'handler', minD: 55, verz: [60, 140], einmal: true,
    texte: ['Die Kräfte kosten Geld, und oben schaut man darauf. Nutze sie und melde Ergebnisse, nicht nur Eindrücke.'] },
  { id: 'E-freigabe-asset', aktion: 'Freigabe beantragt', enthaelt: 'Entscheidung: erteilt', von: 'asset', minD: 35, verz: [200, 420], einmal: true,
    texte: ['Hier liegt etwas in der Luft. Wenn das auf mich zurückfällt, bin ich raus.', 'Im Betrieb ist es auffällig still geworden. Ich hoffe, das hat nichts mit dir zu tun.'] },
  { id: 'E-abbruch-asset', aktion: 'Auftrag abgebrochen', von: 'asset', verz: [180, 300], einmal: true,
    texte: ['Hier wurde nach dir gefragt. Ich habe nichts gesagt. Mehr schreibe ich dazu nicht.'] },
  { id: 'E-widerspruch-nachhaken', aktion: 'Widerspruch erkannt', von: 'handler', minD: 60, verz: [300, 420], einmal: false, bedingung: 'widerspruch',
    texte: ['Zum Widerspruch von vorhin hängt noch eine Antwort aus. Bei dem Druck, den ich habe, brauche ich sie bald.'] }
];



/* Operative Spuren (Abdruck): Warnungen des Ansprechpartners und Stimme des Assets, nach Stufe 1 bemerkbar, 2 erkennbar, 3 verbrannt */
SCENARIO.abdruck = {
  legende: {
    1: ['Mir fällt ein Muster auf: Deine Bewegungen und Meldungen häufen sich. Noch unauffällig, aber nimm Tempo raus.', 'Hinweis: Dein Spurenbild ist dichter als nötig. Prüfe, welche Aufmerksamkeit deine Bewegungen und Meldungen erzeugen.'],
    2: ['Dein Abdruck ist erkennbar. Wer hinsieht, setzt das zusammen. Keine neuen Anträge und keine Alleingänge, bis es sich beruhigt hat.', 'Die Legende ist nur noch eingeschränkt belastbar. Ich empfehle Zurückhaltung: weniger Bewegung, keine unnötigen Kontakte, nichts Neues anstoßen.'],
    3: ['Die Legende gilt als verbrannt. Keine eingriffsnahen Maßnahmen mehr, bevor sich die Lage beruhigt hat. Prüfe Ruhend oder einen Identitätswechsel nach dem Einsatz.', 'Das genügt zur Identifizierung. Stoppe alles Eingriffsnahe und ziehe dich zurück. Eine Meldung an die Leitung erfolgt, wenn sich die Lage nicht stabilisiert.']
  },
  asset: {
    1: ['Zu viele Kontakte zu KIEBITZ in kurzer Zeit. Das fällt irgendwann auf. Nur noch, wenn es nötig ist.', 'Die Kontaktfrequenz zu KIEBITZ ist zu hoch. Weniger Nachrichten, kürzer halten.'],
    2: ['Ab jetzt kein Kontakt zu KIEBITZ bis {BIS}Z. Das ist eine Anweisung. Wer jetzt noch schreibt, gefährdet ihn.', 'Sperre für den Kanal Kontakt vor Ort bis {BIS}Z. Das Entdeckungsrisiko um KIEBITZ ist zu hoch.'],
    3: ['KIEBITZ ist akut gefährdet. Kontaktsperre bis {BIS}Z, ohne Ausnahme. Wird er enttarnt, geht das auf die Kontaktfrequenz zurück.', 'Nichts mehr an KIEBITZ bis {BIS}Z. Jeder weitere Kontakt erhöht das Enttarnungsrisiko.']
  },
  assetStimme: {
    2: ['Hier wird auf Kontakte geachtet. Bitte jetzt nicht schreiben.', 'Hier wird gefragt, wer mit wem Kontakt hat. Ich melde mich, wenn es ruhiger ist.'],
    3: ['Ich bin ernsthaft nervös. Es wird nach einer undichten Stelle gesucht. Kein Kontakt mehr, bitte.', 'Wenn das so weitergeht, bin ich draußen. Ich schreibe von mir aus, sobald es geht.']
  },
  ruege: ['Es gilt: kein Kontakt zu KIEBITZ. Bei einem Notfall melde ihn mir, sonst unterlassen.', 'Die Kontaktsperre gilt. Der Verstoß ist vermerkt.', 'Du schreibst ihm trotz Sperre. Ein weiterer Verstoß wirkt sich auf deine Bewertung aus.']
};

SCENARIO.infozugang = { ausnahmen: {} };
SCENARIO.abfragen.info = {
  stufen: { 1: 'Zugriffsstufe 1 (Einsicht auf Anfrage)', 2: 'Zugriffsstufe 2 (nur mit Begründung)', 3: 'Zugriffsstufe 3 (gesperrt, strenge Prüfung)' },
  gesperrt: [
    'Zu {E} liegt eine Zugriffsbeschränkung vor, {S}. Ohne Begründung gebe ich nichts heraus. Wofür brauchst du es? Anlass, Beleg, Nutzen.',
    '{E} ist beschränkt, {S}. Begründe die Anfrage: Was hast du gesehen, woran machst du es fest, wozu brauchst du es?',
    'Auf {E} habe ich dir keinen Zugriff eingeräumt, {S}. Ohne Begründung bleibt es dabei. Anlass, Beleg, Nutzen.'
  ],
  frei: ['Freigegeben.', 'In Ordnung, du bekommst es.', 'Das trägt. Zugriff erteilt.'],
  rudiment: [
    '{N}: {R} Bedrohungsbewertung Stufe {S}: {B} Mehr gibt der Bestand noch nicht her. Für den Vollzugriff brauche ich mindestens eine Sichtung zu der Person und deine Einschätzung nach Quelle und Information.',
    'Zu {N} liegt nur ein Rudiment vor. {R} Stufe {S}: {B} Liefere eine Sichtung und deine Einschätzung (Quelle A bis F, Information 1 bis 6), dann öffne ich die Akte.'
  ],
  /* Prüfmeldungen von DISPO, je nach Art des eingereichten Dokuments. {ID} Kennung, {A} Art mit Artikel (z. B. "der Chatverlauf"), {a} Art ohne Artikel.
     eingang: erste Meldung (Sichtung läuft), ergebnis: Abschlussmeldung, jeweils mehrere Varianten je Art. */
  dokumentPruefung: {
    eingang: ['Zu {ID}: Sichtung des Dokuments läuft.', 'Zu {ID}: Eingang bestätigt, Sichtung läuft.', 'Zu {ID}: Dokument liegt vor, wir sichten.'],
    arten: {
      'Chatverlauf': [
        'Zu {ID}: Der Chatverlauf ist formal unauffällig, Zeitstempel und Verlauf sind schlüssig. Sollte Ihre Einschätzung abweichen, informieren Sie bitte den Ansprechpartner.',
        'Zu {ID}: Beim Chatverlauf keine Brüche in der Abfolge erkennbar. Metadaten waren nicht prüfbar. Bei abweichender Einschätzung bitte den Handler informieren.',
        'Zu {ID}: Chatverlauf gesichtet, inhaltlich plausibel, Urheberschaft nicht belegt. Der Abgleich läuft, Ergebnis über den Ansprechpartner.',
        'Zu {ID}: Der Chatverlauf wirkt ausgeschnitten, Anfang und Ende fehlen. Bitte den Ansprechpartner informieren, falls Sie das Original haben.'
      ],
      'Frachtbrief': [
        'Zu {ID}: Der Frachtbrief ist formal unauffällig, Nummernkreis und Stempel passen zum Muster. Bei abweichender Einschätzung bitte den Ansprechpartner informieren.',
        'Zu {ID}: Am Frachtbrief ist die Gewichtsangabe auffällig niedrig im Verhältnis zur Ladung. Der Abgleich läuft, Ergebnis über den Handler.',
        'Zu {ID}: Frachtbrief gesichtet. Absender und Empfänger sind nicht abgleichbar, das Dokument bleibt vorerst unbestätigt.',
        'Zu {ID}: Frachtbrief ohne formale Mängel. Ob die Ladung tatsächlich so befördert wurde, lässt sich daraus nicht ableiten.'
      ],
      'Kontoauszug': [
        'Zu {ID}: Der Kontoauszug ist formal unauffällig. Buchungsfolge und Salden sind plausibel, die Echtheit ist nicht geprüft. Bei abweichender Einschätzung bitte den Ansprechpartner informieren.',
        'Zu {ID}: Beim Kontoauszug passt das Datumsformat nicht zum angegebenen Institut. Der Abgleich läuft.',
        'Zu {ID}: Kontoauszug gesichtet. Gegenkonten sind nicht zuzuordnen, Ergebnis folgt über den Handler.'
      ],
      'Lieferschein': [
        'Zu {ID}: Der Lieferschein ist formal vollständig und unauffällig. Unterschriften sind nicht prüfbar. Bei abweichender Einschätzung bitte den Handler informieren.',
        'Zu {ID}: Lieferschein gesichtet. Absender und Empfänger passen zusammen, die Positionsnummern sind lückenhaft. Abgleich läuft.',
        'Zu {ID}: Auf dem Lieferschein fehlt die Fahrzeugkennung. Das kann Zufall sein. Ergebnis über den Ansprechpartner.'
      ],
      'Foto eines Dokuments': [
        'Zu {ID}: Das Foto des Dokuments ist formal unauffällig. Der Inhalt ist lesbar, das Original ist nicht prüfbar. Bei abweichender Einschätzung bitte den Handler informieren.',
        'Zu {ID}: Fotografiertes Dokument gesichtet. Bearbeitungsspuren konnten wir nicht feststellen. Die Herkunft bleibt offen, der Abgleich läuft.',
        'Zu {ID}: Das Foto ist stark komprimiert, Details sind nicht belastbar auswertbar. Ein Original wäre hilfreich.',
        'Zu {ID}: Teile des Dokuments sind auf dem Foto abgeschnitten. Lad es bitte neu hoch.'
      ],
      'Sonstiges': [
        'Zu {ID}: Das eingereichte Dokument ist formal unauffällig. Der Abgleich läuft noch, Sie hören von uns über den Ansprechpartner.',
        'Zu {ID}: Dokument gesichtet, keine formalen Mängel erkennbar. Sollte Ihre Einschätzung abweichen, bitte den Handler informieren.',
        'Zu {ID}: Das Dokument ist nur eingeschränkt auswertbar. Eine genauere Einordnung erfolgt über den Ansprechpartner.'
      ]
    },
    abweichung: 'Zu {ID}: Meine Einschätzung des Dokuments weicht von der Prüfung durch DISPO ab: ',
    handlerAck: ['Notiert, Abweichung zu {ID} liegt bei mir. Ich lasse die Unterlagen noch einmal durchsehen.', 'Verstanden. Zu {ID} veranlasse ich eine zweite Durchsicht.', 'Aufgenommen. Die Unterlagen zu {ID} gehen in die zweite Sichtung.'],
    zweite: ['Zu {ID}: Zweite Durchsicht auf Veranlassung des Ansprechpartners läuft.', 'Zu {ID}: Wir sehen die Unterlagen auf Veranlassung des Handlers erneut durch.'],
    zweiteErgebnis: ['Zu {ID}: Zweite Durchsicht abgeschlossen. Der Befund bleibt, formale Mängel sind nicht erkennbar. Ihre Einschätzung bleibt dennoch vermerkt.', 'Zu {ID}: Zweite Durchsicht abgeschlossen. Es gibt Hinweise auf nachträgliche Bearbeitung, wir führen das Dokument als eingeschränkt belastbar.', 'Zu {ID}: Die erneute Prüfung stützt Ihre abweichende Einschätzung teilweise. Das Dokument bleibt offen, Näheres über den Ansprechpartner.']
  },
  rudimentSupport: 'Zu {N} gibt es bei uns nur die Eckdaten. Alles Weitere läuft über den Ansprechpartner.',
  einreichung: {
    ack: ['Eingang bestätigt. Ich sehe mir die Unterlagen zu {N} an.', 'Angekommen. Prüfung zu {N} läuft.'],
    frei: ['Zu {N}: Eingang formal geprüft und bestätigt. Die Akte ist jetzt für dich offen.', 'Bestätigt. Die Unterlagen zu {N} sind angenommen, du hast den Vollzugriff.'],
    fehltSichtung: 'Zu {N} fehlt mir ein Beleg. Trag eine Sichtung ein, melde sie mir direkt mit "Als Sichtung" oder lade ein Dokument im Dossier hoch.',
    denken: ['Zu {N} muss ich nochmal drübergehen. Gib mir einen Moment.', 'Ich überdenke das noch einmal. Das dauert kurz.', 'Moment. Ich will das bei {N} nicht überstürzt freigeben.'],
    rueck: ['Zu {N} habe ich eine Rückfrage, bevor ich freigebe: Woher stammt der Beleg, und wie belastbar ist er? Antworte mir hier im Chat, zwei Sätze genügen.', 'Bevor ich bei {N} freigebe: Wie bist du an die Unterlagen gekommen? Kurz hier im Chat begründen.'],
    rueckWartet: 'Zu {N} wartet meine Rückfrage noch auf deine Antwort. Ohne sie gebe ich nichts frei.',
    rueckZuKurz: 'Das ist zu knapp. Woher stammt der Beleg zu {N}, und wie belastbar ist er?',
    rueckDanke: ['Verstanden. Das reicht mir für {N}.', 'Danke, das genügt mir. Ich gebe {N} gleich frei.'],
    einschaetzungVeraltet: 'Deine Einschätzung zu {N} ist zu alt, um sie weiterzureichen. Quellen altern, je nach Zuverlässigkeit in Stunden oder Tagen. Gib sie bitte neu ab, zum Beispiel "Einschätzung {N} B2", gern mit frischer Sichtung.',
    fehltEinschaetzung: 'Zu {N} fehlt deine Einschätzung. Gib Zuverlässigkeit der Quelle (A bis F) und Information (1 bis 6) an, zum Beispiel "Einschätzung {N} B2".',
    laeuft: 'Zu {N} habe ich bereits etwas von dir auf dem Tisch. Das läuft.',
    schonFrei: 'Zu {N} hast du den Vollzugriff bereits.',
    gesetzt: 'Einschätzung zu {N} vermerkt: Quelle {Q}, Information {I}.',
    codeFehlt: 'Zu {N} fehlt der Code. Quelle A bis F, Information 1 bis 6, zum Beispiel B2.'
  },
  abgelehnt: 'Dazu gebe ich dir nichts. {G}',
  zuKurz: 'Das ist keine Begründung.',
  zuDuenn: 'Für diese Zugriffsstufe ist das zu dünn. Anlass, Beleg und Nutzen, in ganzen Sätzen, und keine bloße Vermutung.',
  vertrauen: 'Nach den letzten Vorgängen gebe ich das nicht heraus. Erst Ergebnisse.',
  sperre: 'Wir lassen es jetzt. Frag später neu an.',
  sperrzeit: 'Zu {E} haben wir das eben besprochen. Vor {ZEIT} komme ich nicht darauf zurück.',
  verworfen: 'Verworfen. Es wurde nichts freigegeben.',
  supportGesperrt: 'Zu {E} habe ich keinen Zugriff. Das läuft über den Ansprechpartner.'
};


SCENARIO.abfragen.aussageEntitaet = {
  handler: {
    bewertung: ['Das ist deine Einschätzung zu {E}. Mit Beleg führe ich sie, ohne nicht. Was hast du gesehen?', 'Zu {E}: Eine Bewertung ohne Anlass trage ich nicht weiter. Woran machst du es fest?', 'Verstanden, aber das ist ein Urteil und keine Meldung. Belege es mit Sichtung oder Bericht.'],
    sonst: ['Zu {E} notiert. Willst du es im Dossier festhalten: "Als Sichtung" für Ort und Zeit, "Als Notiz" für alles andere, beides unter dem Textfeld.', 'Aufgenommen, aber nur im Kanal. Ins Dossier kommt es über "Als Sichtung" oder "Als Notiz".', 'Zu {E} verstanden. Was ist daran für den Auftrag relevant?']
  },
  support: {
    bewertung: ['Zu {E} liegt bei uns keine Auswertung vor. Bewertungen trifft der Ansprechpartner.', 'Das können wir nicht bestätigen. Bitte mit Beleg über den Ansprechpartner.'],
    sonst: ['Zu {E} liegt bei uns nichts vor. Das geht an den Ansprechpartner.', 'Vermerkt, aber ohne Auftrag an uns. Was sollen wir tun?']
  }
};
SCENARIO.abfragen.quelle = {
  selbst: 'Gut. Dann führe ich {SI} als gesichert.',
  zweite: 'Dann führe ich {SI} als plausibel, nicht als gesichert. Sobald du es selbst siehst, melde nach.'
};

SCENARIO.abfragen.checkin = {
  handler: ['Check-in vermerkt. Im Modul 1 aktuell halten.', 'Notiert. Nächstes Fenster einhalten.'],
  support: ['Check-in liegt vor, danke.', 'Vermerkt. Wir halten den Plan.'],
  asset: ['Gut. Dann weiß wenigstens einer, dass du noch da bist.', 'Alles klar.']
};


/* Fäden: Folgefragen ohne Gegenstand und "Bin dran"-Nachmeldungen (Antworten in der Rolle der Gegenstelle) */
SCENARIO.faeden = {
  handler: {
    unbekannt: { antwort: ['Zu {N} liegt kein Dossier vor. Quelle und Anlass nennen.', 'Der Name {N} ist mir nicht zugeordnet. Woher kommt er?', 'Zu {N} habe ich nichts. Wie bist du auf den Namen gekommen?'] },
    wiederholt: ['Wie gesagt: {E}', 'Dabei bleibt es: {E}'],
    noch: ['Noch nichts Belastbares. Ich melde mich.', 'Offen. Sobald etwas vorliegt, bekommst du es.', 'Keine Rückmeldung bisher. Ich bleibe dran.'],
    folge: {
      antwort: ['Genaueres habe ich dazu noch nicht. Ich frage nach.', 'Dazu liegt mir nichts Belastbares vor. Ich kläre es und melde mich.', 'Das weiß ich noch nicht. Ich bleibe dran.'],
      ergebnisVor: 'Zu deiner Rückfrage „{F}“:',
      ergebnis: {
        anzahl: ['Eine belastbare Zahl liegt mir nicht vor. Ich frage nach.', 'Gezählt ist das bisher nicht. Eine Zahl nenne ich erst, wenn sie belegt ist.'],
        menge: ['Nach erster Auskunft mehr als einmal. Eine genaue Zahl gibt es noch nicht.', 'Die Zahl ist nicht belegt. Mehrfach, mehr kann ich nicht bestätigen.'],
        dauer: ['Über den Zeitraum liegt nichts Belastbares vor.', 'Die Dauer ist nicht belegt.'],
        zeit: ['Der Zeitpunkt ist nicht belegt. Weiter beobachten.', 'Zur genauen Zeit liegt nichts vor.'],
        person: ['Namen liegen nicht vor.', 'Wer es war, ist nicht belegt.'],
        ort: ['Zum genauen Ort liegt nichts vor.', 'Der Ort ist nicht belegt.'],
        grund: ['Ein Grund ist nicht belegt.', 'Zu den Hintergründen liegt nichts vor.'],
        sonst: ['Noch keine belastbare Auskunft. Ich melde mich, sobald es etwas gibt.']
      }
    }
  },
  support: {
    unbekannt: { antwort: ['Zu {N} haben wir nichts. Wir prüfen die Unterlagen.', 'Der Name {N} liegt uns nicht vor. Wir sehen nach.'], ergebnis: ['Zu {N}: kein Treffer in unseren Unterlagen. Wenn Sie mehr haben, bitte einreichen.', 'Zu {N}: nichts Belastbares gefunden. Ohne weitere Angaben kommen wir nicht weiter.'] },
    wiederholt: ['Wie gesagt: {E}', 'Dabei bleibt es: {E}'],
    noch: ['Wir sind dran. Ergebnis folgt.', 'Noch in Arbeit. Wir melden uns.', 'Noch nichts Belastbares. Wir bleiben dran.'],
    folge: {
      antwort: ['Das weiß ich noch nicht. Bin dran.', 'Dazu haben wir noch nichts. Wir prüfen es.', 'Das kann ich jetzt nicht sagen. Ich frage nach.'],
      ergebnisVor: 'Zu Ihrer Rückfrage „{F}“:',
      ergebnis: {
        anzahl: ['Eine Zahl liegt uns bisher nicht vor.', 'Zur Anzahl haben wir noch nichts Belastbares.'],
        menge: ['Mindestens dreimal im letzten Jahr, laut Auswertung der Unterlagen. Die genaue Zahl prüfen wir noch.', 'Nach den Unterlagen mehr als zweimal binnen zwölf Monaten. Weitere Prüfung läuft.'],
        dauer: ['Über den genauen Zeitraum haben wir noch keine Angaben.', 'Mindestens ein halbes Jahr, soweit belegbar.'],
        zeit: ['Der Zeitpunkt lässt sich bisher nicht belegen.', 'Eine genaue Zeit liegt noch nicht vor.'],
        person: ['Namen liegen uns noch nicht vor.', 'Wer dahintersteht, ist bisher nicht belegt.'],
        ort: ['Zum genauen Ort liegt uns nichts vor.', 'Der Ort ist bisher nicht belegt.'],
        grund: ['Ein Grund ist bisher nicht belegt.', 'Zu den Hintergründen haben wir noch nichts.'],
        sonst: ['Noch keine belastbare Auskunft. Wir melden uns, sobald es etwas gibt.']
      }
    }
  },
  asset: {
    unbekannt: { antwort: ['Kenne ich nicht. Ich schau mal, ob ich was finde.', 'Sagt mir nichts. Ich höre mich mal um.', 'Der Name ist mir neu. Ich frag mal rum.'], ergebnis: ['Wegen {N}: Habe mich umgehört. Hier sagt der Name kaum jemandem etwas.', 'Zu {N}: Nichts Brauchbares. Falls mir etwas auffällt, melde ich mich.', 'Wegen {N}: Keiner, den ich gefragt habe, kennt den Namen richtig. Mehr habe ich nicht.'] },
    wiederholt: ['Wie gesagt: {E}', 'Mehr weiß ich nicht. {E}'],
    noch: ['Noch nicht. Ich bleib dran.', 'Ich hab noch nichts. Sobald ich was weiß, sage ich es.', 'Nein. Ich frag weiter rum.'],
    kenntNicht: ['Kenne ich nicht. Ich schau mal, ob ich was finde.', 'Sagt mir nichts. Ich höre mich mal um.', 'Der Name ist mir neu. Ich frag mal rum.'],
    ergebnisName: ['Wegen {N}: Habe mich umgehört. Hier sagt der Name kaum jemandem etwas.', 'Zu {N}: Nichts Brauchbares. Falls mir etwas auffällt, melde ich mich.', 'Wegen {N}: Keiner, den ich gefragt habe, kennt den Namen richtig. Mehr habe ich nicht.'],
    folge: {
      antwort: ['Das weiß ich nicht genau. Ich frag mal rum.', 'Keine Ahnung. Ich schau, was ich rausfinden kann.', 'Dazu kann ich gerade nichts sagen. Ich bleib dran.'],
      ergebnisVor: 'Wegen deiner Frage „{F}“:',
      ergebnis: {
        anzahl: ['Eine genaue Zahl habe ich nicht. Ich versuche, sie herauszubekommen.', 'Gezählt hat hier keiner. Ich bleibe dran, aber verlass dich nicht auf eine Schätzung.'],
        menge: ['Genau weiß es keiner. Mehr als einmal, sagen die Leute hier.', 'Eine Zahl kriege ich nicht zusammen. Öfter, als man denkt.'],
        dauer: ['Seit einer Weile, mehr kriege ich nicht heraus.', 'Genau sagen kann es keiner.'],
        zeit: ['Eine genaue Zeit kriege ich nicht heraus.', 'Die Leute hier sind sich nicht einig.'],
        person: ['Einen Namen habe ich nicht bekommen.', 'Wer es war, sagt keiner.'],
        ort: ['Wo genau, weiß hier keiner.', 'Den Ort kriege ich nicht heraus.'],
        grund: ['Warum, weiß keiner. Man redet nur.', 'Einen Grund nennt niemand.'],
        sonst: ['Genaues weiß hier keiner. Ich bleibe dran.']
      }
    }
  }
};


/* Lagezonen der Karte: Radius in Metern, Bewertungen eigener Zonen, Meldetexte an den Ansprechpartner, Antworten */
SCENARIO.zonen = {
  bericht: {
    eine: 'Im Bereich von {Z} liegt nach meinem Stand eine Person aus unseren Unterlagen: {L}.',
    mehrere: 'Im Bereich von {Z} liegen nach meinem Stand {N} Personen aus unseren Unterlagen: {L}.',
    keine: 'Im Bereich von {Z} liegt nach meinem Stand keine Person aus unseren Unterlagen.',
    weitere: 'Weitere {M} Personen im Bereich habe ich nur nach Zahl. Mehr kann ich dazu nicht sagen.',
    unbekanntEine: 'Dazu eine weitere Person, die nicht in deinem Bestand ist.',
    unbekanntMehrere: 'Dazu {U} weitere Personen, die nicht in deinem Bestand sind.',
    zeile: '{N} (Stufe {S}{ZP}): {T}',
    spurSichtung: 'zuletzt gesehen {A}{O}',
    spurDossier: 'laut Dossier dem Standort zugeordnet, keine Sichtung',
    frage: {
      anwesend: 'Zu {N}: Die letzte Spur ist {A} alt. Ist die Person noch im Bereich?',
      dossier: 'Zu {N}: Ich habe nur den hinterlegten Standort, keine Sichtung. Ist die Person tatsächlich vor Ort?',
      unbekannt: 'Zu den weiteren Personen: Hast du jemanden gesehen? Beschreibe kurz, wen, dann halte ich es fest.'
    },
    antwort: {
      ja: 'Verstanden, {N} bleibt als anwesend geführt.',
      nein: 'Gut, {N} nehme ich aus der Lage des Bereichs.',
      unklar: 'Dann bleibt die alte Spur stehen. Gib Bescheid, sobald du es weißt.',
      notiert: 'Notiert. Ich gleiche es mit unseren Unterlagen ab. Wenn du jemanden identifizierst, leg ein Dossier an.',
      offen: 'Dann bleibt es offen.',
      weiter: 'Nächste Frage: ',
      ende: 'Das reicht mir zur Lage von {Z}.'
    }
  },
  radiusStandard: 400,
  radien: [150, 300, 500, 1000],
  wertungen: { ruhig: 'Unauffällig', leicht: 'Angespannt', bedroht: 'Bedroht', akut: 'Akut bedroht' },
  /* Ereignismeldungen: ARGUS meldet von sich aus Vorkommnisse aus Zonen, je nach Bewertung. {Z} = Kennung und Name der Zone */
  ereignisse: {
    ruhig: [
      '{Z}: Weiterhin ruhig. Übliche Passanten, Lieferverkehr, keine Auffälligkeiten.',
      '{Z}: Nichts Neues. Ein paar Anwohner mit Einkäufen, sonst leer.',
      '{Z}: Ein Lieferwagen hat kurz gehalten und ist weitergefahren. Ohne Belang.',
      '{Z}: Aus dem Bereich liegt nichts vor. Das ist in Ordnung so.',
      '{Z}: Straßenreinigung im Bereich, deshalb etwas Lärm. Sonst unauffällig.'
    ],
    leicht: [
      '{Z}: Zwei Männer stehen seit einer Weile vor dem Eingang und rauchen. Auffällig ist nur die Dauer.',
      '{Z}: Eine Gruppe Jugendlicher hält sich im Hof auf. Laut, aber nicht aggressiv.',
      '{Z}: Ein Mann geht zum dritten Mal am selben Haus vorbei. Kann Zufall sein.',
      '{Z}: Ein Kleinwagen steht mit laufendem Motor an der Ecke, der Fahrer sitzt noch drin.',
      '{Z}: Eine Frau fotografiert die Fassade. Wirkt wie eine Touristin, ich bleibe aufmerksam.',
      '{Z}: Am Nachmittag mehr Fußgänger als üblich. Ein Anlass ist nicht erkennbar.',
      '{Z}: Ein Lieferdienst hat zweimal an derselben Tür geklingelt, niemand hat geöffnet.',
      '{Z}: Anwohner berichten von lautem Streit im Treppenhaus. Danach wieder ruhig.'
    ],
    bedroht: [
      '{Z}: Meldung über einen Mann mit Waffe unter der Jacke. Unbestätigt, Plausibilität mittel.',
      '{Z}: Zwei Personen mit Schlagstöcken am Hintereingang gesehen. Halte Abstand.',
      '{Z}: Die Wachleute im Bereich tragen jetzt sichtbar Schutzwesten. Das war vorher nicht der Fall.',
      '{Z}: Ein Fahrzeug ohne Kennzeichen steht im Hof, drei Männer, einer wirkt nervös. Unbestätigt.',
      '{Z}: Aus der Nachbarschaft: Knall gehört, Schuss oder Böller nicht zu klären. Ich gehe vom Ernstfall aus.',
      '{Z}: Im Treppenhaus wurde ein Messer gezogen und wieder eingesteckt. Eine Quelle, Anwohner.',
      '{Z}: Mehrere Männer in einheitlicher dunkler Kleidung sichern den Eingang. Keine Kennzeichnung.',
      '{Z}: Gruppe vor dem Gebäude mustert gezielt Passanten. Waffen nicht erkennbar, aber nicht auszuschließen.'
    ],
    akut: [
      '{Z}: Schüsse im Bereich bestätigt. Keine Annäherung, Bereich meiden.',
      '{Z}: Menschenansammlung vor dem Gebäude, Flaschen fliegen. Polizei im Anmarsch, Lage ungeordnet.',
      '{Z}: Panik auf der Straße, Menschen laufen in alle Richtungen. Ursache unklar.',
      '{Z}: Ein Fahrzeug ist in die Absperrung gefahren, Personen verlassen den Bereich in Eile.',
      '{Z}: Rauch aus dem Gebäude, Sirenen zu hören. Du bleibst draußen.',
      '{Z}: Bewaffnete Männer verlassen das Gebäude. Auf keinen Fall in den Bereich.',
      '{Z}: Schlägerei mit mehreren Dutzend Beteiligten, Einsatzkräfte sperren ab. Die Lage kippt weiter.',
      '{Z}: Explosion gemeldet, Ursache offen. Bereich gesperrt, Kontakt nur über sichere Wege.'
    ]
  },
  /* Anhebung durch ARGUS selbst: je Stufenwechsel eigene Wendungen. {Z} Zone, {S} neue Bewertung */
  anhebung: {
    'ruhig>leicht': [
      'Ich stufe {Z} von unauffällig auf „{S}“. Es zieht an.',
      'Kleine Verschiebung: {Z} ist ab jetzt „{S}“. Mehr Bewegung als üblich.',
      'Im Bereich {Z} verdichtet sich etwas. Einstufung auf „{S}“ angehoben.'
    ],
    'leicht>bedroht': [
      'Die Anspannung in {Z} schlägt in Bedrohung um. Ich setze die Zone auf „{S}“.',
      'Hinweise auf Bewaffnete im Bereich {Z}. Einstufung jetzt „{S}“.',
      '{Z} hat sich verhärtet. Ich hebe auf „{S}“ an, Abstand halten.'
    ],
    'bedroht>akut': [
      '{Z} ist nach meinen Quellen akut. Einstufung „{S}“, du hältst dich fern.',
      'Eskalation in {Z}. Ich ziehe die Zone auf „{S}“ hoch, ab sofort.',
      'Die Lage in {Z} ist gekippt. „{S}“. Keine Annäherung.'
    ]
  },
  senkung: {
    'leicht>ruhig': ['Entwarnung für {Z}: zurück auf „{S}“.', '{Z} hat sich beruhigt. Ich setze sie auf „{S}“.'],
    'bedroht>leicht': ['Lage in {Z} entspannt sich. Ich nehme sie auf „{S}“ zurück.', '{Z}: Die Bedrohung ist nicht mehr belegt. Jetzt „{S}“.'],
    'akut>bedroht': ['{Z} ist nicht mehr akut, bleibt aber „{S}“. Weiter Abstand.', 'Die schlimmste Phase in {Z} scheint vorbei. Einstufung „{S}“.']
  },
  /* Was ARGUS mit der Meldung tut (Anzeige im Fenster der Zone) */
  meldungHinweis: {
    leicht: 'ARGUS bittet den Asset um eine kurze Bestätigung, sofern er im Bereich ist.',
    bedroht: 'ARGUS verlangt Abstand, gleicht mit seiner Quellenlage ab und fragt den Asset, sofern er im Bereich ist.',
    akut: 'ARGUS nimmt die Lage auf. Kräfte gibt es nur über einen Antrag im Bereich Support.'
  },
  /* Formulierungen der Meldung an ARGUS: Bei jeder Meldung wird eine davon gewählt */
  meldung: {
    leicht: [
      'Bereich angespannt. Bitte um eine kurze Einschätzung von dir.',
      'Lage dort nicht eindeutig. Bitte um eine kurze Rückmeldung vor Ort.',
      'Im Bereich ist etwas in Bewegung. Noch keine Gefährdung erkennbar, ich bleibe aufmerksam.',
      'Erhöhte Aufmerksamkeit für den Bereich. Bitte um Abgleich mit deinen Unterlagen.',
      'Die Stimmung im Bereich hat sich verändert. Bitte um eine Einschätzung vor Ort.',
      'Kein konkreter Anlass, aber das Bild wirkt anders als zuvor. Ich beobachte weiter.',
      'Bereich vorsorglich als angespannt geführt. Keine Maßnahmen nötig.',
      'Unruhe im Bereich, nicht belegt. Ich halte dich auf dem Laufenden.'
    ],
    bedroht: [
      'Bereich bedroht. Es gibt konkrete Anzeichen, noch keine unmittelbare Gefahr. Bitte um Abgleich mit deinen Unterlagen.',
      'Bereich bedroht. Ich halte Abstand und bitte um deine Einschätzung.',
      'Anzeichen für Gegenaufklärung im Bereich. Bitte um Abgleich mit deiner Quellenlage.',
      'Bereich nicht mehr als sicher geführt. Annäherung nur nach deiner Freigabe.',
      'Die Lage hat sich zugespitzt. Ich melde den Bereich als bedroht und halte Abstand.',
      'Gefährdung im Bereich wahrscheinlich. Bitte um deine Einschätzung.',
      'Das Verhalten im Bereich ist auffällig und richtet sich möglicherweise gegen uns. Bitte um Rückmeldung.',
      'Bereich bedroht. Geplante Annäherungen dort stelle ich zurück, bis du dich meldest.',
      'Die Sicherheitslage im Bereich hat sich verschlechtert. Bitte um Lagebild und Verhaltensvorgabe.',
      'Ich stufe den Bereich als bedroht ein und warte auf deine Vorgabe.'
    ],
    akut: [
      'Bereich akut bedroht, benötigen Observationsteam/Einsatzteam.',
      'Akute Bedrohung im Bereich. Bitte um sofortige Vorgabe.',
      'Bereich akut bedroht. Unterstützung erforderlich, ich halte Abstand.',
      'Unmittelbare Gefahr im Bereich. Bitte um eine Entscheidung über den Einsatz.',
      'Akute Lage. Ich unterbreche jede Annäherung und warte auf deine Anweisung.',
      'Bereich akut bedroht. Beantrage Verstärkung, Anlass und Ort liegen vor.',
      'Gefahr im Verzug im Bereich. Bitte um sofortige Rückmeldung.',
      'Die Lage kippt. Bereich als akut bedroht gemeldet, ich halte Abstand.',
      'Akute Bedrohung, Eigensicherung hat Vorrang. Erbitte Weisung und Kräfteeinsatz.',
      'Bereich nicht mehr zu halten. Bitte um Entscheidung, ob Kräfte folgen.',
      'Konkrete Gefahr für Personal im Bereich. Erbitte Observations- oder Einsatzteam.',
      'Bereich akut bedroht. Jede weitere Annäherung ohne Absicherung wäre unverantwortlich.'
    ]
  },
  /* Frage nach der Lage einer Zone */
  lageFrage: [
    'Zone {Z} „{N}“: Wie ist die Lage im Bereich?',
    'Zone {Z} „{N}“: Bitte um Lagebericht zum Bereich.',
    'Zone {Z} „{N}“: Was liegt dort vor?',
    'Zone {Z} „{N}“: Bitte um Stand zu Personen und Lage im Bereich.'
  ],
  antwort: {
    bedrohtAsset: ['Zone {Z} als bedroht vermerkt. Keine Annäherung ohne meine Freigabe. Ich bitte {A}, kurz zu bestätigen, was er dort sieht.', 'Verstanden, {Z} gilt als bedroht. {A} soll sich melden. Bis dahin Abstand halten.'],
    bedrohtOhneAsset: ['Zone {Z} als bedroht vermerkt. Halte Abstand, bis du mehr hast.', 'Bedroht, verstanden. Bei {Z} keine Annäherung ohne meine Freigabe.', 'Verstanden, {Z} ist bedroht. Ich warte auf deine Lage.'],
    akut: ['Zone {Z} als akut bedroht vermerkt. Ein Team stelle ich nicht auf Zuruf. Der Antrag läuft über den Bereich Support, mit Anlass, Ort und Zeitraum. Bis dahin keine Annäherung.',
           'Verstanden, {Z} ist akut bedroht. Beobachtungs- oder Einsatzkräfte entscheide ich im Einzelfall, und nur über den Antrag im Bereich Support. Halte Abstand.'],
    leichtAsset: ['Zone {Z} als angespannt vermerkt. Ich bitte {A} um eine kurze Bestätigung.', 'Verstanden, {Z}. {A} soll sich kurz melden, ob es vor Ort ruhig bleibt.'],
    leichtOhneAsset: ['Zone {Z} als angespannt vermerkt. Ich trage es so weiter.', 'Verstanden, {Z} gilt als angespannt. Tut sich etwas, melde ich mich.', 'Vermerkt: {Z} angespannt. Ich bleibe dran.', 'Zone {Z}: angespannt, nehme ich auf. Mehr liegt mir nicht vor.'],
    keineZielperson: ['Zone {Z} deckt weder eine Zielperson noch einen Standort des Auftrags ab. Dafür melde ich nichts weiter.'],
    ruhig: ['Zone {Z} als unauffällig vermerkt. Danke.'],
    veraltet: 'Zu Zone {Z}: Die Einstufung ist {A} alt. Lagen drehen schneller, als Meldungen laufen. Bestätige sie bitte neu oder stufe nach, bevor ich sie weitertrage.',
    urteilAck: ['Zur Lage bei {S}: Deine Begründung liegt bei mir, ich sehe sie durch.', 'Eingang. Ich prüfe die Einstufung für {S}.'],
    urteilFrei: ['Einstufung für {S} auf Stufe {N} bestätigt. Sie gilt jetzt in deiner Lagekarte.', 'Freigegeben: {S} gilt ab sofort als Stufe {N}.'],
    urteilNein: 'Die Einstufung für {S} auf Stufe {N} gebe ich so nicht frei. {G}',
    urteilVertrauen: 'Nach den letzten Vorgängen setze ich {S} nicht auf Stufe {N}. Erst Ergebnisse.',
    unbekannt: ['Zone {Z} kenne ich nicht.']
  },
  asset: {
    ruhig: ['Bin dort. Ruhig.', 'Alles ruhig hier. Nichts Auffälliges.', 'Kurz geschaut: nichts, was mich stört.'],
    unruhig: ['Hier steht seit vorhin ein fremder Wagen. Ich halte mich zurück.', 'Etwas Unruhe, aber nichts, was mich zum Gehen bringt. Ich bleibe vorsichtig.']
  }
};

SCENARIO.dokumentPruefung = SCENARIO.abfragen.info.dokumentPruefung;
