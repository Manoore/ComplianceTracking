from sqlalchemy import create_engine, event
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from .config import settings

_is_sqlite = "sqlite" in settings.database_url
_is_postgres = "postgresql" in settings.database_url or "postgres" in settings.database_url

# Strip channel_binding param — not supported by psycopg2
_db_url = settings.database_url
if _is_postgres and "channel_binding" in _db_url:
    import urllib.parse as _up
    _parsed = _up.urlparse(_db_url)
    _qs = {k: v for k, v in _up.parse_qsl(_parsed.query) if k != "channel_binding"}
    _db_url = _parsed._replace(query=_up.urlencode(_qs)).geturl()

engine = create_engine(
    _db_url,
    connect_args={"check_same_thread": False} if _is_sqlite else ({"sslmode": "require"} if _is_postgres else {}),
    pool_pre_ping=True,
    pool_size=5,
    max_overflow=10,
)

if "sqlite" in settings.database_url:
    @event.listens_for(engine, "connect")
    def set_sqlite_pragma(dbapi_connection, connection_record):
        cursor = dbapi_connection.cursor()
        cursor.execute("PRAGMA journal_mode=WAL")
        cursor.execute("PRAGMA foreign_keys=ON")
        cursor.close()

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
