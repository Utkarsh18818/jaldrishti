import { ProductFilm } from "@/components/product-film";
import Link from "next/link";
import { ArrowDown, ArrowUpRight, Droplets, Activity, SlidersHorizontal, ShieldCheck } from "lucide-react";
import { Brand, ButtonLink, Eyebrow } from "@/components/ui";

const journey = [
  { number: "01", title: "Understand your system", text: "Start with storage, supply and demand. Keep the origin of every input visible.", icon: Droplets, href: "/dashboard/system", action: "Explore the water balance" },
  { number: "02", title: "See the reserve window", text: "Follow a transparent storage trajectory and inspect the assumptions behind it.", icon: Activity, href: "/dashboard/forecast", action: "Explore a forecast" },
  { number: "03", title: "Compare your next move", text: "Change an intervention. Compare the result. Download the assumptions before acting.", icon: SlidersHorizontal, href: "/dashboard/simulator", action: "Try the simulator" },
];
export default function Home() {
  return (
    <div className="landing-premium">
      <header className="premium-nav wrap"><Brand /><nav aria-label="Main"><a href="#approach">Our approach</a><Link href="/analysis">Real Analysis</Link><ButtonLink href="/dashboard">Explore demo</ButtonLink></nav></header>
      <main id="main">
        <section className="premium-hero wrap">
          <div className="water-atmosphere" aria-hidden="true"><span /><span /><span /></div>
          <div className="premium-hero-copy"><Eyebrow>WATER SECURITY, IN SIGHT</Eyebrow><h1>See further.<br /><em>Plan better.</em></h1>
            <p className="premium-intro">Water decisions deserve more than guesswork. Understand your reserves. Explore what changes. Make your next move with clearer evidence.</p>
            <div className="premium-actions"><ButtonLink href="/analysis">Analyze my site</ButtonLink><Link className="premium-text-link" href="/dashboard">Try Sample Demo <ArrowUpRight size={18} /></Link></div>
            <p className="premium-mode-note">SAMPLE DEMO uses synthetic inputs.<br />REAL ANALYSIS starts empty with your site data.</p>
          </div>
          <figure className="premium-preview"><figcaption><span>INSIDE JALDRISHTI</span><span>SYNTHETIC SAMPLE PREVIEW</span></figcaption><ProductFilm />
            <div className="premium-preview-foot"><span>Your inputs. One transparent model.</span><Link href="/dashboard" aria-label="Open the interactive synthetic Sample Demo"><ArrowUpRight size={21} /></Link></div>
          </figure>
          <a className="premium-scroll" href="#approach"><ArrowDown size={16} /> Discover the approach</a>
        </section>
        <section id="approach" className="premium-approach wrap">
          <div className="premium-section-heading"><Eyebrow>FROM INPUTS TO AN INFORMED NEXT MOVE</Eyebrow><h2>Less uncertainty.<br /><em>More understanding.</em></h2><p>A practical workflow for campuses and communities balancing limited storage with changing supply.</p></div>
          <div className="premium-journey">{journey.map(({ number, title, text, icon: Icon, href, action }) => <article key={number}><div className="premium-stage-meta"><span>{number}</span><Icon size={25} strokeWidth={1.4} /></div><h3>{title}</h3><p>{text}</p><Link href={href}>{action}<ArrowUpRight size={17} /></Link></article>)}</div>
          <p className="premium-small-note">These guided routes open the synthetic demo. Use Real Analysis for site-specific inputs.</p>
        </section>
        <section className="premium-story wrap"><div><Eyebrow>EXPLORE A CONCRETE DECISION</Eyebrow><h2>Supply stops.<br />What comes <em>next?</em></h2></div><div><p>Test a supply interruption. Compare demand reduction or a supplementary delivery. See how the modeled reserve window responds, then review what must be verified on site.</p><ButtonLink href="/dashboard/simulator">Compare interventions</ButtonLink><p className="premium-small-note">Illustrative scenarios, not measured water savings.</p></div></section>
        <section className="premium-evidence wrap"><div><ShieldCheck size={28} strokeWidth={1.4} /><Eyebrow>EVIDENCE YOU CAN TRACE</Eyebrow><h2>Context is not<br />a tank measurement.</h2></div><div><p>Regional weather can inform a conversation. Your operational readings drive the storage model. JalDrishti keeps their sources, timestamps and limitations separate.</p><ul><li>Deterministic forecasts with explicit reserves</li><li>Scenario assumptions you can inspect and export</li><li>Operator-protected AWS cloud persistence for Real Analysis</li></ul><Link className="premium-text-link" href="/dashboard/data">Explore data provenance <ArrowUpRight size={18} /></Link></div></section>
        <section className="premium-final wrap"><Eyebrow>OBSERVE. ANTICIPATE. PROTECT.</Eyebrow><h2>A clearer view.<br /><em>A better-informed decision.</em></h2><ButtonLink href="/analysis">Start with your site</ButtonLink><p>Bring your readings. Keep the assumptions visible.</p></section>
      </main>
      <footer className="premium-footer wrap"><Brand /><span>Environmental decision support.</span><Link href="/dashboard">Explore synthetic demo <ArrowUpRight size={15} /></Link></footer>
    </div>
  );
}
