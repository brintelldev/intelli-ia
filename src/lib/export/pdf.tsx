import { Document, Link, Page, pdf, StyleSheet, Text, View } from "@react-pdf/renderer";
import { parseMarkdown, type Span } from "./markdown";
import type { ExportData } from "./types";

const s = StyleSheet.create({
  page: { paddingTop: 56, paddingBottom: 56, paddingHorizontal: 48, fontSize: 10.5, fontFamily: "Helvetica", lineHeight: 1.45, color: "#1a1a1a" },
  header: { position: "absolute", top: 22, left: 48, right: 48, fontSize: 8, color: "#666", flexDirection: "row", justifyContent: "space-between" },
  footer: { position: "absolute", bottom: 24, left: 48, right: 48, fontSize: 8, color: "#666", textAlign: "center" },
  title: { fontSize: 22, fontFamily: "Helvetica-Bold", lineHeight: 1.2, marginBottom: 10 },
  meta: { fontSize: 9, color: "#555", marginBottom: 2 },
  h1: { fontSize: 15, fontFamily: "Helvetica-Bold", marginTop: 16, marginBottom: 6 },
  h2: { fontSize: 12.5, fontFamily: "Helvetica-Bold", marginTop: 10, marginBottom: 4 },
  p: { marginBottom: 6 },
  li: { flexDirection: "row", marginBottom: 3, paddingLeft: 10 },
  liMark: { width: 16 },
  quote: { marginBottom: 6, marginLeft: 12, paddingLeft: 8, borderLeftWidth: 2, borderLeftColor: "#bbb", color: "#444" },
  tocTitle: { fontSize: 13, fontFamily: "Helvetica-Bold", marginTop: 14, marginBottom: 6 },
  tocItem: { color: "#1a1a1a", textDecoration: "none", marginBottom: 2 },
});

// Só troca a fonte quando há formatação inline; o resto herda do pai (títulos continuam em negrito).
const fontFor = (sp: Span, italic?: boolean) =>
  sp.code ? "Courier" : sp.bold && (sp.italic || italic) ? "Helvetica-BoldOblique" : sp.bold ? "Helvetica-Bold" : sp.italic || italic ? "Helvetica-Oblique" : undefined;

const Spans = ({ spans, italic }: { spans: Span[]; italic?: boolean }) => (
  <>
    {spans.map((sp, i) => {
      const fontFamily = fontFor(sp, italic);
      return <Text key={i} style={fontFamily ? { fontFamily } : {}}>{sp.text}</Text>;
    })}
  </>
);

function Body({ md }: { md: string }) {
  return (
    <>
      {parseMarkdown(md).map((b, i) => {
        if (b.type === "heading") return <Text key={i} style={b.level === 1 ? s.h1 : s.h2}><Spans spans={b.spans} /></Text>;
        if (b.type === "bullet" || b.type === "numbered")
          return (
            <View key={i} style={s.li} wrap={false}>
              <Text style={s.liMark}>{b.type === "bullet" ? "•" : `${b.n}.`}</Text>
              <Text style={{ flex: 1 }}><Spans spans={b.spans} /></Text>
            </View>
          );
        if (b.type === "quote") return <Text key={i} style={s.quote}><Spans spans={b.spans} italic /></Text>;
        return <Text key={i} style={s.p}><Spans spans={b.spans} /></Text>;
      })}
    </>
  );
}

function Doc({ data }: { data: ExportData }) {
  return (
    <Document title={data.title} author="Intelli Insights" creator="Intelli Insights">
      <Page size="A4" style={s.page}>
        <View style={s.header} fixed>
          <Text>Intelli Insights</Text>
          <Text>{data.title.length > 70 ? data.title.slice(0, 67) + "…" : data.title}</Text>
        </View>
        <Text style={s.title}>{data.title}</Text>
        {Object.entries(data.metadata).map(([k, v]) => (
          <Text key={k} style={s.meta}>{k}: {String(v)}</Text>
        ))}
        {data.sections.length > 1 && (
          <View>
            <Text style={s.tocTitle}>Índice</Text>
            {/* ponytail: o índice leva ao início de cada seção (link interno), sem nº de página; 2ª passada de render se precisar */}
            {data.sections.map((sec, i) => (
              <Link key={i} src={`#sec-${i}`} style={s.tocItem}>{i + 1}. {sec.heading}</Link>
            ))}
          </View>
        )}
        {data.sections.map((sec, i) => (
          <View key={i}>
            <Text style={s.h1} id={`sec-${i}`}>{sec.heading}</Text>
            <Body md={sec.content} />
          </View>
        ))}
        {data.citations?.length ? (
          <View>
            <Text style={s.h1}>Fontes</Text>
            {data.citations.map((c, i) => (
              <Text key={i} style={s.p}>{i + 1}. {c.label}{c.url ? ` — ${c.url}` : ""}</Text>
            ))}
          </View>
        ) : null}
        <Text style={s.footer} fixed render={({ pageNumber, totalPages }) => `Página ${pageNumber} de ${totalPages}`} />
      </Page>
    </Document>
  );
}

export async function toPdf(data: ExportData): Promise<Blob> {
  return pdf(<Doc data={data} />).toBlob();
}
