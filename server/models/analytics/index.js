import { getCartEventModel } from "./cartEvent.model.js";
import { getEventRawModel } from "./eventRaw.model.js";
import { getPageViewModel } from "./pageView.model.js";
import { getProductEventModel } from "./productEvent.model.js";
import { getPurchaseModel } from "./purchase.model.js";
import { getSearchEventModel } from "./searchEvent.model.js";
import { getSectionViewModel } from "./sectionView.model.js";
import { getUserSessionModel } from "./userSession.model.js";

export const registerAnalyticsModels = (connection) => ({
  UserSession: getUserSessionModel(connection),
  EventRaw: getEventRawModel(connection),
  PageView: getPageViewModel(connection),
  SectionView: getSectionViewModel(connection),
  ProductEvent: getProductEventModel(connection),
  CartEvent: getCartEventModel(connection),
  Purchase: getPurchaseModel(connection),
  SearchEvent: getSearchEventModel(connection),
});

export {
  getCartEventModel,
  getEventRawModel,
  getPageViewModel,
  getProductEventModel,
  getPurchaseModel,
  getSearchEventModel,
  getSectionViewModel,
  getUserSessionModel,
};
