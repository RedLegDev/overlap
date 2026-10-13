CREATE TABLE events (
  id          TEXT PRIMARY KEY,
  title       TEXT NOT NULL,
  note        TEXT NOT NULL DEFAULT '',
  timezone    TEXT NOT NULL,
  kind        TEXT NOT NULL CHECK (kind IN ('dates', 'weekdays')),
  days        TEXT NOT NULL,             -- JSON: ["2026-10-14", ...] or [1, 3, 5]
  start_min   INTEGER NOT NULL,          -- minutes after midnight, event time zone
  end_min     INTEGER NOT NULL,          -- exclusive, may be 1440
  slot_min    INTEGER NOT NULL,
  admin_hash  TEXT NOT NULL,
  final_start INTEGER,                   -- slot index
  final_len   INTEGER,                   -- in slots
  created_at  INTEGER NOT NULL,
  updated_at  INTEGER NOT NULL,          -- bumped on any change; clients poll it
  expires_at  INTEGER NOT NULL
);
CREATE INDEX events_expires_at ON events (expires_at);

CREATE TABLE responses (
  id          TEXT PRIMARY KEY,
  event_id    TEXT NOT NULL REFERENCES events (id),
  name        TEXT NOT NULL,
  token_hash  TEXT NOT NULL,
  slots       TEXT NOT NULL,             -- one char per slot: 0 no, 1 yes, 2 if needed
  created_at  INTEGER NOT NULL,
  updated_at  INTEGER NOT NULL
);
CREATE UNIQUE INDEX responses_event_name ON responses (event_id, name COLLATE NOCASE);
