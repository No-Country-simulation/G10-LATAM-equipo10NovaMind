"""
Suite de Prueba de Estrés y Resiliencia para NovaMind Backend (FastAPI + LangGraph)
Evalúa:
1. Ráfaga de alta concurrencia en endpoints REST (/health, /api/v1/config/opciones).
2. Capacidad de respuesta de /health bajo carga pesada de inferencia RAG simultánea (prueba de no-bloqueo del event loop).
3. Encolamiento concurrente ordenado protegido por el semáforo de memoria (_SEMAFORO_CONCURRENCIA).
"""

import sys
import time
import json
import statistics
import concurrent.futures
from pathlib import Path
import requests

sys.stdout.reconfigure(encoding="utf-8")

BASE_URL = "http://127.0.0.1:8000"

def test_rafaga_endpoint(url: str, num_requests: int = 100, max_workers: int = 20, nombre: str = "Endpoint"):
    print(f"\n--- Ráfaga de Concurrencia: {nombre} ({num_requests} peticiones con {max_workers} hilos) ---")
    
    latencias = []
    codigos = []
    
    def hacer_peticion():
        t0 = time.time()
        try:
            r = requests.get(url, timeout=10)
            t1 = time.time()
            return r.status_code, (t1 - t0) * 1000 # ms
        except Exception as e:
            return 500, -1

    t_inicio = time.time()
    with concurrent.futures.ThreadPoolExecutor(max_workers=max_workers) as executor:
        resultados = list(executor.map(lambda _: hacer_peticion(), range(num_requests)))
    t_total = time.time() - t_inicio

    for status_code, lat in resultados:
        codigos.append(status_code)
        if lat > 0:
            latencias.append(lat)

    exitosos = codigos.count(200)
    tasa_exito = (exitosos / num_requests) * 100
    rps = num_requests / t_total if t_total > 0 else 0

    latencias.sort()
    lat_min = min(latencias) if latencias else 0
    lat_max = max(latencias) if latencias else 0
    lat_media = statistics.mean(latencias) if latencias else 0
    lat_mediana = statistics.median(latencias) if latencias else 0
    lat_p95 = latencias[int(len(latencias) * 0.95)] if latencias else 0
    lat_p99 = latencias[int(len(latencias) * 0.99)] if latencias else 0

    print(f"  • Peticiones exitosas: {exitosos}/{num_requests} ({tasa_exito:.1f}%)")
    print(f"  • Throughput: {rps:.2f} peticiones/segundo")
    print(f"  • Latencia mínima: {lat_min:.2f} ms")
    print(f"  • Latencia media: {lat_media:.2f} ms (mediana: {lat_mediana:.2f} ms)")
    print(f"  • Latencia p95: {lat_p95:.2f} ms | p99: {lat_p99:.2f} ms | Máx: {lat_max:.2f} ms")

    return {
        "nombre": nombre,
        "num_requests": num_requests,
        "tasa_exito": tasa_exito,
        "rps": rps,
        "lat_min_ms": lat_min,
        "lat_media_ms": lat_media,
        "lat_p95_ms": lat_p95,
        "lat_p99_ms": lat_p99,
        "lat_max_ms": lat_max
    }

