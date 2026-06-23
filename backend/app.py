import os
from datetime import datetime
from typing import List

from fastapi import Depends, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session

from assigner import EVENT_TYPE_TEAM_COUNT, compute_event_tier, run_all_assignments
from auth import get_current_user, router as auth_router
from database import Base, engine, get_session
from models import Event, Official, Team
from schemas import (
    AssignmentResult,
    EventIn,
    EventOut,
    OfficialIn,
    OfficialOut,
    RunAssignmentsResponse,
    TeamIn,
    TeamOut,
)

from dotenv import load_dotenv

load_dotenv()

Base.metadata.create_all(bind=engine)

app = FastAPI(title="Wrestling Official Assigner")

RAW_FRONTEND_ORIGINS = os.getenv("FRONTEND_ORIGIN", "http://localhost:5173")
ALLOWED_ORIGINS = [origin.strip() for origin in RAW_FRONTEND_ORIGINS.split(",") if origin.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router)


def _serialize_team(team: Team) -> TeamOut:
    return TeamOut(id=team.id, name=team.name, tier=team.tier, area=team.area)


def _serialize_official(official: Official) -> OfficialOut:
    raw = official.unavailable_dates or ""
    dates = [value.strip() for value in raw.split(",") if value.strip()]
    return OfficialOut(
        id=official.id,
        name=official.name,
        tier=official.tier,
        unavailable_dates=dates,
        area=official.area,
    )


def _serialize_event(event: Event) -> EventOut:
    sorted_teams = sorted(event.teams, key=lambda team: team.name.lower())
    return EventOut(
        id=event.id,
        name=event.name,
        event_type=event.event_type,
        team_ids=[team.id for team in sorted_teams],
        tier_value=event.tier_value,
        starts_at=event.starts_at,
        ends_at=event.ends_at,
        officials_needed=event.officials_needed,
        officials=[official.id for official in event.officials],
        area=event.area,
    )


@app.post("/teams", response_model=TeamOut)
def create_team(
    team: TeamIn,
    db: Session = Depends(get_session),
    user=Depends(get_current_user),
):
    normalized_name = team.name.strip()
    existing = (
        db.query(Team)
        .filter(Team.name == normalized_name, Team.area == user.area)
        .first()
    )
    if existing:
        raise HTTPException(status_code=400, detail="Team name already exists")
    db_team = Team(name=normalized_name, tier=team.tier, area=user.area)
    db.add(db_team)
    db.commit()
    db.refresh(db_team)
    return _serialize_team(db_team)


@app.get("/teams", response_model=List[TeamOut])
def list_teams(db: Session = Depends(get_session), user=Depends(get_current_user)):
    teams = (
        db.query(Team)
        .filter(Team.area == user.area)
        .order_by(Team.name.asc())
        .all()
    )
    return [_serialize_team(team) for team in teams]


@app.put("/teams/{team_id}", response_model=TeamOut)
def update_team(
    team_id: int,
    team: TeamIn,
    db: Session = Depends(get_session),
    user=Depends(get_current_user),
):
    db_team = db.get(Team, team_id)
    if not db_team:
        raise HTTPException(status_code=404, detail="Team not found")

    if db_team.area != user.area:
        raise HTTPException(status_code=403, detail="Not authorized for this team")

    normalized_name = team.name.strip()
    duplicate = (
        db.query(Team)
        .filter(Team.id != team_id, Team.name == normalized_name, Team.area == user.area)
        .first()
    )
    if duplicate:
        raise HTTPException(status_code=400, detail="Team name already exists")

    db_team.name = normalized_name
    db_team.tier = team.tier
    db.add(db_team)
    db.commit()
    db.refresh(db_team)
    return _serialize_team(db_team)


@app.delete("/teams/{team_id}")
def delete_team(
    team_id: int,
    db: Session = Depends(get_session),
    user=Depends(get_current_user),
):
    db_team = db.get(Team, team_id)
    if not db_team:
        raise HTTPException(status_code=404, detail="Team not found")
    if db_team.area != user.area:
        raise HTTPException(status_code=403, detail="Not authorized for this team")
    db.delete(db_team)
    db.commit()
    return {"ok": True}


@app.post("/officials", response_model=OfficialOut)
def create_official(
    official: OfficialIn,
    db: Session = Depends(get_session),
    user=Depends(get_current_user),
):
    normalized_name = official.name.strip()
    existing = (
        db.query(Official)
        .filter(Official.name == normalized_name, Official.area == user.area)
        .first()
    )
    if existing:
        raise HTTPException(status_code=400, detail="Official name already exists")
    dates = ",".join(official.unavailable_dates or [])
    db_official = Official(
        name=normalized_name,
        tier=official.tier,
        unavailable_dates=dates,
        area=user.area,
    )
    db.add(db_official)
    db.commit()
    db.refresh(db_official)
    return _serialize_official(db_official)


@app.get("/officials", response_model=List[OfficialOut])
def list_officials(
    db: Session = Depends(get_session),
    user=Depends(get_current_user),
):
    officials = (
        db.query(Official)
        .filter(Official.area == user.area)
        .order_by(Official.tier.asc(), Official.name.asc())
        .all()
    )
    return [_serialize_official(official) for official in officials]


