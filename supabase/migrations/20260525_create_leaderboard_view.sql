-- Create leaderboard view
CREATE OR REPLACE VIEW public.leaderboards AS
SELECT 
    user_id,
    user_name,
    level,
    xp,
    avatar_id,
    stats,
    updated_at
FROM 
    public.user_settings;

-- Grant select permission only to authenticated users
REVOKE ALL ON public.leaderboards FROM public;
GRANT SELECT ON public.leaderboards TO authenticated;
