@echo off
schtasks /Create /TN POS_AutoStart /XML "C:\Users\User\Desktop\product-stock\posee-v2\autostart-task.xml" /F
echo Done!
pause
