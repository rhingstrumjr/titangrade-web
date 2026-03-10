# TitanGrade Web

TitanGrade is a Next.js web application designed to help teachers grade student submissions using AI (Powered by Gemini) with robust rubric classification and standard-based skill assessments. 

## Features
- **AI Grading**: Automatically grade assignments based on standard rubrics or Marzano proficiency scales.
- **Exemplars & Calibration**: Star previous graded assignments to use them as few-shot examples for the AI, teaching it your specific grading style and expectations.
- **Consolidated Editing**: Easily override the AI's grading by clicking "Edit Grade" on a submission. This allows you to simultaneously adjust the overall score, feedback, and individual rubric category breakdowns.
- **Selective Regrading**: Batch-regrade specific submissions when the rubric changes or when you've added new exemplars.
- **Dashboard & CSV Export**: Track grading progress and export final student grades to a CSV file.

## Recent Updates
- **Unified Assignment Page**: The assignment settings and submissions view are now combined into a single `/teacher/assignments/[id]` page. Teachers can edit rubrics, framework, toggles, and view submissions without navigating between pages.
- **Prominent Class Tabs**: Class navigation redesigned with larger tabs, bottom-border active indicator, assignment count badges per class, and a roster icon for quick access to student management.
- **Clickable Assignment Names**: Clicking an assignment title on the dashboard now navigates directly to the unified assignment page.
- **Decluttered Submissions Toolbar**: Primary actions (Release Grades, Grade All) stay visible; secondary actions (Regrade, Sync, Push Grades, CSV, Analytics) are grouped under an "Actions" dropdown.
- **Top-Level Regrade Checkboxes**: Regrade selection checkboxes are now visible at the table row level — no need to expand a student's submission history to select them.
- **Google Classroom Submission Status**: The sync now captures whether students have turned in work. New status badges: "Not Submitted" (gray) and "Ready for Feedback" (amber) complement the existing "Graded" (green) and "Error" (red).
- **Auto-Sync on Page Load**: GC-linked assignments automatically sync from Google Classroom when opened, showing fresh submission statuses.
- **Auto-Redirect After Publish**: Publishing to Google Classroom now redirects to the unified assignment page, eliminating the manual import step.
- **Google Classroom Integration**: Teachers can now import class rosters and assignments directly from Google Classroom.
- **Google Drive Export Support**: Background conversion seamlessly exports student Google Docs, Sheets, and Slides submissions into PDFs for AI grading.
- **Real-time Grading View**: The submissions dashboard now updates student scores dynamically in real-time as the AI API finishes grading each individual paper.
- **AI Grading Transparency**: A new expandable details section surfaces exactly how the AI graded a submission, showing the extracted text (OCR) and step-by-step reasoning logic.
- **Assignment Duplication**: Teachers can now quickly clone existing assignments (including their complex structured rubrics, framework, and settings) with a single click on the dashboard via the new "Copy" icon.
- **Consolidated UI**: The "Edit Grade" and "Edit Skills/Category Assessment" buttons have been merged into a single edit flow.
- **Submissions View Refactor**: The complex Submission view has been broken down into smaller, maintainable React components (`CategoryBreakdown`, `RegradeModal`, `ScoreDiff`).
- **Dynamic Skill Editing**: Instructors can edit specific skill dimensions (`Demonstrated`, `Partial`, `Not Demonstrated`, `Not Assessed`) inside the main editing pane.

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
