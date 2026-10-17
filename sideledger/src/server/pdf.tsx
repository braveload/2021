import React from "react";
import {
  Document,
  Page,
  Text,
  View,
  Font,
  StyleSheet,
  renderToBuffer,
} from "@react-pdf/renderer";
import path from "node:path";
import { Row } from "./ledger";
Font.register({
  family: "LedgerKR",
  src: path.join(process.cwd(), "assets", "NanumGothic-Regular.ttf"),
});
const s = StyleSheet.create({
  page: {
    padding: 45,
    fontFamily: "LedgerKR",
    fontSize: 10,
    color: "#253b32",
    lineHeight: 1.6,
  },
  title: { fontSize: 28, lineHeight: 1.5, marginBottom: 10 },
  small: { fontSize: 9, lineHeight: 1.6, color: "#52665b" },
  header: { marginBottom: 30 },
  row: {
    flexDirection: "row",
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#e3e9e5",
  },
  desc: { width: "52%" },
  qty: { width: "12%", textAlign: "right" },
  unit: { width: "18%", textAlign: "right" },
  sum: { width: "18%", textAlign: "right" },
  total: {
    textAlign: "right",
    fontSize: 18,
    lineHeight: 1.5,
    marginTop: 20,
    marginBottom: 10,
  },
  footer: { marginTop: 36, fontSize: 9, color: "#52665b" },
});
const won = (n: number) => n.toLocaleString("ko-KR") + "원";
export async function pdf(d: Row, u: Row) {
  return renderToBuffer(
    <Document title={d.number} author={u.name}>
      <Page size="A4" style={s.page} wrap>
        <View style={s.header}>
          <Text style={s.title}>
            {d.kind === "invoice" ? "청구서" : "견적서"}
          </Text>
          <Text style={s.small}>
            {d.number} · 발행일 {d.issued_on}
          </Text>
        </View>
        <Text>수신: {d.client_name} 귀중</Text>
        <Text>발신: {u.name}</Text>
        <Text style={s.small}>{u.email}</Text>
        <Text style={{ marginTop: 12, marginBottom: 24 }}>
          입금/유효 기한: {d.due_on}
        </Text>
        <View style={[s.row, { backgroundColor: "#edf4ef" }]}>
          <Text style={s.desc}>항목</Text>
          <Text style={s.qty}>수량</Text>
          <Text style={s.unit}>단가</Text>
          <Text style={s.sum}>금액*</Text>
        </View>
        {d.items.map((i: Row, n: number) => (
          <View style={s.row} key={n} wrap={false}>
            <Text style={s.desc}>{i.description}</Text>
            <Text style={s.qty}>{i.qty100 / 100}</Text>
            <Text style={s.unit}>{won(i.unit_price)}</Text>
            <Text style={s.sum}>
              {won(
                Number((BigInt(i.qty100) * BigInt(i.unit_price) + 50n) / 100n),
              )}
            </Text>
          </View>
        ))}
        <Text style={s.total}>합계 {won(d.total)}</Text>
        <Text style={[s.small, { textAlign: "right" }]}>
          * 항목 표시는 반올림. 합계는 전체 항목을 합산한 뒤 원 단위
          반올림합니다.
        </Text>
        {u.account && (
          <Text style={{ marginTop: 24 }}>입금 계좌: {u.account}</Text>
        )}
        {d.notes && <Text style={{ marginTop: 16 }}>메모: {d.notes}</Text>}
        <Text style={s.footer}>
          본 문서는 거래 내역서이며 세금계산서가 아닙니다.{"\n"}세금 계산·신고
          기능을 제공하지 않습니다.
        </Text>
        <Text
          fixed
          style={{ position: "absolute", bottom: 25, right: 45, fontSize: 8 }}
          render={({ pageNumber, totalPages }) =>
            `${pageNumber} / ${totalPages}`
          }
        />
      </Page>
    </Document>,
  );
}
