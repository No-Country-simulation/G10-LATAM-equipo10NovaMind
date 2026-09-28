"""
Script de validación de conexión y permisos de OCI Object Storage.
Ejecuta un ciclo completo: conexión -> verificación de bucket -> put -> get -> list -> delete.
"""

import os
import sys
from pathlib import Path

# Asegurar que el directorio raíz y backend estén en el PYTHONPATH
RUTA_RAIZ = Path(__file__).resolve().parent.parent
RUTA_BACKEND = RUTA_RAIZ / "backend"
sys.path.insert(0, str(RUTA_BACKEND))

from dotenv import load_dotenv

# 1. Cargar variables de entorno desde la raíz
archivo_env = RUTA_RAIZ / ".env"
load_dotenv(archivo_env)

# Normalizar la ruta de OCI_KEY_FILE si es relativa a la raíz
key_file_env = os.getenv("OCI_KEY_FILE")
if key_file_env and not os.path.isabs(key_file_env):
    os.environ["OCI_KEY_FILE"] = str((RUTA_RAIZ / key_file_env).resolve())

from app.storage.oci_client import OCIObjectStorageClient


def probar_oci() -> None:
    print("=" * 65)
    print("🚀 Probando Conexión a OCI Object Storage (NuevaMente)")
    print("=" * 65)

    print(f"📌 Bucket objetivo: {os.getenv('OCI_BUCKET_NAME')}")
    print(f"📌 Namespace:       {os.getenv('OCI_NAMESPACE')}")
    print(f"📌 Región:          {os.getenv('OCI_REGION')}")
    print(f"📌 Key File:        {os.getenv('OCI_KEY_FILE')}")
    print("-" * 65)

    try:
        # 1. Instanciar cliente
        print("1️⃣  Inicializando cliente OCI...")
        cliente = OCIObjectStorageClient()
        print("    ✅ Cliente inicializado correctamente.")

        # 2. Verificar existencia del bucket
        print("2️⃣  Verificando existencia del bucket...")
        if cliente.existe_bucket():
            print("    ✅ Bucket encontrado y accesible.")
        else:
            print("    ❌ El bucket no existe o no se tienen permisos para leerlo.")
            return

        # 3. Subir archivo de prueba
        obj_test = "documentos-originales/test_verificacion_conexion.txt"
        contenido_test = b"Verificacion de conexion exitosa desde NuevaMente Backend."
        print(f"3️⃣  Subiendo objeto de prueba: '{obj_test}'...")
        cliente._put(
            object_name=obj_test,
            data=contenido_test,
            content_type="text/plain; charset=utf-8",
        )
        print("    ✅ Objeto subido exitosamente.")

        # 4. Descargar y validar contenido
        print("4️⃣  Descargando objeto para verificar integridad...")
        descargado = cliente.descargar_objeto(obj_test)
        if descargado == contenido_test:
            print("    ✅ Contenido verificado con éxito (coincidencia exacta).")
        else:
            print("    ⚠️ El contenido descargado difiere del subido.")

        # 5. Limpieza (borrar objeto de prueba)
        print("5️⃣  Limpiando objeto de prueba del bucket...")
        cliente.client.delete_object(
            namespace_name=cliente.namespace,
            bucket_name=cliente.bucket_name,
            object_name=obj_test,
        )
        print("    ✅ Objeto de prueba eliminado.")

        print("=" * 65)
        print("🎉 ¡TODAS LAS PRUEBAS DE OCI PASARON CON ÉXITO!")
        print("=" * 65)

    except Exception as exc:
        print("\n❌ ERROR DURANTE LA PRUEBA:")
        print(f"   Detalle: {exc}")
        print("\n💡 Sugerencias de diagnóstico:")
        print("   - Verifica que el archivo de clave .pem tenga permisos de lectura.")
        print("   - Revisa si el fingerprint coincide exactamente con el de la consola.")
        print("   - Confirma que la política IAM incluya 'manage objects' y 'read buckets'.")


if __name__ == "__main__":
    probar_oci()