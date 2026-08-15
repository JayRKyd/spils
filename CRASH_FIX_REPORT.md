# App Crash — Cause & Fix (Aug 15, 2026)

## What was happening

The app was randomly closing (crashing), most noticeably around **Collection**, **Journal**, and **Lab**. There was no error message — the app would just shut down.

## What we found

Every photo added in the app (bottle photos, inspiration photos, post images) was being stored **inside the database itself** as raw encoded text, instead of as a separate image file. Encoded this way, a single photo can be several megabytes of text — one inspiration photo was 22 MB on its own.

Because of that, opening a section forced the app to download **everything at once**:

| Section  | Data downloaded on open |
|----------|------------------------|
| Journal  | ~119 MB                |
| Collection | ~98 MB               |

When an iPhone app uses that much memory at once, iOS force-closes it — that's the "crash." And it was getting worse with every photo added, which is why the crashes felt more frequent recently.

To be clear: **nothing was wrong with your data or your phone.** Every entry, bottle, and photo was safely saved the whole time.

## What we fixed

**1. Fixed immediately (already live — no update needed):**
All 111 existing photos were moved out of the database into proper cloud image storage. The database rows now hold a small web link to each photo instead of the photo itself. The Journal screen that used to download ~119 MB now downloads well under 1 MB, and photos load individually as needed.

> Just force-quit the app (swipe it away) and reopen it. The crashing should stop right away, and all your photos are exactly where they were.

**2. Fixed permanently (in the next TestFlight build):**
The app itself now uploads every new photo straight to cloud storage the moment you save, so the problem cannot build back up. This covers:

- Journal — Add & Edit (bottle photo + inspiration photo)
- Collection — Add & Edit (bottle photo + inspiration photo)
- "Add to Collection" from a journal entry
- Fragrance Chat — post images

If an upload ever fails (e.g. bad connection), the app now tells you instead of saving silently.

## What you'll notice

- No more random crashes in Journal, Collection, or Lab
- Sections open noticeably faster, especially on cellular
- Photos may briefly "pop in" as they load individually — that's normal and how most apps work

## Anything needed from you?

Nothing — just force-quit and reopen the app. The permanent half of the fix rides along in the next TestFlight build with the rest of this round's updates.
