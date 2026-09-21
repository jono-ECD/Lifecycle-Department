# Klaviyo Composer integration

> **Status: not configured.** This documents what must be settled, not what exists.
> Nothing here is verified.

Composer is a delivery surface for the instructions in this repository. Folder
names do not make skills available to it — the integration must explicitly supply
the instructions and account context.

## Open questions

### Instruction delivery
- [ ] How does Composer receive skill instructions and account context?
- [ ] Manual paste, sync, or API?
- [ ] Supported formats and verified size limits?

### Context scoping
- [ ] How is a single account's context loaded without leaking others'?
- [ ] How is the correct account confirmed at the start of a task?

### Version identification
- [ ] How do we know which revision of a skill is loaded in a given session?
- [ ] How are updates propagated after a merge here?

### Actions and review
- [ ] Which actions can Composer perform — draft, update, send?
- [ ] Where does human review sit in the loop?
- [ ] How is authorization recorded?

## Until this is settled

Treat Composer as a drafting surface with no verified write capability. Work
produced there is saved back to the account folder in this repository by a human,
with the skill version used recorded alongside it.
