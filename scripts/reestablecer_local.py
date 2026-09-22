#!/usr/bin/env python3
"""
scripts/reestablecer_local.py
-----------------------------
Herramienta para restablecer el entorno local de NuevaMente a estado CERO (Zero-State).

Limpia:
- Bases de datos vectoriales de prueba (ChromaDB en backend/data/chroma y chroma_db/).
- Contenidos generados previamente (backend/data/outputs/contenidos_generados/*).
- Documentos temporales subidos (backend/data/outputs/documentos_originales/*).
- Caches de Python (__pycache__, .pytest_cache).

Verifica:
- Archivo .env y clave COHERE_API_KEY.
- Existencia del entorno virtual .venv.

Recrea:
- Estructura limpia de carpetas con archivos .gitkeep.
"""

import os
import sys
import shutil
from pathlib import Path

# Directorio raíz del proyecto
ROOT_DIR = Path(__file__).resolve().parent.parent

def print_banner():
    print("=" * 65)
    print("      NUEVAMENTE - RESTABLECIMIENTO A ESTADO LIMPIO (ZERO-STATE)")
    print("=" * 65)
    print(f"Directorio Raíz: {ROOT_DIR}\n")

def limpiar_directorio(dir_path: Path, mantener_gitkeep: bool = True):
    """Elimina los contenidos de un directorio preservando la carpeta y .gitkeep."""
    if not dir_path.exists():
        dir_path.mkdir(parents=True, exist_ok=True)
        if mantener_gitkeep:
            (dir_path / ".gitkeep").touch()
        return 0

    elementos_borrados = 0
    for item in dir_path.iterdir():
        if mantener_gitkeep and item.name == ".gitkeep":
            continue
        try:
            if item.is_dir():
                shutil.rmtree(item, ignore_errors=True)
            else:
                item.unlink(missing_ok=True)
            elementos_borrados += 1
        except Exception as e:
            print(f"  [AVISO] No se pudo eliminar {item}: {e}")

    if mantener_gitkeep and not (dir_path / ".gitkeep").exists():
        (dir_path / ".gitkeep").touch()

    return elementos_borrados

def limpiar_pycache(base_dir: Path):
    """Elimina recursivamente carpetas __pycache__ y archivos .pyc/.pyo."""
    borrados = 0
    for pycache in base_dir.rglob("__pycache__"):
        if ".venv" in str(pycache) or "venv" in str(pycache):
            continue
        try:
            shutil.rmtree(pycache, ignore_errors=True)
            borrados += 1
        except Exception:
            pass
    return borrados

def main():
    print_banner()

    mantener_vectores = "--mantener-vectores" in sys.argv or "--keep-vectors" in sys.argv

    if mantener_vectores:
        print("[1/5] [PRESERVADO] Base vectorial ChromaDB PRESERVADA (--mantener-vectores activo).")
    else:
        print("[1/5] Limpiando base vectorial ChromaDB...")
        rutas_chroma = [
            ROOT_DIR / "backend" / "data" / "chroma",
            ROOT_DIR / "backend" / "chroma_db",
            ROOT_DIR / "chroma_db",
            ROOT_DIR / "data" / "chroma",
        ]
        for ruta in rutas_chroma:
            if ruta.exists():
                n = limpiar_directorio(ruta, mantener_gitkeep=True)
                print(f"  -> Limpiado: {ruta.relative_to(ROOT_DIR)} ({n} elementos eliminados)")
            else:
                ruta.mkdir(parents=True, exist_ok=True)
                (ruta / ".gitkeep").touch()
                print(f"  -> Inicializado vacio: {ruta.relative_to(ROOT_DIR)}")

    print("\n[2/5] Limpiando almacenamiento de salida local...")
    rutas_outputs = [
        ROOT_DIR / "backend" / "data" / "outputs" / "contenidos_generados",
        ROOT_DIR / "backend" / "data" / "outputs" / "documentos_originales",
    ]
    for ruta in rutas_outputs:
        n = limpiar_directorio(ruta, mantener_gitkeep=True)
        print(f"  -> Limpiado: {ruta.relative_to(ROOT_DIR)} ({n} archivos eliminados)")

    print("\n[3/5] Limpiando caches temporales de Python...")
    n_pycache = limpiar_pycache(ROOT_DIR)
    pytest_cache = ROOT_DIR / ".pytest_cache"
    if pytest_cache.exists():
        shutil.rmtree(pytest_cache, ignore_errors=True)
    backend_pytest = ROOT_DIR / "backend" / ".pytest_cache"
    if backend_pytest.exists():
        shutil.rmtree(backend_pytest, ignore_errors=True)
    print(f"  -> Caches eliminadas ({n_pycache} directorios __pycache__ limpiados)")

    print("\n[4/5] Verificando entorno y credenciales (.env)...")
    env_file = ROOT_DIR / ".env"
    if not env_file.exists():
        env_example = ROOT_DIR / ".env.example"
        if env_example.exists():
            shutil.copy(env_example, env_file)
            print("  [AVISO] .env no existia; se copio desde .env.example.")
        else:
            print("  [ERROR] No se encontro .env ni .env.example.")
    else:
        # Verificar si COHERE_API_KEY tiene contenido
        with open(env_file, "r", encoding="utf-8") as f:
            contenido = f.read()
        if "COHERE_API_KEY" in contenido:
            print("  [OK] Archivo .env verificado con variable COHERE_API_KEY.")
        else:
            print("  [ALERTA] COHERE_API_KEY no detectada en .env.")

    print("\n[5/5] Estado de documentos de prueba para la Demo...")
    doc_demo = ROOT_DIR / "data" / "documents" / "demo_vcn.md"
    if doc_demo.exists():
        print(f"  [OK] Documento de prueba disponible: data/documents/demo_vcn.md ({doc_demo.stat().st_size} bytes)")
    else:
        print("  [INFO] data/documents/ preparado para recibir nuevos documentos.")

    print("\n" + "=" * 65)
    print("  ¡SISTEMA RESTABLECIDO CON EXITO A ESTADO CERO (ZERO-STATE)!")
    print("=" * 65)
    print("\nPara iniciar una prueba limpia desde cero ejecuta:")
    print("  - Opcion 1 (Recomendada con un clic):")
    print("      iniciar_local.bat")
    print("  - Opcion 2 (Manual en dos terminales):")
    print("      Terminal 1 (Backend):")
    print("        .venv\\Scripts\\activate")
    print("        cd backend && uvicorn app.main:app --reload --port 8000")
    print("      Terminal 2 (Frontend):")
    print("        .venv\\Scripts\\activate")
    print("        cd frontend && streamlit run app/streamlit_app.py --server.port 8501")
    print("\nInterfaz Web disponible en: http://localhost:8501\n")

if __name__ == "__main__":
    main()
