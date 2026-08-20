from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    database_url: str = "postgresql+asyncpg://nexigent:nexigent@localhost:5433/nexigent"
    redis_url: str = "redis://localhost:6379/0"
    groq_api_key: str = ""
    groq_base_url: str = "https://api.groq.com/openai/v1"
    environment: str = "development"
    admin_api_key: str = "change-me-before-deploying"
    jwt_secret: str = "nexigent-jwt-secret-key-change-in-production"
    jwt_algorithm: str = "HS256"
    jwt_expiration_minutes: int = 1440

    cors_origins: str = "*"
    
    def model_post_init(self, __context) -> None:
        if self.environment == "production":
            if self.admin_api_key == "change-me-before-deploying" or len(self.admin_api_key) < 16:
                raise ValueError("ADMIN_API_KEY must be strong and not default in production.")
            if self.jwt_secret == "nexigent-jwt-secret-key-change-in-production" or len(self.jwt_secret) < 32:
                raise ValueError("JWT_SECRET must be strong and not default in production.")

settings = Settings()
