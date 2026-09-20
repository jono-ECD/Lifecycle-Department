#!/usr/bin/env python3
"""Regenerate every account table in the repo from clients/registry.yml.

registry.yml is the single source of truth. The tables in clients/README.md,
CLAUDE.md, and each clients/<slug>/README.md are DERIVED — they live between
<!-- BEGIN:generated:<name> --> / <!-- END:generated:<name> --> markers and are
overwritten by this script. Edit the registry, then run this.

    python3 scripts/sync_registry.py            # rewrite derived blocks
    python3 scripts/sync_registry.py --check    # exit 1 if anything is stale

Verification (confirming an ID against the live Klaviyo API) is NOT done here —
it needs MCP access. Ask Claude to verify, then set verified: true in the registry.
"""
import argparse
import pathlib
import re
import sys

import yaml

ROOT = pathlib.Path(__file__).resolve().parent.parent
REGISTRY = ROOT / "clients" / "registry.yml"


def load():
    return yaml.safe_load(REGISTRY.read_text())["clients"]


def tick(v):
    return "✅" if v else "❌"


def index_table(clients):
    rows = [
        "| Client | Slug | Klaviyo | Verified | Klaviyo MCP | Hiro |",
        "|---|---|---|---|---|---|",
    ]
    for c in clients:
        a = c.get("access") or {}
        hiro = f"✅ `{a['hiro_client_id']}`" if a.get("hiro_client_id") else "❌"
        rows.append(
            f"| [{c['name']}]({c['slug']}/) | `{c['slug']}` | `{c['klaviyo_account_id']}` "
            f"| {'✅' if c['verified'] else '⚠️'} | {tick(a.get('klaviyo_mcp'))} | {hiro} |"
        )
    return "\n".join(rows)


def agent_table(clients):
    rows = [
        "| Client | Slug | Klaviyo ID | Verified | Live data |",
        "|---|---|---|---|---|",
    ]
    for c in clients:
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


def client_header(c):
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
        "| **Registry entry** | [`clients/registry.yml`](../registry.yml) |",
    ])


def splice(path, name, body):
    """Replace the marked block in path. Returns True if content changed."""
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
    path.write_text(new)
    return True


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--check", action="store_true",
                    help="exit 1 if any derived block is stale")
    args = ap.parse_args()

    clients = load()
    slugs = {c["slug"] for c in clients}

    # registry <-> folder consistency
    folders = {p.name for p in (ROOT / "clients").iterdir() if p.is_dir()}
    if orphan_entries := slugs - folders:
        sys.exit(f"error: registry entries with no folder: {sorted(orphan_entries)}")
    if orphan_folders := folders - slugs:
        sys.exit(f"error: client folders with no registry entry: {sorted(orphan_folders)}")

    targets = [
        (ROOT / "clients" / "README.md", "client-index", index_table(clients)),
        (ROOT / "CLAUDE.md", "access-matrix", agent_table(clients)),
    ] + [
        (ROOT / "clients" / c["slug"] / "README.md", "client-header", client_header(c))
        for c in clients
    ]

    changed = [p for p, name, body in targets if splice(p, name, body)]

    if args.check:
        if changed:
            print("stale (run without --check to fix):")
            for p in changed:
                print("  ", p.relative_to(ROOT))
            return 1
        print(f"in sync — {len(clients)} clients, {len(targets)} derived blocks")
        return 0

    for p in changed:
        print("updated", p.relative_to(ROOT))
    print(f"{len(clients)} clients, {len(targets)} derived blocks, {len(changed)} updated")
    return 0


if __name__ == "__main__":
    sys.exit(main())
