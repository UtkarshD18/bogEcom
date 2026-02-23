import mongoose from "mongoose";

/**
 * Cancellation Policy Model
 * Stores the cancellation policy content
 * Editable from admin panel
 */
const DEFAULT_POLICY_CONTENT = `## Non-Cancellable & Non-Returnable Orders

Orders placed with a discount or during any sale events are not eligible for cancellation, return, or exchange.

Once an order is shipped, no modifications or cancellations can be made.

## Important Notice

We do not accept returns, exchanges, or refunds once an order is processed.`;

const cancellationPolicySchema = new mongoose.Schema(
  {
    content: {
      type: String,
      required: true,
      default: DEFAULT_POLICY_CONTENT,
    },
    theme: {
      style: {
        type: String,
        default: "mint",
      },
      layout: {
        type: String,
        default: "glass",
      },
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
  },
  {
    timestamps: true,
  },
);

const CancellationPolicyModel = mongoose.model(
  "CancellationPolicy",
  cancellationPolicySchema,
);

export default CancellationPolicyModel;
