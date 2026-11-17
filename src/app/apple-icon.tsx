import { ImageResponse } from "next/og";
import { AppIconArt } from "@/lib/app-icon";

/** The iPhone home-screen icon (180×180). */
export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(<AppIconArt size={180} />, size);
}
