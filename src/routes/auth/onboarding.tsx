import { createFileRoute, Link } from "@tanstack/react-router";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
} from "~/components/ui/card";

export const Route = createFileRoute("/auth/onboarding")({
  component: OnboardingPage,
  head: () => ({
    meta: [
      { title: "Get Started — Moim" },
      {
        name: "description",
        content:
          "New to the Fediverse? Learn how to create an account and join Moim.",
      },
    ],
  }),
});

const INSTANCES = [
  {
    domain: "mastodon.social",
    locale: "en",
    software: "Mastodon",
    description: "General purpose, flagship instance",
  },
  {
    domain: "mastodon.world",
    locale: "en",
    software: "Mastodon",
    description: "Friendly general community",
  },
  {
    domain: "fosstodon.org",
    locale: "en",
    software: "Mastodon",
    description: "Free & open source enthusiasts",
  },
  {
    domain: "hachyderm.io",
    locale: "en",
    software: "Mastodon",
    description: "Tech industry professionals",
  },
  {
    domain: "mastodon.jp",
    locale: "ja",
    software: "Mastodon",
    description: "Japanese community",
  },
  {
    domain: "misskey.io",
    locale: "ja",
    software: "Misskey",
    description: "Japanese Misskey flagship",
  },
  {
    domain: "fedibird.com",
    locale: "ja",
    software: "Mastodon",
    description: "Japanese community with extended features",
  },
  {
    domain: "uri.life",
    locale: "ko",
    software: "Mastodon",
    description: "Korean community",
  },
  {
    domain: "planet.moe",
    locale: "ko",
    software: "Mastodon",
    description: "Korean community",
  },
] as const;

const TOTAL_STEPS = 3;

function getSignUpUrl(instance: (typeof INSTANCES)[number]) {
  if (instance.software === "Misskey") {
    return `https://${instance.domain}/register`;
  }
  return `https://${instance.domain}/auth/sign_up`;
}

