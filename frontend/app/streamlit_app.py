"""
Frontend de NuevaMente — servicio independiente (Streamlit).

Este servicio NO tiene lógica de negocio. Su único trabajo es:
  1. Recolectar los inputs del usuario (archivo + parámetros).
  2. Mandarlos al backend por HTTP (vía `api_client.py`).
  3. Renderizar la respuesta que el backend devuelve.

No importa `app.core.*` de ningún tipo — ese código ni siquiera está
instalado en este contenedor (ver `frontend/requirements.txt`).
"""

from __future__ import annotations

import json

import streamlit as st

from app.api_client import (
    BackendNoDisponibleError,
    BackendRespuestaError,
    backend_disponible,
    generar_contenido_adaptado,
)
from app.constants import FORMATOS_SALIDA, NIVELES_DETALLE, PERFILES_DESTINATARIO

st.set_page_config(page_title="NuevaMente", page_icon="🎓", layout="wide")

st.title("🎓 NuevaMente")
st.caption(
    "Sistema Inteligente de Adaptación y Generación de Contenido Educativo "
    "— Hackathon ONE G10 (frontend y backend como servicios separados)"
)

# ---------------------------------------------------------------------------
# Indicador de conexión al backend (GET /health)
# ---------------------------------------------------------------------------
if backend_disponible():
    st.success("Conectado al backend ✅", icon="🔌")
else:
    st.error(
        "No se pudo conectar al backend. Verificá que el servicio `backend` "
        "esté levantado (`docker compose ps`).",
        icon="🚫",
    )

# ---------------------------------------------------------------------------
# Recolección de inputs de UI
# ---------------------------------------------------------------------------
with st.sidebar:
    st.header("Parámetros de adaptación")

    archivo = st.file_uploader("Documento técnico", type=["pdf", "md", "markdown", "txt"])
    perfil = st.selectbox("Perfil del destinatario", options=PERFILES_DESTINATARIO)
    formato = st.selectbox("Formato pedagógico de salida", options=FORMATOS_SALIDA)
    nicho = st.text_input("Nicho / Contexto de aplicación", value="General")
    nivel = st.selectbox("Nivel de detalle", options=NIVELES_DETALLE)

    generar = st.button("Generar contenido adaptado", type="primary", use_container_width=True)


# ---------------------------------------------------------------------------
# Renderizado del resultado. Opera sobre el dict JSON crudo devuelto por
# el backend (no sobre ninguna clase Pydantic): eso es justamente lo que
# permite que este servicio no dependa del código del backend.
# ---------------------------------------------------------------------------

def _renderizar_contenido(contenido: dict, formato_seleccionado: str) -> None:
    st.subheader(contenido.get("titulo", ""))
    st.markdown(f"*{contenido.get('introduccion_contextualizada', '')}*")

    items = contenido.get("items") or []

    if formato_seleccionado == "Flashcards":
        cols = st.columns(2)
        for i, item in enumerate(items):
            with cols[i % 2]:
                with st.expander(f"🃏 {item.get('frente', 'Frente')}"):
                    st.write(item.get("dorso", ""))
                    if item.get("pista_didactica"):
                        st.caption(f"💡 {item['pista_didactica']}")

    elif formato_seleccionado == "Quiz Interactivo con Justificaciones":
        for i, item in enumerate(items, start=1):
            st.markdown(f"**{i}. {item.get('pregunta', '')}**")
            if item.get("opciones"):
                st.radio("Opciones", item["opciones"], key=f"quiz_{i}", label_visibility="collapsed")
            with st.expander("Ver justificación"):
                st.write(f"✅ Respuesta correcta: {item.get('respuesta_correcta', '')}")
                st.write(item.get("justificacion", ""))

    elif formato_seleccionado == "Guía Práctica Paso a Paso (Tutorial)":
        for i, item in enumerate(items, start=1):
            st.markdown(f"### Paso {i}: {item.get('paso_titulo', '')}")
            st.write(item.get("paso_contenido", ""))

    elif formato_seleccionado == "Resumen Ejecutivo (TL;DR)":
        st.markdown(contenido.get("resumen_markdown") or "_Sin resumen generado._")

    elif formato_seleccionado == "Guion de Clase / Video":
        for i, item in enumerate(items, start=1):
            st.markdown(f"**🎬 Escena {i}: {item.get('escena', '')}**")
            st.write(item.get("narracion", ""))

    else:
        st.json(items)


# ---------------------------------------------------------------------------
# Disparo del procesamiento
# ---------------------------------------------------------------------------
if generar:
    if not archivo:
        st.error("Subí un documento técnico antes de generar el contenido.")
        st.stop()

    with st.spinner("Generando contenido con el backend..."):
        try:
            # ====================================================================
            # ### === FRONTERA: ENTRADA (Frontend -> Backend, vía HTTP) === ###
            # ====================================================================
            respuesta = generar_contenido_adaptado(
                archivo_bytes=archivo.getvalue(),
                nombre_archivo=archivo.name,
                perfil_destinatario=perfil,
                formato_salida=formato,
                nicho_sector=nicho,
                nivel_detalle=nivel,
            )
            # ====================================================================
            # ### === FRONTERA: SALIDA (Backend -> Frontend, vía HTTP) === ###
            # A partir de acá `respuesta` es un dict JSON; todo lo que sigue
            # es puro renderizado.
            # ====================================================================
        except BackendNoDisponibleError as exc:
            st.error(f"El backend no está disponible: {exc}")
            st.stop()
        except BackendRespuestaError as exc:
            st.error(f"El backend devolvió un error ({exc.status_code}): {exc.detalle}")
            st.stop()

    contenido = respuesta.get("contenido_adaptado") or {}
    evaluacion = respuesta.get("evaluacion_calidad") or {}
    almacenamiento = respuesta.get("almacenamiento_oci")

    col_resultado, col_meta = st.columns([2, 1])

    with col_resultado:
        _renderizar_contenido(contenido, formato)

    with col_meta:
        st.metric("Anclaje a la fuente", f"{evaluacion.get('anclaje_fuente_score', 0):.0%}")
        st.metric("Claridad pedagógica", evaluacion.get("claridad_pedagogica", "N/A"))
        st.caption(evaluacion.get("observaciones", ""))
        if almacenamiento:
            st.write("**Almacenamiento OCI**")
            st.json(almacenamiento)

    with st.expander("Ver JSON completo (tal cual lo devuelve el backend)"):
        st.json(respuesta)

    st.download_button(
        "⬇️ Descargar JSON",
        data=json.dumps(respuesta, ensure_ascii=False, indent=2),
        file_name="contenido-adaptado.json",
        mime="application/json",
    )
else:
    st.info("Subí un documento técnico y configurá los parámetros en la barra lateral para empezar.")
