import { LeadForm } from "@/components/lead-form";
import { LandingBackgroundVideo } from "@/components/landing-background-video";
import { getLandingSettings } from "@/lib/landing";

export const dynamic = "force-dynamic";

export default async function Home() {
  const landing = await getLandingSettings();

  return (
    <main className="relative min-h-screen overflow-hidden bg-neutral-950 text-white">
      <LandingBackgroundVideo
        fit={landing.videoFit}
        playbackRate={landing.playbackRate}
        position={landing.videoPosition}
        posterUrl={landing.posterUrl}
        videoUrl={landing.videoUrl}
      />
      <div className="absolute inset-0" style={{ backgroundColor: landing.overlayColor, opacity: landing.overlayOpacity }} />

      <header className="absolute left-0 right-0 top-0 z-20 px-4 py-3 md:px-10 md:py-5 lg:px-12" style={{ backgroundColor: landing.headerColor }}>
        <div className="mx-auto flex max-w-7xl justify-end">
          {landing.logoUrl ? (
            <img
              alt={landing.logoAlt}
              className="h-auto w-auto"
              src={landing.logoUrl}
              style={{ height: landing.logoHeight, maxHeight: "clamp(32px, 10vw, 56px)" }}
            />
          ) : null}
        </div>
      </header>

      <section className="relative z-10 mx-auto grid min-h-screen w-full max-w-7xl items-center gap-5 px-4 pb-5 pt-20 sm:gap-7 sm:px-6 md:grid-cols-[1.05fr_.95fr] md:gap-10 md:px-10 md:py-10 lg:px-12">
        <div className="max-w-2xl text-left">
          {landing.heroTopMode === "logo" && landing.heroLogoUrl ? (
            <img
              alt={landing.heroLogoAlt}
              className="mb-3 block h-auto max-w-[150px] sm:max-w-[190px] md:mb-6 md:max-w-[260px]"
              src={landing.heroLogoUrl}
              style={{
                opacity: landing.heroLogoOpacity,
                transform: `scale(${landing.heroLogoScale})`,
                transformOrigin: "left center",
              }}
            />
          ) : (
            <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#d8bd85] md:mb-5 md:text-sm md:tracking-[0.26em]">
              {landing.eyebrow}
            </p>
          )}
          <h1 className="max-w-[12ch] text-[30px] font-semibold leading-[1.02] tracking-normal sm:max-w-xl sm:text-4xl md:text-5xl lg:text-7xl">
            {landing.headline}
          </h1>
          <p className="mt-3 max-w-md text-left text-[15px] leading-6 text-white/82 sm:text-base md:mt-6 md:max-w-xl md:text-xl md:leading-8">
            {landing.subheadline}
          </p>
        </div>

        <div className="flex min-w-0 justify-start md:justify-end">
          <LeadForm settings={landing} />
        </div>
      </section>
    </main>
  );
}
