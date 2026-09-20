"""
Pruebas del orquestador. Usan agentes FALSOS: no hacen llamadas de red ni
necesitan COHERE_API_KEY, así que corren en segundos y son deterministas.

Ejecutar desde la raíz del repositorio:
    python -m pytest tests -v
"""

from __future__ import annotations

from typing import Any, Callable, List, Optional, Union

import pytest

from agente1_investigador import ChunkResultado
from app.core.config import Config
from app.core.prompts import construir_prompt_critico
from app.core.schemas import (
    AfirmacionEvaluada,
    AlmacenamientoOCI,
    ContenidoAdaptado,
    EvaluacionCalidad,
    EstructuraInvalidaError,
    FuenteUtilizada,
    MetadatosSalida,
    PaqueteEducativo,
    ParametrosGeneracion,
    SolicitudAdaptacion,
    validar_items,
)
from app.orquestador import (
    OrquestadorNuevaMente,
    calcular_documento_id,
    es_error_transitorio,
)

# ----------------------------------------------------------------------
# Utilidades de prueba
# ----------------------------------------------------------------------

TEXTO_DOC = (
    "La Virtual Cloud Network (VCN) es una red privada y personalizable "
    "configurada en Oracle Cloud Infrastructure. Ofrece subredes publicas y "
    "privadas, tablas de enrutamiento, Internet Gateways y Security Lists."
)

SOLICITUD_BASE = {
    "documento_titulo": "Introduccion a la Arquitectura de Redes VCN en OCI",
    "documento_contenido": TEXTO_DOC,
    "perfil_destinatario": "Principiante",  # alias del brief
    "formato_salida": "Flashcards",
    "nicho_sector": "General",
    "nivel_detalle": "Didactico",  # alias del brief (sin tilde)
}


def crear_config(**cambios: Any) -> Config:
    base = dict(
        cohere_api_key="clave-de-prueba",
        cohere_model="modelo-falso",
        embedding_model="embed-falso",
        chroma_path="./chroma_test",
        collection_name="coleccion_test",
        top_k=6,
        min_score_retrieval=0.60,
        min_anclaje_fuente_score=0.75,
        max_redaccion_retries=2,
        api_reintentos=3,
        api_espera_base_segundos=0.0,  # sin esperas en tests
    )
    base.update(cambios)
    return Config(**base)


def chunks_falsos(n: int = 3) -> List[ChunkResultado]:
    return [
        ChunkResultado(
            texto=f"Texto del fragmento {i} sobre VCN.",
            documento_id="doc-x",
            documento_titulo="Doc de prueba",
            chunk_id=f"doc-x_{i}",
            posicion=i,
            score=0.9,
        )
        for i in reversed(range(n))  # desordenados a propósito
    ]


def paquete_flashcards(n: int = 5) -> PaqueteEducativo:
    return PaqueteEducativo(
        status="exito",
        metadatos=MetadatosSalida(
            perfil_aplicado="Principiante / Transición de Carrera",
            formato_generado="Flashcards",
            nicho_aplicado="General",
            tiempo_estimado_estudio_minutos=5,
            conceptos_clave=["VCN", "Subredes"],
            prerrequisitos=["Redes básicas"],
        ),
        contenido_adaptado=ContenidoAdaptado(
            titulo="Redes en la nube",
            introduccion_contextualizada="Imagina la VCN como tu barrio privado.",
            items=[
                {"frente": f"P{i}", "dorso": f"R{i}", "pista_didactica": f"H{i}"}
                for i in range(n)
            ],
        ),
        fuentes_utilizadas=[
            FuenteUtilizada(documento_id="doc-x", chunk_id="doc-x_0", texto_fuente="t")
        ],
    )


def evaluacion(respaldadas: int, total: int, **kw: Any) -> EvaluacionCalidad:
    afirmaciones = [
        AfirmacionEvaluada(
            afirmacion=f"Afirmación {i}",
            respaldada=i < respaldadas,
            comentario=None if i < respaldadas else "No aparece en la fuente",
        )
        for i in range(total)
    ]
    return EvaluacionCalidad(
        claridad_pedagogica=kw.get("claridad", "Alta"),
        observaciones="ok",
        afirmaciones=afirmaciones,
        sugerencias_correccion=kw.get("sugerencias", []),
    )


