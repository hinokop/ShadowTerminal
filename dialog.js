/* =====================================================================
   dialog.js – Gesprächsbibliothek für das Field Terminal (index.html)
   Klassisches Script, ausschließlich Daten. Definiert das globale Objekt DIALOG.
   Fehlt die Datei, bleibt das Terminal bei den Stichwortreaktionen aus szenario.js.

   Reihenfolge der Auswertung einer Nachricht des Agenten (index.html, antwortFuer):
   1. Die operativen Stichworte aus szenario.js (Extraktion, Evakuierung, Erledigt, Funkstille, Ziel, Meldung, Dokumente,
      Lage, Hinweise) haben Vorrang.
   2. Offene Rückfrage des Akteurs: Die Eingabe wird als Antwort darauf gelesen (nachfragen).
   3. Absichten (absichten) in der Reihenfolge der Liste; die erste passende gewinnt.
   4. Ohne Treffer: Rückfrage in der Rolle (unklar, allgemeineFrage).

   Schreibweise der Stämme: ^ = Wortanfang, = = ganzes Wort, Leerzeichen = Wortfolge, sonst Teilwort;
   ! vor einem Stamm hebt die Verneinungsprüfung für diesen Stamm auf. Groß- und Kleinschreibung spielt keine Rolle.
   Absicht: frage true = nur mit Fragezeichen, false = nur ohne; nachfrage true = der Akteur darf eine Rückfrage anhängen;
   muster = regulärer Ausdruck statt Stämmen.
   Platzhalter: {OP} {OFFEN} {GESAMT} {FENSTER} {STANDORT} {ZEIT} {AGENT} {GEGENSTELLE} {LETZTE} {E}
   assetFarbe: je Mission zusätzliche Varianten des lokalen Kontakts; sie werden bevorzugt.
   ===================================================================== */
