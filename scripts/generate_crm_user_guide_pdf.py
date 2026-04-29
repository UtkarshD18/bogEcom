from pathlib import Path

from reportlab.lib.pagesizes import LETTER
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch
from reportlab.platypus import ListFlowable, ListItem, Paragraph, SimpleDocTemplate, Spacer

BASE_DIR = Path(__file__).resolve().parents[1]
OUTPUT_PATH = BASE_DIR / "_deliverables" / "CRM_User_Guide.pdf"


def bullet_list(items, style, bullet_indent=12):
    return ListFlowable(
        [ListItem(Paragraph(item, style)) for item in items],
        bulletType="bullet",
        start="bullet",
        bulletIndent=bullet_indent,
        leftIndent=bullet_indent,
    )


def main():
    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)

    styles = getSampleStyleSheet()
    styles.add(
        ParagraphStyle(
            name="Heading1Large",
            parent=styles["Heading1"],
            fontSize=18,
            leading=22,
            spaceAfter=12,
        )
    )
    styles.add(
        ParagraphStyle(
            name="Heading2Space",
            parent=styles["Heading2"],
            spaceBefore=6,
            spaceAfter=6,
        )
    )
    styles.add(
        ParagraphStyle(
            name="BodySpace",
            parent=styles["BodyText"],
            leading=14,
            spaceAfter=6,
        )
    )

    doc = SimpleDocTemplate(
        str(OUTPUT_PATH),
        pagesize=LETTER,
        leftMargin=0.9 * inch,
        rightMargin=0.9 * inch,
        topMargin=0.8 * inch,
        bottomMargin=0.8 * inch,
        title="BuyOneGram CRM - Non-Technical User Guide",
    )

    story = []
    story.append(Paragraph("BuyOneGram CRM - Non-Technical User Guide", styles["Heading1Large"]))
    story.append(Paragraph("Purpose", styles["Heading2Space"]))
    story.append(
        Paragraph(
            "This guide explains how to use the CRM screen to view contacts and send WhatsApp messages or campaigns.",
            styles["BodySpace"],
        )
    )

    story.append(Paragraph("1) CRM Contacts List", styles["Heading2Space"]))
    story.append(Paragraph("What you see", styles["BodySpace"]))
    story.append(
        bullet_list(
            [
                "A table of contacts with stage, status, spend, and last activity.",
                "Filters for Search, Channel, Lifecycle, and Status.",
            ],
            styles["BodySpace"],
        )
    )
    story.append(Paragraph("What to do", styles["BodySpace"]))
    story.append(
        bullet_list(
            [
                "Use Search to find a customer by name, email, or phone.",
                "Click a contact row to open their details and messaging tools.",
                "Use Clear Filters to reset the list.",
            ],
            styles["BodySpace"],
        )
    )

    story.append(Paragraph("2) Contact Details (Right Side Card)", styles["Heading2Space"]))
    story.append(Paragraph("What you see", styles["BodySpace"]))
    story.append(
        bullet_list(
            [
                "Contact stage and status",
                "Consent flags (WhatsApp, Email, Push)",
                "Phone number and recent activity",
            ],
            styles["BodySpace"],
        )
    )
    story.append(Paragraph("What to do", styles["BodySpace"]))
    story.append(
        bullet_list(
            [
                "If WhatsApp Consent is not Allowed, update it before sending WhatsApp messages.",
                "Click Save Contact after changing stage, status, or consent.",
            ],
            styles["BodySpace"],
        )
    )

    story.append(Paragraph("3) WhatsApp Message Center (Single Contact)", styles["Heading2Space"]))
    story.append(
        Paragraph(
            "Use this for one customer at a time.",
            styles["BodySpace"],
        )
    )
    story.append(Paragraph("Step A - Choose Send Mode", styles["BodySpace"]))
    story.append(
        bullet_list(
            [
                "Personal Text Reply",
                "Template Message",
                "Image Message",
                "GIF Message",
            ],
            styles["BodySpace"],
        )
    )
    story.append(Paragraph("Step B - Fill the fields (by mode)", styles["BodySpace"]))
    story.append(Paragraph("Personal Text Reply", styles["BodySpace"]))
    story.append(
        bullet_list(
            [
                "Use this only if the customer already chatted with you.",
                "Message: type your message.",
                "Campaign Label (optional): any label like Support Follow-up.",
            ],
            styles["BodySpace"],
        )
    )
    story.append(Paragraph("Template Message (Recommended for first outreach)", styles["BodySpace"]))
    story.append(
        bullet_list(
            [
                "Approved Template: select from dropdown.",
                "Language Code: must match template (example: en or en_US).",
                "Header Variables: only if your template header has variables.",
                "Body Variables: values for {{1}}, {{2}}, etc.",
                "Example body: Hi {{1}}, your offer is {{2}}.",
                "Body Variables example: Ravi, 20% OFF.",
            ],
            styles["BodySpace"],
        )
    )
    story.append(Paragraph("Image Message", styles["BodySpace"]))
    story.append(
        bullet_list(
            [
                "Click Upload Media.",
                "Select an image file from your computer.",
                "Caption (optional): add a short text below the image.",
            ],
            styles["BodySpace"],
        )
    )
    story.append(Paragraph("GIF Message", styles["BodySpace"]))
    story.append(
        bullet_list(
            [
                "Click Upload Media.",
                "Select a GIF or MP4 file from your computer.",
                "Caption (optional): add a short text below the GIF or video.",
            ],
            styles["BodySpace"],
        )
    )
    story.append(Paragraph("Step C - Send", styles["BodySpace"]))
    story.append(
        bullet_list(
            [
                "Click Send WhatsApp Message.",
                "Confirm the popup before it sends.",
            ],
            styles["BodySpace"],
        )
    )

    story.append(Paragraph("4) WhatsApp Campaigns (Mass Messaging)", styles["Heading2Space"]))
    story.append(
        Paragraph(
            "Use this to send templates to many contacts at once.",
            styles["BodySpace"],
        )
    )
    story.append(Paragraph("Step A - Fill the campaign form", styles["BodySpace"]))
    story.append(
        bullet_list(
            [
                "Audience Segment: choose who receives the message (All Consented, Customers, Inactive, VIP).",
                "Inactive Window (days): use 45 unless told otherwise.",
                "Approved Template: choose from dropdown.",
                "Language Code: must match template (example: en or en_US).",
                "Header Variables: only if the template header has variables.",
                "Body Variables: enter values for {{1}}, {{2}}, etc.",
                "Campaign Label: any label like April Winback.",
            ],
            styles["BodySpace"],
        )
    )
    story.append(Paragraph("Step B - Check audience preview", styles["BodySpace"]))
    story.append(
        bullet_list(
            [
                "Click Refresh Preview.",
                "Confirm the number of contacts in the preview.",
            ],
            styles["BodySpace"],
        )
    )
    story.append(Paragraph("Step C - Send", styles["BodySpace"]))
    story.append(
        bullet_list(
            [
                "Click Send WhatsApp Campaign.",
                "Confirm the popup.",
            ],
            styles["BodySpace"],
        )
    )

    story.append(Paragraph("5) Common Field Examples", styles["Heading2Space"]))
    story.append(Paragraph("Template with 2 variables", styles["BodySpace"]))
    story.append(
        bullet_list(
            [
                "Template body: Hi {{1}}, enjoy {{2}} today!",
                "Body Variables line 1: customer name.",
                "Body Variables line 2: offer text.",
                "Example values: Amit, 15% OFF on Peanut Butter.",
            ],
            styles["BodySpace"],
        )
    )
    story.append(Paragraph("Template with no variables", styles["BodySpace"]))
    story.append(
        bullet_list(
            [
                "Body Variables: leave empty.",
                "Header Variables: leave empty.",
            ],
            styles["BodySpace"],
        )
    )

    story.append(Paragraph("6) Status Messages You Might See", styles["Heading2Space"]))
    story.append(
        bullet_list(
            [
                "API Needs Config: WhatsApp credentials are invalid or expired.",
                "Template Sync Manual: approved templates could not be pulled.",
                "If you see these errors, contact the tech team.",
            ],
            styles["BodySpace"],
        )
    )

    story.append(Paragraph("7) Quick Checklist", styles["Heading2Space"]))
    story.append(
        bullet_list(
            [
                "Contact is selected.",
                "WhatsApp consent is Allowed.",
                "Template name and language match.",
                "Variables match the template count.",
                "For media: file uploaded from your PC.",
            ],
            styles["BodySpace"],
        )
    )

    story.append(Paragraph("8) Need Help?", styles["Heading2Space"]))
    story.append(
        bullet_list(
            [
                "Confirm WhatsApp API health status in the CRM panel.",
                "Confirm the template is approved by Meta.",
                "Contact the admin or tech team for assistance.",
            ],
            styles["BodySpace"],
        )
    )

    doc.build(story)


if __name__ == "__main__":
    main()
