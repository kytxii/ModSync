from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    database_url: str
    secret_key: str
    google_client_id: str
    google_client_secret: str
    frontend_url: str = "http://localhost:5173"
    app_env: str = "development"


settings = Settings()
