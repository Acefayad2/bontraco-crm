import { ArrowRight } from "@phosphor-icons/react/ArrowRight";
import { CalendarCheck } from "@phosphor-icons/react/CalendarCheck";
import { ChartLineUp } from "@phosphor-icons/react/ChartLineUp";
import { CheckCircle } from "@phosphor-icons/react/CheckCircle";
import { PhoneCall } from "@phosphor-icons/react/PhoneCall";
import { ShieldCheck } from "@phosphor-icons/react/ShieldCheck";
import { Wrench } from "@phosphor-icons/react/Wrench";
import { Link } from "react-router-dom";
import { Brand } from "../components/Brand";
import { useDocumentTitle } from "../lib/use-document-title";

const outcomes = [
  {
    icon: PhoneCall,
    title: "Answer every call",
    body: "Qualify customers, book work, and route urgent calls around the clock.",
  },
  {
    icon: CalendarCheck,
    title: "Move work forward",
    body: "Keep leads, appointments, estimates, jobs, and payments in one operating view.",
  },
  {
    icon: ChartLineUp,
    title: "Know what converts",
    body: "See response time, booked work, pipeline value, and call outcomes without guesswork.",
  },
];

const workflow = [
  "A customer calls, submits a form, or enters the lead inbox.",
  "Bontraco qualifies the request and assigns the right person.",
  "Your team moves the job through a trade-specific workflow.",
  "Every call, note, document, estimate, and payment stays attached.",
];

export function MarketingPage() {
  useDocumentTitle("Bontraco | Contractor operations");

  return (
    <div className="marketing-page">
      <header className="marketing-nav">
        <Brand />
        <nav aria-label="Primary navigation">
          <a href="#platform">Platform</a>
          <a href="#industries">Industries</a>
          <a href="#pricing">Pricing</a>
        </nav>
        <div className="nav-actions">
          <Link className="button button-ghost" to="/login">
            Sign in
          </Link>
          <Link className="button button-primary" to="/signup">
            Start now
          </Link>
        </div>
      </header>

      <main>
        <section className="hero">
          <div className="hero-copy">
            <p className="eyebrow">Contractor operations</p>
            <h1>Turn every call into organized work.</h1>
            <p className="hero-subtitle">
              Bontraco answers, qualifies, schedules, and tracks jobs for home-service teams.
            </p>
            <div className="hero-actions">
              <Link className="button button-primary button-large" to="/signup">
                Start now <ArrowRight weight="bold" />
              </Link>
              <Link className="button button-secondary button-large" to="/app">
                View workspace
              </Link>
            </div>
          </div>

          <div
            className="hero-photo"
            role="img"
            aria-label="Roofing specialist inspecting a residential roof"
          >
            <div className="call-brief">
              <div className="call-brief-head">
                <span className="call-icon">
                  <PhoneCall weight="fill" />
                </span>
                <div>
                  <strong>New call captured</strong>
                  <span>Roof leak in Naperville</span>
                </div>
              </div>
              <dl>
                <div>
                  <dt>Urgency</dt>
                  <dd>Same day</dd>
                </div>
                <div>
                  <dt>Next step</dt>
                  <dd>Inspection booked</dd>
                </div>
              </dl>
            </div>
          </div>
        </section>

        <section className="outcomes" id="platform">
          {outcomes.map(({ icon: Icon, title, body }) => (
            <article key={title}>
              <Icon size={28} weight="duotone" aria-hidden="true" />
              <h2>{title}</h2>
              <p>{body}</p>
            </article>
          ))}
        </section>

        <section className="workflow-section">
          <div>
            <h2>One record from first ring to final payment.</h2>
            <p>
              Stop piecing together voicemails, texts, spreadsheets, and job notes. Bontraco keeps
              the handoff clear.
            </p>
          </div>
          <ol>
            {workflow.map((item) => (
              <li key={item}>
                <CheckCircle weight="fill" aria-hidden="true" />
                <span>{item}</span>
              </li>
            ))}
          </ol>
        </section>

        <section className="industry-section" id="industries">
          <div className="industry-intro">
            <Wrench size={34} weight="duotone" aria-hidden="true" />
            <h2>Built around the work contractors actually do.</h2>
            <p>
              Start with proven roofing operations, then activate plumbing or electrical workflows
              inside the same platform.
            </p>
          </div>
          <div className="industry-list">
            <div>
              <strong>Roofing</strong>
              <span>Inspections, insurance, estimates, supplements, production</span>
            </div>
            <div>
              <strong>Plumbing</strong>
              <span>Emergency intake, dispatch, service work, equipment, follow-up</span>
            </div>
            <div>
              <strong>Electrical</strong>
              <span>Safety intake, service calls, panels, circuits, installations</span>
            </div>
          </div>
        </section>

        <section className="pricing-section" id="pricing">
          <div className="pricing-copy">
            <ShieldCheck size={34} weight="duotone" aria-hidden="true" />
            <h2>Start with the operating system. Add the receptionist when you are ready.</h2>
            <p>
              Plans are sized for growing local teams. Usage controls keep calling and lead-search
              costs predictable.
            </p>
          </div>
          <div className="price-block">
            <span>Plans from</span>
            <strong>$299</strong>
            <span>per company, per month</span>
            <Link className="button button-primary button-large" to="/signup">
              Start now
            </Link>
          </div>
        </section>
      </main>

      <footer>
        <Brand />
        <p>Contractor operations that answer and act.</p>
        <span>© {new Date().getFullYear()} Bontraco</span>
      </footer>
    </div>
  );
}