@app.put("/officials/{official_id}", response_model=OfficialOut)
def update_official(
    official_id: int,
    official: OfficialIn,
    db: Session = Depends(get_session),
    user=Depends(get_current_user),
):
    db_official = db.get(Official, official_id)
    if not db_official:
        raise HTTPException(status_code=404, detail="Official not found")

    if db_official.area != user.area:
        raise HTTPException(status_code=403, detail="Not authorized for this official")

    normalized_name = official.name.strip()
    duplicate = (
        db.query(Official)
        .filter(Official.id != official_id, Official.name == normalized_name, Official.area == user.area)
        .first()
    )
    if duplicate:
        raise HTTPException(status_code=400, detail="Official name already exists")

    db_official.name = normalized_name
    db_official.tier = official.tier
    db_official.unavailable_dates = ",".join(official.unavailable_dates or [])
    db.add(db_official)
    db.commit()
    db.refresh(db_official)
    return _serialize_official(db_official)


@app.delete("/officials/{official_id}")
def delete_official(
    official_id: int,
    db: Session = Depends(get_session),
    user=Depends(get_current_user),
):
    db_official = db.get(Official, official_id)
    if not db_official:
        raise HTTPException(status_code=404, detail="Official not found")
    if db_official.area != user.area:
        raise HTTPException(status_code=403, detail="Not authorized for this official")
    db.delete(db_official)
    db.commit()
    return {"ok": True}


def _validate_event_window(starts_at: datetime, ends_at: datetime) -> None:
    if ends_at <= starts_at:
        raise HTTPException(status_code=400, detail="Event end must be after start")


def _load_teams(db: Session, team_ids: list[int], area: str) -> list[Team]:
    teams: list[Team] = []
    for team_id in team_ids:
        team = db.get(Team, team_id)
        if not team:
            raise HTTPException(status_code=400, detail=f"Team {team_id} not found")
        if team.area != area:
            raise HTTPException(status_code=400, detail="Teams must belong to your area")
        teams.append(team)
    return teams


def _validate_event_teams(event: EventIn, teams: list[Team]) -> None:
    required = EVENT_TYPE_TEAM_COUNT.get(event.event_type)
    if required is None:
        raise HTTPException(status_code=400, detail="Unknown event type")

    if len(event.team_ids) != required:
        raise HTTPException(
            status_code=400,
            detail=f"Event type {event.event_type} requires {required} teams",
        )

    if required > 0 and len({team.id for team in teams}) != len(teams):
        raise HTTPException(status_code=400, detail="Team selection must be unique")


@app.post("/events", response_model=EventOut)
def create_event(
    event: EventIn,
    db: Session = Depends(get_session),
    user=Depends(get_current_user),
):
    _validate_event_window(event.starts_at, event.ends_at)
    teams = _load_teams(db, event.team_ids, user.area)
    _validate_event_teams(event, teams)

    try:
        tier = compute_event_tier(
            event.event_type,
            [team.tier for team in teams],
            event.tier_override,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    db_event = Event(
        name=event.name.strip(),
        event_type=event.event_type,
        tier_value=tier,
        starts_at=event.starts_at,
        ends_at=event.ends_at,
        officials_needed=event.officials_needed,
        area=user.area,
    )
    db_event.teams = teams
    db.add(db_event)
    db.commit()
    db.refresh(db_event)
    return _serialize_event(db_event)


@app.get("/events", response_model=List[EventOut])
def list_events(
    db: Session = Depends(get_session),
    user=Depends(get_current_user),
):
    events = (
        db.query(Event)
        .filter(Event.area == user.area)
        .order_by(Event.starts_at.asc())
        .all()
    )
    return [_serialize_event(event) for event in events]


@app.put("/events/{event_id}", response_model=EventOut)
def update_event(
    event_id: int,
    event: EventIn,
    db: Session = Depends(get_session),
    user=Depends(get_current_user),
):
    db_event = db.get(Event, event_id)
    if not db_event:
        raise HTTPException(status_code=404, detail="Event not found")
    if db_event.area != user.area:
        raise HTTPException(status_code=403, detail="Not authorized for this event")

    _validate_event_window(event.starts_at, event.ends_at)
    teams = _load_teams(db, event.team_ids, user.area)
    _validate_event_teams(event, teams)

    try:
        tier = compute_event_tier(
            event.event_type,
            [team.tier for team in teams],
            event.tier_override,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    db_event.name = event.name.strip()
    db_event.event_type = event.event_type
    db_event.tier_value = tier
    db_event.starts_at = event.starts_at
    db_event.ends_at = event.ends_at
    db_event.officials_needed = event.officials_needed
    db_event.teams = teams

    db.add(db_event)
    db.commit()
    db.refresh(db_event)
    return _serialize_event(db_event)


@app.delete("/events/{event_id}")
def delete_event(
    event_id: int,
    db: Session = Depends(get_session),
    user=Depends(get_current_user),
):
    db_event = db.get(Event, event_id)
    if not db_event:
        raise HTTPException(status_code=404, detail="Event not found")
    if db_event.area != user.area:
        raise HTTPException(status_code=403, detail="Not authorized for this event")
    db.delete(db_event)
    db.commit()
    return {"ok": True}


@app.post("/assign/run", response_model=RunAssignmentsResponse)
def run_assignments(
    db: Session = Depends(get_session),
    user=Depends(get_current_user),
):
    results: List[AssignmentResult] = []
    for event_id, official_ids, reason in run_all_assignments(db, area=user.area):
        results.append(
            AssignmentResult(
                event_id=event_id,
                assigned_official_ids=official_ids,
                reason=reason,
            )
        )
    return RunAssignmentsResponse(results=results)
