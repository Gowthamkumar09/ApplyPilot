"""Job-specific match scoring. Stricter rules: irrelevant, too-senior and region-locked jobs score low."""
import re

WEIGHTS = {"skills": 45, "experience": 15, "location": 15, "role": 15, "education": 10}
SENIOR = re.compile(r"\b(senior|sr|lead|principal|staff|head of|director|manager|architect)\b")
HOME_TERMS = ("worldwide", "anywhere", "global", "india", "apac", "asia", "remote")


def match(profile, job) -> dict:
    mine = {s.lower() for s in (profile.skills or [])}
    req, pref = [s.lower() for s in job.required_skills], [s.lower() for s in job.preferred_skills]
    hit_req, hit_pref = [s for s in req if s in mine], [s for s in pref if s in mine]
    reasons, gaps, cap = [], [], 100
    title = job.title.lower()
    roles = [r.lower() for r in (profile.preferred_roles or [])]
    title_match = bool(roles) and any(r in title or any(w in title for w in r.split() if len(w) > 3) for r in roles)

    if req:
        r = len(hit_req) / len(req)
        skills = WEIGHTS["skills"] * ((0.8 * r + 0.2 * len(hit_pref) / len(pref)) if pref else r)
        if hit_req: reasons.append(f"Matches {len(hit_req)}/{len(req)} required skills: {', '.join(hit_req)}.")
        if len(hit_req) < len(req): gaps.append(f"Missing required skills: {', '.join(s for s in req if s not in mine)}.")
    elif pref:
        skills = WEIGHTS["skills"] * 0.6 * len(hit_pref) / len(pref)
    else:
        skills = 0
        gaps.append("No recognisable skills listed, so relevance is unclear.")
    if not (hit_req or hit_pref or title_match):
        cap = min(cap, 30)
        gaps.append("Little overlap with your skills or target roles.")

    eff = job.experience_min or (4 if SENIOR.search(title) else 0)
    gap = eff - (profile.experience_years or 0)
    if gap <= 0:
        exp = WEIGHTS["experience"]; reasons.append("Meets the experience requirement.")
    else:
        exp = max(0, WEIGHTS["experience"] * (1 - gap / 2))
        gaps.append(f"Expects about {eff:g}+ years; your profile shows {profile.experience_years:g}.")
        if gap >= 3: cap = min(cap, 45)
        elif gap >= 2: cap = min(cap, 60)

    loc_l = job.location.lower()
    locs = [l.lower() for l in (profile.preferred_locations or [])]
    restricted = job.remote and loc_l not in ("", "not stated") and not any(h in loc_l for h in HOME_TERMS)
    if restricted:
        loc = 0; cap = min(cap, 55); gaps.append(f"Remote, but limited to: {job.location}.")
    elif job.remote and profile.remote_ok:
        loc = WEIGHTS["location"]; reasons.append("Remote role and you are open to remote.")
    elif any(l in loc_l for l in locs):
        loc = WEIGHTS["location"]; reasons.append(f"Located in a preferred city ({job.location}).")
    elif not locs and not profile.remote_ok:
        loc = WEIGHTS["location"] * 0.5
    else:
        loc = WEIGHTS["location"] * 0.2; gaps.append(f"Location ({job.location}) is outside your preferences.")

    if not roles:
        role = WEIGHTS["role"] * 0.5
    elif title_match:
        role = WEIGHTS["role"]; reasons.append("Title fits your preferred roles.")
    else:
        role = 0; gaps.append("Title does not match your preferred roles.")

    edu_text = " ".join(profile.education or []).lower()
    edu = WEIGHTS["education"] if edu_text else WEIGHTS["education"] * 0.5
    if not edu_text: gaps.append("No education in profile, so eligibility could not be checked.")
    return {"score": min(round(skills + exp + loc + role + edu), cap), "reasons": reasons, "gaps": gaps}
