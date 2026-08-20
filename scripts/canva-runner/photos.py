#!/usr/bin/env python3
"""Fetch every image a queued post needs, in ONE process instead of one turn per photo.

Why this exists (Igor 2026-08-19): a measured compose ran 184 model turns / 37.6M
tokens (~$18). A third of those turns were the photo loop — submit a Replicate
prediction, poll it, download, downscale, look, repeat ~15 times — and every one
of those turns re-read the entire conversation so far. Bash does not re-read
anything. The model now spends ONE turn calling this script and ONE turn looking
at the finished review copies.

Usage
  photos.py <slide_set_id>                       # whole photo_brief
  photos.py <slide_set_id> --slide 4             # redo one slide, same brief
  photos.py <slide_set_id> --slide 4 --prompt "…"    # redo with a fixed prompt
  photos.py <slide_set_id> --slide 4 --source stock --query "iv drip therapy"

Output — one machine-readable line per slide on stdout:
  OK n=3 source=ai url=<remote url to hand to Canva> review=<local 640px jpg>
  ERR n=5 source=ai reason=<short>
The `url` is what `upload-asset-from-url` takes. The `review` file is the ONLY
thing the model should ever open — never the full-resolution original.

Re-running is cheap: slides already in manifest.json are skipped unless --slide
names them, so a crashed compose resumes instead of re-paying for images.
"""

import argparse
import json
import os
import subprocess
import sys
import time
import urllib.error
import urllib.parse
import urllib.request

BASE = os.path.expanduser("~/Library/Application Support/HWC/canva-runner")
ENVF = os.path.join(BASE, "env")
# Replicate rate-limits this account to 6/min, burst 1 — space submissions out.
REPLICATE_GAP_S = 11
FLUX_MODEL = "black-forest-labs/flux-1.1-pro-ultra"
ATTEMPTS = 3


def load_env() -> dict:
    env = {}
    try:
        with open(ENVF) as fh:
            for line in fh:
                line = line.strip()
                if not line or line.startswith("#") or "=" not in line:
                    continue
                k, v = line.split("=", 1)
                env[k.strip()] = v.strip().strip('"')
    except OSError as exc:
        die(f"cannot read {ENVF}: {exc}")
    return env


def die(msg: str) -> None:
    print(f"FATAL {msg}", file=sys.stderr)
    sys.exit(1)


def http(url: str, *, headers=None, data=None, method=None, timeout=120):
    req = urllib.request.Request(url, data=data, method=method)
    # Pexels 403s urllib's default UA — every host here is happier with a real one.
    req.add_header("User-Agent", "HWC-canva-runner/1.0")
    for k, v in (headers or {}).items():
        req.add_header(k, v)
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        return resp.status, resp.read()


def http_json(url: str, *, headers=None, payload=None, method=None, timeout=120):
    headers = dict(headers or {})
    data = None
    if payload is not None:
        data = json.dumps(payload).encode()
        headers["Content-Type"] = "application/json"
    status, body = http(url, headers=headers, data=data, method=method, timeout=timeout)
    return status, (json.loads(body) if body else None)


# ── the post's brief ──────────────────────────────────────────────────────

def load_brief(env: dict, slide_set_id: str) -> list:
    url = env.get("NEXT_PUBLIC_SUPABASE_URL", "").rstrip("/")
    key = env.get("SUPABASE_SERVICE_ROLE_KEY", "")
    if not url or not key:
        die("no Supabase creds in env")
    q = f"{url}/rest/v1/slide_sets?id=eq.{urllib.parse.quote(slide_set_id)}&select=slides"
    try:
        _, rows = http_json(q, headers={"apikey": key, "Authorization": f"Bearer {key}"})
    except urllib.error.HTTPError as exc:
        die(f"slide_sets fetch failed: {exc}")
    if not rows:
        die(f"no slide_set {slide_set_id}")
    brief = (rows[0].get("slides") or {}).get("photo_brief") or []
    if not brief:
        die("photo_brief is empty — nothing to fetch")
    return brief


# ── sources ───────────────────────────────────────────────────────────────

