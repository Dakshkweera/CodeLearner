import React from 'react';
import { useNavigate } from 'react-router-dom';
import mainImg from '../assets/main.png';
import aiImg from '../assets/ai.png';
import codeviewImg from '../assets/codeview.png';
import focusmodeImg from '../assets/focusmode.png';
import landingimg from '../assets/landing.png';


const LandingPage: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-slate-950 text-slate-50">
      {/* Top gradient background */}
      <div className="absolute inset-0 -z-10 bg-gradient-to-b from-slate-900 via-slate-950 to-slate-950" />

      {/* Navbar */}
      <header className="border-b border-slate-800/60 bg-slate-950/70 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-500 text-lg font-bold">
              C
            </div>
            <span className="text-lg font-semibold tracking-tight">
              CodeLearner
            </span>
          </div>

          <nav className="hidden items-center gap-8 text-sm text-slate-300 md:flex">
            <button
              className="hover:text-white"
              onClick={() =>
                document
                  .getElementById('features')
                  ?.scrollIntoView({ behavior: 'smooth' })
              }
            >
              Features
            </button>
            <button
              className="hover:text-white"
              onClick={() =>
                document
                  .getElementById('how-it-works')
                  ?.scrollIntoView({ behavior: 'smooth' })
              }
            >
              How it works
            </button>
            <button
              className="hover:text-white"
              onClick={() =>
                document
                  .getElementById('use-cases')
                  ?.scrollIntoView({ behavior: 'smooth' })
              }
            >
              Use cases
            </button>
          </nav>

          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate('/login')}
              className="text-sm text-slate-300 hover:text-white"
            >
              Log in
            </button>
            <button
              onClick={() => navigate('/signup')}
              className="rounded-full bg-blue-500 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-blue-500/30 hover:bg-blue-400"
            >
              Get started
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 pb-24 pt-12 md:pt-20">
        {/* Hero */}
        <section className="grid gap-10 md:grid-cols-2 md:items-center">
          <div>
            <p className="mb-4 inline-flex items-center rounded-full border border-blue-500/40 bg-blue-500/10 px-3 py-1 text-xs font-medium text-blue-200">
              New · Visual map + AI assistant
            </p>
            <h1 className="text-balance text-4xl font-extrabold tracking-tight text-slate-50 sm:text-5xl md:text-6xl">
              See your entire codebase
              <span className="block text-blue-400">at a glance.</span>
            </h1>
            <p className="mt-4 max-w-xl text-sm text-slate-300 sm:text-base">
              CodeLearner turns complex repositories into an interactive map so
              you can trace flows, open files, and ask AI questions without
              getting lost.
            </p>

            <div className="mt-6 flex flex-wrap items-center gap-4">
              <button
                onClick={() => navigate('/signup')}
                className="rounded-full bg-blue-500 px-6 py-2.5 text-sm font-semibold text-white shadow-lg shadow-blue-500/40 hover:bg-blue-400"
              >
                Start exploring your code
              </button>
              <button
                onClick={() =>
                  document
                    .getElementById('screenshots')
                    ?.scrollIntoView({ behavior: 'smooth' })
                }
                className="rounded-full border border-slate-700 px-6 py-2.5 text-sm font-semibold text-slate-100 hover:border-slate-500"
              >
                View demo
              </button>
            </div>

            <div className="mt-6 flex flex-wrap gap-6 text-xs text-slate-400">
              <div>
                <span className="block font-semibold text-slate-200">
                  Faster onboarding
                </span>
                Understand new repositories in days, not weeks.
              </div>
              <div>
                <span className="block font-semibold text-slate-200">
                  AI‑guided navigation
                </span>
                Ask questions and jump straight to relevant files.
              </div>
            </div>
          </div>

          {/* Hero screenshot - main.png */}
          <div className="relative">
            <div className="absolute -inset-4 -z-10 rounded-3xl bg-blue-500/20 blur-3xl" />
            <div className="overflow-hidden rounded-3xl border border-slate-800 bg-slate-900/80 shadow-2xl shadow-blue-500/30">
              <img
                src={landingimg}
                alt="CodeLearner interactive code map"
                className="h-full w-full object-cover"
              />
            </div>
          </div>
        </section>

        {/* Screenshots / carousel */}
        <section id="screenshots" className="mt-20">
          <h2 className="text-center text-2xl font-semibold text-slate-50">
            Explore your repository from every angle
          </h2>
          <p className="mt-2 text-center text-sm text-slate-300">
            Visual map, in‑context code viewer, focus mode, and an AI assistant—all in one place.
          </p>

          <div className="mt-8 grid gap-6 md:grid-cols-4">
            <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-3">
              <div className="overflow-hidden rounded-xl border border-slate-800">
                <img
                  src={aiImg}
                  alt="AI assistant"
                  className="h-40 w-full object-cover"
                />
              </div>
              <h3 className="mt-3 text-sm font-semibold text-slate-100">
                AI assistant for each file
              </h3>
              <p className="mt-1 text-xs text-slate-300">
                Ask "What does this file do?" or "Where is this used?" and get answers with code references.
              </p>
            </div>

            <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-3">
              <div className="overflow-hidden rounded-xl border border-slate-800">
                <img
                  src={codeviewImg}
                  alt="In‑context code viewer"
                  className="h-40 w-full object-cover"
                />
              </div>
              <h3 className="mt-3 text-sm font-semibold text-slate-100">
                In‑context code viewer
              </h3>
              <p className="mt-1 text-xs text-slate-300">
                Click any node to open the file and keep the map as your minimap.
              </p>
            </div>

            <div className="rounded-2xl border border-blue-500/40 bg-gradient-to-br from-blue-500/10 to-slate-900/70 p-3 ring-1 ring-blue-500/30">
              <div className="overflow-hidden rounded-xl border border-slate-700">
                <img
                  src={focusmodeImg}
                  alt="Focus mode"
                  className="h-40 w-full object-cover"
                />
              </div>
              <div className="mt-3 flex items-center gap-2">
                <h3 className="text-sm font-semibold text-slate-100">
                  Focus Mode
                </h3>
                <span className="rounded-full bg-blue-500 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
                  Key Feature
                </span>
              </div>
              <p className="mt-1 text-xs text-slate-300">
                Isolate only the files related to a specific module or feature. Hide the noise and see exactly what matters for the task at hand.
              </p>
            </div>

            <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-3">
              <div className="overflow-hidden rounded-xl border border-slate-800">
                <img
                  src={mainImg}
                  alt="Interactive code map"
                  className="h-40 w-full object-cover"
                />
              </div>
              <h3 className="mt-3 text-sm font-semibold text-slate-100">
                Full repository map
              </h3>
              <p className="mt-1 text-xs text-slate-300">
                Navigate your entire repository as a graph; see entry points, routes, middleware, and utilities at a glance.
              </p>
            </div>
          </div>
        </section>

        {/* Features */}
        <section id="features" className="mt-20">
          <h2 className="text-center text-2xl font-semibold text-slate-50">
            Built to make large codebases feel small
          </h2>
          <p className="mt-2 text-center text-sm text-slate-300">
            Combine a visual map, semantic search, and AI answers into one workspace.
          </p>

          <div className="mt-8 grid gap-6 md:grid-cols-2">
            <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6">
              <h3 className="text-sm font-semibold text-slate-100">
                Visual architecture overview
              </h3>
              <p className="mt-2 text-sm text-slate-300">
                See how files, routes, and modules connect instead of digging through nested folders.
              </p>
            </div>

            <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6">
              <h3 className="text-sm font-semibold text-slate-100">
                Semantic code search
              </h3>
              <p className="mt-2 text-sm text-slate-300">
                Search by concept—like "auth middleware" or "payment flow"—and jump to the most relevant files.
              </p>
            </div>

            <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6">
              <h3 className="text-sm font-semibold text-slate-100">
                File‑level insights
              </h3>
              <p className="mt-2 text-sm text-slate-300">
                Get summaries, key functions, and relationships before reading hundreds of lines.
              </p>
            </div>

            <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6">
              <h3 className="text-sm font-semibold text-slate-100">
                Secure workspace
              </h3>
              <p className="mt-2 text-sm text-slate-300">
                Email signup with OTP verification and JWT‑secured APIs protect access to your code map.
              </p>
            </div>
          </div>
        </section>

        {/* How it works */}
        <section id="how-it-works" className="mt-20">
          <h2 className="text-center text-2xl font-semibold text-slate-50">
            From repo URL to answers in minutes
          </h2>
          <div className="mt-8 grid gap-6 md:grid-cols-3">
            <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-500 text-sm font-bold">
                1
              </div>
              <h3 className="mt-3 text-sm font-semibold text-slate-100">
                Connect a repository
              </h3>
              <p className="mt-2 text-sm text-slate-300">
                Paste a GitHub URL or connect your repo and let CodeLearner pull the code.
              </p>
            </div>

            <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-500 text-sm font-bold">
                2
              </div>
              <h3 className="mt-3 text-sm font-semibold text-slate-100">
                Index & map your code
              </h3>
              <p className="mt-2 text-sm text-slate-300">
                The backend parses files, builds the graph, and generates embeddings behind the scenes.
              </p>
            </div>

            <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-500 text-sm font-bold">
                3
              </div>
              <h3 className="mt-3 text-sm font-semibold text-slate-100">
                Explore & ask
              </h3>
              <p className="mt-2 text-sm text-slate-300">
                Use the map, search, and AI chat to understand flows, debug, and onboard to new projects.
              </p>
            </div>
          </div>
        </section>

        {/* Use cases */}
        <section id="use-cases" className="mt-20">
          <h2 className="text-center text-2xl font-semibold text-slate-50">
            Where CodeLearner shines
          </h2>
          <div className="mt-8 grid gap-6 md:grid-cols-2">
            <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6">
              <h3 className="text-sm font-semibold text-slate-100">
                Onboarding to new projects
              </h3>
              <p className="mt-2 text-sm text-slate-300">
                Give new developers a guided map of the codebase from day one.
              </p>
            </div>
            <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6">
              <h3 className="text-sm font-semibold text-slate-100">
                Working with legacy code
              </h3>
              <p className="mt-2 text-sm text-slate-300">
                Trace how features are wired without manually reverse‑engineering every module.
              </p>
            </div>
            <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6">
              <h3 className="text-sm font-semibold text-slate-100">
                Reviewing external repos
              </h3>
              <p className="mt-2 text-sm text-slate-300">
                Quickly understand open‑source projects or candidate codebases.
              </p>
            </div>
            <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6">
              <h3 className="text-sm font-semibold text-slate-100">
                Teaching & learning
              </h3>
              <p className="mt-2 text-sm text-slate-300">
                Show students the architecture of real projects, not just folder trees.
              </p>
            </div>
          </div>
        </section>

        {/* Final CTA */}
        <section className="mt-20 rounded-3xl border border-blue-500/40 bg-gradient-to-r from-blue-600 to-indigo-500 px-6 py-10 text-center shadow-xl shadow-blue-500/40">
          <h2 className="text-2xl font-semibold text-white">
            Never feel lost in a codebase again
          </h2>
          <p className="mt-2 text-sm text-blue-100">
            Connect a repository and let CodeLearner draw the map for you.
          </p>
          <div className="mt-6 flex justify-center gap-4">
            <button
              onClick={() => navigate('/signup')}
              className="rounded-full bg-white px-6 py-2.5 text-sm font-semibold text-blue-700 hover:bg-blue-50"
            >
              Try CodeLearner
            </button>
            <button
              onClick={() => navigate('/login')}
              className="rounded-full border border-blue-100 px-6 py-2.5 text-sm font-semibold text-white hover:bg-blue-500/20"
            >
              Sign in
            </button>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-800 bg-slate-950/80 py-4">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 text-xs text-slate-500">
          <span>© {new Date().getFullYear()} CodeLearner. All rights reserved.</span>
          <span>Built for developers navigating complex codebases.</span>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;
