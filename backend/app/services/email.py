import logging
from typing import Optional
from ..config import settings

logger = logging.getLogger(__name__)

_BRAND = "#1B3260"
_TEAL = "#00C4A0"
_BG = "#F4F6FA"
_TEXT = "#374151"
_MUTED = "#6B7280"

def _wrap(body_html: str) -> str:
    return f"""<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<style>
  body{{margin:0;padding:0;background:{_BG};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif}}
  .wrap{{max-width:560px;margin:40px auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 1px 4px rgba(0,0,0,.08)}}
  .header{{background:{_BRAND};padding:28px 32px;text-align:center}}
  .header h1{{margin:0;color:#fff;font-size:20px;font-weight:700;letter-spacing:-.3px}}
  .header p{{margin:4px 0 0;color:#A8BFDC;font-size:12px}}
  .body{{padding:32px}}
  .body p{{margin:0 0 16px;color:{_TEXT};font-size:15px;line-height:1.6}}
  .cta{{display:inline-block;background:{_TEAL};color:{_BRAND};padding:13px 28px;text-decoration:none;border-radius:8px;font-weight:700;font-size:15px;margin:8px 0 20px}}
  .divider{{border:none;border-top:1px solid #E5E7EB;margin:24px 0}}
  .footer{{padding:0 32px 28px;text-align:center}}
  .footer p{{margin:0;color:{_MUTED};font-size:12px;line-height:1.7}}
  .label{{display:inline-block;background:#EEF2FF;color:#4F46E5;font-size:12px;font-weight:600;padding:3px 10px;border-radius:99px;margin-bottom:16px}}
</style>
</head>
<body>
<div class="wrap">
  <div class="header">
    <h1>CompliNow</h1>
    <p>Audit anything, anywhere</p>
  </div>
  <div class="body">
    {body_html}
  </div>
  <div class="footer">
    <hr class="divider" style="margin:0 0 20px">
    <p>You're receiving this because you have an account on CompliNow.<br>
    If you didn't request this, you can safely ignore it.</p>
  </div>
</div>
</body>
</html>"""


async def send_email(to: str, subject: str, body_html: str) -> bool:
    if settings.resend_api_key:
        return await _send_via_resend(to, subject, _wrap(body_html))
    if settings.smtp_host:
        return await _send_via_smtp(to, subject, _wrap(body_html))
    logger.info(f"No email transport configured. Would send to {to}: {subject}")
    return False


async def _send_via_resend(to: str, subject: str, html: str) -> bool:
    try:
        import httpx
        async with httpx.AsyncClient(timeout=10) as client:
            r = await client.post(
                "https://api.resend.com/emails",
                headers={"Authorization": f"Bearer {settings.resend_api_key}"},
                json={"from": settings.email_from, "to": [to], "subject": subject, "html": html},
            )
            r.raise_for_status()
            return True
    except Exception as e:
        logger.error(f"Resend failed sending to {to}: {e}")
        return False


async def _send_via_smtp(to: str, subject: str, html: str) -> bool:
    try:
        import aiosmtplib
        from email.mime.multipart import MIMEMultipart
        from email.mime.text import MIMEText
        msg = MIMEMultipart("alternative")
        msg["Subject"] = subject
        msg["From"] = settings.smtp_from
        msg["To"] = to
        msg.attach(MIMEText(html, "html"))
        await aiosmtplib.send(
            msg,
            hostname=settings.smtp_host,
            port=settings.smtp_port,
            username=settings.smtp_user,
            password=settings.smtp_pass,
            use_tls=settings.smtp_port == 465,
            start_tls=settings.smtp_port == 587,
        )
        return True
    except Exception as e:
        logger.error(f"SMTP failed sending to {to}: {e}")
        return False


async def send_certification_reminder(email: str, name: str, course_title: str, link: str, due: Optional[str] = None):
    due_line = f'<p><strong>Due by:</strong> {due}</p>' if due else ""
    body = f"""
    <span class="label">Certification Reminder</span>
    <p>Hi {name},</p>
    <p>You have a pending certification that requires your attention:</p>
    <p style="font-size:17px;font-weight:700;color:#1B3260;margin-bottom:8px">{course_title}</p>
    {due_line}
    <a href="{link}" class="cta">Start Certification &rarr;</a>
    <p style="font-size:13px;color:#6B7280">Button not working? Copy this link:<br>
    <span style="color:#1B3260;word-break:break-all">{link}</span></p>
    """
    await send_email(email, f"Certification Reminder: {course_title}", body)


async def send_corrective_action_notification(email: str, name: str, action_title: str, clinic: str, due: str):
    body = f"""
    <span class="label">Action Required</span>
    <p>Hi {name},</p>
    <p>A corrective action has been assigned to you and requires your attention.</p>
    <p style="background:#FEF3C7;border-left:3px solid #F59E0B;padding:12px 16px;border-radius:0 6px 6px 0;margin:16px 0">
      <strong>{action_title}</strong><br>
      <span style="color:#6B7280;font-size:13px">Location: {clinic} &nbsp;&bull;&nbsp; Due: {due}</span>
    </p>
    <p>Log in to CompliNow to review the details and submit your resolution.</p>
    """
    await send_email(email, f"Corrective Action Assigned: {action_title}", body)


async def send_password_reset(email: str, name: str, reset_url: str):
    body = f"""
    <span class="label">Password Reset</span>
    <p>Hi {name},</p>
    <p>We received a request to reset your CompliNow password. Click the button below — this link expires in <strong>30 minutes</strong>.</p>
    <a href="{reset_url}" class="cta">Reset Password &rarr;</a>
    <p style="font-size:13px;color:#6B7280">Didn't request this? You can safely ignore this email — your password won't change.<br><br>
    Or copy this link:<br><span style="color:#1B3260;word-break:break-all">{reset_url}</span></p>
    """
    await send_email(email, "Reset your CompliNow password", body)
