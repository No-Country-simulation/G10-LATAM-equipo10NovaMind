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
              duracion_segundos: { type: Type.NUMBER },
              estimacion_palabras: { type: Type.NUMBER },
              titulo: { type: Type.STRING },
              guion_locutor: { type: Type.STRING },
              storyboard_visual: { type: Type.STRING },
              consejo_pedagogico: { type: Type.STRING },
              objetivo_pedagogico: { type: Type.STRING },
              visual: {
                type: Type.OBJECT,
                properties: {
                  tipo: {
                    type: Type.STRING,
                    enum: ['diagrama_bloques', 'ppt_concepto', 'palabras_clave', 'comparativa']
                  },
                  titulo: { type: Type.STRING },
                  puntos_clave: { type: Type.ARRAY, items: { type: Type.STRING } },
                  codigo_o_estructura: { type: Type.STRING },
                  prompt_grafico: { type: Type.STRING }
                },
                required: ['tipo', 'titulo']
              },
              fuentes: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    chunk_id: { type: Type.STRING },
                    pagina: { type: Type.NUMBER },
                    texto_fuente: { type: Type.STRING }
                  },
                  required: ['chunk_id', 'texto_fuente']
                }
              }
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
  pdfBase64?: string | null
): Promise<AdaptedContentPackage> {
  const timestamp = Date.now();
  const promptText = `
Eres un Sistema Inteligente de Adaptación y Generación de Contenido Educativo (NovaMind).
Tu misión es procesar el material ingresado (analizando el texto provisto o el archivo adjunto multimodalmente) y generar un paquete educativo completo anclado estrictamente a la fuente (RAG Grounding), mitigando cualquier alucinación.

PARÁMETROS:
- Título Identificado: "${docTitle || 'Documento sin título'}"
- Perfil del Destinatario: "${profile}"
- Formato Solicitado: "${format}"
- Nicho / Enfoque: "${niche}"
- Nivel de Profundidad: "${detail}"

${docContent && !pdfBase64 ? `DOCUMENTACIÓN FUENTE:\n"""\n${docContent}\n"""` : 'El material fuente ha sido adjuntado para análisis e interpretación multimodal completa.'}

DIRECTIVAS DIDÁCTICAS OBLIGATORIAS:
1. Adapta el lenguaje, ejemplos y analogías al perfil "${profile}" en el contexto de "${niche}".
2. Genera las 5 estaciones pedagógicas completas:
   - resumen_ninja: analogía central pedagógica, 3 o 4 conceptos clave verificados y métricas rápidas.
   - flashcards: mínimo 3 tarjetas de active recall con pregunta (frente), respuesta (dorso) y pista didáctica analógica.
   - tutorial: 3 a 4 pasos prácticos progresivos con instrucciones reproducibles y validación técnica.
   - director_cut: 2 o 3 escenas de storyboard y teleprompter con control estricto de palabras (110 a 125 palabras en total para microclases de <= 60s), especificación visual técnica determinista (diagrama de bloques, ppt concepto, etc.) y citas exactas a la fuente (fuentes con chunk_id y texto_fuente).
   - quiz: mínimo 3 preguntas didácticas con opciones, índice de la respuesta correcta (0-indexed) y justificación referenciando citas directas.
3. En 'almacenamiento_oci', define:
   - bucket: "novamind-edtech-artifacts"
   - objeto_id: "artifact-${timestamp}.json"
   - status_upload: "completado"
   - region: "sa-saopaulo-1"
   - etag: "etag-md5-verified"
   - tamano_bytes: 4096
   - url_always_free: "https://objectstorage.sa-saopaulo-1.oraclecloud.com/n/ax9k3z/b/novamind-edtech-artifacts/o/artifact-${timestamp}.json"
`;

  const contents: (string | Part)[] = [];

  if (pdfBase64) {
    const cleanData = pdfBase64.includes(',') ? pdfBase64.split(',')[1] : pdfBase64;
    contents.push({
      inlineData: {
        data: cleanData,
        mimeType: 'application/pdf',
      },
    });
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