class InvestigadorFalso:
    def __init__(self, chunks: Optional[List[ChunkResultado]] = None, indexado: bool = False):
        self.chunks = chunks_falsos() if chunks is None else chunks
        self.indexado = indexado
        self.ingestas = 0
        self.min_scores_usados: List[Optional[float]] = []

    def contar_chunks(self, documento_id: Optional[str] = None) -> int:
        return 3 if self.indexado else 0

    def ingerir_documento(self, documento_id, documento_titulo, texto, **kw) -> int:
        self.ingestas += 1
        self.indexado = True
        return 3

    def buscar(self, consulta, top_k=5, documento_id=None, min_score=0.60):
        self.min_scores_usados.append(min_score)
        return list(self.chunks)


class ProductorFalso:
    """Cada llamada consume un comportamiento: paquete, o excepción a lanzar."""

    def __init__(self, comportamientos: List[Union[PaqueteEducativo, Exception, Callable]]):
        self.comportamientos = list(comportamientos)
        self.feedbacks: List[Optional[str]] = []
        self.llamadas = 0

    def generar_contenido(self, chunks, parametros, feedback_critico=None):
        self.llamadas += 1
        self.feedbacks.append(feedback_critico)
        siguiente = self.comportamientos.pop(0) if len(self.comportamientos) > 1 else self.comportamientos[0]
        if isinstance(siguiente, Exception):
            raise siguiente
        if callable(siguiente):
            return siguiente()
        return siguiente.model_copy(deep=True)


class CriticoFalso:
    def __init__(self, resultados: List[Union[EvaluacionCalidad, Exception]]):
        self.resultados = list(resultados)
        self.llamadas = 0
        self.parametros_recibidos = []

    def evaluar(self, contenido_generado, fragmentos, parametros):
        self.llamadas += 1
        self.parametros_recibidos.append(parametros)
        siguiente = self.resultados.pop(0) if len(self.resultados) > 1 else self.resultados[0]
        if isinstance(siguiente, Exception):
            raise siguiente
        return siguiente


class ErrorHttpFalso(Exception):
    def __init__(self, status_code: int):
        super().__init__(f"HTTP {status_code}")
        self.status_code = status_code


def armar(
    productor: ProductorFalso,
    critico: CriticoFalso,
    investigador: Optional[InvestigadorFalso] = None,
    almacenador=None,
    **cfg: Any,
):
    inv = investigador or InvestigadorFalso()
    orq = OrquestadorNuevaMente(
        inv, productor, critico, config=crear_config(**cfg), almacenador=almacenador
    )
    return orq, inv


# ----------------------------------------------------------------------
# Flujo principal
# ----------------------------------------------------------------------


def test_flujo_feliz_aprobado_al_primer_intento():
    productor = ProductorFalso([paquete_flashcards()])
    critico = CriticoFalso([evaluacion(4, 4)])
    orq, inv = armar(productor, critico)

    r = orq.ejecutar(SOLICITUD_BASE)

    assert r.status == "exito"
    assert r.orquestacion.intentos_redaccion == 1
    assert r.orquestacion.scores_por_intento == [1.0]
    assert r.evaluacion_calidad.anclaje_fuente_score == 1.0
    assert r.contenido_adaptado.titulo == "Redes en la nube"
    assert r.metadatos.prerrequisitos == ["Redes básicas"]
    assert inv.ingestas == 1
    assert productor.feedbacks == [None]  # primer intento sin feedback


def test_claridad_baja_obliga_reintento_aunque_el_score_de_fidelidad_sea_alto():
    productor = ProductorFalso([paquete_flashcards()])
    critico = CriticoFalso(
        [
            evaluacion(4, 4, claridad="Baja"),
            evaluacion(4, 4, claridad="Alta"),
        ]
    )
    orq, _ = armar(productor, critico)

    r = orq.ejecutar(SOLICITUD_BASE)

    assert r.status == "exito"
    assert r.orquestacion.intentos_redaccion == 2
    assert r.orquestacion.scores_por_intento == [1.0, 1.0]
    assert "Claridad pedagógica: BAJA" in productor.feedbacks[1]


