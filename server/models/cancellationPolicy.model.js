import mongoose from "mongoose";

/**
 * Cancellation Policy Model
 * Stores the cancellation and return policy content
 * Editable from admin panel
 */
const DEFAULT_POLICY_CONTENT = `## Non-Cancellable & Non-Returnable Orders

Orders placed with a discount or during any sale events are not eligible for cancellation or return.

Once an order is shipped, no modifications or cancellations can be made.

## Return / Exchange / Refund Policy

We offer refund / exchange within first 1 days from the date of your purchase. If 1 days have passed
since your purchase, you will not be offered a return, exchange or refund of any kind. In order to become
eligible for a return or an exchange, (i) the purchased item should be unused and in the same condition as
you received it, (ii) the item must have original packaging, (iii) if the item that you purchased on a sale,
then the item may not be eligible for a return / exchange. Further, only such items are replaced by us
(based on an exchange request), if such items are found defective or damaged.
You agree that there may be a certain category of products / items that are exempted from returns or
refunds. Such categories of the products would be identified to you at the item of purchase. For exchange
/ return accepted request(s) (as applicable), once your returned product / item is received and inspected
by us, we will send you an email to notify you about receipt of the returned / exchanged product. Further.
If the same has been approved after the quality check at our end, your request (i.e. return / exchange) will
be processed in accordance with our policies.
Replacement of damaged products will be processed and delivered within 5-7 Days of receiving the request and approval`;

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
