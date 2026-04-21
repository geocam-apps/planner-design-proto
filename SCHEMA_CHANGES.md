# Schema changes required by `planner-design-proto`

A running list of database / model changes the prototype assumes but hasn't yet been given a real backend for. Currently faked in the browser (`localStorage`, key `planner-proto-prefs-v1`).

Each entry lists: what the UI does, what the DB needs, a suggested migration sketch, and any read/write paths that would need adjusting in the Rails app.

---

## 1. `starred` / "pin to the top" per item — 2026-04-21

**What the UI does:** Every card (Project, Collection, Capture) has a star button. Starred items are sorted first within their list. The star is per-user — one user starring a project must not affect another user's view.

**Faked today with:** `localStorage.planner-proto-prefs-v1.starred.{project|collection|capture}.{id}`

**Suggested DB change:** a polymorphic join table so a user can star anything — cheaper than adding a `starred_by_ids` column to every starrable model, and future-proof for when "Shots" or other things become starrable too.

```sql
CREATE TABLE starred_items (
  id          bigserial PRIMARY KEY,
  user_id     bigint NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  starrable_type  varchar NOT NULL,  -- 'Project' | 'CellMap' | 'Capture'
  starrable_id    bigint  NOT NULL,
  created_at  timestamp(6) NOT NULL DEFAULT now(),
  UNIQUE (user_id, starrable_type, starrable_id)
);
CREATE INDEX ON starred_items (starrable_type, starrable_id);
CREATE INDEX ON starred_items (user_id);
```

**Rails side:**
- `has_many :starred_items, dependent: :destroy` on User
- polymorphic `belongs_to :starrable` on StarredItem
- model helpers: `User#star!(item)`, `User#starred?(item)`, `User#starred_<plural>`
- a scope like `Project.sorted_for(user)` that issues `ORDER BY EXISTS (...) DESC, updated_at DESC` or uses a LEFT JOIN, so the "starred first" ordering is computed server-side
- API additions: `POST /api/v1/starred_items { starrable_type, starrable_id }` and matching DELETE; include `starred: true/false` on the existing project/collection/capture JSON

**Note:** "Collection" in the UI = `CellMap` of kind `'collection'` — so `starrable_type = 'CellMap'`.

---

## 2. `hidden` / "remove from my list" per item — 2026-04-21

**What the UI does:** Every card has a hide button. Hidden items are filtered out of the list by default. A global "Show hidden" toggle in the page header brings them back (visible but dimmed, with an "hidden" badge) so a user can unhide them. Per-user, like starring.

**Faked today with:** `localStorage.planner-proto-prefs-v1.hidden.{project|collection|capture}.{id}`, plus a `showHidden` boolean for the global toggle.

**Suggested DB change:** same polymorphic pattern as stars. You could bundle it into one `user_preferences` table rather than two tables, but keeping them separate keeps the queries simple and the indexes narrow.

```sql
CREATE TABLE hidden_items (
  id         bigserial PRIMARY KEY,
  user_id    bigint NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  hideable_type  varchar NOT NULL,   -- 'Project' | 'CellMap' | 'Capture'
  hideable_id    bigint  NOT NULL,
  created_at timestamp(6) NOT NULL DEFAULT now(),
  UNIQUE (user_id, hideable_type, hideable_id)
);
CREATE INDEX ON hidden_items (hideable_type, hideable_id);
CREATE INDEX ON hidden_items (user_id);
```

For the per-user "show hidden" preference itself (just a boolean): either a column on `users` (`show_hidden_items boolean DEFAULT false`) or a generic `user_settings` JSON column. Either is fine — the UI state is remembered across reloads today, so it's not just ephemeral UI.

**Rails side:**
- `has_many :hidden_items` on User, polymorphic `hideable` on HiddenItem
- default scope / helper on lists: `Project.visible_to(user)` excludes hidden unless `user.show_hidden_items`
- API additions: `POST /api/v1/hidden_items`, `DELETE /api/v1/hidden_items/:id`, and `show_hidden` flag on the user's own session payload
- include `hidden: true/false` on project/collection/capture JSON so the UI can render the dimmed "hidden" state when the toggle is on

---

## Conventions

- New columns should be nullable or have sensible defaults so existing rows don't need backfilling.
- Keep the "Collection = CellMap(kind='collection')" mapping in mind — it surfaces in routing and polymorphic types.
- The prototype's faked store is namespaced `planner-proto-prefs-v1` in localStorage; bumping to `-v2` would let us reset client state cleanly when the schema lands.
