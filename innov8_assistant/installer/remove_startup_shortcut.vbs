Option Explicit

Dim shell, fso, startupFolder, shortcutPath

Set shell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")

startupFolder = shell.SpecialFolders("Startup")
shortcutPath = fso.BuildPath(startupFolder, "IN.N.O.V8 Assistant 2026.lnk")

If fso.FileExists(shortcutPath) Then
  fso.DeleteFile shortcutPath, True
  WScript.Echo "Startup shortcut removed: " & shortcutPath
Else
  WScript.Echo "Startup shortcut not found."
End If
