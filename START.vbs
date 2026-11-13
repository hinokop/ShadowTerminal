Option Explicit
' Field Terminal - Start vom Stick ohne Konsolenfenster.
' Oeffnet index.html in einem Edge-Anwendungsfenster. Das Browserprofil liegt im Ordner "profil" neben dieser Datei.
Dim sh, fso, dir, edge, kand, i, url, cmd, q
Set sh = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")
q = Chr(34)
dir = fso.GetParentFolderName(WScript.ScriptFullName)

If Not fso.FileExists(dir & "\index.html") Or Not fso.FileExists(dir & "\szenario.js") Then
  MsgBox "index.html oder szenario.js fehlt neben dieser Datei.", 48, "Start nicht moeglich"
  WScript.Quit 1
End If

edge = ""
kand = Array( _
  sh.ExpandEnvironmentStrings("%ProgramFiles(x86)%") & "\Microsoft\Edge\Application\msedge.exe", _
  sh.ExpandEnvironmentStrings("%ProgramFiles%") & "\Microsoft\Edge\Application\msedge.exe", _
  sh.ExpandEnvironmentStrings("%LocalAppData%") & "\Microsoft\Edge\Application\msedge.exe")
For i = 0 To UBound(kand)
  If edge = "" Then
    If fso.FileExists(kand(i)) Then edge = kand(i)
  End If
Next
If edge = "" Then
  MsgBox "Microsoft Edge wurde nicht gefunden.", 48, "Start nicht moeglich"
  WScript.Quit 1
End If

' Dateiadresse bilden: Sonderzeichen kodieren, Backslashes zu Schraegstrichen
url = Replace(dir, "%", "%25")
url = Replace(url, " ", "%20")
url = Replace(url, "#", "%23")
url = Replace(url, "\", "/")
If Left(url, 2) = "//" Then
  url = "file:" & url & "/index.html"
Else
  url = "file:///" & url & "/index.html"
End If

cmd = q & edge & q & " --app=" & q & url & q & " --user-data-dir=" & q & dir & "\profil" & q & " --disable-gpu --disable-software-rasterizer --no-first-run --no-default-browser-check --window-size=1440,900"
sh.Run cmd, 1, False
