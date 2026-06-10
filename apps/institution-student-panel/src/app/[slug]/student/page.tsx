import { redirect } from "next/navigation";

// Bare panel URL /<slug>/student → dashboard (the (dashboard) layout sends
// unauthenticated visitors on to /<slug>/student/login).
export default function StudentIndex({ params }: { params: { slug: string } }) {
  redirect(`/${params.slug}/student/dashboard`);
}
