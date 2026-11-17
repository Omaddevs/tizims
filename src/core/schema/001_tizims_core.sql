-- Tizims.uz Multi-Tenant Core — PostgreSQL target schema
-- Demo frontend uses the same IDs. Apply on a real DB before production cutover.
-- Every tenant-owned row MUST carry organization_id.

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE,
  phone TEXT,
  password_hash TEXT NOT NULL,
  first_name TEXT,
  last_name TEXT,
  avatar TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  email_verified_at TIMESTAMPTZ,
  last_login_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  organization_type TEXT NOT NULL,
  logo TEXT,
  email TEXT,
  phone TEXT,
  address TEXT,
  country TEXT NOT NULL DEFAULT 'UZ',
  timezone TEXT NOT NULL DEFAULT 'Asia/Tashkent',
  currency TEXT NOT NULL DEFAULT 'UZS',
  status TEXT NOT NULL DEFAULT 'active',
  primary_color TEXT NOT NULL DEFAULT '#0984E3',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  is_system BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE TABLE IF NOT EXISTS permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  module TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS role_permissions (
  role_id UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  permission_id UUID NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
  PRIMARY KEY (role_id, permission_id)
);

CREATE TABLE IF NOT EXISTS memberships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  role_id UUID NOT NULL REFERENCES roles(id),
  status TEXT NOT NULL DEFAULT 'active',
  is_owner BOOLEAN NOT NULL DEFAULT FALSE,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, organization_id)
);

CREATE TABLE IF NOT EXISTS modules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  icon TEXT,
  version TEXT,
  status TEXT NOT NULL DEFAULT 'active'
);

CREATE TABLE IF NOT EXISTS organization_modules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  module_id UUID NOT NULL REFERENCES modules(id) ON DELETE CASCADE,
  enabled BOOLEAN NOT NULL DEFAULT FALSE,
  settings JSONB NOT NULL DEFAULT '{}',
  activated_at TIMESTAMPTZ,
  UNIQUE (organization_id, module_id)
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id),
  user_id UUID REFERENCES users(id),
  action TEXT NOT NULL,
  entity_type TEXT,
  entity_id TEXT,
  old_values JSONB,
  new_values JSONB,
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Ta'lim jadvallari: har birida organization_id majburiy (tenant isolation).
ALTER TABLE IF EXISTS students ADD COLUMN IF NOT EXISTS organization_id UUID NOT NULL;
CREATE INDEX IF NOT EXISTS students_org_idx ON students (organization_id);

ALTER TABLE IF EXISTS teachers ADD COLUMN IF NOT EXISTS organization_id UUID NOT NULL;
CREATE INDEX IF NOT EXISTS teachers_org_idx ON teachers (organization_id);

ALTER TABLE IF EXISTS groups ADD COLUMN IF NOT EXISTS organization_id UUID NOT NULL;
CREATE INDEX IF NOT EXISTS groups_org_idx ON groups (organization_id);

ALTER TABLE IF EXISTS subjects ADD COLUMN IF NOT EXISTS organization_id UUID NOT NULL;
CREATE INDEX IF NOT EXISTS subjects_org_idx ON subjects (organization_id);

ALTER TABLE IF EXISTS lessons ADD COLUMN IF NOT EXISTS organization_id UUID NOT NULL;
CREATE INDEX IF NOT EXISTS lessons_org_idx ON lessons (organization_id);

ALTER TABLE IF EXISTS rooms ADD COLUMN IF NOT EXISTS organization_id UUID NOT NULL;
CREATE INDEX IF NOT EXISTS rooms_org_idx ON rooms (organization_id);

ALTER TABLE IF EXISTS attendance_records ADD COLUMN IF NOT EXISTS organization_id UUID NOT NULL;
CREATE INDEX IF NOT EXISTS attendance_records_org_idx ON attendance_records (organization_id);

ALTER TABLE IF EXISTS grades ADD COLUMN IF NOT EXISTS organization_id UUID NOT NULL;
CREATE INDEX IF NOT EXISTS grades_org_idx ON grades (organization_id);

ALTER TABLE IF EXISTS tasks ADD COLUMN IF NOT EXISTS organization_id UUID NOT NULL;
CREATE INDEX IF NOT EXISTS tasks_org_idx ON tasks (organization_id);

ALTER TABLE IF EXISTS audit_logs ENABLE ROW LEVEL SECURITY;
-- Application must SET LOCAL app.organization_id = '<uuid>' per request.

-- Example RLS for students:
-- ALTER TABLE students ENABLE ROW LEVEL SECURITY;
-- CREATE POLICY students_tenant ON students
--   USING (organization_id = NULLIF(current_setting('app.organization_id', true), '')::uuid);
