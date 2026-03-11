# TitanGrade Web

TitanGrade is a Next.js web application designed to help teachers grade student submissions using AI (Powered by Gemini) with robust rubric classification and standard-based skill assessments. 

## Features
- **AI Grading**: Automatically grade assignments based on standard rubrics or Marzano proficiency scales.
- **Exemplars & Calibration**: Star previous graded assignments to use them as few-shot examples for the AI, teaching it your specific grading style and expectations.
- **Consolidated Editing**: Easily override the AI's grading by clicking "Edit Grade" on a submission. This allows you to simultaneously adjust the overall score, feedback, and individual rubric category breakdowns.
- **Selective Regrading**: Batch-regrade specific submissions when the rubric changes or when you've added new exemplars.
- **Dashboard & Analytics Slider**: Track grading progress and view lightning-fast class analytics via a built-in slide-out drawer without leaving the submissions view.
- **Google Classroom Feedback Docs**: Automatically or manually generate a private Google Doc for each student with their AI-graded feedback and attach it directly to their Classroom submission.
- **CSV Export**: Export final student grades to a CSV file for SIS integration.

## Recent Updates
- **Feedback Release Management**: Added support for **Immediate** vs. **Manual** feedback release. Manual release generates and attaches formatted Google Docs to student submissions in Google Classroom.
- **Analytics UI Extraction**: Refactored the full-page analytics view into a modular `AnalyticsDrawer` component. Shifted the Analytics entry point to a primary button on the assignment toolbar for instant access.
- **Google Classroom Sync Guard**: Hardened the sync pipeline to recognize and ignore files prefixed with `"TitanGrade Feedback:"`, preventing infinite grading loops when feedback documents are attached.
- **Custom Assignment Descriptions**: Updated the sync logic to push a dedicated `description` field to Google Classroom coursework instead of the grading rubric, ensuring students only see instructions and not internal grading logic.
- **Major Dashboard Refactor (v2.0)**: The teacher dashboard (`page.tsx`) has been completely architected for scalability. It was reduced from 1,900+ lines to ~280 lines by extracting core UI into modular components: `AssignmentCard`, `ClassTabs`, `ManageRosterModal`, `CreateAssignmentModal`, `GoogleClassroomImportModal`, and `PublishToGCModal`.
- **Class Management**: Added native support for **Archiving** and **Deleting** classes. Archived classes can be toggled via a new dashboard switch, keeping the workspace clean while preserving historical data.
- **Improved Google Classroom Import**: 
  - Automatically imports and syncs the student roster when an assignment is pulled from GC.
  - Option to auto-load assignment materials (Drive files) as student exemplars for calibration.
- **Unified Assignment Editing**: The assignment detail page now serves as the single source of truth for all configuration (rubrics, frameworks, answer keys, toggles).
- **Assignment Duplication**: 1-click cloning of assignments (rubrics, frameworks, and settings) directly from the dashboard.
- **Performance & Reliability**:
  - Implemented PostgreSQL Real-time for instant dashboard updates during background grading.
  - Hardened Google Classroom sync logic to prevent race conditions during multi-file processing.
  - Modularized the student submissions view into maintainable sub-components.

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## Environment Variables
Ensure you have the following environment variables configured:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` (for backend routes)
- Gemini API Keys (if applicable)

## Technologies Used
- Next.js (App Router)
- React & Tailwind CSS
- Supabase (PostgreSQL & Auth)
- Lucide React (Icons)
