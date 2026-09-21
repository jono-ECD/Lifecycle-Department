# Skill authoring

## Before writing

Ask whether this is a skill at all:

| It is | When |
|---|---|
| A **skill** | A repeatable procedure someone follows to produce a deliverable |
| A **workflow** | An ordered sequence of skills with handoffs and a quality gate |
| **Account context** | A fact about one account — voice, products, constraints |
| A **template** | A reusable output format, not a procedure |

## Writing one

1. Copy [`../templates/skill-template.md`](../templates/skill-template.md) to
   `skills/<group>/<name>/SKILL.md`.
2. ID is `<group>.<name>`, matching the folder path. It is stable — renaming an ID
   breaks every account catalog referencing it.
3. Status starts `draft`, version `0.1.0`, owner is a named person.
4. Write instructions specific enough that a teammate can do the work without you.
   Vague steps ("write good copy") are the main failure mode.
5. Every required input names its source and what to do when it is missing. The
   correct answer is usually "stop and ask", not "infer".
6. Quality checks must be **observable** — a reviewer can tick each box without
   re-deriving your judgment.
7. Run `python3 ../scripts/sync.py` to refresh the catalog.

## Account customization

Account **facts** never justify a new skill. Voice, products, offers, and
constraints belong in `accounts/<slug>/context/` and are read by the shared skill.

Create an account-local skill only when the **procedure** differs — a different
sequence of steps, a different approval path, an extra stage. Record it in that
account's `skills/CATALOG.md` with what varies and what department requirements
still apply.

Department quality standards and access rules apply to local skills too. A local
skill may not lower the bar.

## Promoting a local skill

1. Strip account-specific facts — they become required inputs.
2. Define the reusable inputs and outputs.
3. Review examples for client information.
4. Validate against at least one *other* account's context.
5. Replace the local copy with a reference to the shared skill.

## Never put in a skill

Credentials. Real customer records. Unreleased offer terms. Client-identifying
material in examples — use fictional or fully anonymized accounts.
