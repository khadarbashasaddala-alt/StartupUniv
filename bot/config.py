from pydantic_settings import BaseSettings
from typing import List


class Settings(BaseSettings):
    openai_api_key: str = ""
    database_url: str = ""
    cors_origins: List[str] = [
        "http://localhost:5173",
        "http://localhost:5000",
        "http://localhost:3000",
        "https://www.startupvarsity.com",
        "https://startupvarsity.com",
        "https://startupvarsity.rooman.net",
    ]
    bot_port: int = 4001

    model_config = {"env_file": ".env", "extra": "ignore"}


settings = Settings()
