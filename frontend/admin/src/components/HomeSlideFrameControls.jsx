"use client";

const FRAME_GROUPS = [
  {
    key: "desktop",
    title: "Desktop Frame",
    description:
      "Tune how the desktop hero image fills the fixed 16:9 frame.",
    scaleKey: "desktopImageScale",
    xKey: "desktopImagePositionX",
    yKey: "desktopImagePositionY",
  },
  {
    key: "mobile",
    title: "Mobile Frame",
    description:
      "Tune how the mobile hero image fills the same 16:9 frame on phones.",
    scaleKey: "mobileImageScale",
    xKey: "mobileImagePositionX",
    yKey: "mobileImagePositionY",
  },
];

const HomeSlideFrameControls = ({ values, onChange }) => (
  <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50/70 p-5">
    <div className="mb-4">
      <h3 className="text-[16px] font-semibold text-slate-800">
        Image Framing
      </h3>
      <p className="mt-1 text-sm text-slate-500">
        Use zoom and focus controls so each slide fills the frame cleanly
        without leaving visible side gaps.
      </p>
    </div>

    <div className="grid gap-5 lg:grid-cols-2">
      {FRAME_GROUPS.map((group) => {
        const scaleValue = Number(values?.[group.scaleKey] || 1);
        const xValue = Number(values?.[group.xKey] || 50);
        const yValue = Number(values?.[group.yKey] || 50);

        return (
          <div
            key={group.key}
            className="rounded-2xl border border-white bg-white p-4 shadow-sm"
          >
            <div className="mb-4">
              <h4 className="text-sm font-semibold text-slate-800">
                {group.title}
              </h4>
              <p className="mt-1 text-xs leading-5 text-slate-500">
                {group.description}
              </p>
            </div>

            <div className="space-y-4">
              <label className="block">
                <div className="mb-1 flex items-center justify-between text-xs font-medium text-slate-600">
                  <span>Zoom</span>
                  <span>{Math.round(scaleValue * 100)}%</span>
                </div>
                <input
                  type="range"
                  min="1"
                  max="1.4"
                  step="0.01"
                  value={scaleValue}
                  onChange={(event) =>
                    onChange(group.scaleKey, Number(event.target.value))
                  }
                  className="w-full accent-blue-600"
                />
              </label>

              <label className="block">
                <div className="mb-1 flex items-center justify-between text-xs font-medium text-slate-600">
                  <span>Horizontal focus</span>
                  <span>{xValue}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  step="1"
                  value={xValue}
                  onChange={(event) =>
                    onChange(group.xKey, Number(event.target.value))
                  }
                  className="w-full accent-blue-600"
                />
              </label>

              <label className="block">
                <div className="mb-1 flex items-center justify-between text-xs font-medium text-slate-600">
                  <span>Vertical focus</span>
                  <span>{yValue}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  step="1"
                  value={yValue}
                  onChange={(event) =>
                    onChange(group.yKey, Number(event.target.value))
                  }
                  className="w-full accent-blue-600"
                />
              </label>
            </div>
          </div>
        );
      })}
    </div>
  </div>
);

export default HomeSlideFrameControls;
