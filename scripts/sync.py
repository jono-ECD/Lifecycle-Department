#!/usr/bin/env python3
"""Regenerate all derived documentation from its sources of truth.

Two sources, both authoritative:
  accounts/registry.yml  -> account identity and data-access tables
  skills/**/SKILL.md     -> the skills catalog (ID, owner, status, version)

Derived content lives between <!-- BEGIN:generated:<name> --> / <!-- END --> markers
and is overwritten. Edit the source, then run this. Never hand-edit a marked block.

    python3 scripts/sync.py            # rewrite derived blocks
    python3 scripts/sync.py --check    # exit 1 if anything is stale

Verification (confirming an account ID against the live Klaviyo API) is NOT done
here — it needs MCP access. Ask Claude to verify, then set verified: true.
"""
import argparse
import pathlib
import re
import sys

import yaml

ROOT = pathlib.Path(__file__).resolve().parent.parent
REGISTRY = ROOT / "accounts" / "registry.yml"
SKILLS = ROOT / "skills"


def load():
    return yaml.safe_load(REGISTRY.read_text())["accounts"]


def tick(v):
    return "✅" if v else "❌"


def index_table(accounts):
    rows = [
        "| Account | Slug | Klaviyo | Verified | Klaviyo MCP | Hiro |",
        "|---|---|---|---|---|---|",
    ]
    for c in accounts:
        a = c.get("access") or {}
        hiro = f"✅ `{a['hiro_client_id']}`" if a.get("hiro_client_id") else "❌"
        rows.append(
            f"| [{c['name']}]({c['slug']}/) | `{c['slug']}` | `{c['klaviyo_account_id']}` "
            f"| {'✅' if c['verified'] else '⚠️'} | {tick(a.get('klaviyo_mcp'))} | {hiro} |"
        )
    return "\n".join(rows)


def agent_table(accounts):
    rows = [
        "| Account | Slug | Klaviyo ID | Verified | Live data |",
        "|---|---|---|---|---|",
    ]
    for c in accounts:
        a = c.get("access") or {}
        src = []
        if a.get("klaviyo_mcp"):
            src.append("Klaviyo MCP")
        if a.get("hiro_client_id"):
            src.append(f"Hiro `{a['hiro_client_id']}`")
        rows.append(
            f"| {c['name']} | `{c['slug']}` | `{c['klaviyo_account_id']}` "
            f"| {'yes' if c['verified'] else '**no**'} | {' + '.join(src) or 'none'} |"
        )
    return "\n".join(rows)


def account_header(c):
    a = c.get("access") or {}
    src = []
    if a.get("klaviyo_mcp"):
        src.append("Klaviyo MCP")
    if a.get("hiro_client_id"):
        src.append(f"Hiro (id {a['hiro_client_id']})")
    return "\n".join([
        "| | |",
        "|---|---|",
        f"| **Slug** | `{c['slug']}` |",
        f"| **Klaviyo account** | `{c['klaviyo_account_id']}` "
        f"({'verified' if c['verified'] else 'unverified'}) |",
        f"| **Data access** | {' + '.join(src) or '**none wired** — see registry'} |",
        "| **Registry entry** | [`accounts/registry.yml`](../registry.yml) |",
    ])


def platform_klaviyo(c):
    a = c.get("access") or {}
    def val(x):
        return f"`{x}`" if x else "_unknown_"
    return "\n".join([
        "| Field | Value |",
        "|---|---|",
        f"| Klaviyo account ID | `{c['klaviyo_account_id']}` |",
        f"| ID verified against API | {'yes' if c['verified'] else '**no — provisional**'} |",
        f"| Klaviyo MCP connector | {val(a.get('klaviyo_mcp'))} |",
        f"| Hiro client ID | {val(a.get('hiro_client_id'))} |",
        f"| Timezone | {val(c.get('timezone'))} |",
        f"| Currency | {val(c.get('currency'))} |",
        f"| Website | {val(c.get('website'))} |",
        f"| Industry | {val(c.get('industry'))} |",
    ])


