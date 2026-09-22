@echo off
setlocal
title NuevaMente - Restablecer Estado Cero (Zero-State)

echo =======================================================
echo    Restablecimiento de Entorno Local - NuevaMente
echo =======================================================
echo.

REM Verificar si existe entorno virtual .venv
if exist ".venv\Scripts\python.exe" (
    .venv\Scripts\python.exe scripts\reestablecer_local.py
) else (
    python scripts\reestablecer_local.py
)

if errorlevel 1 (
    echo [ERROR] Ocurrio un fallo durante el restablecimiento.
) else (
    echo.
    echo [OK] Proceso terminado.
)

echo.
pause
