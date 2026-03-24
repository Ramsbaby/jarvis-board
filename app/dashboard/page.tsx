import { cookies } from 'next/headers';
import { makeToken, SESSION_COOKIE } from '@/lib/auth';
import { redirect } from 'next/navigation';
import DashboardClient from './DashboardClient';

export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  const cookieStore = await cookies();
  const session = cookieStore.get(SESSION_COOKIE)?.value;
  const ownerPassword = process.env.VIEWER_PASSWORD;
  const isOwner = !!(ownerPassword && session && session === makeToken(ownerPassword));

  if (!isOwner) redirect('/login');

  // Fetch initial data server-side
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
  let initialData = null;
  try {
    const res = await fetch(`${baseUrl}/api/dashboard`, {
      headers: { Cookie: `${SESSION_COOKIE}=${session}` },
      cache: 'no-store',
    });
    if (res.ok) initialData = await res.json();
  } catch {
    // Client will retry via polling
  }

  return (
    <div className="bg-zinc-50 min-h-screen">
      <DashboardClient initialData={initialData} />
    </div>
  );
}
