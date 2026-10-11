"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";

const examples = [
  {
    label: "Work",
    rough: "I need more time. I couldn't finish this today.",
    clear:
      "I’m making good progress, but I need until tomorrow afternoon to finish this properly. I’ll send a complete version by 3 PM.",
  },
  {
    label: "Difficult moment",
    rough: "Your feedback felt unfair and I don't agree.",
    clear:
      "Thanks for being direct with me. I see the concern differently, and I’d like to walk through the context so we can agree on the best next step.",
  },
  {
    label: "Explain",
    rough: "What is a quantized model? Keep it simple.",
    clear:
      "It’s the same model packed into a smaller format. It uses less memory and runs faster, with a small tradeoff in precision—like compressing a photo without changing what it shows.",
  },
];

const family = [
  {
    code: "01",
    name: "Ash Core",
    size: "2B Lab",
    status: "In development",
    description:
      "Our learning and validation checkpoint. Small enough to test the full training loop quickly and honestly.",
    accent: true,
  },
  {
    code: "02",
    name: "Ash Core",
    size: "9B",
    status: "Main target",
    description:
      "The larger communication-first assistant we are building toward for stronger reasoning and everyday help.",
  },
  {
    code: "03",
    name: "Ash Coder",
    size: "Specialist",
    status: "Planned",
    description:
      "A focused family member for code, debugging, repositories, terminal work, and technical building.",
  },
  {
    code: "04",
    name: "Ash Mobile",
    size: "Compact",
    status: "Future",
    description:
      "A smaller, efficient model designed for phone-friendly runtimes and useful help closer to the user.",
  },
];

const pipeline = [
  {
    number: "01",
    title: "Shape the voice",
    text: "Curate real examples of clear, calm, useful communication.",
    state: "Current focus",
  },
  {
    number: "02",
    title: "Fine-tune",
    text: "Teach an open base model the Ash response style with LoRA.",
    state: "Next",
  },
  {
    number: "03",
    title: "Evaluate",
    text: "Compare the base and tuned models on practical prompts.",
    state: "Planned",
  },
  {
    number: "04",
    title: "Package locally",
    text: "Prepare efficient MLX and GGUF releases for local use.",
    state: "Planned",
  },
  {
    number: "05",
    title: "Release",
    text: "Publish clear model cards for Hugging Face and Ollama.",
    state: "Goal",
  },
];

