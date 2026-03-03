# AdjudicArts MVP Brief

Use this document as context for discussing MVP scope, launch readiness, and next-step prioritization.

## Product Summary

AdjudicArts is a role-based adjudication platform for arts organizations. It currently supports:

- Organization self-service signup
- Org admin login and dashboard
- Event creation and management
- Round creation and judge assignment
- Public applicant intake for open events
- Application review and status advancement
- Judge scoring queues and rubric-based scoring
- Results views
- Staff invite flow
- Org support tickets
- Superadmin panel with separate auth and impersonation

The current codebase lives in:

- `/Users/andylunsford/AdjudicArts`

Production is deployed at:

- `https://adjudic-arts.vercel.app`

## What Is Implemented Now

### Public / marketing
- Marketing homepage
- Org signup
- Org login
- Applicant intake form for open events
- Applicant status page
- Privacy and terms pages

### Organization admin
- Dashboard with role-aware stats
- Event list, create, edit, delete
- Event rounds
- Judge assignment to rounds
- Application list and detail page
- Chapter filtering on applications
- Full application profile editing by admin / national chair / chapter chair
- CSV import and event application purge
- Staff invites and team list
- Support ticket submission and ticket list

### Judges
- Chapter judge and national judge scoring queue
- Division filtering in judging queue
- Application scoring screen
- Rubric scoring and final comment submission

### Superadmin
- Separate superadmin login flow
- Superadmin dashboard
- Organization detail pages
- Org plan/status editing
- Impersonation
- Support ticket oversight

### Intake / uploads
- Richer applicant intake than before
- Chapter dropdown
- Age rule as of March 1
- Same-division prior first-place disqualification rule
- Headshot upload
- Citizenship / residency proof upload
- Private Vercel Blob-backed document handling
- Files served through app routes instead of public blob URLs

## What Seems MVP-Ready

These flows appear implemented enough to support a focused MVP:

1. Organization signs up and admin logs in
2. Admin creates an event
3. Admin creates rounds and assigns judges
4. Applicant submits through the public form
5. Admin/chapter chair reviews applications and updates statuses
6. Judge scores assigned applications
7. Admin views results
8. Org can submit support tickets
9. Superadmin can inspect orgs and impersonate

## What Is Still Weak / Risky

These are the main MVP risks:

- Very little automated test coverage
- Heavy reliance on manual verification
- Intake is still optimized for current scholarship/voice-style workflows, not truly generalized across all disciplines
- No setup wizard for new organizations
- User administration is still basic
- Some workflow/status logic still carries both old and new states
- Results/export behavior should still be manually validated before relying on it operationally

## What Is Not Yet a Good MVP Goal

These should probably be treated as post-MVP unless absolutely necessary:

- Fully generalized multi-discipline onboarding and intake builder
- Billing / subscription enforcement
- Deep operations tooling for live event moderation / room management
- Highly flexible rubric builders for all possible program types
- Broad applicant portal features beyond submit + status tracking

## Recommended MVP Definition

The cleanest launch scope is a narrow one:

- One primary discipline/workflow
- One intake pattern
- One judging workflow
- One admin workflow
- One support path

Best current MVP framing:

- Voice scholarship / competition workflow
- Public intake for open events
- Chapter approval / adjudication flow
- National finals flow
- Judge scoring with fixed rubrics
- Admin application management
- Superadmin org oversight
- CSV import as fallback admin tool

## Questions To Discuss

Use these questions to pressure-test the MVP:

1. What exact customer/use case are we launching for first?
2. What must work flawlessly on launch day?
3. What can be manual/admin-assisted in MVP?
4. What should be deferred until after first paying or pilot orgs?
5. Is the current product too broad for the near-term launch?
6. Should we define MVP explicitly around one workflow instead of multiple arts disciplines?
7. What is the minimum manual QA checklist before calling it launchable?

## Ask ChatGPT For

Ask ChatGPT to do one or more of the following:

1. Challenge this MVP scope and identify what is too broad
2. Rewrite this into a strict MVP definition
3. Split the product into `must ship`, `can slip`, and `post-MVP`
4. Produce a launch-readiness checklist
5. Recommend the fastest path to a pilot-ready release

