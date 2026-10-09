@echo off
setlocal

echo =======================================================
echo    Instalacion Automatica del Entorno - NovaMind
echo =======================================================
echo.

REM 1. Detectar Python 3.12 (preferir py -3.12, fallback a python en PATH)
set "PYTHON_CMD="
py -3.12 -c "import sys; raise SystemExit(0 if sys.version_info[:2] == (3, 12) else 1)" >nul 2>&1
if not errorlevel 1 (
    set "PYTHON_CMD=py -3.12"
) else (
    python -c "import sys; raise SystemExit(0 if sys.version_info[:2] == (3, 12) else 1)" >nul 2>&1
    if not errorlevel 1 set "PYTHON_CMD=python"
)

if not defined PYTHON_CMD (
    echo [ERROR] Se requiere Python 3.12 (version 3.12.x).
    echo Instala Python 3.12 y asegurate de que el launcher py o el ejecutable este en el PATH.
    echo Descarga oficial: https://www.python.org/downloads/release/python-3127/
    echo.
    pause
    exit /b 1
)

echo [OK] Python 3.12 detectado:
%PYTHON_CMD% --version
echo.

REM 2. Crear entorno virtual .venv si no existe
if not exist ".venv" (
    echo [1/5] Creando entorno virtual en .venv...
    %PYTHON_CMD% -m venv .venv
) else (
    echo [1/5] El entorno virtual .venv ya existe.
)

if not exist ".venv\Scripts\activate.bat" (
    echo [ERROR] No se pudo crear el entorno virtual .venv.
    pause
    exit /b 1
)
echo [OK] Entorno virtual listo.
echo.

REM 3. Activar el entorno virtual
echo [2/5] Activando entorno virtual .venv...
call .venv\Scripts\activate.bat

REM 4. Actualizar pip e instalar dependencias del Backend
echo [3/5] Actualizando pip e instalando dependencias de requirements.txt...
python -m pip install --upgrade pip
python -m pip install -r requirements.txt
if errorlevel 1 (
    echo.
    echo [ERROR] Ocurrio un error al instalar los paquetes de requirements.txt.
    pause
    exit /b 1
)
echo [OK] Dependencias de Python instaladas correctamente.
echo.

REM 5. Instalar dependencias del Frontend (React + Vite)
echo [4/5] Verificando e instalando dependencias del Frontend (React)...
where npm >nul 2>&1
if not errorlevel 1 (
    if exist "frontend\package.json" (
        echo Instalando paquetes npm en frontend...
        cd /d "%~dp0frontend"
        call npm.cmd install
        cd /d "%~dp0"
        echo [OK] Dependencias de Frontend instaladas correctamente.
    )
) else (
    echo [AVISO] Node.js / npm no fue detectado en PATH.
    echo Para ejecutar la interfaz grafica React (Vite), instala Node.js (v18+):
    echo https://nodejs.org/
)
echo.

REM 6. Configurar archivo .env si no existe
echo [5/5] Verificando archivo de variables de entorno (.env)...
if not exist ".env" (
    if exist ".env.example" (
        copy .env.example .env >nul
        echo [OK] Se creo el archivo .env a partir de .env.example.
        echo [AVISO] Recuerda abrir .env y colocar tus claves API (COHERE_API_KEY, GEMINI_API_KEY, GROQ_API_KEY).
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
echo O manualmente:
echo   1. Backend:  cd backend ^&^& ..\.venv\Scripts\uvicorn app.main:app --reload --port 8000
echo   2. Frontend: cd frontend ^&^& npm.cmd run dev
echo.
echo Para ejecutar las pruebas automatizadas (71 tests):
echo   .venv\Scripts\python -m pytest backend/tests -v
echo.
pause
