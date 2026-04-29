from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.responses import JSONResponse, RedirectResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.dependencies import get_current_user, get_db
from app.core.oauth import oauth
from app.models.models import User
from app.schemas.auth import UserResponse
from app.services import auth_service

router = APIRouter(prefix="/auth", tags=["auth"])

_COOKIE = "access_token"
_COOKIE_MAX_AGE = 60 * 60 * 24 * 30  # 30 days


@router.get("/google/login")
async def google_login(request: Request):
    redirect_uri = request.url_for("google_callback")
    return await oauth.google.authorize_redirect(request, redirect_uri)


@router.get("/google/callback", name="google_callback")
async def google_callback(request: Request, db: AsyncSession = Depends(get_db)):
    try:
        token = await oauth.google.authorize_access_token(request)
    except Exception:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="OAuth failed")

    userinfo = token.get("userinfo")
    if not userinfo:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No user info returned")

    user = await auth_service.get_or_create_user(
        db=db,
        google_id=userinfo["sub"],
        email=userinfo["email"],
        display_name=userinfo.get("name", userinfo["email"]),
        avatar_url=userinfo.get("picture"),
    )

    access_token = auth_service.create_access_token(user.id)
    response = RedirectResponse(url=f"{settings.frontend_url}/dashboard")
    response.set_cookie(
        key=_COOKIE,
        value=access_token,
        httponly=True,
        secure=settings.app_env == "production",
        samesite="lax",
        max_age=_COOKIE_MAX_AGE,
    )
    return response


@router.get("/me", response_model=UserResponse)
async def get_me(current_user: User = Depends(get_current_user)) -> User:
    return current_user


@router.post("/logout")
async def logout():
    response = JSONResponse(content={"ok": True})
    response.delete_cookie(key=_COOKIE, httponly=True, samesite="lax")
    return response
