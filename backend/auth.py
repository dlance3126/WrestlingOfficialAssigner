import os
from datetime import datetime, timedelta, timezone

import jwt
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from fastapi.security import OAuth2PasswordRequestForm
from passlib.context import CryptContext
from sqlalchemy.orm import Session

from database import get_session
from models import User

router = APIRouter(prefix="/auth", tags=["auth"])

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
SECRET = os.getenv("SECRET_KEY", "change_me")
EXPIRE_MINUTES = int(os.getenv("JWT_EXPIRE_MINUTES", "120"))
ENV = os.getenv("ENV", "dev")

COOKIE_OPTIONS = dict(
    httponly=True,
    samesite="lax",
    secure=ENV == "prod",
    path="/",
)


@router.post("/register")
def register(email: str, password: str, db: Session = Depends(get_session)):
    existing = db.query(User).filter(User.email == email).first()
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")

    user = User(email=email, hashed_password=pwd_context.hash(password), is_admin=True)
    db.add(user)
    db.commit()
    db.refresh(user)
    return {"id": user.id, "email": user.email}


@router.post("/login")
def login(
    response: Response,
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: Session = Depends(get_session),
):
    user = db.query(User).filter(User.email == form_data.username).first()
    if not user or not pwd_context.verify(form_data.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Invalid credentials")

    payload = {
        "sub": str(user.id),
        "exp": datetime.now(timezone.utc) + timedelta(minutes=EXPIRE_MINUTES),
    }
    token = jwt.encode(payload, SECRET, algorithm="HS256")
    response.set_cookie("access_token", token, **COOKIE_OPTIONS)
    return {"ok": True}


@router.post("/logout")
def logout(response: Response):
    response.delete_cookie("access_token", path="/")
    return {"ok": True}


def get_current_user(request: Request, db: Session = Depends(get_session)) -> User:
    token = request.cookies.get("access_token")
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")

    try:
        payload = jwt.decode(token, SECRET, algorithms=["HS256"])
        user_id = int(payload["sub"])
    except Exception as exc:  # broad but jwt can raise several types
        raise HTTPException(status_code=401, detail="Invalid token") from exc

    user = db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    return user
