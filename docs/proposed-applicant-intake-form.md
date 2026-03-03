# Proposed Applicant Intake Form

This document defines the applicant intake form as it should exist for the current AdjudicArts workflow, based on the union of:

- the current CSV import mapping
- the current public apply form
- the current `Application` schema
- metadata currently stored in `notes`

The goal is not to invent a new product surface yet. The goal is to express the full intake the platform already implies, in a coherent applicant-facing form.

## Design Principles

- Capture every currently supported intake field explicitly.
- Keep the form aligned with existing storage and review workflows.
- Group questions into clear sections instead of one long list.
- Match the current scholarship / voice competition use case first.
- Preserve a path to future templates for other disciplines.

## Form Structure

1. Applicant Information
2. Contact Information
3. Program / Chapter Information
4. Education and Training
5. Submission Materials
6. Written Responses
7. Parent / Guardian Information
8. Eligibility and Supporting Documents
9. Review Before Submit

## 1. Applicant Information

### Full Legal Name
- Field id: `name`
- Type: text
- Required: yes
- Notes:
  - Current CSV accepts first + last or full name.
  - UI should expose a single full-name field first.

### Date of Birth
- Field id: `dateOfBirth`
- Type: date
- Required: yes for current scholarship workflow
- Stored in: `Application.dateOfBirth`

### Gender / Pronouns
- Field id: `gender`
- Type: text or select + free text
- Required: optional
- Stored in: `Application.gender`
- Notes:
  - Current importer merges gender/pronouns into one field.

### Voice Part
- Field id: `voicePart`
- Type: select
- Required: yes
- Options:
  - Soprano
  - Mezzo-Soprano
  - Tenor
  - Baritone
  - Bass
- Stored in:
  - metadata `notes.voicePart`
- Notes:
  - This is currently review-critical and should remain required.

## 2. Contact Information

### Email Address
- Field id: `email`
- Type: email
- Required: yes
- Stored in: `User.email`
- Rules:
  - Must be unique per event for submission.

### Phone Number
- Field id: `phone`
- Type: tel
- Required: yes
- Stored in: `Application.phone`

### Street Address
- Field id: `address`
- Type: text
- Required: yes
- Stored in: `Application.address`

### City
- Field id: `city`
- Type: text
- Required: yes
- Stored in: `Application.city`

### State / Province
- Field id: `state`
- Type: text or region select
- Required: yes
- Stored in: `Application.state`

### ZIP / Postal Code
- Field id: `zip`
- Type: text
- Required: yes
- Stored in: `Application.zip`

## 3. Program / Chapter Information

### Chapter
- Field id: `chapter`
- Type: select or searchable select
- Required: yes
- Stored in: `Application.chapter`
- Notes:
  - This is present in CSV intake and important to current admin filtering and chapter workflow.

## 4. Education and Training

### School Name
- Field id: `schoolName`
- Type: text
- Required: optional
- Stored in: `Application.schoolName`

### School City
- Field id: `schoolCity`
- Type: text
- Required: optional
- Stored in: `Application.schoolCity`

### School State
- Field id: `schoolState`
- Type: text
- Required: optional
- Stored in: `Application.schoolState`

### High School Name
- Field id: `highSchoolName`
- Type: text
- Required: optional
- Stored in: `Application.highSchoolName`

### College / University Name
- Field id: `collegeName`
- Type: text
- Required: optional
- Stored in: `Application.collegeName`

### Major
- Field id: `major`
- Type: text
- Required: optional
- Stored in: `Application.major`

## 5. Submission Materials

### Repertoire / Program
- Field id: `repertoire`
- Type: textarea
- Required: yes
- Stored in: `Application.repertoire`
- Notes:
  - This should remain a freeform field even if video titles are collected separately.

### Video Submission 1 Title and Composer
- Field id: `video1Title`
- Type: text
- Required: yes
- Stored in: `Application.video1Title`

### Video Submission 1 URL
- Field id: `video1Url`
- Type: url
- Required: yes
- Stored in: `Application.video1Url`

### Video Submission 2 Title and Composer
- Field id: `video2Title`
- Type: text
- Required: yes
- Stored in: `Application.video2Title`

### Video Submission 2 URL
- Field id: `video2Url`
- Type: url
- Required: yes
- Stored in: `Application.video2Url`

### Video Submission 3 Title and Composer
- Field id: `video3Title`
- Type: text
- Required: yes
- Stored in: `Application.video3Title`

### Video Submission 3 URL
- Field id: `video3Url`
- Type: url
- Required: yes
- Stored in: `Application.video3Url`

### YouTube Playlist Link
- Field id: `youtubePlaylist`
- Type: url
- Required: optional
- Stored in: `Application.youtubePlaylist`
- Rules:
  - If playlist mode is supported, it must resolve to exactly three reviewable videos.