def replicate_image(env: dict, prompt: str) -> str:
    """Submit one Flux prediction and return the finished image URL."""
    token = env.get("REPLICATE_API_TOKEN", "")
    if not token:
        raise RuntimeError("no REPLICATE_API_TOKEN")
    status, body = http_json(
        f"https://api.replicate.com/v1/models/{FLUX_MODEL}/predictions",
        headers={"Authorization": f"Bearer {token}", "Prefer": "wait"},
        payload={
            "input": {
                "prompt": prompt,
                "aspect_ratio": "4:5",
                "safety_tolerance": 6,
                "output_format": "png",
            }
        },
    )
    if status == 402:
        raise RuntimeError("replicate credit exhausted (402)")
    pred = body or {}
    # `Prefer: wait` usually returns a finished prediction; poll if it did not.
    deadline = time.time() + 300
    while pred.get("status") in ("starting", "processing") and time.time() < deadline:
        time.sleep(3)
        _, pred = http_json(
            pred["urls"]["get"], headers={"Authorization": f"Bearer {token}"}
        )
    if pred.get("status") != "succeeded":
        raise RuntimeError(f"replicate {pred.get('status')}: {str(pred.get('error'))[:120]}")
    out = pred.get("output")
    if isinstance(out, list):
        out = out[0] if out else None
    if not out:
        raise RuntimeError("replicate returned no output")
    return out


def pexels_image(env: dict, query: str) -> str:
    key = env.get("PEXELS_API_KEY", "")
    if not key:
        raise RuntimeError("no PEXELS_API_KEY")
    url = (
        "https://api.pexels.com/v1/search?"
        + urllib.parse.urlencode(
            {"query": query, "orientation": "portrait", "per_page": 15}
        )
    )
    _, body = http_json(url, headers={"Authorization": key})
    photos = (body or {}).get("photos") or []
    if not photos:
        raise RuntimeError(f"pexels: no results for {query!r}")
    src = photos[0].get("src") or {}
    return src.get("portrait") or src.get("large") or src.get("original")


def fetch_one(env: dict, entry: dict, override: dict) -> tuple:
    """Return (remote_url, resolved_source). Falls back per the skill's rules."""
    source = override.get("source") or entry.get("source") or "ai"
    prompt = override.get("prompt") or entry.get("prompt") or entry.get("subject") or ""
    query = (
        override.get("query")
        or " ".join(entry.get("keywords") or [])
        or entry.get("subject")
        or ""
    )

    if source == "clinic":
        photo_url = entry.get("photo_url")
        if photo_url:
            try:
                # HEAD is enough — the signature is not time-limited and this
                # route answers HEAD with the real content-type. Check the type
                # too: an error page served as 200 text/html would otherwise be
                # handed to Canva as if it were the doctor's photograph.
                req = urllib.request.Request(photo_url, method="HEAD")
                req.add_header("User-Agent", "HWC-canva-runner/1.0")
                with urllib.request.urlopen(req, timeout=30) as resp:
                    ctype = (resp.headers.get("Content-Type") or "").lower()
                    if resp.status < 400 and ctype.startswith("image/"):
                        return photo_url, "clinic"
                print(f"NOTE clinic photo is not an image ({ctype!r})", file=sys.stderr)
            except Exception as exc:
                print(f"NOTE clinic photo unreachable: {str(exc)[:100]}", file=sys.stderr)
        # v4 rule: never fall back to a stock stranger — use an on-topic render.
        return replicate_image(env, prompt), "ai (clinic photo unavailable)"

    if source == "stock":
        try:
            return pexels_image(env, query), "stock"
        except Exception as exc:
            print(f"NOTE stock fell back to Flux: {exc}", file=sys.stderr)
            return replicate_image(env, prompt), "ai (stock fallback)"

    if not prompt.strip():
        raise RuntimeError("no prompt in the brief for an `ai` slide")
    return replicate_image(env, prompt), "ai"


# ── review copy ───────────────────────────────────────────────────────────

def review_copy(url: str, dest_dir: str, n: int) -> str:
    """Download the original, write a 640px JPEG for the model, drop the original.

    The full-resolution file is never needed locally — Canva pulls it from the
    remote URL. Reviewing at 640px shows every rejection reason (close-up face,
    wrong subject, AI artifacts) at a fraction of the context cost.
    """
    os.makedirs(dest_dir, exist_ok=True)
    raw = os.path.join(dest_dir, f"slide-{n:02d}-orig")
    rev = os.path.join(dest_dir, f"slide-{n:02d}-rev.jpg")
    _, body = http(url, timeout=180)
    with open(raw, "wb") as fh:
        fh.write(body)
    subprocess.run(
        ["sips", "-Z", "640", "-s", "format", "jpeg", raw, "--out", rev],
        check=True,
        capture_output=True,
    )
    os.remove(raw)
    return rev


