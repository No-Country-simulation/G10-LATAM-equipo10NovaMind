#!/usr/bin/env python3
"""
scripts/reestablecer_local.py
-----------------------------
Herramienta integral para restablecer el entorno local de NuevaMente a estado CERO (Zero-State).

Limpia:
- Bases de datos vectoriales de prueba (ChromaDB en backend/data/chroma, data/chroma, chroma_db).
- Contenidos generados previamente (backend/data/outputs/* y data/outputs/*).
- Documentos temporales y originales guardados.
- Caches de Python (__pycache__, .pytest_cache).
- (Opcional con --limpiar-oci): Objetos de prueba en el bucket OCI Object Storage.

Verifica:
- Archivo .env y credenciales COHERE_API_KEY.
- Integración OCI (Bucket, Región, Namespace y existencia de la clave oci_api_key.pem).
- Documentos de prueba disponibles en data/documents/.

Recrea:
- Estructura limpia de carpetas con archivos .gitkeep.
"""

from __future__ import annotations

import os
import shutil
import sys
from pathlib import Path

# Configurar salida segura en UTF-8 para consola de Windows
if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding="utf-8")
        sys.stderr.reconfigure(encoding="utf-8")
    except Exception:
        pass

# Directorio raíz del proyecto
ROOT_DIR = Path(__file__).resolve().parent.parent

# Agregar backend al path para poder importar módulos si es necesario
if str(ROOT_DIR / "backend") not in sys.path:
    sys.path.insert(0, str(ROOT_DIR / "backend"))


def print_banner():
    print("=" * 68)
    print("       NOVAMIND — RESTABLECIMIENTO A ESTADO CERO (ZERO-STATE)")
    print("=" * 68)
    print(f"Directorio Raíz: {ROOT_DIR}\n")


def limpiar_directorio(dir_path: Path, mantener_gitkeep: bool = True) -> int:
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


def limpiar_pycache(base_dir: Path) -> int:
    """Elimina recursivamente carpetas __pycache__ y archivos .pyc/.pyo fuera de .venv."""
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


def verificar_env(env_path: Path) -> dict[str, str]:
    """Lee y parsea las variables clave del archivo .env."""
    variables: dict[str, str] = {}
    if not env_path.exists():
        return variables
    try:
        with open(env_path, "r", encoding="utf-8") as f:
            for linea in f:
                linea = linea.strip()
                if not linea or linea.startswith("#") or "=" not in linea:
                    continue
                k, v = linea.split("=", 1)
                variables[k.strip()] = v.strip().strip("'\"")
    except Exception:
        pass
    return variables


def gestionar_oci(limpiar: bool = False):
    """Verifica y opcionalmente limpia el bucket de OCI Object Storage."""
    try:
        from dotenv import load_dotenv
        load_dotenv(ROOT_DIR / ".env")

        namespace = os.getenv("OCI_NAMESPACE")
        bucket = os.getenv("OCI_BUCKET_NAME")
        if not namespace or not bucket:
            print("  [INFO] OCI no configurado en .env; el orquestador usará fallback local.")
            return

        from app.storage.oci_client import OCIObjectStorageClient

        cliente = OCIObjectStorageClient()
        if not cliente.existe_bucket():
            print(f"  [AVISO] No se pudo acceder al bucket '{bucket}' en OCI.")
            return

        # Listar objetos existentes
        respuesta = cliente.client.list_objects(cliente.namespace, cliente.bucket_name)
        objetos = respuesta.data.objects or []

        if limpiar:
            if not objetos:
                print(f"  [OK] Bucket '{bucket}' ya se encuentra vacío.")
            else:
                print(f"  [OCI] Vaciando {len(objetos)} objeto(s) de prueba del bucket '{bucket}'...")
                for obj in objetos:
                    cliente.client.delete_object(cliente.namespace, cliente.bucket_name, obj.name)
                    print(f"    -> Eliminado de OCI: {obj.name}")
                print(f"  [OK] Bucket OCI '{bucket}' restablecido a estado limpio.")
        else:
            if objetos:
                print(f"  [OK] Conexión OCI activa. {len(objetos)} objeto(s) en bucket '{bucket}'.")
                if sys.stdin.isatty():
                    try:
                        resp = input(f"       ¿Deseas vaciar estos {len(objetos)} objeto(s) de prueba en la nube? (s/N): ").strip().lower()
                        if resp == "s":
                            print(f"  [OCI] Vaciando {len(objetos)} objeto(s) del bucket '{bucket}'...")
                            for obj in objetos:
                                cliente.client.delete_object(cliente.namespace, cliente.bucket_name, obj.name)
                                print(f"    -> Eliminado de OCI: {obj.name}")
                            print(f"  [OK] Bucket OCI '{bucket}' restablecido a estado limpio.")
                            return
                    except Exception:
                        pass
                print("       (Para vaciar también el bucket en la nube usa: reestablecer_local.bat --limpiar-oci)")
            else:
                print(f"  [OK] Conexión OCI activa. Bucket '{bucket}' limpio (0 objetos).")

    except Exception as exc:
        print(f"  [AVISO] No se pudo consultar OCI Object Storage ({exc}).")


