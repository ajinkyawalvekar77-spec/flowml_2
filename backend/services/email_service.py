"""
FlowML Studio Email Service.
Sends account verification emails, password resets, and project updates
from the official project email: flowmlstudio@gmail.com.

Supports:
- Direct Gmail SMTP dispatch (via smtp.gmail.com with SSL/TLS) when credentials
  (GMAIL_APP_PASSWORD or SMTP_PASSWORD) are set.
- Safe local / offline dispatch with full outbox logging and one-click verification
  links for desktop development when running without external SMTP credentials.
"""

import os
import ssl
import time
import uuid
import secrets
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from typing import Optional, Dict, Any, List

from utils.logger import log_event

PROJECT_EMAIL = os.getenv("PROJECT_EMAIL", "flowmlstudio@gmail.com")
SENDER_NAME = os.getenv("SENDER_NAME", "FlowML Studio")
SMTP_HOST = os.getenv("SMTP_HOST", "smtp.gmail.com")
SMTP_PORT = int(os.getenv("SMTP_PORT", "587"))
SMTP_USER = os.getenv("SMTP_USER", PROJECT_EMAIL)
SMTP_PASSWORD = os.getenv("GMAIL_APP_PASSWORD") or os.getenv("SMTP_PASSWORD")

# In-memory token stores (token -> metadata)
_VERIFICATION_TOKENS: Dict[str, Dict[str, Any]] = {}
_RESET_TOKENS: Dict[str, Dict[str, Any]] = {}
_OUTBOX_LOG: List[Dict[str, Any]] = []


def is_live_smtp_configured() -> bool:
    """Returns True if valid SMTP credentials are configured in the environment."""
    return bool(SMTP_PASSWORD and SMTP_PASSWORD.strip())


def generate_verification_token(email: str, user_id: str = "user") -> str:
    """Generates a secure verification token valid for 24 hours."""
    token = f"flw_ver_{secrets.token_urlsafe(32)}"
    _VERIFICATION_TOKENS[token] = {
        "email": email.strip().lower(),
        "user_id": user_id,
        "token": token,
        "created_at": time.time(),
        "expires_at": time.time() + (24 * 3600),
        "verified": False,
    }
    return token


def verify_email_token(token: str) -> Dict[str, Any]:
    """Validates an email verification token."""
    record = _VERIFICATION_TOKENS.get(token)
    if not record:
        return {"valid": False, "error": "Invalid or expired verification token."}
    
    if time.time() > record["expires_at"]:
        return {"valid": False, "error": "Verification token has expired. Please request a new link."}
    
    record["verified"] = True
    record["verified_at"] = time.time()
    return {
        "valid": True,
        "email": record["email"],
        "user_id": record["user_id"],
        "token": token,
    }


def generate_reset_token(email: str) -> str:
    """Generates a secure password reset token valid for 1 hour."""
    token = f"flw_rst_{secrets.token_urlsafe(32)}"
    _RESET_TOKENS[token] = {
        "email": email.strip().lower(),
        "token": token,
        "created_at": time.time(),
        "expires_at": time.time() + 3600,
        "used": False,
    }
    return token


def verify_reset_token(token: str) -> Dict[str, Any]:
    """Validates a password reset token."""
    record = _RESET_TOKENS.get(token)
    if not record:
        return {"valid": False, "error": "Invalid password reset token."}
    if time.time() > record["expires_at"]:
        return {"valid": False, "error": "Password reset token has expired."}
    if record.get("used"):
        return {"valid": False, "error": "Password reset token has already been used."}
    return {"valid": True, "email": record["email"]}


