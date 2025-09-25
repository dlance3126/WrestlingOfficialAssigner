from __future__ import annotations

from typing import Dict, List, Optional, Tuple

from sqlalchemy.orm import Session

from models import Event, Official

TIER_POLICY: Dict[float, Dict[str, List[int]]] = {
    1.0: {"preferred": [1], "allowed": [2]},
    1.5: {"preferred": [1, 1, 2], "allowed": [2]},
    2.0: {"preferred": [1, 2], "allowed": []},
    2.5: {"preferred": [2, 2], "allowed": [3]},
    3.0: {"preferred": [2, 3], "allowed": []},
    3.5: {"preferred": [3, 3], "allowed": [4]},
    4.0: {"preferred": [4, 4], "allowed": []},
}


EVENT_TYPE_TEAM_COUNT: Dict[str, int] = {
    "Tournament": 0,
    "Dual": 2,
    "Tri": 3,
    "Quad": 4,
}


ALLOWED_TIERS = set(TIER_POLICY.keys())


def compute_event_tier(
    event_type: str,
    team_tiers: List[int],
    tier_override: Optional[float] = None,
) -> float:
    if tier_override is not None:
        if tier_override not in ALLOWED_TIERS:
            raise ValueError("Tier override must match assignment policy tiers")
        return tier_override

    required = EVENT_TYPE_TEAM_COUNT.get(event_type)
    if required is None:
        raise ValueError(f"Unknown event type: {event_type}")

    if required == 0:
        raise ValueError("Tournament events require a tier override")

    if len(team_tiers) != required:
        raise ValueError("Incorrect number of teams for event type")

    if event_type == "Dual":
        t1, t2 = team_tiers
        return (t1 + t2) / 2.0

    # Tri or Quad: use the two highest-tier teams to determine event difficulty
    top_two = sorted(team_tiers, reverse=True)[:2]
    return sum(top_two) / 2.0


def _is_official_available(official: Official, event: Event) -> bool:
    raw_dates = official.unavailable_dates or ""
    blocked_dates = {value.strip() for value in raw_dates.split(",") if value.strip()}
    event_date = event.starts_at.date().isoformat()
    if event_date in blocked_dates:
        return False

    for other in official.events:
        if other.id == event.id:
            continue
        if not (event.ends_at <= other.starts_at or event.starts_at >= other.ends_at):
            return False
    return True


def _eligible_officials(db: Session, event: Event) -> List[Official]:
    officials = db.query(Official).order_by(Official.tier.asc()).all()
    return [official for official in officials if _is_official_available(official, event)]


def assign_event(db: Session, event: Event) -> Tuple[List[int], str]:
    policy = TIER_POLICY.get(event.tier_value)
    if not policy:
        return [], f"No policy for tier {event.tier_value}"

    candidates = _eligible_officials(db, event)
    need = event.officials_needed
    chosen: List[Official] = []

    def take_from(tiers: List[int]):
        nonlocal need
        for tier in tiers:
            if need <= 0:
                break
            for official in [c for c in candidates if c.tier == tier and c not in chosen]:
                chosen.append(official)
                need -= 1
                if need <= 0:
                    break

    take_from(policy["preferred"])

    if need > 0:
        take_from(policy["allowed"])

    if need > 0:
        for tier in [1, 2, 3, 4]:
            if need <= 0:
                break
            for official in [c for c in candidates if c.tier == tier and c not in chosen]:
                chosen.append(official)
                need -= 1
                if need <= 0:
                    break

    assigned_ids = [official.id for official in chosen]
    if len(assigned_ids) < event.officials_needed:
        return assigned_ids, "Partial assignment due to limited availability"

    return assigned_ids, "Assigned per policy"


def run_all_assignments(db: Session) -> List[Tuple[int, List[int], str]]:
    results: List[Tuple[int, List[int], str]] = []
    events = db.query(Event).order_by(Event.starts_at.asc()).all()
    for event in events:
        assigned_ids, reason = assign_event(db, event)
        event.officials = [db.get(Official, official_id) for official_id in assigned_ids]
        db.add(event)
        results.append((event.id, assigned_ids, reason))
    db.commit()
    return results
