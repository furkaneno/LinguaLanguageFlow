import type { Metadata, Viewport } from "next";
import "@fontsource-variable/inter";
import "@fontsource-variable/fraunces";
import { AuthProvider } from "@/components/auth/AuthProvider";
import { BackgroundPattern } from "@/components/layout/BackgroundPattern";
import { ThemeProvider } from "@/components/theme/ThemeProvider";
import { APP_NAME, APP_TAGLINE } from "@/config/app";
import { THEME_INIT_SCRIPT, themeCss } from "@/lib/theme";
import "./globals.css";

export const metadata: Metadata = { title: APP_NAME, description: APP_TAGLINE };
export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#3A1526" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <style dangerouslySetInnerHTML={{ __html: themeCss() }} />
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body className="font-sans">
        <BackgroundPattern />
        <AuthProvider><ThemeProvider>{children}</ThemeProvider></AuthProvider>
      </body>
    </html>
  );
}