var DIALOG = {
  verzoegerungSek: { handler: [0, 2], support: [1, 4], asset: [3, 9] },
  nachfrageAbstand: 4,                 /* frühestens nach so vielen Nachrichten wieder eine Rückfrage */
  nachfrageGueltigMin: 15,             /* eine offene Rückfrage verfällt nach so vielen Minuten */

  vorEntitaet: ['gruss', 'danke', 'abschied', 'lob', 'ankuendigung'],   /* Absichten, die eine bloße Namensnennung übertrumpfen (ohne Fragezeichen und Kennung) */

  absichten: [
    { id: 'drohung', muster: '(eliminier\\w*|umbring\\w*|erschie[sß]\\w*|abknall\\w*|fertig ?mach\\w*|kaputt ?mach\\w*|aufschlitz\\w*)[^.!?]*\\b(dich|dir|deinen|deine|deinem|deiner|euch|eure\\w*)\\b|(erledig\\w*|t[oö]te\\w*|killen|kill\\w*|zerst[oö]r\\w*|vernichte\\w*)(\\s+\\w+)?\\s+(dich|euch|deine\\w*|eure\\w*)\\b|(dafür|dafuer)\\s+(zahlst|bezahlst|zahlt|bezahlt|büßt|buesst|büßen|buessen)|ich (schlag|schlage|schieß|schiess)\\b(?![^.!?]*\\bvor\\b)[^.!?]*\\b(dich|dir|euch)\\b|ich (mach|mache)\\s+(dich|euch)(\\s+\\w+)?\\s+(fertig|kaputt|platt|kalt|alle)\\b|ich (bring|bringe)\\b[^.!?]*\\b(dich|euch)\\b\\s+um\\b(?!\\s+\\w+\\s+(uhr|nach|zu|zum|zur|ab|in|an)\\b)(?!\\s+(eins|zwei|drei|vier|fünf|fuenf|sechs|sieben|acht|neun|zehn|elf|zwölf|zwoelf|halb|viertel|\\d))|\\bich (krieg|kriege)\\s+(dich|euch)\\b(?!\\s+(nicht|ans|an|ins|zu|mit|per)\\b)|\\b(dich|euch)\\b[^.!?]*\\b(umbringen|umlegen|kaputt|fertigmachen|erledigen|töten|toeten)\\b|(bring|bringe) ich (dich|euch) um' },
    { id: 'beleidigung', muster: '\\b(du|dich|dir|dein\\w*|ihr|euch)\\b[^.!?]*(arsch|idiot|depp|trottel|wichser|hurensohn|penner|drecksack|versager|dumm|blöd|bloed|inkompetent|nutzlos|erbärmlich|erbaermlich|vollpfosten|stümper|schwachkopf|spast|lappen|hirnlos|witzfigur|amateur)|(arsch|idiot|depp|trottel|wichser|hurensohn|penner|drecksack|versager|vollpfosten|schwachkopf|spast|lappen|witzfigur)[^.!?]*\\b(du|dein\\w*)\\b|\\bsie (sind|waren)\\b[^.!?]*(arsch|idiot|depp|trottel|wichser|hurensohn|penner|drecksack|versager|dumm|blöd|bloed|inkompetent|nutzlos|erbärmlich|erbaermlich|vollpfosten|stümper|schwachkopf|spast|lappen|hirnlos|witzfigur|amateur)|halt (die fresse|den mund|dein maul)|halts maul' },
    { id: 'beschreibung', nurKanal: ['asset'], stamm: ['^beschreib', '^aussehen', '=haarfarbe', '=haare', '=groesse', '=grosse', '=größe', '=herkunft', '=statur', '^merkmal', '^details', '=alter', 'wie sah er', 'wie sah sie', 'wie sah der', 'wie sah die', 'wie sieht er', 'wie sieht sie', 'wie sieht der', 'wie sieht die', 'wie alt war', 'wie gross', 'wie groß', 'was trug', 'trug er', 'trug sie', '=augenfarbe', '^gesichtszug', '^gesichtszüge', '^kleidung', '=akzent', 'hast du eine beschreibung'] },
    { id: 'sauerFrage', stamm: ['bist du sauer', 'bist du genervt', 'bist du wütend', 'bist du wuetend', 'bist du böse', 'bist du boese', 'bist du beleidigt', 'schlecht drauf', '=mimimi', 'habe ich dich verärgert', 'habe ich dich veraergert', 'sind sie sauer', 'sind sie verärgert', 'sind sie veraergert', 'sind sie genervt'] },
    { id: 'wiederBereit', stamm: ['wieder bereit', 'bin wieder bereit', 'bin wieder da', 'ich bin wieder da', 'bin zurück', 'bin zurueck', 'ich bin zurück', 'pause vorbei', 'pause ist vorbei', 'können weitermachen', 'koennen weitermachen', 'machen wir weiter', 'weiter gehts', 'weiter geht s'] },
    { id: 'funkstilleInfo', nurKanal: ['handler', 'support'], muster: '\\b(funkstille|funkruhe|funkpause)\\b.*\\b(kiebitz|asset|kontakt|quelle)\\b|\\b(kiebitz|asset|kontakt|quelle)\\b.*\\b(funkstille|funkruhe|funkpause)\\b' },
    { id: 'kuemmern', stamm: ['ich kümmere mich', 'ich kuemmere mich', 'kümmere mich drum', 'kuemmere mich drum', 'ich übernehme das', 'ich uebernehme das', 'ich regle das', 'ich klär das', 'ich klaer das', 'ich kläre das', 'ich klaere das'] },
    { id: 'hoffnung', stamm: ['das will ich auch hoffen', 'will ich auch hoffen', 'das hoffe ich auch', 'hoffe ich für dich', 'will ich auch hoffen'] },
    { id: 'kenneNicht', stamm: ['kenne ich nicht', 'kenn ich nicht', 'sagt mir nichts', 'nie gehört', 'nie gehoert', 'kein begriff', 'noch nie gehört', 'noch nie gehoert'] },
    { id: 'weisungWach', stamm: ['ohren offen', 'augen offen', 'halt dich bedeckt', 'halte dich bedeckt', 'bleib wachsam', 'bleib vorsichtig', 'sei vorsichtig', 'bleib dran', 'bleib am ball', 'halt die augen', 'halte die augen', 'halte die ohren', 'halt die ohren'] },
    { id: 'ordnung', frage: false, nachfrage: true, stamm: ['!bei mir alles in ordnung', '!bei mir ist alles in ordnung', '!bei mir alles gut', '!bei mir alles okay', '!bei mir alles klar', '!bei mir ist alles gut', '!mir geht es gut', '!mir geht s gut', '!alles in ordnung', '!alles bestens', '!alles im griff', '!alles unter kontrolle'] },
    { id: 'ratfrage', stamm: ['was wuerdest du tun', 'was würdest du tun', 'was raetst du', 'was rätst du', 'was empfiehlst du', 'was schlaegst du vor', 'was schlägst du vor', 'wie siehst du das', 'wie soll ich vorgehen', 'was soll ich tun', 'was soll ich machen'] },
    { id: 'entschuldigung', stamm: ['^entschuldig', '=sorry', 'tut mir leid', 'mein fehler', 'war mein fehler', 'verzeihung'] },
    { id: 'kritikAnGegenstelle', stamm: ['das war falsch', 'das stimmt nicht', 'du irrst', 'du irrst dich', 'das war ein fehler', 'das war unklug', 'das war dumm von dir', 'so geht das nicht', 'du liegst falsch'] },
    { id: 'danke', stamm: ['^dank', '=thx', '=merci', '^thanks', '=tks', '^dankeschön', '^dankeschoen', '^dankbar', 'nett von'], nachfrage: true, nicht: ['brauche hilfe', '^notfall', '^verletz', '=sos', 'dringend'] },
    { id: 'notfall', stamm: ['^notfall', '=sos', '^mayday', '=notruf', 'brauche hilfe', '^hilfe', 'dringend hilfe'] },
    { id: 'verletzt', stamm: ['^verletz', '^verwund', '=blut', '^blutet', '^arzt', '^sanitäter', '^krankenhaus', 'schmerz'] },
    { id: 'gefahr', stamm: ['^gefahr', '^verfolg', '^beschatt', 'wurde beobachtet', 'werde beobachtet', 'bin beobachtet', 'beobachtet mich', 'beobachten mich', 'aufgeflogen', '^kompromittiert', '^enttarnt', '^entdeckt', '^verdächtig', '^verdaechtig', '^bedroh', 'folgt mir', 'wurde erkannt', '^gegenobs', '^verfolger', 'hinter mir', 'fährt mit', 'faehrt mit', '^beschattung', '^gegenobservation', 'mir folgt', 'folgt jemand', 'verfolgt mich', 'unbekanntes auto', '!das ich nicht kenne', '!kenne ich nicht'] },
    { id: 'wiederholen', stamm: ['!^wiederhol', '!nochmal', '!noch mal', '!noch einmal', '!nicht verstanden', '!verstehe nicht', '!bitte was', '!wie bitte', '!was war das', '!was meinst du damit'] },
    { id: 'entitaet', muster: '\\b[POL]-\\d{4}\\b' },
    { id: 'befinden', stamm: ['bist du bereit', 'bist du einsatzbereit', 'bist du fit', 'seid ihr bereit', 'sind sie bereit', 'sind sie einsatzbereit', '=einsatzbereit', '=einsatzbereitschaft', 'wie fühlst', 'wie fuehlst'], nicht: ['p-0', 'p-9', 'o-9', 'l-9'] },
    { id: 'standort', stamm: ['wo bist', 'wo seid', 'wo sind sie', 'wo bin ich', 'wo genau', 'wo soll ich', '^wo ^befind', 'wo steckst', 'wo stehst', 'wo hältst', 'wo haeltst', 'dein standort', 'deine position', 'ihr standort', 'ihre position', '=standort'] },
    { id: 'zeit', stamm: ['wie spät', 'wie spaet', 'wie viel uhr', 'wieviel uhr', '^uhrzeit', 'welche uhrzeit'] },
    { id: 'beruhigung', stamm: ['keine sorge', 'keine sorgen', 'mach dir keine', 'ganz ruhig', 'bleib ruhig', 'bleiben sie ruhig', 'ruhig bleiben', 'atme durch', 'durchatmen', 'du schaffst das', 'wir schaffen das', 'ich bin bei dir', '^entspann', 'nimm dir zeit', 'kein stress', 'kein druck', 'kein grund zur', 'alles wird gut', 'es wird gut', 'beruhig dich', 'beruhige dich'] },
    { id: 'atempause', nurKanal: ['handler'], stamm: ['brauche eine pause', 'brauche kurz eine pause', 'brauche pause', 'brauche kurz pause', 'kurze pause', 'kurz pause', 'muss kurz durchatmen', 'muss durchatmen', '^atempause', 'brauche kurz ruhe', 'brauche ruhe', 'bin am limit', 'bin erschöpft', 'bin erschoepft', 'bin überlastet', 'bin ueberlastet', 'bin gestresst', 'zu viel stress'] },
    { id: 'funkruhe', nurKanal: ['asset'], stamm: ['melde mich nicht', 'schreibe dir nicht', 'schreib dir nicht', 'melde dich wenn', 'melde dich, wenn', 'erst wieder', '^funkruhe', '^funkstille', 'funkstille für', 'funkstille fuer', 'keine nachrichten mehr', 'lasse dich in ruhe', 'lass dich in ruhe', 'ich schreibe nicht mehr', 'ich schreib nicht mehr', 'ich mache pause', 'ich mache eine pause', 'mache jetzt eine pause', 'mache jetzt pause', 'jetzt eine pause', 'ich mache kurz pause', 'ich brauche eine pause', 'ich muss mich beruhigen', 'ich muss runterkommen', 'machen wir pause', 'wir pausieren', 'lass uns pausieren', 'ich mache erstmal etwas anderes', 'ich mache etwas anderes'] },
    { id: 'angekommen', muster: '^\\s*(vor ort|auf position|position bezogen)' },
    { id: 'angekommen', stamm: ['^angekommen', '^eingetroffen', '^erreicht', '^bezogen', '^übernommen', '^uebernommen', 'bin vor ort', 'bin da', 'auf position', 'position bezogen', 'stehe am', 'stehe vor', 'am treffpunkt', '^positioniert', 'bin am treffpunkt', 'bin auf position'], nachfrage: true },
    { id: 'beobachtung', stamm: ['ich sehe', 'ich beobachte', '^sichtung', '^verlässt', '^verlaesst', '^betritt', 'kommt raus', 'kommt an', '^abfahrt', 'fährt ab', 'faehrt ab', 'steigt ein', 'steigt aus', 'geht rein', 'geht raus', 'fährt vom', 'faehrt vom', 'steht vor', 'kommt raus', '^kennzeichen notiert', 'zwei personen', 'einer raucht', 'der mann', 'die frau', 'zwei männer', 'zwei maenner', 'eine person', 'hatte eine', 'trug eine', 'trägt eine', 'traegt eine', '^narbe', 'steht seit', '^insassen', 'hinter dem tor', '^kennzeichen', '^beobachtet', 'da war', 'da kommt', 'gerade ein', 'eben ein', '^vorhin', 'was gesehen', 'ich seh da', 'ich seh einen', 'ich seh eine', 'komischen typen', 'komische person', 'ein wagen am', 'ein auto am'] },
    { id: 'treffen', stamm: ['^treff', '^übergabe', '^uebergabe', '^termin', '^verabred', 'wann sehen wir'] },
    { id: 'geldMehr', stamm: ['mehrbedarf', 'erweiterung des budgets', 'budget erweitern', 'budget erweiterung', 'budgeterweiterung', 'budget aufstocken', 'aufstockung', 'unvorhergesehene kosten', 'zusätzliche kosten', 'zusaetzliche kosten', 'mehr budget', 'mehr geld', '^nachschuss', '^zusatzkosten'] },
    { id: 'geld', stamm: ['^geld', '^bezahl', '^zahlung', '^budget', '^spesen', '^honorar', '^vergütung', '^verguetung', '^lohn', '^kohle', '^zahlt', '^zahle', '=zahlen', '^bargeld', '^spesen', '^abrechn', 'wer zahlt'] },
    { id: 'fahrzeug', stamm: ['^fahrzeug', '^auto', '^wagen', '^mietwagen', '^kennzeichen', '^tanken', '^reifen', 'ersatzfahrzeug', '^kfz', '^pkw', '^transporter'] },
    { id: 'technik', stamm: ['^ausrüstung', '^ausruestung', '^kamera', '^funkgerät', '^funkgeraet', '^handy', '^akku', '^telefon', '^laptop', '^ersatz', '^technik', '^gerät', '^geraet', '^batterie'] },
    { id: 'unterkunft', stamm: ['^unterkunft', '^wohnung', '^hotel', '^zimmer', '^schlafen', '^quartier', '^übernacht', '^uebernacht', '^bett', 'wo schlafe', 'wo übernachte', 'wo uebernachte', '^schlafplatz', '^hotel'] },
    { id: 'auftrag', stamm: ['^auftrag', '^mission', '^briefing', 'was soll ich', 'was tun', 'wie weiter', 'nächster schritt', 'naechster schritt', '^weisung', '^anweisung', 'weiter', '^was nun', 'und jetzt', 'wie weiter', 'was steht', 'steht heute an', 'steht an', '^losfahren', 'wann fange', 'wann soll ich', 'wohin muss', 'wohin soll', 'wohin geht', '^zeitplan', 'sieht der zeitplan', 'der plan', '^plan '] },
    { id: 'verstaerkungBedarf', stamm: ['^verstärk', '^verstaerk', '^unterstütz', '^unterstuetz', 'leute vor ort', 'jemanden schicken', 'team schicken', 'jemand schicken', '^verstärkung'], frage: true },
    { id: 'unterstuetzung', stamm: ['schicke dir unterstützung', 'schicke dir unterstuetzung', 'schicke dir verstärkung', 'schicke dir verstaerkung', 'schicke dir hilfe', 'ich schicke dir leute', 'schicke dir jemanden', 'unterstützung kommt', 'unterstuetzung kommt', 'verstärkung kommt', 'verstaerkung kommt', 'schicke unterstützung', 'schicke verstärkung', 'keine details', 'schicken dir unterstützung'] },
    { id: 'neuigkeiten', stamm: ['aktueller stand', 'dein stand', 'ihr stand', 'stand der dinge', 'wie ist der stand', '^aktuell ^info', '^neue ^info', '^neuigkeit', 'was gibt es neues', 'gibt es neues', 'etwas neues', 'was neues', 'gibt es was', 'aktuelle lage', 'was tut sich', 'was ist los', 'nichts neues', 'neues im', '^auffälliges', '^auffaelliges', 'irgendwas', 'irgendetwas', 'tut sich was', '^besonderheit', 'ist es ruhig', 'ist alles ruhig', 'alles ruhig'], frage: true },
    { id: 'abschied', muster: '^\\s*(ende|over and out|schönen (abend|tag|feierabend)|schoenen (abend|tag|feierabend))\\W*$' },
    { id: 'abschied', stamm: ['^gute nacht', '^schönen abend', '^schoenen abend', '^tschüss', '^tschuess', '^ciao', 'bis später', 'bis spaeter', 'bis dann', 'melde mich ab', '=out', '=over', 'bis morgen', 'bis bald', 'bis dann', 'melde mich später', 'melde mich spaeter', 'over and out', 'bis später', 'bis spaeter', 'mal weg', 'bis die tage', '=tschö', '=ciao', '=tschau', 'bis denn', '^tschüss', '^tschuess'] },
    { id: 'ablehnung', stamm: ['^weigere', '^lehne ab', 'lehne es ab', 'mach ich nicht', 'tue ich nicht', 'nicht mit mir', '^verweigere', '!mache ich nicht', '!mach ich nicht', '!mach das nicht', '!tue das nicht', '!werde ich nicht', '!das nicht', '!ich mache das nicht', '!mache das nicht', '!mach das nicht', 'lehne ich ab', '^lehne'] },
    { id: 'ankuendigung', stamm: ['^beginne', '^beginn jetzt', '^starte', 'fange an', 'mache jetzt', 'gehe jetzt', 'fahre jetzt', 'ich fahre', 'ich gehe', 'ich werde', 'als nächstes', 'als naechstes', 'ich melde mich', 'ich mache', 'ich schaue', 'ich prüfe', 'ich pruefe', 'ich kümmere', 'ich kuemmere', '^rücke', '^ruecke', '=abrücken', '=abruecken', 'gehe jetzt rein', '^starte', 'nähere mich', 'naehere mich'], frage: false },
    { id: 'ruhig', stamm: ['!alles ruhig', '!nichts besonderes', '!keine besonderheiten', '!keine auffälligkeiten', '!keine auffaelligkeiten', '!alles normal', '!kein problem', '!keine probleme', '=ruhig', '!nichts auffälliges', '!nichts auffaelliges', '!keine besonderen', '!^vorkommnis', '!nichts zu melden', '!nichts zu berichten', '!grünen bereich', '!gruenen bereich', '!lage unverändert', '!lage unveraendert', '!tut sich nix', '!tut sich nichts', '!tut sich gar nix', '!tut sich gar nichts', '!passiert nichts', '!passiert nix'], nachfrage: true },
    { id: 'problem', stamm: ['^problem', '^schwierig', 'geht schief', 'klappt nicht', '^fehler', '^panne', '=ausfall', '=ausfälle', '=ausfaelle', '=ausgefallen', '^defekt', 'funktioniert nicht', 'geht nicht'] },
    { id: 'dringend', stamm: ['^dringend', '^eilig', '=schnell', '=sofort', '^zügig', '^zuegig', '=asap', '^eilt', '=eilig', '=asap'] },
    { id: 'warten', stamm: ['^warte', '^moment', '=gleich', '^augenblick', '=sekunde', 'einen moment', 'fünf minuten', 'fuenf minuten', '5 minuten', '^minuten', 'gib mir ', '=wate'] },
    { id: 'zweifel', stamm: ['^angst', '^nervös', '^nervoes', '^sorge', '^unsicher', '^mulmig', '^zweifel', '^zweifle', '^bedenken', 'schlechtes gefühl', 'schlechtes gefuehl', 'schlechtes bauchgefühl', 'nicht wohl', 'nicht geheuer', '^bauchgefühl', '^bauchgefuehl', 'habe angst', '^ängstlich', '^aengstlich', '^beunruhigt', '^unruhig', '^misstrau', 'traue ich nicht', 'traue nicht'] },
    { id: 'frust', stamm: ['^scheiß', '^scheiss', '=mist', '^verdammt', '=fuck', '^genervt', '^idiot', '^dumm', '^wütend', '^wuetend', '^kotzt', '^sauer', 'schnauze voll', 'zum kotzen', '^kotzen', 'reicht mir', '^nervt', '^satt', 'keine lust mehr', 'es reicht'] },
    { id: 'lob', stamm: ['^gut gemacht', '^super', '^prima', '^perfekt', '^klasse', '^bravo', '^hervorragend', 'war stark', 'das war gut', '=stark', '^stark', '^respekt'] },
    { id: 'humor', stamm: ['^haha', '^lol', '^witz', '^lustig'] },
    { id: 'privat', stamm: ['^familie', '^freund', '^zuhause', '^privat', '^verheiratet', '^kinder', 'wer bist du', 'wer sind sie', 'wie heißt', 'wie heisst', 'dein name', 'ihr name', '^vorname', 'wie alt', 'woher kommst', 'woher kommen'] },
    { id: 'test', stamm: ['^testnachricht', '=test', '^empfang', 'hört mich', 'hoert mich', 'lese ich', 'lesen sie mich', 'kannst du mich', 'können sie mich', 'koennen sie mich', '=hörst', '=hoerst', '^funkcheck', '^kanaltest', '^funktest', '^soundcheck', 'hört mich jemand', 'hoert mich jemand', 'eins zwei'] },
    { id: 'sicherheit', stamm: ['^verschlüssel', '^verschluessel', '^abgehört', '^abgehoert', '^abhör', '^abhoer', '^schlüssel', '^schluessel', '^kanal', '^mitgelesen', '^überwach', '^ueberwach', '^wanze', 'sind wir sicher', 'sicher hier'] },
    { id: 'tagesfrage', stamm: ['wie war dein tag', 'wie war ihr tag', 'wie war die nacht', 'was machst du gerade', 'was machst du so', 'was treibst du', 'was machen sie gerade', 'was machst du heute', 'was hast du heute gemacht', 'schon feierabend'] },
    { id: 'essen', stamm: ['^essen', '^mittagessen', '^abendessen', '^frühstück', '^fruehstueck', '^döner', '^doener', '^pizza', '=kochen', '^restaurant', '^imbiss', 'schon gegessen', 'hast du gegessen', 'was gab es zu essen'] },
    { id: 'tier', stamm: ['^hund', '^hunde', '^katze', '^katzen', '^haustier', '^haustiere', '^tiere'] },
    { id: 'sport', stamm: ['^sport', '^tennis', '^joggen', '^training', '^fitness', '^fußball', '^fussball', '^laufen', '^schwimmen'] },
    { id: 'nachrichtenlage', stamm: ['=news', '^politik', '^zeitung', '^tagesschau', '^radio'] },
    { id: 'koerper', stamm: ['^müde', '^muede', '^pause', '^schlaf', '^hunger', '^durst', '^kaffee', '^erschöpf', '^erschoepf', '^kopfschmerz', 'mir ist schlecht', 'mir ist übel', 'mir ist uebel', 'mir ist kalt', 'mir ist heiß', 'mir ist heiss', 'gegessen', '^essen', '^mittag', '^frühstück', '^fruehstueck'] },
    { id: 'wiegehts', stamm: ['wie geht', 'wie läufts', 'wie laeufts', 'alles klar', 'alles gut', '=klar', 'wie gehts', 'wie geht s', 'alles fit', 'alles bereit', 'geht es dir', 'geht es ihnen', 'geht s dir', 'geht dir', '=stimmung', 'wie läuft s', 'wie laeuft s', 'wie ist es bei dir', 'wie sieht s aus', 'wie sieht es aus', 'was geht'], frage: true, nachfrage: true },
    { id: 'meinung', stamm: ['was denkst', 'was meinst', 'deine meinung', 'ihre meinung', 'glaubst du', 'glauben sie', 'wie siehst', 'wie sehen sie', 'was hältst', 'was haelst', '^hältst', '^haeltst', 'für riskant', 'fuer riskant', 'für sicher', 'fuer sicher', 'für klug', 'fuer klug', 'meinst du'] },
    { id: 'smalltalk', stamm: ['^wochenende', '^urlaub', '^kino', '^musik', '^film', '^serie', '^feierabend', '^hobby', '^hobbys', '^freizeit', '^lieblings', '^ferien', '^geburtstag', '^weihnacht', '^feiertag', '^ostern', '^party', '^bier', '^wein', '^grillen', '^spiel', '^spiele', '^buch', '^bücher', '^buecher'] },
    { id: 'wetter', stamm: ['^wetter', '^regnet', '=regen', '^nebel', '^sturm', '^kalt', '^heiß', '^heiss', 'temperatur'] },
    { id: 'bestaetigtDurch', stamm: ['bestätigt durch', 'bestaetigt durch', 'bestätigt von', 'bestaetigt von', 'bestätigung durch', 'bestaetigung durch', 'bestätigt vom', 'bestaetigt vom'] },
    { id: 'empfang', stamm: ['^bestätig', '^bestaetig', 'empfang bestätigt', 'empfang bestaetigt', '=empfangen', '=notiert', 'laut und deutlich', 'lese sie'] },
    { id: 'anwesend', stamm: ['=ping', '^antworte', 'melde dich', 'bist du online', 'bist du erreichbar', 'ist jemand erreichbar', '=erreichbar', 'hörst du mich', 'hoerst du mich', 'kannst du lesen', 'dich kurz melden', 'kurz melden', 'gib mal ein lebenszeichen', 'kannst du dich melden'] },
    { id: 'anwesend', stamm: ['bist du da', 'seid ihr da', 'sind sie da', 'jemand da', 'noch da', '=da', '=ping'], frage: true },
    { id: 'gruss', stamm: ['^halo', '^hallo', '^moin', '^servus', '=hi', '=hey', '^grüß', '^gruess', '^gruss', 'guten morgen', 'guten tag', 'guten abend', '^tach'], nachfrage: true },
    { id: 'bestaetigung', stamm: ['=ok', '=okay', '=ja', '^verstanden', '=roger', '=klar', '=jawohl', '=gut', 'alles klar', '=verstehe', '^verstehe', '=einverstanden', '=passt', '=kopiert', '=wilco', 'copy that', '=copy', '=jo', '=jep', '=jawoll', '=jawohl', 'mach ich', '=klar'], nachfrage: true },
    { id: 'verneinung', stamm: ['!auf keinen fall', '=nein', '=nö', '=noe', '=nope', '^negativ', '!nicht möglich'] }
  ],

  antworten: {
    bestaetigtDurch: {
      handler: ['Verstanden und hinterlegt.', 'Notiert und hinterlegt.', 'Verstanden. Ist hinterlegt.', 'Botschaft angekommen, ist hinterlegt.', 'Hab ich gecheckt, liegt in der Akte.'],
      support: ['Notiert und hinterlegt.', 'Verstanden, wir haben es hinterlegt.'],
      asset: ['Gut. Dann ist das geklärt.', 'Okay, das reicht mir.']
    },
    verstaerkungBedarf: {
      handler: ['Verstärkung möglich bei Bedarf, ich entscheide im Einzelfall. Antrag über das Formular im Bereich Verstärkung, mit Begründung.', 'Verstärkung ist möglich, aber nur im Einzelfall und nur mit Anlass, Ort und Zeitraum.', 'Bedarf an Kräften meldest du über das Formular im Bereich Verstärkung, mit Begründung.'],
      support: ['Verstärkung nur über ARGUS.', 'Kräfte fordert der Ansprechpartner an. Bei uns liegt nur die Logistik.', 'Das entscheidet nicht das Support Element, sondern der Ansprechpartner.'],
      asset: ['Verstärkung? Hier? Bitte nicht, das fällt auf.', 'Ich brauche niemanden. Je weniger Leute, desto besser.']
    },
    drohung: {
      handler: ['Das war eine Drohung. Sie ist protokolliert. Weitere Verstöße haben dienstliche Folgen.', 'Ich vermerke das und gebe es an die Vorgesetzten weiter.', 'Eine Drohung über diesen Kanal. Das nehme ich nicht hin.'],
      support: ['Das nehmen wir nicht hin. Es geht ins Protokoll.', 'Drohungen beantworten wir nicht, wir melden sie.'],
      asset: ['Wie bitte? Droh mir nicht. Ich melde mich nicht mehr, bis du dich entschuldigt hast.', 'Was soll das? Ich habe dir nichts getan. Ich ziehe mich zurück.', 'Damit ist der Kontakt für mich beendet.', 'Droh mir nicht. Ich kenn meinen Platz.', 'Das werde ich nicht. Lass es gut sein.', 'Botschaft angekommen. Ich muss weitermachen.']
    },
    beleidigung: {
      handler: ['Sachlicher Ton, bitte. Das ist ein dienstlicher Kanal.', 'Beleidigungen helfen nicht. Sachlich bleiben.'],
      support: ['Wir bitten um einen sachlichen Ton.', 'So kommen wir nicht weiter. Bitte sachlich.'],
      asset: ['So nicht. Das Risiko trage ich hier, nicht du.', 'Lass das. Ich mache das nicht zum Spaß.', 'Ich schreibe erst wieder, wenn der Ton stimmt.']
    },
    beschreibung: {
      handler: ['Aussehen steht, soweit bekannt, im Dossier. Was KIEBITZ gesehen hat, frag direkt dort nach.', 'Beschreibungen kommen von der Quelle vor Ort. Mir liegt nur vor, was im Dossier steht.'],
      support: ['Die Beschreibung muss von vor Ort kommen. Wir haben nur die Unterlagen.', 'Dazu liegt nichts vor. Frag KIEBITZ oder sichte selbst.'],
      asset: ['Wen meinst du genau? Ich hab gerade niemanden vor Augen.', 'Beschreiben kann ich nur, was ich selbst gesehen habe. Wen meinst du?']
    },
    ratfrage: {
      handler: ['Entscheiden musst du. Ich sage dir, was ich sehe: Abstand halten, Meldefenster einhalten, nichts erzwingen.', 'Ohne mehr Belege rate ich zur Zurückhaltung. Die Entscheidung bleibt bei dir.', 'Vorsichtig bleiben und Erkenntnisse sammeln. Handeln, wenn es belegbar ist, nicht vorher.'],
      support: ['Fachlich können wir Ihnen die Optionen zeigen. Entscheiden muss der Ansprechpartner.', 'Aus technischer Sicht ist der leise Weg der sichere. Weiter reicht unsere Einschätzung nicht.'],
      asset: ['Ehrlich? Ich würde nichts überstürzen. Hier fällt jeder Fehler sofort auf.', 'Das musst du wissen. Mir ist wichtig, dass es mich nicht trifft.', 'Wenn es nach mir geht: abwarten und beobachten.']
    },
    entschuldigung: {
      handler: ['Vermerkt. Machen wir weiter.', 'Schon gut. Weiter mit dem Sachverhalt.', 'Angenommen. Zurück zur Sache.'],
      support: ['Kein Problem. Was brauchen Sie?', 'Schon erledigt, wir machen weiter.'],
      asset: ['Schon gut. Lass uns nicht zu lange darüber reden.', 'Ist okay. Machen wir weiter.', 'Lassen wir das. Zurück zur Sache.']
    },
    kritikAnGegenstelle: {
      handler: ['Das nehme ich zur Kenntnis. Nenn mir den Punkt, dann sehe ich ihn mir an.', 'Möglich. Belege es, dann korrigiere ich es.', 'Ich korrigiere, wenn du es konkret machst. Was genau war falsch?'],
      support: ['Das tut uns leid. Nennen Sie uns bitte den Vorgang, wir prüfen ihn.', 'Verstanden. Schildern Sie kurz, was nicht gestimmt hat.'],
      asset: ['Dann sag mir, was ich falsch gemacht habe. Ich war vorsichtig.', 'Das mag sein. Ich arbeite hier unter Druck, vergiss das nicht.', 'Kann sein. Sag mir konkret, was du meinst.']
    },
    beruhigung: {
      handler: ['Ich bin ruhig. Danke. Weiter nach Plan.', 'Verstanden. Ich bleibe beim Plan.', 'Das nehme ich auf. Weiter.'],
      support: ['Danke, bei uns ist alles im Rahmen.', 'Wir sind ruhig. Was brauchen Sie?'],
      asset: ['Danke. Ich versuche ruhig zu bleiben.', 'Ja. Es hilft, dass du das sagst.', 'Okay. Ich melde mich, wenn ich etwas habe.', 'Danke. Ich brauche nur einen Moment.']
    },
    atempause: {
      handler: ['Verstanden. Zehn Minuten Ruhe, ich melde mich nicht. Danach weiter.', 'Gut, nimm sie dir. Ich halte den Kanal still.', 'In Ordnung, kurze Pause. Danach melde dich.', 'Botschaft angekommen. Ich bin raus, bis du dich meldest.'],
      support: ['Verstanden, wir melden uns erst wieder, wenn Sie sich melden.'],
      asset: ['Mach das. Ich bin ohnehin vorsichtig.']
    },
    funkruhe: {
      handler: ['Verstanden.'],
      support: ['Verstanden.'],
      asset: ['Verstanden.', 'Alles klar.', 'Botschaft angekommen.', 'Verstanden. Ich habs gecheckt.']
    },
    wiederBereit: {
      handler: ['Alles klar. Kanal ist wieder offen.', 'Gut, dann weiter.', 'Botschaft angekommen. Wir machen da weiter, wo wir waren.'],
      support: ['Verstanden. Wir sind wieder erreichbar.', 'Gut, dann weiter.', 'Botschaft angekommen.'],
      asset: ['Okay, dann weiter.', 'Alles klar.', 'Gut. Ich bin dran.']
    },
    funkstilleInfo: {
      handler: ['Verstanden. Melde dich danach.', 'Alles klar. Melde dich, wenn die Funkstille vorbei ist.', 'Gut, ich notiere es. Meldung danach.'],
      support: ['Verstanden, wir warten auf Ihre Meldung danach.', 'Notiert. Melden Sie sich danach.'],
      asset: ['Verstanden.']
    },
    kuemmern: {
      handler: ['Verstanden. Melde dich danach.', 'Gut. Gib Bescheid, wenn es erledigt ist.', 'Alles klar. Ich warte auf deine Meldung.'],
      support: ['Verstanden, wir warten auf Ihre Rückmeldung.', 'Gut. Melden Sie sich, wenn es erledigt ist.'],
      asset: ['Okay.', 'Alles klar.']
    },
    hoffnung: {
      handler: ['Botschaft angekommen.', 'Läuft.'],
      support: ['Botschaft angekommen.', 'Verstanden.'],
      asset: ['Botschaft angekommen. Ich muss weitermachen.', 'Botschaft angekommen.', 'Ich kenn meinen Platz.', 'Hab ich gecheckt.']
    },
    sauerFrage: {
      handler: ['Meine Verfassung ist nicht Gegenstand dieses Kanals. Was liegt an?', 'Nein. Sachlich bleiben gilt für beide Seiten.', 'Sauer bin ich nicht. Ungeduldig, wenn Meldungen ausbleiben.'],
      support: ['Nein, alles gut bei uns. Was brauchen Sie?', 'Sauer nicht. Aber wir haben noch mehr auf dem Tisch als Ihre Anfrage.', 'Nein. Was können wir tun?'],
      asset: ['Nein, aber bitte hör auf zu schreiben.', 'Hör auf mich zu nerven. Ich melde mich, wenn es etwas gibt.', 'Sauer nicht. Nervös. Und jede Nachricht macht es nicht besser.']
    },
    kenneNicht: {
      handler: ['Notiert. Der Name bleibt offen, bis mehr vorliegt.', 'Verstanden. Wir klären das, sobald es etwas Belastbares gibt.'],
      support: ['Notiert. Wir prüfen, ob sich dazu etwas finden lässt.', 'Verstanden. Wir sehen nach.'],
      asset: ['Okay. Ich halte die Ohren offen.', 'Verstanden. Wenn ich mehr höre, sage ich Bescheid.', 'Alles klar. Ich bleibe dran, aber auffällig frage ich nicht.']
    },
    weisungWach: {
      handler: ['Verstanden. Bei Änderung sofort melden.', 'Notiert. Wachsam bleiben, Meldefenster einhalten.', 'Gecheckt. Augen auf, sag sofort Bescheid, wenn sich was tut.'],
      support: ['Verstanden, wir bleiben dran.', 'Notiert. Bei Änderung melden wir uns.'],
      asset: ['Okay, ich halte mich bedeckt.', 'Mach ich. Ich höre mich um, ohne nachzufragen.', 'Verstanden. Ich bleibe vorsichtig und melde mich, wenn ich etwas höre.']
    },
    ordnung: {
      handler: ['Alles klar.', 'Verstanden. Weiter wie besprochen.', 'Gut. Meldefenster einhalten.', 'Läuft. Bleib am Ball.', 'Gecheckt. Weiter wie gehabt.'],
      support: ['Gut. Wir bleiben bereit.', 'Alles klar, danke.'],
      asset: ['Gut. Dann bleib dabei.', 'Hier auch alles klar.', 'Freut mich. Bleib trotzdem aufmerksam.']
    },
    tagesfrage: {
      handler: ['Arbeitsreich. Gibt es etwas zum Einsatz?', 'Arbeitsreich. Mehr gibt es dazu nicht zu sagen.', 'Lang. Weiter im Text.'],
      support: ['Mal ruhig, mal geschäftig, wie immer. Und bei Ihnen?', 'Lang. Aber wir sind da. Was brauchen Sie?', 'Es geht. Viel Telefon, wenig Schlaf.'],
      asset: ['Reifen, Bremsen, Kundschaft. Und so tun, als wäre nichts.', 'Lang. In der Werkstatt ist immer was. Und bei dir?', 'Wie jeder Tag hier. Man gewöhnt sich daran, leichter wird es nicht.']
    },
    essen: {
      handler: ['Essen ist keine Dienstangelegenheit. Hauptsache, du bleibst leistungsfähig.', 'Dazu keine Angaben.'],
      support: ['Hoffentlich haben Sie etwas Warmes bekommen. Sonst melden Sie Bedarf an.', 'Bei uns gibt es Kaffee und eine Mikrowelle. Mehr Luxus nicht.'],
      asset: ['Beim Imbiss an der Ecke gibt es Döner, der hält einen am Leben.', 'Mittags gab es Currywurst vom Wagen. Mehr Zeit hatte ich nicht.', 'Ich hatte seit heute früh nur Kaffee. Der Chef lässt wenig Pausen.']
    },
    tier: {
      handler: ['Das gehört nicht in diesen Kanal.', 'Kein Thema für den Dienst.'],
      support: ['Nett gemeint, aber wir bleiben beim Einsatz.', 'Später gern. Jetzt zählt die Lage.'],
      asset: ['Der Hund vom Nachbarn bellt nachts bei jedem Wagen. Besser als eine Alarmanlage.', 'Streunerkatzen im Hof. Die hören alles. Mehr Tiere kenne ich hier nicht.', 'Nein, keine Tiere. Dafür hätte ich keine Zeit.']
    },
    sport: {
      handler: ['Sport ist Privatsache. Für den Einsatz zählt, dass du fit bist.', 'Dazu keine Angaben.'],
      support: ['Wer Sport macht, hat es leichter. Aber hier zählt der Einsatz.', 'Gerne später. Jetzt zählt die Lage.'],
      asset: ['Fußball läuft hier nebenbei im Radio, mehr nicht. Warum fragst du?', 'Wenn ich Zeit hätte, würde ich laufen gehen. Habe ich aber nicht.', 'Ich schaue manchmal mit den Kollegen, mehr nicht.']
    },
    nachrichtenlage: {
      handler: ['Zeitung lesen ist nicht dein Auftrag. Beobachte, was vor Ort passiert.', 'Dazu keine Angaben.'],
      support: ['Was in den Medien steht, ist für den Einsatz meist unerheblich.', 'Wir bleiben bei den Unterlagen.'],
      asset: ['Ich lese kaum Zeitung. Hier erfährt man mehr, wenn man im Hof steht.', 'Im Radio läuft hier nur Schlager. Neues erfahre ich im Hof.', 'Nachrichten sind mir egal. Was hier gesprochen wird, zählt.']
    },
    befinden: {
      handler: ['Einsatzbereit. Konzentrier dich auf deinen Teil.', 'Hier läuft alles. Dein Zustand zählt, nicht meiner.', 'Stabil. Wie sieht es bei dir aus?'],
      support: ['Bei uns ist alles bereit. Und bei Ihnen?', 'Einsatzbereit. Was brauchen Sie?'],
      asset: ['Geht so. Ich halte durch. Und du?', 'Ich bin da. Gut fühlt sich anders an, aber es geht.', 'Alles in Ordnung soweit. Ich bleibe wachsam.']
    },
    neuigkeiten: {
      handler: ['Aktuell nichts Neues von mir. Meldungen kommen, sobald sich etwas ändert.', 'Keine neuen Erkenntnisse. Du bekommst es, wenn sich die Lage verschiebt.'],
      support: ['Bei uns nichts Neues. Wir melden uns bei Änderungen.', 'Keine neuen Erkenntnisse aus der Auswertung.'],
      asset: ['Nichts Neues. Abends kommen zwei, drei Wagen, wie immer.', 'Bisher ruhig. Wenn sich etwas tut, schreibe ich.', 'Nichts, was ich dir schicken würde. Ich halte die Augen offen.']
    },
    unterstuetzung: {
      handler: ['Verstärkung läuft über das Formular im Bereich Verstärkung, nicht über den Kanal.', 'Anforderungen bitte über das Formular im Bereich Verstärkung.'],
      support: ['Kräfte fordert der Ansprechpartner an. Wir vermerken nichts.', 'Dafür ist der Ansprechpartner zuständig.'],
      asset: ['Verstanden. Keine Details, ich frage nicht. Ich erkenne die Leute woran?', 'Okay. Ich will nichts wissen. Nur dass es kein Ärger wird.', 'Gut. Je weniger ich weiß, desto besser. Ich halte still.']
    },
    ankuendigung: {
      handler: ['Okay. Meld dich, wenn es durch ist.', 'Verstanden. Halt mich auf dem Laufenden.', 'Gut. Bei Auffälligkeiten sofort melden, nicht erst am Ende.', 'Alles klar. Ich bin erreichbar.'],
      support: ['Notiert. Sagen Sie Bescheid, wenn Sie etwas brauchen.', 'Verstanden. Wir bleiben auf Bereitschaft.', 'Gut. Melden Sie sich, wenn sich etwas ändert.'],
      asset: ['Gut. Ich bleibe erreichbar.', 'Okay. Gib mir Bescheid, wenn du dort bist.', 'In Ordnung. Ich halte die Augen offen.']
    },
    notfall: {
      handler: ['Notfall verstanden. Lage und Ort in einer Zeile. Rückholung läuft nur über Modul 5.', 'Ruhig bleiben. Ort, Lage, Zahl der Personen. Dann Entscheidung.', 'Verstanden. Ort und Zustand melden, nichts anderes.'],
      support: ['Bereitschaft wird verstärkt. Ort und Zustand melden.', 'Fahrzeug und Unterkunft stehen. Wohin?', 'Wir sind bereit. Ohne Ortsangabe können wir nichts tun.'],
      asset: ['Was ist los? Ich kann hier nichts tun.', 'Ich kann nicht helfen. Ruf den Ansprechpartner.', 'Das ist zu gefährlich für mich. Ich halte mich raus.']
    },
    verletzt: {
      handler: ['Zustand melden. Medizinische Hilfe nur über das Support Element.', 'Wie schwer? Ort und Zustand in einer Zeile.', 'Verstanden. Grundausstattung nutzen, Meldung zum nächsten Fenster.'],
      support: ['Medizinische Grundausstattung vorhanden? Standort nennen.', 'Wir organisieren Hilfe, aber nicht über den Notruf des Teams. Standort?', 'Wie schwer? Ohne Angaben können wir nichts planen.'],
      asset: ['Einen Arzt kann ich nicht rufen. Das fällt auf.', 'Verletzt? Hier nicht. Ich kenne niemanden.', 'Das tut mir leid, aber ich kann nichts tun.']
    },
    gefahr: {
      handler: ['Ruhe bewahren. Ort, Lage, Zahl der Personen. Abbruchkriterium prüfen.', 'Verstanden. Nicht reagieren, Route ändern, Meldung zum nächsten Fenster.', 'Lage in einer Zeile melden. Rückholung läuft nur über Modul 5.'],
      support: ['Übergabepunkt und Ausweichunterkunft bereit. Wohin?', 'Verstanden. Wir halten das Fahrzeug bereit.', 'Wir sind auf Bereitschaft. Melden Sie den Ort.'],
      asset: ['Ich habe nichts bemerkt. Aber vorsichtig bleiben.', 'Das macht mir Angst. Bitte nichts schreiben, was auffällt.', 'Hier ist alles ruhig.']
    },
    wiederholen: {
      handler: ['Ich wiederhole: {LETZTE}', 'Zum Mitschreiben: {LETZTE}', 'Noch einmal: {LETZTE}'],
      support: ['Wiederhole: {LETZTE}', 'Gern noch einmal: {LETZTE}', 'Zur Sicherheit: {LETZTE}'],
      asset: ['Ich habe geschrieben: {LETZTE}', 'Noch mal: {LETZTE}', 'Also: {LETZTE}']
    },
    wiederholenOhne: {
      handler: ['Von mir liegt nichts Offenes vor. Was soll ich wiederholen?', 'Es gibt nichts zu wiederholen. Worauf bezieht sich die Frage?'],
      support: ['Bei uns liegt nichts Offenes vor. Was meinen Sie?', 'Wir haben nichts Neues geschickt. Was soll ich wiederholen?'],
      asset: ['Ich habe nichts geschrieben. Was soll ich wiederholen?', 'Wiederholen? Es war doch nichts.']
    },
    entitaet: {
      handler: ['Zu {E}: Dossier im Modul 3. Neue Erkenntnisse bitte melden.', '{E} ist im Dossier hinterlegt. Weitere Beobachtungen ergänzen.', 'Zu {E} liegt der Stand im Modul 3. Was ist neu?'],
      support: ['Zu {E} führen wir nichts. Auswertung läuft über den Ansprechpartner.', 'Zu {E} haben wir keine eigenen Erkenntnisse.', 'Dossier {E} liegt im Modul 3. Ergänzungen an den Ansprechpartner.'],
      asset: ['{E}? Ich kenne den Namen.', 'Zu {E} sage ich nichts über diesen Kanal.', 'Über {E} reden wir besser persönlich.']
    },
    entitaetUnbekannt: {
      handler: ['Diese Kennung ist dir nicht zugänglich.', 'Keine Freigabe für diese Kennung.', 'Dazu liegt keine Freigabe vor.'],
      support: ['Diese Kennung kennen wir nicht.', 'Dazu haben wir nichts.', 'Keine Freigabe für diese Kennung.'],
      asset: ['Davon habe ich nie gehört.', 'Das sagt mir nichts.', 'Kenne ich nicht.']
    },
    standort: {
      handler: ['Letzter Standort laut Check-in: {STANDORT}.', 'Dein letzter Check-in lautet {STANDORT}. Änderungen melden.', 'Standort laut Check-in: {STANDORT}. Aktuell halten.'],
      support: ['Unsere Position unverändert. Übergabepunkt bereit.', 'Wir sind am vereinbarten Ort. Fahrzeug steht.', 'Standort wie geplant. Bei Änderung melden wir uns.'],
      asset: ['An meinem Terminal. Wie immer.', 'Ich bin da, wo ich sein soll.', 'Am üblichen Ort. Warum?']
    },
    zeit: {
      handler: ['Es ist {ZEIT}.', 'Aktuelle Zeit {ZEIT}.', '{ZEIT}. Meldefenster {FENSTER}.'],
      support: ['Bei uns ist es {ZEIT}.', '{ZEIT}.', 'Zeit {ZEIT}. Gleich wie bei Ihnen.'],
      asset: ['Es ist {ZEIT}.', '{ZEIT}, schätze ich.', 'Ich schaue kurz: {ZEIT}.']
    },
    treffen: {
      handler: ['Treffen nur in den freigegebenen Zeitfenstern.', 'Termine laut Auftrag. Ohne Freigabe keine Änderung.', 'Treffen außerhalb der Zeitfenster nur mit Freigabe.'],
      support: ['Übergabepunkt steht, Fahrzeug nach Anforderung.', 'Wir sind zu jedem Termin bereit. Zeit nennen.', 'Übergabe nach Plan. Änderungen über den Ansprechpartner.'],
      asset: ['Ich melde mich, wenn es passt. Nicht per Nachricht ausmachen.', 'Treffen geht nur außerhalb meiner Schicht.', 'Das besprechen wir persönlich, nicht hier.']
    },
    geld: {
      handler: ['Budget laut Auftrag hinterlegt. Mehrbedarf begründen.', 'Zahlungen laufen nicht über diesen Kanal.', 'Mittel sind über das Support Element verfügbar. Belege sammeln.'],
      support: ['Mittel sind hinterlegt. Belege bitte aufheben.', 'Zusätzlicher Bedarf nur mit Begründung beim Ansprechpartner.', 'Budget unverändert. Was brauchen Sie?'],
      asset: ['Darüber sprechen wir nicht hier.', 'Das klären wir persönlich.', 'Nicht über den Kanal, bitte.']
    },
    fahrzeug: {
      handler: ['Fahrzeuge laufen über das Support Element.', 'Fahrzeugfragen an die DISPO.', 'Dazu das Support Element. Der Ansprechpartner hat nichts dazu.'],
      support: ['Fahrzeug steht bereit. Kennzeichen unverändert.', 'Fahrzeug einsatzbereit. Wann brauchen Sie es?', 'Fahrzeug läuft auf Ihre Identität. Probleme melden.'],
      asset: ['Damit kenne ich mich nicht aus.', 'Ein Auto kann ich nicht stellen.', 'Das ist nicht meine Sache.']
    },
    technik: {
      handler: ['Technik und Ersatz über das Support Element.', 'Gerätefragen an DISPO.', 'Ausrüstung liegt beim Support Element. Mängel melden.'],
      support: ['Ersatz kann gestellt werden. Was fehlt?', 'Technik wird geprüft. Genaue Angabe bitte.', 'Wir haben Ersatzgeräte. Wann brauchen Sie sie?'],
      asset: ['Von Technik verstehe ich wenig.', 'Ich benutze nur, was ich habe.', 'Das Handy ist alles, was ich habe.']
    },
    unterkunft: {
      handler: ['Unterkunft über das Support Element.', 'Unterkunftsfragen an DISPO.', 'Unterkunft und Ausweichunterkunft liegen beim Support.'],
      support: ['Unterkunft und Ausweichunterkunft bereit.', 'Unterkunft unverändert nutzbar. Probleme melden.', 'Bezugsfertig. Schlüssel wie vereinbart.'],
      asset: ['Dafür bin ich nicht zuständig.', 'Ich kann keine Unterkunft anbieten.', 'Das müssen andere regeln.']
    },
    auftrag: {
      handler: ['Es bleibt wie besprochen. Auftrag {OP}: {OFFEN} von {GESAMT} Zielen offen.', 'Auftrag {OP} wie im Auftrag. {OFFEN} von {GESAMT} Zielen offen.', 'Es gilt der Auftrag {OP}. Details im Modul 2.'],
      support: ['Zum Auftrag nur über den Ansprechpartner.', 'Auftragsfragen gehen an ARGUS.', 'Dazu haben wir keine Befugnis.'],
      asset: ['Ich weiß nur, was ich weitergeben soll.', 'Der Auftrag ist nicht meine Sache.', 'Das weiß ich nicht.']
    },
    beobachtung: {
      handler: ['Beobachtung vermerkt. Zeit und Ort ergänzen.', 'Verstanden. Weiter beobachten, Meldung zum nächsten Fenster.', 'Notiert. Bitte mit Uhrzeit melden.'],
      support: ['Ok, notiert. Weiter an den Ansprechpartner.', 'Notiert. Wir geben es weiter.', 'Verstanden. Bei Folgemeldung bitte Uhrzeit.'],
      asset: ['Ich sehe das auch. Ich melde mich.', 'Danke. Das ist mir bisher nicht aufgefallen.', 'Gut zu wissen. Ich achte darauf.']
    },
    angekommen: {
      handler: ['Notiert. Check-in im Modul 1 nachziehen.', 'Verstanden. Standort per Check-in aktualisieren.', 'Ok, notiert. Weiter nach Plan.', 'Gecheckt, du bist vor Ort. Check-in nachziehen.'],
      support: ['Zur Kenntnis. Wir halten Bereitschaft.', 'Verstanden. Alles Weitere nach Anforderung.', 'Notiert. Bei Bedarf melden.'],
      asset: ['Gut. Ich bin auch da.', 'Verstanden. Ich bin in der Nähe.', 'Okay. Bis später.']
    },
    ruhig: {
      handler: ['Notiert. Meldefenster {FENSTER} einhalten.', 'Verstanden. Es bleibt wie besprochen.', 'Ok, notiert. Bei Änderung sofort melden.'],
      support: ['Gut. Wir bleiben bereit.', 'Notiert. Bei uns auch ruhig.', 'Verstanden. Meldung bei Änderung.'],
      asset: ['Hier auch. Bleibt dabei.', 'Gut. Bei mir ist es ruhig.', 'Das ist ein gutes Zeichen.']
    },
    geldMehr: {
      handler: ['Mehrbedarf begründen: Anlass, Betrag, Nutzen.', 'Budget laut Auftrag hinterlegt. Mehrbedarf begründen.', 'Mehrbedarf nur mit Begründung. Was ist passiert, und wie viel brauchst du?'],
      support: ['Das Budget liegt beim Ansprechpartner. Mehrbedarf bitte dort begründen.', 'Mehrbedarf läuft über ARGUS, nicht über uns.'],
      asset: ['Geld ist nicht mein Thema. Frag die anderen.', 'Dazu kann ich nichts sagen. Das läuft nicht über mich.']
    },
    problemLang: {
      handler: ['Verstanden. Ursache und Auswirkung nennen.', 'Notiert. Wie schätzt du die Auswirkung auf den Zeitplan ein?', 'Verstanden. Wie gravierend ist es, und was brauchst du von uns?'],
      support: ['Verstanden. Was brauchen Sie von uns?', 'Notiert. Sagen Sie uns, wo wir helfen können.'],
      asset: ['Das klingt nicht gut. Was heißt das für uns?', 'Okay. Was soll ich jetzt tun?']
    },
    problem: {
      handler: ['Problem konkret melden: was, wo, seit wann.', 'Welches Problem? Eine Zeile genügt.', 'Verstanden. Ursache und Auswirkung nennen.'],
      support: ['Wir prüfen. Was genau ist ausgefallen?', 'Beschreiben Sie das Problem. Wir suchen eine Lösung.', 'Verstanden. Was brauchen Sie von uns?'],
      asset: ['Was ist passiert?', 'Ein Problem? Hier bei mir?', 'Davon will ich nichts hören. Was ist los?']
    },
    dringend: {
      handler: ['Dringlichkeit vermerkt. Konkretes Anliegen?', 'Verstanden. Worum geht es genau?', 'Anliegen in einer Zeile nennen.'],
      support: ['Wir reagieren so schnell wir können. Anliegen?', 'Dringlichkeit vermerkt. Was brauchen Sie?', 'Verstanden. Bitte präzisieren.'],
      asset: ['Schneller geht es nicht.', 'Ich kann jetzt nicht mehr tun.', 'Immer mit der Ruhe.']
    },
    warten: {
      handler: ['Notiert. Ich warte.', 'Verstanden. Wir warten auf deine Meldung.', 'In Ordnung. Meld dich.'],
      support: ['Wir warten.', 'In Ordnung. Wir sind da.', 'Verstanden. Melden Sie sich, wenn Sie bereit sind.'],
      asset: ['Okay.', 'Ich warte.', 'Dann warte ich.']
    },
    ablehnung: {
      handler: ['Ablehnen geht nur über Modul 2.', 'Verstanden. Ablehnen bitte über Modul 2, nicht im Chat.', 'Das läuft nicht über den Chat. Bitte in Modul 2 ablehnen.'],
      support: ['Das entscheidet der Ansprechpartner.', 'Dazu können wir nichts sagen. Bitte an ARGUS.', 'Verstanden. Wir geben es nicht weiter.'],
      asset: ['Dann lass es.', 'Das verstehe ich. Mir wäre es auch zu viel.', 'Wie du willst. Ich mische mich nicht ein.']
    },
    zweifel: {
      handler: ['Zweifel sind normal. Was ist konkret das Problem?', 'Verstanden. Benenne, was dich beschäftigt.', 'Das ist nachvollziehbar. Sag, was konkret los ist.'],
      support: ['Wir haben die Lage im Blick. Was brauchen Sie?', 'Verstanden. Wir sind bereit, wenn Sie uns brauchen.', 'Sagen Sie, was Sie brauchen.'],
      asset: ['Mir geht es genauso. Wir ziehen das durch.', 'Das kenne ich. Aber Zurückgehen ist keine Option.', 'Ich mache mir auch Sorgen.']
    },
    frust: {
      handler: ['Sachlich bleiben. Was liegt an?', 'Verstanden. Was ist der Anlass?', 'Okay. Worum geht\'s?'],
      support: ['Verstanden. Was brauchen Sie?', 'Das ist ärgerlich. Wie können wir helfen?', 'Wir hören zu. Worum geht es?'],
      asset: ['Beruhig dich. Nicht hier.', 'Ich verstehe das. Aber schreiben bringt nichts.', 'Das hilft keinem von uns.']
    },
    lob: {
      handler: ['Ok, notiert. Der Auftrag ist nicht abgeschlossen.', 'Notiert. Konzentration halten.', 'Verstanden. Weiter nach Plan.', 'Schön, aber wir sind noch nicht durch. Konzentration halten.'],
      support: ['Danke. Weiter so.', 'Freut uns. Wir bleiben dran.', 'Notiert. Wir geben es weiter.'],
      asset: ['Sag das nicht zu früh.', 'Danke. Ich bin froh, wenn es vorbei ist.', 'Gut. Aber ich bleibe vorsichtig.']
    },
    danke: {
      handler: ['Notiert.', 'Keine Ursache. Weiter nach Plan.', 'Ok, notiert.', 'Passt. Weiter im Takt.'],
      support: ['Gern geschehen.', 'Kein Problem. Melden Sie sich.', 'Dafür sind wir da.'],
      asset: ['Schon gut.', 'Nicht der Rede wert.', 'Gerne. Aber leise.']
    },
    humor: {
      handler: ['Zurück zur Sache.', 'Verstanden. Weiter im Einsatz.', 'Ok, notiert.'],
      support: ['Gut gelaunt, das hören wir gern.', 'Schön, dass jemand lacht.', 'Ha. Weiter im Text.'],
      asset: ['Lustig finde ich das nicht.', 'Ich habe gerade nichts zu lachen.', 'Haha. Eher nervös.']
    },
    privat: {
      handler: ['Persönliches gehört nicht in diesen Kanal.', 'Du sprichst mit {GEGENSTELLE}. Mehr nicht.', 'Dazu keine Angaben.'],
      support: ['Dazu sagen wir nichts.', 'Wir sind {GEGENSTELLE}. Mehr gibt es nicht zu sagen.', 'Das bleibt außen vor.'],
      asset: ['Das geht dich nichts an.', 'Ich bin {GEGENSTELLE}. Mehr musst du nicht wissen.', 'Darüber rede ich nicht.']
    },
    sicherheit: {
      handler: ['Kanal geprüft. Schlüsselalter im Modul 4.', 'Verschlüsselung aktiv. Inhalte kurz halten.', 'Integrität wurde geprüft. Sicherheitsfragen an das Support Element.'],
      support: ['Schlüsselwechsel nach Plan. Integrität geprüft.', 'Der Kanal ist gesichert. Trotzdem kurz halten.', 'Technische Fragen bitte genau stellen.'],
      asset: ['Ich traue dem Handy nicht. Schreib kurz.', 'Ich lese nur, was nötig ist.', 'Kurz halten. Man weiß nie.']
    },
    koerper: {
      handler: ['Pause nur zwischen den Meldefenstern.', 'Notiert. Kondition erhalten.', 'Verstanden. Bei Beeinträchtigung melden.'],
      support: ['Verpflegung nach Plan. Brauchen Sie etwas?', 'Ausruhen geht in der Unterkunft.', 'Notiert. Passen Sie auf sich auf.'],
      asset: ['Ich auch. Die Schicht ist lang.', 'Kaffee hilft. Mehr nicht.', 'Müde bin ich auch, aber es muss gehen.']
    },
    meinung: {
      handler: ['Meine Einschätzung steht in der Lagebewertung. Deine Beobachtung zählt.', 'Meinungen sind kein Teil dieses Kanals.', 'Entscheidend sind deine Beobachtungen.'],
      support: ['Wir liefern Daten, keine Meinung.', 'Dazu haben wir keine Einschätzung.', 'Fragen Sie den Ansprechpartner.'],
      asset: ['Ich weiß nicht, was ich glauben soll.', 'Meine Meinung ist nicht wichtig.', 'Ich sehe nur meinen Teil.']
    },
    smalltalk: {
      handler: ['Kein Thema für diesen Kanal.', 'Dazu keine Angaben. Zurück zum Auftrag.', 'Nicht jetzt.', 'Wir reden über den Auftrag, nicht über die Freizeit.', 'Privates später, sofern es ein Später gibt.'],
      support: ['Schönes Thema, aber nicht hier.', 'Später vielleicht. Jetzt zählt der Einsatz.', 'Wir bleiben beim Einsatz.', 'Klingt gut, aber wir müssen bei der Sache bleiben.', 'Wenn der Einsatz vorbei ist, gern.'],
      asset: ['Ach, das ist gerade nicht wichtig.', 'Darüber reden wir ein andermal.', 'Jetzt nicht.', 'Dafür habe ich gerade keinen Kopf. Aber nett, dass du fragst.', 'Wenn das hier vorbei ist, erzähle ich dir was dazu.']
    },
    wetter: {
      handler: ['Kein Bezug zum Auftrag.', 'Wetter ist nicht Teil der Lage.', 'Zur Sache bitte.'],
      support: ['Wetter ist für uns ohne Belang, solange das Fahrzeug fährt.', 'Dazu liegt uns nichts vor.', 'Kein Thema für uns.'],
      asset: ['Wie immer. Wechselhaft.', 'Draußen ist es so, wie es immer ist.', 'Warum fragst du das?']
    },
    test: {
      handler: ['Empfang gut.', 'Verbindung steht. Empfang gut.', 'Empfang bestätigt. Kanal gesichert.'],
      support: ['Empfang gut. Verbindung stabil.', 'Wir lesen Sie gut.', 'Test bestätigt.'],
      asset: ['Ich lese dich.', 'Kommt an.', 'Alles klar, ich lese.']
    },
    anwesend: {
      handler: ['Hier. Ich höre.', 'Anwesend. Was liegt an?', 'Ja. Kanal offen.'],
      support: ['Wir sind da.', 'Anwesend. Was brauchen Sie?', 'Hier. Wir hören.'],
      asset: ['Ich bin da.', 'Hier. Was gibt es?', 'Ja, noch da.']
    },
    wiegehts: {
      handler: ['Keine Besonderheiten. Es bleibt wie besprochen.', 'Es läuft. Deine Lage?', 'Stand unverändert. Und bei dir?'],
      support: ['Alles in Ordnung. Fahrzeug und Unterkunft stehen.', 'Bei uns läuft alles. Und bei Ihnen?', 'Gut. Keine Auffälligkeiten.'],
      asset: ['Soweit gut. Und du?', 'Es geht. Man gewöhnt sich daran.', 'Ruhig. Zu ruhig vielleicht.']
    },
    abschied: {
      handler: ['Verstanden. Meldefenster einhalten.', 'Ende. Nächste Meldung zum Fenster {FENSTER}.', 'Bis zur nächsten Meldung.'],
      support: ['Verstanden. Wir bleiben auf Bereitschaft.', 'Bis später.', 'Ende der Meldung. Viel Erfolg.'],
      asset: ['Bis später. Und vorsichtig.', 'Gut. Bis zum nächsten Mal.', 'Ich melde mich.']
    },
    gruss: {
      handler: ['Hier {GEGENSTELLE}. Was liegt an?', 'Guten Tag, {AGENT}. Ich höre.', 'Kanal offen. Bitte.'],
      support: ['Hier {GEGENSTELLE}. Was können wir tun?', 'Hallo, {AGENT}. Wir sind da.', 'Hier Support. Bitte.'],
      asset: ['Hallo. Ich habe wenig Zeit.', 'Ja? Was gibt es?', 'Moin. Alles ruhig hier.']
    },
    empfang: {
      handler: ['Empfang bestätigt. Zuweisung folgt im Bereich Auftrag.', 'Gut. Warte auf die Zuweisung.', 'Verstanden. Der Auftrag kommt im Bereich Auftrag.'],
      support: ['Empfang bestätigt. Wir sind bereit.', 'Notiert. Kanal steht.', 'Gut. Wir hören mit.'],
      asset: ['Gut.', 'Angekommen.', 'Okay, ich höre.']
    },
    bestaetigung: {
      handler: ['Notiert.', 'Verstanden.', 'Ok, notiert.', 'Botschaft angekommen.', 'Hab ich gecheckt.', 'Alles klar, ist durch.'],
      support: ['Verstanden. Wir sind bereit.', 'Notiert.', 'Gut, notiert.', 'Botschaft angekommen.'],
      asset: ['Gut.', 'Okay.', 'In Ordnung.', 'Hab verstanden.', 'Passt, hab ich.']
    },
    verneinung: {
      handler: ['Verstanden. Alternative nennen?', 'Notiert. Grund in einem Satz.', 'Nein vermerkt. Was stattdessen?'],
      support: ['Verstanden. Was stattdessen?', 'Dann machen wir es anders. Wie?', 'Notiert. Brauchen Sie etwas anderes?'],
      asset: ['Dann nicht.', 'Okay, dann lassen wir es.', 'Gut, das ist mir recht.']
    }
  },

  /* Zusätzliche Färbung des lokalen Kontakts je Mission; Schlüssel = Missionskennung, dann Absicht */
  assetFarbe: {
    M1: {
      gruss: ['Moin. In der Werkstatt ist gerade Betrieb.', 'Hallo. Ich hänge unter einem Wagen, kurz.'],
      abschied: ['Bis dann. Der Chef kommt gleich.', 'Ich muss wieder unter die Hebebühne.'],
      standort: ['In der Werkstatt. Wie immer.', 'Im Hof, kurz rauchen.'],
      treffen: ['Nur nach Feierabend. Abends sind zu viele Augen da.', 'Wenn der Hof leer ist, vielleicht.'],
      ruhig: ['Im Hof ist es ruhig. Zu ruhig.', 'Normaler Tag, Reifen und Bremsen.'],
      wiegehts: ['Viel Arbeit, wenig Schlaf. Sonst geht es.', 'Es geht. Die Schulden werden nicht kleiner.'],
      zweifel: ['Mir wird mulmig, wenn abends die Transporter kommen.', 'Wenn die auf mich aufmerksam werden, bin ich dran.'],
      koerper: ['Rücken. Das kommt vom Bücken.', 'Müde, aber das ist normal.'],
      beobachtung: ['Vom Hof aus sehe ich alles. Ich merke mir das.', 'Die Tordurchfahrt sieht man von der Werkstatt aus.'],
      problem: ['Ein Problem? Dann bin ich der Erste, der es merkt.', 'Wenn hier was schiefgeht, trifft es mich zuerst.'],
      dringend: ['Ich kann nicht einfach weg, der Chef steht daneben.', 'Ich bin gerade nicht allein. Später.'],
      smalltalk: ['Hier läuft gerade ein Motor, ich verstehe kaum etwas.', 'Nicht jetzt, es kommt jemand.'],
      sicherheit: ['Hier hört man mit. Kurz halten.', 'Das Handy liegt in der Jacke, ich schaue selten hin.'],
      privat: ['Ich bin Mechaniker, mehr musst du nicht wissen.', 'Das geht dich nichts an.'],
      geld: ['Dazu nicht hier. Ich habe schon genug Ärger.', 'Das besprechen wir, wenn niemand zuhört.']
    }
  },

  /* Rückfragen der Akteure. Eine offene Rückfrage wird mit der nächsten Eingabe beantwortet.
     klassen: Stämme je Antwortklasse; folge: Antworten je Klasse; sonst: wenn keine Klasse passt. */
  nachfragen: {
    handler: [
      { id: 'h-lage', text: 'Lage kurz?',
        klassen: { ruhig: ['!alles ruhig', '!nichts besonderes', '=ruhig', '!keine auffälligkeiten', '!keine auffaelligkeiten', '!alles normal', '=normal', '=gut', '=unauffällig', '=unauffaellig'],
                   gefahr: ['^gefahr', '^verfolg', '^beschatt', 'aufgeflogen', '^kompromittiert', '^bedroh', '^problem', '=schlecht', '^auffällig', '^auffaellig'] },
        folge: { ruhig: ['Notiert. Meldefenster {FENSTER} einhalten.', 'Verstanden. Es bleibt wie besprochen.'],
                 gefahr: ['Verstanden. Lage und Ort in einer Zeile nachliefern.', 'Notiert. Abbruchkriterium im Auge behalten, Meldung bei Änderung.'] },
        sonst: ['Notiert.', 'Ok, notiert.'] },
      { id: 'h-zustand', text: 'Dein Zustand?',
        klassen: { gut: ['=gut', '=fit', '!alles gut', '=okay', '=ok', '=bestens', '=geht'],
                   schlecht: ['^müde', '^muede', '^verletzt', '=schlecht', '^erschöpft', '^erschoepft', '^angespannt', '^nervös', '^nervoes'] },
        folge: { gut: ['Gut. Konzentration halten.', 'Verstanden.'],
                 schlecht: ['Zustand vermerkt. Ruhephase nur zwischen den Meldefenstern.', 'Notiert. Bei Verschlechterung melden.'] },
        sonst: ['Notiert.', 'Ok, notiert.'] },
      { id: 'h-ort', text: 'Standort unverändert?',
        klassen: { ja: ['=ja', '=unverändert', '=unveraendert', '=jawohl', '=korrekt', '=richtig'],
                   nein: ['=nein', '^gewechselt', '^verlegt', '^woanders', '^neuer'] },
        folge: { ja: ['Notiert. Check-in im Modul 1 aktuell halten.', 'Verstanden. Weiter nach Plan.'],
                 nein: ['Neuen Standort per Check-in melden.', 'Standortwechsel im Modul 1 nachziehen.'] },
        sonst: ['Notiert. Check-in aktuell halten.', 'Ok, notiert.'] },
      { id: 'h-kontakt', text: 'Kontakt zur Gegenstelle ohne Auffälligkeiten?',
        klassen: { ja: ['=ja', '^ohne', '^unauffällig', '^unauffaellig', '=normal', '!alles ruhig'],
                   nein: ['=nein', '^auffällig', '^auffaellig', '^problem', '^verdächtig', '^verdaechtig'] },
        folge: { ja: ['Gut. Quellenschutz beachten.', 'Verstanden. Weiter wie bisher.'],
                 nein: ['Wie auffällig? Details nur kurz, der Rest beim Treffen.', 'Verstanden. Kontakt vorerst reduzieren.'] },
        sonst: ['Notiert.', 'Ok, notiert.'] },
      { id: 'h-zeit', text: 'Zeitplan hält?',
        klassen: { ja: ['=ja', '^im plan', '=planmäßig', '=planmaessig'],
                   nein: ['=nein', '^verzug', '^verspätet', '^verspaetet', '^später', '^spaeter', '^verzögert', '^verzoegert'] },
        folge: { ja: ['Gut. Zeitfenster im Auftrag einhalten.', 'Verstanden. Weiter nach Plan.'],
                 nein: ['Verzug benennen: Ursache und neue Schätzung.', 'Notiert. Neue Schätzung zum nächsten Fenster.'] },
        sonst: ['Notiert.', 'Ok, notiert.'] },
      { id: 'h-bedarf', text: 'Noch Bedarf an Unterstützung?',
        klassen: { ja: ['=ja', '^brauche', '^bräuchte', '^braeuchte', '^benötige', '^benoetige', '^bedarf'],
                   nein: ['=nein', '=nichts', '^kein bedarf', '=danke', '!alles da', '!alles vorhanden'] },
        folge: { ja: ['Bedarf konkret nennen. Logistik läuft über das Support Element.', 'Verstanden. Bedarf an DISPO, mit Begründung.'],
                 nein: ['Gut. Bei Bedarf Meldung.', 'Verstanden.'] },
        sonst: ['Notiert.', 'Ok, notiert.'] }
    ],
    support: [
      { id: 's-fahrzeug', text: 'Fahrzeug in Ordnung?',
        klassen: { ja: ['=ja', '=gut', '=okay', '=ok', '^in ordnung', '=läuft', '=laeuft'], nein: ['=nein', '^problem', '^defekt', '^panne', '^kratzer', '^schaden'] },
        folge: { ja: ['Gut. Wir halten es bereit.', 'Verstanden. Weiter wie geplant.'], nein: ['Was ist kaputt? Wir organisieren Ersatz.', 'Schaden bitte kurz beschreiben. Wir kümmern uns.'] },
        sonst: ['Notiert.', 'Notiert.'] },
      { id: 's-material', text: 'Fehlt Material?',
        klassen: { ja: ['=ja', '^fehlt', '^brauche', '^bräuchte', '^braeuchte'], nein: ['=nein', '=nichts', '^alles da', '^alles vorhanden', '^ausreichend'] },
        folge: { ja: ['Was genau? Lieferung über den Übergabepunkt.', 'Bitte konkret nennen. Wir bringen es.'], nein: ['Gut. Dann bleibt es dabei.', 'Verstanden.'] },
        sonst: ['Notiert.', 'Notiert.'] },
      { id: 's-dokumente', text: 'Dokumente der Identität bei Ihnen vollständig?',
        klassen: { ja: ['=ja', '^vollständig', '^vollstaendig', '=komplett', '^alles da'], nein: ['=nein', '^fehlt', '^abgelaufen', '^unvollständig', '^unvollstaendig'] },
        folge: { ja: ['Gut. Ersatz für ablaufende Stücke ist angefordert.', 'Verstanden. Weiter wie bisher.'], nein: ['Was fehlt? ARCHIV wird informiert.', 'Bitte konkret nennen, wir fordern nach.'] },
        sonst: ['Notiert.', 'Notiert.'] },
      { id: 's-unterkunft', text: 'Unterkunft nutzbar?',
        klassen: { ja: ['=ja', '=gut', '=okay', '=ok', '^in ordnung'], nein: ['=nein', '^problem', '^unsicher', '^auffällig', '^auffaellig'] },
        folge: { ja: ['Gut. Ausweichunterkunft bleibt bereit.', 'Verstanden.'], nein: ['Was ist das Problem? Ausweichunterkunft steht.', 'Wir verlegen bei Bedarf. Bitte melden.'] },
        sonst: ['Notiert.', 'Notiert.'] },
      { id: 's-uebergabe', text: 'Wann brauchen Sie die nächste Übergabe?',
        klassen: { heute: ['^heute', '^jetzt', '^sofort', '^gleich'], spaeter: ['^morgen', '^später', '^spaeter', '^nacht', '^abend'] },
        folge: { heute: ['Heute wird eng, aber möglich. Bitte konkrete Uhrzeit.', 'Verstanden. Fahrzeug wird vorbereitet.'], spaeter: ['Notiert. Fahrzeug steht rechtzeitig bereit.', 'Verstanden. Wir planen es ein.'] },
        sonst: ['Notiert. Bitte Zeit nennen.', 'Notiert.'] },
      { id: 's-geraet', text: 'Gerät ohne Störungen?',
        klassen: { ja: ['=ja', '=gut', '=okay', '=ok', '^störungsfrei', '^stoerungsfrei', '=läuft', '=laeuft'], nein: ['=nein', '^störung', '^stoerung', '^ausfall', '^rauschen', '^akku'] },
        folge: { ja: ['Gut. Weiter so.', 'Verstanden.'], nein: ['Welche Störung? Ersatz kann gestellt werden.', 'Bitte Fehlerbild kurz beschreiben.'] },
        sonst: ['Notiert.', 'Notiert.'] }
    ],
    asset: [
      { id: 'a-ruhig', text: 'Und bei dir? Alles in Ordnung?',
        klassen: { ja: ['=ja', '=gut', '!alles gut', '!alles in ordnung', '=okay', '=ok', '=ruhig'], nein: ['=nein', '^problem', '^gefahr', '=schlecht', '^verfolg'] },
        folge: { ja: ['Gut. Dann machen wir weiter.', 'Das beruhigt mich.'], nein: ['Das gefällt mir nicht. Was ist los?', 'Hoffentlich nichts Ernstes.'] },
        sonst: ['Verstanden.', 'Okay.'] },
      { id: 'a-beobachtet', text: 'Hast du das Gefühl, dass jemand zuschaut?',
        klassen: { ja: ['=ja', '^verfolg', '^beobachtet', '^beschattet'], nein: ['=nein', '^niemand', '^nichts'] },
        folge: { ja: ['Dann geh. Sofort. Ich schreibe nichts mehr.', 'Das ist schlecht. Ich bleibe still.'], nein: ['Gut. Mir kommt auch nichts komisch vor.', 'Dann bin ich beruhigt.'] },
        sonst: ['Verstanden.', 'Okay.'] },
      { id: 'a-treffen', text: 'Bleibt es beim Treffen?',
        klassen: { ja: ['=ja', '^bleibt', '^wie vereinbart', '^wie besprochen'], nein: ['=nein', '^verschieb', '^abgesagt', '^später', '^spaeter'] },
        folge: { ja: ['Gut. Ich halte mich bereit.', 'Okay. Ich komme.'], nein: ['Dann bitte neuen Termin. Aber nicht hier.', 'Verstanden. Ich warte auf Bescheid.'] },
        sonst: ['Verstanden.', 'Okay.'] },
      { id: 'a-dauer', text: 'Wie lange noch?',
        klassen: { bald: ['^bald', '^kurz', '^wenige', '=morgen'], unbekannt: ['^weiß nicht', '^weiss nicht', '=unklar', '^lange'] },
        folge: { bald: ['Gut. Ich halte durch.', 'Dann schaffe ich das.'], unbekannt: ['Dann bleibt mir nur zu warten.', 'Das macht mich nicht ruhiger.'] },
        sonst: ['Verstanden.', 'Okay.'] },
      { id: 'a-kollegen', text: 'Fragen schon Kollegen nach?',
        klassen: { ja: ['=ja', '^fragen', '^auffällig', '^auffaellig'], nein: ['=nein', '^niemand', '^keiner'] },
        folge: { ja: ['Das war zu erwarten. Ich bleibe bei meiner Geschichte.', 'Dann muss ich noch vorsichtiger sein.'], nein: ['Gut. Dann fällt es nicht auf.', 'Das beruhigt mich.'] },
        sonst: ['Verstanden.', 'Okay.'] }
    ]
  },

  /* Eingaben ohne Treffer: Rückfrage in der Rolle */
  unklar: {
    handler: ['Unklar. Bitte wiederholen.', 'Nicht eindeutig. Kurz und konkret.', 'Das habe ich nicht verstanden. Bitte präzisieren.', 'Rückfrage: Worum geht es genau?', 'Nicht über diesen Kanal. Anliegen konkret nennen.', 'Bitte vollständig und eindeutig formulieren.'],
    support: ['Das habe ich nicht verstanden. Bitte noch einmal.', 'Unklar. Was brauchen Sie genau?', 'Bitte präzisieren, dann können wir helfen.', 'Wir kommen nicht mit. Bitte anders formulieren.', 'Verstanden habe ich es nicht. Kurz und konkret.', 'Worum geht es?'],
    asset: ['Wie meinst du das?', 'Ich verstehe nicht ganz.', 'Was soll ich damit anfangen?', 'Bitte deutlicher.', 'Das habe ich nicht verstanden.', 'Sag es kürzer.', 'Keine Ahnung, bisher nichts Neues.']
  },
  allgemeineFrage: {
    handler: ['Konkrete Frage, konkrete Antwort: Worum geht es?', 'Frage vermerkt. Bitte konkreter.', 'Dazu liegt mir nichts vor. Präzisieren.'],
    support: ['Frage bitte genauer.', 'Dazu haben wir keine Angaben. Konkreter?', 'Wir prüfen. Was genau wollen Sie wissen?'],
    asset: ['Kommt darauf an. Was genau?', 'Das weiß ich nicht.', 'Frag das nicht so allgemein.', 'Ich kann dir nur sagen, was ich selbst gesehen habe. Frag konkret.']
  },
  zuKurz: {
    handler: ['Bitte vollständig.', 'Eingabe unvollständig.'],
    support: ['Bitte ausführlicher.', 'Das war zu kurz. Was meinen Sie?'],
    asset: ['Bitte mehr als das.', 'Was heißt das?']
  },
  zuLang: {
    handler: ['Zu lang für diesen Kanal. Kurz fassen.', 'Nachricht zu umfangreich. Auf das Wesentliche kürzen.'],
    support: ['Das ist sehr lang. Bitte kürzer.', 'Zu viel auf einmal. Bitte aufteilen.'],
    asset: ['Zu viel Text. Ich habe keine Zeit.', 'Bitte kürzer. Ich lese nur kurz.']
  },
  wiederholt: {
    handler: ['Bereits erhalten.', 'Doppelt. Kein Bedarf an Wiederholung.', 'Liegt vor. Bitte nicht erneut senden.'],
    support: ['Haben wir schon.', 'Schon erhalten. Danke.', 'Doppelt angekommen.'],
    asset: ['Habe ich schon gelesen.', 'Das hast du schon geschrieben.', 'Nicht noch einmal, bitte.']
  }
};
