/**
 * Prueba manual de integración (NO se ejecuta con `npm test`: gasta cuota de Gemini).
 * Requiere el backend en marcha con modo invitado:
 *   node tests/e2e_sse_paralelo.manual.ts [ruta-documento.md]
 * Consume el SSE real de /api/v1/adaptar/stream con modo_rag=paralelo y lo pliega con
 * el mismo módulo que usa la UI, mostrando cuándo queda disponible cada estación.
 */
import { readFileSync } from 'node:fs';
import {
  aplicarEvento,
  esEventoGeneracion,
  estacionDisponible,
  estacionesResueltas,
  paqueteEnConstruccion,
} from '../src/utils/paqueteIncremental.ts';

const API = process.env.API_URL ?? 'http://127.0.0.1:8000';
const ruta = process.argv[2] ?? '../backend/data/documents/guia_optimizacion_swap_oci.md';
const texto = readFileSync(ruta, 'utf8');

const form = new FormData();
form.append('texto_directo', texto);
form.append('titulo', 'Prueba E2E modo paralelo');
form.append('perfil_destinatario', 'Principiante');
form.append('formato_salida', 'Paquete Educativo Completo (5 Estaciones)');
form.append('modo_rag', 'paralelo');

const t0 = Date.now();
const seg = () => ((Date.now() - t0) / 1000).toFixed(1).padStart(5);
const res = await fetch(`${API}/api/v1/adaptar/stream`, {
  method: 'POST', body: form, headers: { Authorization: 'Bearer guest-demo-token' },
});
if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}: ${await res.text()}`);

let parcial = paqueteEnConstruccion('Prueba', 'Principiante', 'Paquete Educativo Completo (5 Estaciones)');
let buffer = '';
const decoder = new TextDecoder();
for await (const trozo of res.body) {
  buffer += decoder.decode(trozo as Uint8Array, { stream: true });
  const bloques = buffer.split('\n\n');
  buffer = bloques.pop() ?? '';
  for (const bloque of bloques) {
    if (!bloque.startsWith('data:')) continue;
    const evento = JSON.parse(bloque.slice(5).trim());
    if (esEventoGeneracion(evento)) {
      parcial = aplicarEvento(parcial, evento);
      const disponibles = [0, 1, 2, 3, 4].filter((i) => estacionDisponible(parcial, i));
      const detalle = evento.tipo === 'recurso'
        ? `${evento.recurso} ${evento.estado.estado} (${evento.estado.verificacion}${evento.estado.reutilizado ? ', reutilizado' : ''})`
          + (evento.estado.error_codigo ? ` código=${evento.estado.error_codigo} ${evento.estado.avisos.join('; ')}` : '')
        : `auditoría ejecutada=${evento.auditoria_ejecutada} score=${evento.anclaje_fuente_score}`;
      console.log(`${seg()}s ${detalle.padEnd(48)} resueltas=[${estacionesResueltas(parcial)}] disponibles=[${disponibles}]`);
    } else if (evento.tipo === 'resultado') {
      const final = evento.datos;
      console.log(`${seg()}s resultado status=${final.status} advertencias=${final.advertencias.length}`);
      for (const a of final.advertencias) console.log(`       · ${a}`);
      const estados = final.contenido_adaptado.estado_recursos ?? {};
      const coincide = Object.keys(estados).every((r) => parcial.contenido_adaptado.estado_recursos?.[r as never]);
      console.log(`       el parcial cubre todos los recursos del final: ${coincide}`);
    } else if (evento.tipo === 'error') {
      console.log(`${seg()}s ERROR ${evento.detalle}`);
    }
  }
}
