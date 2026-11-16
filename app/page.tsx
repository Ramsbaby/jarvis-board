import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { makeToken, SESSION_COOKIE } from '@/lib/auth';
import CommandRoom from '@/components/command-room/CommandRoom';

export const dynamic = 'force-dynamic';
export default async function Home() {
  const session = (await cookies()).get(SESSION_COOKIE)?.value;
  const password = process.env.VIEWER_PASSWORD;
  if (!password || !session || session !== makeToken(password)) redirect('/login?next=%2F');
  return <CommandRoom />;
}
