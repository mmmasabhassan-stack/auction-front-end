import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "IIAP Lost & Found Auction System",
  description: "Sub-Admin Control Panel for Auction Management",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <link
          rel="stylesheet"
          href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css"
        />
      </head>
      <body className="antialiased">
        {children}
      </body>
    </html>
  );
}
