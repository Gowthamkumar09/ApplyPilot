"""Transparent, rule-based resume scoring. Every point is traceable to a check below."""
import re

METHODOLOGY = (
    "The score is a heuristic out of 100 built from six fixed checks (contact details, section "
    "structure, skills coverage, quantified achievements, projects/experience depth, length and "
    "readability). It estimates how complete and parseable the resume looks. It is not a real ATS "
    "result and does not predict interviews or selection."
)
WEAK_OPENERS = ("responsible for", "worked on", "helped", "assisted", "involved in", "duties included")


def analyze(parsed: dict, text: str) -> dict:
    breakdown, issues, recs = [], [], []

    def add(name, got, mx, note):
        breakdown.append({"check": name, "score": round(got, 1), "max": mx, "note": note})

    # Contact (10)
    c = (4 if parsed["email"] else 0) + (3 if parsed["phone"] else 0) + (3 if parsed["name"] else 0)
    add("Contact details", c, 10, "Name, email and phone found" if c == 10 else "Some contact details are missing")
    if not parsed["email"]:
        issues.append("No email address detected.")
    if not parsed["phone"]:
        issues.append("No phone number detected.")

    # Structure (20)
    found = set(parsed["sections_found"])
    core = {"education", "skills", "projects", "experience"}
    s = 5 * len(core & found)
    add("Section structure", s, 20, f"Found: {', '.join(sorted(found)) or 'none'}")
    for m in sorted(core - found):
        issues.append(f"No clearly labelled '{m.title()}' section. ATS parsers rely on standard headings.")

    # Skills (20)
    n = len(parsed["skills"])
    sk = min(20, n * 2)
    add("Skills coverage", sk, 20, f"{n} recognised skills (full credit at 10)")
    if n < 8:
        recs.append("List more specific tools and technologies you have actually used, grouped by category.")

    # Quantified achievements (15)
    lines = parsed["projects"] + parsed["experience"]
    quant = [l for l in lines if re.search(r"\d+%|\d+\+?\s*(users|requests|ms|x|k|m)\b|\$\d|₹\d|\b\d{2,}\b", l)]
    q = min(15, len(quant) * 5)
    add("Quantified achievements", q, 15, f"{len(quant)} bullet(s) contain measurable results (full credit at 3)")
    if len(quant) < 3:
        recs.append("Add numbers to bullets: users, accuracy, speed-ups, team size, or data volume.")

    # Depth (20)
    d = min(10, len(parsed["projects"]) * 2.5) + min(10, len(parsed["experience"]) * 2.5)
    add("Project and experience depth", d, 20, f"{len(parsed['projects'])} project line(s), {len(parsed['experience'])} experience line(s)")
    if not parsed["projects"] and not parsed["experience"]:
        issues.append("No projects or experience content detected.")

    # Readability (15)
    words = len(text.split())
    r = 15
    if words < 150:
        r -= 8; issues.append(f"Resume is very short ({words} words).")
    elif words > 1000:
        r -= 6; issues.append(f"Resume is long ({words} words). One to two pages is typical.")
    weak = [l for l in lines if l.lower().startswith(WEAK_OPENERS)]
    if weak:
        r -= min(5, len(weak)); issues.append(f"{len(weak)} bullet(s) start with weak phrasing.")
    add("Length and clarity", max(r, 0), 15, f"{words} words")

    total = round(sum(b["score"] for b in breakdown))
    examples = []
    for l in weak[:2]:
        examples.append({"before": l, "after": re.sub(r"(?i)^(responsible for|worked on|helped|assisted|involved in|duties included)\s*",
                         "Built / Led / Improved ", l) + " (add a measurable result)"})
    for l in [x for x in lines if x not in quant and x not in weak][:2]:
        examples.append({"before": l, "after": l.rstrip(".") + ", improving [metric] by [X%] for [N] users."})
    missing = [k for k in ["git", "docker", "sql", "rest api", "ci/cd", "cloud (aws/azure/gcp)"]
               if k not in parsed["skills"] and not (k.startswith("cloud") and {"aws", "azure", "gcp"} & set(parsed["skills"]))]
    grade = "Strong" if total >= 80 else "Solid" if total >= 60 else "Needs work"
    ats = "Likely readable" if {"education", "skills"} <= found and parsed["email"] else "Risky: missing standard sections or contact info"
    return {"score": total, "grade": grade, "ats_readability": ats, "breakdown": breakdown, "issues": issues,
            "recommendations": recs or ["Tailor the skills and summary lines to each role you apply for."],
            "missing_keywords": missing[:6], "before_after": examples, "methodology": METHODOLOGY}
