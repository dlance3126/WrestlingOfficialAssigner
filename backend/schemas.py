from datetime import datetime
from typing import List, Optional, Literal

from pydantic import BaseModel, EmailStr, Field, field_validator


AREA_CHOICES = [
    "Area 1",
    "Area 2",
    "Area 3",
    "Area 4",
    "Area 5",
    "Area 6/8",
    "Area 7",
    "Area 9",
    "Area 10",
]


class UserCreate(BaseModel):
    email: EmailStr
    password: str


class UserOut(BaseModel):
    id: int
    email: EmailStr
    is_admin: bool
    area: str

    class Config:
        from_attributes = True


class TeamIn(BaseModel):
    name: str
    tier: int

    @field_validator("tier")
    @classmethod
    def validate_tier(cls, value: int) -> int:
        if value not in (1, 2, 3, 4):
            raise ValueError("Tier must be between 1 and 4")
        return value


class TeamOut(BaseModel):
    id: int
    name: str
    tier: int
    area: str

    class Config:
        from_attributes = True


class OfficialIn(BaseModel):
    name: str
    tier: int
    unavailable_dates: Optional[List[str]] = []

    @field_validator("tier")
    @classmethod
    def validate_tier(cls, value: int) -> int:
        if value not in (1, 2, 3, 4):
            raise ValueError("Tier must be between 1 and 4")
        return value


class OfficialOut(BaseModel):
    id: int
    name: str
    tier: int
    unavailable_dates: List[str]
    area: str

    class Config:
        from_attributes = True


EventType = Literal["Tournament", "Dual", "Tri", "Quad"]
ALLOWED_TIERS = {1.0, 1.5, 2.0, 2.5, 3.0, 3.5, 4.0}


class EventIn(BaseModel):
    name: str
    event_type: EventType
    team_ids: List[int] = Field(default_factory=list)
    starts_at: datetime
    ends_at: datetime
    officials_needed: int = 1
    tier_override: Optional[float] = None

    @field_validator("tier_override")
    @classmethod
    def validate_override(cls, value: Optional[float]) -> Optional[float]:
        if value is None:
            return value
        if value not in ALLOWED_TIERS:
            raise ValueError("Tier override must be one of 1.0, 1.5, 2.0, 2.5, 3.0, 3.5, 4.0")
        return value


class EventOut(BaseModel):
    id: int
    name: str
    event_type: str
    team_ids: List[int]
    tier_value: Optional[float]
    starts_at: datetime
    ends_at: datetime
    officials_needed: int
    officials: List[int]
    area: str

    class Config:
        from_attributes = True


class AssignmentResult(BaseModel):
    event_id: int
    assigned_official_ids: List[int]
    reason: str


class RunAssignmentsResponse(BaseModel):
    results: List[AssignmentResult]
