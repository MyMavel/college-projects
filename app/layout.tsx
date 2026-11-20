import type { Metadata, Viewport } from "next";
import Nav from "@/components/Nav";
import { currentUser } from "@/lib/auth";
import { SITE } from "@/lib/site";
import "./globals.css";

export const metadata: Metadata = {
  title: SITE.name,
  description: SITE.description,
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: SITE.themeColor,
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const user = await currentUser().catch(() => null);
  return (
    <html lang="th">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Kanit:wght@400;500;600&family=Sarabun:wght@400;500;600&display=swap"
        />
      </head>
      <body style={{ "--primary": SITE.themeColor } as React.CSSProperties}>
        <Nav user={user ? { displayName: user.displayName, role: user.role } : null} />
        <main className="container">{children}</main>
      </body>
    </html>
  );
}
