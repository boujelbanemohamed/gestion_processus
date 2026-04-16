from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import cm
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, PageBreak
from reportlab.lib.enums import TA_CENTER, TA_LEFT
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
SOURCE_MD = ROOT / "docs" / "specifications_fonctionnelles_pmo_hub.md"
OUTPUT_PDF = ROOT / "docs" / "specifications_fonctionnelles_pmo_hub.pdf"


def parse_markdown(md_text: str):
    lines = md_text.splitlines()
    blocks = []
    for raw in lines:
        line = raw.rstrip()
        if not line.strip():
            blocks.append(("blank", ""))
            continue
        if line.startswith("### "):
            blocks.append(("h3", line[4:].strip()))
        elif line.startswith("## "):
            blocks.append(("h2", line[3:].strip()))
        elif line.startswith("# "):
            blocks.append(("h1", line[2:].strip()))
        elif line.startswith("- "):
            blocks.append(("li", line[2:].strip()))
        elif line.startswith(("1. ", "2. ", "3. ", "4. ", "5. ", "6. ", "7. ", "8. ", "9. ")):
            blocks.append(("num", line))
        elif line.strip() == "---":
            blocks.append(("sep", ""))
        else:
            blocks.append(("p", line))
    return blocks


def build_pdf():
    md_text = SOURCE_MD.read_text(encoding="utf-8")
    blocks = parse_markdown(md_text)

    doc = SimpleDocTemplate(
        str(OUTPUT_PDF),
        pagesize=A4,
        rightMargin=2 * cm,
        leftMargin=2 * cm,
        topMargin=1.8 * cm,
        bottomMargin=1.8 * cm,
        title="Specifications Fonctionnelles PMO HUB",
        author="PMO HUB",
    )

    styles = getSampleStyleSheet()
    style_h1 = ParagraphStyle(
        "H1Custom",
        parent=styles["Heading1"],
        fontName="Helvetica-Bold",
        fontSize=18,
        leading=22,
        spaceBefore=10,
        spaceAfter=10,
        alignment=TA_CENTER,
    )
    style_h2 = ParagraphStyle(
        "H2Custom",
        parent=styles["Heading2"],
        fontName="Helvetica-Bold",
        fontSize=14,
        leading=18,
        spaceBefore=10,
        spaceAfter=6,
        alignment=TA_LEFT,
    )
    style_h3 = ParagraphStyle(
        "H3Custom",
        parent=styles["Heading3"],
        fontName="Helvetica-Bold",
        fontSize=11.5,
        leading=15,
        spaceBefore=6,
        spaceAfter=3,
        alignment=TA_LEFT,
    )
    style_p = ParagraphStyle(
        "PCustom",
        parent=styles["BodyText"],
        fontName="Helvetica",
        fontSize=10.5,
        leading=14,
        spaceBefore=0,
        spaceAfter=4,
        alignment=TA_LEFT,
    )
    style_li = ParagraphStyle(
        "LiCustom",
        parent=style_p,
        leftIndent=12,
        bulletIndent=4,
    )

    story = []
    cover_done = False
    for kind, text in blocks:
        if not cover_done and kind == "h1":
            story.append(Spacer(1, 5 * cm))
            story.append(Paragraph(text, style_h1))
            cover_done = True
            continue

        if kind == "h1":
            story.append(PageBreak())
            story.append(Paragraph(text, style_h1))
        elif kind == "h2":
            story.append(Paragraph(text, style_h2))
        elif kind == "h3":
            story.append(Paragraph(text, style_h3))
        elif kind == "p":
            story.append(Paragraph(text.replace("&", "&amp;"), style_p))
        elif kind == "li":
            safe = text.replace("&", "&amp;")
            story.append(Paragraph(f"• {safe}", style_li))
        elif kind == "num":
            safe = text.replace("&", "&amp;")
            story.append(Paragraph(safe, style_p))
        elif kind == "sep":
            story.append(Spacer(1, 8))
        elif kind == "blank":
            story.append(Spacer(1, 5))

    doc.build(story)


if __name__ == "__main__":
    build_pdf()
    print(f"PDF genere: {OUTPUT_PDF}")