function OnboardingPage() {
  const [step, setStep] = useState(0);
  const [browserLocale, setBrowserLocale] = useState("en");
  const touchStartX = useRef(0);
  const touchDeltaX = useRef(0);

  useEffect(() => {
    setBrowserLocale(navigator.language.split("-")[0]);
  }, []);

  const goTo = useCallback(
    (next: number) => {
      if (next === step || next < 0 || next >= TOTAL_STEPS) return;
      setStep(next);
    },
    [step],
  );

  const next = useCallback(() => goTo(step + 1), [goTo, step]);
  const prev = useCallback(() => goTo(step - 1), [goTo, step]);

  // Swipe support
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    touchDeltaX.current = 0;
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    touchDeltaX.current = e.touches[0].clientX - touchStartX.current;
  }, []);

  const handleTouchEnd = useCallback(() => {
    const threshold = 50;
    if (touchDeltaX.current < -threshold) next();
    else if (touchDeltaX.current > threshold) prev();
  }, [next, prev]);

  // Keyboard nav
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") next();
      else if (e.key === "ArrowLeft") prev();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [next, prev]);

  const sortedInstances = useMemo(() => {
    return [...INSTANCES].sort((a, b) => {
      const aMatch = a.locale === browserLocale ? 0 : 1;
      const bMatch = b.locale === browserLocale ? 0 : 1;
      return aMatch - bMatch;
    });
  }, [browserLocale]);

  const recommendedInstances = sortedInstances.filter(
    (i) => i.locale === browserLocale,
  );
  const otherInstances = sortedInstances.filter(
    (i) => i.locale !== browserLocale,
  );

  // Use the tallest panel's height so the container never changes size
  const panelRefs = useRef<(HTMLDivElement | null)[]>([]);
  const [containerHeight, setContainerHeight] = useState<number | undefined>(
    undefined,
  );

  const measure = useCallback(() => {
    const max = panelRefs.current.reduce((h, el) => {
      return el ? Math.max(h, el.scrollHeight) : h;
    }, 0);
    if (max > 0) setContainerHeight(max);
  }, []);

  useEffect(() => {
    measure();
  }, [measure, browserLocale]);

  useEffect(() => {
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [measure]);

  return (
    <main className="mx-auto max-w-2xl py-8">
      <Card>
        <CardHeader className="space-y-3">
          <img src="/logo.png" alt="moim" className="mx-auto h-10 w-auto grayscale" />
          {/* Step dots */}
          <div className="flex items-center justify-center gap-2">
            {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
              <button
                key={i}
                type="button"
                onClick={() => goTo(i)}
                className={`h-1.5 rounded-full transition-all duration-300 ${
                  i === step
                    ? "w-6 bg-foreground"
                    : "w-1.5 bg-muted-foreground/30 hover:bg-muted-foreground/50"
                }`}
                aria-label={`Go to step ${i + 1}`}
              />
            ))}
          </div>
        </CardHeader>

        <CardContent>
          <div
            className="relative overflow-hidden"
            style={{ height: containerHeight }}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
          >
            {/* Step 1: What & Why */}
            <div
              ref={(el) => { panelRefs.current[0] = el; }}
              className={`absolute inset-x-0 top-0 transition-all duration-300 ease-out ${
                step === 0
                  ? "translate-x-0 opacity-100"
                  : step > 0
                    ? "-translate-x-full opacity-0"
                    : "translate-x-full opacity-0"
              }`}
            >
              <div className="space-y-8">
                <section className="space-y-3">
                  <h3 className="text-xl font-semibold text-center">
                    What is the Fediverse?
                  </h3>
                  <p className="text-muted-foreground text-center max-w-md mx-auto">
                    A network of interconnected social platforms. Think of it
                    like email — you pick a provider, but you can talk to anyone
                    on any server.
                  </p>
                </section>

                <section className="space-y-4">
                  <h3 className="text-lg font-semibold text-center">
                    Why does Moim use it?
                  </h3>
                  <div className="grid gap-4 sm:grid-cols-3">
                    <div className="rounded-lg border p-4 text-center space-y-2">
                      <div className="text-2xl">🔓</div>
                      <p className="font-medium text-sm">No lock-in</p>
                      <p className="text-xs text-muted-foreground">
                        Your identity is yours across all federated services
                      </p>
                    </div>
                    <div className="rounded-lg border p-4 text-center space-y-2">
                      <div className="text-2xl">🏘️</div>
                      <p className="font-medium text-sm">Community-owned</p>
                      <p className="text-xs text-muted-foreground">
                        Pick a server that matches your values and language
                      </p>
                    </div>
                    <div className="rounded-lg border p-4 text-center space-y-2">
                      <div className="text-2xl">🛡️</div>
                      <p className="font-medium text-sm">Privacy-first</p>
                      <p className="text-xs text-muted-foreground">
                        No algorithm, no surveillance, no corporate tracking
                      </p>
                    </div>
                  </div>
                </section>
              </div>
            </div>

            {/* Step 2: Pick a server */}
            <div
              ref={(el) => { panelRefs.current[1] = el; }}
              className={`absolute inset-x-0 top-0 transition-all duration-300 ease-out ${
                step === 1
                  ? "translate-x-0 opacity-100"
                  : step > 1
                    ? "-translate-x-full opacity-0"
                    : "translate-x-full opacity-0"
              }`}
            >
              <div className="space-y-4">
                <div className="text-center space-y-1">
                  <h3 className="text-xl font-semibold">Pick a server</h3>
                  <p className="text-sm text-muted-foreground">
                    Sign up on any server — your account works with Moim and the
                    entire Fediverse.
                  </p>
                </div>

                <div className="space-y-3">
                  {recommendedInstances.length > 0 && (
                    <div className="space-y-1.5">
                      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                        Recommended for you
                      </p>
                      <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-thin">
                        {recommendedInstances.map((inst) => (
                          <InstanceCard key={inst.domain} instance={inst} />
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="space-y-1.5">
                    {recommendedInstances.length > 0 && (
                      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                        All servers
                      </p>
                    )}
                    <MarqueeRow
                      instances={
                        recommendedInstances.length > 0
                          ? otherInstances
                          : sortedInstances
                      }
                      direction="right"
                      duration={30}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Step 3: How sign-in works */}
            <div
              ref={(el) => { panelRefs.current[2] = el; }}
              className={`absolute inset-x-0 top-0 transition-all duration-300 ease-out ${
                step === 2
                  ? "translate-x-0 opacity-100"
                  : step > 2
                    ? "-translate-x-full opacity-0"
                    : "translate-x-full opacity-0"
              }`}
            >
              <div className="space-y-6">
                <div className="text-center space-y-1">
                  <h3 className="text-xl font-semibold">How sign-in works</h3>
                  <p className="text-sm text-muted-foreground">
                    Moim uses an emoji poll to verify your identity — no
                    passwords needed.
                  </p>
                </div>

                <div className="space-y-4 max-w-sm mx-auto">
                  {[
                    {
                      num: "1",
                      title: "Enter your handle",
                      desc: "Type your Fediverse handle (e.g. @you@mastodon.social)",
                    },
                    {
                      num: "2",
                      title: "Check your DMs",
                      desc: "We send an emoji poll to your Fediverse account",
                    },
                    {
                      num: "3",
                      title: "Vote on the emojis",
                      desc: "Select the highlighted emojis to prove it's you",
                    },
                    {
                      num: "4",
                      title: "You're in!",
                      desc: "That's it — no passwords, no email verification",
                    },
                  ].map((item) => (
                    <div key={item.num} className="flex gap-4 items-start">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-foreground text-background text-sm font-semibold">
                        {item.num}
                      </div>
                      <div>
                        <p className="font-medium text-sm">{item.title}</p>
                        <p className="text-sm text-muted-foreground">
                          {item.desc}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="text-center pt-2">
                  <Button asChild size="lg">
                    <Link to="/auth/signin" search={{ from: "onboarding" }}>
                      Sign in now
                    </Link>
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </CardContent>

        {/* Navigation buttons */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-[#f0f0f0]">
          <Button
            variant="ghost"
            size="sm"
            onClick={prev}
            className={step === 0 ? "invisible" : ""}
          >
            ← Back
          </Button>
          {step < TOTAL_STEPS - 1 ? (
            <Button size="sm" onClick={next}>
              Next →
            </Button>
          ) : (
            <Button size="sm" asChild>
              <Link to="/auth/signin" search={{ from: "onboarding" }}>
                Sign in →
              </Link>
            </Button>
          )}
        </div>

        <CardFooter className="justify-center">
          <p className="text-sm text-muted-foreground">
            Already have an account?{" "}
            <Link
              to="/auth/signin"
              search={{ from: "onboarding" }}
              className="underline hover:text-muted-foreground"
            >
              Sign in
            </Link>
          </p>
        </CardFooter>
      </Card>
    </main>
  );
}

function InstanceCard({
  instance,
}: {
  instance: (typeof INSTANCES)[number];
}) {
  return (
    <a
      href={getSignUpUrl(instance)}
      target="_blank"
      rel="noopener noreferrer"
      className="flex shrink-0 items-center gap-3 rounded-lg border bg-card px-4 py-3 hover:bg-accent transition-colors"
    >
      <div className="min-w-0">
        <p className="font-medium text-sm whitespace-nowrap">
          {instance.domain}
        </p>
        <p className="text-xs text-muted-foreground whitespace-nowrap">
          {instance.description}
        </p>
      </div>
      <Badge variant="secondary" className="shrink-0 text-[10px]">
        {instance.software}
      </Badge>
    </a>
  );
}

function MarqueeRow({
  instances,
  direction,
  duration,
}: {
  instances: (typeof INSTANCES)[number][];
  direction: "left" | "right";
  duration: number;
}) {
  const animationName =
    direction === "left" ? "marquee-left" : "marquee-right";

  return (
    <div className="relative overflow-hidden">
      <style>{`
        @keyframes marquee-left {
          from { transform: translateX(0); }
          to { transform: translateX(-50%); }
        }
        @keyframes marquee-right {
          from { transform: translateX(-50%); }
          to { transform: translateX(0); }
        }
      `}</style>
      <div
        className="flex gap-3 w-max hover:[animation-play-state:paused]"
        style={{
          animation: `${animationName} ${duration}s linear infinite`,
        }}
      >
        {/* Duplicate the list for seamless looping */}
        {[...instances, ...instances].map((inst, i) => (
          <InstanceCard key={`${inst.domain}-${i}`} instance={inst} />
        ))}
      </div>
    </div>
  );
}
