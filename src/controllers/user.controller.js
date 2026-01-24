import { User } from "../models/User.js";

export const getUser = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found"
      });
    }

    return res.status(200).json({
      success: true,
      message: "User retrieved successfully",
      data: {
        id: user._id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        phone: user.phone,
        balance: user.balance,
        DVA_Number: user.DVA_Number,
        DVA_bankName: user.DVA_bankName,
        DVA_accountName: user.DVA_accountName,
        paystackRecipientCode: user.paystackRecipientCode,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt
      }
    });

  } catch (error) {
    console.error("Error fetching user:", error);

    return res.status(500).json({
      success: false,
      message: "An unexpected error occurred while fetching user information",
      error: {
        code: "SERVER_ERROR"
      }
    });
  }
};