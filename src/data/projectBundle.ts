// Authentic FNV-1a 32-bit check code matching index.html and .github/scripts/add_score.py
export function computeCheckCode(n: string, s: number): string {
  const clean = (n || 'AAA').toUpperCase().replace(/[^A-Z]/g, '').slice(0, 3).padEnd(3, 'A');
  const score = Math.max(1, Math.min(65535, Math.floor(s)));
  const str = `${clean}:${score}:crimecity`;
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return ('00000000' + h.toString(16)).slice(-8);
}

export interface ScoreEntry {
  n: string;       // 3-letter initials
  s: number;       // 16-bit score (1..65535)
  by?: string;     // GitHub login
  t?: string | number;
  runs?: number;   // Number of games run before/during submission
  pending?: boolean;
}

export interface LeaderboardStats {
  totalUsers: number;
  totalRuns: number;
}

// The exact Z80 symbols from web/sym.json
export const SYM = {
  start: 16514,
  main: 16517,
  rnd: 16534,
  wall: 16555,
  newframe: 16649,
  pausef: 16660,
  newgame: 16979,
  gameloop: 17065,
  tick: 17099,
  title: 18326,
  drawhs: 18380,
  qualify: 18461,
  getname: 18477,
  inserths: 18517,
  gameover: 18598,
  go2: 18665,
  HS: 19026,
  SEED: 19051,
  LASTF: 19053,
  VARS: 19054,
  PY: 19054,
  PX: 19055,
  DY: 19056,
  DX: 19057,
  INCAR: 19058,
  CARHP: 19059,
  LIVES: 19060,
  WANT: 19061,
  TWANT: 19062,
  TC: 19063,
  FC: 19064,
  MSTATE: 19065,
  MKY: 19066,
  MKX: 19067,
  NY: 19068,
  NX: 19069,
  MTIME: 19070,
  MSEC: 19071,
  KEYBUF: 19072,
  SCORE: 19073,
  NAMEBUF: 19085,
  peds: 19093,
  cars: 19101,
  cop: 19113,
  VARSEND: 19119,
};

// The exact compiled Z80 machine-code .P tape image (dist/crimecity_mc.p) encoded in Base64 from docs/index.html
export const PB64 =
  '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AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAB2AAILAPnUxQsdIiEdIAt2dgAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAdgAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAdgAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAdgAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAdgAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAdgAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAdgAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAdgAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAdgAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAdgAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAdgAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAdgAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAdgAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAdgAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAdgAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAdgAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAdgAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAdgAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAdgAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAdgAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAdgAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAdgAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAdgAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAdoA=';

// Default high scores stored inside the Z80 binary at SYM.HS (19026)
export const DEFAULT_ROM_SCORES: ScoreEntry[] = [
  { n: 'ACE', s: 2500, by: 'rom-default' },
  { n: 'BOB', s: 1800, by: 'rom-default' },
  { n: 'CAT', s: 1200, by: 'rom-default' },
  { n: 'DAN', s: 800, by: 'rom-default' },
  { n: 'EVE', s: 500, by: 'rom-default' },
];

export const ISSUE_TEMPLATE_YML = `name: Submit a high score
description: Add a score from the CRIME CITY browser game to the shared table
title: "[score] "
body:
  - type: markdown
    attributes:
      value: |
        Press **Submit new issue** below. A GitHub Action will check the score, update the total users & runs counters, add it to the table, and close this issue.
  - type: input
    id: initials
    attributes:
      label: Initials
      description: Three letters A–Z
    validations:
      required: true
  - type: input
    id: score
    attributes:
      label: Score
      description: Whole number 1–65535
    validations:
      required: true
  - type: input
    id: check
    attributes:
      label: Check code
      description: Filled in by the game
    validations:
      required: true
  - type: input
    id: runs
    attributes:
      label: Runs
      description: Number of game runs completed in this browser session (filled in by the game)
      placeholder: "1"
    validations:
      required: false
`;