def test_critico_recibe_todo_el_contexto_de_adaptacion():
    productor = ProductorFalso([paquete_flashcards()])
    critico = CriticoFalso([evaluacion(4, 4)])
    orq, _ = armar(productor, critico)

    r = orq.ejecutar(SOLICITUD_BASE)

    assert r.status == "exito"
    parametros = critico.parametros_recibidos[0]
    assert parametros.perfil_destinatario == "Principiante / Transición de Carrera"
    assert parametros.formato_salida == "Flashcards"
    assert parametros.nicho_sector == "General"
    assert parametros.nivel_detalle == "Didáctico"


def test_prompt_critico_contiene_contexto_de_adaptacion():
    prompt = construir_prompt_critico(
        contenido_generado="{}",
        fragmentos="fuente",
        perfil_destinatario="Principiante / Transición de Carrera",
        formato_salida="Flashcards",
        nivel_detalle="Didáctico",
        nicho_sector="General",
    )
    assert "Perfil del destinatario: Principiante / Transición de Carrera" in prompt
    assert "Formato pedagógico: Flashcards" in prompt
    assert "Nivel de detalle: Didáctico" in prompt
    assert "Nicho / sector: General" in prompt


def test_prompt_productor_incluye_few_shot():
    from agente2_productor import AgenteProductorContenido
    from app.core.prompts import EJEMPLO_FEW_SHOT_PRODUCTOR

    agente = AgenteProductorContenido.__new__(AgenteProductorContenido)
    parametros = ParametrosGeneracion(
        perfil_destinatario="Principiante / Transición de Carrera",
        formato_salida="Flashcards",
        nicho_sector="General",
        nivel_detalle="Didáctico",
        tema_consulta="VCN",
    )
    prompt = agente._construir_prompt(chunks_falsos(), parametros)
    assert EJEMPLO_FEW_SHOT_PRODUCTOR in prompt


def test_alias_del_brief_se_normalizan():
    s = SolicitudAdaptacion.model_validate(SOLICITUD_BASE)
    assert s.perfil_destinatario == "Principiante / Transición de Carrera"
    assert s.nivel_detalle == "Didáctico"
    s2 = SolicitudAdaptacion.model_validate(
        {**SOLICITUD_BASE, "formato_salida": "tutorial", "perfil_destinatario": "Avanzado"}
    )
    assert s2.formato_salida == "Guía Práctica Paso a Paso"
    assert s2.perfil_destinatario == "Líder Técnico / Arquitecto"


def test_reintenta_con_feedback_del_critico_y_luego_aprueba():
    productor = ProductorFalso([paquete_flashcards()])
    critico = CriticoFalso(
        [
            evaluacion(2, 4, sugerencias=["Elimina la mención a tarifas"]),
            evaluacion(4, 4),
        ]
    )
    orq, _ = armar(productor, critico)

    r = orq.ejecutar(SOLICITUD_BASE)

    assert r.status == "exito"
    assert r.orquestacion.intentos_redaccion == 2
    assert r.orquestacion.scores_por_intento == [0.5, 1.0]
    assert productor.feedbacks[0] is None
    assert "Elimina la mención a tarifas" in productor.feedbacks[1]
    assert "Afirmación 2" in productor.feedbacks[1]  # afirmación no respaldada citada


def test_agotados_los_reintentos_entrega_el_mejor_intento_con_advertencia():
    productor = ProductorFalso([paquete_flashcards()])
    critico = CriticoFalso(
        [evaluacion(2, 4), evaluacion(3, 4), evaluacion(1, 4)]  # 0.5, 0.75, 0.25
    )
    # 0.75 sería aprobado (>= umbral). Usamos umbral 0.9 para forzar el agotamiento.
    orq, _ = armar(productor, critico, min_anclaje_fuente_score=0.9)

    r = orq.ejecutar(SOLICITUD_BASE)

    assert r.status == "exito_con_advertencias"
    assert r.orquestacion.intentos_redaccion == 3  # 1 + MAX_REDACCION_RETRIES
    assert r.orquestacion.scores_por_intento == [0.5, 0.75, 0.25]
    assert r.evaluacion_calidad.anclaje_fuente_score == 0.75  # el MEJOR, no el último
    assert any("revisión humana" in a for a in r.advertencias)
    assert r.contenido_adaptado is not None


