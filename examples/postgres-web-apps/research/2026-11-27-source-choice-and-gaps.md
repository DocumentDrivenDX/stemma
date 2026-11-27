# Source choice, licences and gaps for the PostgreSQL report

Written by model:claude-sonnet-5-5, 2026-11-27. Unreviewed.

## What was wanted, and the source that serves it

| Question | Sources (citation keys) |
|---|---|
| Connections | `pg18arch`, `pg18connections`, `pgbouncer` |
| Old row versions, vacuum, transaction IDs | `pg18vacuum`, `pg18hot`, `pg96notes` |
| Replication and several writers | `pg18standby`, `pg18ha` |
| What the default includes | `pg18isolation`, `pg18json`, `ports2012` |
| Operators who reached limits | `sentry2015`, `notion2021`, `figma2024` |
| Case against the storage design | `pavlo2023`, `wu2017` |
| What is changing | `pg19notes` |

`pg19notes` states the release date of version 19; the versioning page of postgresql.org was read but not captured.

## Access

Each host's robots.txt was read before fetching (www.pgbouncer.org and www.vldb.org serve none). Originals were fetched by `stemma ingest --fetch`, which names itself `stemma/<version>`; some addresses were also requested while choosing sources, with a generic client name.

- www.figma.com: its robots.txt bars general AI crawlers, and for agents acting for a user (a group that includes `Claude-User`) allows a list of paths that includes the article captured.
- www.notion.com: robots.txt allows the article. The terms page is drawn by script and its text could not be read, so no statement is made here about what the terms say.

## Gaps

- **OpenAI, an engineering article of 2026 on scaling PostgreSQL** (`https://openai.com/index/scaling-postgresql/`). Not used. OpenAI's terms of use (`https://openai.com/policies/terms-of-use/`) define the services to include its websites and list automatic or programmatic extraction of data among the things not allowed. The article had been requested once, before the terms were read; apart from a search of that copy for licence wording its text was not read; the copy was deleted and nothing here rests on it.
- **Uber's 2016 article on moving from PostgreSQL to MySQL** (`https://www.uber.com/blog/postgres-to-mysql-migration/`). The address answered 406. A second form of the address answered with a redirect, which was not followed. Not retrieved by any other route. The report names it only to say it is not relied on; Pavlo's article, which discusses it, is not used as a report of what it says.
- **No measurement of PostgreSQL 18 or 19**, and no controlled comparison of current PostgreSQL with another database, was looked for beyond the two papers.
- **No evidence about frequency**: no survey of how often applications meet these limits.
- **Not looked at**: documentation of managed services, distributed extensions of PostgreSQL, upgrades, failover tools, backup, cost.

## Open

- Whether to commit any of the seven texts now left out turns on their licences; the table in `README.md` records what was read.
- The thesis test is in `report/research-log.md`.
