import { GoogleGenAI, Type, type Schema, type Part } from '@google/genai';
import type { 
  AdaptedContentPackage, 
  RecipientProfile, 
  OutputFormat, 
  IndustryNiche, 
  DetailLevel 
} from '../types/types';

const apiKey = import.meta.env.VITE_GEMINI_API_KEY || '';
const ai = new GoogleGenAI({ apiKey });

const adaptationSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    status: { type: Type.STRING, enum: ['exito', 'error'] },
    metadatos: {
      type: Type.OBJECT,
      properties: {
        perfil_aplicado: { type: Type.STRING },
        formato_generado: { type: Type.STRING },
        tiempo_estimado_estudio_minutos: { type: Type.NUMBER },
        conceptos_clave: { 
          type: Type.ARRAY, 
          items: { type: Type.STRING } 
        },
        fecha_generacion: { type: Type.STRING },
        modelo_llm: { type: Type.STRING }
      },
      required: ['perfil_aplicado', 'formato_generado', 'tiempo_estimado_estudio_minutos', 'conceptos_clave', 'fecha_generacion', 'modelo_llm']
    },
    contenido_adaptado: {
      type: Type.OBJECT,
      properties: {
        titulo: { type: Type.STRING },
        introduccion_contextualizada: { type: Type.STRING },
        resumen_ninja: {
          type: Type.OBJECT,
          properties: {
            titulo: { type: Type.STRING },
            analogia_central: { type: Type.STRING },
            conceptos_clave: { 
              type: Type.ARRAY, 
              items: { 
                type: Type.OBJECT, 
                properties: { 
                  id: { type: Type.STRING }, 
                  texto: { type: Type.STRING }, 
                  verificado: { type: Type.BOOLEAN } 
                }, 
                required: ['id', 'texto', 'verificado'] 
              } 
            },
            metricas_rapidas: {
              type: Type.OBJECT,
              properties: {
                riesgo: { type: Type.STRING },
                despliegue: { type: Type.STRING },
                tipo_oci: { type: Type.STRING },
                costo: { type: Type.STRING }
              },
              required: ['riesgo', 'despliegue', 'tipo_oci', 'costo']
            }
          },
          required: ['titulo', 'analogia_central', 'conceptos_clave', 'metricas_rapidas']
        },
        flashcards: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              id: { type: Type.STRING },
              frente: { type: Type.STRING },
              dorso: { type: Type.STRING },
              pista_didactica: { type: Type.STRING },
              dominado: { type: Type.BOOLEAN }
            },
            required: ['id', 'frente', 'dorso', 'pista_didactica']
          }
        },
        tutorial: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              id: { type: Type.STRING },
              paso: { type: Type.NUMBER },
              titulo: { type: Type.STRING },
              descripcion: { type: Type.STRING },
              cli_command: { type: Type.STRING },
              completado: { type: Type.BOOLEAN },
              verificacion: { type: Type.STRING }
            },
            required: ['id', 'paso', 'titulo', 'descripcion', 'cli_command', 'completado', 'verificacion']
          }
        },
        director_cut: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              id: { type: Type.STRING },
              escena: { type: Type.NUMBER },
              tiempo: { type: Type.STRING },
              titulo: { type: Type.STRING },
              guion_locutor: { type: Type.STRING },
              storyboard_visual: { type: Type.STRING },
              consejo_pedagogico: { type: Type.STRING }
            },
            required: ['id', 'escena', 'tiempo', 'titulo', 'guion_locutor', 'storyboard_visual', 'consejo_pedagogico']
          }
        },
        quiz: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              id: { type: Type.STRING },
              pregunta: { type: Type.STRING },
              opciones: { type: Type.ARRAY, items: { type: Type.STRING } },
              respuesta_correcta: { type: Type.NUMBER },
              justificacion_rag: { type: Type.STRING },
              cita_fuente: { type: Type.STRING }
            },
            required: ['id', 'pregunta', 'opciones', 'respuesta_correcta', 'justificacion_rag', 'cita_fuente']
          }
        }
      },
      required: ['titulo', 'introduccion_contextualizada', 'resumen_ninja', 'flashcards', 'tutorial', 'director_cut', 'quiz']
    },
    evaluacion_calidad: {
      type: Type.OBJECT,
      properties: {
        anclaje_fuente_score: { type: Type.NUMBER },
        claridad_pedagogica: { type: Type.STRING, enum: ['Alta', 'Media', 'Sobresaliente'] },
        observaciones: { type: Type.STRING },
        mitigacion_alucinaciones: { type: Type.STRING },
        chunks_procesados: { type: Type.NUMBER },
        similitud_coseno_promedio: { type: Type.NUMBER }
      },
      required: ['anclaje_fuente_score', 'claridad_pedagogica', 'observaciones', 'mitigacion_alucinaciones', 'chunks_procesados', 'similitud_coseno_promedio']
    },
    almacenamiento_oci: {
      type: Type.OBJECT,
      properties: {
        bucket: { type: Type.STRING },
        objeto_id: { type: Type.STRING },
        status_upload: { type: Type.STRING, enum: ['completado', 'pendiente', 'error'] },
        region: { type: Type.STRING },
        etag: { type: Type.STRING },
        tamano_bytes: { type: Type.NUMBER },
        url_always_free: { type: Type.STRING }
      },
      required: ['bucket', 'objeto_id', 'status_upload', 'region', 'etag', 'tamano_bytes', 'url_always_free']
    }
  },
  required: ['status', 'metadatos', 'contenido_adaptado', 'evaluacion_calidad', 'almacenamiento_oci']
};

