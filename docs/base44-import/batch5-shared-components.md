# RedAid batch 5 — SignaturePad, ReportReadOnly, StatusBadge, EmptyState (+ SignatureImage)

All new files; nothing here replaces earlier batches. Copy `src/` into your repo.

## Still needed
- **VitalsTable** (src/components/VitalsTable.jsx) — ReportReadOnly imports it. It must be
  rewritten because saved vitals now use the database's names: `time_taken` (a full
  timestamp, was `time`), `bp_systolic` / `bp_diastolic` (were `bp_sys` / `bp_dia`),
  and numbers instead of strings. Send it and I'll convert it.
- `SignatureImage` was not in your paste, so I WROTE it (it has to read from the new private
  storage bucket anyway). If your Base44 one had a specific look (size, border), send it
  and I'll match the styling.
- Other shared display components from the earlier list are still outstanding:
  PageHeader, StatCard, SectionCard, ReportList + reportColumns, LoadingState, UserAvatar,
  CalendarMonth, EventCard, EventFormDialog, AddAccountDialog, the layouts, and the toast
  + ui primitives.

## What changed beyond a straight port
- **SignaturePad:** a plain tap with no drawing no longer counts as "signed" (before, it
  would hand back a blank white image and unlock Submit). Strokes now keep going if your
  finger slides off the edge of the box (pointer capture), and right-click is ignored.
- **ReportReadOnly:** reads the new field names (`age`, `sex`, `address`, `vitals_readings`,
  `signature_url`). Fixed: a patient aged **0** (infant) used to show "—" because 0 is falsy.
- **Signatures:** shown through `SignatureImage`, which fetches a one-hour signed link.
  Charters can see their own signatures and admins can see all. The Team Leader pages will
  need one more storage policy (I'll include it in that batch).
- **StatusBadge / EmptyState:** typed props only; behaviour unchanged.

## Known limitation
The signature box is sized when the page loads. If someone rotates their phone while in the
middle of signing, the drawing can look stretched (the saved image is still fine).