function MouseExperience() {
  const auraRef = useRef<HTMLDivElement>(null);
  const ringRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const finePointer = window.matchMedia("(hover: hover) and (pointer: fine)");
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

    if (!finePointer.matches || reducedMotion.matches) return;

    const root = document.documentElement;
    const aura = auraRef.current;
    const ring = ringRef.current;

    if (!aura || !ring) return;

    let targetX = window.innerWidth / 2;
    let targetY = window.innerHeight / 2;
    let ringX = targetX;
    let ringY = targetY;
    let auraX = targetX;
    let auraY = targetY;
    let animationFrame = 0;
    let pointerInside = false;
    let activeMagnetic: HTMLElement | null = null;
    let magneticRect: DOMRect | null = null;
    let activeReactive: HTMLElement | null = null;
    let reactiveRect: DOMRect | null = null;
    let lastSpark = 0;
    const sparks = new Set<HTMLElement>();

    const resetMagnetic = (element: HTMLElement | null) => {
      if (!element) return;
      element.style.setProperty("--mag-x", "0px");
      element.style.setProperty("--mag-y", "0px");
    };

    const resetReactive = (element: HTMLElement | null) => {
      if (!element) return;
      element.style.setProperty("--tilt-x", "0deg");
      element.style.setProperty("--tilt-y", "0deg");
      element.style.setProperty("--spot-opacity", "0");
    };

    const render = () => {
      ringX += (targetX - ringX) * 0.2;
      ringY += (targetY - ringY) * 0.2;
      auraX += (targetX - auraX) * 0.075;
      auraY += (targetY - auraY) * 0.075;

      ring.style.transform = `translate3d(${ringX}px, ${ringY}px, 0) translate(-50%, -50%)`;
      aura.style.transform = `translate3d(${auraX}px, ${auraY}px, 0) translate(-50%, -50%)`;

      animationFrame = window.requestAnimationFrame(render);
    };

    const makeSpark = (event: PointerEvent) => {
      const now = performance.now();
      if (now - lastSpark < 72 || Math.hypot(event.movementX, event.movementY) < 3) return;
      lastSpark = now;

      const spark = document.createElement("span");
      spark.className = "ash-cursor-spark";
      spark.style.left = `${event.clientX}px`;
      spark.style.top = `${event.clientY}px`;
      spark.style.setProperty("--spark-x", `${Math.max(-18, Math.min(18, -event.movementX * 1.8))}px`);
      spark.style.setProperty("--spark-y", `${Math.max(-18, Math.min(18, -event.movementY * 1.8))}px`);
      document.body.appendChild(spark);
      sparks.add(spark);

      window.setTimeout(() => {
        spark.remove();
        sparks.delete(spark);
      }, 620);
    };

    const onPointerMove = (event: PointerEvent) => {
      pointerInside = true;
      targetX = event.clientX;
      targetY = event.clientY;

      root.classList.add("ash-pointer-visible");
      root.style.setProperty("--mouse-nx", String(event.clientX / window.innerWidth - 0.5));
      root.style.setProperty("--mouse-ny", String(event.clientY / window.innerHeight - 0.5));

      const target = event.target instanceof Element ? event.target : null;
      const action = target?.closest("a, button");
      ring.classList.toggle("is-action", Boolean(action));
      makeSpark(event);

      const magnetic = target?.closest<HTMLElement>("[data-magnetic]") ?? null;
      if (magnetic !== activeMagnetic) {
        resetMagnetic(activeMagnetic);
        activeMagnetic = magnetic;
        magneticRect = magnetic?.getBoundingClientRect() ?? null;
      }

      if (activeMagnetic && magneticRect) {
        const strength = Number(activeMagnetic.dataset.magneticStrength ?? 8);
        const x = ((event.clientX - magneticRect.left) / magneticRect.width - 0.5) * strength * 2;
        const y = ((event.clientY - magneticRect.top) / magneticRect.height - 0.5) * strength * 2;
        activeMagnetic.style.setProperty("--mag-x", `${x.toFixed(2)}px`);
        activeMagnetic.style.setProperty("--mag-y", `${y.toFixed(2)}px`);
      }

      const reactive = target?.closest<HTMLElement>("[data-tilt], [data-spotlight]") ?? null;
      if (reactive !== activeReactive) {
        resetReactive(activeReactive);
        activeReactive = reactive;
        reactiveRect = reactive?.getBoundingClientRect() ?? null;
      }

      if (activeReactive && reactiveRect) {
        const localX = (event.clientX - reactiveRect.left) / reactiveRect.width;
        const localY = (event.clientY - reactiveRect.top) / reactiveRect.height;
        activeReactive.style.setProperty("--spot-x", `${(localX * 100).toFixed(1)}%`);
        activeReactive.style.setProperty("--spot-y", `${(localY * 100).toFixed(1)}%`);
        activeReactive.style.setProperty("--spot-opacity", "1");

        if (activeReactive.hasAttribute("data-tilt")) {
          const maxTilt = Number(activeReactive.dataset.tiltMax ?? 2.5);
          activeReactive.style.setProperty("--tilt-x", `${((0.5 - localY) * maxTilt * 2).toFixed(2)}deg`);
          activeReactive.style.setProperty("--tilt-y", `${((localX - 0.5) * maxTilt * 2).toFixed(2)}deg`);
        }
      }
    };

    const onPointerLeave = () => {
      pointerInside = false;
      root.classList.remove("ash-pointer-visible");
      ring.classList.remove("is-action", "is-pressed");
      resetMagnetic(activeMagnetic);
      resetReactive(activeReactive);
      activeMagnetic = null;
      activeReactive = null;
      magneticRect = null;
      reactiveRect = null;
    };

    const onPointerDown = () => ring.classList.add("is-pressed");
    const onPointerUp = () => ring.classList.remove("is-pressed");

    const onResize = () => {
      magneticRect = activeMagnetic?.getBoundingClientRect() ?? null;
      reactiveRect = activeReactive?.getBoundingClientRect() ?? null;
    };

    const onVisibilityChange = () => {
      window.cancelAnimationFrame(animationFrame);
      if (!document.hidden && pointerInside) animationFrame = window.requestAnimationFrame(render);
    };

    root.classList.add("ash-pointer-enabled");
    animationFrame = window.requestAnimationFrame(render);
    window.addEventListener("pointermove", onPointerMove, { passive: true });
    window.addEventListener("pointerleave", onPointerLeave);
    window.addEventListener("pointerdown", onPointerDown, { passive: true });
    window.addEventListener("pointerup", onPointerUp, { passive: true });
    window.addEventListener("resize", onResize, { passive: true });
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      window.cancelAnimationFrame(animationFrame);
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerleave", onPointerLeave);
      window.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("pointerup", onPointerUp);
      window.removeEventListener("resize", onResize);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      resetMagnetic(activeMagnetic);
      resetReactive(activeReactive);
      sparks.forEach((spark) => spark.remove());
      root.classList.remove("ash-pointer-enabled", "ash-pointer-visible");
      root.style.removeProperty("--mouse-nx");
      root.style.removeProperty("--mouse-ny");
    };
  }, []);

  return (
    <div className="ash-cursor-layer" aria-hidden="true">
      <div className="ash-cursor__aura" ref={auraRef} />
      <div className="ash-cursor__ring" ref={ringRef}><i /></div>
    </div>
  );
}

