import logging
from typing import Optional
from ..config import settings

logger = logging.getLogger(__name__)

# Google's public cert endpoint for Firebase ID tokens
_CERTS_URL = "https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com"
_certs_cache: dict = {}


def _get_certs() -> dict:
    """Fetch Firebase public certs (cached in memory)."""
    global _certs_cache
    if _certs_cache:
        return _certs_cache
    try:
        import httpx
        r = httpx.get(_CERTS_URL, timeout=10)
        r.raise_for_status()
        _certs_cache = r.json()
        return _certs_cache
    except Exception as e:
        logger.error(f"Failed to fetch Firebase certs: {e}")
        return {}


def verify_firebase_token(id_token: str) -> Optional[dict]:
    """
    Verify a Firebase ID token using Google's public keys and python-jose.
    Returns the decoded payload dict, or None if invalid.
    No firebase-admin SDK required.
    """
    project_id = settings.firebase_project_id or "complinow"
    try:
        from jose import jwt, JWTError
        from jose.backends import RSAKey
        import json

        certs = _get_certs()
        if not certs:
            logger.warning("No Firebase certs available — cannot verify token")
            return None

        # Try each cert (kid in header selects the right one, jose handles it)
        header = jwt.get_unverified_header(id_token)
        kid = header.get("kid")
        cert_pem = certs.get(kid)
        if not cert_pem:
            logger.warning(f"Firebase token kid {kid!r} not found in certs")
            return None

        payload = jwt.decode(
            id_token,
            cert_pem,
            algorithms=["RS256"],
            audience=project_id,
            issuer=f"https://securetoken.google.com/{project_id}",
        )
        return payload
    except Exception as e:
        logger.warning(f"Firebase token verification failed: {e}")
        return None
