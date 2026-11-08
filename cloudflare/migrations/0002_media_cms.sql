CREATE TABLE IF NOT EXISTS media_articles (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  slug TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  date TEXT NOT NULL,
  description TEXT NOT NULL,
  excerpt TEXT NOT NULL,
  category TEXT NOT NULL,
  topic TEXT NOT NULL DEFAULT 'strategy',
  read_minutes INTEGER NOT NULL DEFAULT 6,
  image TEXT NOT NULL,
  image_alt TEXT NOT NULL,
  tags_json TEXT NOT NULL DEFAULT '[]',
  body_md TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published')),
  github_sha TEXT NOT NULL DEFAULT '',
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  published_at TEXT
);

CREATE INDEX IF NOT EXISTS media_articles_status_updated_idx ON media_articles(status, updated_at DESC);
