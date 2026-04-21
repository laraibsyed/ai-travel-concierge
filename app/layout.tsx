import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Concierge AI — Your Personal Travel Planner",
  description: "AI-powered travel itinerary planner using RAG",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,600;1,400&family=DM+Sans:wght@300;400;500&family=JetBrains+Mono:wght@400&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="bg-parchment font-body antialiased">{children}</body>
    </html>
  );
}
