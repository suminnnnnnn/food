# path: backend/app/core/config.py
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    DATABASE_URL: str = "postgresql://user:password@localhost:5432/harness_map"
    APP_NAME: str = "Harness Map API"
    DEBUG: bool = True

    class Config:
        env_file = ".env"


settings = Settings()
