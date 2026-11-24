#!/usr/bin/env bash
# ============================================================
#  Field Terminal - Start vom Stick (Linux / Kali)
#  Entspricht START_3D.bat: oeffnet index.html in einem
#  Chromium-Anwendungsfenster (ohne Adresszeile und Tabs). Das
#  Browserprofil liegt im Ordner "profil" neben dieser Datei;
#  Zustand, Protokoll und Kennungs-Hash reisen damit mit dem Stick.
#  Ordner "profil" loeschen = alles auf Anfang.
#
#  Aufruf:   bash START.sh        (oder: chmod +x START.sh && ./START.sh)
#  Eigener Browser:   BROWSER_BIN=/pfad/zum/browser bash START.sh
#  Ohne GPU:          FT_OHNE_GPU=1 bash START.sh   (bei schwarzem Fenster)
#  Mit Ausgabe:       FT_VORDERGRUND=1 bash START.sh   (Meldungen im Terminal; sonst start.log)
# ============================================================
set -u

# Verzeichnis dieser Datei (auch bei Aufruf ueber Symlink)
QUELLE="${BASH_SOURCE[0]}"
while [ -L "$QUELLE" ]; do
  D="$(cd -P "$(dirname "$QUELLE")" && pwd)"
  QUELLE="$(readlink "$QUELLE")"
  case "$QUELLE" in /*) ;; *) QUELLE="$D/$QUELLE" ;; esac
done
DIR="$(cd -P "$(dirname "$QUELLE")" && pwd)"

fehler() {
  echo "Start nicht moeglich: $1" >&2
  if [ -z "${FT_NO_GUI:-}" ]; then
    if command -v zenity >/dev/null 2>&1 && [ -n "${DISPLAY:-}${WAYLAND_DISPLAY:-}" ]; then
      zenity --error --title="Start nicht moeglich" --text="$1" 2>/dev/null || true
    elif command -v notify-send >/dev/null 2>&1 && [ -n "${DISPLAY:-}${WAYLAND_DISPLAY:-}" ]; then
      notify-send "Field Terminal" "$1" 2>/dev/null || true
    fi
  fi
  exit 1
}

[ -f "$DIR/index.html" ]  || fehler "index.html, szenario.js, karte-modul.js, akten-modul.js oder recherche-modul.js fehlt neben dieser Datei."
[ -f "$DIR/szenario.js" ] || fehler "index.html, szenario.js, karte-modul.js, akten-modul.js oder recherche-modul.js fehlt neben dieser Datei."
[ -f "$DIR/karte-modul.js" ] || fehler "index.html, szenario.js, karte-modul.js, akten-modul.js oder recherche-modul.js fehlt neben dieser Datei."
[ -f "$DIR/akten-modul.js" ] || fehler "index.html, szenario.js, karte-modul.js, akten-modul.js oder recherche-modul.js fehlt neben dieser Datei."
[ -f "$DIR/recherche-modul.js" ] || fehler "index.html, szenario.js, karte-modul.js, akten-modul.js oder recherche-modul.js fehlt neben dieser Datei."

[ -f "$DIR/fall-modul.js" ] || fehler "fall-modul.js fehlt neben dieser Datei."
[ -f "$DIR/terminal-locale.js" ] || fehler "terminal-locale.js fehlt neben dieser Datei."
[ -f "$DIR/terminal-vfs.js" ] || fehler "terminal-vfs.js fehlt neben dieser Datei."
[ -f "$DIR/terminal-dateibefehle.js" ] || fehler "terminal-dateibefehle.js fehlt neben dieser Datei."

# Browser suchen: erst der ausdrueckliche Wunsch, dann gaengige Chromium-Varianten
BROWSER=""
if [ -n "${BROWSER_BIN:-}" ]; then
  if command -v "$BROWSER_BIN" >/dev/null 2>&1; then BROWSER="$(command -v "$BROWSER_BIN")"
  else fehler "BROWSER_BIN ist gesetzt, aber nicht ausfuehrbar: $BROWSER_BIN"; fi
else
  for kand in microsoft-edge-stable microsoft-edge chromium chromium-browser \
              google-chrome-stable google-chrome brave-browser vivaldi opera; do
    if command -v "$kand" >/dev/null 2>&1; then BROWSER="$(command -v "$kand")"; break; fi
  done
fi
if [ -z "$BROWSER" ]; then
  fehler "Kein Chromium-basierter Browser gefunden (Edge, Chromium, Chrome, Brave). Unter Kali: sudo apt install chromium"
fi

# Dateiadresse bilden: Sonderzeichen kodieren (reines Bash, keine Abhaengigkeit)
kodieren() {
  local s="$1" i c out=""
  LC_ALL=C
  for (( i=0; i<${#s}; i++ )); do
    c="${s:i:1}"
    case "$c" in
      [a-zA-Z0-9.~_/-]) out+="$c" ;;
      *) out+="$(printf '%%%02X' "'$c")" ;;
    esac
  done
  printf '%s' "$out"
}
URL="file://$(kodieren "$DIR")/index.html"

# Profilordner: bevorzugt auf dem Stick. Chromium legt darin Symlinks an (SingletonLock); auf FAT/exFAT/NTFS-Sticks
# ohne Symlink-Unterstuetzung beendet er sich dann sofort oder zeigt ein schwarzes Fenster. Wir pruefen das vorab.
PROFIL="$DIR/profil"
mkdir -p "$PROFIL" 2>/dev/null
if ! ln -s ziel "$PROFIL/.symlinktest" 2>/dev/null; then
  PROFIL="${XDG_DATA_HOME:-$HOME/.local/share}/field-terminal/profil"
  mkdir -p "$PROFIL"
  echo "Hinweis: Der Stick unterstuetzt keine Symlinks (FAT/exFAT). Profil liegt stattdessen unter $PROFIL" >&2
  echo "         Zustand und Kennwort reisen dann nicht mit dem Stick." >&2
fi
rm -f "$DIR/profil/.symlinktest" 2>/dev/null

# Protokoll: start.log neben dieser Datei (sonst /tmp), bei Fehlern hier nachsehen
LOG="$DIR/start.log"
{ : >"$LOG"; } 2>/dev/null || LOG="/tmp/field-terminal-start.log"

ARGS=( "--app=$URL" "--user-data-dir=$PROFIL" "--no-first-run" "--start-fullscreen"
       "--no-default-browser-check" "--window-size=1440,900" )

# Schwarzes Fenster auf manchen Grafiktreibern: FT_OHNE_GPU=1 bash START.sh
if [ -n "${FT_OHNE_GPU:-}" ]; then ARGS+=( "--disable-gpu" "--disable-software-rasterizer" ); fi

# Als root verweigert Chromium ohne Sandbox den Start (aeltere Kali-Installationen)
if [ "$(id -u)" -eq 0 ]; then
  ARGS+=( "--no-sandbox" )
  echo "Hinweis: Start als root, Chromium laeuft deshalb mit --no-sandbox." >&2
fi

# Ohne Konsolenbindung starten, wie START.vbs: abgetrennt und stumm
if [ -n "${FT_VORDERGRUND:-}" ]; then
  exec "$BROWSER" "${ARGS[@]}"
fi
echo "Browser: $BROWSER" >>"$LOG"; echo "Adresse: $URL" >>"$LOG"
nohup setsid "$BROWSER" "${ARGS[@]}" >>"$LOG" 2>&1 &
disown 2>/dev/null || true
exit 0
