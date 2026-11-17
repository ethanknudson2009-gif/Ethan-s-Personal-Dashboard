import type { Metadata, Viewport } from "next";
import { Inter, Space_Grotesk } from "next/font/google";
import "./globals.css";

// Free Google Fonts, bundled with the site at build time.
const body = Inter({ subsets: ["latin"], variable: "--font-body" });
const heading = Space_Grotesk({ subsets: ["latin"], variable: "--font-heading" });

export const metadata: Metadata = {
  title: "Dashboard",
  description: "Ethan's personal dashboard: school, tasks, and life in one place.",
};

export const viewport: Viewport = {
  themeColor: "#070b14",
  viewportFit: "cover", // lets the app use the full iPhone screen
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${body.variable} ${heading.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  );
}
