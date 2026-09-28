# Seguridad

## Controles observados
- Validación de entrada con modelos Pydantic y validadores de estructura.
- Validación de formatos de archivo soportados (PDF, Markdown y TXT) en la capa de ingesta.
- Separación de configuración mediante variables de entorno.
- Integración OCI basada en archivo de configuración o variables de entorno.
- Mensajes de error amigables en varios caminos del orquestador.

## Hallazgos relevantes
1. **CORS permisivo:** `main.py` establece `allow_origins=["*"]`, `allow_methods=["*"]`, `allow_headers=["*"]` y `allow_credentials=True`. Restringir orígenes y revisar la combinación con credenciales antes de despliegue.
2. **Sin autenticación visible:** los endpoints de adaptación y paquetes no muestran dependencia de autenticación ni autorización. Si el servicio se expone fuera de un entorno confiable, incorporar autenticación, autorización y controles de abuso.
3. **Subida de archivos sin límite explícito de tamaño:** el endpoint lee el archivo completo en memoria y lo guarda en disco. Aplicar límite de tamaño, límites de tiempo y controles de almacenamiento.
4. **Nombre de archivo de entrada:** la ingesta forma el destino local con el nombre recibido. Revisar normalización/aislamiento de rutas y validar nombres para evitar traversal o colisiones.
5. **Datos sensibles en documentos:** los documentos originales y los paquetes se persisten localmente o en OCI. Definir retención, control de acceso, cifrado y eliminación según la sensibilidad de los datos.
6. **Errores y logs:** revisar que excepciones de proveedores o infraestructura no expongan información sensible en respuestas/logs.
7. **Dependencias:** realizar escaneo de vulnerabilidades y mantener versiones actualizadas, con pruebas de regresión.

## Recomendaciones priorizadas
- **P0 antes de exposición pública:** autenticación/autorización, CORS restrictivo, límites de tamaño y protección de endpoints de paquetes.
- **P1:** validar nombres de archivo, aplicar cuotas/rate limiting, configurar HTTPS y revisar gestión de secretos.
- **P2:** políticas de retención, auditoría de accesos, escaneo de dependencias y pruebas de seguridad automatizadas.

Este documento es una revisión estática del repositorio, no una auditoría de penetración.
