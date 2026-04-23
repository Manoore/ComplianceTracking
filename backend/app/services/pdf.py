import os
import io
import qrcode
from datetime import datetime
from reportlab.lib.pagesizes import letter, A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch
from reportlab.lib import colors
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle,
    HRFlowable, Image as RLImage
)
from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_RIGHT
from ..config import settings


BRAND_BLUE = colors.HexColor("#1E40AF")
BRAND_LIGHT = colors.HexColor("#EFF6FF")
PASS_GREEN = colors.HexColor("#16A34A")
FAIL_RED = colors.HexColor("#DC2626")
WARN_YELLOW = colors.HexColor("#D97706")
GRAY = colors.HexColor("#6B7280")


def _risk_color(risk: str) -> colors.Color:
    return {"low": PASS_GREEN, "medium": WARN_YELLOW, "high": FAIL_RED, "critical": colors.red}.get(risk or "low", GRAY)


def generate_audit_report(inspection, review, items, output_dir: str) -> str:
    os.makedirs(output_dir, exist_ok=True)
    filename = f"audit_report_{inspection.id}_{datetime.utcnow().strftime('%Y%m%d%H%M%S')}.pdf"
    filepath = os.path.join(output_dir, filename)

    doc = SimpleDocTemplate(filepath, pagesize=A4, topMargin=0.75*inch, bottomMargin=0.75*inch)
    styles = getSampleStyleSheet()
    story = []

    title_style = ParagraphStyle("title", parent=styles["Title"], textColor=BRAND_BLUE, fontSize=20)
    heading_style = ParagraphStyle("heading", parent=styles["Heading2"], textColor=BRAND_BLUE)
    sub_style = ParagraphStyle("sub", parent=styles["Normal"], textColor=GRAY, fontSize=9)

    story.append(Paragraph("Compliance Audit Report", title_style))
    story.append(Spacer(1, 0.1*inch))
    story.append(HRFlowable(width="100%", color=BRAND_BLUE))
    story.append(Spacer(1, 0.15*inch))

    info_data = [
        ["Clinic:", inspection.clinic.name if inspection.clinic else "N/A",
         "Inspection Date:", inspection.created_at.strftime("%Y-%m-%d") if inspection.created_at else ""],
        ["Inspector:", inspection.inspector.full_name if inspection.inspector else "N/A",
         "Auditor:", review.auditor.full_name if review and review.auditor else "N/A"],
        ["Compliance Score:", f"{inspection.compliance_score or 0:.1f}%",
         "Risk Level:", (inspection.risk_level or "N/A").upper()],
        ["Status:", (inspection.status.value if inspection.status else "N/A").replace("_", " ").title(),
         "Report Generated:", datetime.utcnow().strftime("%Y-%m-%d %H:%M UTC")],
    ]
    info_table = Table(info_data, colWidths=[1.5*inch, 2.2*inch, 1.5*inch, 2.2*inch])
    info_table.setStyle(TableStyle([
        ("FONTNAME", (0, 0), (-1, -1), "Helvetica"),
        ("FONTNAME", (0, 0), (0, -1), "Helvetica-Bold"),
        ("FONTNAME", (2, 0), (2, -1), "Helvetica-Bold"),
        ("FONTSIZE", (0, 0), (-1, -1), 9),
        ("BACKGROUND", (0, 0), (-1, -1), BRAND_LIGHT),
        ("ROWBACKGROUNDS", (0, 0), (-1, -1), [BRAND_LIGHT, colors.white]),
        ("GRID", (0, 0), (-1, -1), 0.5, colors.lightgrey),
        ("PADDING", (0, 0), (-1, -1), 6),
    ]))
    story.append(info_table)
    story.append(Spacer(1, 0.2*inch))

    if review and review.findings:
        story.append(Paragraph("Auditor Findings", heading_style))
        story.append(Paragraph(review.findings, styles["Normal"]))
        story.append(Spacer(1, 0.15*inch))

    story.append(Paragraph("Checklist Results", heading_style))
    rows = [["#", "Category", "Question", "Result", "Notes"]]
    for i, item in enumerate(items, 1):
        ci = item.checklist_item
        result = item.result.value if item.result else "pending"
        result_display = {"pass": "PASS", "fail": "FAIL", "na": "N/A", "pending": "—"}.get(result, result)
        rows.append([
            str(i),
            (ci.category.value if ci and ci.category else "").title(),
            ci.question if ci else "",
            result_display,
            (item.notes or "")[:80],
        ])

    items_table = Table(rows, colWidths=[0.3*inch, 1.0*inch, 3.2*inch, 0.6*inch, 2.0*inch])
    item_styles = [
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("BACKGROUND", (0, 0), (-1, 0), BRAND_BLUE),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("FONTSIZE", (0, 0), (-1, -1), 8),
        ("GRID", (0, 0), (-1, -1), 0.25, colors.lightgrey),
        ("PADDING", (0, 0), (-1, -1), 4),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, BRAND_LIGHT]),
    ]
    for i, item in enumerate(items, 1):
        result = item.result.value if item.result else "pending"
        if result == "pass":
            item_styles.append(("TEXTCOLOR", (3, i), (3, i), PASS_GREEN))
        elif result == "fail":
            item_styles.append(("TEXTCOLOR", (3, i), (3, i), FAIL_RED))

    items_table.setStyle(TableStyle(item_styles))
    story.append(items_table)

    doc.build(story)
    return filepath


