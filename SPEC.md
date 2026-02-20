# AdjudicArts — Product Specification

---

## 1. Product Overview

AdjudicArts manages the end-to-end adjudication lifecycle for arts competitions:
audition submissions, chapter-level scoring, national-level scoring, and final
decisions. The initial deployment is for a national classical voice scholarship.

---

## 2. Roles & Permissions

### Role Definitions

| Role | Description |
|---|---|
| `ADMIN` | Full system access; manages users, organizations, and all data |
| `NATIONAL_CHAIR` | Manages the competition at the national level; advances event status |
| `CHAPTER_CHAIR` | Manages a regional chapter; oversees chapter judges and review |
| `CHAPTER_JUDGE` | Scores applications during the chapter review stage |
| `NATIONAL_JUDGE` | Scores applications during the national judging stage |
| `APPLICANT` | Submits and tracks their own application |

### Permission Details

**ADMIN**
- Full CRUD on all entities
- Manage users and assign roles
- Override any status at any stage

**NATIONAL_CHAIR**
- Create and configure Events
- Advance Event through status lifecycle
- Assign National Judges to national rounds
- View all scores at all stages
- Make final decisions on applications

**CHAPTER_CHAIR**
- Assign Chapter Judges to chapter rounds
- Advance applications from chapter review to approved/rejected
- View all chapter scores

**CHAPTER_JUDGE**
- View applications assigned to their round
- Submit/edit scores during `CHAPTER_REVIEW` stage only
- View only their own scores

**NATIONAL_JUDGE**
- View applications advancing to national stage
- Submit/edit scores during `JUDGING` and `NATIONAL_REVIEW` stages
- View only their own scores

**APPLICANT**
- Submit one application per Event
- View their own application and status
- Cannot see scores or other applicants

---

## 3. Data Model

### Organization
```
Organization {
  id             String (CUID)
  name           String
  createdAt      DateTime
  updatedAt      DateTime
}
```

### User
```
User {
  id             String (CUID)
  organizationId String → Organization
  email          String (unique)
  passwordHash   String
  name           String
  role           Role enum
  createdAt      DateTime
  updatedAt      DateTime
}
```

### Event
```
Event {
  id             String (CUID)
  organizationId String → Organization
  name           String
  description    String?
  status         EventStatus enum
  openAt         DateTime?
  closeAt        DateTime?
  createdAt      DateTime
  updatedAt      DateTime
}
```

### Round
```
Round {
  id             String (CUID)
  organizationId String
  eventId        String → Event
  name           String
  type           RoundType (CHAPTER | NATIONAL)
  startAt        DateTime?
  endAt          DateTime?
  createdAt      DateTime
  updatedAt      DateTime
}
```

### Application
```
Application {
  id             String (CUID)
  organizationId String
  eventId        String → Event
  applicantId    String → User
  status         ApplicationStatus enum
  repertoire     String?
  notes          String?
  submittedAt    DateTime
  updatedAt      DateTime
}
```

### Rubric
```
Rubric {
  id             String (CUID)
  organizationId String
  eventId        String → Event (unique — one rubric per event)
  name           String
  description    String?
  createdAt      DateTime
  updatedAt      DateTime
}
```

### RubricCriteria
```
RubricCriteria {
  id          String (CUID)
  rubricId    String → Rubric
  name        String
  description String?
  weight      Float (default 1.0)
  order       Int
  createdAt   DateTime
  updatedAt   DateTime
}
```

### Score
```
Score {
  id             String (CUID)
  organizationId String
  applicationId  String → Application
  criteriaId     String → RubricCriteria
  judgeId        String → User
  value          Float (0.0–10.0, enforced at app layer)
  comment        String?
  createdAt      DateTime
  updatedAt      DateTime

  UNIQUE: (applicationId, criteriaId, judgeId)
}
```

### JudgeAssignment
```
JudgeAssignment {
  id             String (CUID)
  organizationId String
  judgeId        String → User
  roundId        String → Round
  createdAt      DateTime

  UNIQUE: (judgeId, roundId)
}
```

---

## 4. Status Lifecycles

### Event Status

```
DRAFT → OPEN → CHAPTER_REVIEW → JUDGING → NATIONAL_REVIEW → DECIDED → CLOSED
```

| Status | Description |
|---|---|
| `DRAFT` | Event created, not visible to applicants |
| `OPEN` | Applications are open |
| `CHAPTER_REVIEW` | Application window closed; chapter judges reviewing |
| `JUDGING` | Chapter review complete; national judges scoring |
| `NATIONAL_REVIEW` | National scoring complete; chairs reviewing results |
| `DECIDED` | Winners/results determined |
| `CLOSED` | Archive state; no further changes |

Transitions are manual (triggered by NATIONAL_CHAIR or ADMIN).
Future: automatic transition based on dates.

### Application Status

```
SUBMITTED → CHAPTER_REVIEW → CHAPTER_APPROVED ─┐
                           └→ CHAPTER_REJECTED  │
                                                 ↓
                              NATIONAL_REVIEW → NATIONAL_APPROVED ─┐
                                             └→ NATIONAL_REJECTED  │
                                                                    ↓
                                                               DECIDED
```