def test_max_reintentos_cero_solo_genera_una_vez():
    productor = ProductorFalso([paquete_flashcards()])
    critico = CriticoFalso([evaluacion(1, 4)])
    orq, _ = armar(productor, critico, max_redaccion_retries=0)

    r = orq.ejecutar(SOLICITUD_BASE)

    assert productor.llamadas == 1
    assert r.status == "exito_con_advertencias"


def test_no_vuelve_a_indexar_un_documento_ya_indexado():
    inv = InvestigadorFalso(indexado=True)
    orq, _ = armar(ProductorFalso([paquete_flashcards()]), CriticoFalso([evaluacion(4, 4)]), inv)
    orq.ejecutar(SOLICITUD_BASE)
    assert inv.ingestas == 0


def test_chunks_se_entregan_en_orden_narrativo():
    capturado = {}

    class ProductorEspia(ProductorFalso):
        def generar_contenido(self, chunks, parametros, feedback_critico=None):
            capturado["orden"] = [c.posicion for c in chunks]
            return super().generar_contenido(chunks, parametros, feedback_critico)

    orq, _ = armar(ProductorEspia([paquete_flashcards()]), CriticoFalso([evaluacion(4, 4)]))
    orq.ejecutar(SOLICITUD_BASE)
    assert capturado["orden"] == [0, 1, 2]


# ----------------------------------------------------------------------
# Validación estricta
# ----------------------------------------------------------------------


def test_entrada_invalida_no_gasta_ninguna_llamada():
    productor = ProductorFalso([paquete_flashcards()])
    critico = CriticoFalso([evaluacion(4, 4)])
    orq, inv = armar(productor, critico)

    r = orq.ejecutar({**SOLICITUD_BASE, "perfil_destinatario": "Astronauta"})

    assert r.status == "error"
    assert r.error.codigo == "ENTRADA_INVALIDA"
    assert "perfil_destinatario" in r.error.mensaje_amigable
    assert productor.llamadas == 0 and critico.llamadas == 0 and inv.ingestas == 0


def test_documento_demasiado_corto_es_rechazado():
    orq, _ = armar(ProductorFalso([paquete_flashcards()]), CriticoFalso([evaluacion(4, 4)]))
    r = orq.ejecutar({**SOLICITUD_BASE, "documento_contenido": "corto"})
    assert r.status == "error" and r.error.codigo == "ENTRADA_INVALIDA"


def test_campos_extra_no_permitidos():
    orq, _ = armar(ProductorFalso([paquete_flashcards()]), CriticoFalso([evaluacion(4, 4)]))
    r = orq.ejecutar({**SOLICITUD_BASE, "campo_raro": 1})
    assert r.status == "error" and r.error.codigo == "ENTRADA_INVALIDA"


def test_estructura_invalida_reintenta_y_se_recupera():
    productor = ProductorFalso([paquete_flashcards(2), paquete_flashcards(5)])  # 2 tarjetas < mínimo 5
    critico = CriticoFalso([evaluacion(4, 4)])
    orq, _ = armar(productor, critico)

    r = orq.ejecutar(SOLICITUD_BASE)

    assert r.status == "exito"
    assert critico.llamadas == 1  # el crítico no se gastó en el intento malo
    assert "entre 5 y 10 items" in productor.feedbacks[1]


def test_estructura_siempre_invalida_termina_en_error_amigable():
    productor = ProductorFalso([paquete_flashcards(1)])
    orq, _ = armar(productor, CriticoFalso([evaluacion(4, 4)]))

    r = orq.ejecutar(SOLICITUD_BASE)

    assert r.status == "error"
    assert r.error.codigo == "ERROR_GENERACION"
    assert "Traceback" not in r.error.mensaje_amigable


def test_json_invalido_del_modelo_es_un_fallo_blando_y_se_reintenta():
    productor = ProductorFalso([ValueError("El modelo no devolvió JSON válido"), paquete_flashcards()])
    orq, _ = armar(productor, CriticoFalso([evaluacion(4, 4)]))
    r = orq.ejecutar(SOLICITUD_BASE)
    assert r.status == "exito"
    assert r.orquestacion.intentos_redaccion == 2


