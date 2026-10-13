from unittest.mock import AsyncMock, patch
from uuid import UUID

import httpx
import pytest
from fastapi.testclient import TestClient

from app.main import app, get_orquestador
from app.auth import Principal, require_user, persist_result
from types import SimpleNamespace

USER_A = '11111111-1111-4111-8111-111111111111'
USER_B = '22222222-2222-4222-8222-222222222222'
client = TestClient(app)

@pytest.mark.parametrize('path,method', [('/api/v1/paquetes','get'),
    ('/api/v1/paquetes/' + USER_A,'get'), ('/api/v1/adaptar','post'), ('/api/v1/adaptar/stream','post')])
def test_private_endpoints_require_login(path, method):
    assert getattr(client, method)(path).status_code == 401

def test_auth_rejects_bad_token(monkeypatch):
    monkeypatch.setenv('SUPABASE_URL', 'https://test.supabase.co')
    monkeypatch.setenv('SUPABASE_PUBLISHABLE_KEY', 'public-test-key')
    with patch('app.auth.httpx.AsyncClient') as factory:
        session = factory.return_value.__aenter__.return_value
        session.get = AsyncMock(return_value=httpx.Response(401))
        assert client.get('/api/v1/paquetes', headers={'Authorization':'Bearer invalid'}).status_code == 401

def test_auth_service_failure_closed(monkeypatch):
    monkeypatch.setenv('SUPABASE_URL', 'https://test.supabase.co')
    monkeypatch.setenv('SUPABASE_PUBLISHABLE_KEY', 'public-test-key')
    with patch('app.auth.httpx.AsyncClient') as factory:
        session = factory.return_value.__aenter__.return_value
        session.get = AsyncMock(side_effect=httpx.ConnectError('offline'))
        assert client.get('/api/v1/paquetes', headers={'Authorization':'Bearer token'}).status_code == 503

def test_auth_verified_user_and_owner_filter(monkeypatch):
    monkeypatch.setenv('SUPABASE_URL', 'https://test.supabase.co')
    monkeypatch.setenv('SUPABASE_PUBLISHABLE_KEY', 'public-test-key')
    with patch('app.auth.httpx.AsyncClient') as factory, patch('app.main.private_query', return_value=[]) as query:
        session = factory.return_value.__aenter__.return_value
        session.get = AsyncMock(return_value=httpx.Response(200, json={'id':USER_A}))
        response = client.get('/api/v1/paquetes?user_id=' + USER_B, headers={'Authorization':'Bearer token'})
        assert response.status_code == 200
        principal, table, params = query.call_args.args
        assert principal.user_id == USER_A and principal.token == 'token'
        assert table == 'learning_packages' and params['user_id'] == 'eq.' + USER_A

def test_other_owners_package_is_not_found():
    app.dependency_overrides[require_user] = lambda: Principal(USER_B, 'test')
    try:
        with patch('app.main.private_query', return_value=[]) as query:
            assert client.get('/api/v1/paquetes/' + USER_A).status_code == 404
            assert query.call_args.args[2]['user_id'] == 'eq.' + USER_B
            assert client.get('/api/v1/paquetes/../../private.json').status_code == 404
    finally:
        app.dependency_overrides.pop(require_user, None)

def test_rag_and_disk_storage_are_owner_scoped():
    with patch('app.main.crear_orquestador') as factory, patch('app.storage.private_storage.almacenador_local') as disk, patch.dict('os.environ', {'OCI_KEY_FILE': ''}):
        get_orquestador(Principal(USER_A, 'test'))
        cfg = factory.call_args.kwargs['config']
        assert cfg.collection_name == 'owner_' + UUID(USER_A).hex
        storage = factory.call_args.kwargs['almacenador']
        storage(object(), object())
        assert USER_A in disk.call_args.kwargs['directorio_base']

def test_backend_persists_extracted_source_and_package_with_verified_owner():
    solicitud = SimpleNamespace(documento_titulo='Test document', documento_contenido='Extracted text',
        perfil_destinatario='Principiante', formato_salida='Flashcards', nicho_sector='General', nivel_detalle='Didáctico')
    respuesta = SimpleNamespace(status='exito', contenido_adaptado=SimpleNamespace(titulo='Test package'),
        model_dump=lambda mode: {'status':'exito'}, persistencia=None)
    with patch('app.auth.private_upsert', return_value={'id':USER_B}) as upsert,          patch('app.auth.private_insert', return_value={}) as insert:
        result = persist_result(Principal(USER_A, 'test'), solicitud, respuesta)
        assert result.persistencia['proveedor'] == 'supabase'
        document = upsert.call_args
        (package,) = insert.call_args_list
        assert document.args[2]['user_id'] == USER_A
        assert document.args[2]['source_text'] == 'Extracted text'
        assert len(document.args[2]['content_hash']) == 64 and document.args[3] == 'user_id,content_hash'
        assert package.args[2]['user_id'] == USER_A
        assert package.args[2]['document_id'] == USER_B
        assert package.args[2]['id'] == result.persistencia['package_id']

def test_error_results_are_not_saved_as_successful_packages():
    with patch('app.auth.private_insert') as insert:
        result = SimpleNamespace(status='error')
        assert persist_result(Principal(USER_A, 'test'), None, result) is result
        insert.assert_not_called()

def test_document_falls_back_to_insert_without_content_hash_migration():
    from fastapi import HTTPException
    from app.auth import ensure_document
    solicitud = SimpleNamespace(documento_titulo='Doc', documento_contenido='Texto')
    with patch('app.auth.private_upsert', side_effect=HTTPException(503, 'x')),          patch('app.auth.private_insert', return_value={'id': USER_B}) as insert:
        assert ensure_document(Principal(USER_A, 'test'), solicitud) == USER_B
        assert 'content_hash' not in insert.call_args.args[2]
