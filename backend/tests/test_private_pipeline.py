from types import SimpleNamespace
from unittest.mock import Mock, patch

import pytest
from fastapi import HTTPException
from fastapi.testclient import TestClient

from app.auth import Principal, require_user
from app.integration.private_pipeline import PrivateCadena, PrivateCorreo, _OwnerPDFStorage, notification_recipient
from app.main import app

OWNER = '11111111-1111-4111-8111-111111111111'


def test_notification_requires_explicit_own_verified_email():
    principal = Principal(OWNER, 'token', 'owner@example.com')
    assert notification_recipient(principal, None) == ''
    assert notification_recipient(principal, ' OWNER@example.com ') == 'owner@example.com'
    with pytest.raises(HTTPException) as error:
        notification_recipient(principal, 'someone-else@example.com')
    assert error.value.status_code == 403


def test_new_pipeline_never_calls_legacy_shared_storage():
    chain = PrivateCadena(OWNER)
    with patch('app.agentes.cadena_colaborativa.OCIObjectStorageClient') as shared:
        assert chain._persistir_en_oci().status_upload == 'omitido'
        shared.assert_not_called()


def test_new_pipeline_stores_complete_response_for_verified_owner():
    response = SimpleNamespace(status='exito', almacenamiento_oci=None, advertencias=[])
    with patch('app.agentes.cadena_colaborativa.CadenaColaborativaMultiModelo.ejecutar', return_value=response), \
         patch('app.integration.private_pipeline.storage_for') as storage:
        chain = PrivateCadena(OWNER)
        assert chain.ejecutar('source') is response
        storage.assert_called_once_with(OWNER)
        storage.return_value.assert_called_once_with('source', response)


def test_pdf_storage_is_private_and_owner_scoped():
    client = Mock()
    client.client.get_bucket.return_value.data.public_access_type = 'NoPublicAccess'
    adapter = _OwnerPDFStorage(client, OWNER)
    result = adapter.subir_documento_original('../../legacy', '.pdf', b'%PDF-test')
    assert result.startswith(f'users/{OWNER}/') and result.endswith('/dossier.pdf')
    client._put.assert_called_once_with(result, b'%PDF-test', 'application/pdf')
    assert adapter.uploaded


def test_pdf_storage_rejects_public_bucket():
    client = Mock()
    client.client.get_bucket.return_value.data.public_access_type = 'ObjectRead'
    adapter = _OwnerPDFStorage(client, OWNER)
    with pytest.raises(ValueError):
        adapter.subir_documento_original('source', '.pdf', b'%PDF-test')
    client._put.assert_not_called()
    assert not adapter.uploaded


def test_pdf_without_recipient_does_not_send_mail():
    with patch('app.servicios.servicio_correo.OCIObjectStorageClient', side_effect=ValueError), \
         patch('app.servicios.servicio_correo.ServicioCorreo.enviar_dossier_pedagogico_silencioso', return_value={}) as send:
        service = PrivateCorreo(OWNER)
        service.smtp_host = 'smtp.test'
        result = service.enviar_dossier_pedagogico_silencioso('', contenido_adaptado={})
        assert service.smtp_host is None
        assert result['objeto_oci'] is None


@pytest.mark.parametrize('path', ['/api/v1/adaptar', '/api/v1/adaptar/stream'])
def test_notification_to_other_email_is_rejected_before_generation(path):
    app.dependency_overrides[require_user] = lambda: Principal(OWNER, 'token', 'owner@example.com')
    try:
        with patch('app.main.get_cadena_colaborativa') as generation:
            result = TestClient(app).post(path, data={
                'texto_directo': 'A valid document about cloud infrastructure and safe private storage.',
                'perfil_destinatario': 'Principiante', 'formato_salida': 'Flashcards',
                'email_notificacion': 'other@example.com'})
            assert result.status_code == 403
            generation.assert_not_called()
    finally:
        app.dependency_overrides.pop(require_user, None)
