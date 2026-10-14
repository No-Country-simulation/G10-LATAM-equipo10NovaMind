/**
 * Prueba manual de integración del video narrado (Estación 04).
 * NO se ejecuta con `npm test`: gasta cuota de Gemini y créditos de ElevenLabs (~375 por narración).
 *
 * Requiere el backend en marcha con modo invitado. Dos formas de uso:
 *   node tests/e2e_narracion.manual.ts [ruta-documento.md]
 *       Genera el paquete (SSE, modo paralelo), guarda el guion en un JSON temporal y lo narra.
 *   node tests/e2e_narracion.manual.ts --spec <guion.json>
 *       Narra un guion ya guardado: no vuelve a gastar cuota de Gemini en generar el paquete.
 *
 * Comprueba lo que la UI da por hecho: que cada escena trae audio, que la duración medida cabe
 * en el máximo (con la velocidad de reproducción permitida) y que la respuesta llega antes del
 * corte de Cloudflare, porque este endpoint responde de una vez, sin SSE.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const API = process.env.API_URL ?? 'http://127.0.0.1:8000';
const AUTH = { Authorization: 'Bearer guest-demo-token' };
const CORTE_CLOUDFLARE_S = 100;
const MARGEN_SEGURO_S = 85;

type Spec = {
  escenas: Array<{
    escena: number;
    titulo: string;
    guion_locutor: string;
    audio?: { duracion_real_s?: number; proveedor?: string } | null;
    imagen?: { tipo?: string; autor?: string; licencia?: string; proveedor?: string } | null;
  }>;
  max_duration: number;
  velocidad_reproduccion?: number;
  duracion_total_real?: number | null;
};

const t0 = Date.now();
const seg = () => ((Date.now() - t0) / 1000).toFixed(1).padStart(5);
const palabras = (t: string) => t.trim().split(/\s+/).filter(Boolean).length;

async function guionDesdeDocumento(ruta: string): Promise<Spec> {
  const form = new FormData();
  form.append('texto_directo', readFileSync(ruta, 'utf8'));
  form.append('titulo', 'Prueba E2E narración');
  form.append('perfil_destinatario', 'Principiante');
  form.append('formato_salida', 'Paquete Educativo Completo (5 Estaciones)');
  form.append('modo_rag', 'paralelo');

  const res = await fetch(`${API}/api/v1/adaptar/stream`, { method: 'POST', body: form, headers: AUTH });
  if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}: ${await res.text()}`);

  let buffer = '';
  const decoder = new TextDecoder();
  for await (const trozo of res.body) {
    buffer += decoder.decode(trozo as Uint8Array, { stream: true });
    const bloques = buffer.split('\n\n');
    buffer = bloques.pop() ?? '';
    for (const bloque of bloques) {
      if (!bloque.startsWith('data:')) continue;
      const evento = JSON.parse(bloque.slice(5).trim());
      if (evento.tipo === 'error') throw new Error(`Generación fallida: ${evento.detalle}`);
      if (evento.tipo === 'resultado') {
        const spec = evento.datos?.contenido_adaptado?.video_job_spec as Spec | undefined;
        if (!spec?.escenas?.length) throw new Error('El paquete no trae video_job_spec con escenas.');
        return spec;
      }
    }
  }
  throw new Error('El flujo SSE terminó sin evento de resultado.');
}

const iSpec = process.argv.indexOf('--spec');
let spec: Spec;
if (iSpec !== -1) {
  spec = JSON.parse(readFileSync(process.argv[iSpec + 1], 'utf8'));
  console.log(`${seg()}s guion cargado: ${spec.escenas.length} escenas`);
} else {
  const ruta = process.argv[2] ?? '../backend/data/documents/guia_optimizacion_swap_oci.md';
  spec = await guionDesdeDocumento(ruta);
  const guardado = join(tmpdir(), `novamind_guion_${Date.now()}.json`);
  writeFileSync(guardado, JSON.stringify(spec, null, 2));
  console.log(`${seg()}s paquete generado: ${spec.escenas.length} escenas · guion guardado en ${guardado}`);
  console.log('       (para repetir solo la narración: --spec <esa ruta>)');
}
for (const e of spec.escenas) console.log(`       escena ${e.escena}: ${palabras(e.guion_locutor)} palabras · ${e.titulo}`);

// --- Narración -------------------------------------------------------------
const inicio = Date.now();
const res = await fetch(`${API}/api/v1/narracion/generar`, {
  method: 'POST',
  headers: { ...AUTH, 'Content-Type': 'application/json' },
  body: JSON.stringify({ video_job_spec: spec, voz: 'Kore', buscar_fotos: true }),
});
const tardo = (Date.now() - inicio) / 1000;
if (!res.ok) {
  console.log(`${seg()}s HTTP ${res.status} tras ${tardo.toFixed(1)} s: ${await res.text()}`);
  process.exit(1);
}
const r = await res.json();
const final: Spec = r.video_job_spec;

console.log(`${seg()}s narración: status=${r.status} proveedor=${r.proveedor ?? '—'} almacenamiento=${r.almacenamiento} en ${tardo.toFixed(1)} s`);
for (const e of final.escenas) {
  const audioB64 = r.audios_en_linea?.[e.escena] as string | undefined;
  const kb = audioB64 ? ((audioB64.length * 3) / 4 / 1024).toFixed(0) : '0';
  const foto = e.imagen?.tipo === 'foto'
    ? `foto de ${e.imagen.autor} (${e.imagen.licencia}, ${e.imagen.proveedor})`
    : 'sin foto';
  console.log(`       escena ${e.escena}: ${e.audio?.duracion_real_s?.toFixed(1) ?? '—'} s · audio ${kb} KB · ${foto}`);
}
for (const a of r.advertencias ?? []) console.log(`       · ${a}`);

// --- Comprobaciones --------------------------------------------------------
const fallos: string[] = [];
const velocidad = final.velocidad_reproduccion ?? 1;
const total = r.duracion_total_real_s as number | null;
if (r.status !== 'exito') fallos.push(`status=${r.status}${r.error_codigo ? ` (${r.error_codigo})` : ''}`);
if (r.status === 'exito') {
  const sinAudio = final.escenas.filter((e) => !e.audio?.duracion_real_s).map((e) => e.escena);
  if (sinAudio.length) fallos.push(`escenas sin audio: ${sinAudio.join(', ')}`);
  if (r.almacenamiento === 'en_linea') {
    const sinBytes = final.escenas.filter((e) => !r.audios_en_linea?.[e.escena]).map((e) => e.escena);
    if (sinBytes.length) fallos.push(`invitado sin audio en línea para: ${sinBytes.join(', ')}`);
  }
  if (total == null) fallos.push('falta duracion_total_real_s');
  else if (total / velocidad > final.max_duration + 0.05) {
    fallos.push(`dura ${total.toFixed(1)} s a velocidad ${velocidad}: supera ${final.max_duration} s`);
  }
  const suma = (r.duraciones_medidas_s as number[]).reduce((a, b) => a + b, 0);
  if (total != null && Math.abs(suma - total) > 0.1) fallos.push(`la suma por escena (${suma.toFixed(1)}) no cuadra con el total (${total.toFixed(1)})`);
}
if (tardo >= CORTE_CLOUDFLARE_S) fallos.push(`tardó ${tardo.toFixed(1)} s: en producción Cloudflare habría cortado (524)`);
else if (tardo >= MARGEN_SEGURO_S) console.log(`       ⚠ tardó ${tardo.toFixed(1)} s: cerca del corte de Cloudflare (${CORTE_CLOUDFLARE_S} s)`);

if (fallos.length) {
  console.log(`\nFALLA:\n${fallos.map((f) => `  - ${f}`).join('\n')}`);
  process.exit(1);
}
console.log(`\nOK: ${final.escenas.length} escenas narradas, ${total?.toFixed(1)} s${velocidad > 1 ? ` (reproducción a ${velocidad}x)` : ''}.`);
