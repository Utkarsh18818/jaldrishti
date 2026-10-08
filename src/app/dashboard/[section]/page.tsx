import { notFound } from "next/navigation";
import { ButtonLink, Eyebrow, Panel } from "@/components/ui";
const titles: Record<string, string> = {
  alerts: "Alerts",
  actions: "Actions",
  impact: "Impact",
};
export function generateStaticParams() {
  return Object.keys(titles).map((section) => ({ section }));
}
export default async function SectionPage({
  params,
}: {
  params: Promise<{ section: string }>;
}) {
  const { section } = await params;
  const title = titles[section];
  if (!title) notFound();
  return (
    <>
      <div className="overview-heading">
        <div>
          <Eyebrow>JALDRISHTI · APPLICATION SHELL</Eyebrow>
          <h1>
            {title}
            <span>.</span>
          </h1>
        </div>
      </div>
      <Panel className="placeholder">
        <Eyebrow>PLANNED CAPABILITY</Eyebrow>
        <h2>A clear space for what comes next.</h2>
        <p>
          The {title.toLowerCase()} workspace is reserved for a later phase.
          This preview establishes navigation and layout only.
        </p>
        <ButtonLink href="/dashboard">Return to overview</ButtonLink>
      </Panel>
    </>
  );
}
