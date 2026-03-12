import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getValidatedProviderToken } from "@/lib/auth";

export async function GET(req: NextRequest) {
  let token = null;

  const authHeader = req.headers.get("authorization");
  if (authHeader && authHeader.startsWith("Bearer ")) {
    token = authHeader.split(" ")[1];
  }

  // Fallback to cookie if frontend did not provide it
  if (!token) {
    token = await getValidatedProviderToken();
  }

  if (!token) {
    return NextResponse.json({ error: "Missing or invalid authorization token" }, { status: 401 });
  }

  try {
    const res = await fetch("https://classroom.googleapis.com/v1/courses?courseStates=ACTIVE", {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });

    if (!res.ok) {
      const errorData = await res.json();
      console.error("Google Classroom API error:", errorData);
      return NextResponse.json({ error: "Failed to fetch courses from Google Classroom", details: errorData }, { status: res.status });
    }

    const data = await res.json();
    return NextResponse.json({ courses: data.courses || [] });
  } catch (error) {
    console.error("Error fetching courses:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
