"""
Orquestador LangGraph de NuevaMente.

Coordina los tres agentes y decide qué pasa después de cada paso:

    START
      │
      ▼
    ingestar ──► investigar ──► redactar ──► criticar ──► decidir
                                   ▲                        │
                                   └──── reintentar ◄───────┤ (score < umbral
                                         con feedback       │  y quedan intentos)
                                                            ▼
                                    finalizar ──► persistir ──► END

Responsabilidades del orquestador (y de nadie más):
- Validar la solicitud (esquema estricto) antes de gastar una sola llamada.
- Indexar el documento una sola vez (id estable por hash) y recuperar chunks.
- Ciclo redactar → criticar → reintentar con feedback, con tope de intentos.
- Decidir con un umbral configurable (MIN_ANCLAJE_FUENTE_SCORE).
- Convertir cualquier fallo en una respuesta de error amigable (nunca un traceback).
- Reintentar con backoff los fallos transitorios de API (429, 5xx, timeouts).
- Entregar el MEJOR intento si se agotan los reintentos (con advertencias).
- Invocar, si existe, el almacenador de OCI Object Storage.
"""

from __future__ import annotations

import hashlib
import logging
import time
from typing import (
    Any,
    Callable,
    Dict,
    List,
    Optional,
    Protocol,
    TypedDict,
    TypeVar,
    Union,
)

from langgraph.graph import END, START, StateGraph
from pydantic import ValidationError
from tenacity import (
    RetryCallState,
    Retrying,
    retry_if_exception,
    stop_after_attempt,
    wait_exponential,
)

from app.core.config import Config
from app.core.schemas import (
    AlmacenamientoOCI,
    ErrorFlujo,
    EstructuraInvalidaError,
    EvaluacionCalidad,
    MetricasOrquestacion,
    PaqueteEducativo,
    ParametrosGeneracion,
    RespuestaAdaptacion,
    SolicitudAdaptacion,
    validar_items,
)

logger = logging.getLogger("nuevamente.orquestador")

T = TypeVar("T")

# ----------------------------------------------------------------------
# Contratos (Protocol) de los agentes: permiten inyectar falsos en tests
# ----------------------------------------------------------------------


class Investigador(Protocol):
    def ingerir_documento(
        self, documento_id: str, documento_titulo: str, texto: str, **kwargs: Any
    ) -> int: ...

    def contar_chunks(self, documento_id: Optional[str] = None) -> int: ...

    def buscar(
        self,
        consulta: str,
        top_k: int = 5,
        documento_id: Optional[str] = None,
        min_score: Optional[float] = 0.60,
    ) -> List[Any]: ...


class Productor(Protocol):
    def generar_contenido(
        self,
        chunks: List[Any],
        parametros: ParametrosGeneracion,
        feedback_critico: Optional[str] = None,
    ) -> PaqueteEducativo: ...


class Critico(Protocol):
    def evaluar(self, contenido_generado: Any, fragmentos: str) -> EvaluacionCalidad: ...


# Contrato para el módulo de OCI (lo implementa quien tenga esa parte).
Almacenador = Callable[[SolicitudAdaptacion, RespuestaAdaptacion], AlmacenamientoOCI]

# ----------------------------------------------------------------------
# Estado del grafo
# ----------------------------------------------------------------------


class EstadoFlujo(TypedDict, total=False):
    solicitud: SolicitudAdaptacion
    documento_id: str
    tema_consulta: str
    inicio: float

    chunks: List[Any]
    fragmentos_texto: str

    intentos: int
    feedback: Optional[str]
    estructura_ok: bool
    paquete: Optional[PaqueteEducativo]
    evaluacion: Optional[EvaluacionCalidad]
    scores: List[float]
    aprobado: bool

    mejor_paquete: Optional[PaqueteEducativo]
    mejor_evaluacion: Optional[EvaluacionCalidad]
    mejor_score: float

    advertencias: List[str]
    error: Optional[ErrorFlujo]
    respuesta: RespuestaAdaptacion


# ----------------------------------------------------------------------
# Utilidades
# ----------------------------------------------------------------------

