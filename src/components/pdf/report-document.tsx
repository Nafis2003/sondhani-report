"use client";

import { Document, Page, View, Text, StyleSheet } from "@react-pdf/renderer";
import type { PatientRecord } from "@/lib/types";
import { TEST_LABELS, type TestName } from "@/lib/types";

const styles = StyleSheet.create({
  page: {
    paddingTop: 140, // Space for preprinted header
    paddingBottom: 56,
    paddingHorizontal: 56,
    fontSize: 10,
    fontFamily: "Helvetica",
    color: "#1e1e1e",
  },
  header: {
    alignItems: "center",
    marginBottom: 32,
    paddingBottom: 24,
    borderBottomWidth: 1,
    borderBottomColor: "#e2e2e2",
  },
  clinicName: {
    fontSize: 22,
    fontFamily: "Helvetica-Bold",
    marginBottom: 6,
    letterSpacing: 1,
  },
  department: {
    fontSize: 11,
    color: "#555",
    marginBottom: 4,
  },
  location: {
    fontSize: 9,
    color: "#888",
  },
  metaGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginBottom: 8,
    padding: 20,
    backgroundColor: "#f9f9f9",
  },
  reportDateTime: {
    fontSize: 9,
    color: "#4b5563",
    marginBottom: 32,
    textAlign: "right",
    paddingRight: 4,
  },
  metaItemName: {
    width: "50%",
    marginBottom: 14,
    paddingRight: 12,
  },
  metaItemSmall: {
    width: "25%",
    marginBottom: 14,
  },
  metaItemHalf: {
    width: "50%",
  },
  metaLabel: {
    fontSize: 8,
    color: "#888",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  metaValue: {
    fontSize: 11,
    fontFamily: "Helvetica-Bold",
  },
  sectionTitle: {
    fontSize: 11,
    fontFamily: "Helvetica-Bold",
    marginBottom: 12,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    color: "#555",
    textAlign: "center",
  },
  tableHeader: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#ddd",
    paddingBottom: 10,
    marginBottom: 4,
  },
  tableHeaderCell: {
    width: "50%",
    fontSize: 8,
    fontFamily: "Helvetica-Bold",
    textTransform: "uppercase",
    color: "#888",
    letterSpacing: 0.5,
  },
  tableRow: {
    flexDirection: "row",
    paddingVertical: 10,
    borderBottomWidth: 0.5,
    borderBottomColor: "#eee",
  },
  tableCell: {
    width: "50%",
    fontSize: 11,
  },
  resultNegative: {
    color: "#166534",
    fontFamily: "Helvetica-Bold",
  },
  resultPositive: {
    color: "#dc2626",
    fontFamily: "Helvetica-Bold",
  },
  glucoseRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    padding: 16,
    backgroundColor: "#f9f9f9",
    marginTop: 20,
    marginBottom: 0,
  },
  glucoseLabel: {
    fontSize: 11,
    color: "#555",
  },
  glucoseValue: {
    fontSize: 11,
    fontFamily: "Helvetica-Bold",
  },
  disclaimer: {
    position: "absolute",
    bottom: 40,
    left: 40,
    right: 40,
    borderTopWidth: 1,
    borderTopColor: "#e2e2e2",
    paddingTop: 12,
    fontSize: 8,
    color: "#999",
    textAlign: "center",
  },
  signatureContainer: {
    marginTop: 60,
    alignSelf: "flex-end",
    width: 160,
    borderTopWidth: 1,
    borderTopColor: "#333",
    paddingTop: 8,
    alignItems: "center",
  },
  signatureText: {
    fontSize: 10,
    fontFamily: "Helvetica-Bold",
    color: "#333",
  },
});

interface ReportDocumentProps {
  record: PatientRecord;
}

const testNames: TestName[] = ["hbsAg", "hcv", "malaria", "hiv", "vdrl"];

export function ReportDocument({ record }: ReportDocumentProps) {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Patient Info */}
        <View style={styles.metaGrid}>
          <View style={styles.metaItemName}>
            <Text style={styles.metaLabel}>Patient Name</Text>
            <Text style={styles.metaValue}>{record.name}</Text>
          </View>
          <View style={styles.metaItemSmall}>
            <Text style={styles.metaLabel}>Age</Text>
            <Text style={styles.metaValue}>{record.age} Y</Text>
          </View>
          <View style={styles.metaItemSmall}>
            <Text style={styles.metaLabel}>Sex</Text>
            <Text style={styles.metaValue}>{record.sex || "N/A"}</Text>
          </View>
          <View style={styles.metaItemHalf}>
            <Text style={styles.metaLabel}>Mobile</Text>
            <Text style={styles.metaValue}>{record.mobile}</Text>
          </View>
          <View style={styles.metaItemHalf}>
            <Text style={styles.metaLabel}>Ref ID</Text>
            <Text style={styles.metaValue}>{record.refId}</Text>
          </View>
        </View>

        <Text style={styles.reportDateTime}>
          Report Generated: {record.date} at {record.time}
        </Text>

        {/* Test Results */}
        <Text style={styles.sectionTitle}>Blood Screening Report</Text>
        <View style={styles.tableHeader}>
          <Text style={styles.tableHeaderCell}>Test</Text>
          <Text style={styles.tableHeaderCell}>Result</Text>
        </View>
        {[...testNames]
          .sort((a, b) => {
            const aIsSet = record[a] !== "N/A";
            const bIsSet = record[b] !== "N/A";
            if (aIsSet && !bIsSet) return -1;
            if (!aIsSet && bIsSet) return 1;
            return 0;
          })
          .map((test) => (
          <View key={test} style={styles.tableRow}>
            <Text style={styles.tableCell}>{TEST_LABELS[test]}</Text>
            <Text
              style={[
                styles.tableCell,
                record[test] === "Positive"
                  ? styles.resultPositive
                  : record[test] === "Negative"
                  ? styles.resultNegative
                  : undefined,
              ]}
            >
              {record[test]}
            </Text>
          </View>
        ))}

        {/* Blood Glucose */}
        {record.bloodGlucose && record.bloodGlucose !== "N/A" && (
          <View style={styles.glucoseRow}>
            <Text style={styles.glucoseLabel}>
              {record.bloodGlucose.includes("(Fasting)")
                ? "Fasting Blood Sugar (FBS)"
                : record.bloodGlucose.includes("(2h glucose)")
                ? "2 Hours Post-Prandial Glucose (2h PPBS)"
                : "Random Blood Sugar (RBS)"}
            </Text>
            <Text style={styles.glucoseValue}>
              {record.bloodGlucose.replace(/\s*\(.*?\)\s*$/, "")}
            </Text>
          </View>
        )}

        {/* Signature Block */}
        <View style={styles.signatureContainer}>
          <Text style={styles.signatureText}>Signature</Text>
        </View>
      </Page>
    </Document>
  );
}
