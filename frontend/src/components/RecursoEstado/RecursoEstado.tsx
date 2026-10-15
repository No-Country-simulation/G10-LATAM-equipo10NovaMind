/**
 * Estado honesto de cada recurso del modo paralelo: verificación (pendiente / auditada /
 * sin auditar), citas localizadas en el documento, avisos y fallos. Nunca muestra un
 * recurso inventado en lugar de uno que falló.
 */
import { useCallback, useRef, useState } from 'react';
import { AlertTriangle, BadgeCheck, Clock, FileSearch, Recycle, ShieldOff } from 'lucide-react';
import type { EstadoRecurso, FuenteCita, RecursoId } from '../../types/types';
import { NOMBRE_RECURSO, motivoError } from '../../utils/paqueteIncremental';
import styles from './RecursoEstado.module.css';
import { VisorFuente } from './VisorFuente';

const VERIFICACION = {
  pendiente: { texto: 'Verificación pendiente', clase: styles.chipPendiente, Icono: Clock,
    ayuda: 'Superó las comprobaciones automáticas contra el documento; la auditoría de fidelidad aún no termina.' },
  auditada: { texto: 'Auditada', clase: styles.chipAuditada, Icono: BadgeCheck,
    ayuda: 'Un auditor independiente contrastó sus afirmaciones con el documento.' },
  no_auditada: { texto: 'Sin auditar', clase: styles.chipSinAuditar, Icono: ShieldOff,
    ayuda: 'La auditoría de fidelidad no cubrió este recurso. Revísalo contra el documento.' },
} as const;

/** Oculto por decisión del usuario (14/10): "Auditada" / "Sin auditar". Para volver a mostrarlo, `true`. */
const MOSTRAR_CHIP_VERIFICACION = false;
const MOSTRAR_CITA_NO_ENCONTRADA = false;

export function ChipVerificacion({ estado }: { estado: EstadoRecurso }) {
  if (!MOSTRAR_CHIP_VERIFICACION) return null;
  const v = VERIFICACION[estado.verificacion] ?? VERIFICACION.no_auditada;
  return (
    <span className={`${styles.chip} ${v.clase}`} title={v.ayuda}>
      <v.Icono size={12} aria-hidden="true" /> {v.texto}
    </span>
  );
}

/**
 * Página y verificación de una cita, derivadas por el backend de dónde aparece en el documento.
 * Si la cita trae su contexto, el chip abre el visor con el pasaje real del documento.
 */
export function FuenteChip({ fuente, etiquetaVisor }: {
  fuente?: FuenteCita | null;
  /** Texto del chip cuando abre el visor (p. ej. donde la página ya se muestra al lado) */
  etiquetaVisor?: string;
}) {
  const [abierto, setAbierto] = useState(false);
  const chipRef = useRef<HTMLButtonElement>(null);
  const cerrar = useCallback(() => {
    setAbierto(false);
    chipRef.current?.focus();  // el foco vuelve a donde estaba
  }, []);
  if (!fuente) return null;
  // Oculto por decisión del usuario (14/10): una cita no encontrada no muestra nada.
  // Para volver a mostrar "Cita no encontrada en el documento", poner MOSTRAR_CITA_NO_ENCONTRADA en true.
  if (!fuente.verificada && !MOSTRAR_CITA_NO_ENCONTRADA) return null;
  const etiqueta = fuente.verificada
    ? fuente.pagina ? `Fuente · pág. ${fuente.pagina}` : 'Fuente verificada'
    : 'Cita no encontrada en el documento';
  const clase = `${styles.fuente} ${fuente.verificada ? styles.fuenteOk : styles.fuenteNo}`;

  if (!fuente.verificada || !fuente.contexto) {
    return (
      <span className={clase} title={`«${fuente.texto}»`}>
        <FileSearch size={11} aria-hidden="true" /> {etiqueta}
      </span>
    );
  }
  return (
    <>
      <button
        ref={chipRef}
        type="button"
        className={`${clase} ${styles.fuenteBoton}`}
        onClick={(e) => {
          e.stopPropagation();  // no dispara la acción de la tarjeta que lo contiene
          setAbierto(true);
        }}
        aria-haspopup="dialog"
        title="Ver la cita en el documento"
      >
        <FileSearch size={11} aria-hidden="true" /> {etiquetaVisor ?? etiqueta}
      </button>
      {abierto && <VisorFuente fuente={fuente} onCerrar={cerrar} />}
    </>
  );
}

/** Barra sobre la estación: verificación, citas, reutilización y avisos del recurso. */
export function EstadoRecursoBar({ estado }: { estado?: EstadoRecurso }) {
  if (!estado || estado.estado !== 'completado') return null;
  const { citas_totales: total, citas_verificadas: ok } = estado;
  return (
    <div className={styles.barra} role="status">
      <div className={styles.barraFila}>
        <strong className={styles.barraNombre}>{NOMBRE_RECURSO[estado.recurso]}</strong>
        <ChipVerificacion estado={estado} />
        {total > 0 && (
          <span className={`${styles.chip} ${ok === total ? styles.chipAuditada : styles.chipAviso}`}
            title="Citas encontradas literalmente en el documento">
            <FileSearch size={12} aria-hidden="true" /> {ok}/{total} citas localizadas
          </span>
        )}
        {estado.reutilizado && (
          <span className={`${styles.chip} ${styles.chipNeutro}`} title="Mismo documento, parámetros y modelo que una generación anterior">
            <Recycle size={12} aria-hidden="true" /> Reutilizado
          </span>
        )}
      </div>
      {estado.avisos.length > 0 && (
        <details className={styles.avisos}>
          <summary>
            <AlertTriangle size={12} aria-hidden="true" /> {estado.avisos.length} aviso{estado.avisos.length > 1 ? 's' : ''} de las comprobaciones
          </summary>
          <ul>{estado.avisos.map((a) => <li key={a}>{a}</li>)}</ul>
        </details>
      )}
    </div>
  );
}

/** Sustituye a la estación cuando su recurso falló o el paquete no lo incluye. */
export function RecursoNoDisponible({ recurso, estado }: { recurso: RecursoId; estado?: EstadoRecurso }) {
  const nombre = NOMBRE_RECURSO[recurso];
  return (
    <div className={styles.noDisponible} role="alert">
      <AlertTriangle size={28} aria-hidden="true" />
      <h3>{nombre}: no disponible</h3>
      {estado?.estado === 'fallido' ? (
        <p>
          No se pudo generar porque {motivoError(estado.error_codigo)}. Los demás recursos no se ven afectados.
          Si vuelves a generar el mismo documento, solo se repetirá lo que falló.
        </p>
      ) : (
        <p>Este paquete no incluye este recurso.</p>
      )}
      <p className={styles.noDisponibleNota}>No mostramos contenido de relleno en su lugar.</p>
    </div>
  );
}

/** Lista compacta del estado de todos los recursos mientras se generan. */
export function ListaRecursos({ estados }: { estados: Partial<Record<RecursoId, EstadoRecurso>> }) {
  const ids = Object.keys(NOMBRE_RECURSO) as RecursoId[];
  return (
    <ul className={styles.lista} aria-label="Estado de los recursos">
      {ids.map((id) => {
        const e = estados[id];
        const clase = !e ? styles.itemEspera : e.estado === 'completado' ? styles.itemOk : styles.itemError;
        return (
          <li key={id} className={clase}>
            {!e ? '⏳' : e.estado === 'completado' ? '✓' : '✕'} {NOMBRE_RECURSO[id]}
          </li>
        );
      })}
    </ul>
  );
}
