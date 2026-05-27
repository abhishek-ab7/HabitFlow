import { redirect } from 'next/navigation';
import { LandingPage } from '@/components/landing/LandingPage';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export default async function HomePage() {
  const supabase = await createServerSupabaseClient();
  const { data: { session } } = await supabase.auth.getSession();

  if (session) {
    redirect('/dashboard');
  }

  return <LandingPage />;
}
