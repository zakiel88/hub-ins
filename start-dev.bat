@echo off
title INS Hub - Dev Servers
echo ============================================
echo   INS Hub - Starting Dev Servers
echo ============================================

:: Set database URL
set DATABASE_URL=postgresql://ins:ins_dev_password@localhost:5433/ins_com

:: Start API server in background
echo.
echo [1/2] Starting API server (port 3001)...
start "INS-API" /D "E:\Antigravity\MBLVD SaaS\apps\api" cmd /c "set DATABASE_URL=postgresql://ins:ins_dev_password@localhost:5433/ins_com && node dist/main.js"

timeout /t 3 /nobreak >nul

:: Start Frontend server
echo [2/2] Starting Frontend server (port 3000)...
start "INS-Frontend" /D "E:\Antigravity\MBLVD SaaS\apps\web" cmd /c "npx next dev -p 3000"

echo.
echo ============================================
echo   Both servers starting!
echo   API:      http://localhost:3001
echo   Frontend: http://localhost:3000
echo ============================================
echo.
echo Press any key to close this window...
pause >nul
