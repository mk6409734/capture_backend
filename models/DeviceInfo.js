import mongoose from "mongoose";

const InfoSchema = mongoose.Schema(
  {
    imageUrl: {
      type: String,
      default: null,
    },
    location: {
      latitude: { type: Number, default: 0 },
      longitude: { type: Number, default: 0 },
    },
    deviceInfo: {
      type: String,
      default: null,
    },
    ipAddress: {
      type: String,
      default: "",
    },
  },
  { timestamps: true }
);

export const InfoModel = mongoose.model("info", InfoSchema);
