# Verification

Run relevant checks before finishing changes:

```bash
npm run check
npm --prefix backend run build
npm --prefix frontend run build
docker compose config
```

For container-impacting changes, also run:

```bash
docker compose build
```

For shell changes:

```bash
bash -n install.sh
bash -n bin/integritas-pi
```

Before committing or asking someone to push, check untracked files explicitly:

```bash
git status --short --untracked-files=all
```