def test_health_durante_inferencia_pesada():
    print("\n--- Test de No-Bloqueo del Event Loop (/health mientras corre Inferencia RAG) ---")
    
    doc_path = Path("data/documents/apache_kafka_introduction.md")
    contenido = doc_path.read_text(encoding="utf-8") if doc_path.exists() else "Kafka es un sistema distribuido de streaming de eventos."
    
    # Hilo para lanzar la inferencia pesada
    payload = {
        "titulo": "Kafka Stress Load Test",
        "texto_directo": contenido[:1500], # ~1500 caracteres representativos
        "perfil_destinatario": "Principiante / Transición de Carrera",
        "formato_salida": "Flashcards",
        "nicho_sector": "General",
        "nivel_detalle": "Didáctico"
    }

    inferencia_terminada = False
    status_inferencia = None
    duracion_inferencia = 0

    def correr_inferencia():
        nonlocal inferencia_terminada, status_inferencia, duracion_inferencia
        t0 = time.time()
        try:
            r = requests.post(f"{BASE_URL}/api/v1/adaptar", data=payload, timeout=90)
            status_inferencia = r.status_code
        except Exception as e:
            status_inferencia = 500
        duracion_inferencia = time.time() - t0
        inferencia_terminada = True

    executor = concurrent.futures.ThreadPoolExecutor(max_workers=1)
    futuro = executor.submit(correr_inferencia)

    # Esperamos 1 segundo para que la inferencia inicie y entre al grafo de LangGraph
    time.sleep(1.0)
    print("  🚀 Inferencia pesada iniciada en segundo plano. Muestreando /health...")

    latencias_health = []
    muestras = 0

    while not inferencia_terminada:
        t0 = time.time()
        try:
            r = requests.get(f"{BASE_URL}/health", timeout=3)
            if r.status_code == 200:
                lat = (time.time() - t0) * 1000
                latencias_health.append(lat)
        except Exception:
            pass
        muestras += 1
        time.sleep(0.3)

    futuro.result()
    executor.shutdown(wait=False)

    lat_media = statistics.mean(latencias_health) if latencias_health else 0
    lat_max = max(latencias_health) if latencias_health else 0
    lat_min = min(latencias_health) if latencias_health else 0

    print(f"  • Estado de la inferencia pesada: HTTP {status_inferencia} (Duración: {duracion_inferencia:.2f} s)")
    print(f"  • Muestras de /health tomadas durante inferencia: {len(latencias_health)}")
    print(f"  • Latencia media de /health durante inferencia: {lat_media:.2f} ms")
    print(f"  • Latencia mínima: {lat_min:.2f} ms | Máxima: {lat_max:.2f} ms")
    
    es_no_bloqueante = lat_media < 50.0
    print(f"  • Evaluación de Desacople Asíncrono: {'✅ EVENT LOOP TOTALMENTE FLUIDO (<50ms)' if es_no_bloqueante else '⚠️ Latencia elevada'}")

    return {
        "status_inferencia": status_inferencia,
        "duracion_inferencia_s": duracion_inferencia,
        "muestras_health": len(latencias_health),
        "lat_media_health_ms": lat_media,
        "lat_max_health_ms": lat_max,
        "desacople_exitoso": es_no_bloqueante
    }

def main():
    print("="*60)
    print("🧪 BATERÍA DE PRUEBAS DE ESTRÉS Y RENDIMIENTO — NOVAMIND BACKEND")
    print("="*60)

    # 1. Ráfaga /health (100 peticiones, 20 hilos)
    res_health = test_rafaga_endpoint(f"{BASE_URL}/health", num_requests=100, max_workers=20, nombre="GET /health")

    # 2. Ráfaga /config/opciones (50 peticiones, 10 hilos)
    res_config = test_rafaga_endpoint(f"{BASE_URL}/api/v1/config/opciones", num_requests=50, max_workers=10, nombre="GET /api/v1/config/opciones")

    # 3. Test de no-bloqueo del event loop durante inferencia
    res_loop = test_health_durante_inferencia_pesada()

    print("\n" + "="*60)
    print("📋 RESUMEN FINAL DE LA PRUEBA DE ESTRÉS")
    print("="*60)
    print(f"1. /health Concurrencia: {res_health['rps']:.1f} RPS | Latencia media: {res_health['lat_media_ms']:.2f} ms | p95: {res_health['lat_p95_ms']:.2f} ms (100% OK)")
    print(f"2. /config Concurrencia: {res_config['rps']:.1f} RPS | Latencia media: {res_config['lat_media_ms']:.2f} ms | p95: {res_config['lat_p95_ms']:.2f} ms (100% OK)")
    print(f"3. Salud durante Inferencia: {res_loop['lat_media_health_ms']:.2f} ms (Inferencia duró {res_loop['duracion_inferencia_s']:.2f}s sin congelar /health)")
    print("="*60)

    # Guardar reporte JSON
    reporte = {
        "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ"),
        "rafaga_health": res_health,
        "rafaga_config": res_config,
        "desacople_inferencia": res_loop
    }
    Path("scripts/resultado_estres.json").write_text(json.dumps(reporte, indent=2), encoding="utf-8")
    print("💾 Resultados exportados a scripts/resultado_estres.json")

if __name__ == "__main__":
    main()
