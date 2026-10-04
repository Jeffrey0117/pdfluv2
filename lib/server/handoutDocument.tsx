import path from "path";
import React from "react";
import { Document, Font, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import type { VocabItem } from "@/lib/readerTypes";

const fontDir = path.join(process.cwd(), "public", "fonts");
Font.register({ family: "NotoSansTC", src: path.join(fontDir, "NotoSansTC-Regular.ttf") });

const CJK_PATTERN = /[　-〿㐀-鿿豈-﫿＀-￯]/;
Font.registerHyphenationCallback((word) =>
  CJK_PATTERN.test(word) ? Array.from(word).flatMap((char) => [char, ""]) : [word]
);

export interface HandoutEntry extends VocabItem {
  note: string; // AI 用法筆記
}

const styles = StyleSheet.create({
  page: { paddingTop: 56, paddingBottom: 64, paddingHorizontal: 52, fontSize: 10.5, color: "#262626", fontFamily: "NotoSansTC" },
  header: { marginBottom: 24, paddingBottom: 14, borderBottomWidth: 2, borderBottomColor: "#f43f5e" },
  title: { fontSize: 20, color: "#111111" },
  subtitle: { fontSize: 9, color: "#9ca3af", marginTop: 6 },
  entry: { marginBottom: 16, paddingBottom: 12, borderBottomWidth: 0.5, borderBottomColor: "#e5e5e5" },
  wordRow: { flexDirection: "row", alignItems: "baseline", marginBottom: 4 },
  word: { fontSize: 15, color: "#111111" },
  phonetic: { fontSize: 9, color: "#9ca3af", marginLeft: 8 },
  meaning: { fontSize: 10, color: "#404040", marginBottom: 5, lineHeight: 1.5 },
  sentence: { fontSize: 9.5, color: "#737373", lineHeight: 1.6, marginBottom: 5 },
  sentenceLabel: { color: "#f43f5e" },
  note: { fontSize: 9.5, color: "#262626", lineHeight: 1.6, backgroundColor: "#fff1f2", padding: 7, borderRadius: 6 },
  footer: { position: "absolute", bottom: 30, left: 0, right: 0, textAlign: "center", fontSize: 8.5, color: "#a3a3a3" },
  brand: { position: "absolute", bottom: 30, right: 52, fontSize: 8, color: "#d4d4d4" },
});

export function HandoutPdf({ ownerName, entries }: { ownerName: string; entries: HandoutEntry[] }) {
  const date = new Date().toISOString().slice(0, 10);
  return (
    <Document title="我的生詞講義" producer="PDFluv2" creator="PDFluv2">
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <Text style={styles.title}>我的生詞講義</Text>
          <Text style={styles.subtitle}>
            {ownerName ? ownerName + " · " : ""}
            {date} · 共 {entries.length} 個生詞 · 從我讀的書收藏，由 PDFluv2 產生
          </Text>
        </View>

        {entries.map((e) => (
          <View key={e.id} style={styles.entry} minPresenceAhead={60}>
            <View style={styles.wordRow}>
              <Text style={styles.word}>{e.word}</Text>
              {e.phonetic ? <Text style={styles.phonetic}>/{e.phonetic}/</Text> : null}
            </View>
            {e.meaning ? <Text style={styles.meaning}>{e.meaning}</Text> : null}
            {e.sentence ? (
              <Text style={styles.sentence}>
                <Text style={styles.sentenceLabel}>原句 </Text>
                {e.sentence}
                {e.bookTitle ? `（${e.bookTitle}）` : ""}
              </Text>
            ) : null}
            {e.note ? <Text style={styles.note}>{e.note}</Text> : null}
          </View>
        ))}

        <Text fixed style={styles.footer} render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`} />
        <Text fixed style={styles.brand}>
          PDFluv2
        </Text>
      </Page>
    </Document>
  );
}
