import { LatestEnsProposal } from "./components/LatestEnsProposal";

const signals = [
  { value: "99.878%", label: "voting weight controlled by one wallet" },
  { value: "7", label: "wallets participated in the proposal" },
  { value: "$20M", label: "treasury value transferred" },
];

const analysisSteps = [
  {
    number: "01",
    title: "Observe",
    body: "Index proposal, balance, delegation, quorum, timing, and execution data from the governance system.",
  },
  {
    number: "02",
    title: "Detect",
    body: "Measure concentration, low turnout, quorum capture, late influence, temporal coordination, and anomalous behaviour.",
  },
  {
    number: "03",
    title: "Compare",
    body: "Replay the same decision under explicit alternative assumptions—without pretending one mechanism is universally fair.",
  },
  {
    number: "04",
    title: "Respond",
    body: "Apply the community’s pre-authorised policy: explain, warn, review, delay, rerun, or replace a rule.",
  },
];

const modes = [
  {
    name: "Ensemble",
    status: "MVP",
    body: "Runs supported rules in parallel and reports whether the outcome is robust or mechanism-sensitive.",
  },
  {
    name: "Flex",
    status: "MVP",
    body: "Applies deterministic safeguards selected by the community before a vote begins.",
  },
  {
    name: "Modular",
    status: "MVP",
    body: "Lets each DAO choose its detectors, thresholds, eligible mechanisms, and responses.",
  },
  {
    name: "ILS",
    status: "Research",
    body: "Explores meaningful evidence of informed participation and deliberative contribution.",
  },
];

const methods = [
  { label: "1T1V", support: 99.9, outcome: "Passed", tone: "danger" },
  { label: "QV", support: 73, outcome: "Sensitive", tone: "warning" },
  { label: "1W1V", support: 14.3, outcome: "Reversed", tone: "safe" },
];

