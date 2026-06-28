import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AI English Coach",
  description: "Improve your English conversational skills with real-time AI feedback.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className="h-full antialiased"
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
