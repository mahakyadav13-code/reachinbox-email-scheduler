import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import { config } from './index';
import { prisma } from './database';
import { logger } from './logger';

passport.use(
  new GoogleStrategy(
    {
      clientID: config.google.clientId,
      clientSecret: config.google.clientSecret,
      callbackURL: config.google.callbackURL,
    },
    async (accessToken, refreshToken, profile, done) => {
      try {
        const googleId = profile.id;
        const email = profile.emails?.[0]?.value;
        const name = profile.displayName;
        const avatarUrl = profile.photos?.[0]?.value;

        if (!email) {
          return done(new Error('No email found from Google'), undefined);
        }

        // Find or create user
        let user = await prisma.user.findUnique({
          where: { googleId },
        });

        if (!user) {
          user = await prisma.user.create({
            data: {
              googleId,
              email,
              name,
              avatarUrl,
            },
          });
          logger.info(`New user created: ${email}`);
        } else {
          // Update user info
          user = await prisma.user.update({
            where: { id: user.id },
            data: {
              name,
              avatarUrl,
            },
          });
        }

        return done(null, user);
      } catch (error) {
        logger.error('Google OAuth error:', error);
        return done(error as Error, undefined);
      }
    }
  )
);

// Serialize user to session
passport.serializeUser((user: any, done) => {
  done(null, user.id);
});

// Deserialize user from session
passport.deserializeUser(async (id: string, done) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id },
    });
    done(null, user);
  } catch (error) {
    done(error, null);
  }
});

export default passport;
