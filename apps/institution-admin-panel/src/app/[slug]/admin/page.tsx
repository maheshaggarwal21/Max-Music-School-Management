import { redirect } from "next/navigation";

// Bare panel URL /<slug>/admin → dashboard (the (dashboard) layout sends
// unauthenticated visitors on to /<slug>/admin/login).
export default function AdminIndex({ params }: { params: { slug: string } }) {
  redirect(`/${params.slug}/admin/dashboard`);
}
