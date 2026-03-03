# Claude Code Cross-Check Brief: Applicant Intake

Use this brief to cross-check the proposed applicant intake form against the current AdjudicArts implementation.

Primary source document:
- [proposed-applicant-intake-form.md](/Users/andylunsford/AdjudicArts/docs/proposed-applicant-intake-form.md)

## Objective

Determine where the current implementation does and does not support the proposed intake form, and produce an exact gap report.

## Files To Inspect

- [components/applications/apply-form.tsx](/Users/andylunsford/AdjudicArts/components/applications/apply-form.tsx)
- [app/api/apply/[eventId]/route.ts](/Users/andylunsford/AdjudicArts/app/api/apply/[eventId]/route.ts)
- [lib/db/import.ts](/Users/andylunsford/AdjudicArts/lib/db/import.ts)
- [lib/db/applications.ts](/Users/andylunsford/AdjudicArts/lib/db/applications.ts)
- [lib/application-metadata.ts](/Users/andylunsford/AdjudicArts/lib/application-metadata.ts)
- [prisma/schema.prisma](/Users/andylunsford/AdjudicArts/prisma/schema.prisma)
- [app/(dashboard)/dashboard/applications/[id]/page.tsx](/Users/andylunsford/AdjudicArts/app/(dashboard)/dashboard/applications/[id]/page.tsx)
- [components/applications/application-profile-editor.tsx](/Users/andylunsford/AdjudicArts/components/applications/application-profile-editor.tsx)

## Required Output

Produce a report with these sections:

1. Supported exactly
2. Partially supported
3. Not supported
4. Stored awkwardly in metadata instead of first-class schema
5. Business rules currently missing from UI/API validation
6. Recommended implementation order

## Cross-Check Questions

For every field in the proposed intake form, answer all of the following:

1. Does the public applicant form currently render this field?
2. Does the public applicant API currently validate this field?
3. Does the database currently have a first-class storage location for it?
4. Is the field only supported through CSV import?
5. Is the field only visible later in admin review but not collectable online?
6. Is the field stored in `notes` metadata instead of a proper column?
7. Is the field required, optional, or not enforced today?
8. Are there any mismatches between public form, CSV import, and admin review expectations?

## Explicit Items To Check

### Public form omissions

Confirm whether the public form is missing:

- chapter
- date of birth
- gender/pronouns
- phone
- address
- city
- state
- zip
- school name
- school city
- school state
- high school name
- college name
- major
- bio
- career plans
- scholarship use
- parent name
- parent email
- video titles
- playlist link
- citizenship status

### Metadata vs schema

Confirm which fields are stored in metadata today:

- voice part
- citizenship document URL
- resource URLs
- intake headshot URL
- citizenship verification
- admin profile note
- chapter assignment history

Call out whether any applicant-facing fields should be promoted from metadata to first-class columns.

### Validation gaps

Check whether the current applicant API enforces:

- three titled video submissions
- chapter required
- DOB required
- phone required
- address required
- bio required
- career plans required
- scholarship use required
- parent/guardian required for minors
- citizenship proof required when applicable

## Deliverable Standard

Do not provide generic suggestions. Tie each finding to:

- a concrete field
- the exact file(s) involved
- the exact behavior mismatch

If a field is supported only by CSV import, say so explicitly.

If a field is shown in admin review but not collectable in the public form, say so explicitly.

## Expected End State

At the end of the cross-check, it should be obvious:

- what the real intake schema is
- which pieces already exist
- which pieces need UI work
- which pieces need API validation work
- which pieces need schema cleanup
- whether the proposed intake form can be implemented without a migration
