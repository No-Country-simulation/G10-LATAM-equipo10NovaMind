"""Owner-scoped artifacts; existing shared buckets are never listed by the API."""
import json
import os
from pathlib import Path
from uuid import UUID, uuid4

from app.core.schemas import AlmacenamientoOCI
from app.storage.local_storage import almacenador_local

def storage_for(user_id):
    user_id = str(UUID(user_id))
    def store(solicitud, respuesta):
        run_id = str(uuid4())
        prefix = f'users/{user_id}/{run_id}'
        # Explicit opt-in; missing PEM is not disguised as successful OCI storage.
        if os.getenv('OCI_KEY_FILE'):
            if not Path(os.environ['OCI_KEY_FILE']).is_file():
                raise ValueError('OCI_KEY_FILE está configurado pero el archivo no existe.')
            from app.storage.oci_client import OCIObjectStorageClient
            client = OCIObjectStorageClient()
            bucket = client.client.get_bucket(namespace_name=client.namespace, bucket_name=client.bucket_name).data
            if getattr(bucket, 'public_access_type', None) != 'NoPublicAccess':
                raise ValueError('Los artefactos de usuarios requieren un bucket OCI privado.')
            client._put(prefix + '/original.txt', solicitud.documento_contenido.encode('utf-8'), 'text/plain')
            client._put(prefix + '/package.json', json.dumps(respuesta.model_dump(mode='json'), ensure_ascii=False).encode('utf-8'), 'application/json')
            return AlmacenamientoOCI(bucket=client.bucket_name, objeto_id=prefix + '/package.json', status_upload='completado')
        return almacenador_local(solicitud, respuesta, directorio_base=str(Path('data/outputs') / prefix))
    return store
