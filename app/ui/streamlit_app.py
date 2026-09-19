"""
Interfaz Streamlit de NuevaMente.

Flujo:
  1. El usuario sube un documento técnico (PDF/Markdown/txt).
  2. Selecciona perfil de destinatario, formato de salida, nicho y nivel de detalle.
  3. Se ingesta + indexa el documento en Chroma.
  4. Se ejecuta el grafo de agentes (investigador -> redactor -> crítico).
  5. Se muestra el resultado (renderizado según formato) + JSON crudo.
  6. Se sube el original y el JSON generado a OCI Object Storage.
"""

from __future__ import annotations

import json

import streamlit as st

from app.core.ingestion import IngestionError, cargar_documento_desde_bytes
from app.core.orchestrator import LLMGenerationError, ejecutar_pipeline
from app.core.rag_pipeline import indexar_documento
from app.core.schemas import (
    FormatoSalida,
    NivelDetalle,
    PerfilDestinatario,
    SolicitudAdaptacion,
)
from app.storage.oci_client import OCIObjectStorageClient, StorageUploadError

st.set_page_config(page_title="NuevaMente", page_icon="🎓", layout="wide")

st.title("🎓 NuevaMente")
st.caption(
    "Sistema Inteligente de Adaptación y Generación de Contenido Educativo "
    "— Hackathon ONE G10"
)

# ---------------------------------------------------------------------------
# Formulario de entrada
# ---------------------------------------------------------------------------

with st.sidebar:
    st.header("Parámetros de adaptación")

    archivo = st.file_uploader(
        "Documento técnico", type=["pdf", "md", "markdown", "txt"]
    )

    perfil = st.selectbox(
        "Perfil del destinatario",
        options=list(PerfilDestinatario),
        format_func=lambda p: p.value,
    )
    formato = st.selectbox(
        "Formato pedagógico de salida",
        options=list(FormatoSalida),
        format_func=lambda f: f.value,
    )
    nicho = st.text_input("Nicho / Contexto de aplicación", value="General")
    nivel = st.selectbox(
        "Nivel de detalle",
        options=list(NivelDetalle),
        format_func=lambda n: n.value,
    )

    generar = st.button("Generar contenido adaptado", type="primary", use_container_width=True)


# ---------------------------------------------------------------------------
# Renderizado del resultado según formato
# ---------------------------------------------------------------------------

def _renderizar_contenido(contenido, formato_seleccionado: FormatoSalida) -> None:
    st.subheader(contenido.titulo)
    st.markdown(f"*{contenido.introduccion_contextualizada}*")

    if formato_seleccionado == FormatoSalida.FLASHCARDS:
        cols = st.columns(2)
        for i, item in enumerate(contenido.items):
            with cols[i % 2]:
                with st.expander(f"🃏 {item.frente or 'Frente'}"):
                    st.write(item.dorso)
                    if item.pista_didactica:
                        st.caption(f"💡 {item.pista_didactica}")

    elif formato_seleccionado == FormatoSalida.QUIZ:
        for i, item in enumerate(contenido.items, start=1):
            st.markdown(f"**{i}. {item.pregunta}**")
            if item.opciones:
                st.radio(
                    "Opciones", item.opciones, key=f"quiz_{i}", label_visibility="collapsed"
                )
            with st.expander("Ver justificación"):
                st.write(f"✅ Respuesta correcta: {item.respuesta_correcta}")
                st.write(item.justificacion)

    elif formato_seleccionado == FormatoSalida.TUTORIAL:
        for i, item in enumerate(contenido.items, start=1):
            st.markdown(f"### Paso {i}: {item.paso_titulo}")
            st.write(item.paso_contenido)

    elif formato_seleccionado == FormatoSalida.RESUMEN_TLDR:
        st.markdown(contenido.resumen_markdown or "_Sin resumen generado._")

    elif formato_seleccionado == FormatoSalida.GUION_CLASE:
        for i, item in enumerate(contenido.items, start=1):
            st.markdown(f"**🎬 Escena {i}: {item.escena}**")
            st.write(item.narracion)

    else:
        st.json([item.model_dump(exclude_none=True) for item in contenido.items])