def test_validar_items_quiz_exige_respuesta_dentro_de_opciones():
    malo = {
        "pregunta": "¿Qué es una VCN?",
        "opciones": ["a", "b", "c", "d"],
        "respuesta_correcta": "z",
        "justificacion": "porque sí",
    }
    with pytest.raises(EstructuraInvalidaError):
        validar_items("Quiz Interactivo con Justificaciones", [malo] * 5)


def test_score_se_calcula_en_codigo_no_lo_inventa_el_llm():
    e = evaluacion(3, 4)
    assert e.anclaje_fuente_score == 0.75
    assert len(e.afirmaciones_no_respaldadas) == 1


# ----------------------------------------------------------------------
# Errores de infraestructura
# ----------------------------------------------------------------------


def test_reintenta_errores_transitorios_de_api_con_backoff():
    productor = ProductorFalso([ErrorHttpFalso(429), ErrorHttpFalso(503), paquete_flashcards()])
    orq, _ = armar(productor, CriticoFalso([evaluacion(4, 4)]))

    r = orq.ejecutar(SOLICITUD_BASE)

    assert r.status == "exito"
    assert productor.llamadas == 3
    assert r.orquestacion.intentos_redaccion == 1  # los reintentos de red no cuentan como intentos


def test_error_no_transitorio_no_se_reintenta():
    productor = ProductorFalso([ErrorHttpFalso(401)])  # clave inválida
    orq, _ = armar(productor, CriticoFalso([evaluacion(4, 4)]))

    r = orq.ejecutar(SOLICITUD_BASE)

    assert r.status == "error" and r.error.codigo == "ERROR_GENERACION"
    assert productor.llamadas == 1


def test_se_agotan_los_reintentos_de_red():
    productor = ProductorFalso([ErrorHttpFalso(429)])
    orq, _ = armar(productor, CriticoFalso([evaluacion(4, 4)]), api_reintentos=3)
    r = orq.ejecutar(SOLICITUD_BASE)
    assert r.status == "error"
    assert productor.llamadas == 3


def test_sin_contexto_devuelve_error_amigable():
    orq, _ = armar(
        ProductorFalso([paquete_flashcards()]),
        CriticoFalso([evaluacion(4, 4)]),
        InvestigadorFalso(chunks=[]),
    )
    r = orq.ejecutar(SOLICITUD_BASE)
    assert r.status == "error" and r.error.codigo == "SIN_CONTEXTO"


def test_respaldo_de_recuperacion_sin_umbral_agrega_advertencia():
    class InvestigadorExigente(InvestigadorFalso):
        def buscar(self, consulta, top_k=5, documento_id=None, min_score=0.60):
            self.min_scores_usados.append(min_score)
            return [] if min_score is not None else list(self.chunks)

    inv = InvestigadorExigente()
    orq, _ = armar(ProductorFalso([paquete_flashcards()]), CriticoFalso([evaluacion(4, 4)]), inv)
    r = orq.ejecutar(SOLICITUD_BASE)
    assert r.status == "exito"
    assert inv.min_scores_usados == [0.60, None]
    assert any("umbral de similitud" in a for a in r.advertencias)


def test_si_el_critico_falla_no_se_entrega_contenido_sin_verificar():
    orq, _ = armar(
        ProductorFalso([paquete_flashcards()]), CriticoFalso([RuntimeError("boom")])
    )
    r = orq.ejecutar(SOLICITUD_BASE)
    assert r.status == "error" and r.error.codigo == "ERROR_CRITICO"
    assert r.contenido_adaptado is None


def test_fallo_tras_un_intento_verificado_entrega_el_mejor_intento():
    # 1.º intento: score 0.5 (rechazado). 2.º intento: el LLM falla con 401.
    productor = ProductorFalso([paquete_flashcards(), ErrorHttpFalso(401)])
    critico = CriticoFalso([evaluacion(2, 4)])
    orq, _ = armar(productor, critico)

    r = orq.ejecutar(SOLICITUD_BASE)

    assert r.status == "exito_con_advertencias"
    assert r.evaluacion_calidad.anclaje_fuente_score == 0.5
    assert any("mejor intento verificado" in a for a in r.advertencias)


