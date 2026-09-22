@echo off
setlocal
title NuevaMente - Lanzador de Servicios Locales

echo =======================================================
echo     Iniciando Servicios de NuevaMente en Local
echo =======================================================
echo.

REM 1. Verificar .venv
if not exist ".venv\Scripts\python.exe" (
    echo [ERROR] No se encontro el entorno virtual .venv.
    echo Ejecuta primero setup.bat para instalar las dependencias.
    pause
    exit /b 1
)

REM 2. Iniciar Backend FastAPI en segundo plano / ventana propia
echo [1/2] Levantando Backend (FastAPI) en http://127.0.0.1:8000 ...
start "NuevaMente - Backend FastAPI (Puerto 8000)" cmd /k "title Backend FastAPI && cd /d "%~dp0backend" && ..\.venv\Scripts\python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload"

echo Esperando 3 segundos a que inicialice el Backend...
timeout /t 3 /nobreak >nul

REM 3. Iniciar Frontend Streamlit en ventana propia
echo [2/2] Levantando Frontend (Streamlit) en http://127.0.0.1:8501 ...
start "NuevaMente - Frontend Streamlit (Puerto 8501)" cmd /k "title Frontend Streamlit && cd /d "%~dp0frontend" && ..\.venv\Scripts\python.exe -m streamlit run app/streamlit_app.py --server.port 8501"

echo.
echo =======================================================
echo   Servicios Iniciados!
echo =======================================================
echo  - Backend API: http://127.0.0.1:8000
echo  - Documentacion Swagger: http://127.0.0.1:8000/docs
echo  - Interfaz Web Streamlit: http://localhost:8501
echo =======================================================
echo.
echo Abriendo la aplicacion en tu navegador...
start http://localhost:8501
echo.
echo Puedes cerrar esta ventana. Los servicios quedan corriendo en sus ventanas individuales.
pause
