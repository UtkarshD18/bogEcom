import { logger } from "../../utils/errorHandler.js";
import { generateFrequentlyBoughtTogether } from "./frequentlyBoughtTogether.service.js";
import { generateComboDrafts } from "./comboDraft.service.js";

let comboJobTimer = null;
let comboJobInFlight = false;

const getConfig = () => {
  const intervalHours = Number(process.env.COMBO_ANALYSIS_INTERVAL_HOURS || 24);
  const draftLimit = Number(process.env.COMBO_DRAFT_LIMIT || 12);
  return {
    intervalMs: Math.max(intervalHours, 1) * 60 * 60 * 1000,
    draftLimit: Math.max(draftLimit, 1),
  };
};

export const runComboAnalysis = async () => {
  const pairingResult = await generateFrequentlyBoughtTogether();
  const draftResult = await generateComboDrafts({
    limit: getConfig().draftLimit,
    previewOnly: false,
    refreshIfEmpty: false,
    productOrderCounts: pairingResult?.productOrderCounts || null,
  });

  return {
    pairingResult,
    draftResult,
  };
};

export const startComboAnalysisJob = () => {
  if (comboJobTimer) return comboJobTimer;
  const { intervalMs } = getConfig();

  const run = async () => {
    if (comboJobInFlight) return;
    comboJobInFlight = true;
    try {
      const result = await runComboAnalysis();
      logger.info("comboAnalysisJob", "AI combo analysis completed", {
        pairing: result?.pairingResult,
        drafts: result?.draftResult,
      });
    } catch (error) {
      logger.error("comboAnalysisJob", "AI combo analysis failed", {
        error: error?.message || String(error),
      });
    } finally {
      comboJobInFlight = false;
    }
  };

  run();
  comboJobTimer = setInterval(run, intervalMs);
  logger.info("comboAnalysisJob", "AI combo analysis job started", {
    intervalMs,
  });
  return comboJobTimer;
};

export const stopComboAnalysisJob = () => {
  if (comboJobTimer) {
    clearInterval(comboJobTimer);
    comboJobTimer = null;
  }
};

export default {
  runComboAnalysis,
  startComboAnalysisJob,
  stopComboAnalysisJob,
};
