# 09 — Design Direction

*From Ethan, November 17, 2026, with two reference images. This guides the design phase after Phase 1 works. The 20-layout / 20-color gallery (roadmap) starts from this direction.*

> The reference images are third-party mockups (one from freepik.com). They're kept out of the repo and described here in words. We take the *feel*, not the artwork.

## The feel: clean, techy, a little cyberpunk
- **Dark base** (deep navy/charcoal, never pure black) with **soft, raised cards** (subtle neumorphic shadows) and **neon teal/cyan accents** that glow slightly. Reference 2 is the main inspiration: dark panels, rounded cards, a glowing teal line chart, bright accent buttons.
- **Calm, not busy.** No walls of random stats. Every screen leads with **what needs doing**. Numbers appear only when they lead to an action.
- **One accent color per life area** (school, gym, finance, life, jobs), used only where it means something.
- Reference 1 (light dashboard) contributes the *layout ideas*: a big summary card at the top, a short list of recent items, colorful category tiles, and a **bottom tab bar with a floating center "+" button**.

## Layout
- **Mobile first.** It's used mostly as an iPhone app. On a laptop the same screens show more at once (sidebar plus 2–3 columns instead of one).
- **Different screens per area, switched from a bottom bar** you can scroll sideways: **Today · School · Gym · Finance · Life (habits/journal) · Jobs …**, plus Inbox and Settings. On a laptop these become the sidebar.
- **The center "+" button** is the one-tap way to add or *talk*: it opens quick add, which can launch the "Log It" voice Shortcut (doc 04).

## Making "what needs doing" obvious
- **Highlighted items:** anything due soon or behind on its Cushion gets a glowing edge in its area color. Behind = red glow, tight = amber, ahead = calm.
- **Visual notifiers:** count badges on the bottom-bar tabs (e.g. School •3), a soft pulse on things due today, and an "all clear" state when a screen has nothing left.
- **Class-first titles:** **Speech: "What is Equal" Journal** (doc 08).
- **A satisfying check-off:** the checkbox ring fills, a checkmark draws itself, the row's title gets struck through and the row slides away, with a tiny burst of light in the area color. Short (under half a second), smooth, and never blocking.
- Charts only where they help (e.g. budget trend, lift progress), styled like reference 2: one glowing line, a highlighted current point.

## How it's built so the design is easy to apply
All screens use the shared building blocks in `src/components/ui.tsx` (cards, buttons, inputs, task rows, badges). The design phase restyles those pieces plus the color theme, so every screen changes together.

## On the iPhone (milestone 7)
The dashboard installs as its own app with no App Store: open the site in Safari → Share → **Add to Home Screen**. It then opens full screen from its own icon, with no Safari bars, and can send notifications. Step-by-step instructions come with milestone 7.