def test_error_de_indexacion():
    class InvestigadorRoto(InvestigadorFalso):
        def ingerir_documento(self, *a, **k):
            raise RuntimeError("Chroma no responde")

    orq, _ = armar(
        ProductorFalso([paquete_flashcards()]),
        CriticoFalso([evaluacion(4, 4)]),
        InvestigadorRoto(),
    )
    r = orq.ejecutar(SOLICITUD_BASE)
    assert r.status == "error" and r.error.codigo == "ERROR_INDEXACION"


# ----------------------------------------------------------------------
# Persistencia en OCI (interfaz para el compañero de OCI)
# ----------------------------------------------------------------------


def test_persistencia_oci_se_adjunta_a_la_respuesta():
    recibido = {}

    def almacenador(solicitud, respuesta):
        recibido["formato"] = solicitud.formato_salida
        recibido["status"] = respuesta.status
        return AlmacenamientoOCI(
            bucket="nuevamente-contenidos-educativos",
            objeto_id="contenido-001.json",
            status_upload="completado",
        )

    orq, _ = armar(
        ProductorFalso([paquete_flashcards()]),
        CriticoFalso([evaluacion(4, 4)]),
        almacenador=almacenador,
    )
    r = orq.ejecutar(SOLICITUD_BASE)

    assert r.almacenamiento_oci.status_upload == "completado"
    assert r.almacenamiento_oci.bucket == "nuevamente-contenidos-educativos"
    assert recibido == {"formato": "Flashcards", "status": "exito"}


def test_si_oci_falla_el_contenido_se_entrega_igual_con_advertencia():
    def almacenador_roto(solicitud, respuesta):
        raise ConnectionError("sin red")

    orq, _ = armar(
        ProductorFalso([paquete_flashcards()]),
        CriticoFalso([evaluacion(4, 4)]),
        almacenador=almacenador_roto,
    )
    r = orq.ejecutar(SOLICITUD_BASE)

    assert r.status == "exito"
    assert r.almacenamiento_oci.status_upload == "error"
    assert any("OCI" in a for a in r.advertencias)


def test_no_se_persisten_las_respuestas_de_error():
    llamadas = []
    orq, _ = armar(
        ProductorFalso([paquete_flashcards()]),
        CriticoFalso([evaluacion(4, 4)]),
        InvestigadorFalso(chunks=[]),
        almacenador=lambda s, r: llamadas.append(1),
    )
    orq.ejecutar(SOLICITUD_BASE)
    assert llamadas == []


# ----------------------------------------------------------------------
# Utilidades
# ----------------------------------------------------------------------


def test_documento_id_es_estable_y_distingue_documentos():
    a = calcular_documento_id("T", "contenido")
    assert a == calcular_documento_id("T", "contenido")
    assert a != calcular_documento_id("T", "contenido distinto")
    assert a.startswith("doc-")


def test_clasificacion_de_errores_transitorios_mira_la_cadena_de_causas():
    try:
        try:
            raise ErrorHttpFalso(429)
        except ErrorHttpFalso as interno:
            raise RuntimeError("envuelto por el agente") from interno
    except RuntimeError as envuelto:
        assert es_error_transitorio(envuelto)
    assert not es_error_transitorio(ValueError("json malo"))
    assert es_error_transitorio(TimeoutError())


def test_el_grafo_compila_y_expone_diagrama_mermaid():
    orq, _ = armar(ProductorFalso([paquete_flashcards()]), CriticoFalso([evaluacion(4, 4)]))
    diagrama = orq.diagrama_mermaid()
    for nodo in ("ingestar", "investigar", "redactar", "criticar", "finalizar", "persistir"):
        assert nodo in diagrama


def test_agente1_arranca_con_chromadb_pinneado(tmp_path):
    """Regresión: `configuration=` rompía el arranque con chromadb==0.5.20."""
    from agente1_investigador import AgenteInvestigadorRAG

    agente = AgenteInvestigadorRAG(
        cohere_api_key="clave-de-prueba", chroma_path=str(tmp_path / "chroma")
    )
    assert agente.contar_chunks() == 0



