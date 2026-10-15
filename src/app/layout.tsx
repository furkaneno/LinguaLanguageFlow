import type { Metadata, Viewport } from "next";
import "@fontsource-variable/inter";
import "@fontsource-variable/fraunces";
import { AuthProvider } from "@/components/auth/AuthProvider";
import { APP_NAME, APP_TAGLINE } from "@/config/app";
import "./globals.css";

export const metadata: Metadata = { title: APP_NAME, description: APP_TAGLINE };
export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#FAF5ED" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="font-sans"><AuthProvider>{children}</AuthProvider></body>
    </html>
  );
}
