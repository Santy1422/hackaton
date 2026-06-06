from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    database_url: str = (
        "postgresql+asyncpg://postgres:oJBnSyaXTHsmORVcVfHlDEBqsSJhMlXx@shortline.proxy.rlwy.net:32375/railway"
    )


settings = Settings()