export default function Home() {
  return (
    <main>
      <nav className="site-nav">
        <a className="brand-link" href="#top" aria-label="FlexGov home">
          <img src="flexgov-logo.png" alt="FlexGov" />
        </a>
        <div className="nav-links">
          <a href="#problem">Problem</a>
          <a href="#how-it-works">How it works</a>
          <a href="#modes">Modes</a>
          <a href="#principles">Principles</a>
        </div>
        <a
          className="nav-cta"
          href="review/?doc=WHITEPAPER_v0.1.md"
        >
          Whitepaper <span>↗</span>
        </a>
      </nav>

      <section className="hero" id="top">
        <div className="hero-orbit orbit-one" />
        <div className="hero-orbit orbit-two" />
        <div className="hero-copy">
          <p className="kicker">
            <span />
            Governance observability for the agentic economy
          </p>
          <h1>
            See who really
            <br />
            <em>determined</em> the outcome.
          </h1>
          <p className="hero-deck">
            FlexGov detects when governance safeguards are threatened and shows
            whether a decision survives alternative voting assumptions.
          </p>
          <div className="hero-actions">
            <a className="button-primary" href="#how-it-works">
              Explore FlexGov
              <span>↓</span>
            </a>
            <a
              className="text-link"
              href="review/?doc=WHITEPAPER_v0.1.md"
            >
              Read whitepaper v0.1 <span>↗</span>
            </a>
          </div>
        </div>

        <div className="hero-visual" aria-label="FlexGov governance analysis">
          <div className="analysis-window">
            <div className="window-bar">
              <div className="window-dots">
                <i />
                <i />
                <i />
              </div>
              <span>Proposal analysis / BIP #76</span>
              <strong>Live</strong>
            </div>
            <div className="analysis-heading">
              <div>
                <small>Governance integrity</small>
                <h2>Critical risk detected</h2>
              </div>
              <div className="risk-ring">
                <strong>97</strong>
                <span>risk</span>
              </div>
            </div>
            <div className="signal-stack">
              <div className="signal">
                <span className="signal-icon whale">◒</span>
                <div>
                  <small>Largest-wallet share</small>
                  <strong>99.878%</strong>
                </div>
                <span className="flag critical">Critical</span>
              </div>
              <div className="signal">
                <span className="signal-icon turnout">⌁</span>
                <div>
                  <small>Unique-wallet turnout</small>
                  <strong>0.04%</strong>
                </div>
                <span className="flag high">High risk</span>
              </div>
              <div className="signal">
                <span className="signal-icon quorum">◇</span>
                <div>
                  <small>Quorum margin</small>
                  <strong>Minimal</strong>
                </div>
                <span className="flag high">High risk</span>
              </div>
            </div>
            <div className="counterfactual-mini">
              <div>
                <small>Recorded rule</small>
                <strong>1T1V · Passed</strong>
              </div>
              <span>→</span>
              <div>
                <small>Outcome robustness</small>
                <strong>Mechanism-sensitive</strong>
              </div>
            </div>
          </div>
          <div className="floating-tag tag-a">
            <span>Policy response</span>
            <strong>Review triggered</strong>
          </div>
          <div className="floating-tag tag-b">
            <span>Data indexed by</span>
            <strong>The Graph</strong>
          </div>
        </div>

        <div className="hero-foot">
          <span>Analysis, not ideology.</span>
          <span>Community-defined safeguards.</span>
          <span>Transparent counterfactuals.</span>
        </div>
      </section>

      <LatestEnsProposal />

      <section className="problem-section" id="problem">
        <div className="section-index">01 / The problem</div>
        <div className="problem-grid">
          <div className="problem-copy">
            <p className="eyebrow">Governance can execute faster than communities can react.</p>
            <h2>
              A valid vote can still produce an
              <em> untrustworthy outcome.</em>
            </h2>
            <p>
              Low participation, concentrated voting power, purchasable quorum,
              delegated influence, and rapid execution can turn legitimate
              governance machinery into an attack surface.
            </p>
            <p>
              Existing tools provide voting interfaces, identity credentials,
              timelocks, or isolated monitoring. FlexGov connects the evidence:
              who voted, how power moved, which assumptions determined the
              result, and what the community authorised the system to do next.
            </p>
          </div>
          <div className="case-study">
            <div className="case-label">
              <span>Case study</span>
              <strong>BonkDAO · July 2026</strong>
            </div>
            <p className="case-quote">
              One wallet acquired enough voting power to satisfy a low quorum
              and controlled nearly all weight in a treasury-transfer vote.
            </p>
            <div className="case-stats">
              {signals.map((signal) => (
                <div key={signal.value}>
                  <strong>{signal.value}</strong>
                  <span>{signal.label}</span>
                </div>
              ))}
            </div>
            <p className="case-caveat">
              FlexGov treats these as observable risk signals—not automatic
              proof of bribery, collusion, or intent.
            </p>
          </div>
        </div>
      </section>

      <section className="method-section" id="how-it-works">
        <div className="section-heading">
          <div className="section-index light">02 / How it works</div>
          <h2>
            From raw votes to
            <br />
            <em>governable evidence.</em>
          </h2>
          <p>
            FlexGov separates measurement, interpretation, and enforcement so
            communities can understand every step.
          </p>
        </div>
        <div className="steps">
          {analysisSteps.map((step) => (
            <article key={step.number}>
              <span>{step.number}</span>
              <div className="step-mark" />
              <h3>{step.title}</h3>
              <p>{step.body}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="counterfactual-section">
        <div className="counterfactual-copy">
          <div className="section-index">03 / Counterfactual analysis</div>
          <h2>
            Not “the fair answer.”
            <br />
            <em>The answer under different assumptions.</em>
          </h2>
          <p>
            FlexGov does not average unlike voting systems into a synthetic
            winner. It displays each result independently, then explains whether
            the outcome remains stable.
          </p>
          <ul>
            <li>Unanimous across mechanisms</li>
            <li>Directionally consistent</li>
            <li>Mechanism-sensitive</li>
            <li>Outcome reversal</li>
            <li>Indeterminate from available data</li>
          </ul>
        </div>
        <div className="comparison-card">
          <div className="comparison-head">
            <div>
              <small>Proposal BIP #76</small>
              <strong>Outcome comparison</strong>
            </div>
            <span>Illustrative</span>
          </div>
          <div className="method-bars">
            {methods.map((method) => (
              <div className="method-row" key={method.label}>
                <div className="method-label">
                  <strong>{method.label}</strong>
                  <span>{method.outcome}</span>
                </div>
                <div className="bar-track">
                  <span
                    className={`bar-fill ${method.tone}`}
                    style={{ width: `${method.support}%` }}
                  />
                </div>
                <strong>{method.support}%</strong>
              </div>
            ))}
          </div>
          <div className="robustness-result">
            <span className="diamond">◇</span>
            <div>
              <small>Robustness classification</small>
              <strong>Outcome reversal</strong>
            </div>
            <span className="result-pill">Review</span>
          </div>
          <p>
            1W1V means one eligible address, not one verified person. Every
            comparison discloses its identity and eligibility assumptions.
          </p>
        </div>
      </section>

      <section className="modes-section" id="modes">
        <div className="section-index light">04 / Adaptive by design</div>
        <div className="modes-intro">
          <h2>
            One framework.
            <br />
            <em>Community-defined rules.</em>
          </h2>
          <p>
            A DAO can choose advisory analysis, pre-authorised escalation, or a
            binding rule response. Adaptability is legitimate when the policy is
            explicit before voting begins.
          </p>
        </div>
        <div className="mode-grid">
          {modes.map((mode, index) => (
            <article key={mode.name}>
              <div className="mode-top">
                <span>0{index + 1}</span>
                <small>{mode.status}</small>
              </div>
              <h3>{mode.name}</h3>
              <p>{mode.body}</p>
              <div className="mode-line" />
            </article>
          ))}
        </div>
      </section>

      <section className="principles-section" id="principles">
        <div className="principles-card">
          <div className="principles-symbol">
            <img src="flexgov-icon.png" alt="" />
          </div>
          <div>
            <div className="section-index">05 / Constitutional choice</div>
            <blockquote>
              “FlexGov does not decide what fairness means for every community.”
            </blockquote>
            <p>
              It lets communities encode their own safeguards, detects when
              those safeguards are threatened, and shows whether an outcome
              survives alternative governance assumptions.
            </p>
          </div>
        </div>
        <div className="principle-list">
          <div>
            <span>01</span>
            <h3>Legible</h3>
            <p>Every conclusion decomposes into observable measurements.</p>
          </div>
          <div>
            <span>02</span>
            <h3>Contestable</h3>
            <p>Risk signals can be inspected, challenged, and overridden.</p>
          </div>
          <div>
            <span>03</span>
            <h3>Pre-authorised</h3>
            <p>Binding adaptations are defined before participants vote.</p>
          </div>
          <div>
            <span>04</span>
            <h3>Modular</h3>
            <p>Communities select their own mechanisms and protection levels.</p>
          </div>
        </div>
      </section>

      <section className="architecture-strip">
        <p>Built as composable governance infrastructure</p>
        <div>
          <span>The Graph</span>
          <i />
          <span>Verifiable compute</span>
          <i />
          <span>Agent-readable reports</span>
          <i />
          <span>Community policy</span>
        </div>
      </section>

      <section className="final-cta">
        <div className="cta-orbit" />
        <p className="kicker">
          <span />
          Governance should be observable before it is executable
        </p>
        <h2>
          Make the assumptions visible.
          <br />
          <em>Make the outcome accountable.</em>
        </h2>
        <div className="hero-actions">
          <a
            className="button-light"
            href="review/?doc=WHITEPAPER_v0.1.md"
          >
            Read whitepaper v0.1 <span>↗</span>
          </a>
          <a className="text-link light-link" href="#top">
            Back to top ↑
          </a>
        </div>
      </section>

      <footer>
        <img src="flexgov-logo.png" alt="FlexGov" />
        <p>Adaptive governance for the agentic economy.</p>
        <span>Working prototype · 2026</span>
      </footer>
    </main>
  );
}
