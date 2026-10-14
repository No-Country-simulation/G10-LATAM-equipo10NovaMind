"""Preserve the team's generation/PDF logic; scope its storage to a verified owner."""
from uuid import UUID, uuid4

from fastapi import HTTPException

from app.agentes.cadena_colaborativa import CadenaColaborativaMultiModelo
from app.core.schemas import AlmacenamientoOCI
from app.servicios.servicio_correo import ServicioCorreo
from app.storage.private_storage import storage_for


def notification_recipient(principal, requested):
    # No automatic delivery of private documents to a default or arbitrary mailbox.
    if not requested or not requested.strip():
        return ''
    recipient = requested.strip().lower()
    if not principal.email or recipient != principal.email.lower():
        raise HTTPException(403, 'El dossier solo puede enviarse al correo de la cuenta autenticada.')
    return recipient


class PrivateCadena(CadenaColaborativaMultiModelo):
    def __init__(self, owner):
        super().__init__()
        self.owner = str(UUID(owner))

    def _persistir_en_oci(self, *args, **kwargs):
        # The original generation code still runs, but never writes shared paths.
        return AlmacenamientoOCI(status_upload='omitido')

    def ejecutar(self, solicitud, on_progress=None):
        response = super().ejecutar(solicitud, on_progress)
        if response.status != 'error':
            try:
                response.almacenamiento_oci = storage_for(self.owner)(solicitud, response)
            except Exception:
                response.almacenamiento_oci = AlmacenamientoOCI(status_upload='error')
                response.advertencias.append('No se pudo guardar el artefacto privado en OCI.')
        return response


class _OwnerPDFStorage:
    def __init__(self, client, owner):
        self.client = client
        self.object_id = f'users/{UUID(owner)}/{uuid4()}/dossier.pdf'
        self.uploaded = False

    def subir_documento_original(self, doc_id, extension, data):
        bucket = self.client.client.get_bucket(namespace_name=self.client.namespace,
                                              bucket_name=self.client.bucket_name).data
        if bucket.public_access_type != 'NoPublicAccess':
            raise ValueError('El dossier requiere un bucket privado.')
        self.client._put(self.object_id, data, 'application/pdf')
        self.uploaded = True
        return self.object_id


class PrivateCorreo(ServicioCorreo):
    def __init__(self, owner):
        super().__init__()
        self.owner_storage = None
        if self.cliente_oci:
            self.owner_storage = _OwnerPDFStorage(self.cliente_oci, owner)
        self.cliente_oci = self.owner_storage

    def enviar_dossier_pedagogico_silencioso(self, destinatario, **kwargs):
        if not destinatario:
            self.smtp_host = None  # Generate/archive PDF, but do not send mail without opt-in.
        result = super().enviar_dossier_pedagogico_silencioso(destinatario=destinatario, **kwargs)
        # The parent's receipt uses a legacy path, not the actual owner-scoped object.
        result['objeto_oci'] = self.owner_storage.object_id if self.owner_storage and self.owner_storage.uploaded else None
        result['mensaje'] = 'Dossier PDF generado; el respaldo OCI se indica solo si la subida fue correcta.'
        return result
