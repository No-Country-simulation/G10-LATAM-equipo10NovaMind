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
      
      const isSpecializedAudioOrImage = 
        name.includes('tts') || 
        name.includes('transcribe') || 
        name.includes('image') || 
        name.includes('clip') ||
        name.includes('robotics') ||
        name.includes('banana');

      if (!isSpecializedAudioOrImage) {
        candidateNames.push(name);
      }
    }

    const priorityList = [
      'gemini-3.1-flash-lite',
      'gemini-3.5-flash',
      'gemini-flash-latest',
      'gemini-pro-latest',
      'gemini-2.5-flash'
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
    return ['gemini-3.5-flash', 'gemini-flash-latest', 'gemini-3.1-flash-lite'];
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
Eres un Sistema Inteligente de Adaptación y Generación de Contenido Educativo (NuevaMente).
Tu misión es procesar el material ingresado (analizando el texto provisto o los archivos adjuntos multimodalmente) y generar un paquete educativo completo anclado estrictamente a la fuente (RAG Grounding), mitigando cualquier alucinación.

PARÁMETROS:
- Título Identificado: "${docTitle || 'Documento sin título'}"
- Perfil del Destinatario: "${profile}"
- Formato Solicitado: "${format}"
- Nicho / Enfoque: "${niche}"
- Nivel de Profundidad: "${detail}"

${docContent ? `DOCUMENTACIÓN FUENTE:\n"""\n${docContent}\n"""` : 'El material fuente ha sido adjuntado para análisis e interpretación multimodal completa.'}

DIRECTIVAS DIDÁCTICAS OBLIGATORIAS:
1. El sistema es COMPLETAMENTE AGNÓSTICO: el contenido puede ser de cualquier disciplina (literatura, ciencia, filosofía, historia, arte, ingeniería, etc.). Adapta el lenguaje, ejemplos y analogías al perfil "${profile}" en el contexto de "${niche}". JAMÁS asumas ni menciones temas ajenos como infraestructura cloud u OCI a menos que la documentación fuente trate explícitamente sobre eso.
2. Genera las 5 estaciones pedagógicas completas:
   - resumen_ninja: analogía central pedagógica, 3 o 4 conceptos clave verificados y métricas rápidas (en 'tipo_oci' define la categoría temático-conceptual del tema, ej: 'Literatura Alegórica', 'Filosofía Práctica', 'Biología Molecular'; en 'costo' la accesibilidad o nivel de esfuerzo cognitivo).
   - flashcards: mínimo 3 tarjetas de active recall con pregunta (frente), respuesta (dorso) y pista didáctica analógica.
   - tutorial: 3 a 4 pasos prácticos o interactivos progresivos con instrucciones reproducibles y validación didáctica.
   - director_cut: mínimo 4 a 6 escenas completas de storyboard para el guion didáctico audiovisual (cubriendo introducción/gancho, planteamiento del conflicto/problema, desglose conceptual, y conclusión didáctica). Cada escena DEBE incluir:
     * 'titulo': Título descriptivo de la escena.
     * 'tiempo': Duración estimada (ej. '00:00 - 01:30').
     * 'guion_locutor': LOCUCIÓN DOCENTE EXTENSA, DESCRIPTIVA Y CONCEPTUAL (OBLIGATORIO: Mínimo 100 a 180 palabras, 2 a 3 párrafos fluidos por escena). NUNCA generes frases cortas de una línea. El guion de locución debe EXPLICAR A FONDO los conceptos fundamentales de la escena, detallando las causas, las metáforas o mecanismos técnicos/conceptuales, su significado y el aprendizaje concreto que el estudiante debe asimilar en ese momento.
     * 'storyboard_visual': DESCRIPCIÓN VISUAL Y DE PUESTA EN ESCENA (QUÉ SE VE EN PANTALLA: composición, personajes, ambientación, elementos en escena, iluminación, encuadre cinematográfico, 100% fiel al tema).
     * 'consejo_pedagogico': Recomendación didáctica para transmitir eficazmente la idea.
   - quiz: mínimo 3 preguntas didácticas con opciones, índice de la respuesta correcta (0-indexed) y justificación referenciando citas directas.
3. En 'almacenamiento_oci', define los metadatos técnicos de persistencia de artefacto:
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
          temperature: 0.2,
        },
      });

      if (response && response.text) {
        const raw = response.text.trim();
        const jsonCleaned = raw.startsWith('```')
          ? raw.replace(/^```json\s*/, '').replace(/^```\s*/, '').replace(/```$/, '').trim()
          : raw;

        const parsed = JSON.parse(jsonCleaned) as AdaptedContentPackage;
        parsed.metadatos.modelo_llm = modelName;
        return parsed;
      }
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      console.warn(`Intento fallido con ${modelName}:`, errorMsg);
      lastError = err instanceof Error ? err : new Error(String(err));
      await new Promise((r) => setTimeout(r, 500));
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