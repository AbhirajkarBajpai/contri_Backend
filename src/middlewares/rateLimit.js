const rateLimit = require("express-rate-limit");

const authLimiter = rateLimit({
  windowMs: 1000,
  max: 100, 
  message: {
    status: "fail",
    message: "Too many requests, please try again later.",
  },
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
});

module.exports = { authLimiter };
