#!/usr/bin/env python3
"""Validate a Klaviyo drag-and-drop template definition before anyone builds it.

Turns the observable quality checks in skills/execution/email-design/SKILL.md
into something a reviewer can run instead of eyeball.

    python3 scripts/validate_dnd.py design.json
    python3 scripts/validate_dnd.py design.json --tokens accounts/<slug>/context/design-tokens.json

Input is the `definition` object — the value of data.attributes.definition —
not the whole API request envelope.

Exit codes: 0 clean or warnings only, 1 errors found, 2 could not read input.

ERRORS are structural: the definition would be rejected, render broken, or
breach a rule the skill states absolutely. WARNINGS need a human judgement;
justify them in the deliverable README or fix them.

This checks shape and policy, NOT the full Klaviyo schema. A clean run means
the definition is worth a human's time, not that the API will accept it.
"""
import argparse
import json
import pathlib
import re
import sys

BLOCK_TYPES = {
    "text", "image", "button", "product", "review", "social", "spacer",
    "horizontal_rule", "split", "table", "header", "coupon", "video",
    "html", "drop_shadow",
}

COLUMN_LAYOUTS = {
    "1-column-full-width",
    "2-columns-equal-width", "2-columns-25%-75%", "2-columns-33%-67%",
    "2-columns-67%-33%", "2-columns-75%-25%",
    "3-columns-equal-width", "3-columns-25%-25%-50%",
    "3-columns-25%-50%-25%", "3-columns-50%-25%-25%",
    "4-columns-equal-width",
}

STYLE_TYPES = {
    "base-styles", "text-styles", "link-styles",
    "heading-1-styles", "heading-2-styles", "heading-3-styles",
    "heading-4-styles", "mobile-styles",
}

# Blocks that put readable words in front of a subscriber. An email built only
# from the others is a picture of an email.
TEXT_BEARING = {"text", "button", "product", "review", "coupon", "table", "header"}

MAX_ALT = 160
MIN_TEXT_BLOCKS = 4
MAX_IMAGE_SHARE = 0.60

HEX = re.compile(r"#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})\b")
# {{ var }} / {{ var|filter }} — catches a missing default filter
TOKEN = re.compile(r"\{\{\s*([^}]+?)\s*\}\}")

# Klaviyo always populates these from account settings, so a default filter on
# them is noise. Profile attributes are the ones that come back empty.
ALWAYS_POPULATED = ("organization.", "unsubscribe", "manage_preferences")


class Report:
    def __init__(self):
        self.errors, self.warnings = [], []

    def error(self, where, msg):
        self.errors.append(f"{where}: {msg}")

    def warn(self, where, msg):
        self.warnings.append(f"{where}: {msg}")


def walk_blocks(definition, rep):
    """Yield (path, block) for every block, validating structure on the way."""
    body = definition.get("body")
    if not isinstance(body, dict):
        rep.error("definition", "no `body` object")
        return
    sections = body.get("sections")
    if not isinstance(sections, list) or not sections:
        rep.error("body", "no `sections` array")
        return

    for si, section in enumerate(sections):
        sp = f"section[{si}]"
        if not isinstance(section, dict):
            rep.error(sp, "not an object")
            continue
        for ri, row in enumerate(section.get("rows") or []):
            rp = f"{sp}.row[{ri}]"
            layout = ((row.get("data") or {}).get("styles") or {}).get("column_layout")
            if layout is None:
                rep.error(rp, "no column_layout")
            elif layout not in COLUMN_LAYOUTS:
                rep.error(rp, f"column_layout {layout!r} is not a valid layout")
            for ci, col in enumerate(row.get("columns") or []):
                cp = f"{rp}.col[{ci}]"
                for bi, block in enumerate(col.get("blocks") or []):
                    yield f"{cp}.block[{bi}]", block


def check_styles(definition, rep):
    styles = definition.get("styles")
    if not isinstance(styles, list) or not styles:
        rep.error("definition.styles", "missing — the whole token layer is absent")
        return
    present = {s.get("style_type") for s in styles if isinstance(s, dict)}
    for missing in sorted(STYLE_TYPES - present):
        rep.error("definition.styles", f"no {missing} entry")
    for unknown in sorted(present - STYLE_TYPES - {None}):
        rep.warn("definition.styles", f"unrecognised style_type {unknown!r}")


def collect_inline(block):
    """Colours and font families set inline on a block, wherever they hide."""
    colours, fonts = set(), set()

    def visit(node):
        if isinstance(node, dict):
            for k, v in node.items():
                if isinstance(v, str):
                    if "color" in k:
                        colours.update(m.group(0).lower() for m in HEX.finditer(v))
                    if "font_family" in k:
                        fonts.add(v)
                    if k == "content":
                        # inline styles inside the HTML of a text block
                        colours.update(m.group(0).lower() for m in HEX.finditer(v))
                        for fm in re.finditer(r"font-family:\s*([^;\"']+)", v):
                            fonts.add(fm.group(1).strip())
                else:
                    visit(v)
        elif isinstance(node, list):
            for v in node:
                visit(v)

    visit(block)
    return colours, fonts