export const WORKFLOW_YML = `name: Add high score

on:
  issues:
    types: [opened, edited, reopened]
  schedule:
    - cron: '23 * * * *'
  workflow_dispatch:

permissions:
  contents: write
  issues: write

concurrency:
  group: add-score
  cancel-in-progress: false

jobs:
  score:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Process open score issues
        env:
          GITHUB_TOKEN: \${{ secrets.GITHUB_TOKEN }}
          GITHUB_REPOSITORY: \${{ github.repository }}
        run: python3 .github/scripts/add_score.py
`;

export const UPDATED_ADD_SCORE_PY = `#!/usr/bin/env python3
"""Turn open "[score]" issues into entries in docs/data/scores.json
and maintain totalUsers (unique players) and totalRuns (cumulative games run).

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
    for m in re.finditer(r"^### +(.+?)\\s*\\n+(.*?)(?=^### |\\Z)", body or "", re.S | re.M):
        fields[m.group(1).strip().lower()] = m.group(2).strip()
    return fields


def parse_runs(raw_runs):
    """Extract optional session run count (clamped 1..500 per submission)."""
    if not raw_runs:
        return 1
    m = re.search(r"\\d+", str(raw_runs))
    if not m:
        return 1
    return max(1, min(500, int(m.group(0))))


def evaluate(issue, entries):
    """Return (status, message, entry, session_runs). status: added | low | rejected."""
    user = (issue.get("user") or {}).get("login", "")
    if (issue.get("user") or {}).get("type") == "Bot":
        return "rejected", "Scores from bots are not accepted.", None, 0
    f = parse_form(issue.get("body"))
    n = f.get("initials", "").upper()
    s = f.get("score", "")
    code = f.get("check code", "").lower()
    session_runs = parse_runs(f.get("runs", "1"))
    if not re.fullmatch(r"[A-Z]{3}", n):
        return "rejected", "Initials must be exactly three letters A to Z.", None, 0
    if not re.fullmatch(r"\\d{1,5}", s) or not (1 <= int(s) <= MAX_SCORE):
        return "rejected", f"Score must be a whole number from 1 to {MAX_SCORE}.", None, 0
    s = int(s)
    if code != check_code(n, s):
        return "rejected", "The check code does not match. Please submit scores from the game itself.", None, 0
    if any(e.get("by") == user and e["n"] == n and e["s"] == s for e in entries):
        return "rejected", "You have already submitted this score.", None, 0
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
            return "low", f"Thanks! The table already holds {PER_USER} higher scores from you, so {n} {s} was not added.", None, session_runs
        return "low", f"Thanks! {n} {s} did not make the top {MAX_KEEP} this time.", None, session_runs
    return "added", f"Added {n} {s} to the table. It will show in the game within a couple of minutes.", kept, session_runs


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
        raw = json.load(fh)
    entries = raw.get("entries", [])
    known_users = set(raw.get("users", [])) | {e.get("by") for e in entries if e.get("by")}
    total_runs = int(raw.get("totalRuns", len(entries)))

    results, changed = [], False
    for issue in api.open_score_issues():
        eval_res = evaluate(issue, entries)
        status, msg, kept, session_runs = eval_res
        user = (issue.get("user") or {}).get("login", "")
        if status in ("added", "low"):
            if user:
                known_users.add(user)
            total_runs += max(1, session_runs)
            changed = True
        if status == "added":
            entries = kept
        results.append((issue["number"], status, msg))

    if changed:
        known_users |= {e.get("by") for e in entries if e.get("by")}
        payload = {
            "totalUsers": len(known_users),
            "totalRuns": total_runs,
            "entries": entries,
        }
        with open(SCORES, "w") as fh:
            json.dump(payload, fh, indent=1)
            fh.write("\\n")
        push()
    for number, status, msg in results:
        api.finish(number, msg, completed=(status in ("added", "low")))
    return results


if __name__ == "__main__":
    run(Api(os.environ["GITHUB_TOKEN"], os.environ["GITHUB_REPOSITORY"]))
`;

export const LICENSE_TXT = `MIT License

Copyright (c) 2026 C. G. Hedley

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
`;