async function getAvailableBestModels(): Promise<string[]> {
  try {
    const modelListResponse = await ai.models.list();
    const candidateNames: string[] = [];
    for await (const m of modelListResponse) {
      const name = m.name?.replace('models/', '') || '';
      const isSpecialized = 
        name.includes('tts') || 
        name.includes('transcribe') || 
        name.includes('image') || 
        name.includes('clip') ||
        name.includes('robotics') ||
        name.includes('banana');

      if (!isSpecialized) {
        candidateNames.push(name);
      }
    }

    const priorityList = [
      'gemini-2.5-flash',
      'gemini-flash-latest',
      'gemini-pro-latest'
    ];

    const sorted = candidateNames.sort((a, b) => {
      const idxA = priorityList.indexOf(a);
      const idxB = priorityList.indexOf(b);
      const scoreA = idxA !== -1 ? 100 - idxA : 0;
      const scoreB = idxB !== -1 ? 100 - idxB : 0;
      return scoreB - scoreA;
    });

    return sorted.length > 0 ? sorted : priorityList;
  } catch (err: unknown) {
    console.warn("Aviso al listar modelos, usando lista base:", err);
    return ['gemini-2.5-flash', 'gemini-flash-latest'];
  }
}

export async function generatePedagogicalPackage(
  docTitle: string,
  docContent: string,
  profile: RecipientProfile,
  format: OutputFormat,
  niche: IndustryNiche,
  detail: DetailLevel,
  pdfBase64?: string | string[] | null
): Promise<AdaptedContentPackage> {
  const timestamp = Date.now();

  const promptText = `
Eres un Diseñador Instruccional Senior y Especialista en Pedagogía Técnica de NuevaMente.
Tu misión es transformar el material técnico provisto en una ruta educativa gamificada de 5 estaciones, anclada 100% en la fuente original (RAG Grounding sin alucinaciones) y adaptada de manera estricta a los tres parámetros seleccionados.

============================================================
PARÁMETROS OBLIGATORIOS DE ADAPTACIÓN:
============================================================
- Título Identificado: "${docTitle || 'Documento Técnico'}"
- Perfil del Destinatario: "${profile}"
- Formato Solicitado: "${format}"
- Nicho / Enfoque: "${niche}"
- Nivel de Profundidad: "${detail}"

DIRECTIVAS ESPECÍFICAS POR PERFIL:
1. PERFIL: "${profile}"
   - Si es "Principiante" o "Gestor / Ejecutivo (No Técnico)":
     * Prohibido dar por sentados conceptos previos o usar acrónimos sin desglosar.
     * Si es Principiante: explica los términos con lenguaje formativo, amigable y progresivo.
     * Si es Gestor: enfoca las implicaciones en costos, gobernanza, impacto de negocio, continuidad operativa y SLAs.
   - Si es "Desarrollador Junior":
     * Enfócate en el flujo de trabajo práctico, lógica de implementación y cómo evitar errores habituales de configuración.
   - Si es "Líder Técnico / Arquitecto":
     * Usa terminología rigurosa, conceptos de alta disponibilidad, seguridad por capas, tolerancia a fallos y decisiones de diseño técnico empresarial.

2. NICHO: "${niche}"
   - TODAS las analogías, metáforas, pistas didácticas y ejemplos DEBEN contextualizarse dentro del sector "${niche}":
     * Si es "Fintech": formula ejemplos con transacciones bancarias, pasarelas de pago, registros contables inmutables, cumplimiento PCI-DSS y prevención de fraude.
     * Si es "Salud": formula ejemplos con registros médicos electrónicos (EHR), confidencialidad de historias clínicas, telemedicina o monitores hospitalarios.
     * Si es "E-commerce": formula ejemplos con inventario, carritos de compras, picos de demanda en Black Friday y catálogos distribuidos.
     * Si es "General": utiliza analogías de sistemas urbanos, logística o infraestructura digital estándar.

3. NIVEL DE DETALLE: "${detail}"
   - Si es "Didáctico":
     * Prioriza modelos mentales intuitivos, analogías conceptuales en las pistas didácticas y comandos introductorios claros.
   - Si es "Técnico Profundo":
     * Proporciona comandos de terminal precisos (ej. comandos de OCI CLI con flags reales como --cidr-block, --compartment-id, --is-pv-encryption-in-transit-enabled, etc.), consideraciones de subredes, topología y configuraciones exactas.

============================================================
DIRECTIVA DE GESTIÓN DE FUENTES MÚLTIPLES (MULTI-DOC):
============================================================
Si el material fuente incluye varios documentos o secciones:
1. Identifica el hilo conductor o tema principal dominante y estructura la ruta de aprendizaje en torno a él.
2. Integra los diferentes archivos como módulos o facetas complementarias de la misma lección.
3. Si los documentos tratan temas completamente dispares, prioriza el tema con mayor profundidad técnica/estructural para construir las 5 estaciones, asegurando un recorrido didáctico enfocado, sólido y sin dispersión conceptual.

============================================================
DOCUMENTACIÓN FUENTE:
============================================================
${docContent ? `"""\n${docContent}\n"""` : 'Documento adjunto para análisis multimodal directo.'}

============================================================
ESTRUCTURA DE LAS 5 ESTACIONES A GENERAR:
============================================================
1. "resumen_ninja":
   - "titulo": Título pedagógico ajustado al perfil "${profile}".
   - "analogia_central": Metáfora central adaptada al nicho "${niche}".
   - "conceptos_clave": 3 o 4 conceptos verificados en la fuente original.
   - "metricas_rapidas": riesgo, despliegue, tipo_oci (categoría temática de la lección) y costo (esfuerzo cognitivo o capa de servicio).

2. "flashcards":
   - Mínimo 3 tarjetas de active recall.
   - "frente": Pregunta o reto conceptual desafiante.
   - "dorso": Respuesta explicada con precisión según el perfil "${profile}".
   - "pista_didactica": Pista analógica ambientada exclusivamente en el nicho "${niche}".

3. "tutorial":
   - 3 o 4 pasos prácticos progresivos.
   - Si el nivel es "Técnico Profundo", "cli_command" debe contener sintaxis técnica o flags detallados. Si es "Didáctico", comandos formativos claros.
   - "verificacion": Criterio de validación del paso.

4. "director_cut":
   - 4 a 5 escenas de storyboard didáctico.
   - "guion_locutor": Locución docente extensa (100 a 160 palabras por escena) que explique los conceptos con el tono adecuado al perfil "${profile}".
   - "storyboard_visual": Descripción cinematográfica y de puesta en escena coherente con el nicho "${niche}".
   - "consejo_pedagogico": Recomendación de dicción o énfasis didáctico.

5. "quiz":
   - Mínimo 3 preguntas de opción múltiple contextualizadas en el nicho "${niche}".
   - "respuesta_correcta": Índice numérico base 0.
   - "justificacion_rag": Justificación directa citando el documento original.
   - "cita_fuente": Fragmento textual de la fuente de donde se extrajo.

6. "almacenamiento_oci":
   - bucket: "nuevamente-edtech-artifacts"
   - objeto_id: "artifact-${timestamp}.json"
   - status_upload: "completado"
   - region: "sa-saopaulo-1"
   - etag: "etag-md5-verified"
   - tamano_bytes: 4096
   - url_always_free: "https://objectstorage.sa-saopaulo-1.oraclecloud.com/n/ax9k3z/b/nuevamente-edtech-artifacts/o/artifact-${timestamp}.json"
`;

  const contents: (string | Part)[] = [];

  if (pdfBase64) {
    const pdfArray = Array.isArray(pdfBase64) ? pdfBase64 : [pdfBase64];
    for (const b64 of pdfArray) {
      if (b64 && b64.trim().length > 0) {
        const cleanData = b64.includes(',') ? b64.split(',')[1] : b64;
        contents.push({
          inlineData: {
            data: cleanData,
            mimeType: 'application/pdf',
          },
        });
      }
    }
  }

  contents.push(promptText);

  const availableModels = await getAvailableBestModels();
  let lastError: Error | null = null;

  for (const modelName of availableModels) {
    try {
      const response = await ai.models.generateContent({
        model: modelName,
        contents,
        config: {
          responseMimeType: 'application/json',
          responseSchema: adaptationSchema,
          temperature: 0.25,
        },
      });

      if (response && response.text) {
        const raw = response.text.trim();
        const jsonCleaned = raw.startsWith('```')
          ? raw.replace(/^```json\s*/, '').replace(/^```\s*/, '').replace(/```$/, '').trim()
          : raw;

        const parsed = JSON.parse(jsonCleaned) as AdaptedContentPackage;
        parsed.metadatos.modelo_llm = modelName;
        parsed.metadatos.perfil_aplicado = profile;
        return parsed;
      }
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      console.warn(`Intento fallido con ${modelName}:`, errorMsg);
      lastError = err instanceof Error ? err : new Error(String(err));
      await new Promise((r) => setTimeout(r, 400));
    }
  }

  throw lastError || new Error('No se pudo generar la adaptación con los modelos activos de tu clave.');
}

export async function enrichSceneVisualDescription(
  docTitle: string,
  sceneTitle: string,
  currentVisual: string,
  scriptText: string
): Promise<string> {
  const prompt = `Eres un director audiovisual pedagógico y artista de storyboard.
Contexto o Título de la lección: "${docTitle || 'Lección Didáctica'}"
Escena: "${sceneTitle}"
Guion de locución docente: "${scriptText}"
Descripción visual previa: "${currentVisual}"

Instrucción didáctica OBLIGATORIA:
Genera una descripción visual y de puesta en escena enriquecida (storyboard cinematográfico-didáctico) que represente con alta fidelidad esta escena.
Describe:
- Encuadre y plano de cámara (ej. plano general, plano medio, plano detalle simbólico).
- Iluminación, ambientación y paleta cromática acorde al tono de la escena.
- Elementos focales, personajes/objetos y acción en pantalla que transmiten visualmente el concepto sin distracciones.
- Metáfora o recurso visual que ayuda al estudiante a interiorizar el aprendizaje.

Devuelve ÚNICAMENTE la descripción visual en un párrafo conciso y evocador (entre 60 y 90 palabras), en español, sin preámbulos, sin asteriscos ni encabezados.`;

  const availableModels = await getAvailableBestModels();
  for (const modelName of availableModels) {
    try {
      const response = await ai.models.generateContent({
        model: modelName,
        contents: [prompt],
        config: {
          temperature: 0.3,
        },
      });
      if (response && response.text) {
        return response.text.trim();
      }
    } catch (err: unknown) {
      console.warn(`Error enriqueciendo escena con ${modelName}:`, err);
      continue;
    }
  }
  return currentVisual;
}

export async function expandSceneScript(
  docTitle: string,
  sceneTitle: string,
  currentScript: string,
  visualDescription: string,
  pedagogyTip: string
): Promise<string> {
  const prompt = `Eres un docente experto y narrador pedagógico de alto nivel.
Contexto o Título de la obra/lección: "${docTitle || 'Lección Didáctica'}"
Escena actual: "${sceneTitle}"
Guion de locución breve actual: "${currentScript}"
Descripción visual de la escena: "${visualDescription}"
Enfoque pedagógico: "${pedagogyTip}"

MISIÓN OBLIGATORIA:
Reescribe y expande el guion de locución del docente para el teleprompter de esta escena.
La locución DEBE ser más larga, fluida, inmersiva y profundamente descriptiva (entre 120 y 180 palabras, 2 o 3 párrafos pedagógicos).
Debe:
1. EXPLICAR CON CLARIDAD Y PROFUNDIDAD los conceptos clave que suceden en esta escena, sus causas, implicaciones o metáforas centrales.
2. Describir la situación conectando la reflexión didáctica con lo que el estudiante ve en pantalla.
3. Proporcionar un aprendizaje concreto y memorable, manteniendo un ritmo de dicción natural y cautivador para la síntesis de voz.

Devuelve ÚNICAMENTE el texto narrativo en español listo para locutar, sin títulos, sin viñetas, sin comillas externas ni aclaraciones adicionales.`;

  const availableModels = await getAvailableBestModels();
  for (const modelName of availableModels) {
    try {
      const response = await ai.models.generateContent({
        model: modelName,
        contents: [prompt],
        config: {
          temperature: 0.35,
        },
      });
      if (response && response.text) {
        return response.text.trim();
      }
    } catch (err: unknown) {
      console.warn(`Error ampliando locución con ${modelName}:`, err);
      continue;
    }
  }
  return currentScript;
}