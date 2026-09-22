@echo off
setlocal

echo =======================================================
echo    Instalacion Automatica del Entorno - NuevaMente
echo =======================================================
echo.

REM 1. Detectar exactamente Python 3.12.7
set "PYTHON_CMD="
py -3.12 -c "import sys; raise SystemExit(0 if sys.version_info[:3] == (3, 12, 7) else 1)" >nul 2>&1
if not errorlevel 1 set "PYTHON_CMD=py -3.12"

if not defined PYTHON_CMD (
    echo [ERROR] Se requiere exactamente Python 3.12.7.
    echo Instala Python 3.12.7 y asegurate de que el launcher py lo detecte.
    echo Descarga oficial: https://www.python.org/downloads/release/python-3127/
    echo.
    pause
    exit /b 1
)

echo [OK] Python seleccionado:
%PYTHON_CMD% --version
echo.

REM 2. Crear entorno virtual .venv si no existe
if not exist ".venv" (
    echo [1/4] Creando entorno virtual en .venv...
    %PYTHON_CMD% -m venv .venv
) else (
    echo [1/4] El entorno virtual .venv ya existe.
)

if not exist ".venv\Scripts\activate.bat" (
    echo [ERROR] No se pudo crear el entorno virtual .venv.
    pause
    exit /b 1
)
echo [OK] Entorno virtual listo.
echo.

REM 3. Activar el entorno virtual
echo [2/4] Activando entorno virtual .venv...
call .venv\Scripts\activate.bat

REM 4. Actualizar pip e instalar dependencias
echo [3/4] Actualizando pip e instalando dependencias de requirements.txt...
python -m pip install --upgrade pip
python -m pip install -r requirements.txt
if errorlevel 1 (
    echo.
    echo [ERROR] Ocurrio un error al instalar los paquetes de requirements.txt.
    pause
    exit /b 1
)
echo.
echo [OK] Todas las dependencias se instalaron correctamente.
echo.

REM 5. Configurar archivo .env si no existe
echo [4/4] Verificando archivo de variables de entorno (.env)...
if not exist ".env" (
    if exist ".env.example" (
        copy .env.example .env >nul
        echo [OK] Se creo el archivo .env a partir de .env.example.
        echo [AVISO] Recuerda abrir .env y colocar tu COHERE_API_KEY.
    )
) else (
    echo [OK] El archivo .env ya existe.
)
echo.

echo =======================================================
echo    Instalacion completada con exito!
echo =======================================================
echo.
echo Para trabajar en este proyecto ejecuta en la terminal:
echo   .venv\Scripts\activate
echo.
echo Para ejecutar el Backend (FastAPI):
echo   cd backend ^&^& uvicorn app.main:app --reload --port 8000
echo.
echo Para ejecutar el Frontend (Streamlit):
echo   cd frontend ^&^& streamlit run app/streamlit_app.py
echo.
echo Para ejecutar las pruebas automatizadas (64 tests):
echo   python -m pytest backend/tests -v
echo.
pause
