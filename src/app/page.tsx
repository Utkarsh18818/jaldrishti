import {
  ArrowRight,
  Activity,
  Radar,
  SlidersHorizontal,
  MoveUpRight,
} from "lucide-react";
import { Brand, ButtonLink, Eyebrow } from "@/components/ui";
import { Contours } from "@/components/contours";
const stages = [
  {
    number: "01",
    title: "OBSERVE",
    text: "Understand environmental and local water conditions.",
    icon: Radar,
  },
  {
    number: "02",
    title: "PREDICT",
    text: "Estimate when water storage may become critical.",
    icon: Activity,
  },
  {
    number: "03",
    title: "SIMULATE",
    text: "Test possible interventions before acting.",
    icon: SlidersHorizontal,
  },
  {
    number: "04",
    title: "ACT",
    text: "Take the highest-impact preventive action.",
    icon: MoveUpRight,
  },
];
export default function Home() {
  return (
    <div className="landing">
      <header className="landing-nav wrap">
        <Brand />
        <nav aria-label="Main">
          <a href="#approach">Our approach</a>
          <LinkDemo />
        </nav>
      </header>
      <main id="main">
        <section className="hero wrap">
          <div className="hero-copy">
            <Eyebrow>
              <span className="signal-dot" /> WATER SECURITY, IN SIGHT
            </Eyebrow>
            <p className="hero-wordmark">JALDRISHTI</p>
            <h1>
              See water stress
              <br />
              <span>
                before the tap
                <br />
                runs dry.
              </span>
            </h1>
            <p className="hero-description">
              Environmental signals already tell us when water security is
              deteriorating. JalDrishti turns those signals into forecasts,
              interventions, and measurable actions.
            </p>
            <div className="hero-actions">
              <ButtonLink href="/analysis">Analyze my site</ButtonLink>
              <ButtonLink href="/dashboard" secondary>
                Explore Pune Demo Campus
              </ButtonLink>
            </div>
            <p className="hero-note">
              REAL ANALYSIS for your site · SAMPLE DEMO for the Pune example.
            </p>
          </div>
          <Contours />
        </section>
        <div className="workflow wrap">
          <span>OBSERVE</span>
          <ArrowRight />
          <span>UNDERSTAND</span>
          <ArrowRight />
          <span>PREDICT</span>
          <ArrowRight />
          <span>ACT</span>
          <ArrowRight />
          <span>MEASURE IMPACT</span>
        </div>
        <section id="approach" className="approach wrap">
          <div className="section-heading">
            <Eyebrow>FROM SIGNAL TO ACTION</Eyebrow>
            <h2>
              Ahead of the shortage.
              <br />
              <span>Closer to the solution.</span>
            </h2>
          </div>
          <div className="stages">
            {stages.map(({ number, title, text, icon: Icon }) => (
              <article key={number}>
                <div className="stage-top">
                  <span>{number}</span>
                  <Icon size={24} />
                </div>
                <h3>{title}</h3>
                <p>{text}</p>
              </article>
            ))}
          </div>
        </section>
        <section className="narrative wrap">
          <Eyebrow>DECISIONS THAT MAKE A DIFFERENCE</Eyebrow>
          <h2>
            Environmental data is only useful when it{" "}
            <span>changes a decision.</span>
          </h2>
          <div>
            <p>
              Connect what you observe to what you can do. See the pressure on
              your water system, identify the next preventive action, and make
              its impact visible.
            </p>
            <ButtonLink href="/dashboard">Explore the demo campus</ButtonLink>
            <p className="demo-disclaimer">
              SAMPLE DEMO · DEMO_SYNTHETIC operational data
            </p>
          </div>
        </section>
      </main>
      <footer className="wrap landing-footer">
        <Brand />
        <p>See water stress before the tap runs dry.</p>
        <span>OBSERVE. ANTICIPATE. PROTECT.</span>
      </footer>
    </div>
  );
}
function LinkDemo() {
  return (
    <ButtonLink href="/dashboard" secondary>
      Open demo
    </ButtonLink>
  );
}
