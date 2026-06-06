from pydantic import BaseModel


class ManagementStateResponse(BaseModel):
    spark_available: bool = False
    tps: float | None = None
    memory_used_mb: int | None = None
    memory_max_mb: int | None = None
    time_ticks: int | None = None
    players: list[str] = []
    player_count: int = 0
    player_max: int = 20
