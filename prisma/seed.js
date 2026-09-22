require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const { PrismaBetterSqlite3 } = require('@prisma/adapter-better-sqlite3');
const path = require('path');
const bcrypt = require('bcryptjs');

async function main() {
  const dbPath = path.join(__dirname, 'dev.db');
  const adapter = new PrismaBetterSqlite3({ url: `file:${dbPath}` });
  const prisma = new PrismaClient({ adapter });

  console.log('Clearing database tables...');
  try {
    await prisma.notification.deleteMany();
    await prisma.report.deleteMany();
    await prisma.block.deleteMany();
    await prisma.message.deleteMany();
    await prisma.payment.deleteMany();
    await prisma.subscription.deleteMany();
    await prisma.profile.deleteMany();
    await prisma.user.deleteMany();
  } catch (err) {
    console.log('Tables already empty or not yet migrated.');
  }

  console.log('Hashing passwords...');
  const passwordHash = await bcrypt.hash('password123', 10);

  console.log('Creating Admin Account...');
  const admin = await prisma.user.create({
    data: {
      username: 'admin',
      fullName: 'CupidX Administrator',
      passwordHash,
      role: 'ADMIN',
      profile: {
        create: {
          bio: 'CupidX Safety & System Moderation Agent.',
          age: 30,
          gender: 'unspecified',
          interests: 'security,moderation,matchmaking',
          avatarUrl: 'https://api.dicebear.com/7.x/bottts/svg?seed=admin',
          themePreference: 'pink'
        }
      }
    }
  });

  console.log('Creating Romeo...');
  const romeo = await prisma.user.create({
    data: {
      username: 'romeo',
      fullName: 'Romeo Montague',
      passwordHash,
      role: 'USER',
      profile: {
        create: {
          bio: 'Looking for my Juliet. Love poetry, stargazing, and classic romance.',
          age: 21,
          gender: 'male',
          interests: 'poetry,romance,stargazing,theatre',
          avatarUrl: 'https://api.dicebear.com/7.x/fun-emoji/svg?seed=romeo',
          themePreference: 'purple'
        }
      },
      subscription: {
        create: {
          plan: 'VIP',
          isActive: true,
          startDate: new Date(),
          endDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000)
        }
      }
    }
  });

  console.log('Creating Juliet...');
  const juliet = await prisma.user.create({
    data: {
      username: 'juliet',
      fullName: 'Juliet Capulet',
      passwordHash,
      role: 'USER',
      profile: {
        create: {
          bio: 'O Romeo, Romeo! Wherefore art thou Romeo? Love balcony talks, roses, and matching sparks.',
          age: 19,
          gender: 'female',
          interests: 'roses,balconies,poetry,dancing',
          avatarUrl: 'https://api.dicebear.com/7.x/fun-emoji/svg?seed=juliet',
          themePreference: 'pink'
        }
      }
    }
  });

  console.log('Creating Cupid...');
  const cupid = await prisma.user.create({
    data: {
      username: 'cupid',
      fullName: 'Cupid Love',
      passwordHash,
      role: 'USER',
      profile: {
        create: {
          bio: 'I shoot arrows of matchmaking. Hit me up if you want to find love!',
          age: 25,
          gender: 'nonbinary',
          interests: 'arrows,matchmaking,neon,hearts',
          avatarUrl: 'https://api.dicebear.com/7.x/fun-emoji/svg?seed=cupid',
          themePreference: 'blue'
        }
      }
    }
  });

  console.log('Creating test report...');
  await prisma.report.create({
    data: {
      reporterId: juliet.id,
      reportedUserId: cupid.id,
      reason: 'Cupid is sending matchmaking arrows too fast, causing spam sparks!',
      status: 'PENDING'
    }
  });

  console.log('Creating test messages...');
  await prisma.message.create({
    data: {
      senderId: romeo.id,
      receiverId: juliet.id,
      content: 'Hello, Juliet! Art thou online?'
    }
  });
  
  await prisma.message.create({
    data: {
      senderId: juliet.id,
      receiverId: romeo.id,
      content: 'Romeo! I am online. Speak, sweet love.'
    }
  });

  console.log('Database seeded successfully!');
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error('Error during database seed:', e);
  process.exit(1);
});
