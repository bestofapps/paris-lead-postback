DROP TABLE IF EXISTS ac_daily_counts;

CREATE TABLE ac_daily_counts (
  date TEXT NOT NULL,
  list_id INTEGER NOT NULL DEFAULT 0,
  count INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (date, list_id)
);

DROP TABLE IF EXISTS postbacks;

CREATE TABLE postbacks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  name TEXT,
  origin TEXT,
  description TEXT,
  carrier TEXT,
  transaction_type TEXT,
  referrer TEXT,
  timestamp TEXT,
  country_code TEXT,
  transaction_id TEXT,
  tracker_id TEXT,
  currency TEXT,
  payout TEXT,
  email TEXT,
  t1 TEXT,
  t2 TEXT,
  t3 TEXT,
  t4 TEXT,
  t5 TEXT,
  sub_id TEXT,
  gclid TEXT,
  wbraid TEXT,
  gbraid TEXT,
  pubid TEXT,
  click_id TEXT,
  campaign_id TEXT,
  offer_id TEXT,
  ip_address TEXT,
  event_type TEXT,
  external_status INTEGER,
  external_response TEXT
);
