import passport from "passport";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import { AppError } from "../core/middleware/error/AppError.js";

passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: process.env.GOOGLE_CALLBACK_URL,
      scope: ["email", "profile"],
    },

    async (accessToken, refreshToken, profile, done) => {
      try {
        const email = profile.emails?.[0]?.value;
        const isEmailVerified = profile.emails?.[0]?.verified;

        if (!email) {
          return done(new AppError("Google account has no email", 400), null);
        }

        if (!isEmailVerified) {
          return done(new AppError("Google email is not verified", 400), null);
        }

        const user = {
          googleId: profile.id,
          email,
          firstName: profile.name?.givenName || profile.displayName || "",
          lastName: profile.name?.familyName || "",
          avatar: profile.photos?.[0]?.value || null,
        };

        return done(null, user);
      } catch (error) {
        return done(error, null);
      }
    },
  ),
);

export default passport;
