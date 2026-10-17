#!/usr/bin/env python3
"""Pull each recipe's first photo (the one Notion shows as its gallery cover) out of a Notion
Recipes export zip, shrink it, and save it as <recipe-slug>.jpg for the app's Import → Photos step.

    python3 notion_photos.py <Recipes-export.zip> <out-folder>

Uses macOS `sips` to resize (no extra installs). The app matches photos to recipes by file name.
"""
import zipfile, sys, os, re, subprocess, tempfile, urllib.parse

def slug(s):  # must match slug() in js/views/import.js
    return re.sub(r"[^a-z0-9]+", "-", s.lower()).strip("-")

def clean_title(s):
    s = re.sub(r"\[([^\]]+)\]\([^)]*\)", r"\1", s).replace("**", "").replace("__", "").replace("~~", "")
    return re.sub(r"\s+", " ", s).strip()

def decoded(info):
    n = info.filename
    if not (info.flag_bits & 0x800):
        try: n = n.encode("cp437").decode("utf-8")
        except Exception: pass
    return n

def main(zpath, out):
    os.makedirs(out, exist_ok=True)
    z = zipfile.ZipFile(zpath)
    entries = {decoded(i): i for i in z.infolist()}
    lower = {k.lower(): v for k, v in entries.items()}
    mds = [k for k in entries if re.fullmatch(r"[^/]*Recipes/[^/]+\.md", k)]
    saved, none, missing = 0, 0, []
    tmp = tempfile.mkdtemp()
    for md in sorted(mds):
        text = z.read(entries[md]).decode("utf-8", "replace")
        title = clean_title(text.split("\n", 1)[0].lstrip("# "))
        refs = [urllib.parse.unquote(m) for m in re.findall(r"!\[[^\]]*\]\(([^)\s]+)\)", text) if not m.startswith("http")]
        refs = [r for r in refs if re.search(r"\.(png|jpe?g|webp|gif|heic)$", r, re.I)]
        if not refs: none += 1; continue
        base = os.path.dirname(md)
        info = entries.get(os.path.normpath(os.path.join(base, refs[0]))) or lower.get(os.path.normpath(os.path.join(base, refs[0])).lower())
        if not info:
            # Notion sometimes shortens folder names; fall back to the file name inside any folder for this page
            want = os.path.basename(refs[0]).lower()
            folder = os.path.dirname(refs[0]).lower()
            cands = [v for k, v in lower.items() if k.endswith("/" + want) and folder.split("/")[0][:20] in k]
            info = cands[0] if cands else None
        if not info: missing.append(title); continue
        src = os.path.join(tmp, "src" + os.path.splitext(info.filename)[1].lower())
        open(src, "wb").write(z.read(info))
        dst = os.path.join(out, slug(title) + ".jpg")
        r = subprocess.run(["sips", "-Z", "1600", "-s", "format", "jpeg", "-s", "formatOptions", "80", src, "--out", dst], capture_output=True)
        if r.returncode == 0 and os.path.exists(dst): saved += 1
        else: missing.append(title)
        os.remove(src)
    print(f"{saved} photos saved, {none} recipes without a photo, {len(missing)} couldn't be read")
    for t in missing[:20]: print("  missing:", t)

if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2])
