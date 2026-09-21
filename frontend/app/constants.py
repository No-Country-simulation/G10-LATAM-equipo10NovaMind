"""
Opciones de los selectbox del frontend.

Nota de diseño importante: el frontend NO importa `app.core.schemas` del
backend (son dos servicios separados, con su propio `requirements.txt` y
su propio ciclo de vida). Por eso estas listas están duplicadas acá, a
mano, y deben coincidir EXACTAMENTE con los valores de los Enums del
backend (`PerfilDestinatario`, `FormatoSalida`, `NivelDetalle` en
`backend/app/core/schemas.py`).

Es el trade-off explícito de tener dos servicios de verdad: se gana
independencia de despliegue, se pierde compartir tipos en tiempo de
compilación. Si el equipo prefiere evitar esta duplicación, la alternativa
es publicar `schemas.py` como un paquete Python compartido instalado en
ambos servicios — fuera del alcance de este scaffold de hackathon.
"""

PERFILES_DESTINATARIO = [
    "Principiante / Transición de Carrera",
    "Desarrollador Junior / Semi Senior",
    "Líder Técnico / Arquitecto",
    "Gestor / Ejecutivo (No Técnico)",
]

FORMATOS_SALIDA = [
    "Guía Práctica Paso a Paso (Tutorial)",
    "Flashcards",
    "Quiz Interactivo con Justificaciones",
    "Resumen Ejecutivo (TL;DR)",
    "Guion de Clase / Video",
]

NIVELES_DETALLE = ["Didactico", "Estandar", "Profundo"]
