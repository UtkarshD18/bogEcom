"use client";

import { MdCloudUpload, MdDelete, MdInsertDriveFile } from "react-icons/md";

const BlogHtmlImportPanel = ({
  contentHtml,
  contentHtmlFileName,
  importSummary,
  selectedPreviewImage = "",
  manualPreviewImage = "",
  manualPreviewFileName = "",
  onSelectPreviewImage,
  onManualPreviewFileChange,
  onClearManualPreview,
  onFileChange,
  onClear,
}) => {
  const bodyCharacterCount = Number(importSummary?.plainText?.length || 0);
  const imageCandidates = Array.isArray(importSummary?.imageCandidates)
    ? importSummary.imageCandidates
    : [];
  const hasManualPreview = Boolean(String(manualPreviewImage || "").trim());
  const hasSelectedRemoteCustomPreview =
    Boolean(String(selectedPreviewImage || "").trim()) &&
    !hasManualPreview &&
    !imageCandidates.includes(selectedPreviewImage);

  return (
    <div className="rounded-2xl border border-amber-200 bg-amber-50/70 p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">
            Import Full Blog HTML File
          </h3>
          <p className="mt-1 max-w-3xl text-sm leading-6 text-gray-600">
            Upload a complete `.html` blog file when you want to preserve the external layout, inline styles, and long-form article structure. We will render it as a standalone article frame on the site.
          </p>
        </div>

        {contentHtml ? (
          <button
            type="button"
            onClick={onClear}
            className="inline-flex items-center gap-2 rounded-xl border border-red-200 bg-white px-4 py-2 text-sm font-medium text-red-600 transition hover:bg-red-50"
          >
            <MdDelete size={18} />
            Remove HTML File
          </button>
        ) : null}
      </div>

      <div className="mt-5 rounded-2xl border-2 border-dashed border-amber-300 bg-white/90 p-6 text-center">
        <input
          type="file"
          accept=".html,text/html"
          className="hidden"
          id="blogHtmlImport"
          onChange={onFileChange}
        />
        <label htmlFor="blogHtmlImport" className="cursor-pointer">
          <MdCloudUpload size={42} className="mx-auto text-amber-500" />
          <p className="mt-2 font-medium text-gray-800">
            {contentHtml ? "Replace imported blog HTML" : "Choose a blog HTML file"}
          </p>
          <p className="mt-1 text-xs text-gray-500">
            Accepts complete `.html` documents with inline CSS and linked fonts.
          </p>
        </label>
      </div>

      {contentHtml ? (
        <div className="mt-5 space-y-4">
          <div className="grid gap-4 md:grid-cols-3">
            <div className="rounded-2xl border border-gray-200 bg-white p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-500">
                File
              </p>
              <div className="mt-2 flex items-start gap-3">
                <MdInsertDriveFile size={22} className="mt-0.5 text-amber-500" />
                <p className="text-sm font-medium text-gray-800">
                  {contentHtmlFileName || "Imported HTML document"}
                </p>
              </div>
            </div>

            <div className="rounded-2xl border border-gray-200 bg-white p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-500">
                HTML Title
              </p>
              <p className="mt-2 text-sm font-medium text-gray-800">
                {importSummary?.documentTitle || "No <title> found"}
              </p>
            </div>

            <div className="rounded-2xl border border-gray-200 bg-white p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-500">
                Extracted Text
              </p>
              <p className="mt-2 text-sm font-medium text-gray-800">
                {bodyCharacterCount.toLocaleString()} characters
              </p>
            </div>
          </div>

          {importSummary?.excerpt ? (
            <div className="rounded-2xl border border-gray-200 bg-white p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-500">
                Imported Summary
              </p>
              <p className="mt-2 text-sm leading-6 text-gray-700">
                {importSummary.excerpt}
              </p>
            </div>
          ) : null}

          <div className="rounded-2xl border border-gray-200 bg-white p-4">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-500">
                  Suggested Preview Images
                </p>
                <p className="mt-1 text-sm text-gray-600">
                  Pick one from the HTML, or upload your own local cover image for blog cards and article previews.
                </p>
              </div>
              {selectedPreviewImage || hasManualPreview ? (
                <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
                  Preview selected
                </span>
              ) : null}
            </div>

            <div className="mb-4 rounded-2xl border border-dashed border-amber-300 bg-amber-50/60 p-4">
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div>
                  <p className="text-sm font-semibold text-gray-800">
                    Upload Manual Preview Image
                  </p>
                  <p className="mt-1 text-xs text-gray-500">
                    Use a local JPG, PNG, WEBP, or GIF when the imported HTML images are broken or not ideal for the blog card.
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <input
                    type="file"
                    accept="image/*,.gif"
                    className="hidden"
                    id="blogHtmlManualPreviewImage"
                    onChange={onManualPreviewFileChange}
                  />
                  <label
                    htmlFor="blogHtmlManualPreviewImage"
                    className="inline-flex cursor-pointer items-center gap-2 rounded-xl bg-white px-4 py-2 text-sm font-medium text-amber-700 shadow-sm transition hover:bg-amber-100"
                  >
                    <MdCloudUpload size={18} />
                    Choose image
                  </label>
                  {hasManualPreview ? (
                    <button
                      type="button"
                      onClick={onClearManualPreview}
                      className="inline-flex items-center gap-2 rounded-xl border border-red-200 bg-white px-4 py-2 text-sm font-medium text-red-600 transition hover:bg-red-50"
                    >
                      <MdDelete size={18} />
                      Clear manual image
                    </button>
                  ) : null}
                </div>
              </div>

              {hasManualPreview || hasSelectedRemoteCustomPreview ? (
                <div className="mt-4 max-w-sm overflow-hidden rounded-2xl border border-emerald-300 shadow-sm shadow-emerald-100">
                  <div className="aspect-[16/9] overflow-hidden bg-slate-100">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={hasManualPreview ? manualPreviewImage : selectedPreviewImage}
                      alt="Custom blog preview"
                      className="h-full w-full object-cover"
                    />
                  </div>
                  <div className="bg-white px-3 py-2">
                    <p className="text-xs font-semibold text-emerald-700">
                      {hasManualPreview
                        ? "Manual image selected"
                        : "Custom preview selected"}
                    </p>
                    <p className="mt-1 line-clamp-2 text-xs text-gray-500">
                      {hasManualPreview
                        ? manualPreviewFileName || "Local uploaded preview image"
                        : selectedPreviewImage}
                    </p>
                  </div>
                </div>
              ) : null}
            </div>

            {imageCandidates.length > 0 ? (
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {imageCandidates.slice(0, 6).map((candidate) => {
                  const isSelected =
                    candidate === selectedPreviewImage && !hasManualPreview;
                  return (
                    <button
                      key={candidate}
                      type="button"
                      onClick={() => onSelectPreviewImage?.(candidate)}
                      className={`overflow-hidden rounded-2xl border text-left transition ${
                        isSelected
                          ? "border-emerald-400 shadow-sm shadow-emerald-100"
                          : "border-gray-200 hover:border-amber-300"
                      }`}
                    >
                      <div className="aspect-[16/9] overflow-hidden bg-slate-100">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={candidate}
                          alt="Suggested blog preview"
                          className="h-full w-full object-cover"
                        />
                      </div>
                      <div className="px-3 py-2">
                        <p className="line-clamp-2 text-xs text-gray-500">
                          {candidate}
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="rounded-2xl bg-slate-50 px-4 py-5 text-sm text-slate-500">
                No usable images were extracted from this HTML file yet. You can still upload a manual preview image above.
              </div>
            )}
          </div>

          <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
            <div className="border-b border-gray-200 px-4 py-3 text-sm font-medium text-gray-700">
              HTML Preview
            </div>
            <iframe
              title="Imported blog HTML preview"
              srcDoc={contentHtml}
              className="h-[520px] w-full bg-white"
            />
          </div>
        </div>
      ) : null}
    </div>
  );
};

export default BlogHtmlImportPanel;
