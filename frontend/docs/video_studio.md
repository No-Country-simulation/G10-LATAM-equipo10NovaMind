# 🎬 NuevaMente Video Studio — Guía de Arquitectura e Implementación

> **Módulo:** NuevaMente Video Studio  
> **Ubicación:** Accesible desde la Estación 04 (*Director Cut*)  
> **Propósito:** Generación automatizada de microclases audiovisuales con voz en off, animaciones vectoriales, subtítulos sincronizados y exportación de video, anclado 100% en documentación técnica mediante RAG Grounding y OCI.

---

## 🎯 1. Visión General y Experiencia de Usuario

**NuevaMente Video Studio** extiende la experiencia de *Director Cut* para convertir el guion docente y las indicaciones de escena en un video explicativo interactivo y descargable, inspirado en los videos explicativos de NotebookLM pero optimizado para conceptos de ingeniería en la nube (OCI, redes VCN, bases de datos autónomas, seguridad).

### Flujo de Usuario de 4 Pasos:
1. **Configuración & Selección de Escenas:**
   * Selección individual o masiva de las escenas del storyboard de Director Cut.
   * Elección de la duración estimada objetivo (~60s, ~90s, ~120s).
   * Selección de voz para locución en **Español Latinoamericano** / Neural con botón de prueba en vivo.
   * Elección de estilo visual: *Tecnológico (OCI Cloud Dark & Neón)*, *Minimalista*, o *Ilustrativo*.
2. **Storyboard Audiovisual Estructurado:**
   * Generación y visualización de escenas enriquecidas con titular en pantalla, puntos clave didácticos, tipo de animación identificada y cita de anclaje RAG.
3. **Reproductor & Estudio Audiovisual (16:9):**
   * Reproductor interactivo cinematográfico con componentes gráficos animados por código (React, SVG, Canvas).
   * Locución didáctica con síntesis de voz desacoplada y modo alternativo silencioso.
   * Subtítulos legibles (*Closed Captions* CC) sincronizados con el ritmo de la locución.
   * Controles de reproducción: Play/Pausa, anterior/siguiente escena, reinicio, barra de progreso con hitos de escena, selector de velocidad (0.75x a 1.5x) y modo pantalla completa.
4. **Renderizado y Exportación de Video:**
   * Motor de grabación en cliente mediante Canvas API + MediaStream / MediaRecorder + Web Audio API.
   * Generación de archivo de video descargable (`.webm` / `.mp4`).
   * Manifiesto de persistencia para OCI Object Storage Always Free.

---

## 🏗️ 2. Arquitectura de Código y Componentes

```
frontend/src/
├── types/
│   └── videoStudio.ts                # Contratos TypeScript: AudiovisualScene, Storyboard, Config, etc.
├── utils/
│   ├── ttsService.ts                 # Servicio desacoplado de Síntesis de Voz (Web Speech API + Fallback)
│   ├── videoStudioGenerator.ts       # Generador de Storyboard Audiovisual RAG (Gemini + Local Transformer)
│   └── videoExporter.ts              # Motor de renderizado y grabación a video real (Canvas + MediaRecorder)
└── components/
    ├── VideoStudio/
    │   ├── VideoStudioModal.tsx      # Modal orquestador del estudio con los 4 pasos
    │   ├── VideoStudio.module.css    # Estilos Dark UI con glassmorphism y acentos neón
    │   ├── VideoPlayer.tsx           # Reproductor 16:9 con controles interactivos y subtítulos
    │   ├── VideoPlayer.module.css    # Estilos del reproductor y línea de tiempo
    │   └── graphics/                 # Recursos visuales y diagramas animados
    │       ├── SceneGraphicRenderer.tsx     # Selector dinámico según tipo de animación
    │       ├── NetworkTopologyGraphic.tsx   # Topología VCN OCI con paquetes HTTPS
    │       ├── DatabaseSafeGraphic.tsx      # Autonomous DB, TDE 256-bit y Data Safe Masking
    │       ├── ServerTrafficGraphic.tsx     # Balanceador, WAF y mitigación de tráfico DDoS
    │       ├── ComparisonGraphic.tsx        # Comparativa On-Prem vs OCI Cloud
    │       ├── TerminalCodeGraphic.tsx      # Simulación de consola OCI CLI con tipeo
    │       ├── SequentialProcessGraphic.tsx # Proceso pedagógico secuencial
    │       ├── GenericConceptGraphic.tsx    # Matriz radial de conceptos
    │       └── graphics.module.css          # Animaciones CSS, glows y grids de fondo
    └── stations/
        └── Station4DirectorCut/
            ├── Station4DirectorCut.tsx      # Botón de acceso y enlace con Video Studio
            └── Station4DirectorCut.module.css
```