def check_block(path, block, rep, palette, token_colours):
    btype = block.get("type")
    if btype not in BLOCK_TYPES:
        rep.error(path, f"unknown block type {btype!r}")
        return
    data = block.get("data") or {}

    if btype == "image":
        props = data.get("properties") or {}
        alt = (props.get("alt_text") or "").strip()
        if not alt:
            rep.error(path, "image has no alt_text")
        elif len(alt) > MAX_ALT:
            rep.error(
                path,
                f"alt_text is {len(alt)} chars (max {MAX_ALT}) — if an image needs "
                "a paragraph to describe, its content belongs in a text block",
            )
        if not (props.get("src") or props.get("asset_id") or props.get("dynamic")):
            rep.warn(path, "image has neither src nor asset_id")

    if btype == "button":
        if not (data.get("content") or "").strip():
            rep.error(path, "button has no label")
        if not ((data.get("properties") or {}).get("href") or "").strip():
            rep.error(path, "button has no href")

    if btype == "html":
        rep.warn(path, "raw html block — opaque to validation; record why a typed block would not do")

    # personalization fallbacks
    for m in TOKEN.finditer(json.dumps(data)):
        expr = m.group(1).strip()
        if "default" in expr or expr.startswith(ALWAYS_POPULATED):
            continue
        rep.warn(path, f"{{{{ {expr} }}}} has no default filter")

    # token conformance
    colours, fonts = collect_inline(block)
    for c in colours:
        if palette and c not in palette:
            rep.error(path, f"inline colour {c} is not in the account palette")
        elif c in token_colours:
            rep.warn(path, f"inline colour {c} duplicates a token — let it inherit")
    for f in fonts:
        rep.warn(path, f"inline font_family {f!r} — belongs in the token layer")


def load_palette(path, rep):
    """Returns (palette_hexes, token_hexes). Empty means 'no token file given'."""
    try:
        tokens = json.loads(pathlib.Path(path).read_text())
    except (OSError, json.JSONDecodeError) as e:
        print(f"error: could not read tokens: {e}", file=sys.stderr)
        sys.exit(2)

    palette = set()
    for entry in (tokens.get("palette") or {}).values():
        if isinstance(entry, dict):
            if isinstance(entry.get("hex"), str):
                palette.add(entry["hex"].lower())
            for v in entry.values():           # nested groups
                if isinstance(v, str) and HEX.fullmatch(v):
                    palette.add(v.lower())
    palette |= {"#ffffff", "#fff", "#000000", "#000"}

    token_colours = {
        m.group(0).lower()
        for m in HEX.finditer(json.dumps(tokens.get("klaviyo_definition_styles") or {}))
    }
    if tokens.get("status") == "target_state":
        rep.warn("tokens", "design-tokens.json is status: target_state — these are a proposal, not a confirmed system")
    return palette, token_colours


def main():
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("definition", help="path to the DnD definition JSON")
    ap.add_argument("--tokens", help="path to the account's design-tokens.json")
    ap.add_argument("--strict", action="store_true", help="treat warnings as errors")
    args = ap.parse_args()

    try:
        definition = json.loads(pathlib.Path(args.definition).read_text())
    except (OSError, json.JSONDecodeError) as e:
        print(f"error: could not read definition: {e}", file=sys.stderr)
        return 2
    if not isinstance(definition, dict):
        print("error: definition must be a JSON object", file=sys.stderr)
        return 2

    rep = Report()
    palette, token_colours = load_palette(args.tokens, rep) if args.tokens else (set(), set())

    check_styles(definition, rep)

    counts = {}
    for path, block in walk_blocks(definition, rep):
        check_block(path, block, rep, palette, token_colours)
        counts[block.get("type")] = counts.get(block.get("type"), 0) + 1

    total = sum(counts.values())
    text_bearing = sum(n for t, n in counts.items() if t in TEXT_BEARING)
    images = counts.get("image", 0)

    if total == 0:
        rep.error("body", "no blocks at all")
    else:
        if text_bearing < MIN_TEXT_BLOCKS:
            rep.error(
                "live-text floor",
                f"{text_bearing} text-bearing block(s), minimum {MIN_TEXT_BLOCKS} — "
                "an email built from images cannot be read with images off, "
                "edited, or rebuilt by any downstream tool",
            )
        share = images / total
        if share > MAX_IMAGE_SHARE:
            rep.error(
                "live-text floor",
                f"{images}/{total} blocks ({share:.0%}) are images, max {MAX_IMAGE_SHARE:.0%}",
            )

    print(f"{args.definition}: {total} blocks "
          f"({text_bearing} text-bearing, {images} image)")
    if counts:
        print("  " + ", ".join(f"{t}×{n}" for t, n in sorted(counts.items())))

    for w in rep.warnings:
        print(f"  warning  {w}")
    for e in rep.errors:
        print(f"  ERROR    {e}")

    if rep.errors:
        print(f"\n{len(rep.errors)} error(s), {len(rep.warnings)} warning(s) — not ready")
        return 1
    if rep.warnings and args.strict:
        print(f"\n{len(rep.warnings)} warning(s), --strict — not ready")
        return 1
    print(f"\nclean ({len(rep.warnings)} warning(s)) — ready for human review")
    return 0


if __name__ == "__main__":
    sys.exit(main())
