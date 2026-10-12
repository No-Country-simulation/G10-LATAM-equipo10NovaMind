from types import SimpleNamespace
from unittest.mock import Mock, patch

import pytest

from app.storage.private_storage import storage_for
from app.storage.oci_client import OCIObjectStorageClient

OWNER = '11111111-1111-4111-8111-111111111111'


def test_invalid_owner_is_rejected():
    with pytest.raises(ValueError):
        storage_for('../../someone-else')


def test_configured_missing_pem_does_not_silently_use_disk(monkeypatch):
    monkeypatch.setenv('OCI_KEY_FILE', 'missing-private-test.pem')
    with patch('app.storage.private_storage.almacenador_local') as disk:
        with pytest.raises(ValueError):
            storage_for(OWNER)(object(), object())
        disk.assert_not_called()


@pytest.mark.parametrize('access', ['ObjectRead', 'ObjectReadWithoutList'])
def test_public_bucket_receives_no_private_documents(monkeypatch, tmp_path, access):
    pem = tmp_path / 'key.pem'
    pem.touch()
    monkeypatch.setenv('OCI_KEY_FILE', str(pem))
    with patch('app.storage.oci_client.OCIObjectStorageClient') as factory:
        client = factory.return_value
        client.client.get_bucket.return_value.data.public_access_type = access
        with pytest.raises(ValueError):
            storage_for(OWNER)(object(), object())
        client._put.assert_not_called()


def test_private_bucket_uploads_owner_scoped_text_and_json(monkeypatch, tmp_path):
    pem = tmp_path / 'key.pem'
    pem.touch()
    monkeypatch.setenv('OCI_KEY_FILE', str(pem))
    with patch('app.storage.oci_client.OCIObjectStorageClient') as factory:
        client = factory.return_value
        client.bucket_name = 'private-test'
        client.client.get_bucket.return_value.data.public_access_type = 'NoPublicAccess'
        response = SimpleNamespace(model_dump=lambda mode: {'test_only': True})
        result = storage_for(OWNER)(SimpleNamespace(documento_contenido='Texto de prueba'), response)
        original, package = client._put.call_args_list
        assert original.args[0].startswith(f'users/{OWNER}/')
        assert original.args[0].endswith('/original.txt')
        assert original.args[1] == 'Texto de prueba'.encode('utf-8')
        assert package.args[0] == result.objeto_id
        assert package.args[2] == 'application/json'
        assert result.status_upload == 'completado'


def test_explicit_credentials_override_local_oci_profile(monkeypatch):
    for name, value in {'OCI_NAMESPACE': 'test', 'OCI_BUCKET_NAME': 'test',
                        'OCI_USER': 'test-user', 'OCI_TENANCY': 'test-tenancy',
                        'OCI_FINGERPRINT': 'test-fingerprint', 'OCI_KEY_FILE': 'test.pem'}.items():
        monkeypatch.setenv(name, value)
    with patch('app.storage.oci_client.os.path.exists', return_value=True), \
         patch('app.storage.oci_client.oci.config.from_file') as profile, \
         patch('app.storage.oci_client.oci.object_storage.ObjectStorageClient') as factory:
        OCIObjectStorageClient()
        profile.assert_not_called()
        assert factory.call_args.args[0]['user'] == 'test-user'
        assert factory.call_args.kwargs['timeout'] == (5, 30)
