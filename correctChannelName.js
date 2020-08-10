/** Transforme le nom de la chaine EPG en FreeboxTV
 *
 * Pourquoi ?
 * - Le nom de la chaîne est différent sur l'EPG et sur Freebox TV
 * - le programme EPG n'a pas été trouvé
 * - pas d'affichage info sur la chaîne
 * - il n'existe peut etre pas d'entrée pour cette chaine
 *
 * Essayer de résoudre ?
 * "EPG NAME" -> "FREEBOX TV"
 * exemple en debug mode :
 * EPG- Piwi + *** no entry found !
 * une simple recherche dans epg.xml sur piwi donne:
 * <display-name>Piwi+</display-name>
 * donc il faut modifier l'entrée EPG comme ceci:
 * "Piwi+": "Piwi +",
 *
 * Resulat:
 * La base de donnée est synchronisée
 * les informations sont correctement retournées
 *
**/

var CorrectChannelDBName = {
  "Franceinfo": "franceinfo",
  "La Chaîne parlementaire": "La Chaîne Parlementaire",
  "BFMTV": "BFM TV",
  "CNEWS": "CNews",
  "CSTAR": "CStar",
  "RTL 9": "RTL9",
  "Infosport+": "InfoSport+",
  "Canal+ Cinéma": "C+ Cinema",
  "Canal+ Sport": "C+ Sport",
  "Canal+ Séries": "C+ Séries",
  "Canal+ Family": "C+ Family",
  "Canal+ Décalé" : "C+ Décalé",
  "Téva": "TEVA",
  "TvBreizh": "TV Breizh",
  "serieclub": "Série Club",
  "Planète+": "Planete+",
  "National Geographic": "National Geographic Channel",
  "National Geographic Wild": "Nat Geo Wild",
  "TV5MONDE": "TV5 Monde",
  "Comédie+": "Comedie+",
  "TIJI" : "Tiji",
  "Piwi+": "Piwi +",
  "TéléToon+" : "Télétoon",
  "OLTV" : "OL TV",
  "Planète+ Crime Investigation": "Planète+ CI",
  "Planète+ Aventure Expérience" : "Planète+ A&E",
  "Histoire": "Histoire TV",
  "Science &amp; Vie TV": "Science & Vie TV",
  "Museum": "Museum TV",
  "La Chaîne Météo": "La chaîne Météo",
  "Demain TV": "Demain.tv",
  "MCM Top": "MCM TOP",
  "France 3 Centre-Val de Loire": "France 3 Centre",
  "France 3 Champagne-Ardennes": "France 3 Champagne-Ardenne",
  "France 3 Côte d'Azur": "France 3 Côte-d'Azur",
  "France 3 Midi-Pyrénées": "France 3 Midi Pyrénées",
  "France 3 Pays de la Loire": "France 3 Pays de Loire",
  "CNN" : "CNN International",
  "I24news": "i24 News",
  "Foot+ 24/24" : "Foot+",
  "Multisports 1": "Multisport+ 1",
  "Multisports 2": "Multisport+ 2",
  "Multisports 3": "Multisport+ 3",
  "Multisports 4": "Multisport+ 4",
  "Multisports 5": "Multisport+ 5",
  "Multisports 6": "Multisport+ 6",
  "Gong Max": "GONG MAX",
  "TRACE Sport Stars": "Trace Sport Stars",
  "Stingray Djazz": "Stingray DJAZZ",
  "Stingray i-Concerts": "Stingray IConcerts SD"
}

exports.CorrectChannelDBName = CorrectChannelDBName
