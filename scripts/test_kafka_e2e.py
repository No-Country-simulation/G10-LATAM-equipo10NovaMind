"""
Script de prueba End-to-End para NovaMind con apache_kafka_introduction.md
"""

import sys
import time
import json
import requests
from pathlib import Path

sys.stdout.reconfigure(encoding="utf-8")

def main():
    doc_path = Path("data/documents/apache_kafka_introduction.md")
    if not doc_path.exists():
        print(f"ERROR: Archivo no encontrado en {doc_path}")
        return

    content = doc_path.read_text(encoding="utf-8")
    print(f"📄 Documento cargado: {doc_path.name} ({len(content)} caracteres)")

    url = "http://127.0.0.1:8000/api/v1/adaptar"
    payload = {
        "titulo": "Introducción a Apache Kafka",
        "documento_contenido": content,
        "perfil_destinatario": "Principiante / Transición de Carrera",
        "formato_salida": "Flashcards",
        "nicho_sector": "General",
        "nivel_detalle": "Didáctico"
    }

    print("🚀 Enviando solicitud POST /api/v1/adaptar...")
    start_time = time.time()
    
    try:
        response = requests.post(url, data=payload, timeout=90)
        elapsed = time.time() - start_time
        print(f"⏱️ Tiempo total de respuesta: {elapsed:.2f} s")
        print(f"📡 Código de respuesta HTTP: {response.status_code}")

        if response.status_code == 200:
            data = response.json()
            evaluacion = data.get("evaluacion_calidad", {})
            almacenamiento = data.get("almacenamiento_oci", {})
            metadatos = data.get("metadatos", {})
            contenido = data.get("contenido_adaptado", {})

            print("\n" + "="*50)
            print("✅ PRUEBA E2E EXITOSA: METRICAS CLAVE")
            print("="*50)
            print(f"• Título Adaptado: {contenido.get('titulo')}")
            print(f"• Score de Anclaje RAG: {evaluacion.get('anclaje_fuente_score')}")
            print(f"• Claridad Pedagógica: {evaluacion.get('claridad_pedagogica')}")
            print(f"• Afirmaciones auditadas: {len(evaluacion.get('afirmaciones', []))}")
            print(f"• Observaciones del Crítico: {evaluacion.get('observaciones')}")
            print(f"• Items generados: {len(contenido.get('items', []))}")
            print(f"• Persistencia OCI Status: {almacenamiento.get('status_upload')}")
            print(f"• Objeto ID OCI: {almacenamiento.get('objeto_id')}")
            print(f"• Modelo LLM: {metadatos.get('modelo_llm')}")
            print(f"• Tiempo estimado estudio: {metadatos.get('tiempo_estimado_estudio_minutos')} min")
            print("="*50)

            out_file = Path("scripts/resultado_test_kafka.json")
            out_file.write_text(json.dumps(data, indent=2, ensure_ascii=False), encoding="utf-8")
            print(f"\n💾 Paquete completo guardado en {out_file}")
        else:
            print(f"❌ Error en respuesta: {response.text}")
    except Exception as e:
        print(f"❌ Excepción durante la petición: {e}")

if __name__ == "__main__":
    main()
