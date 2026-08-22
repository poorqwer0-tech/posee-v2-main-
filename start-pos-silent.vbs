Set WshShell = CreateObject("WScript.Shell")
WshShell.CurrentDirectory = "C:\Users\User\Desktop\product-stock\posee-v2"
WshShell.Run "cmd /c pm2 resurrect", 0, False
