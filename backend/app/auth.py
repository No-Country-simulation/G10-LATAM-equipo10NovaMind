"""Validate bearer tokens against Supabase Auth; never trust a client user_id."""
import os
from dataclasses import dataclass
from uuid import UUID

import httpx
from dotenv import load_dotenv
from fastapi import Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

load_dotenv()
bearer = HTTPBearer(auto_error=False)

@dataclass(frozen=True)
class Principal:
    user_id: str
    token: str
    email: str = ''

def settings():
    url = os.getenv('SUPABASE_URL', '').rstrip('/')
    key = os.getenv('SUPABASE_PUBLISHABLE_KEY', '')
    if not url.startswith('https://') or not key:
        raise HTTPException(503, 'Supabase no está configurado en el servidor.')
    return url, key

async def require_user(credentials: HTTPAuthorizationCredentials = Depends(bearer)) -> Principal:
    if not credentials or credentials.scheme.lower() != 'bearer':
        raise HTTPException(401, 'Se requiere iniciar sesión.', headers={'WWW-Authenticate': 'Bearer'})
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

def persist_result(principal: Principal, solicitud, respuesta):
    """Persist on the server too, even if the browser closes during generation."""
    if respuesta.status == 'error':
        return respuesta
    document = private_insert(principal, 'documents', {
        'user_id': principal.user_id, 'title': solicitud.documento_titulo,
        'source_text': solicitud.documento_contenido, 'storage_provider': 'supabase',
    })
    from uuid import uuid4
    package_id = str(uuid4())
    respuesta.persistencia = {'proveedor': 'supabase', 'package_id': package_id}
    private_insert(principal, 'learning_packages', {
        'id': package_id, 'user_id': principal.user_id, 'document_id': document['id'],
        'title': respuesta.contenido_adaptado.titulo, 'payload': respuesta.model_dump(mode='json'),
        'parameters': {'application': 'fullstack-v2', 'source': 'backend',
            'profile': solicitud.perfil_destinatario, 'format': solicitud.formato_salida,
            'niche': solicitud.nicho_sector, 'detail': solicitud.nivel_detalle},
        'storage_provider': 'supabase',
    })
    return respuesta
