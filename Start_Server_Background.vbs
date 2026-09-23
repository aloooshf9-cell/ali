Set WshShell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")
strPath = fso.GetParentFolderName(WScript.ScriptFullName)
WshShell.CurrentDirectory = strPath

' Ensure logs directory exists
If Not fso.FolderExists(strPath & "\logs") Then
    fso.CreateFolder(strPath & "\logs")
End If

' Run node start.js completely hidden (window style 0), detached
WshShell.Run "cmd.exe /c node start.js > logs\app.log 2>&1", 0, False
Set WshShell = Nothing

