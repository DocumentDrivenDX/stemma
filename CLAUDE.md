See [AGENTS.md](AGENTS.md).

## HELIX

Stemma's own documents under `docs/stemma/` are governed by
[HELIX](https://github.com/DocumentDrivenDX/helix) (see `.helix.yml`). Use
`/helix` to frame, design, evolve, and align them. Authors who use Stemma never
need HELIX.

If the `helix` skill is not available, tell the user and give them these
commands. Install it only if they ask you to. In a Claude Code session:

```text
/plugin marketplace add DocumentDrivenDX/plugins
/plugin install helix@documentdrivendx
```

Or from a terminal:

```sh
claude plugin marketplace add DocumentDrivenDX/plugins
claude plugin install helix@documentdrivendx --scope user
```

For Codex and other hosts, follow HELIX's
[install guide](https://github.com/DocumentDrivenDX/helix/blob/main/docs/install/README.md).
