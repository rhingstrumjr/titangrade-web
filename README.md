# TitanGrade Web

TitanGrade is a Next.js web application designed to help teachers grade student submissions using AI (Powered by Gemini) with robust rubric classification and standard-based skill assessments. 

## Features
- **AI Grading**: Automatically grade assignments based on standard rubrics or Marzano proficiency scales.
- **Exemplars & Calibration**: Star previous graded assignments to use them as few-shot examples for the AI, teaching it your specific grading style and expectations.
- **Consolidated Editing**: Easily override the AI's grading by clicking "Edit Grade" on a submission. This allows you to simultaneously adjust the overall score, feedback, and individual rubric category breakdowns.
- **Selective Regrading**: Batch-regrade specific submissions when the rubric changes or when you've added new exemplars.
- **Dashboard & CSV Export**: Track grading progress and export final student grades to a CSV file.

## Recent Updates
- **Unified Assignment Editing**: The assignment detail page now includes a full-featured editor. Teachers can build structured rubrics, auto-parse rubrics from files/text using AI, upload exemplars, and auto-generate answer keys from worksheets without leaving the page.
- **Google Classroom Class Syncing**: New "Sync Google Classes" feature that auto-creates TitanGrade classes matching your Google Classroom courses, enabling structured management.
- **Smart Import & Multi-Class Publish**:
  - **Auto-Sort on Import**: Assignments imported from Google Classroom are now automatically assigned to the correct TitanGrade class based on the course ID.
  - **Multi-Class Publish**: Teachers can now publish a single assignment to multiple Google Classroom courses at once. The system handles duplicating the assignment into the correct classes and linking them to GC coursework.
- **Exemplars & Calibration**: Star previous graded assignments to use them as few-shot examples for the AI, teaching it your specific grading style and expectations.
- **Consolidated UI**: The "Edit Grade" and "Edit Skills/Category Assessment" buttons have been merged into a single edit flow.
- **Assignment Duplication**: Teachers can now quickly clone existing assignments (including their complex structured rubrics, framework, and settings) with a single click on the dashboard via the new "Copy" icon.
- **Google Classroom Integration**: Improved linking between TitanGrade and Google Classroom, supporting auto-linking and improved sync states.
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
