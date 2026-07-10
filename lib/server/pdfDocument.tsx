import path from "path";
import React from "react";
import { Document, Font, Image, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import type { Style } from "@react-pdf/types";
import type { TargetLang } from "@/lib/types";
import {
  toParagraphs,
  type BankEntry,
  type HighlightSegment,
  type WordBankPageData,
} from "@/lib/server/difficultWords";

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
  coverImage?: string;
  wordBank?: Record<number, WordBankPageData>;
}

const fontDir = path.join(process.cwd(), "public", "fonts");

Font.register({ family: "NotoSerifTC", src: path.join(fontDir, "NotoSerifTC-Regular.otf") });
Font.register({ family: "NotoSerifSC", src: path.join(fontDir, "NotoSerifSC-Regular.otf") });
// 音標(IPA)字形明體與內建 Times 都沒有,用 Noto Sans 專門渲染
Font.register({ family: "NotoSansLatin", src: path.join(fontDir, "NotoSans-Regular.ttf") });

const CJK_PATTERN = /[　-〿㐀-鿿豈-﫿＀-￯]/;

// 禁則處理:標點不落行首、引號括號不掛行尾
const NO_LINE_START = new Set("、。，．！？；：）」』】》〉…—％‰℃·");
const NO_LINE_END = new Set("「『（【《〈");

Font.registerHyphenationCallback((word) => {
  if (!CJK_PATTERN.test(word)) return [word];
  const parts: string[] = [];
  for (const ch of Array.from(word)) {
    const prev = parts.length > 0 ? parts[parts.length - 1] : "";
    if (prev && (NO_LINE_START.has(ch) || NO_LINE_END.has(prev.slice(-1)))) {
      parts[parts.length - 1] = prev + ch;
    } else {
      parts.push(ch);
    }
  }
  return parts.flatMap((p) => [p, ""]);
});

const INDENT = "　　";

const styles = StyleSheet.create({
  page: {
    paddingTop: 64,
    paddingBottom: 76,
    paddingHorizontal: 66,
    fontSize: 10.5,
    color: "#1a1a1a",
  },
  header: {
    marginBottom: 26,
    paddingBottom: 12,
    borderBottomWidth: 0.75,
    borderBottomColor: "#1a1a1a",
  },
  title: { fontSize: 17, color: "#111111" },
  subtitle: { fontSize: 8, color: "#8a8a8a", marginTop: 5, letterSpacing: 0.5 },
  section: { marginBottom: 16 },
  pageLabelRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
    marginTop: 4,
  },
  pageLabel: {
    fontSize: 8,
    color: "#6b6b6b",
    marginHorizontal: 10,
    letterSpacing: 1,
  },
  labelLine: {
    flexGrow: 1,
    height: 0.5,
    backgroundColor: "#c9c9c9",
  },
  pair: {
    marginBottom: 9,
  },
  original: {
    fontFamily: "Times-Roman",
    fontSize: 8.5,
    lineHeight: 1.62,
    color: "#5b5b5b",
    marginBottom: 4,
    textAlign: "justify",
  },
  originalDivider: {
    height: 0.5,
    backgroundColor: "#c9c9c9",
    marginTop: 4,
    marginBottom: 10,
  },
  body: {
    lineHeight: 1.44,
    textAlign: "justify",
    marginBottom: 3,
  },
  footer: {
    position: "absolute",
    bottom: 34,
    left: 0,
    right: 0,
    textAlign: "center",
    fontSize: 8.5,
    color: "#6b6b6b",
  },
  coverPage: {
    padding: 0,
  },
  coverImage: {
    position: "absolute",
    top: 0,
    left: 0,
    width: "100%",
    height: "100%",
    objectFit: "cover",
  },
  hlWord: {
    fontFamily: "Times-Bold",
    color: "#1a1a1a",
    textDecoration: "underline",
    textDecorationColor: "#dc2626",
  },
  bankBox: {
    marginTop: 8,
    paddingVertical: 7,
    paddingHorizontal: 10,
    borderTopWidth: 1,
    borderTopColor: "#1a1a1a",
    borderBottomWidth: 0.5,
    borderBottomColor: "#1a1a1a",
    backgroundColor: "#f5f4f1",
  },
  bankTitle: {
    fontFamily: "Times-Bold",
    fontSize: 8,
    letterSpacing: 2,
    marginBottom: 5,
    color: "#1a1a1a",
  },
  bankEntry: {
    marginBottom: 5,
  },
  bankWord: {
    fontFamily: "Times-Bold",
    fontSize: 9.5,
    color: "#1a1a1a",
  },
  bankPhonetic: {
    fontFamily: "NotoSansLatin",
    fontSize: 7,
    color: "#6b6b6b",
  },
  bankTags: {
    fontFamily: "Helvetica",
    fontSize: 6.5,
    letterSpacing: 0.5,
    color: "#9a9a9a",
  },
  bankDef: {
    fontSize: 8.5,
    lineHeight: 1.4,
    color: "#1a1a1a",
    marginTop: 1.5,
  },
  bankExample: {
    fontFamily: "Times-Italic",
    fontSize: 8,
    lineHeight: 1.4,
    color: "#5b5b5b",
    marginTop: 1.5,
  },
  bankExampleWord: {
    fontFamily: "Times-BoldItalic",
    textDecoration: "underline",
    textDecorationColor: "#dc2626",
  },
});