# ── main ──────────────────────────────────────────────────────────────────

def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("slide_set_id")
    ap.add_argument("--slide", type=int, action="append", default=[],
                    help="only (re)do these slide numbers; repeatable")
    ap.add_argument("--prompt", help="override the stored Flux prompt (with --slide)")
    ap.add_argument("--source", choices=["ai", "stock", "clinic"],
                    help="override the brief's source (with --slide)")
    ap.add_argument("--query", help="override the Pexels query (with --slide)")
    args = ap.parse_args()

    env = load_env()
    brief = load_brief(env, args.slide_set_id)
    work = os.path.join(BASE, "photos", args.slide_set_id)
    os.makedirs(work, exist_ok=True)
    manifest_path = os.path.join(work, "manifest.json")
    manifest = {}
    if os.path.exists(manifest_path):
        try:
            with open(manifest_path) as fh:
                manifest = json.load(fh)
        except (OSError, ValueError):
            manifest = {}

    override = {k: v for k, v in
                (("prompt", args.prompt), ("source", args.source), ("query", args.query))
                if v}
    targets = set(args.slide)
    last_submit = 0.0
    failures = 0

    for entry in brief:
        n = int(entry.get("n") or 0)
        if targets and n not in targets:
            continue
        key = str(n)
        # Resume: keep what a previous run already paid for, unless asked to redo.
        if not targets and key in manifest and os.path.exists(manifest[key].get("review", "")):
            m = manifest[key]
            print(f"OK n={n} source={m['source']} url={m['url']} review={m['review']} (cached)")
            continue

        ent_override = override if (targets and n in targets) else {}
        # `fallback` is a JUDGEMENT, not a fetch: the model has to look at the
        # copied page and decide whether the brand surface stays or the donor
        # photo has to be replaced (SKILL §4 / POST-CRAFT §5). These entries
        # carry no prompt at all — generating from the subject line would burn
        # a Flux image on the words "Cover — no photo, keep the template
        # branded cover". Skip unless the model asks for this slide by name.
        if (entry.get("source") == "fallback") and not (targets and n in targets):
            print(f"SKIP n={n} source=fallback subject={entry.get('subject') or ''!r} "
                  f"— your call: keep the brand surface, or rerun with "
                  f"--slide {n} --prompt \"…\" if the donor photo must go")
            continue

        url = None
        resolved = entry.get("source") or "ai"
        reason = ""
        for attempt in range(1, ATTEMPTS + 1):
            try:
                gap = REPLICATE_GAP_S - (time.time() - last_submit)
                if gap > 0:
                    time.sleep(gap)
                last_submit = time.time()
                url, resolved = fetch_one(env, entry, ent_override)
                break
            except Exception as exc:
                reason = str(exc)[:160]
                if "402" in reason:
                    break  # a top-up, not a retry, fixes this
                print(f"NOTE n={n} attempt {attempt}/{ATTEMPTS} failed: {reason}",
                      file=sys.stderr)
                time.sleep(5 * attempt)

        if not url:
            failures += 1
            print(f"ERR n={n} source={entry.get('source')} reason={reason or 'unknown'}")
            continue

        try:
            rev = review_copy(url, work, n)
        except Exception as exc:
            failures += 1
            print(f"ERR n={n} source={resolved} reason=review copy failed: {str(exc)[:120]}")
            continue

        manifest[key] = {"source": resolved, "url": url, "review": rev,
                         "subject": entry.get("subject") or ""}
        with open(manifest_path, "w") as fh:
            json.dump(manifest, fh, indent=1)
        print(f"OK n={n} source={resolved} url={url} review={rev}")

    print(f"DONE slides={len([e for e in brief if not targets or int(e.get('n') or 0) in targets])} "
          f"failed={failures} dir={work}")
    return 1 if failures else 0


if __name__ == "__main__":
    sys.exit(main())
