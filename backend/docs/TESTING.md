# Estrategia de Testing y Calidad

## Panorama de Pruebas

El sistema cuenta con una suite completa de pruebas automatizadas, deterministas y de integración que cubren tanto el backend en FastAPI como el frontend en React 19:

- **Backend:** 300 pruebas automatizadas en `backend/tests/` ejecutadas con `pytest`.
- **Frontend:** 26 pruebas unitarias en `frontend/src/` y `frontend/tests/` ejecutadas con `vitest`.
- **Verificación de Tipos:** Análisis estático limpio con TypeScript (`tsc --noEmit`).


## 1. Comandos de Ejecución

### Backend (Python / pytest)
Desde la raíz del repositorio:
```powershell
cd backend
python -m pytest -q
```
O con mayor nivel de detalle:
```powershell
python -m pytest tests -v
```

### Frontend (React / vitest y TypeScript)
```powershell
cd frontend
npm test
npx tsc --noEmit -p .
```


## 2. Estructura de la Suite de Backend

Las pruebas de backend son **100% deterministas**: las llamadas a LLMs externos (Gemini, Groq, Cohere), APIs de voz (ElevenLabs) y almacenamiento OCI se simulan mediante *test doubles* y fixtures automáticos (`autouse`), garantizando que la ejecución de la suite no consuma cuotas de API ni dependa de conectividad a Internet.

| Archivo de Prueba | Cobertura Principal |
|---|---|
| **`test_api.py`** | Endpoints de FastAPI (`/health`, `/config/opciones`, `/adaptar`, `/adaptar/stream`, `/paquetes`), validación de contratos HTTP y manejo de códigos de error 404/422. |
| **`test_generacion_paralela.py`** | Orquestación paralela de tareas A, B1, B2 y C, semáforos de concurrencia, ensamblado incremental y emisión de eventos SSE. |
| **`test_servicio_gemini.py`** | Resiliencia ante errores HTTP 429, distinción entre cuota por minuto y cuota diaria, fail-fast en memoria y reintentos con jitter. |
| **`test_contexto_documental.py`** | Verificador de procedencia y citas documentales (`fuentes.py`), cálculo de offsets de página, bloques de código markdown y extracción de contexto. |
| **`test_critico_multiproveedor.py`** | Auditoría neutral de afirmaciones, esquemas JSON estructurados nativos con Gemini 2.5 Flash y fallback a Groq. |
| **`test_integracion_offline.py`** | Pipeline de integración completo con agentes simulados, ciclo reflexivo y persistencia local resiliente. |
| **`test_orquestador.py`** | Normalización de alias, inyección de few-shots según formato pedagógico, cálculo de anclaje de fuentes y límites de lotes. |


## 3. Pruebas Especiales y Certificación End-to-End

### Validación E2E con Apache Kafka (`scripts/test_kafka_e2e.py`)
Certifica la orquestación en vivo contra el documento técnico oficial de Kafka (11.052 caracteres):
- Indexación de fragmentos en ChromaDB.
- Generación de flashcards y analogías pedagógicas.
- Evaluación punto por punto de afirmaciones con Gemini 2.5 Flash.
- Verificación de anclaje de fuentes (100% fidelidad, 0 alucinaciones).

### Prueba de Estrés y No-Bloqueo del Event Loop (`scripts/prueba_estres.py`)
Resultados empíricos obtenidos bajo tráfico concurrente:
- **Ráfaga masiva `/health`:** 100/100 solicitudes exitosas a **137.24 RPS** con latencia media de 115 ms.
- **Ráfaga `/api/v1/config/opciones`:** 50/50 exitosas a **144.32 RPS** con latencia media de 21 ms.
- **No-Bloqueo:** Durante una inferencia pesada de 71 segundos, se respondieron 229 solicitudes continuas de `/health` con **latencia promedio de 9.27 ms** (0% congelamiento de Event Loop).
- **Consumo de memoria:** Huella de RAM de Python contenida en ~172 MB bajo carga máxima.

---

## 🔗 Navegación
* 🧭 [**Índice General del Proyecto (#back)**](../../INDEX.md#back)
* 📚 [**Directorio de Guías del Backend**](README.md)
* 🚀 [**Portada del Backend**](../README.md)
