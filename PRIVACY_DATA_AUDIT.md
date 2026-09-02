# SPILS V1 — Data & Privacy Audit (Sep 1, 2026)

Prepared for Apple's App Privacy questionnaire and the SPILS Privacy Policy.
Everything below was verified directly against the live database (policies,
tables, and access rules), not from memory. Fixes applied during this audit are
marked **[FIXED]**.

---

## 1. Exactly what V1 collects and stores

**Account data (Supabase Auth)**
- Email address, password (stored only as a salted hash — nobody can read it)
- Account created / last sign-in timestamps
- Transient auth logs kept by the platform (IP address, device user-agent) for
  a short operational window

**Profile**
- Username, optional display name, optional avatar photo, optional bio

**User content (the core of the app)**
- Journal entries: all fields incl. written notes, ratings, seasons, colors,
  bottle + inspiration photos, saved Scent Somm AI answers
- Collection: perfumes with the same field set + photos
- Lab: formulas, ingredient lines, versions, mood board images, parameters
- Organ: materials (names, CAS numbers, stock, notes)
- Community: posts, comments, likes, reports filed, users blocked
- Scent of the Day entries
- Photos are stored as files in Supabase Storage; database rows hold links

**What V1 does NOT collect**
- No analytics or tracking SDKs, no advertising identifiers, no location,
  no contacts, no health data, no third-party data brokers
- No crash/diagnostics SDK currently (only Apple's own opt-in TestFlight
  crash reports)

**Third-party processors (must be named in the Privacy Policy)**
- **Supabase** (US, us-west-1) — hosts the database, auth, and file storage
- **OpenAI** — only when the user actively uses AI features: label scanning
  sends the bottle photo; Scent Somm buttons send the entry's fragrance data
  (name, brand, notes). API data is not used for model training per OpenAI's
  API terms. No AI runs without a user action.
- **Apple** — TestFlight/App Store distribution

**Apple questionnaire mapping**: Contact Info (email) — linked to user;
User Content (photos, other user content) — linked to user; Identifiers
(user ID) — linked to user. Nothing used for tracking. No third-party
advertising.

---

## 2. Can Don / admins access private user content?

**Through the app or its API: no.** Row-level security is enforced by the
database itself on every request. Verified table-by-table:

- Journals, Collection, Lab formulas + lines + versions + mood boards, Organ,
  Scent of the Day, watchlists, blocks: **owner-only** — the in-app admin flag
  grants no access whatsoever to these.
- The admin role can only: read filed reports, delete Community posts/comments,
  and manage Industry News / Directory content. That's the entire admin surface.
- Community posts/comments and profile usernames/avatars are readable by all
  signed-in users by design (it's a forum).
- One legacy journal entry is marked public from an old feature (1 row);
  current app never creates public entries.

**Through the Supabase dashboard: yes — with the caveat that applies to every
app on earth.** Whoever holds dashboard access to the Supabase project (or the
service key) can read all data; that's standard infrastructure-operator access.
Currently that's the project's Supabase account holder(s). The honest Privacy
Policy phrasing: *"A limited number of authorized personnel can access user
data for operations and support."* Recommendation: keep dashboard membership
to the minimum people and enable 2FA on those accounts.

**Issues found and fixed during this audit:**
- **[FIXED]** Formula versions, version lines, and mood board images were
  readable/editable by ANY signed-in user (policies were "everyone"). Now
  owner-only, matching the main formulas table.
- **[FIXED]** Marketplace direct messages were readable by any signed-in user.
  Now sender/receiver only.
- **[FIXED]** Marketplace watchlists were readable by any signed-in user.
  Now owner-only.
- **[FIXED]** User email addresses in the profiles table were readable by any
  signed-in user. Emails are now blocked at the column level; usernames and
  avatars remain visible for Community. (Note: if the old web admin panel
  listed user emails, that listing will now be blank — emails are visible only
  via the Supabase dashboard.)

---

## 3. What deletion actually does

**Delete Account (in-app, Profile page)** calls a server-side function that:
1. Deletes every database row belonging to the user across all tables —
   journal, collection, formulas (+lines/versions/mood boards), materials,
   posts, comments, likes, reports, blocks, marketplace rows, scent-of-day,
   preferences, profile.
2. Deletes the user's uploaded photo files from storage (journal/collection/
   post photos, avatar, mood board images).
3. Deletes the login itself from Supabase Auth. The email can no longer sign
   in and could be re-registered fresh.

These are **hard deletes** — no soft-delete flags, no retention copies in the
live database.

**Content deletion** (a single post, entry, bottle, formula): hard delete of
the row(s). Post deletion also removes its comments. Caveat: the content's
*image file* currently remains in storage when a single item is deleted
(account deletion does clean files up). Image links are long random URLs that
are not listed or guessable. Fine for V1; a per-item file cleanup can be added
later.

**Backups:** Supabase keeps automated database backups for disaster recovery
(retention depends on the project's plan — typically 7 days on Pro; the
free plan keeps none/1 day). Deleted data can therefore persist inside those
backups until they rotate out. Backups are not accessible to users or
in-app admins and are only used to restore the service after a failure.
Correct Privacy Policy phrasing: *"Deleted data is removed immediately from
our live systems and purged from routine backups within [7] days."* (Confirm
the number against the project's Supabase plan before publishing.)

---

## 4. Is the Lab "Your Formulas are Secure" wording accurate?

**As of this audit: yes.**
- Formulas, ingredient lines, versions, and mood boards are owner-only at the
  database level (versions/mood boards were the gap — fixed above).
- All traffic is encrypted in transit (TLS); Supabase encrypts data at rest
  (AES-256).
- Nobody — including other users and in-app admins — can view a user's
  formulas through the app or API.
- Honest limits worth reflecting in any expanded wording: platform operators
  with database access can technically access data (as with any cloud
  service), and formulas a user *chooses* to share (PDF/share sheet) leave
  the protected space by that user's own action.

Suggested accurate wording if the client ever expands the IFRA/security modal:
*"Your formulas are private to your account and protected by database-level
access rules. Data is encrypted in transit and at rest. Only you can view,
edit, or share your formulas."*

---

## Open items (no action needed for accuracy, listed for completeness)

1. Confirm the Supabase plan's backup retention number before quoting a day
   count in the Privacy Policy.
2. Photos live in a public-URL storage bucket (unguessable links, not
   listable) — standard for consumer apps; mention "content images are served
   via unlisted URLs" only if asked.
3. If diagnostics (e.g. Sentry crash reporting) are added later, the Apple
   privacy answers must be updated to declare Diagnostics collection.
4. Two legacy empty tables (`formula_materials`, `formula_parameters`) have
   row security off but contain nothing and aren't used by the app.
