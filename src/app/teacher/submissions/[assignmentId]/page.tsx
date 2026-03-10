"use client";
import { useParams } from "next/navigation";
import { redirect } from "next/navigation";

export default function SubmissionsRedirect() {
  const params = useParams();
  const assignmentId = params.assignmentId as string;
  redirect(`/teacher/assignments/${assignmentId}`);
}