SKILL_HDR = re.compile(
    r"^# (?P<name>.+?)\n\n"
    r"- ID: `(?P<id>[^`]+)`\n"
    r"- Owner: (?P<owner>.+?)\n"
    r"- Status: (?P<status>.+?)\n"
    r"- Version: (?P<version>.+?)\n"
    r"- Last reviewed: (?P<reviewed>.+?)\n",
    re.M,
)


def skills_catalog():
    rows = [
        "| ID | Skill | Status | Version | Owner | Purpose |",
        "|---|---|---|---|---|---|",
    ]
    found = 0
    for f in sorted(SKILLS.rglob("SKILL.md")):
        text = f.read_text()
        m = SKILL_HDR.search(text)
        if not m:
            sys.exit(f"error: {f.relative_to(ROOT)} has a malformed skill header")
        # first full sentence of Purpose, with wrapped lines rejoined
        pm = re.search(r"^## Purpose\n\n(.+?)\n\n", text, re.M | re.S)
        if pm:
            para = " ".join(pm.group(1).split())
            sm = re.match(r"(.+?[.:])(?:\s|$)", para)
            purpose = sm.group(1) if sm else para
        else:
            purpose = "_no purpose stated_"
        rel = f.relative_to(SKILLS).as_posix()
        rows.append(
            f"| `{m['id']}` | [{m['name']}]({rel}) | {m['status']} | {m['version']} "
            f"| {m['owner']} | {purpose} |"
        )
        found += 1
    if not found:
        sys.exit("error: no SKILL.md files found")
    return "\n".join(rows)


def splice(path, name, body, dry_run=False):
    """Replace the marked block in path. Returns True if content differs.

    With dry_run, reports the difference without writing — so --check is a
    read-only gate and leaves the working tree untouched.
    """
    text = path.read_text()
    pattern = re.compile(
        rf"(<!-- BEGIN:generated:{re.escape(name)} -->\n).*?(\n<!-- END:generated:{re.escape(name)} -->)",
        re.DOTALL,
    )
    if not pattern.search(text):
        sys.exit(f"error: no '{name}' generated block in {path.relative_to(ROOT)}")
    new = pattern.sub(lambda m: m.group(1) + body + m.group(2), text)
    if new == text:
        return False
    if not dry_run:
        path.write_text(new)
    return True


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--check", action="store_true",
                    help="exit 1 if any derived block is stale")
    args = ap.parse_args()

    accounts = load()
    slugs = {c["slug"] for c in accounts}

    # registry <-> folder consistency
    folders = {p.name for p in (ROOT / "accounts").iterdir() if p.is_dir()}
    if orphan_entries := slugs - folders:
        sys.exit(f"error: registry entries with no folder: {sorted(orphan_entries)}")
    folders -= {"_template"}
    if orphan_folders := folders - slugs:
        sys.exit(f"error: account folders with no registry entry: {sorted(orphan_folders)}")

    targets = [
        (ROOT / "accounts" / "README.md", "account-index", index_table(accounts)),
        (ROOT / "CLAUDE.md", "access-matrix", agent_table(accounts)),
        (SKILLS / "CATALOG.md", "skills-catalog", skills_catalog()),
    ] + [
        (ROOT / "accounts" / c["slug"] / "README.md", "account-header", account_header(c))
        for c in accounts
    ] + [
        (ROOT / "accounts" / c["slug"] / "platform" / "klaviyo.md",
         "platform-klaviyo", platform_klaviyo(c))
        for c in accounts
    ]

    changed = [p for p, name, body in targets
               if splice(p, name, body, dry_run=args.check)]

    if args.check:
        if changed:
            print("stale (run without --check to fix):")
            for p in changed:
                print("  ", p.relative_to(ROOT))
            return 1
        print(f"in sync — {len(accounts)} accounts, {len(targets)} derived blocks")
        return 0

    for p in changed:
        print("updated", p.relative_to(ROOT))
    print(f"{len(accounts)} accounts, {len(targets)} derived blocks, {len(changed)} updated")
    return 0


if __name__ == "__main__":
    sys.exit(main())