# ---------------------------------------------------------------------------
# Ejecución del pipeline
# ---------------------------------------------------------------------------

if generar:
    if not archivo:
        st.error("Subí un documento técnico antes de generar el contenido.")
        st.stop()

    with st.status("Procesando...", expanded=True) as status:
        try:
            status.write("📥 Ingiriendo documento...")
            doc = cargar_documento_desde_bytes(archivo.getvalue(), archivo.name)

            status.write("🔎 Indexando en el Vector Store (chunking + embeddings)...")
            n_chunks = indexar_documento(doc)
            status.write(f"   → {n_chunks} chunks indexados.")

            solicitud = SolicitudAdaptacion(
                documento_titulo=doc.titulo,
                documento_contenido=doc.texto,
                perfil_destinatario=perfil,
                formato_salida=formato,
                nicho_sector=nicho,
                nivel_detalle=nivel,
            )

            status.write("🤖 Ejecutando agentes (investigador → redactor → crítico)...")
            resultado = ejecutar_pipeline(solicitud)

            status.write("☁️ Subiendo resultado a OCI Object Storage...")
            almacenamiento = None
            try:
                oci_client = OCIObjectStorageClient()
                oci_client.subir_documento_original(
                    doc.doc_id, doc.extension, archivo.getvalue()
                )
                object_id = oci_client.subir_contenido_generado(
                    doc_id=doc.doc_id,
                    perfil=perfil.value,
                    formato=formato.value,
                    payload=resultado["contenido_adaptado"].model_dump(),
                )
                almacenamiento = {
                    "bucket": oci_client.bucket_name,
                    "objeto_id": object_id,
                    "status_upload": "completado",
                }
                status.write("   → Subido correctamente.")
            except (StorageUploadError, KeyError) as exc:
                almacenamiento = {"bucket": "N/A", "objeto_id": "N/A", "status_upload": "error"}
                status.write(f"   ⚠️ No se pudo subir a OCI: {exc}")

            status.update(label="✅ Contenido generado", state="complete")

        except IngestionError as exc:
            st.error(f"Error al leer el documento: {exc}")
            st.stop()
        except LLMGenerationError as exc:
            st.error(f"Error al generar contenido con el LLM: {exc}")
            st.stop()
        except Exception as exc:  # noqa: BLE001
            st.error(f"Error inesperado: {exc}")
            st.stop()

    contenido = resultado["contenido_adaptado"]
    evaluacion = resultado["evaluacion"]

    col_resultado, col_meta = st.columns([2, 1])

    with col_resultado:
        _renderizar_contenido(contenido, formato)

    with col_meta:
        st.metric("Anclaje a la fuente", f"{evaluacion.anclaje_fuente_score:.0%}")
        st.metric("Claridad pedagógica", evaluacion.claridad_pedagogica.value)
        st.caption(evaluacion.observaciones)
        if almacenamiento:
            st.write("**Almacenamiento OCI**")
            st.json(almacenamiento)

    payload_completo = {
        "status": "exito",
        "contenido_adaptado": contenido.model_dump(exclude_none=True),
        "evaluacion_calidad": evaluacion.model_dump(),
        "almacenamiento_oci": almacenamiento,
    }

    with st.expander("Ver JSON completo"):
        st.json(payload_completo)

    st.download_button(
        "⬇️ Descargar JSON",
        data=json.dumps(payload_completo, ensure_ascii=False, indent=2),
        file_name=f"{doc.doc_id}-contenido.json",
        mime="application/json",
    )
else:
    st.info("Subí un documento técnico y configurá los parámetros en la barra lateral para empezar.")
