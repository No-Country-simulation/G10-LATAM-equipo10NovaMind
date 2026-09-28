# Auditoría estática del proyecto

## Alcance
Inspección estática de los archivos fuente y configuración incluidos en el ZIP. No se ejecutaron pruebas, análisis dinámico, escaneo de dependencias ni pentest. Los hallazgos describen código/configuración observados y requieren validación operativa.

## Hallazgos principales

### 1. Divergencia entre configuración documentada y configuración consumida
`.env.example` incluye, entre otras, `EMBEDDING_MODEL`, `TOP_K`, `CHROMA_PATH` y `CHROMA_COLLECTION_NAME`. `backend/app/core/config.py` consume `COHERE_EMBEDDING_MODEL`, `TOP_K_CHUNKS`, `AGENTE1_CHROMA_PATH` y `AGENTE1_COLLECTION_NAME`. `rag_pipeline.py` usa otro grupo (`CHROMA_PERSIST_DIR`, `CHROMA_COLLECTION_NAME`, `LOCAL_EMBEDDINGS_MODEL`, `EMBEDDINGS_PROVIDER`). **Impacto:** ajustes de entorno podrían no aplicarse al componente esperado. **Acción:** definir una única fuente de configuración y documentar qué pipeline se utiliza efectivamente.

### 2. Dos módulos de orquestación
Coexisten `backend/app/orquestador.py` y `backend/app/core/orchestrator.py`, con mecanismos y proveedores configurables distintos. El endpoint importa `OrquestadorNuevaMente` desde `app.orquestador`. **Impacto:** confusión sobre la ruta activa y documentación desactualizada. **Acción:** decidir si ambos se mantienen, separar claramente su propósito o retirar el módulo no utilizado tras pruebas.

### 3. CORS abierto y ausencia de autenticación visible
La API permite todos los orígenes, métodos y headers, y no se observa autenticación en endpoints. **Impacto:** exposición de generación, consumo de recursos y acceso a paquetes si el servicio se publica. **Acción:** controles P0 indicados en SECURITY.

### 4. Ingesta de archivos
La API lee el archivo completo en memoria y la ingesta escribe con el nombre recibido bajo `data/documents`. No se observa límite explícito de tamaño ni normalización defensiva del nombre antes de construir la ruta. **Acción:** imponer límite, generar nombre seguro, aislar rutas y establecer cuotas.

### 5. Persistencia local/OCI y comportamiento de fallback
Hay adaptadores de almacenamiento local y OCI. Los endpoints de paquetes intentan OCI si se definen namespace y bucket, y en ciertas excepciones recurren a local. La selección del adaptador del flujo de generación depende de `crear_orquestador`. **Acción:** documentar y probar un modo de almacenamiento explícito, evitando que fallback oculte fallos operativos.

### 6. Diferencias entre README y código
La documentación raíz describe arquitectura, dependencias y número de tests, pero algunos nombres/rutas/valores no coinciden con los módulos observados. Esta documentación evita afirmar conteos de tests o despliegue verificado. **Acción:** convertir la configuración y comandos en pruebas/documentación mantenidas por CI.

### 7. Versiones y compatibilidad de dependencias
Los requirements fijan versiones para varias dependencias, pero también contienen rangos y referencias de proveedores que pueden cambiar. No se encontró evidencia de un lockfile reproducible en el inventario revisado. **Acción:** fijar versiones transitivas y probar instalación limpia.

### 8. Observabilidad y operación
No se identificaron métricas/alertas ni readiness check de dependencias. `/health` solo devuelve estado estático. **Acción:** agregar health/readiness diferenciados, métricas, correlación de solicitudes y runbook.

## Matriz de prioridad

| Prioridad | Tema | Acción |
|---|---|---|
| P0 | Seguridad API | Autenticación, autorización, CORS restrictivo, límites de subida |
| P1 | Configuración divergente | Unificar nombres y probar carga de configuración |
| P1 | Rutas de archivo | Sanitizar nombres, límites y aislamiento |
| P1 | Persistencia | Definir modo único y pruebas de fallback |
| P2 | Doble orquestador | Clarificar propósito y retirar duplicación innecesaria |
| P2 | Observabilidad | Readiness, métricas y alertas |
| P2 | Reproducibilidad | Lockfile, CI y tests de instalación limpia |

## Datos no confirmados
- Estado real de despliegue en OCI o cualquier nube.
- Resultados actuales de la suite completa y cobertura.
- Configuración efectiva de producción.
- Límites operativos de documentos, concurrencia y coste de llamadas a modelos.
- Si el módulo `core/orchestrator.py` está usado por alguna ruta alternativa externa al endpoint revisado.
