@echo off
setlocal
set "PYTHONIOENCODING=utf-8"
title NuevaMente - Lanzador de Servicios Locales

echo =======================================================
echo     Iniciando Servicios de NuevaMente en Local
echo =======================================================
echo.

REM 1. Verificar entorno virtual .venv
if not exist "%~dp0.venv\Scripts\python.exe" (
    echo [ERROR] No se encontro el entorno virtual .venv.
    echo Por favor ejecuta primero setup.bat para instalar dependencias.
    echo.
    pause
    exit /b 1
)

REM 2. Verificar archivo .env
if not exist "%~dp0.env" (
    if exist "%~dp0.env.example" (
        echo [AVISO] No se encontro .env. Creando a partir de .env.example...
        copy "%~dp0.env.example" "%~dp0.env" >nul
        echo [OK] Archivo .env generado. Recuerda configurar tus API keys.
        echo.
    ) else (
        echo [ADVERTENCIA] No se encontro .env ni .env.example.
    )
)

REM 3. Verificar dependencias del Frontend
if not exist "%~dp0frontend\node_modules" (
    echo [AVISO] No se detecto la carpeta frontend\node_modules.
    echo Instalando dependencias de React con npm install...
    pushd "%~dp0frontend"
    call npm.cmd install
    popd
    echo [OK] Dependencias de frontend instaladas.
    echo.
)

REM 4. Iniciar Backend FastAPI en ventana propia (desde raiz con --app-dir backend)
echo [1/2] Levantando Backend (FastAPI) en http://127.0.0.1:8000 ...
start "NuevaMente - Backend FastAPI (Puerto 8000)" cmd /k "title NuevaMente - Backend FastAPI && set "PYTHONIOENCODING=utf-8" && cd /d "%~dp0" && .venv\Scripts\python.exe -m uvicorn app.main:app --app-dir backend --host 127.0.0.1 --port 8000 --reload"

echo Esperando 3 segundos a que inicialice el Backend...
timeout /t 3 /nobreak >nul

REM 5. Iniciar Frontend React + Vite en ventana propia
echo [2/2] Levantando Frontend (React 19 + Vite) en http://localhost:5173 ...
start "NuevaMente - Frontend React Vite" cmd /k "title NuevaMente - Frontend React Vite && cd /d "%~dp0frontend" && npm.cmd run dev"

echo Esperando 2 segundos a que inicialice el servidor Vite...
timeout /t 2 /nobreak >nul

echo.
echo =======================================================
echo   Servicios de NuevaMente Iniciados con Exito!
echo =======================================================
echo  - Aplicacion Web (Frontend):    http://localhost:5173
echo  - API REST Backend (FastAPI):   http://127.0.0.1:8000
echo  - Documentacion Swagger:        http://127.0.0.1:8000/docs
echo =======================================================
echo.
echo Abriendo la aplicacion en tu navegador predeterminado...
start http://localhost:5173
echo.
echo Puedes minimizar o cerrar esta consola. Los servicios quedaran
echo activos en sus ventanas independientes.
echo.
pause
