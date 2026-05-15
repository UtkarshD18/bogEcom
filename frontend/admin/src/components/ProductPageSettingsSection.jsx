"use client";

import { uploadFile } from "@/utils/api";
import Switch from "@mui/material/Switch";
import { useEffect, useState } from "react";

const sectionCardClass = "rounded-xl border border-gray-200 bg-gray-50 p-5";
const inputClass =
  "w-full h-[40px] rounded-md border border-[rgba(0,0,0,0.2)] bg-white px-3 text-[14px] outline-none focus:border-blue-500";
const textAreaClass =
  "w-full rounded-md border border-[rgba(0,0,0,0.2)] bg-white px-3 py-3 text-[14px] outline-none focus:border-blue-500";

const ToggleField = ({ label, checked, onChange, hint }) => (
  <div className="rounded-lg border border-gray-200 bg-white px-4 py-3">
    <div className="flex items-start justify-between gap-3">
      <div>
        <p className="text-sm font-medium text-gray-800">{label}</p>
        {hint ? <p className="mt-1 text-xs text-gray-500">{hint}</p> : null}
      </div>
      <Switch
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
      />
    </div>
  </div>
);

const TextField = ({ label, value, onChange, placeholder }) => (
  <label className="flex flex-col gap-1">
    <span className="text-sm font-medium text-gray-800">{label}</span>
    <input
      type="text"
      value={value}
      onChange={(event) => onChange(event.target.value)}
      placeholder={placeholder}
      className={inputClass}
    />
  </label>
);

const TextAreaField = ({
  label,
  value,
  onChange,
  onBlur,
  placeholder,
  rows = 3,
  hint,
  enableParagraphShortcuts = false,
}) => (
  <label className="flex flex-col gap-1">
    <span className="text-sm font-medium text-gray-800">{label}</span>
    <textarea
      value={value}
      onChange={(event) => onChange(event.target.value)}
      onBlur={onBlur}
      onKeyDown={(event) => {
        if (!enableParagraphShortcuts || event.key !== "Enter") return;
        event.preventDefault();
        const textarea = event.currentTarget;
        const insert = event.shiftKey ? "\n" : "\n\n";
        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        const nextValue =
          textarea.value.slice(0, start) + insert + textarea.value.slice(end);
        onChange(nextValue);
        const nextPos = start + insert.length;
        textarea.selectionStart = nextPos;
        textarea.selectionEnd = nextPos;
      }}
      placeholder={placeholder}
      rows={rows}
      className={textAreaClass}
    />
    {hint ? <span className="text-xs text-gray-500">{hint}</span> : null}
  </label>
);

const toLines = (value) =>
  Array.isArray(value) ? value.filter(Boolean).join("\n") : "";

const fromLines = (value) =>
  String(value || "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

const toParagraphText = (value) =>
  Array.isArray(value) ? value.filter(Boolean).join("\n\n") : "";

const fromParagraphText = (value) =>
  String(value || "")
    .split(/\r?\n\s*\r?\n/)
    .map((paragraph) =>
      paragraph
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean)
        .join(" ")
        .trim(),
    )
    .filter(Boolean);