def generate_certificate(cert, course, output_dir: str) -> str:
    os.makedirs(output_dir, exist_ok=True)
    filename = f"certificate_{cert.id}.pdf"
    filepath = os.path.join(output_dir, filename)

    doc = SimpleDocTemplate(filepath, pagesize=A4, topMargin=0.5*inch, bottomMargin=0.5*inch,
                            leftMargin=0.75*inch, rightMargin=0.75*inch)
    styles = getSampleStyleSheet()
    story = []

    center_blue = ParagraphStyle("cb", parent=styles["Normal"], alignment=TA_CENTER,
                                  textColor=BRAND_BLUE, fontSize=14, spaceAfter=6)
    center_large = ParagraphStyle("cl", parent=styles["Normal"], alignment=TA_CENTER,
                                   fontSize=28, spaceAfter=12, fontName="Helvetica-Bold")
    center_name = ParagraphStyle("cn", parent=styles["Normal"], alignment=TA_CENTER,
                                  fontSize=22, textColor=BRAND_BLUE, fontName="Helvetica-Bold", spaceAfter=8)
    center_small = ParagraphStyle("cs", parent=styles["Normal"], alignment=TA_CENTER,
                                   fontSize=10, textColor=GRAY, spaceAfter=4)

    story.append(Spacer(1, 0.3*inch))
    story.append(HRFlowable(width="100%", color=BRAND_BLUE, thickness=3))
    story.append(Spacer(1, 0.2*inch))
    story.append(Paragraph("CERTIFICATE OF COMPLETION", center_large))
    story.append(Paragraph("This is to certify that", center_blue))
    story.append(Spacer(1, 0.1*inch))
    story.append(Paragraph(cert.participant_name, center_name))
    story.append(Spacer(1, 0.1*inch))
    story.append(Paragraph("has successfully completed", center_blue))
    story.append(Spacer(1, 0.1*inch))
    story.append(Paragraph(course.title, center_large))
    story.append(Spacer(1, 0.15*inch))

    score_text = f"Score: {cert.score:.1f}%" if cert.score else ""
    completed = cert.completed_at.strftime("%B %d, %Y") if cert.completed_at else ""
    expires = cert.expires_at.strftime("%B %d, %Y") if cert.expires_at else ""

    story.append(Paragraph(score_text, center_blue))
    story.append(Paragraph(f"Completed: {completed}", center_small))
    if expires:
        story.append(Paragraph(f"Valid Until: {expires}", center_small))

    story.append(Spacer(1, 0.2*inch))
    story.append(HRFlowable(width="100%", color=BRAND_BLUE, thickness=1))
    story.append(Spacer(1, 0.1*inch))

    verify_url = f"{settings.frontend_url}/verify/{cert.id}"
    qr = qrcode.QRCode(box_size=4, border=2)
    qr.add_data(verify_url)
    qr.make(fit=True)
    qr_img = qr.make_image(fill_color="black", back_color="white")
    qr_buffer = io.BytesIO()
    qr_img.save(qr_buffer, format="PNG")
    qr_buffer.seek(0)

    qr_rl = RLImage(qr_buffer, width=1.0*inch, height=1.0*inch)
    story.append(Table([[qr_rl, Paragraph(f"Verify: {verify_url}", center_small)]],
                       colWidths=[1.2*inch, 6*inch]))
    story.append(Spacer(1, 0.1*inch))
    story.append(Paragraph(f"Certificate ID: {cert.id}", center_small))

    doc.build(story)
    return filepath
