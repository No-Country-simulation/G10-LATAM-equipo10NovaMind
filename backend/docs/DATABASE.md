# Datos y persistencia

## Panorama
No se identificó una base de datos relacional ni migraciones SQL. La persistencia está compuesta por:
1. **ChromaDB**: índice vectorial persistente de fragmentos documentales.
2. **Sistema de archivos local**: documentos cargados y paquetes JSON generados.
3. **OCI Object Storage**: cliente de almacenamiento de objetos disponible como integración.

## ChromaDB
`backend/app/core/rag_pipeline.py` crea un `PersistentClient`, obtiene o crea una colección y guarda fragmentos con identificadores y metadatos. Segmentación: tamaño objetivo 700 caracteres y solapamiento 100; para Markdown reconoce encabezados H1-H3 antes de dividir secciones. Metadatos de fragmento: `doc_id`, título del documento, índice de fragmento y extracto de fuente. La consulta usa similitud coseno y puede filtrar por `doc_id`.

Variables específicas observadas en este módulo: `CHROMA_PERSIST_DIR` (predeterminado `data/chroma`), `CHROMA_COLLECTION_NAME` (`nuevamente_docs`), `LOCAL_EMBEDDINGS_MODEL` (`intfloat/multilingual-e5-base`) y `EMBEDDINGS_PROVIDER` (`local` por defecto; alternativa de código basada en Google Generative AI que requiere `GEMINI_API_KEY`).

## Archivos locales
- Documentos cargados por API: `data/documents/{nombre_archivo}` (ruta relativa al directorio de trabajo).
- Documentos originales de salida: `data/outputs/documentos_originales/{doc_id}.txt`.
- Paquetes: `data/outputs/contenidos_generados/{doc_id}-{perfil}-{formato}.json`.

El almacenamiento local devuelve metadatos con `bucket="local-mock-storage"` y `status_upload="completado"` cuando la escritura termina correctamente.

## Objetos OCI
El cliente real usa `OCI_NAMESPACE` y `OCI_BUCKET_NAME`, autenticándose mediante archivo OCI estándar o variables `OCI_USER`, `OCI_TENANCY`, `OCI_FINGERPRINT`, `OCI_KEY_FILE`/`OCI_KEY_CONTENT` y `OCI_REGION`. Guarda originales bajo `documentos-originales/` y resultados bajo `contenidos-generados/`.

## Entidades lógicas
- **Documento**: identificador, título, texto extraído y extensión.
- **Fragmento**: texto, identificador de documento, índice y metadatos de fuente.
- **Paquete educativo**: solicitud normalizada, metadatos, contenido, evaluación de calidad y métricas de orquestación.

No hay diagrama ER porque no se encontraron tablas relacionales. Los modelos Pydantic y sus campos son la fuente de verdad para los contratos JSON.
