@echo off
setlocal
set "PYTHONIOENCODING=utf-8"
title NovaMind - Instalacion y Configuracion de Entorno

echo =======================================================
echo    Instalacion Automatica del Entorno - NovaMind
echo =======================================================
echo.

REM 1. Detectar Python (preferir py -3.12, fallback a python en PATH)
set "PYTHON_CMD="
py -3.12 --version >nul 2>&1
if not errorlevel 1 set "PYTHON_CMD=py -3.12"

if not defined PYTHON_CMD (
    python --version >nul 2>&1
    if not errorlevel 1 set "PYTHON_CMD=python"
)

if not defined PYTHON_CMD (
    echo [ERROR] No se detecto Python instalado en el sistema.
    echo Por favor instala Python 3.12 y asegurate de anadirlo al PATH.
    echo Descarga oficial: https://www.python.org/downloads/
    echo.
    pause
    exit /b 1
)

echo [OK] Interprete Python detectado:
%PYTHON_CMD% --version
echo.

REM 2. Crear entorno virtual .venv si no existe
if not exist "%~dp0.venv" (
    echo [1/5] Creando entorno virtual en .venv...
    %PYTHON_CMD% -m venv "%~dp0.venv"
) else (
    echo [1/5] El entorno virtual .venv ya existe.
)

if not exist "%~dp0.venv\Scripts\activate.bat" (
    echo [ERROR] No se pudo crear o validar el entorno virtual .venv.
    pause
    exit /b 1
)
echo [OK] Entorno virtual listo.
echo.

REM 3. Activar el entorno virtual
echo [2/5] Activando entorno virtual .venv...
call "%~dp0.venv\Scripts\activate.bat"

REM 4. Actualizar pip e instalar dependencias del Backend
echo [3/5] Instalando dependencias de Python desde requirements.txt...
"%~dp0.venv\Scripts\python.exe" -m pip install --upgrade pip
"%~dp0.venv\Scripts\python.exe" -m pip install -r "%~dp0requirements.txt"
if errorlevel 1 (
    echo.
    echo [ERROR] Ocurrio un error al instalar los paquetes de requirements.txt.
    pause
    exit /b 1
)
echo [OK] Dependencias de Python instaladas correctamente.
echo.

REM 5. Instalar dependencias del Frontend (React 19 + Vite)
echo [4/5] Verificando e instalando dependencias del Frontend...
where npm >nul 2>&1
if not errorlevel 1 (
    if exist "%~dp0frontend\package.json" (
        echo Instalando paquetes npm en frontend...
        pushd "%~dp0frontend"
        call npm.cmd install
        popd
        echo [OK] Dependencias de Frontend instaladas correctamente.
    )
) else (
    echo [AVISO] Node.js o npm no fue detectado en PATH.
    echo Para ejecutar la interfaz web de React, instala Node.js version 18 o superior:
    echo https://nodejs.org/
)
echo.

REM 6. Configurar archivo .env si no existe
echo [5/5] Verificando archivo de variables de entorno (.env)...
if not exist "%~dp0.env" (
    if exist "%~dp0.env.example" (
        copy "%~dp0.env.example" "%~dp0.env" >nul
        echo [OK] Se creo el archivo .env a partir de .env.example.
        echo [IMPORTANTE] Abre .env y coloca tus claves de API:
        echo   - COHERE_API_KEY
        echo   - GEMINI_API_KEY
        echo   - ELEVENLABS_API_KEY: opcional para voz de Estacion 4
    )
) else (
    echo [OK] El archivo .env ya existe.
)
echo.

echo =======================================================
echo    Instalacion completada con exito!
echo =======================================================
echo.
echo Para iniciar todos los servicios con 1 solo clic:
echo   iniciar_local.bat
echo.
echo Para ejecutar la suite completa de pruebas:
echo   Backend  (259 tests): .venv\Scripts\python.exe -m pytest backend -q
echo   Frontend  (17 tests): cd frontend ^&^& npm.cmd test
echo =======================================================
echo.
pause
