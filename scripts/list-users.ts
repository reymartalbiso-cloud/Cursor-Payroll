import { PrismaClient } from '@prisma/client';
import fs from 'fs';

async function main() {
    const prisma = new PrismaClient();
    try {
        const users = await prisma.user.findMany({
            select: { email: true, role: true, isActive: true }
        });
        let output = 'Registered Users Found:\n';
        users.forEach(u => {
            output += `- Email: ${u.email} | Role: ${u.role} | Active: ${u.isActive}\n`;
        });
        fs.writeFileSync('C:/Users/Lifewood PH/Downloads/Payroll App/Cursor-Payroll/scripts/user-list-output.txt', output);
        console.log('User list written to scripts/user-list-output.txt');
    } catch (error) {
        console.error(error);
    } finally {
        await prisma.$disconnect();
    }
}

main();
