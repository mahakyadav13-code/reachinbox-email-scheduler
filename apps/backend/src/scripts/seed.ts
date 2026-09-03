import { prisma } from '../config/database';
import { logger } from '../config/logger';

/**
 * The two demo sending identities.
 *
 * Every sender relays through the one Ethereal mailbox configured in .env; these
 * addresses are the From identity and, more importantly, each gets its own
 * independent hourly rate-limit budget. Two of them makes the per-sender limiting
 * observable in a demo.
 */
const DEMO_SENDERS = [
  { name: 'Sender One', email: 'sender1@reachinbox.com' },
  { name: 'Sender Two', email: 'sender2@reachinbox.com' },
];

async function seedSendersFor(userId: string, userEmail: string) {
  for (const sender of DEMO_SENDERS) {
    await prisma.sender.upsert({
      where: { userId_email: { userId, email: sender.email } },
      update: {},
      create: {
        userId,
        name: sender.name,
        email: sender.email,
        provider: 'ethereal',
        isActive: true,
      },
    });
  }

  logger.info(`Senders ready for ${userEmail}: ${DEMO_SENDERS.map((s) => s.email).join(', ')}`);
}

async function seed() {
  try {
    logger.info('Starting database seed...');

    // A placeholder user so the seed is useful before anyone has logged in.
    const testUser = await prisma.user.upsert({
      where: { email: 'test@reachinbox.com' },
      update: {},
      create: {
        googleId: 'test-google-id-123',
        email: 'test@reachinbox.com',
        name: 'Test User',
        avatarUrl: 'https://via.placeholder.com/150',
      },
    });

    await seedSendersFor(testUser.id, testUser.email);

    // Senders are scoped per user, so a freshly logged-in Google account starts
    // with an empty sender list and cannot compose anything. Give every user
    // without senders the same demo pair. Re-running this is safe.
    const usersWithoutSenders = await prisma.user.findMany({
      where: { senders: { none: {} } },
      select: { id: true, email: true },
    });

    for (const user of usersWithoutSenders) {
      await seedSendersFor(user.id, user.email);
    }

    const totalUsers = await prisma.user.count();
    const totalSenders = await prisma.sender.count();

    logger.info('✅ Seed completed successfully!');
    logger.info(`Users: ${totalUsers}, senders: ${totalSenders}`);
    logger.info('Log in with Google, then pick a sender in Compose New Email.');
  } catch (error) {
    logger.error('Seed failed:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

seed()
  .then(() => process.exit(0))
  .catch(() => process.exit(1));
