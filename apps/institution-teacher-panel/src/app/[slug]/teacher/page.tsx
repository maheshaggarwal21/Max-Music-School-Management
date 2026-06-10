import { redirect } from "next/navigation";

// Bare panel URL /<slug>/teacher → dashboard (the (dashboard) layout sends
// unauthenticated visitors on to /<slug>/teacher/login).
export default function TeacherIndex({ params }: { params: { slug: string } }) {
  redirect(`/${params.slug}/teacher/dashboard`);
}