def main():
    print_banner()

    mantener_vectores = "--mantener-vectores" in sys.argv or "--keep-vectors" in sys.argv
    limpiar_oci = "--limpiar-oci" in sys.argv or "--clean-oci" in sys.argv

    # 1. Base vectorial ChromaDB
    if mantener_vectores:
        print("[1/6] [PRESERVADO] Base vectorial ChromaDB PRESERVADA (--mantener-vectores activo).")
    else:
        print("[1/6] Limpiando base vectorial ChromaDB...")
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

    # 2. Almacenamiento local (outputs)
    print("\n[2/6] Limpiando almacenamiento de salida local...")
    rutas_outputs = [
        ROOT_DIR / "backend" / "data" / "outputs" / "contenidos_generados",
        ROOT_DIR / "backend" / "data" / "outputs" / "documentos_originales",
        ROOT_DIR / "data" / "outputs" / "contenidos_generados",
        ROOT_DIR / "data" / "outputs" / "documentos_originales",
    ]
    for ruta in rutas_outputs:
        if ruta.exists():
            n = limpiar_directorio(ruta, mantener_gitkeep=True)
            print(f"  -> Limpiado: {ruta.relative_to(ROOT_DIR)} ({n} archivos eliminados)")
        else:
            ruta.mkdir(parents=True, exist_ok=True)
            (ruta / ".gitkeep").touch()
            print(f"  -> Inicializado: {ruta.relative_to(ROOT_DIR)}")

    # 3. Caches de Python y Pytest
    print("\n[3/6] Limpiando caches temporales de Python y Pytest...")
    n_pycache = limpiar_pycache(ROOT_DIR)
    for p_cache in [ROOT_DIR / ".pytest_cache", ROOT_DIR / "backend" / ".pytest_cache"]:
        if p_cache.exists():
            shutil.rmtree(p_cache, ignore_errors=True)
    print(f"  -> Caches eliminadas ({n_pycache} directorios __pycache__ limpiados)")

    # 4. Verificación de archivo .env
    print("\n[4/6] Verificando entorno y credenciales (.env)...")
    env_file = ROOT_DIR / ".env"
    if not env_file.exists():
        env_example = ROOT_DIR / ".env.example"
        if env_example.exists():
            shutil.copy(env_example, env_file)
            print("  [AVISO] .env no existía; se copió desde .env.example.")
        else:
            print("  [ERROR] No se encontró .env ni .env.example.")
    else:
        vars_env = verificar_env(env_file)
        if vars_env.get("COHERE_API_KEY") and vars_env.get("COHERE_API_KEY") != "tu_cohere_api_key_aqui":
            print("  [OK] Clave COHERE_API_KEY configurada.")
        else:
            print("  [ALERTA] COHERE_API_KEY pendiente de configurar en .env.")

        # Verificar clave OCI
        key_file = vars_env.get("OCI_KEY_FILE", "deploy/oci_api_key.pem")
        posibles_key = [
            Path(key_file),
            ROOT_DIR / key_file,
            ROOT_DIR / "deploy" / "oci_api_key.pem",
            ROOT_DIR / "backend" / "deploy" / "oci_api_key.pem",
        ]
        key_encontrada = any(p.exists() for p in posibles_key)
        if key_encontrada and vars_env.get("OCI_BUCKET_NAME"):
            print(f"  [OK] Credenciales OCI Object Storage detectadas (Bucket: {vars_env.get('OCI_BUCKET_NAME')}).")
        else:
            print("  [INFO] OCI incompleto o sin key_file; el sistema utilizará fallback local.")

    # 5. Gestión OCI Object Storage
    print("\n[5/6] Verificando estado en OCI Object Storage Always Free...")
    gestionar_oci(limpiar=limpiar_oci)

    # 6. Documentos disponibles para la Demo
    print("\n[6/6] Verificando documentos de prueba para la Demo...")
    docs_dir = ROOT_DIR / "data" / "documents"
    docs_encontrados = []
    if docs_dir.exists():
        docs_encontrados = sorted([f for f in docs_dir.iterdir() if f.is_file() and f.name != ".gitkeep"])

    if docs_encontrados:
        print(f"  [OK] {len(docs_encontrados)} documento(s) listo(s) en data/documents/:")
        for d in docs_encontrados:
            kb = d.stat().st_size / 1024
            print(f"       [DOC] {d.name} ({kb:.1f} KB)")
    else:
        print("  [AVISO] No hay documentos en data/documents/. Puedes colocar tus PDF, Markdown o TXT allí.")

    print("\n" + "=" * 68)
    print("  !SISTEMA RESTABLECIDO CON EXITO A ESTADO CERO (ZERO-STATE)!")
    print("=" * 68)
    print("\nPara iniciar una prueba limpia desde cero ejecuta:")
    print("  -> iniciar_local.bat")
    print("\nInterfaz Web disponible en: http://localhost:5173\n")


if __name__ == "__main__":
    main()
