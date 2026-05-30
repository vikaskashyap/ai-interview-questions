import { notFound } from "next/navigation";
import AdminView from "./AdminView";

export const dynamic = "force-dynamic";

export default function AdminPage({
  searchParams,
}: {
  searchParams: { key?: string };
}) {
  const expected = process.env.ADMIN_KEY;
  if (!expected || searchParams.key !== expected) {
    notFound();
  }
  return <AdminView adminKey={searchParams.key!} />;
}
