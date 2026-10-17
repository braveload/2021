import { operator } from "./operator";
export const siteUrl = "https://sideledger-tiger82.vercel.app/";
export const siteDescription =
  "무료 베타로 제공하는 부업 수입·경비와 거래처를 관리하고 견적서·청구서를 작성해 PDF로 내려받는 클라우드 장부입니다.";
export const homepageSchema = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      "@id": siteUrl + "#operator",
      name: operator.name,
      legalName: operator.name,
      url: siteUrl,
      email: operator.email,
      identifier: {
        "@type": "PropertyValue",
        propertyID: "사업자등록번호",
        value: operator.registration,
      },
      address: {
        "@type": "PostalAddress",
        streetAddress: "시흥대로145길 60-6, 306호(가산동)",
        addressLocality: "금천구",
        addressRegion: "서울특별시",
        addressCountry: "KR",
      },
    },
    {
      "@type": "WebSite",
      "@id": siteUrl + "#website",
      url: siteUrl,
      name: "사이드장부",
      alternateName: "SIDELEDGER",
      publisher: { "@id": siteUrl + "#operator" },
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
