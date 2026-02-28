import { PrismaClient } from '@prisma/client';

async function main() {
  const prisma = new PrismaClient({
    datasources: {
      db: {
        url: process.env.DATABASE_URL
      }
    }
  });

  try {
    console.log('Attempting to connect to database...');
    console.log('URL:', process.env.DATABASE_URL?.replace(/:([^@]+)@/, ':****@')); // Hide password
    const userCount = await prisma.user.count();
    console.log('Connection successful!');
    console.log(`Total users: ${userCount}`);
  } catch (error) {
    console.error('Connection failed:');
    console.error(error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