_CODIGOS_HTTP_TRANSITORIOS = {408, 409, 425, 429, 500, 502, 503, 504}


def _cadena_de_causas(exc: BaseException) -> List[BaseException]:
    """Recorre exc, exc.__cause__, exc.__context__ ... sin ciclos."""
    vistos: List[BaseException] = []
    actual: Optional[BaseException] = exc
    while actual is not None and actual not in vistos:
        vistos.append(actual)
        actual = actual.__cause__ or actual.__context__
    return vistos


def es_error_transitorio(exc: BaseException) -> bool:
    """
    True si conviene reintentar (límite de tasa, caída momentánea, red).

    Mira toda la cadena de causas porque los agentes envuelven los errores del
    SDK dentro de sus propias excepciones.
    """
    for e in _cadena_de_causas(exc):
        if isinstance(e, (TimeoutError, ConnectionError)):
            return True
        if getattr(e, "status_code", None) in _CODIGOS_HTTP_TRANSITORIOS:
            return True
        nombre = type(e).__name__
        if nombre in {
            "TooManyRequestsError",
            "ServiceUnavailableError",
            "GatewayTimeoutError",
            "InternalServerError",
            "ConnectError",
            "ReadTimeout",
            "ConnectTimeout",
            "RemoteProtocolError",
        }:
            return True
    return False


def calcular_documento_id(titulo: str, contenido: str) -> str:
    """Id estable: el mismo documento no se vuelve a embeber entre escenarios."""
    huella = hashlib.sha256(f"{titulo}\n{contenido}".encode("utf-8")).hexdigest()
    return f"doc-{huella[:16]}"


def formatear_fragmentos(chunks: List[Any]) -> str:
    """Formato de fragmentos que recibe el crítico (incluye el chunk_id)."""
    return "\n\n".join(
        f"[chunk_id: {c.chunk_id} | fuente: {c.documento_titulo}]\n{c.texto}"
        for c in chunks
    )


def construir_feedback(evaluacion: EvaluacionCalidad, umbral: float) -> str:
    """Convierte la auditoría del crítico en instrucciones para el redactor."""
    lineas = ["CORRECCIONES OBLIGATORIAS. Tu versión anterior fue rechazada por el revisor."]

    if evaluacion.anclaje_fuente_score < umbral:
        lineas.append(
            f"Anclaje a la fuente: {evaluacion.anclaje_fuente_score:.2f}; "
            f"mínimo requerido: {umbral:.2f}."
        )
        if evaluacion.afirmaciones_no_respaldadas:
            lineas.append("Afirmaciones que NO están respaldadas por las fuentes:")
            for a in evaluacion.afirmaciones_no_respaldadas[:8]:
                motivo = f" ({a.comentario})" if a.comentario else ""
                lineas.append(f'- "{a.afirmacion}"{motivo}')

    if evaluacion.claridad_pedagogica == "Baja":
        lineas.append(
            "Claridad pedagógica: BAJA. Ajusta lenguaje, profundidad, orden y "
            "presentación para el perfil, formato, nivel y nicho indicados."
        )

    if evaluacion.observaciones:
        lineas.append(f"Observaciones del revisor: {evaluacion.observaciones}")

    if evaluacion.sugerencias_correccion:
        lineas.append("Instrucciones del revisor:")
        lineas.extend(f"- {s}" for s in evaluacion.sugerencias_correccion[:8])

    lineas.append(
        "Reescribe usando SOLO los fragmentos fuente para las afirmaciones técnicas "
        "y conserva el formato JSON exacto solicitado."
    )
    return "\n".join(lineas)


def evaluacion_aprobada(evaluacion: EvaluacionCalidad, umbral: float) -> bool:
    """
    Determina si el resultado puede cerrar el ciclo.

    Se requieren simultáneamente fidelidad documental suficiente y una claridad
    pedagógica que no sea Baja. El brief exige ambas dimensiones.
    """
    return (
        evaluacion.anclaje_fuente_score >= umbral
        and evaluacion.claridad_pedagogica != "Baja"
    )


