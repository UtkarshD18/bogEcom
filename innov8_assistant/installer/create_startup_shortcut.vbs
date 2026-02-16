Option Explicit

Dim shell, fso, scriptDir, projectRoot, startupFolder
Dim targetExe, targetArgs, shortcutPath, shortcut, iconPath

Set shell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")

scriptDir = fso.GetParentFolderName(WScript.ScriptFullName)
projectRoot = fso.GetAbsolutePathName(fso.BuildPath(scriptDir, ".."))
startupFolder = shell.SpecialFolders("Startup")

targetExe = fso.BuildPath(projectRoot, "dist\INNOV8Assistant2026\INNOV8Assistant2026.exe")
targetArgs = ""

If Not fso.FileExists(targetExe) Then
  targetExe = "pythonw.exe"
  targetArgs = "-m innov8_assistant.main"
End If

shortcutPath = fso.BuildPath(startupFolder, "IN.N.O.V8 Assistant 2026.lnk")
Set shortcut = shell.CreateShortcut(shortcutPath)
shortcut.TargetPath = targetExe
shortcut.Arguments = targetArgs
shortcut.WorkingDirectory = projectRoot
shortcut.WindowStyle = 1
shortcut.Description = "Launch IN.N.O.V8 Assistant 2026 at startup"

iconPath = fso.BuildPath(projectRoot, "assets\innov8.ico")
If fso.FileExists(iconPath) Then
  shortcut.IconLocation = iconPath
End If

shortcut.Save
WScript.Echo "Startup shortcut created at: " & shortcutPath
