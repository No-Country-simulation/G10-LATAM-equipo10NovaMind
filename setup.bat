@echo off
setlocal

echo =======================================================
echo    Instalacion Automatica del Entorno - NuevaMente
echo =======================================================
echo.

REM 1. Verificar si Python esta instalado
python --version >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Python no esta instalado o no se encuentra en el PATH.
    echo Por favor, instala Python 3.12.7 y marca "Add Python to PATH".
    echo.
    pause
    exit /b 1
)

echo [OK] Python detectado:
python --version
echo.

REM 2. Crear entorno virtual .venv si no existe
if not exist ".venv" (
    echo [1/4] Creando entorno virtual en .venv...
    python -m venv .venv
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
pip install -r requirements.txt
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
echo Para ejecutar las pruebas automatizadas (63 tests):
echo   python -m pytest backend/tests -v
echo.
pause
