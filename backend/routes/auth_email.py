"""
Authentication and Email Router.
Handles email verification, password reset requests, and project update notifications
sent from flowmlstudio@gmail.com.
"""

from typing import Optional, Dict, Any
from fastapi import APIRouter, Depends, Query, Request
from fastapi.responses import HTMLResponse, RedirectResponse
from pydantic import BaseModel, EmailStr

from auth import get_current_user
from services.email_service import (
    PROJECT_EMAIL,
    send_verification_email,
    send_password_reset_email,
    send_project_update_email,
    verify_email_token,
    verify_reset_token,
    get_email_service_status,
)
from utils.helpers import raise_http_exception
from utils.logger import log_event

router = APIRouter(prefix="/auth", tags=["Email & Verification"])


class VerificationRequest(BaseModel):
    email: str
    user_id: Optional[str] = None
    app_url: Optional[str] = "http://localhost:5173"


class VerifyTokenRequest(BaseModel):
    token: str


class PasswordResetRequest(BaseModel):
    email: str
    app_url: Optional[str] = "http://localhost:5173"


class ProjectUpdateRequest(BaseModel):
    email: str
    project_name: str
    update_type: Optional[str] = "Pipeline Run"
    details: Optional[Dict[str, Any]] = None


@router.post("/send-verification")
async def request_verification_email(req: VerificationRequest):
    """
    Sends an email verification link to the user from flowmlstudio@gmail.com.
    """
    if not req.email or "@" not in req.email:
        raise_http_exception(400, "Invalid email", "Please provide a valid recipient email address.")

    user_id = req.user_id or f"user_{req.email.split('@')[0]}"
    res = send_verification_email(to_email=req.email, user_id=user_id, app_url=req.app_url or "http://localhost:5173")
    return res


@router.get("/verify-email")
async def verify_email_via_link(token: str = Query(...)):
    """
    HTTP GET endpoint for link clicks from emails.
    Validates token and returns a clean, branded confirmation page.
    """
    result = verify_email_token(token)
    if not result.get("valid"):
        html = f"""<!DOCTYPE html>
<html>
<head>
  <title>FlowML Studio - Verification Failed</title>
  <style>
    body {{ background: #0F0E17; color: #FFF; font-family: sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; }}
    .box {{ background: #181622; border: 1px solid #EF4444; border-radius: 16px; padding: 32px; text-align: center; max-width: 420px; }}
    h1 {{ color: #EF4444; font-size: 20px; }}
    p {{ color: #A1A1AA; font-size: 14px; line-height: 1.5; }}
    a {{ display: inline-block; margin-top: 16px; padding: 10px 20px; background: #7C3AED; color: #FFF; text-decoration: none; border-radius: 8px; font-weight: bold; }}
  </style>
</head>
<body>
  <div class="box">
    <h1>Verification Failed</h1>
    <p>{result.get('error', 'Token is invalid or expired.')}</p>
    <a href="http://localhost:5173/signin">Return to Sign In</a>
  </div>
</body>
</html>"""
        return HTMLResponse(content=html, status_code=400)

    html = f"""<!DOCTYPE html>
<html>
<head>
  <title>FlowML Studio - Email Verified</title>
  <style>
    body {{ background: #0F0E17; color: #FFF; font-family: -apple-system, BlinkMacSystemFont, sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; }}
    .box {{ background: #181622; border: 1px solid #10B981; border-radius: 20px; padding: 40px; text-align: center; max-width: 440px; box-shadow: 0 10px 30px rgba(0,0,0,0.5); }}
    .icon {{ font-size: 48px; margin-bottom: 16px; }}
    h1 {{ color: #10B981; font-size: 22px; margin: 0 0 12px 0; }}
    p {{ color: #A1A1AA; font-size: 14px; line-height: 1.6; margin: 0 0 24px 0; }}
    a {{ display: inline-block; padding: 12px 28px; background: linear-gradient(135deg, #7C3AED, #6D28D9); color: #FFF; text-decoration: none; border-radius: 12px; font-weight: 600; font-size: 14px; box-shadow: 0 4px 14px rgba(124,58,237,0.4); }}
  </style>
</head>
<body>
  <div class="box">
    <div class="icon">✅</div>
    <h1>Email Verified Successfully!</h1>
    <p>Your email <strong>{result.get('email')}</strong> has been confirmed. You now have full access to FlowML Studio.</p>
    <a href="http://localhost:5173/app/projects">Open FlowML Studio Workspace</a>
  </div>
</body>
</html>"""
    return HTMLResponse(content=html)


@router.post("/verify-token")
async def verify_token_api(req: VerifyTokenRequest):
    """
    Validates email verification token via JSON POST API.
    """
    result = verify_email_token(req.token)
    if not result.get("valid"):
        raise_http_exception(400, "Invalid token", result.get("error", "Verification token is invalid or expired."))
    return result


@router.post("/send-password-reset")
async def request_password_reset(req: PasswordResetRequest):
    """
    Dispatches password reset instructions from flowmlstudio@gmail.com.
    """
    if not req.email or "@" not in req.email:
        raise_http_exception(400, "Invalid email", "Please provide a valid recipient email address.")
    res = send_password_reset_email(to_email=req.email, app_url=req.app_url or "http://localhost:5173")
    return res


@router.post("/send-project-update")
async def dispatch_project_update(req: ProjectUpdateRequest):
    """
    Sends project updates and notifications from flowmlstudio@gmail.com.
    """
    if not req.email or "@" not in req.email:
        raise_http_exception(400, "Invalid email", "Please provide a valid recipient email address.")
    res = send_project_update_email(
        to_email=req.email,
        project_name=req.project_name,
        update_type=req.update_type or "Pipeline Run",
        details=req.details or {},
    )
    return res


@router.get("/email-service")
async def email_service_status():
    """
    Returns email service status, sender address (flowmlstudio@gmail.com), and outbox log.
    """
    return get_email_service_status()
