# 📘 Guía Técnica de Integración para el Equipo de Frontend

> **Proyecto:** NuevaMente — Sistema de Adaptación Educativa Multi-Agente  
> **Autoría:** Desarrollado por el **Equipo 10 (G10 - NovaMind)** para **No-Country**  
> **Destinatarios:** Desarrolladores de Frontend (React / Next.js / Vue / Svelte / Angular)  
> **Backend:** API REST en FastAPI (`http://127.0.0.1:8000`) · Documentación interactiva Swagger en `/docs`  
> **CORS:** Habilitado para todos los orígenes (`allow_origins=["*"]`)  

---

## 🎯 1. Visión General de la Arquitectura

El backend de **NuevaMente** está completamente desacoplado de cualquier tecnología de frontend. Toda la lógica pesada (extracción de PDFs, embeddings en ChromaDB, agentes LangGraph con Cohere Command R+, auditoría de hechos y almacenamiento) se ejecuta de forma autónoma en el servidor.

El frontend solo debe encargarse de:
1. Enviar el documento (archivo o texto plano) junto a los parámetros pedagógicos mediante `multipart/form-data`.
2. Mostrar estados de carga atractivos durante el procesamiento (que puede demorar entre 15 y 90 segundos según el tamaño del documento).
3. Renderizar interactivamente la estructura JSON devuelta según el formato pedagógico elegido (Flashcards, Quizzes, Tutoriales, etc.).
4. Consultar y visualizar el historial de paquetes persistidos.

---

## 🌐 2. Variables de Entorno del Frontend

En el proyecto que creen (ej: Vite o Next.js), configuren una variable de entorno para la URL del backend:

```env
# Ejemplo para Vite (.env)
VITE_API_BASE_URL=http://127.0.0.1:8000

# Ejemplo para Next.js (.env.local)
NEXT_PUBLIC_API_BASE_URL=http://127.0.0.1:8000
```

> **En Producción (OCI + Cloudflare):** La URL apuntará al dominio del túnel (ej: `https://api.tu-dominio.com` o ruta correspondiente).

---

## 🔌 3. Catálogo Completo de Endpoints REST

### 3.1. Verificación de Salud
* **`GET /health`** o **`GET /api/v1/salud`**
* **Uso:** Comprobar si el backend está activo antes de inicializar la app.
* **Respuesta exitosa (`200 OK`):**
  ```json
  {
    "status": "ok",
    "app": "NuevaMente API",
    "version": "2.0.0"
  }
  ```

---

### 3.2. Contratos Dinámicos de Opciones (¡Imprescindible!)
* **`GET /api/v1/config/opciones`**
* **Uso:** **Consumir siempre este endpoint al montar la aplicación** para poblar los menús desplegables (`<select>` o comboboxes). El backend usa validación estricta de Enums en Pydantic v2; usar estas listas evita errores tipográficos `HTTP 422`.
* **Respuesta exitosa (`200 OK`):**
  ```json
  {
    "perfiles_destinatario": [
      "Principiante / Transición de Carrera",
      "Desarrollador Junior / Semi Senior",
      "Líder Técnico / Arquitecto",
      "Gestor / Ejecutivo (No Técnico)"
    ],
    "formatos_salida": [
      "Guía Práctica Paso a Paso (Tutorial)",
      "Flashcards",
      "Quiz Interactivo con Justificaciones",
      "Resumen Ejecutivo (TL;DR)",
      "Guion de Clase / Video"
    ],
    "nichos_sector": [
      "Fintech",
      "Salud",
      "E-commerce",
      "General"
    ],
    "niveles_detalle": [
      "Didáctico",
      "Intermedio",
      "Profundo"
    ]
  }
  ```

---

### 3.3. Endpoint Principal de Adaptación Pedagógica
* **`POST /api/v1/adaptar`**
* **Content-Type:** `multipart/form-data`
* **⚠️ Consideración de Timeout:** Debido a la orquestación multi-agente y la auditoría del Crítico, configurar el cliente HTTP (`axios`, `fetch`) con un **timeout de al menos 180 segundos (180,000 ms)**.

#### Parámetros de la Petición (`FormData`):
| Campo | Tipo | Obligatorio | Descripción |
| :--- | :--- | :---: | :--- |
| `archivo` | `File / Blob` | Condicional* | Archivo binario `.pdf`, `.md` o `.txt`. |
| `texto_directo` | `string` | Condicional* | Texto sin formato. (*Debe enviarse `archivo` o `texto_directo`). |
| `titulo` | `string` | No | Nombre del documento (ej: "Capítulo 1 - Introducción"). |
| `perfil_destinatario` | `string` | **Sí** | Uno de los valores de `perfiles_destinatario`. |
| `formato_salida` | `string` | **Sí** | Uno de los valores de `formatos_salida`. |
| `nicho_sector` | `string` | No (def: `"General"`) | Uno de los valores de `nichos_sector`. |
| `nivel_detalle` | `string` | No (def: `"Didáctico"`) | Uno de los valores de `niveles_detalle`. |
| `tema_consulta` | `string` | No | Pregunta o foco específico para guiar la búsqueda RAG. |

---

### 3.4. Consulta de Historial y Descargas
* **`GET /api/v1/paquetes`**
  * Lista los contenidos generados previamente y persistidos en el servidor / almacenamiento.
  * **Respuesta (`200 OK`):**
    ```json
    {
      "origen": "local",
      "paquetes": [
        {
          "nombre": "doc-3772849d50801a4e-principiante-transicion-de-carrera-flashcards.json",
          "tamanio_bytes": 4818,
          "creado_en": "1790032915.16"
        }
      ]
    }
    ```
