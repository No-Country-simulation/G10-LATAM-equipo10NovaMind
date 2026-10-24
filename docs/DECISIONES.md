# ⚙️ Decisiones Técnicas y de Arquitectura — NuevaMente

> Este documento detalla cada decisión de arquitectura y diseño implementada en **NuevaMente**, qué alternativas se evaluaron o descartaron, los compromisos técnicos (*trade-offs*) asumidos y las justificaciones de costo y rendimiento en infraestructura.


## 1. Procedencia Honesta y Verificación Estricta

### Decisión
Nada se presenta en la interfaz de usuario como "verificado" si no cuenta con evidencia comprobable en el texto fuente. Las citas documentales no son inventadas ni asumidas del LLM; el backend localiza literalmente el fragmento citado en el documento original mediante búsqueda determinista en Python (`backend/app/core/fuentes.py`), calculando el número de página real a partir del offset del documento. Si un recurso falla en su generación o auditoría, se muestra explícitamente como fallido o ausente con su código de error, sin recurrir a textos ficticios o *placeholders* inventados.

### Alternativas descartadas
- **Confiar ciegamente en la página/cita que devuelve el LLM:** Los modelos de lenguaje sufren de alucinaciones en referencias bibliográficas y números de página cuando se les pide citar de memoria o estimar la página.
- **Rellenar con contenido sintético en caso de fallo:** Mostrar métricas fijas (como *"98% Zero-Hallucination"*) o preguntas de quiz prefabricadas degradaba la honestidad académica del producto ante el estudiante y el docente.

