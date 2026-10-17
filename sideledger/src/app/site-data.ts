export const siteUrl = "https://sideledger-tiger82.vercel.app/";
export const siteDescription =
  "무료 베타로 제공하는 부업 수입·경비와 거래처를 관리하고 견적서·청구서를 작성해 PDF로 내려받는 클라우드 장부입니다.";
export const homepageSchema = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "WebSite",
      "@id": siteUrl + "#website",
      url: siteUrl,
      name: "사이드장부",
      alternateName: "SIDELEDGER",
      description: siteDescription,
      inLanguage: "ko-KR",
    },
    {
      "@type": "WebPage",
      "@id": siteUrl + "#webpage",
      url: siteUrl,
      name: "사이드장부 | 부업의 돈 흐름을 한눈에",
      description: siteDescription,
      inLanguage: "ko-KR",
      isPartOf: { "@id": siteUrl + "#website" },
    },
  ],
};
export const homepageJsonLd = JSON.stringify(homepageSchema).replace(
  /</g,
  "\\u003c",
);
