from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.responses import JSONResponse, RedirectResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.dependencies import get_current_user, get_db
from app.core.oauth import oauth
from app.models.models import User
from app.schemas.auth import AvatarUpdate, UsernameAvailabilityResponse, UsernameUpdate, UserResponse
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


@router.get("/username-availability", response_model=UsernameAvailabilityResponse)
async def check_username_availability(
    username: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> UsernameAvailabilityResponse:
    error = auth_service.validate_username_format(username)
    if error:
        return UsernameAvailabilityResponse(available=False, reason=error)

    if await auth_service.username_taken(db, username, exclude_user_id=current_user.id):
        return UsernameAvailabilityResponse(available=False, reason="Username is already taken")

    return UsernameAvailabilityResponse(available=True)


@router.patch("/me/username", response_model=UserResponse)
async def update_username(
    data: UsernameUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> User:
    error = auth_service.validate_username_format(data.username)
    if error:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=error)

    if current_user.username and current_user.username.lower() == data.username.lower():
        return current_user

    remaining = auth_service.username_cooldown_remaining(current_user)
    if remaining is not None:
        days = max(remaining.days, 1)
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=f"Username can be changed again in {days} day(s)",
        )

    if await auth_service.username_taken(db, data.username, exclude_user_id=current_user.id):
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Username is already taken")

    return await auth_service.set_username(db, current_user, data.username)


@router.patch("/me/avatar", response_model=UserResponse)
async def update_avatar(
    data: AvatarUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> User:
    if data.avatar_color and data.avatar_image:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Choose either a color or an image, not both",
        )

    if data.avatar_image:
        error = auth_service.validate_avatar_image(data.avatar_image)
        if error:
            raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=error)
        return await auth_service.set_avatar(db, current_user, color=None, image=data.avatar_image)

    return await auth_service.set_avatar(db, current_user, color=data.avatar_color, image=None)


@router.post("/logout")
async def logout():
    response = JSONResponse(content={"ok": True})
    response.delete_cookie(key=_COOKIE, httponly=True, samesite="lax")
    return response