def send_email(
    to_email: str,
    subject: str,
    html_body: str,
    text_body: Optional[str] = None,
    meta: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    """
    Sends an email from flowmlstudio@gmail.com.
    Dispatches via Gmail SMTP if credentials exist, or logs and queues in outbox.
    """
    to_email = to_email.strip().lower()
    plain_text = text_body or "Please view this email in an HTML-compatible email client."
    sender_header = f"{SENDER_NAME} <{PROJECT_EMAIL}>"

    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"] = sender_header
    msg["To"] = to_email

    msg.attach(MIMEText(plain_text, "plain", "utf-8"))
    msg.attach(MIMEText(html_body, "html", "utf-8"))

    delivery_status = "simulated"
    error_detail = None

    if is_live_smtp_configured():
        try:
            log_event(f"Connecting to SMTP {SMTP_HOST}:{SMTP_PORT} as {SMTP_USER} to email {to_email}...")
            ctx = ssl.create_default_context()
            with smtplib.SMTP(SMTP_HOST, SMTP_PORT, timeout=20) as server:
                server.ehlo()
                server.starttls(context=ctx)
                server.ehlo()
                server.login(SMTP_USER, SMTP_PASSWORD)
                server.send_message(msg)
            delivery_status = "sent_live_smtp"
            log_event(f"Successfully sent live email to {to_email} from {PROJECT_EMAIL}.")
        except Exception as exc:
            delivery_status = "smtp_fallback_simulated"
            error_detail = str(exc)
            log_event(f"Live SMTP failed ({exc}); falling back to local simulation.", level="WARNING")
    else:
        log_event(f"[EMAIL SERVICE] Simulated dispatch from {PROJECT_EMAIL} to {to_email} (Subject: {subject})")

    record = {
        "id": f"mail_{uuid.uuid4().hex[:12]}",
        "sender": PROJECT_EMAIL,
        "recipient": to_email,
        "subject": subject,
        "html_body": html_body,
        "timestamp": time.time(),
        "delivery_status": delivery_status,
        "error_detail": error_detail,
        "meta": meta or {},
    }
    _OUTBOX_LOG.append(record)
    if len(_OUTBOX_LOG) > 100:
        _OUTBOX_LOG.pop(0)

    return {
        "success": True,
        "from": PROJECT_EMAIL,
        "to": to_email,
        "subject": subject,
        "delivery_status": delivery_status,
        "mail_id": record["id"],
        "error": error_detail,
    }


def send_verification_email(
    to_email: str,
    user_id: str = "user",
    app_url: str = "http://localhost:5173",
) -> Dict[str, Any]:
    """
    Generates a verification token and sends a branded verification email
    from flowmlstudio@gmail.com.
    """
    token = generate_verification_token(to_email, user_id)
    verify_url = f"{app_url}/verify-email?token={token}&email={to_email}"
    direct_api_url = f"http://127.0.0.1:8000/api/auth/verify-email?token={token}"

    subject = "Verify your FlowML Studio Account"
    html_body = f"""<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body {{ font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #0F0E17; color: #FFFFFF; margin: 0; padding: 24px; }}
    .card {{ max-width: 560px; margin: 0 auto; background: #181622; border: 1px solid rgba(124, 58, 237, 0.25); border-radius: 20px; padding: 36px; box-shadow: 0 12px 32px rgba(0,0,0,0.5); }}
    .header {{ text-align: center; margin-bottom: 24px; }}
    .logo-badge {{ display: inline-block; padding: 10px 18px; border-radius: 12px; background: linear-gradient(135deg, #7C3AED, #4F46E5); font-weight: bold; font-size: 16px; color: #FFFFFF; }}
    h1 {{ font-size: 22px; font-weight: 700; margin: 16px 0 8px 0; color: #FFFFFF; text-align: center; }}
    p {{ font-size: 14px; line-height: 1.6; color: #A1A1AA; margin: 12px 0; }}
    .btn {{ display: block; width: fit-content; margin: 28px auto; padding: 14px 32px; background: linear-gradient(135deg, #7C3AED, #6D28D9); color: #FFFFFF !important; font-weight: 600; font-size: 14px; text-decoration: none; border-radius: 12px; box-shadow: 0 4px 16px rgba(124, 58, 237, 0.4); text-align: center; }}
    .token-box {{ background: #0B0A10; border: 1px dashed rgba(255,255,255,0.15); border-radius: 10px; padding: 12px; font-family: monospace; font-size: 12px; color: #A78BFA; word-break: break-all; margin: 16px 0; }}
    .footer {{ text-align: center; margin-top: 32px; font-size: 12px; color: #71717A; border-top: 1px solid rgba(255,255,255,0.08); padding-top: 16px; }}
  </style>
</head>
<body>
  <div class="card">
    <div class="header">
      <div class="logo-badge">⚡ FlowML Studio</div>
      <h1>Verify your email address</h1>
    </div>
    <p>Hello,</p>
    <p>Thank you for creating an account with <strong>FlowML Studio</strong>. To activate your account and start building visual ML pipelines, please verify your email address below.</p>
    
    <a href="{verify_url}" class="btn">Verify Email Address</a>
    
    <p style="font-size: 12px; color: #71717A;">Or copy and paste this direct verification link into your browser:</p>
    <div class="token-box">{verify_url}</div>

    <p style="font-size: 12px; color: #71717A;">This verification link will expire in 24 hours.</p>

    <div class="footer">
      Sent from the official project email: <strong>{PROJECT_EMAIL}</strong><br>
      FlowML Studio &copy; Visual Machine Learning Studio
    </div>
  </div>
</body>
</html>"""

    text_body = f"""Verify your FlowML Studio Account

Hello,
Please verify your email address by visiting:
{verify_url}

Token: {token}
This link expires in 24 hours.

Sent from: {PROJECT_EMAIL}
FlowML Studio
"""

    res = send_email(
        to_email=to_email,
        subject=subject,
        html_body=html_body,
        text_body=text_body,
        meta={"type": "verification", "token": token, "verify_url": verify_url},
    )
    res["token"] = token
    res["verify_url"] = verify_url
    res["direct_api_url"] = direct_api_url
    return res


def send_password_reset_email(
    to_email: str,
    app_url: str = "http://localhost:5173",
) -> Dict[str, Any]:
    """
    Generates a password reset token and sends an email from flowmlstudio@gmail.com.
    """
    token = generate_reset_token(to_email)
    reset_url = f"{app_url}/signin?reset_token={token}&email={to_email}"

    subject = "Reset your FlowML Studio Password"
    html_body = f"""<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body {{ font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #0F0E17; color: #FFFFFF; margin: 0; padding: 24px; }}
    .card {{ max-width: 560px; margin: 0 auto; background: #181622; border: 1px solid rgba(124, 58, 237, 0.25); border-radius: 20px; padding: 36px; box-shadow: 0 12px 32px rgba(0,0,0,0.5); }}
    .header {{ text-align: center; margin-bottom: 24px; }}
    .logo-badge {{ display: inline-block; padding: 10px 18px; border-radius: 12px; background: linear-gradient(135deg, #7C3AED, #4F46E5); font-weight: bold; font-size: 16px; color: #FFFFFF; }}
    h1 {{ font-size: 22px; font-weight: 700; margin: 16px 0 8px 0; color: #FFFFFF; text-align: center; }}
    p {{ font-size: 14px; line-height: 1.6; color: #A1A1AA; margin: 12px 0; }}
    .btn {{ display: block; width: fit-content; margin: 28px auto; padding: 14px 32px; background: linear-gradient(135deg, #7C3AED, #6D28D9); color: #FFFFFF !important; font-weight: 600; font-size: 14px; text-decoration: none; border-radius: 12px; box-shadow: 0 4px 16px rgba(124, 58, 237, 0.4); text-align: center; }}
    .token-box {{ background: #0B0A10; border: 1px dashed rgba(255,255,255,0.15); border-radius: 10px; padding: 12px; font-family: monospace; font-size: 12px; color: #A78BFA; word-break: break-all; margin: 16px 0; }}
    .footer {{ text-align: center; margin-top: 32px; font-size: 12px; color: #71717A; border-top: 1px solid rgba(255,255,255,0.08); padding-top: 16px; }}
  </style>
</head>
<body>
  <div class="card">
    <div class="header">
      <div class="logo-badge">⚡ FlowML Studio</div>
      <h1>Password Reset Request</h1>
    </div>
    <p>Hello,</p>
    <p>We received a request to reset your password for your FlowML Studio account (<strong>{to_email}</strong>). Click the button below to choose a new password.</p>
    
    <a href="{reset_url}" class="btn">Reset Password</a>
    
    <p style="font-size: 12px; color: #71717A;">Or use this link directly:</p>
    <div class="token-box">{reset_url}</div>

    <p style="font-size: 12px; color: #71717A;">If you did not request this, you can safely ignore this email. This link will expire in 1 hour.</p>

    <div class="footer">
      Sent from the official project email: <strong>{PROJECT_EMAIL}</strong><br>
      FlowML Studio &copy; Visual Machine Learning Studio
    </div>
  </div>
</body>
</html>"""

    text_body = f"""Reset your FlowML Studio Password

Hello,
Please visit the link below to reset your password:
{reset_url}

Token: {token}
Expires in 1 hour.

Sent from: {PROJECT_EMAIL}
"""

    res = send_email(
        to_email=to_email,
        subject=subject,
        html_body=html_body,
        text_body=text_body,
        meta={"type": "password_reset", "token": token, "reset_url": reset_url},
    )
    res["token"] = token
    res["reset_url"] = reset_url
    return res


def send_project_update_email(
    to_email: str,
    project_name: str,
    update_type: str = "Pipeline Execution",
    details: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    """
    Sends project alerts, training completion, and pipeline updates from flowmlstudio@gmail.com.
    """
    details = details or {}
    status_label = details.get("status", "Completed Successfully")
    metrics_summary = details.get("metrics", {})
    records_count = details.get("records_count", "N/A")

    subject = f"FlowML Project Update: {project_name} ({update_type})"

    metrics_html = ""
    if metrics_summary and isinstance(metrics_summary, dict):
        metrics_html = "<div style='background:#12111A; padding:12px; border-radius:10px; margin:16px 0;'>"
        metrics_html += "<strong style='color:#E4E4E7; font-size:13px;'>Key Metrics:</strong><ul style='margin:8px 0 0 18px; padding:0; font-size:13px; color:#A1A1AA;'>"
        for k, v in list(metrics_summary.items())[:6]:
            metrics_html += f"<li><strong>{k}:</strong> {v}</li>"
        metrics_html += "</ul></div>"

    html_body = f"""<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body {{ font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #0F0E17; color: #FFFFFF; margin: 0; padding: 24px; }}
    .card {{ max-width: 560px; margin: 0 auto; background: #181622; border: 1px solid rgba(124, 58, 237, 0.25); border-radius: 20px; padding: 36px; box-shadow: 0 12px 32px rgba(0,0,0,0.5); }}
    .header {{ text-align: center; margin-bottom: 24px; }}
    .logo-badge {{ display: inline-block; padding: 10px 18px; border-radius: 12px; background: linear-gradient(135deg, #7C3AED, #4F46E5); font-weight: bold; font-size: 16px; color: #FFFFFF; }}
    h1 {{ font-size: 20px; font-weight: 700; margin: 16px 0 8px 0; color: #FFFFFF; }}
    p {{ font-size: 14px; line-height: 1.6; color: #A1A1AA; margin: 12px 0; }}
    .status-pill {{ display: inline-block; padding: 6px 14px; border-radius: 20px; background: rgba(16, 185, 129, 0.2); color: #34D399; font-weight: 600; font-size: 13px; }}
    .footer {{ text-align: center; margin-top: 32px; font-size: 12px; color: #71717A; border-top: 1px solid rgba(255,255,255,0.08); padding-top: 16px; }}
  </style>
</head>
<body>
  <div class="card">
    <div class="header">
      <div class="logo-badge">⚡ FlowML Studio</div>
      <h1>Project Update: {project_name}</h1>
      <span class="status-pill">{status_label}</span>
    </div>
    <p>Hello,</p>
    <p>An event occurred in your FlowML Studio project <strong>{project_name}</strong>:</p>
    
    <div style="background: #0B0A10; border-radius: 12px; padding: 16px; margin: 16px 0;">
      <p style="margin: 4px 0; color: #D4D4D8;"><strong>Update Type:</strong> {update_type}</p>
      <p style="margin: 4px 0; color: #D4D4D8;"><strong>Processed Records:</strong> {records_count}</p>
      <p style="margin: 4px 0; color: #D4D4D8;"><strong>Time:</strong> {time.strftime('%Y-%m-%d %H:%M:%S UTC', time.gmtime())}</p>
    </div>

    {metrics_html}

    <p>You can view and inspect full run visualizations and logs in your FlowML Studio workspace.</p>

    <div class="footer">
      Sent from project email: <strong>{PROJECT_EMAIL}</strong><br>
      FlowML Studio &copy; Visual Machine Learning Studio
    </div>
  </div>
</body>
</html>"""

    text_body = f"""FlowML Studio Project Update: {project_name}
Type: {update_type}
Status: {status_label}
Processed Records: {records_count}
Sent from: {PROJECT_EMAIL}
"""

    return send_email(
        to_email=to_email,
        subject=subject,
        html_body=html_body,
        text_body=text_body,
        meta={"type": "project_update", "project": project_name, "details": details},
    )


def get_email_service_status() -> Dict[str, Any]:
    """Returns active service details, project sender address, and outbox count."""
    return {
        "project_email": PROJECT_EMAIL,
        "sender_name": SENDER_NAME,
        "smtp_host": SMTP_HOST,
        "smtp_port": SMTP_PORT,
        "is_live_smtp": is_live_smtp_configured(),
        "total_dispatched": len(_OUTBOX_LOG),
        "recent_outbox": _OUTBOX_LOG[-10:][::-1],
    }
