# Seguridad y Control de Acceso

## Panorama de Seguridad

La arquitectura de **NuevaMente** implementa principios de **Defensa en Profundidad** y **Zero Trust** adaptados para un entorno de alta eficiencia con cuotas de uso gratuitas y microservicios en la nube.


## 1. Autenticación y Autorización

### Autenticación con Supabase Auth y JWT
- **Validación en Backend:** La capa de autenticación (`backend/app/auth.py`) extrae y valida el token JWT incluido en el encabezado HTTP:
  ```http
  Authorization: Bearer <jwt_token>
  ```
- **Dependencias FastAPI:**
  - `require_user`: Valida que el token sea legítimo y pertenezca a un usuario registrado.
  - `require_generador`: Valida permisos para ejecutar adaptaciones y distingue si el solicitante es un usuario registrado o un invitado.
- **Acceso para Invitados Controlado:** Los usuarios no autenticados (`principal.is_guest`) tienen acceso restringido:
  - Solo pueden explorar las muestras estáticas pregeneradas.
  - Si intentan generar en caliente, el backend aplica un semáforo restrictivo (`MAX_INVITADOS_CONCURRENTES = 2`) y no almacena sus datos en base de datos ni en OCI.


## 2. Aislamiento Multi-Inquilino y Base de Datos

### Row Level Security (RLS) en PostgreSQL
- Todas las tablas de Supabase (`profiles`, `documents`, `learning_packages`, `learning_progress`, `user_state`, `generation_tasks`) tienen habilitado **Row Level Security**.
- La política `own_rows` garantiza que un usuario solo pueda leer, insertar, actualizar o eliminar registros donde `user_id = auth.uid()`.
- **Principio de Menor Privilegio:** El backend no utiliza la clave maestra `service_role` para consultas operativas. Todas las operaciones se canalizan a través de la API REST de Supabase utilizando el JWT del usuario final, delegando la autorización directamente en el motor de PostgreSQL.



## 3. Seguridad Perimetral y Redes

### Arquitectura Zero Trust y Cloudflare Tunnel
- En el despliegue de producción (`novamind.techgk.cl`), la máquina virtual del backend en Oracle Cloud (VM 1, puerto 8000) **no tiene puertos abiertos directamente a Internet**.
- La comunicación ingresa exclusivamente a través de un túnel cifrado de Cloudflare hacia el proxy inverso Nginx (VM 2), que luego se comunica por la subred privada de la Virtual Cloud Network (VCN).

### Política de CORS Restringida
- Se revocó la política permisiva global `["*"]`.
- En `backend/app/main.py`, CORS autoriza únicamente:
  - Orígenes locales de desarrollo: `http://localhost:5173`, `http://127.0.0.1:5173` (Vite) y puertos de API (`8000`).
  - Regex para loopback de desarrollo: `^https?://(localhost|127\.0\.0\.1)(:\d+)?$`.
  - El dominio público de producción configurado en Nginx/Cloudflare.


## 4. Protección contra Denegación de Servicio y OOM

Debido a que la máquina virtual de OCI Always Free cuenta con 1 vCPU y 1 GB de RAM, se implementaron controles estrictos de concurrencia en memoria:
- **Semáforo Global de Concurrencia:** `asyncio.Semaphore(5)` restringe a un máximo de 5 generaciones simultáneas en toda la API.
- **Semáforo para Invitados:** `asyncio.Semaphore(2)` evita que usuarios anónimos saturen los cupos de procesamiento.
- **Semáforos por Modelo de IA:**
  - `GEMINI_MAX_CONCURRENCIA = 4`: Limita las llamadas simultáneas al cliente de Gemini para no agotar la cuota del proyecto.
  - `GEMINI_CONCURRENCIA_POR_MODELO = 2`: Semáforo específico para modelos de respaldo.
- **Límite de Tamaño de Archivo:** `MAX_BYTES_ARCHIVO` (por defecto 15 MB) rechaza archivos excesivamente grandes antes de procesarlos.
- **Protección de Cuota en Narración:** Detección preventiva `exceso_guion_narracion` que rechaza guiones con más de 173 palabras o 1.730 caracteres con HTTP 422 para no desperdiciar créditos de síntesis de voz en audios inviables.


## 5. Privacidad y Sanitización de Datos

- **Enmascaramiento en Logs:** Las direcciones de correo electrónico registradas en logs se enmascaran automáticamente (ejemplo: `al***@ejemplo.com`).
- **Manejo Seguro de Excepciones:** Los mensajes de error devueltos al cliente están saneados y estructurados mediante contratos Pydantic, evitando fugas de trazas internas (*stack traces*) o rutas del sistema operativo.
- **Historial de Git Depurado:** El repositorio fue purgado con `git-filter-repo` para erradicar identificadores de tenancy de OCI, claves privadas y nombres reales de buckets de todos los commits históricos.
- **Exclusión Recursiva en `.gitignore`:** Archivos `.env`, certificados `.pem`, manuales confidenciales y datos en `data/chroma/` o `data/outputs/` están estrictamente ignorados.

---

## 🔗 Navegación
* 🧭 [**Índice General del Proyecto (#back)**](../../INDEX.md#back)
* 📚 [**Directorio de Guías del Backend**](README.md)
* 🚀 [**Portada del Backend**](../README.md)
