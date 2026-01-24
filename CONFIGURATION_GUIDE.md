# Configuration Guide for OAuth Setup

## Supabase Configuration

### Site URL
```
https://habitflow.tech
```
This should be your primary production domain.

### Redirect URLs
Add **ONLY** these specific callback URLs (remove all wildcards and non-callback URLs):

```
http://localhost:3000/auth/callback
https://habit-flow-ochre-two.vercel.app/auth/callback
https://habitflow.tech/auth/callback
https://www.habitflow.tech/auth/callback
```

**Important:** 
- Do NOT use wildcards (`/**`)
- Do NOT add root URLs without `/auth/callback`
- Only add specific callback endpoints
- Remove any preview deployment URLs unless you need them for testing

---

## Google Cloud Console Configuration

### Authorized JavaScript Origins
```
http://localhost:3000
https://habit-flow-ochre-two.vercel.app
https://habitflow.tech
https://www.habitflow.tech
```

### Authorized Redirect URIs
```
https://zqzegbvtoyqxidxuuzim.supabase.co/auth/v1/callback
```

This is the Supabase auth endpoint that Google redirects to.

---

## OAuth Flow

1. User clicks "Continue with Google" in your app
2. App redirects to Supabase Auth endpoint
3. Supabase redirects to Google OAuth
4. User authorizes on Google
5. Google redirects back to Supabase: `https://zqzegbvtoyqxidxuuzim.supabase.co/auth/v1/callback`
6. Supabase exchanges code and redirects to your app: `https://habitflow.tech/auth/callback`
7. Your app's callback route exchanges the code for a session
8. User is authenticated and redirected to the dashboard

---

## After Making Changes

1. **Save changes in Supabase** (wait 5-10 minutes for propagation)
2. **Deploy your updated code to Vercel**
3. **Clear browser cache and cookies**
4. **Unregister any existing service workers**:
   - Open DevTools → Application → Service Workers
   - Click "Unregister" on any registered workers
5. **Test the login flow** with a fresh browser session or incognito mode

---

## Troubleshooting

If you still see "Authentication Error":

1. Check browser console for specific errors
2. Verify the callback URL in the browser address bar matches one in Supabase
3. Check Supabase logs for any auth errors
4. Ensure environment variables are set correctly in Vercel
5. Make sure the Site URL in Supabase matches your primary domain
