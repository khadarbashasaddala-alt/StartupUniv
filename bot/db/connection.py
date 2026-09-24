import ssl
import asyncpg
from typing import Optional
from config import settings

_pool: Optional[asyncpg.Pool] = None


async def get_pool() -> asyncpg.Pool:
    global _pool
    if _pool is None:
        dsn = settings.database_url
        kwargs: dict = {
            "min_size": 2,
            "max_size": 10,
            "timeout": 10,
            "command_timeout": 30,
        }

        if "rds.amazonaws.com" in dsn or "sslmode" in dsn:
            ctx = ssl.create_default_context()
            ctx.check_hostname = False
            ctx.verify_mode = ssl.CERT_NONE
            kwargs["ssl"] = ctx
            dsn = dsn.replace("?sslmode=require", "").replace("&sslmode=require", "")

        _pool = await asyncpg.create_pool(dsn, **kwargs)
    return _pool


async def close_pool():
    global _pool
    if _pool:
        await _pool.close()
        _pool = None
