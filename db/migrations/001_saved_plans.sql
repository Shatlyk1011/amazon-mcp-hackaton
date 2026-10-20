CREATE TABLE IF NOT EXISTS relocation_plans (
  id uuid PRIMARY KEY,
  owner_hash text NOT NULL,
  creation_key uuid NOT NULL,
  input jsonb NOT NULL,
  result jsonb,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'ready', 'failed')),
  error text,
  version integer NOT NULL DEFAULT 0,
  lock_token uuid,
  lock_until timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (owner_hash, creation_key)
);

CREATE TABLE IF NOT EXISTS relocation_plan_revisions (
  plan_id uuid NOT NULL REFERENCES relocation_plans(id) ON DELETE CASCADE,
  version integer NOT NULL,
  input jsonb NOT NULL,
  result jsonb NOT NULL,
  reason text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (plan_id, version)
);

CREATE TABLE IF NOT EXISTS relocation_requests (
  id uuid PRIMARY KEY,
  plan_id uuid NOT NULL REFERENCES relocation_plans(id) ON DELETE CASCADE,
  message text NOT NULL,
  reply text,
  status text NOT NULL DEFAULT 'running' CHECK (status IN ('running', 'completed', 'failed')),
  tools jsonb NOT NULL DEFAULT '[]',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS relocation_requests_plan_created ON relocation_requests(plan_id, created_at);
