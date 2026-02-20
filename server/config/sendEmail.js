import { sendEmail } from "./emailService.js";
import { logger } from "../utils/errorHandler.js";

const sendEmailFun = async ({ sendTo, subject, text, html, context }) => {
    const result = await sendEmail({
        to: sendTo,
        subject,
        text,
        html,
        context: context || "auth",
    });
    if (result.success) {
        return true;
    } else {
        logger.error("sendEmailFun", "Failed to send email", {
            to: sendTo,
            subject,
            context: context || "auth",
            error: result.error || "Unknown error",
        });
        return false;
    }
};

export default sendEmailFun; 
