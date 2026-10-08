# Seguridad

## Controles observados
- Validación de entrada con modelos Pydantic y validadores de estructura.
- Validación de formatos de archivo soportados (PDF, Markdown y TXT) en la capa de ingesta.
- Separación de configuración mediante variables de entorno.
- Integración OCI basada en archivo de configuración o variables de entorno.
- Mensajes de error amigables en varios caminos del orquestador.

## Controles Implementados y Mitigaciones Recientes
- **CORS Restringido a Entorno Local y Producción:** Se eliminó la política global `allow_origins=["*"]`. En `backend/app/main.py`, CORS autoriza únicamente los orígenes del frontend (`http://localhost:5173`, `http://127.0.0.1:5173`) y herramientas locales con `allow_origin_regex`.
- **Arquitectura Zero Trust en Producción:** Despliegue perimetral mediante Cloudflare Tunnel (`novamind.techgk.cl`). La API en VM 1 (`puerto 8000`) no tiene puertos abiertos a Internet; solo escucha en la red privada VCN desde el proxy inverso Nginx de la VM 2.
- **Protección contra Agotamiento de Recursos y OOM (`asyncio.Semaphore(1)`):** Control de concurrencia a nivel de aplicación que encola peticiones pesadas de LangGraph para proteger la instancia OCI Always Free (1 GB RAM) contra saturación de memoria.
- **Validación Determinista contra Alucinaciones:** Comprobación estricta en Python de que los `chunk_id` citados por el Crítico pertenezcan efectivamente a los fragmentos del documento analizado antes de computar el score.
- **Purga y Saneamiento de Git:** Se ejecutó una reescritura completa del historial con `git-filter-repo` para eliminar cualquier mención de namespaces de OCI reales o identificadores sensibles de todos los commits anteriores.
- **Exclusión de Secretos en `.gitignore`:** Archivos `.env`, claves `.pem`, bitácoras de incidencias internas y manuales privados (`*_PRIVADO.md`) están ignorados global y recursivamente.
- **Validación Estricta de Entradas:** Contratos Pydantic v2 en `backend/app/core/schemas.py` con validación de tipos, longitud mínima de 40 caracteres y normalización de alias.
- **Sanitización de Ingesta:** Extracción segura con `pypdf` limpiando encabezados y validando extensiones autorizadas (.pdf, .md, .txt).

## Hallazgos y Buenas Prácticas para Producción
1. **Autenticación en Endpoints:** En la fase de hackathon/desarrollo local, los endpoints operan sin autenticación previa. Antes de exponer el servicio a redes públicas, se debe incorporar autenticación (OAuth2 / JWT / API Keys).
2. **Límites de Carga:** Imponer límites de tamaño de archivo (`UploadFile` en FastAPI) y rate-limiting por IP para prevenir ataques de denegación de servicio o sobrecostes en llamadas a Cohere.
3. **Cifrado en Reposo:** Para almacenamiento en OCI, Object Storage aplica cifrado nativo del lado del servidor (SSE) en la capa Always Free. Para persistencia local, asegurar permisos de lectura restringidos en `data/outputs/`.
4. **Dependencias:** Mantener dependencias fijadas y ejecutar periódicamente `pip audit` o escaneos automáticos de dependencias en CI/CD.

## Recomendaciones Priorizadas para Despliegue Abierto
- **P0 antes de exposición a Internet:** Autenticación de endpoints, rate limiting y proxy inverso TLS (Nginx/Traefik).
- **P1:** Límites de tamaño máximo en subida de archivos (ej: máx. 10 MB) y aislamiento en contenedores no privilegiados.
- **P2:** Integración con Vault de OCI para rotación periódica de credenciales de API.

