const express = require("express");
const mongoose = require("mongoose");
const cookieParser = require("cookie-parser");
const expenseRoute = require("./src/routes/expenseRoute");
const groupRoute = require("./src/routes/groupRoute");
const userRoute = require("./src/routes/userRoute");
const cors = require("cors");
const { authLimiter } = require("./src/middlewares/rateLimit");
require("dotenv").config();

const app = express();

// app.use(authLimiter);
app.set("trust proxy", 1);

const PORT = process.env.PORT || 3000;

app.use(
  cors({
    credentials: true,
    origin: ["http://localhost:3000", "https://contri-frontend.vercel.app"],
  })
);

// Middleware
app.use(cookieParser());
app.use(express.json());

app.use("/api/v1/expense", expenseRoute);
app.use("/api/v1/user", userRoute);
app.use("/api/v1/group", groupRoute);

app.get("/", (req, res) => {
  res.send("Hello, Express!");
});

mongoose
  .connect(
    `mongodb+srv://21it3001:${process.env.MongoPass}@cluster0.dphm3.mongodb.net/`
  )
  .then(() => console.log("MongoDB connected"))
  .catch((err) => console.error("MongoDB connection error:", err));

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
