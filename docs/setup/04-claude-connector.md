# Setup 4 — Connect Claude to your dashboard

After this, you can ask Claude (on claude.ai, the desktop app or the iPhone app) things like *"what's due this week?"* or *"add my AutoCAD project due Friday"*, and it reads and writes your dashboard directly. It uses your Claude Pro plan, with no extra AI accounts or keys. About 3 minutes, once.

## Step 1: Create a connector token
1. Dashboard → **Settings** → **Connections**.
2. Under **For the Claude connector**, tap **Create token** and **Copy** it. It starts with `dshm_` and is shown only once.

## Step 2: Add it to Claude (on a computer is easiest)
1. Go to **claude.ai** → click your name/initials → **Settings** → **Connectors**.
2. Click **Add custom connector**.
   - **Name:** `Dashboard`
   - **URL:** `https://ethan-s-personal-dashboard.vercel.app/api/mcp`
   - **Authentication:** choose **No sign in**
   - **Request headers:** add one header:
     - Name: `Authorization`
     - Value: `Bearer ` + your token (one space after Bearer)
3. Click **Add**. Claude lists the dashboard's tools (get_today, list_due, add_assignment, and more).

It now works everywhere you're signed in to Claude, including the Claude iPhone app.

## Things to say
- "What do I have today?" / "What's due this week?"
- "Add a Speech outline due Thursday." It goes to your **Inbox** for a one-tap check, unless you tell Claude "yes, save it" after it reads the details back to you.
- "I finished the Anatomy lab report." Claude checks it off.
- "What's in my Inbox?" / "Approve the AutoCAD one."
- Snap a food photo and say "log this": it's kept in the Inbox until the calorie section is built (Phase 3).

## Safety
- Claude only sees **your** dashboard, through this token. Revoke the token in Settings at any time and the connector stops working.
- Claude never stores your data. Everything lives in the dashboard. Claude is the brain, not a second storage place.
