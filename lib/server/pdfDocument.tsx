import path from "path";
import React from "react";
import { Document, Font, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import type { TargetLang } from "@/lib/types";

export type ExportMode = "translated" | "bilingual";

export interface ExportPage {
  pageNumber: number;
  original: string;
  translated: string;
}

export interface TranslationPdfProps {
  fileName: string;
  mode: ExportMode;
  targetLang: TargetLang;
  pages: ExportPage[];
}

const fontDir = path.join(process.cwd(), "public", "fonts");

Font.register({ family: "NotoSansTC", src: path.join(fontDir, "NotoSansTC-Regular.ttf") });
Font.register({ family: "NotoSansSC", src: path.join(fontDir, "NotoSansSC-Regular.ttf") });

const CJK_PATTERN = /[　-〿㐀-鿿豈-﫿＀-￯]/;

Font.registerHyphenationCallback((word) =>
  CJK_PATTERN.test(word) ? Array.from(word).flatMap((char) => [char, ""]) : [word]
);

const styles = StyleSheet.create({
  page: {
    paddingTop: 56,
    paddingBottom: 64,
    paddingHorizontal: 52,
    fontSize: 10.5,
    color: "#262626",
  },
  header: {
    marginBottom: 28,
    paddingBottom: 14,
    borderBottomWidth: 2,
    borderBottomColor: "#f43f5e",
  },
  title: { fontSize: 20, color: "#111111" },
  subtitle: { fontSize: 9, color: "#9ca3af", marginTop: 6 },
  section: { marginBottom: 18 },
  pageLabelRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 10,
  },
  pageLabel: {
    fontSize: 8.5,
    color: "#f43f5e",
    backgroundColor: "#fff1f2",
    paddingHorizontal: 8,
    paddingVertical: 2.5,
    borderRadius: 8,
  },
  labelLine: {
    flexGrow: 1,
    height: 0.75,
    backgroundColor: "#fecdd3",
    marginLeft: 8,
  },
  pair: {
    marginBottom: 12,
  },
  original: {
    fontSize: 9,
    lineHeight: 1.6,
    color: "#737373",
    marginBottom: 6,
  },
  originalDivider: {
    height: 0.5,
    backgroundColor: "#e5e5e5",
    marginTop: 4,
    marginBottom: 10,
  },
  body: {
    lineHeight: 1.65,
    marginBottom: 8,
  },
  footer: {
    position: "absolute",
    bottom: 30,
    left: 0,
    right: 0,
    textAlign: "center",
    fontSize: 8.5,
    color: "#a3a3a3",
  },
  brand: {
    position: "absolute",
    bottom: 30,
    right: 52,
    fontSize: 8,
    color: "#d4d4d4",
  },
});

function toParagraphs(text: string): string[] {
  return text
    .split(/\n+/)
    .map((p) => p.trim())
    .filter((p) => p.length > 0);
}

function BilingualPage({ page }: { page: ExportPage }) {
  const originals = toParagraphs(page.original);
  const translations = toParagraphs(page.translated);

  if (originals.length === translations.length && originals.length > 0) {
    return (
      <View>
        {originals.map((originalParagraph, i) => (
          <View key={i} style={styles.pair}>
            <Text style={styles.original}>{originalParagraph}</Text>
            <Text style={styles.body}>{translations[i]}</Text>
          </View>
        ))}
      </View>
    );
  }

  return (
    <View>
      {originals.map((paragraph, i) => (
        <Text key={`original-${i}`} style={styles.original}>
          {paragraph}
        </Text>
      ))}
      {originals.length > 0 && <View style={styles.originalDivider} />}
      {translations.map((paragraph, i) => (
        <Text key={`translated-${i}`} style={styles.body}>
          {paragraph}
        </Text>
      ))}
    </View>
  );
}

export function TranslationPdf({ fileName, mode, targetLang, pages }: TranslationPdfProps) {
  const family = targetLang === "zh-CN" ? "NotoSansSC" : "NotoSansTC";
  const modeLabel = mode === "bilingual" ? "中英對照" : "中文翻譯";

  return (
    <Document title={`${fileName} - ${modeLabel}`} producer="PDFluv2" creator="PDFluv2">
      <Page size="A4" style={[styles.page, { fontFamily: family }]}>
        <View style={styles.header}>
          <Text style={styles.title}>{fileName}</Text>
          <Text style={styles.subtitle}>
            {modeLabel} · 共 {pages.length} 頁原文 · 由 PDFluv2 產生
          </Text>
        </View>

        {pages.map((page) => (
          <View key={page.pageNumber} style={styles.section}>
            <View style={styles.pageLabelRow} minPresenceAhead={48}>
              <Text style={styles.pageLabel}>第 {page.pageNumber} 頁</Text>
              <View style={styles.labelLine} />
            </View>

            {mode === "bilingual" ? (
              <BilingualPage page={page} />
            ) : (
              toParagraphs(page.translated).map((paragraph, i) => (
                <Text key={`translated-${i}`} style={styles.body}>
                  {paragraph}
                </Text>
              ))
            )}
          </View>
        ))}

        <Text
          fixed
          style={styles.footer}
          render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`}
        />
        <Text fixed style={styles.brand}>
          PDFluv2
        </Text>
      </Page>
    </Document>
  );
}
