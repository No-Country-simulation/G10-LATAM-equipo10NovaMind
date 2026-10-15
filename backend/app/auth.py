"""Validate bearer tokens against Supabase Auth; never trust a client user_id."""
import logging
import os
from dataclasses import dataclass
from uuid import UUID, uuid4

import httpx
from dotenv import load_dotenv
from fastapi import Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from app.core.schemas import huella_documento

load_dotenv()
bearer = HTTPBearer(auto_error=False)
logger = logging.getLogger('nuevamente.auth')

GUEST_TOKEN = 'guest-demo-token'
GUEST_USER_ID = '00000000-0000-0000-0000-000000000000'


@dataclass(frozen=True)
class Principal:
    user_id: str
    token: str
    email: str = ''
    is_guest: bool = False


def guest_mode_enabled() -> bool:
    """
    El token de invitado es público (viaja en el bundle del frontend), así que solo
    se acepta si se habilita explícitamente o fuera de producción.
    """
    explicito = os.getenv('PERMITIR_MODO_INVITADO')
    if explicito is not None:
        return explicito.strip().lower() in ('1', 'true', 'yes')
    return os.getenv('APP_ENV', 'dev').strip().lower() != 'prod'

def settings():
    url = os.getenv('SUPABASE_URL', '').rstrip('/')
    key = os.getenv('SUPABASE_PUBLISHABLE_KEY', '')
    if not url.startswith('https://') or not key:
        raise HTTPException(503, 'Supabase no está configurado en el servidor.')
    return url, key

async def require_user(credentials: HTTPAuthorizationCredentials = Depends(bearer)) -> Principal:
    if not credentials or credentials.scheme.lower() != 'bearer':
        raise HTTPException(401, 'Se requiere iniciar sesión.', headers={'WWW-Authenticate': 'Bearer'})

    if credentials.credentials == GUEST_TOKEN:
        if not guest_mode_enabled():
            raise HTTPException(401, 'El modo invitado está deshabilitado en este servidor.',
                                headers={'WWW-Authenticate': 'Bearer'})
        return Principal(GUEST_USER_ID, GUEST_TOKEN, 'invitado@nuevamente.local', is_guest=True)

    url, key = settings()
    try:
        async with httpx.AsyncClient(timeout=10, trust_env=False) as client:
            result = await client.get(url + '/auth/v1/user', headers={
                'apikey': key, 'Authorization': 'Bearer ' + credentials.credentials,
            })
    except httpx.HTTPError:
        raise HTTPException(503, 'No se pudo verificar la sesión.') from None
    if result.status_code in (401, 403):
        raise HTTPException(401, 'Sesión inválida o expirada.', headers={'WWW-Authenticate': 'Bearer'})
    if result.status_code != 200:
        raise HTTPException(503, 'El servicio de autenticación no está disponible.')
    try:
        user_id = str(UUID(result.json()['id']))
    except (ValueError, KeyError, TypeError):
        raise HTTPException(503, 'Respuesta de autenticación inválida.') from None
    return Principal(user_id, credentials.credentials, result.json().get('email') or '')

def private_query(principal: Principal, table: str, params: dict):
    """Forward the user's JWT so Postgres RLS also enforces ownership."""
    url, key = settings()
    try:
        result = httpx.get(url + '/rest/v1/' + table, params=params, headers={
            'apikey': key, 'Authorization': 'Bearer ' + principal.token,
        }, timeout=15, trust_env=False)
    except httpx.HTTPError:
        raise HTTPException(503, 'No se pudo consultar el historial.') from None
    if result.status_code in (401, 403):
        raise HTTPException(401, 'La sesión ya no permite consultar el historial.')
    if result.status_code != 200:
        raise HTTPException(503, 'El historial no está disponible.')
    return result.json()

def private_insert(principal: Principal, table: str, payload: dict):
    url, key = settings()
    try:
        result = httpx.post(url + '/rest/v1/' + table, json=payload, headers={
            'apikey': key, 'Authorization': 'Bearer ' + principal.token,
            'Prefer': 'return=representation',
        }, timeout=20, trust_env=False)
    except httpx.HTTPError:
        raise HTTPException(503, 'No se pudo guardar el resultado en Supabase.') from None
    if result.status_code not in (200, 201):
        raise HTTPException(503, 'Supabase rechazó el guardado; vuelve a iniciar sesión y reintenta.')
    return result.json()[0]

def private_upsert(principal: Principal, table: str, payload: dict, on_conflict: str):
    url, key = settings()
    try:
        result = httpx.post(url + '/rest/v1/' + table, params={'on_conflict': on_conflict}, json=payload, headers={
            'apikey': key, 'Authorization': 'Bearer ' + principal.token,
            'Prefer': 'resolution=merge-duplicates,return=representation',
        }, timeout=20, trust_env=False)
    except httpx.HTTPError:
        raise HTTPException(503, 'No se pudo guardar el resultado en Supabase.') from None
    if result.status_code not in (200, 201):
        raise HTTPException(503, 'Supabase rechazó el guardado; vuelve a iniciar sesión y reintenta.')
    return result.json()[0]

def ensure_document(principal: Principal, solicitud) -> str:
    """One `documents` row per owner and content (migration 202610120001); returns its id."""
    payload = {
        'user_id': principal.user_id, 'title': solicitud.documento_titulo,
        'source_text': solicitud.documento_contenido, 'storage_provider': 'supabase',
    }
    try:
        return private_upsert(principal, 'documents', {
            **payload, 'content_hash': huella_documento(solicitud.documento_titulo, solicitud.documento_contenido),
        }, 'user_id,content_hash')['id']
    except HTTPException:
        # Database without the content_hash migration yet: keep the previous behavior.
        logger.warning('documents.content_hash unavailable; inserting a new document row.')
        return private_insert(principal, 'documents', payload)['id']

def persist_result(principal: Principal, solicitud, respuesta):
    """Persist on the server too, even if the browser closes during generation."""
    if respuesta.status == 'error':
        return respuesta
    if principal.is_guest:
        respuesta.persistencia = {'proveedor': 'local-guest', 'package_id': f'pkg-guest-{uuid4().hex[:8]}'}
        return respuesta
    document_id = ensure_document(principal, solicitud)
    package_id = str(uuid4())
    respuesta.persistencia = {'proveedor': 'supabase', 'package_id': package_id}
    private_insert(principal, 'learning_packages', {
        'id': package_id, 'user_id': principal.user_id, 'document_id': document_id,
        'title': respuesta.contenido_adaptado.titulo, 'payload': respuesta.model_dump(mode='json'),
        'parameters': {'application': 'fullstack-v2', 'source': 'backend',
            'profile': solicitud.perfil_destinatario, 'format': solicitud.formato_salida,
            'niche': solicitud.nicho_sector, 'detail': solicitud.nivel_detalle},
        'storage_provider': 'supabase',
    })
    return respuesta
