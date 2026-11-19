/**
 * Layout ideas for the design gallery. Each one is drawn as a little phone
 * screen from simple blocks, so Ethan can see the idea and "like" the ones
 * he wants built. Our own ideas, described by what they're good at.
 */
export type Block =
  | "greet" // big hello + date
  | "hero-ring" // card with a progress ring
  | "stats3" // three small numbers in a row
  | "list" // a list of tasks
  | "list-compact" // a tight list
  | "grid2" // 2×2 tiles
  | "grid3" // 3-wide small tiles
  | "chips" // a row of pill buttons
  | "timeline" // time down the left, items on the right
  | "week" // 7 little day bubbles
  | "kanban" // three columns of cards
  | "big-number" // one huge number
  | "carousel" // a sideways row of cards
  | "focus" // one big "do this now" card
  | "bars" // progress bars
  | "month" // a mini calendar
  | "search" // a search / talk bar
  | "feed"; // stacked cards with a small image strip

export type Nav = "bottom" | "pill" | "rail" | "top" | "fab" | "dock";

export type LayoutIdea = { id: string; name: string; idea: string; nav: Nav; blocks: Block[]; cards: "glass" | "solid" | "outline" | "neon" };

export const LAYOUTS: LayoutIdea[] = [
  { id: "classic", name: "Command Center", idea: "What you have now: hero, week strip, lists", nav: "bottom", cards: "glass", blocks: ["greet", "hero-ring", "week", "list"] },
  { id: "focus-first", name: "One Thing", idea: "A giant card for the single next task", nav: "pill", cards: "neon", blocks: ["greet", "focus", "chips", "list-compact"] },
  { id: "tiles", name: "Tile Wall", idea: "Every area as a big tile, tap to open", nav: "bottom", cards: "solid", blocks: ["greet", "grid2", "grid2", "list-compact"] },
  { id: "timeline", name: "Timeline Day", idea: "Your day top to bottom by the hour", nav: "bottom", cards: "glass", blocks: ["week", "timeline", "timeline"] },
  { id: "stats", name: "Scoreboard", idea: "Numbers first: streaks, XP, money, lifts", nav: "pill", cards: "outline", blocks: ["big-number", "stats3", "bars", "list-compact"] },
  { id: "cards-swipe", name: "Swipe Deck", idea: "Sideways cards per area, swipe through", nav: "dock", cards: "glass", blocks: ["greet", "carousel", "carousel", "list-compact"] },
  { id: "board", name: "Kanban", idea: "To do / Doing / Done columns", nav: "top", cards: "solid", blocks: ["chips", "kanban"] },
  { id: "minimal", name: "Zen", idea: "Lots of space, only today's 3 things", nav: "fab", cards: "outline", blocks: ["greet", "list-compact", "bars"] },
  { id: "terminal", name: "Terminal", idea: "Hacker look: tight lists, mono text", nav: "top", cards: "outline", blocks: ["search", "list-compact", "list-compact", "stats3"] },
  { id: "calendar-home", name: "Calendar Home", idea: "Month on top, the tapped day below", nav: "bottom", cards: "glass", blocks: ["month", "list"] },
  { id: "rail", name: "Side Rail", idea: "Icons on the left edge, content wide", nav: "rail", cards: "solid", blocks: ["greet", "hero-ring", "grid3", "list-compact"] },
  { id: "feed", name: "Feed", idea: "Like a social feed: one card per thing", nav: "bottom", cards: "glass", blocks: ["search", "feed", "feed"] },
  { id: "gamer", name: "Game HUD", idea: "XP bar, level, quests like a game", nav: "dock", cards: "neon", blocks: ["bars", "stats3", "list", "chips"] },
  { id: "split", name: "Split Screen", idea: "Top half today, bottom half the week", nav: "pill", cards: "glass", blocks: ["hero-ring", "week", "timeline"] },
  { id: "widgets", name: "Widget Stack", idea: "iPhone-widget style blocks you can rearrange", nav: "bottom", cards: "solid", blocks: ["grid2", "bars", "grid3", "carousel"] },
  { id: "talk", name: "Talk First", idea: "A big mic bar on top; everything else below", nav: "fab", cards: "glass", blocks: ["search", "chips", "list", "week"] },
  { id: "dashboard-pro", name: "Pro Dashboard", idea: "Dense: charts, numbers and lists together", nav: "rail", cards: "outline", blocks: ["stats3", "bars", "grid3", "list-compact", "list-compact"] },
  { id: "week-planner", name: "Week Planner", idea: "The whole week at once, like a paper planner", nav: "top", cards: "solid", blocks: ["week", "kanban"] },
  { id: "rings", name: "Rings", idea: "Activity-ring style circles for each area", nav: "bottom", cards: "neon", blocks: ["greet", "hero-ring", "grid3", "bars"] },
  { id: "magazine", name: "Magazine", idea: "Big headline, bold type, image strips", nav: "pill", cards: "glass", blocks: ["big-number", "feed", "carousel"] },
];
