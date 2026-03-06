---
name: TitanGrade Development Best Practices
description: Essential rules and gotchas for working on the TitanGrade application, focusing on Supabase RLS, Next.js Auth, and third-party integrations.
---

# TitanGrade Development Best Practices

When working on TitanGrade, you must strictly adhere to the following rules to ensure data privacy, security, and functional integrations.

## 1. Multi-Tenant Verification & Row Level Security (RLS)
TitanGrade is a multi-tenant application where teachers must only see their own data, and students must only see data relevant to them.

- **Explicit Policies:** Never rely on default permissiveness. Always write explicit `anon` and `authenticated` policies for *every* table you create or modify.
- **Teacher Scope:** When dealing with `assignments`, `classes`, `roster_students`, or similar entities, the RLS policy MUST verify ownership using `auth.uid()` against a `teacher_id` column.
- **Legacy Migrations:** If adding new scoping columns (like `teacher_id`) to existing tables, you MUST write a migration script to assign all legacy data to a default user before dropping any "Public can view" policies.
- **Verification Plan:** Before finalizing any feature that touches data, you must explicitly confirm how the feature behaves if two completely different users are using the app simultaneously. 

## 2. Supabase Auth & Next.js Server-Side Rendering (SSR) Quirks
We use Supabase with the Next.js App Router (SSR).

- **OAuth Provider Tokens:** When a user logs in via a third-party OAuth provider (like Google), the `provider_token` (e.g., for accessing Google Classroom APIs) is **only returned once** during the initial `exchangeCodeForSession` callback. It is NOT automatically persisted in the Supabase session object on subsequent requests.
- **Token Persistence:** If you need the `provider_token` for backend API calls, you MUST capture it during the auth callback (`src/app/auth/callback/route.ts`) and manually persist it using a secure HTTP cookie (e.g., `cookieStore.set('provider_token', ...)`). All subsequent API routes must read it from this cookie.

## 3. Third-Party API Integrations
When asked to build or debug a feature integrating with a third-party API (Google Workspace, Stripe, OpenAI, etc.):

- **Mandatory Documentation Check:** Before writing *any* code, you must use the `supabase-mcp-server_search_docs` tool or general web search to review the latest documentation and best practices regarding the specific integration, particularly how it interacts with Next.js SSR and Supabase Auth.
- **No Assumptions:** Never assume an integration will "just work" based on client-side patterns if we are implementing it on the server-side. Explicitly check for edge cases.

## 4. UI/UX Aesthetics
- TitanGrade aims for a premium, clean, and modern aesthetic. 
- Use standard, polished UI components. Avoid generic placeholder designs.

---
*By reading this skill file, you acknowledge these constraints and agree to apply them to all your proposed solutions for TitanGrade.*
