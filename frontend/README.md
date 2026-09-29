# 🎓 NuevaMente — Frontend

> **Interfaz de usuario reactiva para la adaptación de contenidos educativos mediante IA Multi-Agente.**  
> Diseñada para parametrizar la ingesta técnica, previsualizar interactivamente los 5 formatos pedagógicos adaptados y auditar métricas RAG junto a la persistencia en Oracle Cloud Infrastructure (OCI Object Storage).

---

## 🧭 Equivalencias Rápidas: Python vs. Node/Frontend

Si vienes de trabajar con el ecosistema Python (`pip`, `venv`, `FastAPI`), esta tabla resume los conceptos y comandos equivalentes:

| Concepto | Ecosistema Python | Ecosistema Frontend (Node.js) |
| :--- | :--- | :--- |
| **Entorno de ejecución** | Python 3.10 / 3.11 | **Node.js (LTS v18 o v20+)** |
| **Gestor de paquetes** | `pip` / `poetry` | **`npm`** |
| **Lista de dependencias** | `requirements.txt` / `pyproject.toml` | **`package.json`** |
| **Instalar dependencias** | `pip install -r requirements.txt` | **`npm install`** |
| **Levantar servidor local** | `uvicorn main:app --reload` | **`npm run dev`** |
| **Variables de entorno** | Archivo `.env` (`pydantic-settings`) | Archivo `.env` (prefijo `VITE_`) |

---

## 📌 Requisitos Previos

Solo necesitas tener instalado **Node.js**:

1. Descarga e instala la versión **LTS** desde el sitio oficial: [https://nodejs.org/](https://nodejs.org/).
2. Verifica en tu terminal (PowerShell, CMD o Bash) que las herramientas estén disponibles:
   ```bash
   node -v
   npm -v
   ```

---

## 🚀 Puesta en Marcha Local (3 Pasos)

Una vez clonado el repositorio de **NuevaMente** en tu computadora:

### 1. Entrar en la carpeta del frontend
Abre tu terminal en la raíz del proyecto y navega hacia la carpeta `frontend`:
```bash
cd frontend
```

### 2. Instalar las dependencias
Instala todas las librerías necesarias (React, Vite, Lucide Icons, etc.):
```bash
npm install
```

### 3. Iniciar el servidor local
Levanta el entorno de desarrollo:
```bash
npm run dev
```

La consola mostrará una URL local similar a:
```text
  VITE v5.x.x  ready in 250 ms

  ➜  Local:   http://localhost:5173/
  ➜  Network: use --host to expose
```

Abre [http://localhost:5173/](http://localhost:5173/) en tu navegador web para comenzar a usar la aplicación.

---

## 🔌 Conexión con el Backend (FastAPI / LangGraph)

* **Modo Autónomo / Demo (Offline):** La aplicación incluye datos mockeados y simulación offline por defecto. Puedes navegar entre las 3 etapas, probar los 5 formatos educativos y ver las respuestas estructuradas sin necesidad de iniciar el backend.
* **Modo Conectado (API Real):** Cuando tengas la API de FastAPI corriendo localmente (por ejemplo, en `http://localhost:8000`), crea un archivo `.env` dentro de la carpeta `frontend/`:

```env
VITE_API_URL=http://localhost:8000
```

> **Nota:** Al reiniciar con `npm run dev`, el frontend enviará las solicitudes de adaptación directamente al backend FastAPI.

---

## 🧩 Estructura de la Interfaz

La aplicación cubre el flujo pedagógico y técnico en **3 vistas principales**:

1. **Paso 01 / Configuración e Ingesta (`IngestView`)**  
   Permite subir archivos (`PDF`, `MD`, `TXT`) o ingresar texto plano, configurando perfil del estudiante, formato pedagógico objetivo, nicho de aplicación y nivel de detalle.

2. **Paso 02 / Visor del Estudiante (`ViewerView`)**  
   Renderiza de forma interactiva y adaptativa los **5 formatos pedagógicos**:
   * 📇 **Flashcards 3D:** Tarjetas interactivas con animación de giro y pistas didácticas.
   * 📝 **Quiz Interactivo:** Preguntas de opción múltiple con feedback y justificación pedagógica inmediata.
   * 🛠️ **Guía Práctica (Tutorial):** Pasos accionables, prerrequisitos y recomendaciones.
   * 📊 **Resumen Ejecutivo (TL;DR):** Puntos clave destacados y métricas de impacto.
   * 🎬 **Guion Didáctico:** Estructura temporal para clase o video con notas de locución y apoyos visuales.

3. **Paso 03 / Auditoría y Métricas OCI (`MetricsView`)**  
   Muestra el score de anclaje RAG para control de fidelidad/alucinaciones, telemetría de persistencia en OCI Object Storage y el visor de payload JSON final validado.

---

## 📁 Estructura del Código

```text
frontend/
├── public/              # Recursos estáticos
├── src/
│   ├── components/      # Componentes UI y vistas pedagógicas
│   │   ├── FlashcardViewer.tsx
│   │   ├── QuizViewer.tsx
│   │   ├── TutorialViewer.tsx
│   │   ├── SummaryViewer.tsx
│   │   └── ScriptViewer.tsx
│   ├── services/        # Cliente HTTP y mock data (api.ts)
│   ├── types/           # Tipos e interfaces TypeScript (api.ts)
│   ├── App.tsx          # Componente raíz y control de flujo
│   ├── main.tsx         # Punto de entrada React
│   └── index.css        # Estilos globales y utilidades
├── package.json         # Dependencias y scripts
├── tsconfig.json        # Configuración de TypeScript
└── vite.config.ts       # Configuración del bundler Vite
```

---

## 🛠️ Comandos de Referencia

| Comando | Acción |
| :--- | :--- |
| `npm run dev` | Inicia el servidor de desarrollo local con Hot Module Replacement (HMR). |
| `npm run build` | Compila y valida tipos TypeScript, generando los archivos de producción en `dist/`. |
| `npm run preview` | Previsualiza localmente el build de producción generado. |
| `npm run lint` | Ejecuta ESLint para verificar consistencia y reglas de código. |
