# Minima Rules

- Minima RPC commands should be sent as a single URL path command, not as query parameters. Build the command string first, for example `megammrsync action:resync host:megammr.minima.global:9001`, then percent-encode it into the path: `http://minima:9005/megammrsync%20action%3Aresync%20host%3Amegammr.minima.global%3A9001`.
- Do not expose a generic Minima command proxy. Add narrow, allowlisted backend actions for each supported command.
