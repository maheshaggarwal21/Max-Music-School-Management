// Dev-only root (/). In production nginx routes only /<slug>/admin/* to this
// app, so this is never reached; institution entry is /<slug>/admin.
export default function Home() {
  return null;
}
