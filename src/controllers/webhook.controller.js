import { verifySignature } from "../services/paystack.service.js";
import { User } from "../models/User.js";

export const paystackWebhook = async (req, res) => {
  try {
    const signature = req.headers["x-paystack-signature"];
    if (!signature) return res.sendStatus(400);

    const ok = verifySignature(req.body, signature);
    if (!ok) return res.sendStatus(401);

    const payload = JSON.parse(req.body.toString("utf8"));
    const { event, data } = payload;

    // Handle events
    if (event === "dedicatedaccount.assign.success") {
      res.sendStatus(200); // ack immediately

      // fire & forget
      (async () => {
        try {
          const userEmail = data?.customer?.email;
          const user = await User.findOne({ email: userEmail });
          if (!user) {
            console.warn("Webhook: user not found for", userEmail);
            return;
          }
          const dvaAccountNum = data?.dedicated_account?.account_number;
          const dvaAccountName = data?.dedicated_account?.account_name;
          const dvaBankName = data?.dedicated_account?.bank?.name;
         await User.findByIdAndUpdate(user._id,{$set: {DVA_Number:dvaAccountNum,DVA_bankName:dvaBankName,DVA_accountName: dvaAccountName}},{ new: true });
        } catch (err) {
          console.error("Webhook post-ack error:", err);
        }
      })();
      return;
    }

    if (event === "transfer.success") {
      console.log(" transfer.success:", JSON.stringify(data, null, 2));
      return res.sendStatus(200);
    }

    if (event === "charge.success") {
      console.log("💰 charge.success:", JSON.stringify(data, null, 2));
      res.sendStatus(200);

      (async () => {
        try {
          const userId = data?.metadata?.userId;
          const amountNgn = (data?.amount ?? 0) / 100;

          if (userId && Number.isFinite(amountNgn)) {
            await User.findByIdAndUpdate(
              userId,
              { $inc: { balance: amountNgn } },
              { new: true }
            );
          } else {
            // DVA path
            const receiverAcct = data?.metadata?.receiver_account_number;
            const email = data?.customer?.email;

            const userByDVA = await User.findOne({ email }).select("DVA_Number");
            if (userByDVA && userByDVA.DVA_Number === receiverAcct) {
              await User.findByIdAndUpdate(
                userByDVA._id,
                { $inc: { balance: amountNgn } },
                { new: true }
              );
            }
          }
        } catch (err) {
          console.error("Error processing charge.success webhook:", err);
        }
      })();
      return;
    }

    // Default ack for unhandled events
    return res.sendStatus(200);
  } catch (err) {
    console.error("Webhook error:", err);
    return res.sendStatus(500);
  }
};
