import { OperatorInfo } from "./operator";
import LedgerApp from "./ui";
import { homepageJsonLd, siteUrl, siteDescription } from "./site-data";
export const metadata = {
  alternates: { canonical: siteUrl },
  openGraph: {
    title: "사이드장부 | 부업의 돈 흐름을 한눈에",
    description: siteDescription,
    url: siteUrl,
    siteName: "사이드장부",
    locale: "ko_KR",
    type: "website",
  },
};
export default function Page() {
  return (
    <>
      <script
        id="homepage-jsonld"
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: homepageJsonLd }}
      />
      <LedgerApp />
      <OperatorInfo />
    </>
  );
}
