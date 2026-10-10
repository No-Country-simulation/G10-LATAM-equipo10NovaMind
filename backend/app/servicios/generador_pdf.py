"""
backend/app/servicios/generador_pdf.py
--------------------------------------
Generador de Cuadernillo Pedagógico Estandarizado en PDF (ReportLab)
Hackathon ONE G10 (NovaMind / NuevaMente)

Compila las estaciones educativas generadas:
1. Portada & Metadatos (Perfil, Nicho, Anclaje RAG)
2. Resumen Ninja (Analogía, 5-7 líneas, conceptos clave)
3. Flashcards de Active Recall
4. Guía Práctica Paso a Paso (Tutorial)
5. Diagrama de Flujo / Arquitectura
6. Quiz de Autoevaluación con Justificaciones RAG
(Excluye intencionalmente la estación audiovisual según especificación).
"""

from __future__ import annotations

import io
import logging
from typing import Any, Dict, List, Optional

from reportlab.lib import colors
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import inch
from reportlab.platypus import (
    HRFlowable,
    KeepTogether,
    PageBreak,
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)

logger = logging.getLogger("novamind.generador_pdf")


class GeneradorPDFEducativo:
    """Genera un PDF limpio, profesional y estandarizado con ReportLab."""

    def __init__(self) -> None:
        self.styles = getSampleStyleSheet()
        self._configurar_estilos()

    def _configurar_estilos(self) -> None:
        """Define la paleta y tipografía del informe institucional NovaMind."""
        self.color_primario = colors.HexColor("#0f172a")    # Slate 900
        self.color_acento = colors.HexColor("#4f46e5")      # Indigo 600
        self.color_secundario = colors.HexColor("#0284c7")  # Sky 600
        self.color_fondo_caja = colors.HexColor("#f8fafc")  # Slate 50
        self.color_borde = colors.HexColor("#cbd5e1")       # Slate 300

        self.styles.add(ParagraphStyle(
            name="TituloDocumento",
            parent=self.styles["Heading1"],
            fontName="Helvetica-Bold",
            fontSize=22,
            leading=26,
            textColor=self.color_primario,
            spaceAfter=6,
        ))

        self.styles.add(ParagraphStyle(
            name="Subtitulo",
            parent=self.styles["Normal"],
            fontName="Helvetica",
            fontSize=11,
            leading=15,
            textColor=colors.HexColor("#475569"),
            spaceAfter=12,
        ))

        self.styles.add(ParagraphStyle(
            name="SeccionTitulo",
            parent=self.styles["Heading2"],
            fontName="Helvetica-Bold",
            fontSize=14,
            leading=18,
            textColor=self.color_acento,
            spaceBefore=14,
            spaceAfter=8,
        ))

        self.styles.add(ParagraphStyle(
            name="CuerpoDocente",
            parent=self.styles["Normal"],
            fontName="Helvetica",
            fontSize=10,
            leading=14,
            textColor=colors.HexColor("#1e293b"),
            spaceAfter=6,
        ))

        self.styles.add(ParagraphStyle(
            name="CajaAnalogia",
            parent=self.styles["Normal"],
            fontName="Helvetica-Oblique",
            fontSize=9.5,
            leading=13.5,
            textColor=colors.HexColor("#0f172a"),
        ))

        self.styles.add(ParagraphStyle(
            name="CodigoCLI",
            parent=self.styles["Normal"],
            fontName="Courier",
            fontSize=8.5,
            leading=11,
            textColor=colors.HexColor("#0f172a"),
        ))

    def generar_pdf_estandarizado(
        self,
        titulo: str,
        perfil: str,
        nicho: str,
        contenido: Dict[str, Any],
        anclaje_score: float = 0.95,
    ) -> bytes:
        """Compila las estaciones en un búfer binario PDF en memoria."""
        buffer = io.BytesIO()
        doc = SimpleDocTemplate(
            buffer,
            pagesize=letter,
            rightMargin=36,
            leftMargin=36,
            topMargin=36,
            bottomMargin=36,
        )

        elementos: List[Any] = []

        # -------------------------------------------------------------
        # 1. CABECERA & METADATOS
        # -------------------------------------------------------------
        elementos.append(Paragraph("NOVAMIND / NUEVAMENTE", ParagraphStyle(
            name="BrandBadge",
            fontName="Helvetica-Bold",
            fontSize=9,
            leading=11,
            textColor=self.color_acento,
        )))
        elementos.append(Paragraph(f"Dossier Pedagógico: {titulo}", self.styles["TituloDocumento"]))
        elementos.append(Paragraph(
            f"<b>Perfil:</b> {perfil} | <b>Nicho:</b> {nicho} | <b>Fidelidad RAG:</b> {anclaje_score * 100:.1f}% | <b>OCI Cloud Ready</b>",
            self.styles["Subtitulo"],
        ))
        elementos.append(HRFlowable(width="100%", thickness=1.5, color=self.color_acento, spaceAfter=12))

        # -------------------------------------------------------------
        # 2. INTRODUCCIÓN CONTEXTUALIZADA
        # -------------------------------------------------------------
        intro_texto = contenido.get("introduccion_contextualizada", "")
        if intro_texto:
            elementos.append(Paragraph("1. Introducción y Propósito Pedagógico", self.styles["SeccionTitulo"]))
            elementos.append(Paragraph(intro_texto, self.styles["CuerpoDocente"]))
            elementos.append(Spacer(1, 8))

        # -------------------------------------------------------------
        # 3. RESUMEN NINJA & ANALOGÍA CENTRAL
        # -------------------------------------------------------------
        resumen_data = contenido.get("resumen_ninja", {})
        if isinstance(resumen_data, dict):
            analogia = resumen_data.get("analogia_central", "")
            elementos.append(Paragraph("2. Resumen Ninja & Analogía Central", self.styles["SeccionTitulo"]))
            
            caja_analogia = Table(
                [[Paragraph(f"<b>Analogía Didáctica:</b><br/>{analogia}", self.styles["CajaAnalogia"])]],
                colWidths=[540],
            )
            caja_analogia.setStyle(TableStyle([
                ("BACKGROUND", (0, 0), (-1, -1), self.color_fondo_caja),
                ("BOX", (0, 0), (-1, -1), 1, self.color_borde),
                ("TOPPADDING", (0, 0), (-1, -1), 8),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
                ("LEFTPADDING", (0, 0), (-1, -1), 10),
                ("RIGHTPADDING", (0, 0), (-1, -1), 10),
            ]))
            elementos.append(caja_analogia)
            elementos.append(Spacer(1, 8))

            # Conceptos Clave
            conceptos = resumen_data.get("conceptos_clave", [])
            if conceptos:
                elementos.append(Paragraph("<b>Conceptos Fundamentales:</b>", self.styles["CuerpoDocente"]))
                for c in conceptos:
                    txt = c.get("texto", "") if isinstance(c, dict) else str(c)
                    elementos.append(Paragraph(f"• {txt}", self.styles["CuerpoDocente"]))
                elementos.append(Spacer(1, 8))

        # -------------------------------------------------------------
        # 4. FLASHCARDS DE ACTIVE RECALL
        # -------------------------------------------------------------
        flashcards = contenido.get("flashcards", [])
        if isinstance(flashcards, list) and flashcards:
            elementos.append(Paragraph("3. Flashcards de Active Recall", self.styles["SeccionTitulo"]))
            for idx, fc in enumerate(flashcards[:6], start=1):
                frente = fc.get("frente", "")
                dorso = fc.get("dorso", "")
                pista = fc.get("pista_didactica", "")
                
                tabla_fc = Table([
                    [Paragraph(f"<b>Tarjeta {idx}: {frente}</b>", self.styles["CuerpoDocente"])],
                    [Paragraph(f"<b>Respuesta:</b> {dorso}", self.styles["CuerpoDocente"])],
                    [Paragraph(f"<i>Pista:</i> {pista}", self.styles["CajaAnalogia"]) if pista else Paragraph("", self.styles["Normal"])],
                ], colWidths=[540])
                tabla_fc.setStyle(TableStyle([
                    ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#f1f5f9")),
                    ("BOX", (0, 0), (-1, -1), 0.5, colors.HexColor("#94a3b8")),
                    ("TOPPADDING", (0, 0), (-1, -1), 4),
                    ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
                    ("LEFTPADDING", (0, 0), (-1, -1), 8),
                    ("RIGHTPADDING", (0, 0), (-1, -1), 8),
                ]))
                elementos.append(tabla_fc)
                elementos.append(Spacer(1, 6))

        # -------------------------------------------------------------
        # 5. GUÍA PRÁCTICA PASO A PASO (TUTORIAL)
        # -------------------------------------------------------------
        tutorial = contenido.get("tutorial", [])
        if isinstance(tutorial, list) and tutorial:
            elementos.append(Paragraph("4. Guía Práctica Paso a Paso", self.styles["SeccionTitulo"]))
            for t in tutorial:
                paso_num = t.get("paso", 1)
                t_titulo = t.get("titulo", "")
                desc = t.get("descripcion", "")
                cli = t.get("cli_command", "")
                verif = t.get("verificacion", "")

                filas = [
                    [Paragraph(f"<b>Paso {paso_num}: {t_titulo}</b>", self.styles["CuerpoDocente"])],
                    [Paragraph(desc, self.styles["CuerpoDocente"])],
                ]
                if cli:
                    filas.append([Paragraph(f"<b>Comando / Acción:</b> {cli}", self.styles["CodigoCLI"])])
                if verif:
                    filas.append([Paragraph(f"<b>Verificación:</b> {verif}", self.styles["CajaAnalogia"])])

                tabla_t = Table(filas, colWidths=[540])
                tabla_t.setStyle(TableStyle([
                    ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#fafafa")),
                    ("BOX", (0, 0), (-1, -1), 0.5, colors.HexColor("#cbd5e1")),
                    ("TOPPADDING", (0, 0), (-1, -1), 4),
                    ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
                    ("LEFTPADDING", (0, 0), (-1, -1), 8),
                    ("RIGHTPADDING", (0, 0), (-1, -1), 8),
                ]))
                elementos.append(tabla_t)
                elementos.append(Spacer(1, 6))

        # -------------------------------------------------------------
        # 6. DIAGRAMA EXPLICATIVO (MERMAID)
        # -------------------------------------------------------------
        diagrama = contenido.get("diagrama_mermaid", "")
        if diagrama:
            elementos.append(Paragraph("5. Diagrama de Arquitectura y Flujo", self.styles["SeccionTitulo"]))
            tabla_diag = Table([
                [Paragraph(f"<b>Sintaxis Arquitectónica (Mermaid.js):</b><br/><pre>{diagrama}</pre>", self.styles["CodigoCLI"])],
            ], colWidths=[540])
            tabla_diag.setStyle(TableStyle([
                ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#f8fafc")),
                ("BOX", (0, 0), (-1, -1), 1, colors.HexColor("#38bdf8")),
                ("TOPPADDING", (0, 0), (-1, -1), 6),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
                ("LEFTPADDING", (0, 0), (-1, -1), 8),
                ("RIGHTPADDING", (0, 0), (-1, -1), 8),
            ]))
            elementos.append(tabla_diag)
            elementos.append(Spacer(1, 8))

        # -------------------------------------------------------------
        # 7. QUIZ INTERACTIVO Y JUSTIFICACIONES RAG
        # -------------------------------------------------------------
        quiz = contenido.get("quiz", [])
        if isinstance(quiz, list) and quiz:
            elementos.append(Paragraph("6. Quiz de Autoevaluación & Justificación RAG", self.styles["SeccionTitulo"]))
            for idx, q in enumerate(quiz, start=1):
                preg = q.get("pregunta", "")
                opciones = q.get("opciones", [])
                correcta = q.get("respuesta_correcta", 0)
                justif = q.get("justificacion_rag", "")
                cita = q.get("cita_fuente", "")

                filas_q = [
                    [Paragraph(f"<b>Pregunta {idx}: {preg}</b>", self.styles["CuerpoDocente"])],
                ]
                for o_idx, opc in enumerate(opciones):
                    marca = "✓ " if o_idx == correcta else "  "
                    peso = "<b>" if o_idx == correcta else ""
                    cierre = " (Correcta)</b>" if o_idx == correcta else ""
                    filas_q.append([Paragraph(f"{marca}{chr(65+o_idx)}) {peso}{opc}{cierre}", self.styles["CuerpoDocente"])])

                if justif:
                    filas_q.append([Paragraph(f"<b>Justificación RAG:</b> {justif}", self.styles["CajaAnalogia"])])
                if cita:
                    filas_q.append([Paragraph(f"<b>Cita Fuente:</b> \"{cita}\"", self.styles["CajaAnalogia"])])

                tabla_q = Table(filas_q, colWidths=[540])
                tabla_q.setStyle(TableStyle([
                    ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#f8fafc")),
                    ("BOX", (0, 0), (-1, -1), 0.5, colors.HexColor("#a855f7")),
                    ("TOPPADDING", (0, 0), (-1, -1), 4),
                    ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
                    ("LEFTPADDING", (0, 0), (-1, -1), 8),
                    ("RIGHTPADDING", (0, 0), (-1, -1), 8),
                ]))
                elementos.append(tabla_q)
                elementos.append(Spacer(1, 6))

        # Pie institucional
        elementos.append(Spacer(1, 14))
        elementos.append(HRFlowable(width="100%", thickness=0.5, color=colors.HexColor("#94a3b8"), spaceAfter=8))
        elementos.append(Paragraph(
            "Generado automáticamente por NovaMind / NuevaMente — Simulación Hackathon ONE G10. Respaldado en Oracle Cloud Infrastructure.",
            ParagraphStyle(
                name="Pie",
                fontName="Helvetica",
                fontSize=8,
                textColor=colors.HexColor("#64748b"),
                alignment=1,
            ),
        ))

        doc.build(elementos)
        buffer.seek(0)
        pdf_bytes = buffer.getvalue()
        logger.info("PDF educativo generado exitosamente (%d bytes).", len(pdf_bytes))
        return pdf_bytes