| Status | Description |
|---|---|
| `SUBMITTED` | Application received, not yet reviewed |
| `CHAPTER_REVIEW` | Under chapter judge review |
| `CHAPTER_APPROVED` | Advances to national round |
| `CHAPTER_REJECTED` | Did not advance from chapter round |
| `NATIONAL_REVIEW` | Under national judge review |
| `NATIONAL_APPROVED` | Advances to final decision |
| `NATIONAL_REJECTED` | Did not advance from national round |
| `DECIDED` | Final determination made |

---

## 5. Rubric Criteria (Classical Voice Scholarship)

Each criterion is scored 0–10. All weights default to 1.0 (equal weighting).

| Order | Criterion | Description |
|---|---|---|
| 1 | Vocal Technique | Breath support, register transitions, physical production |
| 2 | Tone Quality | Beauty, consistency, and appropriateness of sound |
| 3 | Intonation Accuracy | Pitch accuracy throughout the performance |
| 4 | Diction/Language | Clarity and accuracy of text delivery in the sung language |
| 5 | Musicality | Phrasing, dynamics, rhythm, and musical sensitivity |
| 6 | Acting/Interpretation | Emotional depth and character portrayal |
| 7 | Stylistic Appropriateness | Period style, genre awareness, historical understanding |
| 8 | Stage Presence | Command of stage, physical engagement, audience connection |
| 9 | Repertoire Selection | Appropriateness and challenge level of chosen repertoire |
| 10 | Artistic Potential / X-Factor | Overall impression, uniqueness, potential for growth |

**Scoring:** Maximum possible score per application = 100 (10 criteria × 10 points).

---

## 6. Seed Data (Development)

The seed creates:
- 1 Organization: "National Classical Voice Foundation"
- 1 Admin: admin@adjudicarts.dev
- 1 National Chair: nationalchair@adjudicarts.dev
- 1 Chapter Chair: chapterchair@adjudicarts.dev
- 2 Chapter Judges: chapterjudge1@adjudicarts.dev, chapterjudge2@adjudicarts.dev
- 2 National Judges: nationaljudge1@adjudicarts.dev, nationaljudge2@adjudicarts.dev
- 3 Applicants: applicant1@adjudicarts.dev, applicant2@adjudicarts.dev, applicant3@adjudicarts.dev
- 1 Event: "2025 National Classical Voice Scholarship" (status: OPEN)
  - 1 Chapter Round: "Chapter Qualifying Round"
  - 1 National Round: "National Finals"
  - Full 10-criterion rubric attached

All seed user passwords: `password123` (bcrypt-hashed in DB)

---

## 7. 11-Day Feature Roadmap

### Day 1–2 (Complete): Foundation
- [x] Next.js 14 + TypeScript + Tailwind + shadcn/ui
- [x] Prisma schema + migration
- [x] NextAuth credentials provider with role-based JWT session
- [x] Seed data

### Day 3–4: Authentication UI + Navigation
- [ ] Login page (`/login`)
- [ ] Session provider wrapper in root layout
- [ ] Role-aware navigation sidebar/header
- [ ] Protected route middleware (`middleware.ts`)
- [ ] Redirect unauthenticated users to login

### Day 5–6: Event Management
- [ ] Event list page (ADMIN/CHAIR view)
- [ ] Event detail page
- [ ] Create/edit Event form (ADMIN, NATIONAL_CHAIR)
- [ ] Event status advancement controls
- [ ] Rounds management (create/view rounds per event)

### Day 7: Application Submission
- [ ] Application list (APPLICANT: own; CHAIR: all)
- [ ] Application submission form (APPLICANT, status: OPEN events only)
- [ ] Application detail view
- [ ] Status-aware visibility (applicants see only their own)

### Day 8: Chapter Judging
- [ ] Judge assignment UI (CHAPTER_CHAIR assigns CHAPTER_JUDGEs to chapter rounds)
- [ ] Scoring form for CHAPTER_JUDGE (10 criteria, 0–10 each)
- [ ] Score submission and editing (only during CHAPTER_REVIEW stage)
- [ ] Chapter scoresheet view (aggregated per application)

### Day 9: National Judging
- [ ] Judge assignment for national round (NATIONAL_CHAIR assigns NATIONAL_JUDGEs)
- [ ] National scoring form (same rubric, national round context)
- [ ] National scoresheet view
- [ ] Application status transitions (chapter approved → national review)

### Day 10: Results & Decisions
- [ ] Results dashboard (NATIONAL_CHAIR, ADMIN)
- [ ] Score aggregation view (total, per-criteria breakdown)
- [ ] Decision action (mark application as NATIONAL_APPROVED / NATIONAL_REJECTED / DECIDED)
- [ ] Applicant notification placeholder (email integration future)

### Day 11: Polish & Deploy
- [ ] Error boundaries and loading states
- [ ] Mobile-responsive layout review
- [ ] Vercel environment variable setup
- [ ] Production deployment and smoke test
- [ ] Final QA pass

---

## 8. Future Considerations (Post-Launch)

- Multi-tenancy: organization switcher, per-org subdomain routing
- OAuth login (Google Workspace for chapter chairs/judges)
- Email notifications (application received, status changes, decisions)
- Weighted rubric criteria (custom weights per event)
- File upload for audio/video audition recordings (Vercel Blob or S3)
- Applicant portal with full history
- Analytics dashboard for chairs
- Audit log for status changes