### Compromiso técnico (*Trade-off*)
La búsqueda determinista de subcadenas requiere normalización previa (ignorar espacios repetidos, saltos de línea y marcas Markdown como ```` ```bash ````), y si el LLM parafrasea demasiado la cita en lugar de citar literalmente, la cita se clasifica como no verificada.


## 2. Operación Estricta en Capa Gratuita (*Free-Tier*)

### Decisión
El sistema está diseñado para operar con **costo $0** mediante servicios Always Free de Oracle Cloud Infrastructure (OCI) y capas gratuitas de proveedores de IA:
1. **Modo Invitado sin costo de cómputo IA:** Los visitantes sin sesión exploran muestras pregeneradas estáticas (`frontend/public/ejemplos/`) para 6 documentos reales (Don Quijote I y II, Apache Kafka, ENISA, Snowflake y la Guía de Swap de OCI). El backend rechaza peticiones de generación no autenticadas con HTTP 403.
2. **Activos visuales libres:** Las imágenes se obtienen de repositorios abiertos (Unsplash, Wikimedia Commons, Pexels) con licencias que autorizan adaptación y se acreditan con autor y enlace.
3. **Persistencia en OCI Object Storage Always Free:** Almacenamiento seguro en el bucket privado `nuevamente-contenidos-educativos` (región `sa-santiago-1`).

### Alternativas descartadas
- Permitir generación libre a usuarios anónimos (habría agotado la cuota diaria de tokens de Gemini en pocos minutos debido a bots o abuso).
- Usar servicios comerciales de pago por uso sin topes (AWS S3, modelos cerrados con facturación abierta).


## 3. Restricción de Cómputo: VM OCI de 1 OCPU y 1 GB RAM

### Decisión
La instancia de cómputo en Oracle Cloud es una máquina virtual de recursos extremadamente ajustados (1 vCPU, 1 GB de memoria RAM física).
- **Cero procesamiento audiovisual en servidor:** No se ejecutan procesos pesados de FFmpeg ni renderizado de video MP4 en el backend.
- **Video renderizado en el cliente:** La microclase audiovisual se dibuja dinámicamente en el navegador del usuario utilizando **Remotion Player** (React), sincronizando las diapositivas con el audio MP3/WAV o la síntesis de voz.
- **Semáforos de concurrencia en FastAPI:** Para evitar *Out-Of-Memory* (OOM) o congelamiento del *Event Loop*:
  - Límite global de 5 peticiones simultáneas (`asyncio.Semaphore(5)`).
  - Límite para invitados concurrentes (`MAX_INVITADOS_CONCURRENTES = 2`).
  - Uvicorn configurado con 1 solo worker (~98 MB de huella base).

### Alternativas descartadas
- **Renderizar video MP4 con FFmpeg en el servidor:** Un solo renderizado de video en 1080p o 720p consume entre 1.5 GB y 3 GB de RAM y satura el procesador al 100%, congelando la máquina virtual completa.
- **Docker Compose multi-contenedor con microservicios separados en la misma VM:** La suma de contenedores (FastAPI, Redis, Celery, ChromaDB) superaba con creces el límite de 1 GB de RAM provocando *OOM-Killer*.


## 4. Estrategia de RAG en Tres Modos y Dilema Pedagógico

### Decisión
El backend implementa una estrategia de generación en cascada con tres modos:
1. **Modo Paralelo (Predeterminado — RAG en Contexto / *In-Context Grounding*):** El documento técnico completo (hasta 350.000 caracteres) se inyecta directamente en la ventana de contexto de Google Gemini 2.5 Flash. La generación de las estaciones corre en paralelo (A: Resumen, B1: Flashcards/Glosario, B2: Guía/Guion, C: Cuestionario con el temario consolidado).
2. **Modo Cadena Colaborativa (`vectorless`):** Fallback multi-proveedor que orquesta modelos alternativos en secuencia cuando se agota la cuota del principal.
3. **Modo Clásico (RAG Vectorial con LangGraph + ChromaDB):** Fragmenta el documento en chunks de 700 caracteres, genera embeddings con Cohere (`embed-multilingual-v3.0`), almacena en ChromaDB local (`data/chroma`) y ejecuta un ciclo reflexivo de agentes (*Investigador ➔ Productor ➔ Crítico*).

### Por qué el RAG tradicional basado en similitud es deficiente para la Educación
El RAG vectorial estándar (*Search & QA*) fue creado para encontrar fragmentos aislados ante preguntas puntuales (por ejemplo: *"¿cuál es el comando para abrir el puerto 443?"*). Sin embargo, para crear material instruccional coherente (un tutorial progresivo, un guion con curva dramática o un mapa conceptual), el modelo necesita:
- **Visión holística:** Comprender la jerarquía completa del tema.
- **Narrativa pedagógica:** Saber cómo conectar conceptos introductorios con avanzados.
- **Síntesis global:** Discernir qué es esencial y qué es secundario.

Fragmentar un documento en 5 chunks recuperados por similitud de coseno destruye el hilo conductor. Por eso, el **Modo Paralelo (In-Context Grounding)** es el modo principal, y el **RAG Vectorial** se preserva como contingencia y para auditoría factual de alta precisión en chunks técnicos.


## 5. Prevención de Timeouts de Cloudflare (Error 524)

### Decisión
Cloudflare corta automáticamente las conexiones HTTP que no reciben respuesta durante 100 segundos (*Cloudflare 524 Gateway Timeout*). Dado que una orquestación educativa completa puede tardar entre 20 y 80 segundos en procesar documentos extensos:
- Se implementó el endpoint `POST /api/v1/adaptar/stream` con **Server-Sent Events (SSE)**.
- El servidor emite eventos progresivos de avance conforme cada recurso se valida (`recurso`, `tarea`, `auditoria`).
- Se introdujo un mecanismo de *heartbeat* anti-timeout emitiendo comentarios SSE (`: ping\n\n`) cada 15 segundos en canales inactivos.
- El frontend React 19 pliega los eventos recibidos de forma reactiva e interactiva, permitiendo al usuario interactuar con la primera estación a los 7-8 segundos.

### Alternativas descartadas
- Petición HTTP POST síncrona monolítica sin streaming (fallaba intermitentemente en documentos largos pasando por el proxy Nginx/Cloudflare).
- Arquitectura de colas pesada (RabbitMQ/Celery + WebSockets) que aumentaba el footprint de memoria más allá del gigabyte disponible en OCI.


## 6. Manejo Seguro de Secretos y Arquitectura de Autenticación

### Decisión
- **Cero secretos en el cliente:** El navegador web únicamente recibe variables públicas (`VITE_API_URL`, `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`). Las claves de modelos (`GEMINI_API_KEY`, `COHERE_API_KEY`, `GROQ_API_KEY`, `ELEVENLABS_API_KEY`), credenciales de OCI y configuración SMTP residen exclusivamente en el entorno del backend.
- **Autenticación desacoplada con Supabase Auth:** El usuario se autentica en el cliente (OAuth Google o Email/Password); el JWT resultante se transmite en el header `Authorization: Bearer <token>` al backend FastAPI.
- **Validación con Row Level Security (RLS):** El backend no utiliza la clave privilegiada `service_role`. Ejecuta las consultas de base de datos (`private_query`, `private_insert`) con la *anon key* y el JWT del usuario, garantizando que PostgreSQL aplique las políticas de RLS en base de datos.


## 7. Aislamiento Multi-Inquilino de Datos

### Decisión
Cada usuario tiene su espacio de almacenamiento estrictamente aislado:
- **En Supabase:** Las 6 tablas del sistema (`profiles`, `documents`, `learning_packages`, `learning_progress`, `user_state`, `generation_tasks`) tienen políticas RLS activas que impiden a cualquier usuario leer o modificar filas ajenas (`user_id = auth.uid()`).
- **En OCI Object Storage:** Los documentos originales y los paquetes JSON generados se almacenan bajo la convención de carpetas `users/{user_id}/{run_id}/` dentro de un bucket con configuración `NoPublicAccess`.
- **En ChromaDB:** Si se utiliza el modo vectorial, las colecciones se particionan o filtran por identificador de usuario.
- **En la memoria del servidor:** La caché temporal de tareas para invitados está aislada y acotada (`MAX_FILAS_CACHE_INVITADOS = 200`), purgándose al reiniciar el proceso.


## 8. Política de CORS Restringida

### Decisión
Se revocó la directiva permisiva global `allow_origins=["*"]`.
En `backend/app/main.py`:
- Se admiten orígenes locales estándar de desarrollo: `http://localhost:5173`, `http://127.0.0.1:5173` (Vite) y `http://localhost:8000` / `8501`.
- Se implementó `allow_origin_regex` para admitir puertos dinámicos en loopback local.
- Para despliegue público, el dominio de producción (`https://novamind.techgk.cl`) se autoriza a través de Cloudflare Tunnel y Nginx.


## 9. Organización del Repositorio y Niveles de Documentación

### Decisión
- **Documentación pública en GitHub:** El [`README.md`](../README.md) principal y este archivo [`docs/DECISIONES.md`](DECISIONES.md) constituyen la referencia de alto nivel para evaluadores y público general.
- **Documentación técnica profunda:** Se consolida bajo [`backend/docs/`](../backend/docs/) con 10 especificaciones por área (Arquitectura, API, Base de Datos, Seguridad, Despliegue, Operaciones, Testing, Contribución, Changelog y Auditoría), enlazadas limpiamente desde [`backend/README.md`](../backend/README.md).
- **Privacidad de credenciales e incidentes:** Las bitácoras internas, llaves `.pem` y archivos `.env` se excluyen estrictamente en `.gitignore` tras saneamiento con `git-filter-repo`.