def _mensaje_validacion(error: ValidationError) -> str:
    """Mensaje legible (para humanos) a partir de un ValidationError."""
    partes = []
    for e in error.errors():
        campo = ".".join(str(p) for p in e["loc"]) or "solicitud"
        mensaje = e["msg"].removeprefix("Value error, ")
        partes.append(f"{campo}: {mensaje}")
    return " | ".join(partes)


# ----------------------------------------------------------------------
# Orquestador
# ----------------------------------------------------------------------


class OrquestadorNuevaMente:
    """Construye y ejecuta el grafo LangGraph de NuevaMente."""

    def __init__(
        self,
        investigador: Investigador,
        productor: Productor,
        critico: Critico,
        config: Optional[Config] = None,
        almacenador: Optional[Almacenador] = None,
    ):
        self._investigador = investigador
        self._productor = productor
        self._critico = critico
        self._cfg = config or Config.desde_entorno()
        self._almacenador = almacenador
        self.grafo = self._construir_grafo()

    # ------------------------------------------------------------------
    # API pública
    # ------------------------------------------------------------------

    def ejecutar(
        self, solicitud: Union[SolicitudAdaptacion, Dict[str, Any]]
    ) -> RespuestaAdaptacion:
        """
        Ejecuta el flujo completo. NUNCA lanza excepciones: cualquier problema
        se devuelve como RespuestaAdaptacion con status="error".
        """
        inicio = time.perf_counter()

        # 1. Validación de entrada (antes de gastar llamadas a la API)
        try:
            if isinstance(solicitud, dict):
                solicitud = SolicitudAdaptacion.model_validate(solicitud)
            elif not isinstance(solicitud, SolicitudAdaptacion):
                raise TypeError("La solicitud debe ser un dict o SolicitudAdaptacion.")
        except ValidationError as error:
            return self._respuesta_error(
                ErrorFlujo(
                    codigo="ENTRADA_INVALIDA",
                    etapa="validacion",
                    mensaje_amigable=(
                        "Revisa los datos enviados: " + _mensaje_validacion(error)
                    ),
                    detalle_tecnico=str(error),
                ),
                inicio,
            )
        except TypeError as error:
            return self._respuesta_error(
                ErrorFlujo(
                    codigo="ENTRADA_INVALIDA",
                    etapa="validacion",
                    mensaje_amigable=str(error),
                ),
                inicio,
            )

        # 2. Ejecución del grafo
        estado_inicial: EstadoFlujo = {
            "solicitud": solicitud,
            "documento_id": solicitud.documento_id
            or calcular_documento_id(
                solicitud.documento_titulo, solicitud.documento_contenido
            ),
            "tema_consulta": solicitud.tema_consulta or solicitud.documento_titulo,
            "inicio": inicio,
            "intentos": 0,
            "scores": [],
            "advertencias": [],
            "mejor_score": -1.0,
            "aprobado": False,
            "estructura_ok": True,
            "feedback": None,
            "error": None,
        }

        try:
            estado_final = self.grafo.invoke(estado_inicial)
            return estado_final["respuesta"]
        except Exception as error:  # último recurso: nunca propagar
            logger.exception("Fallo inesperado en el orquestador")
            return self._respuesta_error(
                ErrorFlujo(
                    codigo="ERROR_INESPERADO",
                    etapa="orquestador",
                    mensaje_amigable=(
                        "Ocurrió un problema inesperado al procesar el documento. "
                        "Inténtalo de nuevo en unos segundos."
                    ),
                    detalle_tecnico=f"{type(error).__name__}: {error}",
                ),
                inicio,
                documento_id=estado_inicial["documento_id"],
            )

    def diagrama_mermaid(self) -> str:
        """Diagrama Mermaid del grafo real (para el README)."""
        return self.grafo.get_graph().draw_mermaid()

    # ------------------------------------------------------------------
    # Construcción del grafo
    # ------------------------------------------------------------------

    def _construir_grafo(self):
        g = StateGraph(EstadoFlujo)

        g.add_node("ingestar", self._nodo_ingestar)
        g.add_node("investigar", self._nodo_investigar)
        g.add_node("redactar", self._nodo_redactar)
        g.add_node("criticar", self._nodo_criticar)
        g.add_node("finalizar", self._nodo_finalizar)
        g.add_node("persistir", self._nodo_persistir)

        g.add_edge(START, "ingestar")
        g.add_conditional_edges(
            "ingestar",
            self._ruta_si_error("investigar"),
            {"investigar": "investigar", "finalizar": "finalizar"},
        )
        g.add_conditional_edges(
            "investigar",
            self._ruta_si_error("redactar"),
            {"redactar": "redactar", "finalizar": "finalizar"},
        )
        g.add_conditional_edges(
            "redactar",
            self._ruta_tras_redactar,
            {"criticar": "criticar", "redactar": "redactar", "finalizar": "finalizar"},
        )
        g.add_conditional_edges(
            "criticar",
            self._ruta_tras_criticar,
            {"redactar": "redactar", "finalizar": "finalizar"},
        )
        g.add_conditional_edges(
            "finalizar",
            self._ruta_tras_finalizar,
            {"persistir": "persistir", "fin": END},
        )
        g.add_edge("persistir", END)

        return g.compile()

    # ------------------------------------------------------------------
    # Reintentos de API (fallos transitorios)
    # ------------------------------------------------------------------

    def _con_reintentos_api(self, funcion: Callable[[], T], etapa: str) -> T:
        def _avisar(retry_state: RetryCallState) -> None:
            exc = retry_state.outcome.exception() if retry_state.outcome else None
            logger.warning(
                "[%s] fallo transitorio (intento %d/%d): %s",
                etapa,
                retry_state.attempt_number,
                self._cfg.api_reintentos,
                exc,
            )

        reintentador = Retrying(
            stop=stop_after_attempt(self._cfg.api_reintentos),
            wait=wait_exponential(
                multiplier=self._cfg.api_espera_base_segundos, min=0, max=15
            ),
            retry=retry_if_exception(es_error_transitorio),
            before_sleep=_avisar,
            reraise=True,
        )
        return reintentador(funcion)

    # ------------------------------------------------------------------
    # Nodos
    # ------------------------------------------------------------------

    def _nodo_ingestar(self, estado: EstadoFlujo) -> Dict[str, Any]:
        """Indexa el documento en el Vector Store si aún no está indexado."""
        t0 = time.perf_counter()
        solicitud = estado["solicitud"]
        doc_id = estado["documento_id"]
        try:
            existentes = self._con_reintentos_api(
                lambda: self._investigador.contar_chunks(doc_id), "contar_chunks"
            )
            if existentes > 0:
                logger.info("[ingestar] documento %s ya indexado (%d chunks)", doc_id, existentes)
                return {"documento_id": doc_id}

            total = self._con_reintentos_api(
                lambda: self._investigador.ingerir_documento(
                    doc_id, solicitud.documento_titulo, solicitud.documento_contenido
                ),
                "ingerir_documento",
            )
            logger.info(
                "[ingestar] %s indexado: %d chunks en %.2fs",
                doc_id, total, time.perf_counter() - t0,
            )
            if total == 0:
                return {
                    "error": ErrorFlujo(
                        codigo="DOCUMENTO_VACIO",
                        etapa="ingestar",
                        mensaje_amigable=(
                            "No se pudo extraer texto útil del documento. "
                            "Verifica que no esté vacío o escaneado como imagen."
                        ),
                    )
                }
            return {"documento_id": doc_id}
        except Exception as error:
            logger.exception("[ingestar] fallo")
            return {
                "error": ErrorFlujo(
                    codigo="ERROR_INDEXACION",
                    etapa="ingestar",
                    mensaje_amigable=(
                        "No se pudo indexar el documento. Revisa tu conexión y "
                        "tu clave de Cohere, e inténtalo de nuevo."
                    ),
                    detalle_tecnico=f"{type(error).__name__}: {error}",
                )
            }

    def _nodo_investigar(self, estado: EstadoFlujo) -> Dict[str, Any]:
        """Recupera los chunks relevantes (con respaldo si el umbral es muy alto)."""
        t0 = time.perf_counter()
        doc_id = estado["documento_id"]
        consulta = estado["tema_consulta"]
        advertencias = list(estado.get("advertencias", []))
        try:
            chunks = self._con_reintentos_api(
                lambda: self._investigador.buscar(
                    consulta,
                    top_k=self._cfg.top_k,
                    documento_id=doc_id,
                    min_score=self._cfg.min_score_retrieval,
                ),
                "buscar",
            )
            if not chunks:
                # La búsqueda ya está acotada al documento del usuario, así que
                # es seguro relajar el umbral de similitud como respaldo.
                chunks = self._con_reintentos_api(
                    lambda: self._investigador.buscar(
                        consulta,
                        top_k=min(self._cfg.top_k, 3),
                        documento_id=doc_id,
                        min_score=None,
                    ),
                    "buscar_respaldo",
                )
                if chunks:
                    advertencias.append(
                        "La consulta se parece poco al documento; se usaron los "
                        "fragmentos más cercanos sin umbral de similitud."
                    )
        except Exception as error:
            logger.exception("[investigar] fallo")
            return {
                "error": ErrorFlujo(
                    codigo="ERROR_INDEXACION",
                    etapa="investigar",
                    mensaje_amigable=(
                        "No se pudo consultar la base de conocimiento. "
                        "Inténtalo de nuevo en unos segundos."
                    ),
                    detalle_tecnico=f"{type(error).__name__}: {error}",
                )
            }

        if not chunks:
            return {
                "error": ErrorFlujo(
                    codigo="SIN_CONTEXTO",
                    etapa="investigar",
                    mensaje_amigable=(
                        "No se encontró contenido del documento relacionado con "
                        "el tema. Prueba con otro tema_consulta o con otro documento."
                    ),
                )
            }

        # Orden narrativo (por posición) en vez de orden de relevancia:
        # ayuda a que guías y guiones respeten la secuencia del documento.
        chunks = sorted(chunks, key=lambda c: c.posicion)
        logger.info(
            "[investigar] %d chunks recuperados en %.2fs", len(chunks), time.perf_counter() - t0
        )
        return {
            "chunks": chunks,
            "fragmentos_texto": formatear_fragmentos(chunks),
            "advertencias": advertencias,
        }

    def _nodo_redactar(self, estado: EstadoFlujo) -> Dict[str, Any]:
        """Llama al Agente 2 y valida estrictamente la estructura de los items."""
        t0 = time.perf_counter()
        solicitud = estado["solicitud"]
        intentos = estado.get("intentos", 0) + 1
        parametros = ParametrosGeneracion(
            perfil_destinatario=solicitud.perfil_destinatario,
            formato_salida=solicitud.formato_salida,
            nicho_sector=solicitud.nicho_sector,
            nivel_detalle=solicitud.nivel_detalle,
            tema_consulta=estado["tema_consulta"],
        )
        feedback = estado.get("feedback")

        try:
            paquete = self._con_reintentos_api(
                lambda: self._productor.generar_contenido(
                    estado["chunks"], parametros, feedback_critico=feedback
                ),
                "generar_contenido",
            )
            # Tipado estricto de los items según el formato (sin gastar al crítico)
            paquete.contenido_adaptado.items = validar_items(
                solicitud.formato_salida, paquete.contenido_adaptado.items
            )
        except (EstructuraInvalidaError, ValueError) as fallo:
            # Fallo "blando": el LLM devolvió algo inválido. Se reintenta con
            # feedback mientras queden intentos.
            logger.warning("[redactar] intento %d rechazado: %s", intentos, fallo)
            nuevo_feedback = (
                "CORRECCIONES OBLIGATORIAS. Tu salida anterior fue rechazada "
                f"por no cumplir el formato: {fallo}\n"
                "Responde solo con el JSON exacto solicitado."
            )
            if feedback:  # conservar lo que ya había pedido el crítico
                nuevo_feedback += "\n\n" + feedback
            return {
                "intentos": intentos,
                "estructura_ok": False,
                "feedback": nuevo_feedback,
                "error": self._error_generacion_si_agotado(estado, intentos, fallo),
            }
        except Exception as error:
            logger.exception("[redactar] fallo")
            return {
                "intentos": intentos,
                "error": ErrorFlujo(
                    codigo="ERROR_GENERACION",
                    etapa="redactar",
                    mensaje_amigable=(
                        "No se pudo generar el contenido en este momento. "
                        "Inténtalo de nuevo en unos segundos."
                    ),
                    detalle_tecnico=f"{type(error).__name__}: {error}",
                ),
            }

        logger.info(
            "[redactar] intento %d listo en %.2fs", intentos, time.perf_counter() - t0
        )
        return {
            "intentos": intentos,
            "paquete": paquete,
            "estructura_ok": True,
            "evaluacion": None,
        }

    def _error_generacion_si_agotado(
        self, estado: EstadoFlujo, intentos: int, fallo: Exception
    ) -> Optional[ErrorFlujo]:
        """Si ya no quedan intentos y no hay ningún borrador válido, es un error."""
        quedan = intentos < 1 + self._cfg.max_redaccion_retries
        if quedan or estado.get("mejor_paquete") is not None:
            return None
        return ErrorFlujo(
            codigo="ERROR_GENERACION",
            etapa="redactar",
            mensaje_amigable=(
                "El modelo no logró producir el formato pedido después de varios "
                "intentos. Inténtalo de nuevo o prueba con otro formato."
            ),
            detalle_tecnico=str(fallo),
        )

    def _nodo_criticar(self, estado: EstadoFlujo) -> Dict[str, Any]:
        """Llama al Agente 3, registra el score y guarda el mejor intento."""
        t0 = time.perf_counter()
        paquete = estado.get("paquete")
        if paquete is None:
            return {
                "error": ErrorFlujo(
                    codigo="ERROR_GENERACION",
                    etapa="criticar",
                    mensaje_amigable="No hay contenido para revisar.",
                )
            }
        solicitud = estado["solicitud"]
        parametros = ParametrosGeneracion(
            perfil_destinatario=solicitud.perfil_destinatario,
            formato_salida=solicitud.formato_salida,
            nicho_sector=solicitud.nicho_sector,
            nivel_detalle=solicitud.nivel_detalle,
            tema_consulta=estado["tema_consulta"],
        )

        try:
            evaluacion = self._con_reintentos_api(
                lambda: self._critico.evaluar(
                    paquete.contenido_adaptado,
                    estado["fragmentos_texto"],
                    parametros,
                ),
                "evaluar",
            )
        except Exception as error:
            logger.exception("[criticar] fallo")
            return {
                "error": ErrorFlujo(
                    codigo="ERROR_CRITICO",
                    etapa="criticar",
                    mensaje_amigable=(
                        "No se pudo verificar la fidelidad del contenido, así que "
                        "no se entrega sin revisar. Inténtalo de nuevo."
                    ),
                    detalle_tecnico=f"{type(error).__name__}: {error}",
                )
            }

        score = evaluacion.anclaje_fuente_score
        scores = list(estado.get("scores", [])) + [score]
        aprobado = evaluacion_aprobada(
            evaluacion,
            self._cfg.min_anclaje_fuente_score,
        )

        actualizacion: Dict[str, Any] = {
            "evaluacion": evaluacion,
            "scores": scores,
            "aprobado": aprobado,
            "feedback": None if aprobado else construir_feedback(
                evaluacion, self._cfg.min_anclaje_fuente_score
            ),
        }
        if score > estado.get("mejor_score", -1.0):
            actualizacion.update(
                mejor_paquete=paquete, mejor_evaluacion=evaluacion, mejor_score=score
            )

        logger.info(
            "[criticar] intento %d: anclaje=%.2f (umbral %.2f), claridad=%s → %s en %.2fs",
            estado.get("intentos", 0),
            score,
            self._cfg.min_anclaje_fuente_score,
            evaluacion.claridad_pedagogica,
            "APROBADO" if aprobado else "RECHAZADO",
            time.perf_counter() - t0,
        )
        return actualizacion

    def _nodo_finalizar(self, estado: EstadoFlujo) -> Dict[str, Any]:
        """Arma la RespuestaAdaptacion final (éxito, éxito con advertencias o error)."""
        metricas = self._metricas(estado)
        advertencias = list(estado.get("advertencias", []))
        error = estado.get("error")

        # Resiliencia: si ya existe un intento verificado y el fallo ocurrió en un
        # reintento posterior (generación o crítica), se entrega ese mejor intento.
        if (
            error is not None
            and error.codigo in {"ERROR_GENERACION", "ERROR_CRITICO"}
            and estado.get("mejor_paquete") is not None
        ):
            advertencias.append(
                f"{error.mensaje_amigable} Se entrega el mejor intento verificado."
            )
            error = None
            estado = {**estado, "aprobado": False}

        if error is not None:
            respuesta = RespuestaAdaptacion(
                status="error", advertencias=advertencias, error=error, orquestacion=metricas
            )
            return {"respuesta": respuesta}

        aprobado = estado.get("aprobado", False)
        paquete = estado["paquete"] if aprobado else estado.get("mejor_paquete")
        evaluacion = estado["evaluacion"] if aprobado else estado.get("mejor_evaluacion")

        if paquete is None:  # no debería ocurrir; defensa en profundidad
            return {
                "respuesta": RespuestaAdaptacion(
                    status="error",
                    advertencias=advertencias,
                    error=ErrorFlujo(
                        codigo="ERROR_GENERACION",
                        etapa="finalizar",
                        mensaje_amigable="No se obtuvo ningún contenido válido.",
                    ),
                    orquestacion=metricas,
                )
            }

        if not aprobado and evaluacion is not None:
            razones = []
            if evaluacion.anclaje_fuente_score < self._cfg.min_anclaje_fuente_score:
                razones.append(
                    f"anclaje a la fuente ({evaluacion.anclaje_fuente_score:.2f}) "
                    f"< umbral ({self._cfg.min_anclaje_fuente_score:.2f})"
                )
            if evaluacion.claridad_pedagogica == "Baja":
                razones.append("claridad pedagógica Baja")

            advertencias.append(
                f"El mejor intento no cumplió todos los criterios de aprobación "
                f"({'; '.join(razones)}) tras {estado.get('intentos', 0)} intento(s). "
                "Se entrega el mejor intento y se recomienda revisión humana."
            )

        respuesta = RespuestaAdaptacion(
            status="exito" if aprobado else "exito_con_advertencias",
            metadatos=paquete.metadatos,
            contenido_adaptado=paquete.contenido_adaptado,
            fuentes_utilizadas=paquete.fuentes_utilizadas,
            evaluacion_calidad=evaluacion,
            advertencias=advertencias,
            orquestacion=metricas,
        )
        return {"respuesta": respuesta}

    def _nodo_persistir(self, estado: EstadoFlujo) -> Dict[str, Any]:
        """Sube el resultado a OCI Object Storage si hay un almacenador configurado."""
        respuesta = estado["respuesta"]
        if self._almacenador is None:
            return {"respuesta": respuesta}

        try:
            almacenamiento = self._con_reintentos_api(
                lambda: self._almacenador(estado["solicitud"], respuesta),
                "persistir_oci",
            )
            respuesta = respuesta.model_copy(update={"almacenamiento_oci": almacenamiento})
        except Exception as error:
            logger.exception("[persistir] fallo al subir a OCI")
            respuesta = respuesta.model_copy(
                update={
                    "almacenamiento_oci": AlmacenamientoOCI(status_upload="error"),
                    "advertencias": respuesta.advertencias
                    + [
                        "El contenido se generó, pero no se pudo guardar en OCI "
                        f"Object Storage ({type(error).__name__})."
                    ],
                }
            )
        return {"respuesta": respuesta}

    # ------------------------------------------------------------------
    # Rutas condicionales (la "lógica de decisión" del grafo)
    # ------------------------------------------------------------------

    @staticmethod
    def _ruta_si_error(siguiente: str) -> Callable[[EstadoFlujo], str]:
        def ruta(estado: EstadoFlujo) -> str:
            return "finalizar" if estado.get("error") else siguiente

        return ruta

    def _ruta_tras_redactar(self, estado: EstadoFlujo) -> str:
        if estado.get("error"):
            return "finalizar"
        if not estado.get("estructura_ok", True):
            # Estructura inválida: reintentar si quedan intentos
            if estado.get("intentos", 0) < 1 + self._cfg.max_redaccion_retries:
                return "redactar"
            return "finalizar"
        return "criticar"

    def _ruta_tras_criticar(self, estado: EstadoFlujo) -> str:
        if estado.get("error") or estado.get("aprobado"):
            return "finalizar"
        if estado.get("intentos", 0) < 1 + self._cfg.max_redaccion_retries:
            return "redactar"
        return "finalizar"

    @staticmethod
    def _ruta_tras_finalizar(estado: EstadoFlujo) -> str:
        return "fin" if estado["respuesta"].status == "error" else "persistir"

    # ------------------------------------------------------------------
    # Helpers de respuesta
    # ------------------------------------------------------------------

    def _metricas(self, estado: EstadoFlujo) -> MetricasOrquestacion:
        return MetricasOrquestacion(
            intentos_redaccion=estado.get("intentos", 0),
            scores_por_intento=list(estado.get("scores", [])),
            umbral_anclaje=self._cfg.min_anclaje_fuente_score,
            max_reintentos=self._cfg.max_redaccion_retries,
            duracion_segundos=round(
                time.perf_counter() - estado.get("inicio", time.perf_counter()), 3
            ),
            documento_id=estado.get("documento_id"),
            chunks_recuperados=len(estado.get("chunks", []) or []),
        )

    def _respuesta_error(
        self,
        error: ErrorFlujo,
        inicio: float,
        documento_id: Optional[str] = None,
    ) -> RespuestaAdaptacion:
        return RespuestaAdaptacion(
            status="error",
            error=error,
            orquestacion=MetricasOrquestacion(
                umbral_anclaje=self._cfg.min_anclaje_fuente_score,
                max_reintentos=self._cfg.max_redaccion_retries,
                duracion_segundos=round(time.perf_counter() - inicio, 3),
                documento_id=documento_id,
            ),
        )


