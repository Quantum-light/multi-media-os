import type { Metadata } from "next";
import { Instrument_Serif, JetBrains_Mono } from "next/font/google";
import localFont from "next/font/local";
import { Rail } from "@/components/Rail";
import "./globals.css";

const title = Instrument_Serif({ subsets: ["latin"], weight: "400", style: ["normal", "italic"], variable: "--font-title" });
const figures = JetBrains_Mono({ subsets: ["latin"], weight: ["400", "500"], variable: "--font-figures" });
const body = localFont({ src: "./fonts/Satoshi-Variable.woff2", weight: "300 900", variable: "--font-body" });

export const metadata: Metadata = {
  title: "multi-media os",
  description: "One studio for every podcast and video show.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-GB" className={`${title.variable} ${figures.variable} ${body.variable}`}>
      <body>
        <div className="stage">
          <div className="stage__rail">
            <Rail />
          </div>
          <main className="sheet glass">{children}</main>
        </div>
      </body>
    </html>
  );
}
