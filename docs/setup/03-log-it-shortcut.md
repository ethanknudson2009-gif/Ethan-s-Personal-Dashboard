# Setup 3 — The "Log It" button on your iPhone

Press one button, say "speech outline due thursday", and it lands in your dashboard. About 10 minutes, once.

There are two versions. **Start with Version A.** It's simple, never fails, and uses no Claude messages: our own parser already understands classes, days and times. Add Version B later if you want Claude to clean things up first.

---

## Step 1: Create your private token (1 minute)
1. Open the dashboard → **Settings** (on the phone: **Classes** tab → *Settings* at the bottom).
2. Under **Connections**, keep the name **iPhone Log It** and tap **Create token**.
3. Tap **Copy**. The token starts with `dshc_`, and it's only shown this once. If you lose it, revoke it and make a new one.

> Treat it like a password: it only goes into your own Shortcut. Anyone with it could add items to your Inbox, but nothing gets saved without your approval unless you turn on "Skip the Inbox".

## Step 2: Build the Shortcut (Version A, no Claude)
Open the **Shortcuts** app → **+** (new shortcut) → rename it **Log It**. Add these actions in order (search for each name):

1. **Dictate Text**
   - Language: English · Stop Listening: **After Pause**
2. **Get Contents of URL**
   - URL: `https://ethan-s-personal-dashboard.vercel.app/api/capture`
   - Tap **Show More**:
     - Method: **POST**
     - Headers → **Add new header**:
       - `Authorization` = `Bearer ` + paste your token (one space after Bearer)
       - `Content-Type` = `application/json`
     - Request Body: **JSON** → Add new field → **Text**:
       - Key `raw_text` → Value: the **Dictated Text** variable (tap the value box, then choose *Dictated Text* from the bar above the keyboard)
3. **Get Dictionary Value**
   - Get **Value** for key `message` in **Contents of URL**
4. **Show Notification**
   - Text: the **Dictionary Value** variable

Tap **Done**. Try it: run it, say "anatomy test review thursday", and a notification should say **📥 To review: Human Anatomy: Test review · Thu, …**. It's waiting in your Inbox.

## Step 3: Put it on one button
Pick any (or all):
- **Lock Screen button (best):** on the Lock Screen, press and hold → **Customize** → **Lock Screen** → tap **−** on the flashlight or camera button → tap the empty spot → search **Shortcut** → choose **Log It** → **Done**.
- **Back Tap:** Settings → Accessibility → Touch → **Back Tap** → **Double Tap** → **Log It**. Tap the back of the phone twice.
- **Siri:** say "Hey Siri, Log It".
- **Control Center:** swipe down from the top right → press and hold → **Add a Control** → Shortcut → Log It.

## Version B: Claude cleans it up first (optional)
Needs the **Claude** iPhone app installed and signed in (it provides the **Ask Claude** action). Each use counts as one Claude message on your plan.

Between *Dictate Text* and *Get Contents of URL*, add:

1. **Ask Claude** with this prompt (put the *Dictated Text* variable at the end):

   ```text
   Turn my spoken note into JSON for my dashboard. Reply with ONLY one JSON object, no other text.
   Keys:
   "type": one of homework, task, food, workout, expense, note, habit
   "title": a short title without the class name or any date words
   "class_name": the class if it's school work, else null. My classes: World History, Choir, Human Anatomy, AI Mastermind, College Algebra, Speech, AutoCAD, Church History
   "due_text": the date/time words exactly as I said them (like "friday 3pm"), else null. Do NOT work out the actual date.
   "amount": dollars as a number if I mention money, else null
   "confidence": a number from 0 to 1 for how sure you are
   My note:
   ```
2. **Get Dictionary from Input** (input: Claude's answer)
3. **Set Dictionary Value**: key `raw_text`, value **Dictated Text**, in **Dictionary**
4. In **Get Contents of URL**, change Request Body to **File** and choose the **Dictionary** variable (delete the JSON field from Version A).

Why "don't work out the date": AI can get dates wrong, so the dashboard's own tested parser always turns "friday 3pm" into the real date. If Claude's version disagrees, the Inbox flags it.

## If something goes wrong
The notification shows the dashboard's reply:
- **"Missing or invalid token"**: check the header is exactly `Bearer dshc_…`, with one space and no extra spaces at the end.
- **"That token isn't valid"**: it was revoked. Create a new one in Settings.
- **"The body must be JSON"**: (Version B) Claude added extra words. Run it again, or use Version A.
- Nothing at all: check you have internet, and that the URL is exactly as above.
