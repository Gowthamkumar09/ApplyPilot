"""Resume parsing. CV text is untrusted: it is only ever treated as data."""
import io
import re
from fastapi import HTTPException

SKILL_VOCAB = [
    "python", "java", "javascript", "typescript", "c++", "c#", "go", "rust", "sql", "react", "node.js",
    "fastapi", "django", "flask", "spring", "html", "css", "tailwind", "docker", "kubernetes", "aws",
    "azure", "gcp", "git", "linux", "postgresql", "mongodb", "redis", "tensorflow", "pytorch",
    "scikit-learn", "pandas", "numpy", "machine learning", "deep learning", "nlp", "computer vision",
    "data analysis", "power bi", "tableau", "excel", "rest api", "graphql", "ci/cd", "llm", "langchain",
    "figma", "communication", "leadership",
]
SECTION_HEADS = {
    "education": r"education|academic",
    "skills": r"skills|technical skills|competencies",
    "projects": r"projects?|personal projects",
    "experience": r"experience|internships?|work history|employment",
    "certifications": r"certifications?|licenses|courses",
}
MAGIC = {".pdf": b"%PDF", ".docx": b"PK"}


def validate_upload(filename: str, data: bytes, max_mb: int):
    ext = "." + filename.lower().rsplit(".", 1)[-1] if "." in filename else ""
    if ext not in MAGIC:
        raise HTTPException(400, "Upload a PDF or DOCX file.")
    if len(data) > max_mb * 1024 * 1024:
        raise HTTPException(413, f"File is larger than {max_mb} MB.")
    if not data.startswith(MAGIC[ext]):
        raise HTTPException(400, "File contents do not match its extension.")
    return ext


def extract_text(ext: str, data: bytes) -> str:
    try:
        if ext == ".pdf":
            from pypdf import PdfReader
            reader = PdfReader(io.BytesIO(data))
            text = "\n".join((p.extract_text() or "") for p in reader.pages)
        else:
            import docx
            d = docx.Document(io.BytesIO(data))
            text = "\n".join(p.text for p in d.paragraphs)
    except Exception:
        raise HTTPException(422, "Could not read this file. It may be corrupted or password-protected.")
    if len(text.strip()) < 40:
        raise HTTPException(422, "No readable text found. Scanned PDFs need OCR, which is not supported yet.")
    return text


def split_sections(text: str) -> dict[str, list[str]]:
    out: dict[str, list[str]] = {}
    current = None
    for line in text.splitlines():
        s = line.strip()
        if not s:
            continue
        matched = None
        if len(s) < 40:
            for key, pat in SECTION_HEADS.items():
                if re.fullmatch(rf"(?i)\W*({pat})\W*", s):
                    matched = key
                    break
        if matched:
            current = matched
            out.setdefault(current, [])
        elif current:
            out[current].append(s.lstrip("•-*· ").strip())
    return out


def parse_resume(text: str) -> dict:
    lower = text.lower()
    email = re.search(r"[\w.+-]+@[\w-]+\.[\w.-]+", text)
    phone = re.search(r"(\+?\d[\d\s().-]{8,15}\d)", text)
    first_lines = [l.strip() for l in text.splitlines() if l.strip()][:3]
    name = next((l for l in first_lines if 2 <= len(l.split()) <= 4 and "@" not in l
                 and not re.search(r"\d", l)), "")
    sections = split_sections(text)
    skills = [s for s in SKILL_VOCAB if re.search(rf"(?<![\w+#]){re.escape(s)}(?![\w+#])", lower)]
    years = [int(y) for y in re.findall(r"\b(20\d{2})\b", text)]
    return {
        "name": name, "email": email.group(0) if email else "", "phone": phone.group(1).strip() if phone else "",
        "education": sections.get("education", [])[:6], "skills": skills,
        "projects": sections.get("projects", [])[:10], "experience": sections.get("experience", [])[:12],
        "certifications": sections.get("certifications", [])[:8],
        "years_mentioned": sorted(set(years))[-4:],
        "sections_found": sorted(sections.keys()),
    }
