import { ImageResponse } from "next/og";
import { AppIconArt } from "@/lib/app-icon";

/**
 * PNG app icons for the web app manifest: /icons/192.png, /icons/512.png and
 * /icons/maskable-512.png. Built once at deploy time.
 */
const ICONS: Record<string, { size: number; padding: number }> = {
  "192.png": { size: 192, padding: 0 },
  "512.png": { size: 512, padding: 0 },
  "maskable-512.png": { size: 512, padding: 0.12 },
};

export function generateStaticParams() {
  return Object.keys(ICONS).map((file) => ({ file }));
}

export async function GET(_request: Request, { params }: RouteContext<"/icons/[file]">) {
  const { file } = await params;
  const icon = ICONS[file];
  if (!icon) return new Response("Not found", { status: 404 });
  return new ImageResponse(<AppIconArt size={icon.size} padding={icon.padding} />, { width: icon.size, height: icon.size });
}
