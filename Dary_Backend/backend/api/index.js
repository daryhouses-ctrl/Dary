import app from "../src/index.js";
import { connectDB } from "../src/config/prisma/PrismaService.js";

let dbConnection;

export default async function handler(req, res) {
  try {
    if (!dbConnection) {
      dbConnection = connectDB();
    }

    await dbConnection;

    return app(req, res);
  } catch (error) {
    console.error("Vercel API Error:", error);

    return res.status(500).json({
      success: false,
      message: "Internal Server Error",
    });
  }
}
