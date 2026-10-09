@echo off
setlocal
title NovaMind - Lanzador de Servicios Locales

echo =======================================================
echo     Iniciando Servicios de NovaMind en Local
echo =======================================================
echo.

REM 1. Verificar .venv
if not exist ".venv\Scripts\python.exe" (
    echo [ERROR] No se encontro el entorno virtual .venv.
    echo Ejecuta primero setup.bat para instalar las dependencias.
    pause
    exit /b 1
)

REM 2. Verificar dependencias del Frontend
if not exist "frontend\node_modules" (
    echo [AVISO] No se detecto la carpeta frontend\node_modules.
    echo Instalando dependencias de React con npm install...
    cd /d "%~dp0frontend"
    call npm.cmd install
    cd /d "%~dp0"
    echo.
)

REM 3. Iniciar Backend FastAPI en ventana propia
echo [1/2] Levantando Backend (FastAPI) en http://127.0.0.1:8000 ...
start "NovaMind - Backend FastAPI (Puerto 8000)" cmd /k "title Backend FastAPI && cd /d "%~dp0backend" && ..\.venv\Scripts\python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload"

echo Esperando 3 segundos a que inicialice el Backend...
timeout /t 3 /nobreak >nul

REM 4. Iniciar Frontend React + Vite en ventana propia
echo [2/2] Levantando Frontend (React + Vite) en http://localhost:5173 ...
start "NovaMind - Frontend React Vite" cmd /k "title Frontend React Vite && cd /d "%~dp0frontend" && npm.cmd run dev"

echo Esperando 2 segundos a que inicialice el Frontend...
timeout /t 2 /nobreak >nul

echo.
echo =======================================================
echo   Servicios Iniciados!
echo =======================================================
echo  - Backend API: http://127.0.0.1:8000
echo  - Documentacion Swagger: http://127.0.0.1:8000/docs
echo  - Interfaz Web React (Vite): http://localhost:5173
echo =======================================================
echo.
echo Abriendo la aplicacion en tu navegador...
start http://localhost:5173
echo.
echo Puedes cerrar esta ventana. Los servicios quedan corriendo en sus ventanas individuales.
pause
