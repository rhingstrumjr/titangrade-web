# TitanGrade Web

TitanGrade is a Next.js web application that helps science teachers grade student submissions using AI (powered by Gemini), with standards-based tracking, Marzano proficiency scales, and full Google Classroom integration.

## Features

### AI Grading Pipeline
- **Multi-Agent Architecture**: 3-agent pipeline (Vision OCR → Logic Grader → Socratic Feedback) for consistent, high-quality grading at low cost using Gemini 3.1 Flash-Lite.
- **Dual Framework Support**: Grade with **Standard rubrics** (points-based) or **Marzano proficiency scales** (0.0–4.0 with half-point increments).
- **Exemplar Calibration**: Star graded submissions as few-shot examples to teach the AI your personal grading style and strictness.
- **Socratic Mode**: AI provides guiding questions and hints rather than revealing correct answers.
- **Background Grading**: Submissions grade asynchronously via Next.js `after()` — no need to wait on the page.

### Standards & Learning Targets
- **Standards Library** (`/teacher/standards`): Full CRUD for NGSS standards with nested learning targets.
- **AI Standards Import**: Upload NGSS Evidence Statement PDFs or paste text — AI generates granular, three-dimensional learning targets using the *Unwrapping the Standard* system:
  - **DCI** content targets at all Marzano levels
  - **`[SEP]`** practice skill targets (foundational at 2.0, engineering at 4.0)
  - **`[CCC: ConceptName]`** metacognitive targets (why the crosscutting concept matters)
- **Editable Import Preview**: Add, edit, delete, and reorder AI-generated targets before saving.
- **Evaluation Matrix**: Link specific targets to assignments — teachers choose which targets to assess per assignment.

### Gradebook & Analytics
- **Dual-View Gradebook** (`/teacher/gradebook/[classId]`):
  - **By Assignment**: Traditional assignment × student grid with color-coded cells.
  - **By Learning Target**: Standards-based heatmap (students × targets) showing mastery levels.
- **Grade Review Modal**: Click any cell to view/edit scores, with teacher override support.
- **Analytics Drawer**: Slide-out performance analysis with score distribution, trouble spots, and AI-generated reteach plans.
- **Intervention Bank** (`/api/intervention-bank`): Save and retrieve reteach plans for reuse across assignments.

### Teacher Dashboard & Settings
- **Dashboard** (`/teacher`): Class tabs, assignment cards with action center badges, quick stats, and one-click navigation.
- **Teacher Settings** (`/teacher/settings`): Configure default grading framework (Standard/Marzano), AI feedback tone, and view profile stats.
- **Assignment Management**: Create, edit, duplicate, and delete assignments with structured rubrics, answer keys, and framework toggles.

### Google Classroom Integration
- **Course Sync**: Auto-import Google Classroom courses and rosters.
- **Assignment Import**: Pull assignments with automatic roster upsert and material loading.
- **Grade Writeback**: Push scores back to Google Classroom gradebook.
- **Feedback Docs**: Generate formatted Google Docs with AI feedback, attached directly to student submissions. Supports immediate or manual release.

## Database Architecture

Normalized relational schema (Supabase/PostgreSQL):

```
standards ──< learning_targets ──< assignment_targets >── assignments
                                                              │
submissions ──< submission_scores >── learning_targets   classes ──< roster_students
      │
teacher_profiles                    intervention_bank
```

### Key Tables
| Table | Purpose |
|-------|---------|
| `standards` | NGSS standards with code, description, dimension |
| `learning_targets` | Granular targets per standard (level + description) |
| `assignment_targets` | Links targets to assignments (Evaluation Matrix) |
| `submission_scores` | Normalized per-target scores (AI + teacher override) |
| `intervention_bank` | Saved reteach plans per target |
| `teacher_profiles` | Default framework, AI tone preferences |

## API Routes

| Route | Method | Purpose |
|-------|--------|---------|
| `/api/grade` | POST | AI grading pipeline (writes to `submission_scores`) |
| `/api/regrade` | POST | Batch regrade with exemplar calibration |
| `/api/parse-standard` | POST | AI standards import (PDF or text → structured targets) |
| `/api/parse-rubric` | POST | AI rubric extraction from documents |
| `/api/intervention-bank` | GET/POST | CRUD for saved reteach plans |
| `/api/reteach-suggestions` | POST | AI-generated intervention plans |
| `/api/generate-key` | POST | AI answer key generation from worksheets |
| `/api/release_grades` | POST | Batch feedback doc release to Google Classroom |
| `/api/classroom/*` | Various | Google Classroom sync, import, grade push |

## Getting Started

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Environment Variables

| Variable | Required | Purpose |
|----------|----------|---------|
| `NEXT_PUBLIC_SUPABASE_URL` | ✅ | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | ✅ | Supabase anonymous key |
| `SUPABASE_SERVICE_ROLE_KEY` | ✅ | Backend operations |
| `GOOGLE_GENERATIVE_AI_API_KEY` | ✅ | Gemini API access |
| Google OAuth credentials | ✅ | Classroom integration |

## Technologies

- **Framework**: Next.js 15 (App Router)
- **UI**: React, Tailwind CSS, Lucide React
- **Database**: Supabase (PostgreSQL + Auth + Real-time)
- **AI**: Vercel AI SDK + Google Gemini 3.1 Flash-Lite
- **Deployment**: Vercel (automatic CD from GitHub)

## Project Structure

```
src/
├── app/
│   ├── api/
│   │   ├── grade/              # AI grading pipeline
│   │   ├── parse-standard/     # Standards import
│   │   ├── intervention-bank/  # Reteach plan CRUD
│   │   ├── classroom/          # Google Classroom integration
│   │   └── ...
│   ├── teacher/
│   │   ├── page.tsx            # Dashboard
│   │   ├── standards/          # Standards library
│   │   ├── settings/           # Teacher profile
│   │   ├── gradebook/          # Dual-view gradebook
│   │   ├── analytics/          # Assignment analytics
│   │   ├── assignments/        # Assignment detail
│   │   └── submissions/        # Submission review
│   ├── submit/                 # Student submission portal
│   └── login/                  # Authentication
├── components/
│   ├── dashboard/              # GradebookCellModal, CreateAssignmentModal, etc.
│   ├── assignments/            # EvaluationMatrix, AnalyticsDrawer
│   ├── submissions/            # CategoryBreakdown
│   └── gradebook/              # StandardsHeatmap
├── types/
│   └── standards.ts            # Normalized type definitions
├── lib/
│   └── grading.ts              # Shared grading module
└── utils/
    └── supabase/               # Supabase client config
```
