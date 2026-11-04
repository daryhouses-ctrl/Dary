import passport from "../../config/passport.js"

export const googleAuth = passport.authenticate("google", {
  scope: ["email", "profile"],
  session: false,
});

export const googleAuthenticate = (req, res, next) => {
  passport.authenticate("google", { session: false }, (err, user) => {
    if (err || !user) {
      return res.status(401).json({
        success: false,
        message: "Google authentication failed",
      });
    }

    req.user = user;
    next();
  })(req, res, next);
};