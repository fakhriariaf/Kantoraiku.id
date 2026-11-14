import type { Metadata } from "next";
import { DesignSystem } from "./design-system";

export const metadata: Metadata = {
  title: "Sistem desain · Kantoraiku",
  robots: { index: false },
};

export default function DesignPage() {
  return <DesignSystem />;
}