// 原文若混有 CJK 字元,Times-Roman 沒有字形,退回明體
function originalStyle(text: string, family: string) {
  return CJK_PATTERN.test(text) ? [styles.original, { fontFamily: family }] : styles.original;
}

function segmentsToNodes(segments: HighlightSegment[], hlStyle: Style) {
  return segments.map((seg, i) =>
    seg.hl ? (
      <Text key={i} style={hlStyle}>
        {seg.text}
      </Text>
    ) : (
      seg.text
    )
  );
}

function OriginalParagraph({
  paragraph,
  segments,
  family,
}: {
  paragraph: string;
  segments?: HighlightSegment[];
  family: string;
}) {
  return (
    <Text style={originalStyle(paragraph, family)}>
      {segments && segments.length > 0 ? segmentsToNodes(segments, styles.hlWord) : paragraph}
    </Text>
  );
}

function WordBankSection({ bank, family }: { bank: BankEntry[]; family: string }) {
  if (bank.length === 0) return null;
  return (
    <View style={styles.bankBox}>
      <Text style={styles.bankTitle}>WORD BANK</Text>
      {bank.map((entry) => {
        // 例句混到 CJK 字元時 Times 沒有字形,退回明體
        const exampleHasCjk = CJK_PATTERN.test(entry.example.map((s) => s.text).join(""));
        const exampleStyle = exampleHasCjk
          ? [styles.bankExample, { fontFamily: family }]
          : styles.bankExample;
        return (
          <View key={entry.word} style={styles.bankEntry} wrap={false}>
            <Text>
              <Text style={styles.bankWord}>{entry.word}</Text>
              {entry.phonetic ? (
                <Text style={styles.bankPhonetic}>  /{entry.phonetic}/</Text>
              ) : null}
              {entry.tags.length > 0 ? (
                <Text style={styles.bankTags}>
                  {"  "}
                  {entry.tags.map((t) => t.toUpperCase()).join(" · ")}
                </Text>
              ) : null}
            </Text>
            <Text style={styles.bankDef}>{entry.def}</Text>
            <Text style={exampleStyle}>
              {segmentsToNodes(entry.example, styles.bankExampleWord)}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

function BilingualPage({
  page,
  family,
  data,
}: {
  page: ExportPage;
  family: string;
  data?: WordBankPageData;
}) {
  const originals = toParagraphs(page.original);
  const translations = toParagraphs(page.translated);

  if (originals.length === translations.length && originals.length > 0) {
    return (
      <View>
        {originals.map((originalParagraph, i) => (
          <View key={i} style={styles.pair}>
            <OriginalParagraph
              paragraph={originalParagraph}
              segments={data?.paragraphs[i]}
              family={family}
            />
            <Text style={styles.body}>{INDENT + translations[i]}</Text>
          </View>
        ))}
      </View>
    );
  }

  return (
    <View>
      {originals.map((paragraph, i) => (
        <OriginalParagraph
          key={`original-${i}`}
          paragraph={paragraph}
          segments={data?.paragraphs[i]}
          family={family}
        />
      ))}
      {originals.length > 0 && <View style={styles.originalDivider} />}
      {translations.map((paragraph, i) => (
        <Text key={`translated-${i}`} style={styles.body}>
          {INDENT + paragraph}
        </Text>
      ))}
    </View>
  );
}

export function TranslationPdf({
  fileName,
  mode,
  targetLang,
  pages,
  coverImage,
  wordBank,
}: TranslationPdfProps) {
  const simplified = targetLang === "zh-CN";
  const family = simplified ? "NotoSerifSC" : "NotoSerifTC";
  const modeLabel =
    mode === "bilingual" ? (simplified ? "中英对照" : "中英對照") : (simplified ? "中文翻译" : "中文翻譯");

  return (
    <Document title={`${fileName} - ${modeLabel}`} producer="PDFluv2" creator="PDFluv2">
      {coverImage && (
        <Page size="A4" style={styles.coverPage}>
          <Image src={coverImage} style={styles.coverImage} />
        </Page>
      )}
      <Page size="A4" style={[styles.page, { fontFamily: family }]}>
        <View style={styles.header}>
          <Text style={styles.title}>{fileName}</Text>
          <Text style={styles.subtitle}>
            {modeLabel} · {simplified ? `共 ${pages.length} 页原文 · 由 PDFluv2 产生` : `共 ${pages.length} 頁原文 · 由 PDFluv2 產生`}
          </Text>
        </View>

        {pages.map((page) => (
          <View key={page.pageNumber} style={styles.section}>
            <View style={styles.pageLabelRow} minPresenceAhead={48}>
              <View style={styles.labelLine} />
              <Text style={styles.pageLabel}>· 第 {page.pageNumber} {simplified ? "页" : "頁"} ·</Text>
              <View style={styles.labelLine} />
            </View>

            {mode === "bilingual" ? (
              <BilingualPage page={page} family={family} data={wordBank?.[page.pageNumber]} />
            ) : (
              toParagraphs(page.translated).map((paragraph, i) => (
                <Text key={`translated-${i}`} style={styles.body}>
                  {INDENT + paragraph}
                </Text>
              ))
            )}

            {wordBank?.[page.pageNumber] && (
              <WordBankSection bank={wordBank[page.pageNumber].bank} family={family} />
            )}
          </View>
        ))}

        <Text
          fixed
          style={styles.footer}
          render={({ pageNumber }) => `— ${coverImage ? pageNumber - 1 : pageNumber} —`}
        />
      </Page>
    </Document>
  );
}
