import type { Metadata } from "next";

import "./globals.css";

export const metadata: Metadata = {
  title: "UPVD Sales Pitch",
  description:
    "Application atelier pour aider les startupers UPVD a travailler leur pitch avec assistance IA et dictee vocale.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
