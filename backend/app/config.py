from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")
    database_url: str = "sqlite:///./applypilot.db"
    cors_origins: str = "http://localhost:5173"
    max_upload_mb: int = 5
    llm_provider: str = "anthropic"
    llm_api_key: str = ""
    llm_model: str = ""
    adzuna_app_id: str = ""
    adzuna_app_key: str = ""
    adzuna_country: str = "in"
    greenhouse_boards: str = ""
    lever_companies: str = ""
    max_job_age_days: int = 45
    app_password: str = ""
    secret_key: str = ""
    cookie_secure: bool = False


settings = Settings()
