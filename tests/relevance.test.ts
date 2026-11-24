import { describe, expect, it } from "vitest";
import { rankByBrief, terms } from "../apps/web/src/lib/relevance";

const item = (company: string, description: string) => ({ company, text: `${company} ${description}` });

// Newest first, as the database returns them. Long, generic descriptions used to
// outrank short relevant ones because every "the", "and" and "with" counted.
const EXPERIENCE = [
  item("Bloom & Co", "Built the marketing website for a florist chain with the CMS, the blog, the newsletter signup and the store locator. Worked with the design team on the brand refresh and with the marketing team on the launch, and trained the staff on the editing workflow for the pages and the posts."),
  item("Freightline", "Moved 30 cron ETL scripts to Airflow on GCP Composer, with retries and Slack alerts. Loads from Postgres to BigQuery finish 2 hours earlier."),
  item("Agency work", "Various automation scripts for the agency and for the clients of the agency, with the reports and the exports and the integrations for the CRM and for the accounting."),
  item("Harbour Clinics", "dbt models and Looker dashboards for 14 clinics; cut the BigQuery bill by 60% by partitioning event tables."),
  item("Northwind", "Mobile app for a delivery startup with React Native, push notifications and the payments flow."),
  item("Lumen", "Rebuilt the onboarding emails and the help centre for a SaaS company with the support team."),
];

const BRIEF = `Airflow migration for ETL jobs (GCP). We run about 40 Python cron jobs that load data from Postgres into BigQuery.
They fail silently. We want them moved to Airflow (Cloud Composer is fine) with DAG dependencies, retries and alerting.`;

describe("rankByBrief", () => {
  it("puts the work that matches the brief first, whatever its length", () => {
    const top = rankByBrief(EXPERIENCE, BRIEF, 2).map((e) => e.company);
    expect(top).toEqual(["Freightline", "Harbour Clinics"]);
  });

  it("weights rare shared terms over ones every entry has", () => {
    const items = [item("A", "Python scripts and reports"), item("B", "Python and BigQuery"), item("C", "Python tooling")];
    expect(rankByBrief(items, "Python BigQuery pipeline", 1)[0]?.company).toBe("B");
  });

  it("keeps the newest first when nothing matches, and handles an empty brief", () => {
    expect(rankByBrief(EXPERIENCE, "watercolour illustration", 2).map((e) => e.company)).toEqual(["Bloom & Co", "Freightline"]);
    expect(rankByBrief(EXPERIENCE, "the and of", 1)[0]?.company).toBe("Bloom & Co");
  });
});

describe("terms", () => {
  it("drops filler words and folds plurals", () => {
    expect([...terms("The scripts and the DAGs with retries for GCP")]).toEqual(["script", "dag", "retry", "gcp"]);
    expect(terms("retry").has("retry")).toBe(true);
    expect(terms("access process").has("access")).toBe(true);
  });
});
