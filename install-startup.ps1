$key = "HKCU:\Software\Microsoft\Windows\CurrentVersion\Run"
$value = 'wscript.exe "C:\Users\User\Desktop\product-stock\posee-v2\start-pos-silent.vbs"'
Set-ItemProperty -Path $key -Name "POS_AutoStart" -Value $value
Write-Host "Added to Registry Run key for auto-start on login"
