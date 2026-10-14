import { redirect } from "next/navigation";

export default function Login({ searchParams }: { searchParams: { [k: string]: string | string[] | undefined } }) {
  const next = typeof searchParams.next === "string" ? `?next=${encodeURIComponent(searchParams.next)}` : "";
  redirect(`/signup${next}`);
}
