@echo off
setlocal
set "PYTHONIOENCODING=utf-8"
title NuevaMente - Restablecer Estado Cero (Zero-State)

echo =======================================================
echo    Restablecimiento de Entorno a Estado Cero
echo                     NuevaMente
echo =======================================================
echo.

if not exist "%~dp0.venv\Scripts\python.exe" (
    echo [ERROR] No se encontro el entorno virtual .venv.
    echo Por favor ejecuta primero setup.bat para instalar las dependencias.
    echo.
    pause
    exit /b 1
)

echo Ejecutando limpieza y restablecimiento seguro...
echo.
"%~dp0.venv\Scripts\python.exe" "%~dp0scripts\reestablecer_local.py" %*

if errorlevel 1 (
    echo.
    echo [ERROR] Ocurrio un fallo durante el restablecimiento del entorno.
) else (
    echo.
    echo =======================================================
    echo   Entorno restablecido correctamente a Estado Cero!
    echo =======================================================
    echo Para iniciar una prueba limpia ejecuta:
    echo   iniciar_local.bat
    echo =======================================================
)

echo.
pause
