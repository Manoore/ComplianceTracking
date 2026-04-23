import asyncio
import logging
from typing import Optional
from ..config import settings

logger = logging.getLogger(__name__)


async def send_email(to: str, subject: str, body_html: str) -> bool:
    if not settings.smtp_host:
        logger.info(f"Email not configured. Would send to {to}: {subject}")
        return False
    try:
        import aiosmtplib
        from email.mime.multipart import MIMEMultipart
        from email.mime.text import MIMEText

        msg = MIMEMultipart("alternative")
        msg["Subject"] = subject
        msg["From"] = settings.smtp_from
        msg["To"] = to
        msg.attach(MIMEText(body_html, "html"))

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
        logger.error(f"Failed to send email to {to}: {e}")
        return False


async def send_certification_reminder(email: str, name: str, course_title: str, link: str, due: Optional[str] = None):
    due_line = f"<p>Due by: <strong>{due}</strong></p>" if due else ""
    body = f"""
    <html><body>
    <h2>Compliance Certification Reminder</h2>
    <p>Hi {name},</p>
    <p>You have a pending certification: <strong>{course_title}</strong></p>
    {due_line}
    <p><a href="{link}" style="background:#3B82F6;color:#fff;padding:10px 20px;text-decoration:none;border-radius:4px;">
       Start Certification
    </a></p>
    <p>If the button doesn't work, copy this link: {link}</p>
    </body></html>
    """
    await send_email(email, f"Certification Reminder: {course_title}", body)


async def send_corrective_action_notification(email: str, name: str, action_title: str, clinic: str, due: str):
    body = f"""
    <html><body>
    <h2>Corrective Action Assigned</h2>
    <p>Hi {name},</p>
    <p>A corrective action has been assigned to you:</p>
    <p><strong>{action_title}</strong> at {clinic}</p>
    <p>Due by: <strong>{due}</strong></p>
    <p>Please log in to review and resolve this action.</p>
    </body></html>
    """
    await send_email(email, f"Corrective Action: {action_title}", body)
