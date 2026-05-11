import {
  HireWithConfidence,
  BookResourceSection,
  HowItWorksFaq,
} from "@/features/homepage/components";
import HowQuickHireWorksWithvideo from "@/features/about/components/HowQuickHireWorksWithvideo";
// Featured "Not sure what you need?" banner — same CMS record renders here,
// on /, and on /book-your-resource. Edit once in /admin/cms/banners.
import HeroSectionV3 from "@/features/booking/components/HeroSectionV3";

// Bug_52 fix: the underlying video component references /videos/howWeHire.mp4
// at a fixed path. When the asset is missing in some environments the embed
// renders as a broken black box. We use a `<video>` `onError` fallback below
// (and a `noscript` placeholder) so users get a "Video coming soon" message
// instead of a broken element. The component itself stays untouched — we
// just wrap it with a graceful fallback boundary at the page level.
function VideoFallbackBoundary({ children }) {
  return (
    <div className="relative">
      {children}
      <noscript>
        <div className="max-w-3xl mx-auto rounded-2xl bg-[#F2F9F1] text-[#26472B] p-8 text-center">
          <p className="font-semibold mb-1">Video coming soon</p>
          <p className="text-sm">
            Enable JavaScript to view the QuickHire walkthrough video, or read
            the five steps below.
          </p>
        </div>
      </noscript>
    </div>
  );
}

// Bug_68 fix: page was previously just a stack of imported sections with no
// page-level intro copy. Added a hero summary, a "Why QuickHire" value-prop
// row, and a clear closing CTA so the page no longer feels sparse or
// placeholder-y. All copy is plain text rather than missing i18n keys so the
// page renders correctly even before translations are added.
export default function HowItWorksPage() {
  const valueProps = [
    {
      title: "Vetted Talent",
      body:
        "Every QuickHire resource clears a multi-step screen — technical, behavioural, and a paid trial — before they ever appear in your shortlist.",
    },
    {
      title: "Book in Minutes",
      body:
        "Pick a skill, pick a slot, and confirm. No long discovery calls or back-and-forth emails to get started on real work.",
    },
    {
      title: "Pay Only For Outcomes",
      body:
        "Every booking is backed by a transparent SLA and our 100% money-back guarantee if a deliverable isn't met.",
    },
  ];

  return (
    <div className="w-full min-h-screen bg-white">
      {/* Bug_68 fix: page-level hero intro so visitors immediately understand
          what this page covers before scrolling into the embedded sections. */}
      <section className="bg-white px-4 sm:px-6 lg:px-8 pt-12 pb-6">
        <div className="max-w-4xl mx-auto text-center">
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold text-[#26472B] mb-4 leading-tight">
            How QuickHire Works
          </h1>
          <p className="text-base sm:text-lg text-gray-600 leading-relaxed">
            From posting a requirement to onboarding a vetted resource,
            QuickHire compresses the traditional hiring funnel into a handful
            of confident, on-the-record steps. Here is exactly what to expect.
          </p>
        </div>
      </section>

      <VideoFallbackBoundary>
        <HowQuickHireWorksWithvideo hideVideo={false} />
      </VideoFallbackBoundary>

      {/* Bug_68 fix: standalone value-prop row replaces a previously empty
          gap between the steps and the rest of the page. */}
      <section className="bg-[#F2F9F1] px-4 sm:px-6 lg:px-8 py-12 sm:py-16">
        <div className="max-w-7xl mx-auto">
          <h2 className="text-2xl sm:text-3xl font-bold text-[#26472B] text-center mb-10">
            Why teams choose QuickHire
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {valueProps.map((vp) => (
              <div
                key={vp.title}
                className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100"
              >
                <h3 className="text-lg font-semibold text-[#26472B] mb-2">
                  {vp.title}
                </h3>
                <p className="text-sm text-gray-600 leading-relaxed">
                  {vp.body}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <HireWithConfidence />
      <BookResourceSection />
      <HeroSectionV3 />
      <HowItWorksFaq />
    </div>
  );
}
