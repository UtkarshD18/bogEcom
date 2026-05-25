"use client";

const DESKTOP_TRUST_ITEMS = [
  "100% Natural",
  "No Palm Oil",
  "High Protein",
  "Fast Moving Picks",
];

const MOBILE_TRUST_ITEMS = ["Natural", "Protein", "Fast Moving"];

const getTimerPositionClass = (position, isMobile = false) => {
  switch (position) {
    case "top-left":
      return isMobile ? "left-3 top-3" : "left-4 top-4";
    case "bottom-left":
      return isMobile ? "bottom-3 left-3" : "bottom-4 left-4";
    case "bottom-right":
      return isMobile ? "bottom-3 right-3" : "bottom-4 right-4";
    case "top-right":
    default:
      return isMobile ? "right-3 top-3" : "right-4 top-4";
  }
};

const PreviewMedia = ({
  src,
  title,
  scale = 1,
  positionX = 50,
  positionY = 50,
  background = "#f5f5f5",
}) => (
  <div className="absolute inset-0" style={{ backgroundColor: background }}>
    {src ? (
      <>
        <div
          aria-hidden="true"
          className="absolute inset-0 scale-110 bg-cover bg-center opacity-60 blur-2xl"
          style={{ backgroundImage: `url("${src}")` }}
        />
        <img
          src={src}
          alt={title || "Home slide preview"}
          className="absolute inset-0 h-full w-full object-cover"
          style={{
            objectPosition: `${positionX}% ${positionY}%`,
            transform: `scale(${scale})`,
          }}
        />
      </>
    ) : (
      <div className="absolute inset-0 flex items-center justify-center bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.95),rgba(226,232,240,0.9))] text-center text-sm font-medium text-slate-500">
        Upload an image to preview framing
      </div>
    )}
    <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(15,23,42,0.72)_0%,rgba(15,23,42,0.26)_52%,rgba(15,23,42,0.16)_100%),linear-gradient(180deg,rgba(15,23,42,0.02)_0%,rgba(15,23,42,0.24)_100%)]" />
  </div>
);

const PreviewCopy = ({
  title,
  subtitle,
  buttonText,
  offerEnabled,
  offerBadgeText,
  offerTimerPosition,
  isMobile = false,
}) => {
  const resolvedTitle = String(title || "").trim() || "Slide title preview";
  const resolvedSubtitle =
    String(subtitle || "").trim() || "Subtitle and hero copy will appear here.";
  const resolvedButton = String(buttonText || "").trim() || "Shop now";

  return (
    <>
      {offerEnabled ? (
        <div
          className={`absolute z-20 ${getTimerPositionClass(
            offerTimerPosition,
            isMobile,
          )}`}
        >
          <div className="rounded-full border border-white/20 bg-black/45 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.18em] text-white shadow-lg backdrop-blur-md">
            {offerBadgeText || "Offer ends in"}
          </div>
        </div>
      ) : null}

      <div
        className={`absolute left-0 z-20 flex h-full ${
          isMobile ? "w-full items-end p-3" : "max-w-[58%] items-center p-5"
        }`}
      >
        <div
          className={`rounded-2xl border border-white/12 bg-[rgba(15,23,42,0.34)] text-white shadow-[0_18px_50px_rgba(15,23,42,0.26)] backdrop-blur-sm ${
            isMobile ? "w-full p-3" : "max-w-[320px] p-4"
          }`}
        >
          <p
            className={`font-black tracking-[-0.04em] ${
              isMobile ? "text-base leading-5" : "text-2xl leading-7"
            }`}
          >
            {resolvedTitle}
          </p>
          <p
            className={`mt-2 text-white/82 ${
              isMobile ? "line-clamp-2 text-[11px] leading-4" : "line-clamp-3 text-sm leading-5"
            }`}
          >
            {resolvedSubtitle}
          </p>
          <div
            className={`mt-3 inline-flex items-center rounded-full bg-white px-3 py-1.5 font-semibold text-[#24150f] ${
              isMobile ? "text-[11px]" : "text-xs"
            }`}
          >
            {resolvedButton}
          </div>
        </div>
      </div>
    </>
  );
};