* **`GET /api/v1/paquetes/{objeto_id}`**
  * Descarga el JSON completo del contenido persistido para cargarlo directamente en el visor del frontend.

---

## 📦 4. Estructura de la Respuesta (`RespuestaAdaptacion`)

```json
{
  "status": "exito", 
  "metadatos": {
    "perfil_aplicado": "Principiante / Transición de Carrera",
    "formato_generado": "Flashcards",
    "nicho_aplicado": "General",
    "tiempo_estimado_estudio_minutos": 10,
    "conceptos_clave": ["VCN", "Subredes", "CIDR"],
    "prerrequisitos": ["Conocimientos básicos de computación"]
  },
  "evaluacion_calidad": {
    "anclaje_fuente_score": 1.0,
    "claridad_pedagogica": "Alta",
    "observaciones": "El contenido está bien adaptado y fiel al texto original.",
    "afirmaciones": [
      {
        "afirmacion": "La VCN es una red virtual de OCI.",
        "respaldada": true,
        "chunk_id_evidencia": "doc-123_0",
        "comentario": null
      }
    ]
  },
  "contenido_adaptado": {
    "titulo": "Descubre las Redes Virtuales en OCI",
    "introduccion_contextualizada": "Una introducción clara y amigable...",
    "items": [
      /* Estructura variable según formato (Ver sección 5) */
    ]
  },
  "orquestacion": {
    "intentos_redaccion": 1,
    "scores_por_intento": [1.0],
    "umbral_anclaje": 0.75,
    "max_reintentos": 2,
    "duracion_segundos": 28.4,
    "chunks_recuperados": 6
  },
  "almacenamiento_oci": {
    "bucket": "local-mock-storage",
    "objeto_id": "contenidos_generados/doc-123-flashcards.json",
    "status_upload": "completado"
  },
  "advertencias": []
}
```

---

## 🎨 5. Modelos de TypeScript para los 5 Formatos Pedagógicos

El array `contenido_adaptado.items` adopta una de estas 5 interfaces según el `formato_salida`:

```typescript
// 1. Flashcards ("Flashcards")
export interface ItemFlashcard {
  frente: string;            // Pregunta o concepto en el anverso
  dorso: string;             // Explicación didáctica en el reverso
  pista_didactica?: string;  // Pista o analogía pedagógica
  concepto_clave?: string;   // Etiqueta del concepto (ej: "Subredes")
}

// 2. Quiz Interactivo ("Quiz Interactivo con Justificaciones")
export interface ItemQuiz {
  pregunta: string;
  opciones: string[];        // Exactamente 3 o 4 opciones
  respuesta_correcta: string;// Debe coincidir exactamente con una de las opciones
  justificacion: string;     // Explicación técnica de por qué es la correcta
}

// 3. Guía Práctica ("Guía Práctica Paso a Paso (Tutorial)")
export interface ItemPaso {
  numero_paso: number;       // 1, 2, 3...
  titulo: string;            // Título del paso
  instruccion: string;       // Instrucción detallada con comandos/pasos
  advertencia_o_tip?: string;// Alerta o consejo práctico
}

// 4. Resumen Ejecutivo ("Resumen Ejecutivo (TL;DR)")
export interface ItemResumen {
  punto: string;             // Idea central o takeaway
  por_que_importa: string;   // Impacto en el negocio o contexto técnico
}

// 5. Guion de Clase / Video ("Guion de Clase / Video")
export interface ItemSegmentoGuion {
  minuto_aproximado: string | number; // ej: "00:00 - 01:30" o 1
  narracion: string;                  // Texto para ser leído por el relator
  apoyo_visual_sugerido: string;      // Gráfica, slide o diagrama a mostrar
}
```

---

## 💻 6. Ejemplo de Cliente en React / TypeScript (Axios)

```typescript
import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000',
  timeout: 180000, // 3 minutos para permitir RAG + loops de agentes
});

export async function adaptarContenido(formData: FormData) {
  try {
    const response = await api.post('/api/v1/adaptar', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  } catch (error: any) {
    if (error.response) {
      // El backend devolvió un error controlado (ej: 422 de validación o 400 de archivo vacío)
      throw new Error(error.response.data.detail || 'Error en el servidor');
    } else if (error.code === 'ECONNABORTED') {
      throw new Error('Tiempo de espera agotado (Timeout). El documento es muy extenso.');
    }
    throw new Error('No se pudo conectar con el backend de NuevaMente.');
  }
}
```

---

## 💡 7. Recomendaciones UX/UI para la Nueva Interfaz

1. **Estado de Carga Asincrónico:**
   * Mostrar un indicador con pasos visuales:
     - 📄 *Extrayendo documento e indexando vectores en ChromaDB...*
     - 🤖 *Agente Productor redactando contenido personalizado...*
     - 🔍 *Agente Crítico auditando fuentes y calculando anclaje...*
2. **Componentes Interactivos Modernos:**
   * **Para Flashcards:** Implementar tarjetas con efecto 3D flip al hacer clic o presionar espacio.
   * **Para Quizzes:** Al seleccionar una opción, mostrar inmediatamente feedback visual (verde/rojo), revelar la justificación y sumar puntos al marcador.
   * **Para Tutoriales:** Checkboxes para que el estudiante marque los pasos completados.
3. **Persistencia en Frontend:**
   * Almacenar el último resultado en `localStorage` o en el estado global (Zustand / Redux / React Query) para que un refresco de página accidental no haga perder la generación de 1 minuto.

