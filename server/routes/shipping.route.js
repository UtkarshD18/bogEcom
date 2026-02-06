import express from "express";
import admin from "../middlewares/admin.js";
import auth from "../middlewares/auth.js";
import {
  xpressbeesBookShipment,
  xpressbeesCancelShipment,
  xpressbeesCouriers,
  xpressbeesLogin,
  xpressbeesManifest,
  xpressbeesNdrCreate,
  xpressbeesNdrList,
  xpressbeesReverseShipment,
  xpressbeesServiceability,
  xpressbeesTrackShipment,
} from "../controllers/shipping.controller.js";

const router = express.Router();

// Admin-only shipping operations
router.use(auth, admin);

router.post("/xpressbees/login", xpressbeesLogin);
router.get("/xpressbees/couriers", xpressbeesCouriers);
router.post("/xpressbees/serviceability", xpressbeesServiceability);
router.post("/xpressbees/book", xpressbeesBookShipment);
router.get("/xpressbees/track/:awb", xpressbeesTrackShipment);
router.post("/xpressbees/manifest", xpressbeesManifest);
router.post("/xpressbees/cancel", xpressbeesCancelShipment);
router.get("/xpressbees/ndr", xpressbeesNdrList);
router.post("/xpressbees/ndr/create", xpressbeesNdrCreate);
router.post("/xpressbees/reverse", xpressbeesReverseShipment);

export default router;
