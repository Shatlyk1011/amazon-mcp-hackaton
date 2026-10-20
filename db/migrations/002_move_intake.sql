CREATE TABLE IF NOT EXISTS relocation_profiles (
  owner_hash text PRIMARY KEY,
  context jsonb NOT NULL DEFAULT '{}',
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS relocation_intakes (
  id uuid PRIMARY KEY,
  owner_hash text NOT NULL,
  creation_key uuid NOT NULL,
  state jsonb NOT NULL,
  history jsonb NOT NULL DEFAULT '[]',
  version integer NOT NULL DEFAULT 0,
  plan_id uuid REFERENCES relocation_plans(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (owner_hash, creation_key)
);
CREATE INDEX IF NOT EXISTS relocation_intakes_owner_updated ON relocation_intakes(owner_hash, updated_at DESC);
