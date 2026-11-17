# Setup 1 — Supabase, your login, and Vercel

You do this once. It takes about 15 minutes. Everything here is on the **free** plan, and no credit card is needed.

## Part A: Supabase (the database)

1. Go to **supabase.com** → **Start your project** → **Continue with GitHub** (use your `ethanknudson2009-gif` account).
2. If it asks you to create an organization: name it anything (e.g. "Ethan") and pick the **Free** plan.
3. Click **New project**:
   - **Name:** `dashboard`
   - **Database password:** click **Generate a password**, then save it somewhere safe (a password manager or your Notes app). We don't need it right now.
   - **Region:** **West US** (the closest one to Arizona)
   - Click **Create new project** and wait a minute or two while it sets up.
4. **Create the first table:** in the left sidebar click **SQL Editor** → **New query**. Open `supabase/migrations/0001_profiles.sql` from this repo, copy all of it, paste it in, and click **Run**. You should see "Success. No rows returned."
5. **Create your login:** left sidebar → **Authentication** → **Users** → **Add user** → **Create new user**. Type your email and a password you'll remember, tick **Auto Confirm User**, and click **Create user**.
6. **Lock the door:** **Authentication** → **Sign In / Providers**. Turn **off** "Allow new users to sign up" and click **Save**. Now nobody else can make an account. We'll turn it back on for friends in Phase 5.
7. **Copy two values** (you'll paste them in Parts B and C):
   - **Project URL:** **Project Settings** (gear icon) → **Data API** → *Project URL* (looks like `https://abcd1234.supabase.co`)
   - **Publishable key:** **Project Settings** → **API Keys** → the key starting with `sb_publishable_`

   Both are safe to use in a website. Do **not** copy the *secret* key yet; we won't need it until Phase 2.

## Part B: Run it on your computer

1. In the project folder, make a copy of `.env.example` and name the copy `.env.local`.
2. Open `.env.local` and replace the two example values with your Project URL and Publishable key. Save the file. (Git ignores `.env.local`, so it never goes to GitHub.)
3. In a terminal in the project folder, run:
   ```bash
   npm run dev
   ```
4. Open **http://localhost:3000**. You'll land on the login page. Sign in with the email and password from step A5. The Today page should say **"✓ Database connected."**

## Part C: Put it online with Vercel

1. Go to **vercel.com** and log in with GitHub.
2. Click **Add New…** → **Project**. Find **Ethan-s-Personal-Dashboard** and click **Import**.
   - If it isn't in the list: click **Adjust GitHub App Permissions** and give Vercel access to that repo.
3. Leave the build settings alone (Vercel detects Next.js). Open **Environment Variables** and add both, exactly as in `.env.local`:
   - `NEXT_PUBLIC_SUPABASE_URL` = your Project URL
   - `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` = your Publishable key
4. Click **Deploy** and wait about 1 minute. You'll get an address like `https://ethan-s-personal-dashboard.vercel.app`.
5. Back in Supabase: **Authentication** → **URL Configuration** → set **Site URL** to that Vercel address and click **Save**.
6. Open the Vercel address, on your computer **and** on your iPhone, and sign in. Every time we push to `main` from now on, Vercel redeploys by itself.

## If something goes wrong
- **"Missing NEXT_PUBLIC_SUPABASE_URL…"**: `.env.local` is missing, misnamed (it must not end in `.txt`), or in the wrong folder. On Vercel: the environment variables weren't added. Add them, then **Deployments → ⋯ → Redeploy**.
- **"That email and password didn't match"**: check the user exists under Authentication → Users and was auto-confirmed.
- **"Couldn't load your profile"**: step A4 wasn't run, or it was run *after* creating the user. Fix: run this in the SQL Editor:
  ```sql
  insert into public.profiles (id, display_name)
  select id, split_part(email, '@', 1) from auth.users
  on conflict (id) do nothing;
  ```
