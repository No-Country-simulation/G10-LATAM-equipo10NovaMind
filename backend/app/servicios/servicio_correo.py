"""
backend/app/servicios/servicio_correo.py
----------------------------------------
Servicio de Despacho Asíncrono de Reportes Pedagógicos por Correo Electrónico
Hackathon ONE G10 (NovaMind / NuevaMente)

Capacidades:
- Envío silencioso en segundo plano con adjunto PDF estandarizado.
- Persistencia de respaldo en OCI Object Storage Always Free.
- Modo Simulación / Desarrollo resiliente si no hay credenciales SMTP configuradas.
"""

from __future__ import annotations

import email
import logging
import os
import smtplib
from email.mime.application import MIMEApplication
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from typing import Any, Dict, Optional

from app.servicios.generador_pdf import GeneradorPDFEducativo
from app.storage.oci_client import OCIObjectStorageClient, _slugify

logger = logging.getLogger("novamind.servicio_correo")


class ServicioCorreo:
    """Gestiona el envío silencioso de dossiers educativos en PDF."""

    def __init__(self) -> None:
        self.smtp_host = os.getenv("SMTP_HOST")
        self.smtp_port = int(os.getenv("SMTP_PORT", "587"))
        self.smtp_user = os.getenv("SMTP_USER")
        self.smtp_password = os.getenv("SMTP_PASSWORD")
        self.generador_pdf = GeneradorPDFEducativo()
        try:
            self.cliente_oci = OCIObjectStorageClient()
        except Exception:
            self.cliente_oci = None

    def enviar_dossier_pedagogico_silencioso(
        self,
        destinatario: str,
        titulo_documento: str,
        perfil: str,
        nicho: str,
        contenido_adaptado: Dict[str, Any],
        doc_id: Optional[str] = None,
        anclaje_score: float = 0.95,
    ) -> Dict[str, Any]:
        """
        Genera el PDF estandarizado de las estaciones (sin audiovisual),
        lo respalda en OCI Object Storage y lo envía por correo electrónico.
        """
        slug = doc_id or f"doc-{_slugify(titulo_documento)[:12]}"
        logger.info("[servicio_correo] Iniciando procesamiento silencioso de PDF para '%s'...", destinatario)

        # 1. Compilación del PDF en memoria
        pdf_bytes = self.generador_pdf.generar_pdf_estandarizado(
            titulo=titulo_documento,
            perfil=perfil,
            nicho=nicho,
            contenido=contenido_adaptado,
            anclaje_score=anclaje_score,
        )

        # 2. Respaldo silencioso en OCI Object Storage
        objeto_oci_id = f"reportes-pdf/dossier-{slug}.pdf"
        if self.cliente_oci:
            try:
                self.cliente_oci.subir_documento_original(
                    doc_id=slug,
                    extension=".pdf",
                    data=pdf_bytes,
                )
                logger.info("[servicio_correo] PDF respaldado en OCI: %s (%d bytes)", objeto_oci_id, len(pdf_bytes))
            except Exception as exc:
                logger.warning("[servicio_correo] Fallo al respaldar PDF en OCI: %s", exc)

        # 3. Envío SMTP o Modo Simulación
        if not self.smtp_host or not self.smtp_user:
            logger.info(
                "[servicio_correo] SMTP no configurado; ejecutando en modo SIMULACIÓN SILENCIOSA. "
                "Dossier PDF generado (%d bytes) para destinatario: %s",
                len(pdf_bytes),
                destinatario,
            )
            return {
                "status": "simulado",
                "destinatario": destinatario,
                "bytes_pdf": len(pdf_bytes),
                "objeto_oci": objeto_oci_id,
                "mensaje": "Dossier PDF generado y archivado en OCI Object Storage.",
            }

        try:
            msg = MIMEMultipart()
            msg["From"] = self.smtp_from
            msg["To"] = destinatario
            msg["Subject"] = f"🎓 Tu Dossier Educativo NovaMind: {titulo_documento}"

            cuerpo = (
                f"Hola,\n\n"
                f"Adjuntamos el Dossier Pedagógico Oficial generado para '{titulo_documento}', "
                f"personalizado para tu perfil ({perfil}) en el sector {nicho}.\n\n"
                f"Estaciones incluidas:\n"
                f"1. Resumen Ninja & Analogía Didáctica\n"
                f"2. Flashcards de Active Recall\n"
                f"3. Guía Práctica Paso a Paso (Tutorial)\n"
                f"4. Diagrama de Arquitectura y Flujo\n"
                f"5. Quiz Interactivo con Justificaciones RAG\n\n"
                f"Generado por NovaMind Multi-Agente con respaldo en Oracle Cloud Infrastructure Always Free.\n"
            )
            msg.attach(MIMEText(cuerpo, "plain"))

            adjunto = MIMEApplication(pdf_bytes, _subtype="pdf")
            nombre_archivo = f"Dossier_{_slugify(titulo_documento)[:18]}.pdf"
            adjunto.add_header("Content-Disposition", "attachment", filename=nombre_archivo)
            msg.attach(adjunto)

            with smtplib.SMTP(self.smtp_host, self.smtp_port, timeout=10) as servidor:
                servidor.starttls()
                servidor.login(self.smtp_user, self.smtp_password or "")
                servidor.sendmail(self.smtp_from, [destinatario], msg.as_string())

            logger.info("[servicio_correo] Correo enviado exitosamente a %s", destinatario)
            return {
                "status": "enviado",
                "destinatario": destinatario,
                "bytes_pdf": len(pdf_bytes),
                "objeto_oci": objeto_oci_id,
            }
        except Exception as exc:
            logger.error("[servicio_correo] Error al enviar correo SMTP a %s: %s", destinatario, exc)
            return {
                "status": "error_smtp",
                "destinatario": destinatario,
                "error": str(exc),
                "bytes_pdf": len(pdf_bytes),
                "objeto_oci": objeto_oci_id,
            }