def test_agente1_embebe_en_lotes_de_hasta_96():
    from types import SimpleNamespace
    from agente1_investigador import AgenteInvestigadorRAG

    class CohereFalso:
        def __init__(self):
            self.tamanos = []

        def embed(self, model, texts, input_type, embedding_types):
            self.tamanos.append(len(texts))
            return SimpleNamespace(
                embeddings=SimpleNamespace(float=[[float(i)] for i in range(len(texts))])
            )

    agente = AgenteInvestigadorRAG.__new__(AgenteInvestigadorRAG)
    agente.cohere_client = CohereFalso()
    agente.embedding_model = "modelo"

    resultado = agente._embeber(["texto"] * 97, "search_document")

    assert agente.cohere_client.tamanos == [96, 1]
    assert len(resultado) == 97


def test_agente1_no_borra_indice_si_falla_el_embedding():
    from agente1_investigador import AgenteInvestigadorRAG

    agente = AgenteInvestigadorRAG.__new__(AgenteInvestigadorRAG)
    agente.eliminado = False
    agente.eliminar_documento = lambda documento_id: setattr(agente, "eliminado", True)
    agente._embeber = lambda textos, input_type: (_ for _ in ()).throw(
        RuntimeError("fallo de Cohere")
    )

    try:
        agente.ingerir_documento(
            "doc-x",
            "Documento",
            " ".join(["palabra"] * 50),
        )
    except RuntimeError:
        pass
    else:
        raise AssertionError("Se esperaba un fallo de embeddings")

    assert agente.eliminado is False


def test_agente1_no_pide_a_chroma_mas_resultados_de_los_disponibles():
    from types import SimpleNamespace
    from agente1_investigador import AgenteInvestigadorRAG

    class ClienteEmbeddings:
        def embed(self, model, texts, input_type, embedding_types):
            return SimpleNamespace(
                embeddings=SimpleNamespace(float=[[0.1, 0.2]])
            )

    class ColeccionFalsa:
        def __init__(self):
            self.n_results = None

        def count(self):
            return 2

        def query(self, **kwargs):
            self.n_results = kwargs["n_results"]
            return {
                "documents": [["a", "b"]],
                "metadatas": [
                    [
                        {"documento_id": "doc-x", "documento_titulo": "Doc", "chunk_id": "x0", "posicion": 0},
                        {"documento_id": "doc-x", "documento_titulo": "Doc", "chunk_id": "x1", "posicion": 1},
                    ]
                ],
                "distances": [[0.1, 0.2]],
            }

    agente = AgenteInvestigadorRAG.__new__(AgenteInvestigadorRAG)
    agente.cohere_client = ClienteEmbeddings()
    agente.embedding_model = "modelo"
    agente.collection = ColeccionFalsa()

    resultados = agente.buscar("consulta", top_k=6)

    assert agente.collection.n_results == 2
    assert len(resultados) == 2



def test_agente1_actualiza_el_indice_sin_borrado_previo():
    from agente1_investigador import AgenteInvestigadorRAG

    class ColeccionFalsa:
        def __init__(self):
            self.upsert_llamado = False
            self.delete_ids = None

        def get(self, where=None, include=None):
            return {"ids": ["doc-x_0", "doc-x_9"]}

        def upsert(self, **kwargs):
            self.upsert_llamado = True
            assert kwargs["ids"] == ["doc-x_0", "doc-x_1"]

        def delete(self, **kwargs):
            self.delete_ids = kwargs["ids"]

    agente = AgenteInvestigadorRAG.__new__(AgenteInvestigadorRAG)
    agente.eliminar_documento = lambda documento_id: (_ for _ in ()).throw(
        AssertionError("No debe borrarse el documento antes del upsert")
    )
    agente.collection = ColeccionFalsa()
    agente._limpiar_texto = AgenteInvestigadorRAG._limpiar_texto
    agente._segmentar_texto = lambda texto, chunk_size, overlap: ["a", "b"]
    agente._embeber = lambda textos, input_type: [[0.1], [0.2]]

    total = agente.ingerir_documento(
        "doc-x",
        "Documento",
        " ".join(["palabra"] * 50),
        chunk_size=2,
        chunk_overlap=0,
    )

    assert total == 2
    assert agente.collection.upsert_llamado is True
    assert agente.collection.delete_ids == ["doc-x_9"]
