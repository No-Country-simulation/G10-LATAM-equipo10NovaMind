@echo off
setlocal
title NovaMind - Restablecer Estado Cero (Zero-State)

echo =======================================================
echo    Restablecimiento de Entorno a Estado Cero
echo                     NovaMind
echo =======================================================
echo.

if not exist ".venv\Scripts\python.exe" (
    echo [ERROR] No se encontro el entorno virtual .venv.
    echo Ejecuta primero setup.bat para instalar las dependencias.
    pause
    exit /b 1
)

.venv\Scripts\python.exe scripts\reestablecer_local.py %*

if errorlevel 1 (
    echo.
    echo [ERROR] Ocurrio un fallo durante el restablecimiento.
) else (
    echo.
    echo =======================================================
    echo Para iniciar tu prueba limpia desde cero ejecuta:
    echo   iniciar_local.bat
    echo =======================================================
)

echo.
pause