# ----------------------------------------------------------------------
# Fábrica: arma el orquestador con los agentes reales
# ----------------------------------------------------------------------


def crear_orquestador(
    config: Optional[Config] = None,
    almacenador: Optional[Almacenador] = None,
) -> OrquestadorNuevaMente:
    """
    Construye el orquestador con el Agente 1, 2 y 3 reales (Cohere + ChromaDB).

    Args:
        config: configuración. Si no se pasa, se lee de las variables de entorno.
        almacenador: función que sube el resultado a OCI Object Storage
            (firma: (solicitud, respuesta) -> AlmacenamientoOCI).
    """
    # Imports locales: así los tests con agentes falsos no necesitan Cohere/Chroma.
    try:
        from app.agentes.agente1_investigador import AgenteInvestigadorRAG
        from app.agentes.agente2_productor import AgenteProductorContenido
        from app.agentes.agente3_critico import AgenteCriticoContenido
    except ImportError:
        from agente1_investigador import AgenteInvestigadorRAG
        from agente2_productor import AgenteProductorContenido
        from agente3_critico import AgenteCriticoContenido

    try:
        from app.storage.local_storage import almacenador_local
    except ImportError:
        almacenador_local = None

    cfg = config or Config.desde_entorno()
    clave = cfg.exigir_cohere()

    almacenador_final = almacenador if almacenador is not None else almacenador_local

    return OrquestadorNuevaMente(
        investigador=AgenteInvestigadorRAG(
            cohere_api_key=clave,
            embedding_model=cfg.embedding_model,
            chroma_path=cfg.chroma_path,
            collection_name=cfg.collection_name,
        ),
        productor=AgenteProductorContenido(api_key=clave, modelo=cfg.cohere_model),
        critico=AgenteCriticoContenido(api_key=clave, modelo=cfg.cohere_model),
        config=cfg,
        almacenador=almacenador_final,
    )
