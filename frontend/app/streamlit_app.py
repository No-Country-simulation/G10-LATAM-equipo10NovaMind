"""
Interfaz de Usuario en Streamlit — NuevaMente
Sistema Inteligente de Adaptación y Generación de Contenido Educativo.
Desarrollado por: Equipo 10 (G10 - NovaMind) para No-Country
Simulación Hackathon ONE G10 (Oracle Next Education & Alura)
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any, Dict

import streamlit as st
from api_client import BackendAPIClient

st.set_page_config(
    page_title="NuevaMente — Adaptador Educativo",
    page_icon="🧠",
    layout="wide",
    initial_sidebar_state="expanded",
)

client = BackendAPIClient()


# ----------------------------------------------------------------------
# Renderizadores Especializados para los 5 Formatos Pedagógicos
# ----------------------------------------------------------------------


def _render_flashcards(items: list[dict]):
    st.subheader("🗂️ Flashcards de Estudio")
    cols = st.columns(2)
    for i, item in enumerate(items):
        with cols[i % 2]:
            concepto = item.get("concepto_clave", "")
            badge = f"<span style='background-color:#1e3a8a;color:#fff;padding:2px 8px;border-radius:12px;font-size:0.75rem;'>{concepto}</span>" if concepto else ""
            with st.container(border=True):
                st.markdown(f"**Tarjeta #{i + 1}** {badge}", unsafe_allow_html=True)
                st.markdown(f"### {item.get('frente', '')}")
                with st.expander("👁️ Ver Reverso / Respuesta"):
                    st.info(item.get("dorso", ""))


def _render_quiz(items: list[dict]):
    st.subheader("📝 Quiz Interactivo con Justificaciones")
    for i, item in enumerate(items):
        with st.container(border=True):
            pregunta = item.get("pregunta", "")
            st.markdown(f"**Pregunta #{i + 1}:** {pregunta}")
            opciones = item.get("opciones", [])
            resp_correcta = item.get("respuesta_correcta", "")
            q_hash = abs(hash(pregunta)) % 1000000
            eleccion = st.radio(
                f"Selecciona una opción para la pregunta #{i + 1}:",
                opciones,
                key=f"quiz_q_{i}_{q_hash}",
                index=None,
            )
            if eleccion is not None:
                if eleccion.strip().lower() == resp_correcta.strip().lower():
                    st.success(f"✅ ¡Correcto! {eleccion}")
                else:
                    st.error(f"❌ Incorrecto. La respuesta correcta es: **{resp_correcta}**")
                if "justificacion" in item and item["justificacion"]:
                    st.markdown(f"💡 **Justificación:** *{item['justificacion']}*")


def _render_tutorial(items: list[dict]):
    st.subheader("🛠️ Guía Práctica Paso a Paso")
    for item in items:
        with st.container(border=True):
            paso_num = item.get("numero_paso", 1)
            titulo = item.get("titulo", f"Paso {paso_num}")
            st.markdown(f"### Paso {paso_num}: {titulo}")
            st.markdown(item.get("instruccion", ""))
            if "advertencia_o_tip" in item and item["advertencia_o_tip"]:
                st.warning(f"⚠️ **Tip / Advertencia:** {item['advertencia_o_tip']}")


def _render_resumen(items: list[dict]):
    st.subheader("📋 Resumen Ejecutivo (TL;DR)")
    for i, item in enumerate(items):
        with st.container(border=True):
            st.markdown(f"#### 📌 {item.get('punto', '')}")
            st.markdown(f"**¿Por qué importa?** {item.get('por_que_importa', '')}")


def _render_guion(items: list[dict]):
    st.subheader("🎬 Guion de Clase / Video")
    for item in items:
        minuto = item.get("minuto_aproximado", "00:00")
        with st.container(border=True):
            st.markdown(f"**⏱️ Minuto:** `{minuto}`")
            st.markdown(f"🎙️ **Locución:**\n> {item.get('narracion', '')}")
            if "apoyo_visual_sugerido" in item:
                st.markdown(f"🖼️ **Apoyo Visual Sugerido:** `{item['apoyo_visual_sugerido']}`")


def render_contenido_adaptado(formato: str, contenido: dict):
    st.markdown(f"# {contenido.get('titulo', 'Contenido Adaptado')}")
    if "introduccion_contextualizada" in contenido:
        st.markdown(f"*{contenido['introduccion_contextualizada']}*")
    st.divider()

    items = contenido.get("items", [])
    if not items:
        st.warning("No se generaron ítems para este contenido.")
        return

    if "Flashcard" in formato:
        _render_flashcards(items)
    elif "Quiz" in formato:
        _render_quiz(items)
    elif "Paso" in formato or "Tutorial" in formato:
        _render_tutorial(items)
    elif "Resumen" in formato or "TL;DR" in formato:
        _render_resumen(items)
    elif "Guion" in formato or "Video" in formato:
        _render_guion(items)
    else:
        st.json(items)


# ----------------------------------------------------------------------
# Sidebar y Controles
# ----------------------------------------------------------------------

st.sidebar.title("⚙️ Configuración")

# Estado de conexión con el backend
ok, msg = client.verificar_salud()
if ok:
    st.sidebar.success(f"🟢 {msg}")
else:
    st.sidebar.error(f"🔴 {msg}")

# Obtener opciones del backend (o fallback)
opciones = client.obtener_opciones()

st.sidebar.header("1. Documento Fuente")

DOCS_DIR = Path(__file__).resolve().parent.parent.parent / "data" / "documents"
docs_disponibles = []
if DOCS_DIR.exists():
    docs_disponibles = sorted([f.name for f in DOCS_DIR.iterdir() if f.is_file() and f.name != ".gitkeep"])

modo_fuente = st.sidebar.radio(
    "Selecciona el origen del documento:",
    ["📚 Documentos de Prueba (Precargados)", "📂 Subir archivo propio (PDF/MD/TXT)", "✍️ Ingresar texto directo"],
    index=0 if docs_disponibles else 1,
)

archivo_bytes = None
nombre_archivo = None
texto_directo = ""

if modo_fuente == "📚 Documentos de Prueba (Precargados)":
    if docs_disponibles:
        doc_elegido = st.sidebar.selectbox("Documento disponible en el repo:", docs_disponibles)
        ruta_completa = DOCS_DIR / doc_elegido
        tam_kb = ruta_completa.stat().st_size / 1024
        st.sidebar.success(f"✅ Archivo listo: `{doc_elegido}` ({tam_kb:.1f} KB)")
        archivo_bytes = ruta_completa.read_bytes()
        nombre_archivo = doc_elegido
    else:
        st.sidebar.warning("No se encontraron documentos en data/documents/")
elif modo_fuente == "📂 Subir archivo propio (PDF/MD/TXT)":
    archivo_subido = st.sidebar.file_uploader(
        "Sube un archivo técnico (PDF, Markdown o TXT)",
        type=["pdf", "md", "txt", "markdown"],
    )
    if archivo_subido:
        archivo_bytes = archivo_subido.read()
        nombre_archivo = archivo_subido.name
else:
    texto_directo = st.sidebar.text_area("Pega aquí el contenido técnico:", height=150)

st.sidebar.header("2. Parámetros Pedagógicos")
perfil_sel = st.sidebar.selectbox(
    "Perfil Destinatario:",
    opciones.get("perfiles_destinatario", []),
)
formato_sel = st.sidebar.selectbox(
    "Formato Pedagógico:",
    opciones.get("formatos_salida", []),
)
nicho_sel = st.sidebar.selectbox(
    "Nicho / Sector:",
    opciones.get("nichos_sector", []),
)
nivel_sel = st.sidebar.selectbox(
    "Nivel de Detalle:",
    opciones.get("niveles_detalle", []),
)
tema_consulta = st.sidebar.text_input(
    "Pregunta / Foco de búsqueda (Opcional):",
    placeholder="Ej: conceptos clave, ideas principales o dudas específicas",
)

boton_generar = st.sidebar.button("🚀 Adaptar Contenido", type="primary", use_container_width=True)


# ----------------------------------------------------------------------
# Panel Principal con Persistencia de Estado
# ----------------------------------------------------------------------

st.title("🧠 NuevaMente — Sistema de Adaptación Educativa")
st.caption(
    "Transformación pedagógica guiada por Agentes Inteligentes (RAG + LangGraph + Fact-Checking)"
)

# Inicialización de estado para que las interacciones del usuario (como Quizzes) no reinicien la vista
if "resultado_actual" not in st.session_state:
    st.session_state["resultado_actual"] = None
if "formato_actual" not in st.session_state:
    st.session_state["formato_actual"] = None

tab_adaptar, tab_historial = st.tabs(["✨ Adaptador Educativo", "📚 Historial de Paquetes Guardados"])

with tab_adaptar:
    if boton_generar:
        if not archivo_bytes and not texto_directo.strip():
            st.error("⚠️ Debes seleccionar un documento de prueba, subir un archivo o ingresar texto para adaptar.")
        else:
            with st.status("Ejecutando orquestación multi-agente...", expanded=True) as status:
                st.write("📄 Extrayendo documento e indexando chunks...")
                st.write(f"🤖 Agente Productor generando formato '{formato_sel}'...")
                st.write("🔍 Agente Crítico auditando anclaje y veracidad...")

                resultado = client.adaptar_contenido(
                    archivo_bytes=archivo_bytes,
                    nombre_archivo=nombre_archivo,
                    texto_directo=texto_directo,
                    titulo=nombre_archivo or "Documento Técnico",
                    perfil=perfil_sel,
                    formato=formato_sel,
                    nicho=nicho_sel,
                    nivel=nivel_sel,
                    tema_consulta=tema_consulta or None,
                )
                status.update(label="¡Adaptación completada!", state="complete", expanded=False)

            st.session_state["resultado_actual"] = resultado
            st.session_state["formato_actual"] = formato_sel

    resultado = st.session_state.get("resultado_actual")
    formato_activo = st.session_state.get("formato_actual") or formato_sel

    if resultado:
        if resultado.get("status") == "error":
            error_data = resultado.get("error", {})
            st.error(f"❌ Error: {error_data.get('mensaje_amigable', 'Ocurrió un error inesperado')}")
            if st.button("🔄 Intentar Nuevamente"):
                st.session_state["resultado_actual"] = None
                st.rerun()
        else:
            col_top_l, col_top_r = st.columns([4, 1])
            with col_top_r:
                if st.button("🔄 Nueva Adaptación", use_container_width=True):
                    st.session_state["resultado_actual"] = None
                    st.rerun()

            contenido = resultado.get("contenido_adaptado")
            orq = resultado.get("orquestacion", {})
            calidad = resultado.get("evaluacion_calidad", {})
            storage = resultado.get("almacenamiento_oci", {})

            # Métricas
            col1, col2, col3, col4 = st.columns(4)
            score = calidad.get("anclaje_fuente_score", 0.0)
            col1.metric("Anclaje a Fuentes", f"{score * 100:.1f}%")
            col2.metric("Claridad Pedagógica", calidad.get("claridad_pedagogica", "N/A"))
            col3.metric("Intentos / Loops", orq.get("intentos_redaccion", 1))
            col4.metric("Duración", f"{orq.get('duracion_segundos', 0.0):.1f}s")

            if resultado.get("status") == "exito_con_advertencias":
                st.warning("⚠️ Se generó el mejor contenido posible, pero con advertencias de calidad.")
                for adv in resultado.get("advertencias", []):
                    st.caption(f"• {adv}")

            if storage and storage.get("status_upload") == "completado":
                st.success(f"💾 Almacenado en: `{storage.get('objeto_id', 'N/A')}`")

            # Renderizado temático
            if contenido:
                render_contenido_adaptado(formato_activo, contenido)

            # Opciones de descarga
            st.divider()
            st.download_button(
                label="📥 Descargar Resultado Completo (JSON)",
                data=json.dumps(resultado, ensure_ascii=False, indent=2),
                file_name=f"adaptacion_{formato_activo.lower().replace(' ', '_')}.json",
                mime="application/json",
            )
    else:
        st.info("👈 Configura los parámetros en el menú lateral y haz clic en **Adaptar Contenido** para comenzar.")

with tab_historial:
    st.subheader("📚 Paquetes Guardados en Almacenamiento")
    st.caption("Contenidos generados y persistidos en el almacenamiento local o en OCI Object Storage.")

    if st.button("🔄 Actualizar Lista"):
        st.rerun()

    info_paquetes = client.listar_paquetes()
    paquetes = info_paquetes.get("paquetes", [])
    origen = info_paquetes.get("origen", "desconocido")

    if not paquetes:
        st.info("No hay paquetes generados aún. Genera tu primer contenido en la pestaña 'Adaptador Educativo'.")
    else:
        st.write(f"**Origen de persistencia:** `{origen}` · **Total paquetes:** {len(paquetes)}")
        for pkg in paquetes:
            nombre = pkg.get("nombre", "")
            tam = pkg.get("tamanio_bytes", 0)
            tam_kb = f"{tam / 1024:.1f} KB" if tam else "N/A"
            with st.container(border=True):
                col_p1, col_p2 = st.columns([3, 1])
                with col_p1:
                    st.markdown(f"📄 **`{nombre}`** ({tam_kb})")
                with col_p2:
                    if st.button("👁️ Cargar en Visor", key=f"btn_pkg_{nombre}"):
                        datos_pkg = client.descargar_paquete(nombre)
                        if datos_pkg:
                            formato_guardado = datos_pkg.get("metadatos", {}).get("formato_salida") or datos_pkg.get("solicitud", {}).get("formato") or "Flashcards"
                            st.session_state["resultado_actual"] = datos_pkg
                            st.session_state["formato_actual"] = formato_guardado
                            st.success(f"¡Paquete `{nombre}` cargado! Abre la pestaña 'Adaptador Educativo' para verlo.")
                            st.rerun()

st.divider()
st.caption("🚀 Desarrollado por el **Equipo 10 (G10 - NovaMind)** para **No-Country** · Simulación Hackathon ONE G10")
