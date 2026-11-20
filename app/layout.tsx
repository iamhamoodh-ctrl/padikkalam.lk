import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: "Padikkalam.lk · Study library",
  description: "A study library and focus planner for Sri Lankan A/L students.",
  manifest: "/manifest.webmanifest",
  icons: { icon: "/art/icon-192.png", apple: "/art/icon-192.png" },
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>{children}</body>
    </html>
  );
}
