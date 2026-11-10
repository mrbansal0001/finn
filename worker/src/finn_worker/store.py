"""Local store (SQLite) for everything the worker collects.

The worker runs on a residential machine (D-017); this file is its memory.
`sync.py` pushes the public tables to Supabase, which the deployed app reads.
"""
from __future__ import annotations

import json
import sqlite3
from pathlib import Path
from typing import Any, Iterable

DB_PATH = Path(__file__).resolve().parents[3] / "data" / "finn.sqlite"

SCHEMA = """
create table if not exists filings (
  id            text primary key,       -- stable hash
  symbol        text,
  company_name  text not null,
  subject       text not null,          -- NSE's own category string
  summary       text,
  link          text,
  published_at  text not null,          -- ISO, IST
  source        text not null,          -- 'rss' | 'backfill'
  category      text,
  tier          text,
  needs_document integer default 0,
  rule          text,
  is_xbrl       integer default 0
);
create index if not exists filings_symbol_time on filings(symbol, published_at);

-- one filing can carry several events (TITAN: results + VC retirement) -- D-014
create table if not exists events (
  id            text primary key,
  filing_id     text not null references filings(id),
  symbol        text not null,
  kind          text not null,          -- results | management_change | material | move | ...
  tier          text not null,
  published_at  text not null,
  card          text not null           -- JSON: kicker, headline, why, facts, sources
);
create index if not exists events_time on events(published_at);

create table if not exists results (
  symbol        text not null,
  period_end    text not null,
  nature        text not null,          -- Consolidated | Standalone
  reporting     text,
  source        text not null,          -- 'xbrl' | 'pdf'
  source_url    text,
  values_json   text not null,          -- current period, absolute rupees
  comparatives_json text,               -- {"prev_q": {...}, "prev_y": {...}}
  check_status  text,                   -- 'xbrl_match' | 'arithmetic_ok' | 'unchecked' | 'failed: ...'
  primary key (symbol, period_end, nature, source)   -- an XBRL row and a PDF table coexist
);

create table if not exists people_changes (
  filing_id     text not null,
  symbol        text not null,
  name          text not null,
  change        text, category text, designation text, effective text, reason text,
  bio           text,
  bio_struct    text,                   -- JSON from the LLM: orgs, schools, years (may be unknown)
  primary key (filing_id, name)
);

create table if not exists moves (
  symbol text not null, day text not null,
  close real, change_pct real, volume integer, volume_multiple real,
  primary key (symbol, day)
);

create table if not exists llm_calls (
  at text default (datetime('now')), purpose text, model text,
  input_tokens integer, output_tokens integer, cost_usd real
);
"""


def _migrate(con: sqlite3.Connection) -> None:
    """v1 -> v2: results primary key gains `source`."""
    row = con.execute("select sql from sqlite_master where name='results'").fetchone()
    if row and "nature, source)" not in row[0]:
        con.executescript("""
            alter table results rename to results_v1;
            create table results (symbol text not null, period_end text not null, nature text not null,
              reporting text, source text not null, source_url text, values_json text not null,
              comparatives_json text, check_status text, primary key (symbol, period_end, nature, source));
            insert into results select * from results_v1;
            drop table results_v1;""")


def connect() -> sqlite3.Connection:
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    con = sqlite3.connect(DB_PATH)
    con.row_factory = sqlite3.Row
    _migrate(con)
    con.executescript(SCHEMA)
    return con


def upsert(con: sqlite3.Connection, table: str, rows: Iterable[dict[str, Any]]) -> int:
    n = 0
    for row in rows:
        row = {k: (json.dumps(v, ensure_ascii=False) if isinstance(v, (dict, list)) else v) for k, v in row.items()}
        cols = ", ".join(row)
        marks = ", ".join("?" for _ in row)
        con.execute(f"insert or replace into {table} ({cols}) values ({marks})", list(row.values()))
        n += 1
    con.commit()
    return n