---

## 🔊 3. Capa de Síntesis de Voz (TTS) y Sincronización

* **Motor Principal:** `window.speechSynthesis` (Web Speech API) con detección inteligente de voces en español latino (`es-419`, `es-MX`, `es-AR`, `es-CO`, `es-US`).
* **Modulación Didáctica:** Cadencia natural (~140 a 160 palabras por minuto) y modulación de velocidad de reproducción (0.75x a 1.5x).
* **Sincronización:** Cálculo dinámico de tiempos por palabra y eventos de locución (`onstart`, `onboundary`, `onend`), permitiendo que las escenas avancen orgánicamente con el audio.
* **Modo Silencioso / Fallback:** Si el navegador no dispone de sintetizador o el usuario silencia el audio, la microclase se reproduce con subtítulos y temporización estimada automática.

---

## 🎨 4. Recursos Visuales y Animaciones por Código

Para evitar dependencias de APIs de video externas o modelos propietarios de pago:
1. **Topología de Red VCN OCI:** Renderiza subred pública, subred privada (*Prohibit Public IP*), Internet Gateway y pulsos luminosos de paquetes viajando en tiempo real.
2. **Base de Datos Autónoma & Data Safe:** Visualiza el auto-tuning de índices B-Tree, el cifrado TDE y la transformación en tiempo real de datos sensibles a formato enmascarado (`****-****-****-8842`).
3. **Flujo de Tráfico & DDoS:** Muestra el filtrado en OCI WAF y la distribución equilibrada en nodos de aplicación.
4. **Terminal OCI CLI:** Efecto de tipeo en vivo de comandos de infraestructura como código (*IaaS*) con salida coloreada y checkmarks de verificación.
5. **Comparativa Visual:** Contraste de métricas de despliegue (3 meses en físico vs 3 segundos en OCI).

---

## 💾 5. Persistencia e Integración OCI Always Free

Cada microclase generada produce metadatos estructurados compatibles con **OCI Object Storage**:
* **Bucket:** `nuevamente-edtech-artifacts`
* **Objeto ID:** `microclase-video-studio.json` / `.webm`
* **Región:** `sa-saopaulo-1` / `us-ashburn-1`
* **Integración:** Totalmente compatible con `utils/ociStorage.ts` y exportable en formato local o subida directa a la nube.

---

## 🚀 6. Guía de Ejecución y Pruebas

1. **Iniciar el Servidor de Desarrollo:**
   ```bash
   cd frontend
   npm install
   npm run dev
   ```
2. **Acceder a la Aplicación:**
   * Abrir `http://localhost:5173`.
3. **Generar un Paquete Pedagógico:**
   * En el **Paso 1 (Ingesta)**, seleccionar cualquier escenario técnico (ej. *Introducción a la Arquitectura de Redes VCN en OCI*) y presionar **"Generar Adaptación Pedagógica con Gemini (RAG)"**.
4. **Entrar a Director Cut:**
   * En el **Paso 2 (Knowledge Quest)**, hacer clic en la **Estación 04 · Storyboard & Guion Docente**.
5. **Abrir Video Studio:**
   * Presionar el botón **"Generar microclase audiovisual"** en la barra superior.
   * Seleccionar la duración deseada y probar la voz.
   * Hacer clic en **"Generar Storyboard Audiovisual"**.
   * Presionar **"Lanzar Estudio & Reproducción"** para disfrutar de la microclase interactiva.
   * En la pestaña **Exportar Video**, presionar **"Iniciar Renderizado de Video"** para obtener el archivo de video `.webm` / `.mp4`.
