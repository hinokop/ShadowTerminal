# R5 – erste Bereinigungsrunde

Referenz ist der unter Windows abgenommene Stand `1003fcd`. Die Runde ändert weder das Datenformat noch gespeicherte Profile, Importverhalten, sichtbare Arbeitsmodule oder den Terminalstart.

| Kandidat | Befund und Entscheidung |
| --- | --- |
| Navigation | `buildNav` und `renderNav` lesen ausschließlich `ARBEITSMODULE` (Profil, Dossiers, Karte, Ablage). Keine dieser IDs steht in `NAV_BADGES`; es gibt keine weiteren Verbraucher. Den unerreichbaren Badge-Code entfernen. Die historischen Module, die Tastenkürzel und das Altprofil-Fallback bleiben unverändert. |
| `wk` | Testet die sichtbar eingeschränkte Rudimentansicht und ARGUS-Freigaben. Aus der Standardauswahl nehmen. `dossier-einheitlich` und `missionstrennung` prüfen getrennt den Recherchezugang und den Fortbestand alter Missionsdaten. |
| `ev2`, `st` | Erwarten den alten Profilstatus (`#sel-status`) bzw. die Missions-Atempause (`#btn-atempause`). Aus der Standardauswahl nehmen. Der Arbeitsprofilstatus und seine Trennung von der Missionsautomatik bleiben unter Test. |
| `fc`, `sk` | Setzen die alte Anreise-/Check-in-Oberfläche bzw. Funkruhe (`#btn-funkruhe`) voraus. Aus der Standardauswahl nehmen. Der interne Missionsstart und Altprofile bleiben durch `missionstrennung` abgedeckt. |
| `kv4` | Mischt aktives Kartenmessen mit dem alten Handler-Popup `#k-pop-frage`. Messablauf durch `karten-messen` ersetzen. Den historischen Mischtest aus der Standardauswahl nehmen. |
| `ed` | Bereits außerhalb der Standardauswahl. Erwartet das entfernte Feld `#bd-stufe`. `dossier-einheitlich`, `dossier-maske` und `bearbeitet-hinweis` prüfen die aktuelle Bearbeitung und das Zurücksetzen. |

Die sieben historischen Testdateien bleiben für die Untersuchung der alten Pfade erhalten und können über `node tests/runall.js <name>` gezielt aufgerufen werden. Ein roter Lauf dort ist kein bestandener Test. `m1flow`, `abd`, `wk3` und `dp` bleiben mit ihren bisherigen Hinweisen in der Standardauswahl. Ein grüner Vergleich nach der Bereinigung muss zusätzlich zur geänderten Auswahl die aktiven Arbeitsabläufe prüfen.

Nicht Teil dieser Runde sind Zustandsmigration, Szenarioentfernung, alte Freigaberegeln oder der Umbau der Ablage.