export default function ProductPageSettingsSection({
  productPage,
  setProductPage,
  token = null,
  pageTitle = "Storefront Product Page",
  storefrontPath = "/product/[id]",
  entityLabel = "product",
  lowerSectionLabel = "product",
}) {
  const [bannerUploading, setBannerUploading] = useState(false);
  const [extraParagraphDraft, setExtraParagraphDraft] = useState(
    toParagraphText(productPage.descriptionSection.extraParagraphs),
  );
  const [shippingPointsDraft, setShippingPointsDraft] = useState(
    toLines(productPage.shippingSection.points),
  );
  const [reasonsParagraphDraft, setReasonsParagraphDraft] = useState(
    toParagraphText(productPage.shippingSection.reasonsParagraphs),
  );

  useEffect(() => {
    setExtraParagraphDraft(
      toParagraphText(productPage.descriptionSection.extraParagraphs),
    );
  }, [productPage.descriptionSection.extraParagraphs]);

  useEffect(() => {
    setShippingPointsDraft(toLines(productPage.shippingSection.points));
  }, [productPage.shippingSection.points]);

  useEffect(() => {
    setReasonsParagraphDraft(
      toParagraphText(productPage.shippingSection.reasonsParagraphs),
    );
  }, [productPage.shippingSection.reasonsParagraphs]);

  const updateSectionField = (section, field, nextValue) => {
    setProductPage((current) => ({
      ...current,
      [section]: {
        ...current[section],
        [field]: nextValue,
      },
    }));
  };

  const updateNestedArrayItemField = (
    section,
    arrayField,
    index,
    field,
    nextValue,
  ) => {
    setProductPage((current) => {
      const currentItems = Array.isArray(current?.[section]?.[arrayField])
        ? current[section][arrayField]
        : [];
      const nextItems = [...currentItems];
      nextItems[index] = {
        ...(nextItems[index] || {}),
        [field]: nextValue,
      };

      return {
        ...current,
        [section]: {
          ...current[section],
          [arrayField]: nextItems,
        },
      };
    });
  };

  const handleBannerUpload = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      alert("Image size should be less than 5MB");
      return;
    }
    setBannerUploading(true);
    try {
      const result = await uploadFile(file, token);
      if (result?.success && result?.data?.url) {
        updateSectionField(
          "descriptionSection",
          "featuredBannerImage",
          result.data.url,
        );
      } else {
        alert(result?.message || "Failed to upload banner image");
      }
    } finally {
      setBannerUploading(false);
      event.target.value = "";
    }
  };

  return (
    <div className="mt-8 space-y-5">
      <div>
        <h3 className="text-[18px] font-semibold text-gray-800">{pageTitle}</h3>
        <p className="mt-1 text-sm text-gray-500">
          Control section visibility and supporting copy for the live `
          {storefrontPath}` page from admin.
        </p>
      </div>

      <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
        Changes here update the real client {entityLabel} page layout, including
        the review section shown below the {lowerSectionLabel} details.
      </div>

      <div className={sectionCardClass}>
        <div className="mb-4">
          <h4 className="text-[16px] font-semibold text-gray-800">
            Hero And Top Blocks
          </h4>
          <p className="text-sm text-gray-500">
            Manage the story card, generated info cards, delivery preview, and
            trust cards near the buy box.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
          <ToggleField
            label="Show Story Card"
            checked={productPage.hero.showStoryCard}
            onChange={(nextValue) =>
              updateSectionField("hero", "showStoryCard", nextValue)
            }
          />
          <ToggleField
            label="Show Insight Cards"
            checked={productPage.hero.showInsightCards}
            onChange={(nextValue) =>
              updateSectionField("hero", "showInsightCards", nextValue)
            }
          />
          <ToggleField
            label="Show Delivery Preview"
            checked={productPage.hero.showDeliveryPreview}
            onChange={(nextValue) =>
              updateSectionField("hero", "showDeliveryPreview", nextValue)
            }
          />
          <ToggleField
            label="Show Trust Cards"
            checked={productPage.hero.showSupportCards !== false}
            onChange={(nextValue) =>
              updateSectionField("hero", "showSupportCards", nextValue)
            }
          />
        </div>

        <div className="mt-5 rounded-lg border border-gray-200 bg-white p-4">
          <div className="mb-4">
            <h5 className="text-sm font-semibold text-gray-800">
              Story Card
            </h5>
            <p className="text-xs text-gray-500">
              Every visible line in the story card can be controlled here.
              Leave any field blank to hide it. If description is blank, the
              product&apos;s main Product Story text is used instead.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <TextField
              label="Story Eyebrow"
              value={productPage.hero.storyEyebrow}
              onChange={(nextValue) =>
                updateSectionField("hero", "storyEyebrow", nextValue)
              }
            />
            <TextField
              label="Story Title"
              value={productPage.hero.storyTitle}
              onChange={(nextValue) =>
                updateSectionField("hero", "storyTitle", nextValue)
              }
            />
          </div>

          <div className="mt-4">
            <TextAreaField
              label="Story Description"
              value={productPage.hero.storyDescription}
              onChange={(nextValue) =>
                updateSectionField("hero", "storyDescription", nextValue)
              }
              rows={3}
              hint="Optional override for the story paragraph inside the card."
            />
          </div>
        </div>

        <div className="mt-5 rounded-lg border border-gray-200 bg-white p-4">
          <div className="mb-4">
            <h5 className="text-sm font-semibold text-gray-800">
              Generated Info Cards
            </h5>
            <p className="text-xs text-gray-500">
              Labels and helper text are editable. Values still come from live
              product data such as category, selected pack, reviews, and stock.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {(productPage.detailsSection.cards || []).map((card, index) => (
              <div
                key={`detail-card-${index}`}
                className="rounded-lg border border-gray-200 bg-gray-50 p-4"
              >
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-gray-500">
                  Card {index + 1}
                </p>
                <div className="mt-3 space-y-3">
                  <TextField
                    label="Label"
                    value={card.label || ""}
                    onChange={(nextValue) =>
                      updateNestedArrayItemField(
                        "detailsSection",
                        "cards",
                        index,
                        "label",
                        nextValue,
                      )
                    }
                  />
                  <TextAreaField
                    label="Helper Text"
                    value={card.helper || ""}
                    onChange={(nextValue) =>
                      updateNestedArrayItemField(
                        "detailsSection",
                        "cards",
                        index,
                        "helper",
                        nextValue,
                      )
                    }
                    rows={2}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-5 rounded-lg border border-gray-200 bg-white p-4">
          <div className="mb-4">
            <h5 className="text-sm font-semibold text-gray-800">
              Insight Cards
            </h5>
            <p className="text-xs text-gray-500">
              These are the three summary cards shown below the main hero
              layout.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <div className="space-y-3 rounded-lg border border-gray-200 bg-gray-50 p-4">
              <TextField
                label="Price Card Eyebrow"
                value={productPage.hero.priceCardEyebrow}
                onChange={(nextValue) =>
                  updateSectionField("hero", "priceCardEyebrow", nextValue)
                }
              />
              <TextAreaField
                label="Price Card Description"
                value={productPage.hero.priceCardDescription}
                onChange={(nextValue) =>
                  updateSectionField("hero", "priceCardDescription", nextValue)
                }
                rows={3}
              />
            </div>

            <div className="space-y-3 rounded-lg border border-gray-200 bg-gray-50 p-4">
              <TextField
                label="Variant Card Eyebrow"
                value={productPage.hero.variantCardEyebrow}
                onChange={(nextValue) =>
                  updateSectionField("hero", "variantCardEyebrow", nextValue)
                }
              />
              <TextAreaField
                label="Variant Card Description"
                value={productPage.hero.variantCardDescription}
                onChange={(nextValue) =>
                  updateSectionField("hero", "variantCardDescription", nextValue)
                }
                rows={3}
              />
            </div>

            <div className="space-y-3 rounded-lg border border-gray-200 bg-gray-50 p-4">
              <TextField
                label="Social Proof Eyebrow"
                value={productPage.hero.socialProofEyebrow}
                onChange={(nextValue) =>
                  updateSectionField("hero", "socialProofEyebrow", nextValue)
                }
              />
              <TextAreaField
                label="Social Proof Description"
                value={productPage.hero.socialProofDescription}
                onChange={(nextValue) =>
                  updateSectionField("hero", "socialProofDescription", nextValue)
                }
                rows={3}
              />
            </div>
          </div>
        </div>

        <div className="mt-5 grid grid-cols-1 gap-4 lg:grid-cols-2">
          <div className="rounded-lg border border-gray-200 bg-white p-4">
            <div className="mb-4">
              <h5 className="text-sm font-semibold text-gray-800">
                Delivery Preview
              </h5>
              <p className="text-xs text-gray-500">
                Edit the visible copy in the pincode preview card.
              </p>
            </div>

            <div className="space-y-3">
              <TextField
                label="Delivery Eyebrow"
                value={productPage.hero.deliveryEyebrow || ""}
                onChange={(nextValue) =>
                  updateSectionField("hero", "deliveryEyebrow", nextValue)
                }
              />
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <TextField
                  label="Optional Label"
                  value={productPage.hero.deliveryOptionalLabel || ""}
                  onChange={(nextValue) =>
                    updateSectionField(
                      "hero",
                      "deliveryOptionalLabel",
                      nextValue,
                    )
                  }
                />
                <TextField
                  label="Ready Label"
                  value={productPage.hero.deliveryReadyLabel || ""}
                  onChange={(nextValue) =>
                    updateSectionField("hero", "deliveryReadyLabel", nextValue)
                  }
                />
              </div>
              <TextField
                label="Input Placeholder"
                value={productPage.hero.deliveryInputPlaceholder || ""}
                onChange={(nextValue) =>
                  updateSectionField(
                    "hero",
                    "deliveryInputPlaceholder",
                    nextValue,
                  )
                }
              />
              <TextAreaField
                label="Idle Helper Text"
                value={productPage.hero.deliveryHelperText || ""}
                onChange={(nextValue) =>
                  updateSectionField("hero", "deliveryHelperText", nextValue)
                }
                rows={3}
                hint="Shown before the customer enters a valid pincode."
              />
            </div>
          </div>

          <div className="rounded-lg border border-gray-200 bg-white p-4">
            <div className="mb-4">
              <h5 className="text-sm font-semibold text-gray-800">
                Trust Cards
              </h5>
              <p className="text-xs text-gray-500">
                These four cards sit below Add to Cart and Buy Now. Icons stay
                fixed, but the copy is fully editable.
              </p>
            </div>

            <div className="space-y-3">
              {(productPage.hero.supportCards || []).map((card, index) => (
                <div
                  key={`support-card-${index}`}
                  className="rounded-lg border border-gray-200 bg-gray-50 p-4"
                >
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-gray-500">
                    Trust Card {index + 1}
                  </p>
                  <div className="mt-3 space-y-3">
                    <TextField
                      label="Title"
                      value={card.title || ""}
                      onChange={(nextValue) =>
                        updateNestedArrayItemField(
                          "hero",
                          "supportCards",
                          index,
                          "title",
                          nextValue,
                        )
                      }
                    />
                    <TextAreaField
                      label="Description"
                      value={card.description || ""}
                      onChange={(nextValue) =>
                        updateNestedArrayItemField(
                          "hero",
                          "supportCards",
                          index,
                          "description",
                          nextValue,
                        )
                      }
                      rows={2}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className={sectionCardClass}>
        <div className="mb-4">
          <h4 className="text-[16px] font-semibold text-gray-800">
            Tabs And Description Section
          </h4>
          <p className="text-sm text-gray-500">
            Configure tab labels plus the editorial banner and extra description
            paragraphs.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <div className="space-y-3 rounded-lg border border-gray-200 bg-white p-4">
            <ToggleField
              label="Show Description Tab"
              checked={productPage.tabs.showDescription}
              onChange={(nextValue) =>
                updateSectionField("tabs", "showDescription", nextValue)
              }
            />
            <TextField
              label="Description Tab Label"
              value={productPage.tabs.descriptionLabel}
              onChange={(nextValue) =>
                updateSectionField("tabs", "descriptionLabel", nextValue)
              }
            />
          </div>

          <div className="space-y-3 rounded-lg border border-gray-200 bg-white p-4">
            <ToggleField
              label="Show Details Tab"
              checked={productPage.tabs.showDetails}
              onChange={(nextValue) =>
                updateSectionField("tabs", "showDetails", nextValue)
              }
            />
            <TextField
              label="Details Tab Label"
              value={productPage.tabs.detailsLabel}
              onChange={(nextValue) =>
                updateSectionField("tabs", "detailsLabel", nextValue)
              }
            />
          </div>

          <div className="space-y-3 rounded-lg border border-gray-200 bg-white p-4">
            <ToggleField
              label="Show Shipping Tab"
              checked={productPage.tabs.showShipping}
              onChange={(nextValue) =>
                updateSectionField("tabs", "showShipping", nextValue)
              }
            />
            <TextField
              label="Shipping Tab Label"
              value={productPage.tabs.shippingLabel}
              onChange={(nextValue) =>
                updateSectionField("tabs", "shippingLabel", nextValue)
              }
            />
          </div>
        </div>

        <div className="mt-5 grid grid-cols-1 gap-3 md:grid-cols-4">
          <ToggleField
            label="Show Description Section"
            checked={productPage.descriptionSection.show}
            onChange={(nextValue) =>
              updateSectionField("descriptionSection", "show", nextValue)
            }
          />
          <ToggleField
            label="Show Editorial Banner"
            checked={productPage.descriptionSection.showEditorialBanner}
            onChange={(nextValue) =>
              updateSectionField(
                "descriptionSection",
                "showEditorialBanner",
                nextValue,
              )
            }
          />
          <ToggleField
            label="Show Description Flow"
            checked={productPage.descriptionSection.showDescriptionFlow}
            onChange={(nextValue) =>
              updateSectionField(
                "descriptionSection",
                "showDescriptionFlow",
                nextValue,
              )
            }
          />
          <ToggleField
            label="Show Featured Image"
            checked={
              productPage.descriptionSection.showFeaturedBannerImage !== false
            }
            onChange={(nextValue) =>
              updateSectionField(
                "descriptionSection",
                "showFeaturedBannerImage",
                nextValue,
              )
            }
            hint="Turn off to remove the image area from Featured Overview."
          />
        </div>

        <div className="mt-5 grid grid-cols-1 gap-4 lg:grid-cols-2">
          <TextField
            label="Editorial Banner Eyebrow"
            value={productPage.descriptionSection.editorialEyebrow}
            onChange={(nextValue) =>
              updateSectionField(
                "descriptionSection",
                "editorialEyebrow",
                nextValue,
              )
            }
          />
          <TextField
            label="Editorial Banner Title"
            value={productPage.descriptionSection.editorialTitle}
            onChange={(nextValue) =>
              updateSectionField(
                "descriptionSection",
                "editorialTitle",
                nextValue,
              )
            }
          />
        </div>

        <div className="mt-4">
          <TextAreaField
            label="Editorial Banner Description"
            value={productPage.descriptionSection.editorialDescription}
            onChange={(nextValue) =>
              updateSectionField(
                "descriptionSection",
                "editorialDescription",
                nextValue,
              )
            }
            rows={3}
          />
        </div>

        <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_220px]">
          <TextField
            label="Featured Banner Image URL"
            value={productPage.descriptionSection.featuredBannerImage || ""}
            onChange={(nextValue) =>
              updateSectionField(
                "descriptionSection",
                "featuredBannerImage",
                nextValue,
              )
            }
          />
          <label className="flex h-full min-h-[40px] cursor-pointer items-center justify-center rounded-md border border-blue-200 bg-blue-50 px-4 text-sm font-semibold text-blue-700">
            {bannerUploading ? "Uploading..." : "Upload Image"}
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleBannerUpload}
              disabled={bannerUploading}
            />
          </label>
        </div>
        {productPage.descriptionSection.featuredBannerImage ? (
          <div className="mt-3 w-full max-w-sm rounded-lg border border-gray-200 bg-white p-2">
            <img
              src={productPage.descriptionSection.featuredBannerImage}
              alt="Featured banner preview"
              className="max-h-40 w-full rounded-md object-contain"
            />
          </div>
        ) : null}

        <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
          <TextField
            label="Description Flow Eyebrow"
            value={productPage.descriptionSection.flowEyebrow}
            onChange={(nextValue) =>
              updateSectionField("descriptionSection", "flowEyebrow", nextValue)
            }
          />
          <TextAreaField
            label="Extra Description Paragraphs"
            value={extraParagraphDraft}
            onChange={(nextValue) => {
              setExtraParagraphDraft(nextValue);
            }}
            onBlur={() =>
              updateSectionField(
                "descriptionSection",
                "extraParagraphs",
                fromParagraphText(extraParagraphDraft),
              )
            }
            rows={6}
            hint="Use a blank line between paragraphs. Single line breaks become spaces. Leave blank to use the default generated copy."
            enableParagraphShortcuts
          />
        </div>
      </div>

      <div className={sectionCardClass}>
        <div className="mb-4">
          <h4 className="text-[16px] font-semibold text-gray-800">
            Details And Shipping
          </h4>
          <p className="text-sm text-gray-500">
            Control the lower details and shipping sections that appear under
            the tabbed content.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <ToggleField
            label="Show Details Section"
            checked={productPage.detailsSection.show}
            onChange={(nextValue) =>
              updateSectionField("detailsSection", "show", nextValue)
            }
          />
          <ToggleField
            label="Show Detail Cards"
            checked={productPage.detailsSection.showCards}
            onChange={(nextValue) =>
              updateSectionField("detailsSection", "showCards", nextValue)
            }
          />
        </div>

        <div className="mt-6 grid grid-cols-1 gap-3 md:grid-cols-3">
          <ToggleField
            label="Show Shipping Section"
            checked={productPage.shippingSection.show}
            onChange={(nextValue) =>
              updateSectionField("shippingSection", "show", nextValue)
            }
          />
          <ToggleField
            label="Show Shipping Points"
            checked={productPage.shippingSection.showPoints}
            onChange={(nextValue) =>
              updateSectionField("shippingSection", "showPoints", nextValue)
            }
          />
          <ToggleField
            label="Show Reasons Panel"
            checked={productPage.shippingSection.showReasonsPanel}
            onChange={(nextValue) =>
              updateSectionField(
                "shippingSection",
                "showReasonsPanel",
                nextValue,
              )
            }
          />
        </div>

        <div className="mt-5 grid grid-cols-1 gap-4 xl:grid-cols-2">
          <div className="space-y-4">
            <TextField
              label="Shipping Points Eyebrow"
              value={productPage.shippingSection.pointsEyebrow}
              onChange={(nextValue) =>
                updateSectionField(
                  "shippingSection",
                  "pointsEyebrow",
                  nextValue,
                )
              }
            />
            <TextAreaField
              label="Shipping Points"
              value={shippingPointsDraft}
              onChange={(nextValue) => {
                setShippingPointsDraft(nextValue);
              }}
              onBlur={() =>
                updateSectionField(
                  "shippingSection",
                  "points",
                  fromLines(shippingPointsDraft),
                )
              }
              rows={6}
              hint="One shipping or trust point per line."
            />
          </div>

          <div className="space-y-4">
            <TextField
              label="Reasons Panel Eyebrow"
              value={productPage.shippingSection.reasonsEyebrow}
              onChange={(nextValue) =>
                updateSectionField(
                  "shippingSection",
                  "reasonsEyebrow",
                  nextValue,
                )
              }
            />
            <TextAreaField
              label="Reasons Panel Paragraphs"
              value={reasonsParagraphDraft}
              onChange={(nextValue) => {
                setReasonsParagraphDraft(nextValue);
              }}
              onBlur={() =>
                updateSectionField(
                  "shippingSection",
                  "reasonsParagraphs",
                  fromParagraphText(reasonsParagraphDraft),
                )
              }
              rows={6}
              hint="Use a blank line between paragraphs. Single line breaks become spaces."
              enableParagraphShortcuts
            />
          </div>
        </div>
      </div>

      <div className={sectionCardClass}>
        <div className="mb-4">
          <h4 className="text-[16px] font-semibold text-gray-800">
            Reviews And Recommendation Sections
          </h4>
          <p className="text-sm text-gray-500">
            Choose which lower product sections are visible and update the
            headings or CTA text shown on the storefront.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          <div className="space-y-4 rounded-lg border border-gray-200 bg-white p-4">
            <ToggleField
              label="Show Reviews Below Product"
              checked={productPage.reviewsSection.show}
              onChange={(nextValue) =>
                updateSectionField("reviewsSection", "show", nextValue)
              }
            />
            <TextField
              label="Reviews Eyebrow"
              value={productPage.reviewsSection.eyebrow || ""}
              onChange={(nextValue) =>
                updateSectionField("reviewsSection", "eyebrow", nextValue)
              }
            />
            <TextField
              label="Reviews Title"
              value={productPage.reviewsSection.title || ""}
              onChange={(nextValue) =>
                updateSectionField("reviewsSection", "title", nextValue)
              }
            />
          </div>

          <div className="space-y-4 rounded-lg border border-gray-200 bg-white p-4">
            <ToggleField
              label="Show Frequently Bought Together"
              checked={productPage.frequentlyBoughtSection.show}
              onChange={(nextValue) =>
                updateSectionField("frequentlyBoughtSection", "show", nextValue)
              }
            />
            <TextField
              label="Frequently Bought Eyebrow"
              value={productPage.frequentlyBoughtSection.eyebrow || ""}
              onChange={(nextValue) =>
                updateSectionField(
                  "frequentlyBoughtSection",
                  "eyebrow",
                  nextValue,
                )
              }
            />
            <TextField
              label="Frequently Bought Title"
              value={productPage.frequentlyBoughtSection.title || ""}
              onChange={(nextValue) =>
                updateSectionField(
                  "frequentlyBoughtSection",
                  "title",
                  nextValue,
                )
              }
            />
            <TextField
              label="Frequently Bought Button Text"
              value={productPage.frequentlyBoughtSection.buttonText || ""}
              onChange={(nextValue) =>
                updateSectionField(
                  "frequentlyBoughtSection",
                  "buttonText",
                  nextValue,
                )
              }
            />
          </div>

          <div className="space-y-4 rounded-lg border border-gray-200 bg-white p-4">
            <ToggleField
              label="Show Recommended Combos"
              checked={productPage.recommendedCombosSection.show}
              onChange={(nextValue) =>
                updateSectionField(
                  "recommendedCombosSection",
                  "show",
                  nextValue,
                )
              }
            />
            <TextField
              label="Recommended Combos Eyebrow"
              value={productPage.recommendedCombosSection.eyebrow || ""}
              onChange={(nextValue) =>
                updateSectionField(
                  "recommendedCombosSection",
                  "eyebrow",
                  nextValue,
                )
              }
            />
            <TextField
              label="Recommended Combos Title"
              value={productPage.recommendedCombosSection.title || ""}
              onChange={(nextValue) =>
                updateSectionField(
                  "recommendedCombosSection",
                  "title",
                  nextValue,
                )
              }
            />
            <TextField
              label="Recommended Combos Link Text"
              value={productPage.recommendedCombosSection.linkText || ""}
              onChange={(nextValue) =>
                updateSectionField(
                  "recommendedCombosSection",
                  "linkText",
                  nextValue,
                )
              }
            />
          </div>
        </div>
      </div>
    </div>
  );
}
