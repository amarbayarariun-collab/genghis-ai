import type { Metadata } from "next";
import { PricingCheckout } from "@/components/billing/pricing-checkout";

export const metadata: Metadata = {
  description:
    "Genghis AI багц: Үнэгүй 30 мессеж/сар. Pro 72,000₮/сар (~$20) · 500 мессеж + 10 зураг. QPay төлбөр.",
  openGraph: {
    title: "Genghis AI · Багц сонгох",
    description:
      "Үнэгүй 30 мессеж/сар. Pro 72,000₮/сар (~$20) · 500 мессеж + 10 зураг.",
    locale: "mn_MN",
  },
};

export default function PricingPage() {
  return <PricingCheckout />;
}
