import { User } from "../models/User.js";

export const getUser = async (req, res) => {
  const user = await User.findById(req.user.id);
  res.json({ user });
};
