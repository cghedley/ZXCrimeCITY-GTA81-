#!/usr/bin/env python3
"""Turn open "[score]" issues into entries in docs/data/scores.json.

Issue text is treated purely as data: it is parsed with regular expressions and
never passed to a shell.
"""
import json, os, re, subprocess, sys, time, urllib.request, urllib.error

SCORES = os.environ.get("SCORES_FILE", "docs/data/scores.json")
MAX_KEEP = 20          # entries kept in the file (the game shows the top 5)
PER_USER = 3           # entries kept per GitHub account
MAX_SCORE = 65535      # the game stores the score in 16 bits


def check_code(n, s):
    h = 0x811C9DC5
    for ch in f"{n}:{s}:crimecity".encode("utf-8"):
        h ^= ch
        h = (h * 0x01000193) & 0xFFFFFFFF
    return f"{h:08x}"


def parse_form(body):
    """Issue forms render as '### Label' headings followed by the value."""
    fields = {}
    for m in re.finditer(r"^### +(.+?)\s*\n+(.*?)(?=^### |\Z)", body or "", re.S | re.M):
        fields[m.group(1).strip().lower()] = m.group(2).strip()
    return fields


def evaluate(issue, entries):
    """Return (status, message, entry). status: added | low | rejected."""
    user = (issue.get("user") or {}).get("login", "")
    if (issue.get("user") or {}).get("type") == "Bot":
        return "rejected", "Scores from bots are not accepted.", None
    f = parse_form(issue.get("body"))
    n = f.get("initials", "").upper()
    s = f.get("score", "")
    code = f.get("check code", "").lower()
    if not re.fullmatch(r"[A-Z]{3}", n):
        return "rejected", "Initials must be exactly three letters A to Z.", None
    if not re.fullmatch(r"\d{1,5}", s) or not (1 <= int(s) <= MAX_SCORE):
        return "rejected", f"Score must be a whole number from 1 to {MAX_SCORE}.", None
    s = int(s)
    if code != check_code(n, s):
        return "rejected", "The check code does not match. Please submit scores from the game itself.", None
    if any(e.get("by") == user and e["n"] == n and e["s"] == s for e in entries):
        return "rejected", "You have already submitted this score.", None
    entry = {"n": n, "s": s, "by": user, "t": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())}
    merged = entries + [entry]
    merged.sort(key=lambda e: -e["s"])           # stable: earlier entries win ties
    seen, kept = {}, []
    for e in merged:
        seen[e["by"]] = seen.get(e["by"], 0) + 1
        if seen[e["by"]] <= PER_USER:
            kept.append(e)
    kept = kept[:MAX_KEEP]
    if entry not in kept:
        better = sum(1 for e in entries if e.get("by") == user and e["s"] >= s)
        if better >= PER_USER:
            return "low", f"Thanks! The table already holds {PER_USER} higher scores from you, so {n} {s} was not added.", None
        return "low", f"Thanks! {n} {s} did not make the top {MAX_KEEP} this time.", None
    return "added", f"Added {n} {s} to the table. It will show in the game within a couple of minutes.", kept


class Api:
    def __init__(self, token, repo):
        self.token, self.repo = token, repo

    def call(self, method, path, data=None):
        req = urllib.request.Request(
            "https://api.github.com/repos/" + self.repo + path,
            method=method,
            data=json.dumps(data).encode() if data is not None else None,
            headers={"Authorization": "Bearer " + self.token, "Accept": "application/vnd.github+json",
                     "User-Agent": "crimecity-score-bot", "X-GitHub-Api-Version": "2022-11-28"})
        with urllib.request.urlopen(req, timeout=30) as r:
            body = r.read()
            return json.loads(body) if body else None

    def open_score_issues(self):
        out, page = [], 1
        while True:
            items = self.call("GET", f"/issues?state=open&per_page=100&sort=created&direction=asc&page={page}")
            out += [i for i in items if "pull_request" not in i and i.get("title", "").startswith("[score]")]
            if len(items) < 100:
                return out
            page += 1

    def finish(self, number, message, completed):
        self.call("POST", f"/issues/{number}/comments", {"body": message})
        self.call("PATCH", f"/issues/{number}", {"state": "closed", "state_reason": "completed" if completed else "not_planned"})


def git(*args):
    return subprocess.run(["git", *args], check=True, capture_output=True, text=True)


def commit_and_push():
    git("config", "user.name", "crimecity-score-bot")
    git("config", "user.email", "actions@users.noreply.github.com")
    git("add", SCORES)
    if subprocess.run(["git", "diff", "--cached", "--quiet"]).returncode == 0:
        return
    git("commit", "-m", "Add high score")
    try:
        git("push")
    except subprocess.CalledProcessError:
        git("pull", "--rebase")
        git("push")


def run(api, push=commit_and_push):
    with open(SCORES) as fh:
        entries = json.load(fh).get("entries", [])
    results, changed = [], False
    for issue in api.open_score_issues():
        status, msg, kept = evaluate(issue, entries)
        if status == "added":
            entries, changed = kept, True
        results.append((issue["number"], status, msg))
    if changed:
        with open(SCORES, "w") as fh:
            json.dump({"entries": entries}, fh, indent=1)
            fh.write("\n")
        push()                      # if this raises, the issues stay open and are retried next run
    for number, status, msg in results:
        api.finish(number, msg, completed=(status in ("added", "low")))
    return results


if __name__ == "__main__":
    run(Api(os.environ["GITHUB_TOKEN"], os.environ["GITHUB_REPOSITORY"]))
