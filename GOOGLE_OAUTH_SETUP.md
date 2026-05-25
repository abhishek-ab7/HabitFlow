# Supabase Google OAuth Setup Guide for Habit Flow

You are seeing the error `"Unsupported provider: provider is not enabled"` because Google OAuth is not yet enabled and configured in your Supabase project settings.

Follow these steps to fix it:

### 1. Create Google Cloud Credentials
1. Go to the [Google Cloud Console](https://console.cloud.google.com/).
2. Create a new project or select an existing one.
3. Go to **APIs & Services > Credentials**.
4. Click **Configure Consent Screen**.
   - Choose **External**.
   - Fill in the App Name (Habit Flow), User support email, and Developer contact info.
   - Add the scope `.../auth/userinfo.email` and `.../auth/userinfo.profile`.
5. Go back to **Credentials**, click **+ Create Credentials > OAuth client ID**.
6. Select **Web application**.
7. Under **Authorized redirect URIs**, add your Supabase Callback URL.
   - You can find this in your Supabase Dashboard under **Authentication > Providers > Google**.
   - It usually looks like: `https://zqzegbvtoyqxidxuuzim.supabase.co/auth/v1/callback`
8. Click **Create** and copy your **Client ID** and **Client Secret**.

### 2. Enable Google Provider in Supabase
1. Go to your [Supabase Dashboard](https://supabase.com/dashboard/project/zqzegbvtoyqxidxuuzim/auth/providers).
2. Find **Google** in the list of providers and click to expand it.
3. Toggle **Enable Google Provider** to ON.
4. Paste your **Client ID** and **Client Secret** obtained from Google.
5. Click **Save**.

### 3. Update Redirect URLs
1. In Supabase, go to **Authentication > URL Configuration**.
2. Ensure `http://localhost:3000` is in the **Site URL** or **Redirect URLs** list.
3. If you have deployed to Vercel, add your production URL here too (e.g., `https://your-app.vercel.app`).

---

### Temporary Fix: Use Email/Password
While setting up Google OAuth, you can still use the app by signing up with an **Email and Password**. 

I have ensured the UI supports both. Once you enable Google in the dashboard, the "Continue with Google" button will work automatically!
