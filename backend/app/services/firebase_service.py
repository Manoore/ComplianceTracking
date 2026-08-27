import json
import logging
from typing import Optional
from ..config import settings

logger = logging.getLogger(__name__)
_initialized = False


def _init():
    global _initialized
    if _initialized:
        return True
    if not settings.firebase_service_account_json:
        logger.warning("Firebase not configured — FIREBASE_SERVICE_ACCOUNT_JSON not set")
        return False
    try:
        import firebase_admin
        from firebase_admin import credentials
        cred_dict = json.loads(settings.firebase_service_account_json)
        cred = credentials.Certificate(cred_dict)
        firebase_admin.initialize_app(cred)
        _initialized = True
        return True
    except Exception as e:
        logger.error(f"Firebase init failed: {e}")
        return False


def verify_firebase_token(id_token: str) -> Optional[dict]:
    if not _init():
        return None
    try:
        from firebase_admin import auth as fb_auth
        return fb_auth.verify_id_token(id_token)
    except Exception as e:
        logger.warning(f"Firebase token verification failed: {e}")
        return None
