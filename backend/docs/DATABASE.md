# Datos y persistencia

## Panorama
No se identificó una base de datos relacional ni migraciones SQL. La persistencia está compuesta por:
1. **ChromaDB**: índice vectorial persistente de fragmentos documentales.
2. **Sistema de archivos local**: documentos cargados y paquetes JSON generados.
3. **OCI Object Storage**: cliente de almacenamiento de objetos disponible como integración.

## ChromaDB
`backend/app/core/rag_pipeline.py` crea un `PersistentClient`, obtiene o crea una colección y guarda fragmentos con identificadores y metadatos. Segmentación: tamaño objetivo 700 caracteres y solapamiento 100; para Markdown reconoce encabezados H1-H3 antes de dividir secciones. Metadatos de fragmento: `doc_id`, título del documento, índice de fragmento y extracto de fuente. La consulta usa similitud coseno y puede filtrar por `doc_id`.

Variables específicas observadas en este módulo: `CHROMA_PERSIST_DIR` (predeterminado `data/chroma`), `CHROMA_COLLECTION_NAME` (`nuevamente_docs`), `LOCAL_EMBEDDINGS_MODEL` (`intfloat/multilingual-e5-base`) y `EMBEDDINGS_PROVIDER` (`local` por defecto; alternativa de código basada en Google Generative AI que requiere `GEMINI_API_KEY`).

## Almacenador Híbrido Resiliente (OCI Cloud + Local)
En `backend/app/orquestador.py`, la persistencia se gestiona mediante `almacenador_resiliente`, el cual aplica una política de **alta disponibilidad**:
1. **Prioridad Cloud (OCI Object Storage Always Free):** Intenta persistir de forma nativa en Oracle Cloud si las credenciales y variables de entorno están activas.
2. **Fallback Automático (Local):** Si OCI no está configurado, si las credenciales fallan o si ocurre una caída transitoria de red, redirige la escritura a `data/outputs/` de manera transparente y silenciosa, garantizando que el usuario siempre reciba su paquete adaptado sin excepciones 500.

## Archivos locales
- Documentos cargados por API: `data/documents/{nombre_archivo}` (guardado temporal para auditoría).
- Documentos originales de salida (fallback): `data/outputs/documentos_originales/{doc_id}.txt`.
- Paquetes educativos de salida (fallback): `data/outputs/contenidos_generados/{doc_id}-{perfil}-{formato}.json`.

El almacenamiento local devuelve metadatos con `bucket="local-mock-storage"` y `status_upload="completado"` cuando la escritura termina correctamente.

## Topología de Objetos en OCI Object Storage
El cliente real (`backend/app/storage/oci_client.py`) utiliza el SDK oficial de Oracle Cloud (`oci.object_storage.UploadManager`) con autenticación estándar (`~/.oci/config`) o variables de entorno (`OCI_USER`, `OCI_TENANCY`, `OCI_FINGERPRINT`, `OCI_KEY_FILE`, `OCI_REGION`):
* **Bucket:** `nuevamente-contenidos-educativos` (Tier Standard, Always Free).
* **Región:** `sa-santiago-1`.
* **Namespace:** Configurado dinámicamente vía variable `OCI_NAMESPACE`.
* **Estructura Jerárquica de Claves Cloud:**
  - `documentos-originales/{doc_id}.txt`: Archivo plano con el texto completo extraído para auditoría y trazabilidad.
  - `contenidos-generados/{doc_id}-{perfil}-{formato}.json`: Payload JSON estructurado que incluye metadatos, contenido adaptado en el formato solicitado, métricas de ejecución y evaluación de anclaje RAG.


## Entidades lógicas
- **Documento**: identificador, título, texto extraído y extensión.
- **Fragmento**: texto, identificador de documento, índice y metadatos de fuente.
- **Paquete educativo**: solicitud normalizada, metadatos, contenido, evaluación de calidad y métricas de orquestación.

No hay diagrama ER porque no se encontraron tablas relacionales. Los modelos Pydantic y sus campos son la fuente de verdad para los contratos JSON.
