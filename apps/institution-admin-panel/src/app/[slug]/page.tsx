import { redirect } from "next/navigation";

// Bare /<slug> → the admin entry (which itself forwards to the dashboard or
// login). Keeps half-typed/legacy links from dead-ending on a 404.
export default function SlugIndex({ params }: { params: { slug: string } }) {
  redirect(`/${params.slug}/admin`);
}