- Product recommendation:
  - Either support playlist as an alternate submission mode, or drop it from the UI and keep 3 direct URLs.
  - Do not require both playlist and individual video URLs.

### Headshot
- Field id: `headshot`
- Type: file upload preferred, URL fallback acceptable
- Required: yes
- Stored in:
  - `Application.headshot`
  - metadata `notes.intakeHeadshotUrl` if needed

### Additional Resources
- Field id: `resourceUrls`
- Type: repeatable URL or upload list
- Required: optional
- Stored in: metadata `notes.resourceUrls`
- Use cases:
  - resume
  - repertoire list PDF
  - program notes
  - additional supporting files

## 6. Written Responses

### Bio
- Field id: `bio`
- Type: textarea
- Required: yes
- Stored in: `Application.bio`
- Suggested UI copy:
  - "Please provide a 150-200 word biography."

### Future Career Plans
- Field id: `careerPlans`
- Type: textarea
- Required: yes
- Stored in: `Application.careerPlans`

### How Will You Use the Scholarship Funds?
- Field id: `scholarshipUse`
- Type: textarea
- Required: yes for current scholarship workflow
- Stored in: `Application.scholarshipUse`

## 7. Parent / Guardian Information

### Parent / Guardian Name
- Field id: `parentName`
- Type: text
- Required: conditional
- Stored in: `Application.parentName`
- Rule recommendation:
  - required if applicant is under 18

### Parent / Guardian Email
- Field id: `parentEmail`
- Type: email
- Required: conditional
- Stored in: `Application.parentEmail`
- Rule recommendation:
  - required if applicant is under 18

## 8. Eligibility and Supporting Documents

### Citizenship / Residency Status
- Field id: `citizenshipStatus`
- Type: select
- Required: yes if current scholarship rules require verification
- Stored in:
  - currently inferred from CSV/raw intake or freeform source
  - should become explicit metadata or a first-class column later
- Suggested options:
  - U.S. Citizen
  - Permanent Resident
  - Other / Not Applicable

### Citizenship / Residency Proof Document
- Field id: `citizenshipDocumentUrl`
- Type: file upload preferred, URL fallback acceptable
- Required: conditional
- Stored in: metadata `notes.citizenshipDocumentUrl`
- Notes:
  - Admin review already expects this.
  - Verification state already exists in admin-side notes metadata.

## 9. Review Before Submit

### Submission Certification
- Field id: `certifyAccuracy`
- Type: checkbox
- Required: yes
- Recommendation:
  - Add explicit certification that all information is accurate.

### Media Rights / Terms Acknowledgement
- Field id: `acceptTerms`
- Type: checkbox
- Required: yes
- Recommendation:
  - Add explicit applicant agreement to platform/program terms.

## Validation Rules

These rules should be enforced by the intake form and API:

- `name` is required.
- `email` must be valid.
- `email` must not already have an application for the same event.
- `chapter` is required.
- `dateOfBirth` is required for current scholarship workflow.
- `voicePart` is required.
- `repertoire` is required.
- `video1Title`, `video2Title`, `video3Title` are required.
- `video1Url`, `video2Url`, `video3Url` are required unless playlist mode is used as the only video source.
- `bio` is required.
- `careerPlans` is required.
- `scholarshipUse` is required.
- `headshot` is required.
- `parentName` and `parentEmail` are required when applicant is a minor.
- `citizenshipStatus` and `citizenshipDocumentUrl` are required when eligibility rules require citizenship verification.

## Section Summary by Storage

### User
- `name`
- `email`

### Application columns
- `chapter`
- `dateOfBirth`
- `gender`
- `phone`
- `address`
- `city`
- `state`
- `zip`
- `schoolName`
- `schoolCity`
- `schoolState`
- `highSchoolName`
- `collegeName`
- `major`
- `careerPlans`
- `scholarshipUse`
- `repertoire`
- `video1Title`
- `video2Title`
- `video3Title`
- `video1Url`
- `video2Url`
- `video3Url`
- `youtubePlaylist`
- `headshot`
- `bio`
- `parentName`
- `parentEmail`

### Metadata in `notes`
- `voicePart`
- `resourceUrls`
- `citizenshipDocumentUrl`
- `intakeHeadshotUrl`
- eventual explicit `citizenshipStatus` if kept in metadata

## Recommended Immediate Direction

If the goal is to test the real applicant experience, the public form should be expanded to cover this full structure before further onboarding work.

The minimum production-worthy public intake for the current scholarship workflow should include:

- full name
- email
- phone
- address
- chapter
- DOB
- voice part
- school / education
- 3 titled video submissions
- headshot
- bio
- career plans
- scholarship use
- parent/guardian fields when needed
- citizenship status + proof