const HomeSlideFramePreview = ({
  title = "",
  subtitle = "",
  buttonText = "",
  desktopAsset = null,
  mobileAsset = null,
  frameSettings = {},
  offerEnabled = false,
  offerBadgeText = "",
  offerTimerPosition = "top-right",
}) => {
  const desktopPreviewSrc = desktopAsset?.preview || "";
  const mobilePreviewSrc = mobileAsset?.preview || desktopPreviewSrc;
  const mobileUsesDesktopFallback = !mobileAsset?.preview && Boolean(desktopPreviewSrc);

  return (
    <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-[16px] font-semibold text-slate-800">
            Live Slide Preview
          </h3>
          <p className="mt-1 max-w-3xl text-sm text-slate-500">
            This mock shows how the hero framing behaves inside a desktop storefront container and a small phone layout. Drag the zoom and focus sliders below to see the crop update in real time.
          </p>
        </div>
        {mobileUsesDesktopFallback ? (
          <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700">
            Mobile preview is using the desktop image fallback
          </span>
        ) : null}
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_280px]">
        <div className="rounded-[26px] border border-slate-200 bg-[linear-gradient(180deg,#f8fafc_0%,#eef2f7_100%)] p-3 shadow-[0_24px_60px_rgba(15,23,42,0.08)]">
          <div className="mb-3 flex items-center gap-2 px-2">
            <span className="h-2.5 w-2.5 rounded-full bg-rose-400" />
            <span className="h-2.5 w-2.5 rounded-full bg-amber-400" />
            <span className="h-2.5 w-2.5 rounded-full bg-emerald-400" />
            <div className="ml-3 h-8 flex-1 rounded-full border border-slate-200 bg-white/90 px-4 text-xs leading-8 text-slate-400">
              healthyonegram.com
            </div>
          </div>

          <div className="overflow-hidden rounded-[22px] border border-white/70 bg-white shadow-[0_18px_45px_rgba(15,23,42,0.08)]">
            <div className="relative aspect-video overflow-hidden">
              <PreviewMedia
                src={desktopPreviewSrc}
                title={title}
                scale={frameSettings.desktopImageScale}
                positionX={frameSettings.desktopImagePositionX}
                positionY={frameSettings.desktopImagePositionY}
              />
              <PreviewCopy
                title={title}
                subtitle={subtitle}
                buttonText={buttonText}
                offerEnabled={offerEnabled}
                offerBadgeText={offerBadgeText}
                offerTimerPosition={offerTimerPosition}
              />
            </div>
            <div className="relative z-20 -mt-5 px-4 pb-4 md:-mt-6">
              <div className="mx-auto w-full max-w-[760px] rounded-[1.4rem] border border-white/16 bg-[rgba(18,12,9,0.78)] px-2.5 py-3 text-white/88 shadow-[0_18px_55px_rgba(0,0,0,0.22)] backdrop-blur-xl md:max-w-fit md:rounded-full md:px-4">
                <div className="flex items-center gap-1 overflow-x-auto whitespace-nowrap [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden md:flex-wrap md:justify-center md:gap-2 md:overflow-visible">
                  {DESKTOP_TRUST_ITEMS.map((item) => (
                    <span
                      key={item}
                      className="rounded-full bg-white/10 px-2.5 py-1.5 text-[8px] font-extrabold uppercase tracking-[0.12em] text-white/90 sm:px-4 sm:py-2 sm:text-[11px] sm:tracking-[0.2em]"
                    >
                      {item}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="flex justify-center xl:justify-end">
          <div className="rounded-[2rem] border-[10px] border-slate-950 bg-slate-950 p-2 shadow-[0_24px_60px_rgba(15,23,42,0.18)]">
            <div className="mx-auto mb-2 h-5 w-24 rounded-full bg-slate-800" />
            <div className="w-[230px] overflow-hidden rounded-[1.45rem] bg-[#f8fafc]">
              <div className="flex items-center justify-between px-3 py-3">
                <div className="h-2.5 w-6 rounded-full bg-slate-300" />
                <div className="h-7 w-7 rounded-full bg-white shadow-sm" />
                <div className="flex gap-2">
                  <div className="h-4 w-4 rounded-full bg-slate-200" />
                  <div className="h-4 w-4 rounded-full bg-slate-200" />
                </div>
              </div>
              <div className="px-3 pb-3">
                <div className="mb-2 h-9 rounded-full bg-white px-4 text-xs leading-9 text-slate-400 shadow-sm">
                  Search for anything...
                </div>
                <div className="overflow-hidden rounded-[1.35rem] border border-white/70 bg-white shadow-sm">
                  <div className="relative aspect-video overflow-hidden">
                    <PreviewMedia
                      src={mobilePreviewSrc}
                      title={title}
                      scale={frameSettings.mobileImageScale}
                      positionX={frameSettings.mobileImagePositionX}
                      positionY={frameSettings.mobileImagePositionY}
                    />
                    <PreviewCopy
                      title={title}
                      subtitle={subtitle}
                      buttonText={buttonText}
                      offerEnabled={offerEnabled}
                      offerBadgeText={offerBadgeText}
                      offerTimerPosition={offerTimerPosition}
                      isMobile
                    />
                  </div>
                </div>
                <div className="relative z-20 -mt-3 px-2 pb-3">
                  <div className="mx-auto w-fit max-w-full rounded-full border border-white/16 bg-[rgba(18,12,9,0.82)] px-2 py-2 text-white/88 shadow-[0_12px_32px_rgba(0,0,0,0.18)] backdrop-blur-xl">
                    <div className="flex items-center gap-1 overflow-x-auto whitespace-nowrap [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
                      {MOBILE_TRUST_ITEMS.map((item) => (
                        <span
                          key={item}
                          className="rounded-full bg-white/10 px-2.5 py-1 text-[9px] font-extrabold uppercase tracking-[0.1em] text-white/90"
                        >
                          {item}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default HomeSlideFramePreview;
