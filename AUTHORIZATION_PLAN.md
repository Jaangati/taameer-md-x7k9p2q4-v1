# TAAMEER Authorization v4

This branch hardens authorization without changing the dashboard design.

## Phase 1
- Authenticated users may read modules, permissions and settings.
- Only active admins may read the legacy users row in app_data.
- Only active admins may insert/update/delete app_data rows.
- Legacy password fields are removed from app_data users.
- Profile role/status/modules remain protected by database rules.

## Phase 2
- Replace legacy users JSON with Supabase Auth + profiles as the canonical user directory.
- Move module permissions into normalized database tables.
- Add secure admin Edge Functions for invitations, suspension and password resets.
- Add audit logging.
