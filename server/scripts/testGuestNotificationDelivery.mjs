#!/usr/bin/env node
import "dotenv/config";
import connectDb from "../config/connectDb.js";
import {
  getLiveOfferFeed,
  manualSendOffer,
} from "../controllers/notification.controller.js";
import UserModel from "../models/user.model.js";

const callController = (controller, req) =>
  new Promise((resolve, reject) => {
    const responseState = {
      statusCode: 200,
    };
    const res = {
      status(code) {
        responseState.statusCode = Number(code || 200);
        return this;
      },
      json(payload) {
        resolve({
          statusCode: responseState.statusCode,
          body: payload,
        });
      },
    };

    Promise.resolve(controller(req, res)).catch(reject);
  });

const run = async () => {
  await connectDb();

  const adminUser = await UserModel.findOne({
    role: "Admin",
    status: "active",
  }).select("_id email role status");

  if (!adminUser?._id) {
    throw new Error("No active admin user found for notification test.");
  }

  const since = Date.now() - 5000;
  const title = `Guest delivery test ${Date.now()}`;
  const body = "Verifying first-time guest offer delivery path";

  const sendResponse = await callController(manualSendOffer, {
    user: String(adminUser._id),
    body: {
      title,
      body,
      includeUsers: true,
      data: {
        couponCode: "GUESTLIVE",
        discountValue: 10,
      },
    },
    headers: {},
    cookies: {},
  });

  const feedResponse = await callController(getLiveOfferFeed, {
    user: null,
    query: {
      since: String(since),
      limit: "20",
    },
  });

  const offers = Array.isArray(feedResponse?.body?.data?.offers)
    ? feedResponse.body.data.offers
    : [];
  const feedHasOffer = offers.some((offer) => offer?.title === title);
  const latestOffer = offers[offers.length - 1] || null;

  const summary = {
    mode: "controller_integration",
    adminUser: String(adminUser.email || adminUser._id),
    sendStatusCode: sendResponse.statusCode,
    sendSuccess: Boolean(sendResponse?.body?.success),
    sendMessage: sendResponse?.body?.message || "",
    liveDelivered: Number(sendResponse?.body?.data?.liveDelivered || 0),
    liveFeedStatusCode: Number(feedResponse?.statusCode || 0),
    liveFeedOffersCount: offers.length,
    liveFeedContainsTestOffer: feedHasOffer,
    latestOfferNotificationId:
      latestOffer?.notificationId || latestOffer?.data?.notificationId || null,
    latestOfferTitle: latestOffer?.title || null,
  };

  console.log(JSON.stringify(summary, null, 2));
};

run()
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    console.error(
      JSON.stringify(
        {
          success: false,
          message: error?.message || String(error),
        },
        null,
        2,
      ),
    );
    process.exit(1);
  });