export default function Home() {
  const [activeExample, setActiveExample] = useState(0);
  const example = examples[activeExample];

  return (
    <main className="motion-page">
      <MouseExperience />
      <nav className="nav-shell" aria-label="Main navigation">
        <a className="brand" href="#top" aria-label="Ash AI home" data-magnetic data-magnetic-strength="5">
          <span className="brand-mark">
            <Image src="/ash-logo.png" alt="" width={44} height={44} priority />
          </span>
          <span className="brand-name">Ash AI</span>
        </a>
        <div className="nav-links">
          <a href="#purpose">Purpose</a>
          <a href="#family">Family</a>
          <a href="#build">The build</a>
          <a href="#roadmap">Roadmap</a>
        </div>
        <a className="nav-cta" href="#build" data-magnetic data-magnetic-strength="9">
          Follow the build <span aria-hidden="true">↘</span>
        </a>
      </nav>

      <section className="hero section-shell" id="top" data-motion-scope="hero">
        <div className="hero-pointer-field" aria-hidden="true" />
        <div className="hero-copy">
          <div className="eyebrow reveal-one">
            <span className="status-dot" />
            Model family · In development
          </div>
          <h1 className="reveal-two">
            A model family built for the moments <em>words matter.</em>
          </h1>
          <p className="hero-lede reveal-three">
            Ash is a communication-first AI model being built for clear replies,
            practical work, and human help—one proven step at a time.
          </p>
          <div className="hero-actions reveal-three">
            <a className="button button-dark" href="#family" data-magnetic data-magnetic-strength="10">
              Explore the family <span aria-hidden="true">↓</span>
            </a>
            <a className="text-link" href="#build" data-magnetic data-magnetic-strength="6">
              See how we’re building <span aria-hidden="true">↗</span>
            </a>
          </div>
          <div className="hero-proof reveal-three">
            <div>
              <strong>Human first</strong>
              <span>Clear, calm, useful</span>
            </div>
            <div>
              <strong>Local goal</strong>
              <span>MLX · GGUF · Ollama</span>
            </div>
            <div>
              <strong>Open journey</strong>
              <span>Build · test · improve</span>
            </div>
          </div>
        </div>

        <div className="signal-panel-shell reveal-panel">
          <div className="signal-panel" aria-label="Ash communication examples" data-tilt data-tilt-max="2.1">
            <div className="panel-topline">
              <span>ASH / HUMAN SIGNAL</span>
              <span className="live-label"><i /> LIVE CONCEPT</span>
            </div>
            <div className="example-tabs" role="tablist" aria-label="Choose an example">
              {examples.map((item, index) => (
                <button
                  key={item.label}
                  type="button"
                  role="tab"
                  aria-selected={activeExample === index}
                  className={activeExample === index ? "active" : ""}
                  onClick={() => setActiveExample(index)}
                  data-magnetic
                  data-magnetic-strength="4"
                >
                  {item.label}
                </button>
              ))}
            </div>
            <div className="message-block rough-message">
              <span className="message-label">ROUGH THOUGHT</span>
              <p className="message-text" key={`rough-${activeExample}`}>“{example.rough}”</p>
            </div>
            <div className="signal-arrow" aria-hidden="true">
              <span>ASH</span>
              <b>↓</b>
            </div>
            <div className="message-block clear-message" aria-live="polite">
              <span className="message-label">CLEAR ASH REPLY</span>
              <p className="message-text" key={`clear-${activeExample}`}>“{example.clear}”</p>
            </div>
            <div className="panel-footer">
              <span>Direct answer first</span>
              <span>Practical next step</span>
              <span>Honest limits</span>
            </div>
          </div>
        </div>
      </section>

      <div className="signal-strip" aria-hidden="true">
        <div>
          <span>COMMUNICATION-FIRST</span><i />
          <span>BUILT SMALL FIRST</span><i />
          <span>DESIGNED TO GROW</span><i />
          <span>LOCAL RELEASE GOAL</span><i />
          <span>COMMUNICATION-FIRST</span><i />
          <span>BUILT SMALL FIRST</span>
        </div>
      </div>

      <section className="purpose section-shell" id="purpose">
        <div className="section-intro">
          <div>
            <span className="section-number">01 / PURPOSE</span>
            <h2>Intelligence should feel useful before it feels impressive.</h2>
          </div>
          <p>
            Ash starts where people feel the most friction: finding the right words,
            understanding what matters, and knowing what to do next.
          </p>
        </div>

        <div className="moment-grid">
          <article className="moment-card card-ember" data-tilt data-tilt-max="3.5">
            <span className="card-index">A</span>
            <div className="moment-icon" aria-hidden="true">“</div>
            <h3>Clearer work replies</h3>
            <p>Turn incomplete thoughts into messages that are confident, specific, and ready to send.</p>
            <span className="card-caption">STATUS · CORE BEHAVIOR</span>
          </article>
          <article className="moment-card card-citron" data-tilt data-tilt-max="3.5">
            <span className="card-index">B</span>
            <div className="moment-icon" aria-hidden="true">↔</div>
            <h3>Calm in difficult moments</h3>
            <p>Respond to feedback, conflict, mistakes, and uncertainty without sounding cold or defensive.</p>
            <span className="card-caption">STATUS · CORE BEHAVIOR</span>
          </article>
          <article className="moment-card card-paper" data-tilt data-tilt-max="3.5">
            <span className="card-index">C</span>
            <div className="moment-icon" aria-hidden="true">⌁</div>
            <h3>Simple technical help</h3>
            <p>Explain models, code, and builder questions in plain language without hiding the real details.</p>
            <span className="card-caption">STATUS · SECONDARY STRENGTH</span>
          </article>
        </div>
      </section>

      <section className="family-section" id="family">
        <div className="section-shell family-inner">
          <div className="family-heading">
            <div>
              <span className="section-number light">02 / THE FAMILY</span>
              <h2>One voice.<br />Built to become a family.</h2>
            </div>
            <div className="family-note">
              <span>WORKING FAMILY MAP</span>
              <p>
                The names below describe our current direction. They are milestones,
                not claims that these models have already been released.
              </p>
            </div>
          </div>

          <div className="family-map">
            <div className="family-origin" aria-hidden="true">
              <span className="origin-logo"><Image src="/ash-logo.png" alt="" width={82} height={82} /></span>
              <b>ASH</b>
              <i />
            </div>
            <div className="family-grid">
              {family.map((model) => (
                <article className={`family-card${model.accent ? " featured" : ""}`} key={`${model.name}-${model.size}`} data-spotlight>
                  <div className="family-card-top">
                    <span>{model.code}</span>
                    <span className="model-status">{model.status}</span>
                  </div>
                  <div>
                    <h3>{model.name}</h3>
                    <strong>{model.size}</strong>
                  </div>
                  <p>{model.description}</p>
                  <div className="card-line"><i /></div>
                </article>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="build section-shell" id="build">
        <div className="build-heading">
          <span className="section-number">03 / THE BUILD</span>
          <div>
            <h2>A real model,<br />built step by step.</h2>
            <p>
              The first Ash release is a fine-tune of an open base model—not a model trained from scratch.
              We are proving the full workflow before scaling it.
            </p>
          </div>
        </div>

        <div className="build-layout">
          <aside className="build-stats">
            <div className="stat-block">
              <strong>35</strong>
              <span>curated training examples today</span>
            </div>
            <div className="stat-block">
              <strong>500</strong>
              <span>hand-curated examples for the first training target</span>
            </div>
            <div className="stat-block small-stat">
              <strong>2B → 9B</strong>
              <span>development checkpoint to main assistant target</span>
            </div>
            <div className="truth-note" data-spotlight>
              <span>WHY START SMALL?</span>
              <p>Fast experiments reveal data and behavior problems before they become expensive mistakes.</p>
            </div>
          </aside>

          <div className="pipeline">
            {pipeline.map((step, index) => (
              <article className={`pipeline-step${index === 0 ? " current" : ""}`} key={step.number}>
                <div className="step-number">{step.number}</div>
                <div className="step-copy">
                  <div>
                    <h3>{step.title}</h3>
                    <span>{step.state}</span>
                  </div>
                  <p>{step.text}</p>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="principles">
        <div className="section-shell">
          <div className="principles-top">
            <span className="section-number light">04 / ASH PRINCIPLES</span>
            <p>Behavior is the product.</p>
          </div>
          <div className="principle-lines">
            <div data-spotlight><span>01</span><h3>Answer the real question first.</h3></div>
            <div data-spotlight><span>02</span><h3>Sound human, not performative.</h3></div>
            <div data-spotlight><span>03</span><h3>Be honest about limits.</h3></div>
            <div data-spotlight><span>04</span><h3>Leave people with a next step.</h3></div>
          </div>
          <p className="principles-footnote">
            Ash should help people communicate with confidence—never help them lie, fake work,
            or hide important risks.
          </p>
        </div>
      </section>

      <section className="local-goal section-shell">
        <div className="local-copy">
          <span className="section-number">05 / LOCAL-FIRST GOAL</span>
          <h2>Your model.<br />Closer to you.</h2>
          <p>
            The goal is a practical local release that can run through familiar tools across macOS,
            Windows, and Linux—with clear model cards and no mystery around what it can do.
          </p>
          <div className="format-chips">
            <span>MLX · MAC DEVELOPMENT</span>
            <span>GGUF · LOCAL RELEASE</span>
            <span>OLLAMA · EASY RUNNER</span>
          </div>
        </div>
        <div className="terminal-card" data-tilt data-tilt-max="1.25">
          <div className="terminal-top">
            <span><i /><i /><i /></span>
            <span>LOCAL / FUTURE RELEASE</span>
          </div>
          <div className="terminal-body">
            <span className="terminal-label">THE COMMAND WE’RE BUILDING TOWARD</span>
            <code><b>$</b> ollama run ash<span className="terminal-caret" aria-hidden="true" /></code>
            <div className="terminal-response">
              <span className="ash-prompt">ASH</span>
              <p>Tell me what’s going on. I’ll help you make it clear.</p>
            </div>
          </div>
          <div className="terminal-grid" aria-hidden="true" />
        </div>
      </section>

      <section className="roadmap section-shell" id="roadmap">
        <div className="roadmap-header">
          <span className="section-number">06 / ROADMAP</span>
          <h2>Build the proof.<br />Then earn the scale.</h2>
        </div>
        <div className="roadmap-grid">
          <article data-tilt data-tilt-max="2">
            <div className="roadmap-status now"><i /> NOW</div>
            <h3>Foundation lab</h3>
            <ul>
              <li>Communication dataset</li>
              <li>2B model baseline</li>
              <li>Ash behavior specification</li>
              <li>Small, reviewable experiments</li>
            </ul>
          </article>
          <article data-tilt data-tilt-max="2">
            <div className="roadmap-status next"><i /> NEXT</div>
            <h3>First complete release</h3>
            <ul>
              <li>LoRA fine-tuning</li>
              <li>Base vs. Ash evaluation</li>
              <li>GGUF and Ollama packaging</li>
              <li>Transparent model card</li>
            </ul>
          </article>
          <article data-tilt data-tilt-max="2">
            <div className="roadmap-status later"><i /> LATER</div>
            <h3>The Ash family</h3>
            <ul>
              <li>Stronger 9B assistant</li>
              <li>Ash Coder specialist</li>
              <li>Compact mobile model</li>
              <li>App and API experiences</li>
            </ul>
          </article>
        </div>
      </section>

      <footer>
        <div className="footer-main section-shell">
          <div className="footer-brand">
            <span className="footer-logo"><Image src="/ash-logo.png" alt="Ash AI logo" width={96} height={96} /></span>
            <h2>Build intelligence.<br /><em>Keep it human.</em></h2>
          </div>
          <a className="button button-light" href="#top" data-magnetic data-magnetic-strength="10">Back to the top <span aria-hidden="true">↑</span></a>
        </div>
        <div className="footer-bottom section-shell">
          <span>ASH AI · MODEL FAMILY IN DEVELOPMENT</span>
          <span>BUILT ONE PROVEN STEP AT A TIME</span>
          <span>© 2026 ASH AI</span>
        </div>
      </footer>
    </main>
  );
}
