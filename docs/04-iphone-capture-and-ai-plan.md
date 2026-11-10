# 04 — iPhone Capture & AI Plan

## Goals
- Pick up the phone, press **one button**, talk, and it's saved to the dashboard.
- Open the dashboard from an **app icon**, not through Safari.
- **No extra AI services:** Claude (Pro plan) is the brain.
- Everything ends up in **one place**.

## App icon without the App Store
Install the dashboard to the Home Screen once (Safari → Share → Add to Home Screen). After that it opens full screen from its own icon. On iOS 26, every site added to the Home Screen opens as a web app by default. This step also unlocks notifications (iOS 16.4+).

## iPhone 13: ways to trigger capture
The iPhone 13 has no Action Button (iPhone 15 Pro and newer) and no Apple Intelligence.

| Trigger | Speed | Works locked? | Notes |
|---|---|---|---|
| **Lock Screen button** (replaces flashlight/camera) | 1 press | Yes | iOS 18+ on any iPhone. **Best pick.** |
| Back Tap | Double or triple tap | Unlocked | Settings → Accessibility → Touch → Back Tap |
| "Hey Siri, log it" | Hands-free | Yes | Siri runs any Shortcut by name |
| Control Center button | Swipe + tap | Yes | Same control as the Lock Screen one |
| NFC sticker (gym bag, desk) | Tap the phone | Unlocked | Shortcuts automation, e.g. "Gym started" |
| Shortcut icon on the Home Screen | 1 tap | No | Next to the dashboard icon |

## The "Log It" Shortcut
1. **Dictate Text:** you just talk.
2. **Ask Claude** (a Shortcuts action from the Claude iPhone app, iOS 18+): "Turn this into JSON: type (homework, food, workout, expense, job, note, habit), title, due date, amounts…"
3. **Get Contents of URL:** sends that JSON to the dashboard's private `/api/capture` address.
4. **Show:** "Saved ✓ Bio lab report · due Fri".

**Fallback:** if Claude is unavailable or the usage limit is reached, the Shortcut sends the raw words. The dashboard's own date/keyword parser files them, or puts them in the Inbox.

Notes:
- "Ask Claude" uses the Claude app's default model and counts toward Pro usage limits.
- The Claude app also has an **"Analyze Photo with Claude"** Lock Screen / Control Center button and a widget with dictation and camera buttons.

## Claude connector (MCP)
- The dashboard runs its own **MCP server** at a protected address.
- Ethan adds it once as a **custom connector** on claude.ai (Pro supports this). It then works in the Claude web, desktop and iPhone apps.
- Planned tools: `get_today`, `list_due`, `add_task`, `log_food`, `log_workout`, `log_expense`, `add_note`, `process_inbox`, `import_syllabus`.

## How close to "one app"? About 90–95%
| Doing | Where | Behind the scenes |
|---|---|---|
| Look at anything | Dashboard icon | — |
| Talk | Lock Screen button / Siri / Back Tap | Shortcut → Ask Claude → dashboard |
| Talk while already in the dashboard | Mic button | Launches the Log It Shortcut, then returns (test this) |
| Food photo | Camera button → Log It (photo mode) | Plan A: Ask Claude reads the photo (untested). Plan B: "Analyze Photo with Claude" → Claude logs it through the connector |
| Syllabus / PDF | Share Sheet → "Send to Dashboard" | Saved in the dashboard; Claude pulls out the deadlines → review screen |
| Big thinking ("plan my week") | Claude app | Connector reads and writes the dashboard |

**Rule:** every path ends in the dashboard. Claude is the brain, never a second place to store things.

## To test first
- Whether "Ask Claude" accepts photos inside Shortcuts.
- Whether a dashboard button can launch the Shortcut and return smoothly.
- That push notifications arrive on the iPhone 13 after "Add to Home Screen".

## Sources
- Claude iOS intents, Shortcuts and widgets: https://support.claude.com/en/articles/10263469-use-claude-app-intents-shortcuts-and-widgets-on-ios
- Custom connectors (remote MCP): https://support.claude.com/en/articles/11175166-getting-started-with-custom-connectors-using-remote-mcp
- Building custom connectors: https://support.anthropic.com/en/articles/11503834-building-custom-connectors-via-remote-mcp-servers
- iOS 18 Lock Screen controls: https://9to5mac.com/2024/09/20/iphone-16-tip-replace-the-camera-button-on-your-lock-screen/
- iOS 26 supports iPhone 11 and later: https://www.macrumors.com/2025/06/09/ios-26-supports-iphone-11-and-newer/
- PWAs on iOS: https://www.mobiloud.com/blog/progressive-web-apps-ios
