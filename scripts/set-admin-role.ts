/**
 * Script to set a user as ADMIN in Clerk
 *
 * Usage:
 * npx ts-node scripts/set-admin-role.ts <user-email>
 *
 * Example:
 * npx ts-node scripts/set-admin-role.ts admin@example.com
 */

import { config } from 'dotenv';
import { createClerkClient } from '@clerk/backend';

// Load environment variables
config();

const clerkClient = createClerkClient({
  secretKey: process.env.CLERK_SECRET_KEY,
});

async function setAdminRole(email: string) {
  try {
    // Find user by email
    const response = await clerkClient.users.getUserList({
      emailAddress: [email],
    });

    if (!response.data || response.data.length === 0) {
      console.error(`❌ User not found with email: ${email}`);
      process.exit(1);
    }

    const user = response.data[0];
    // Update public metadata with ADMIN role
    await clerkClient.users.updateUser(user.id, {
      publicMetadata: {
        ...user.publicMetadata,
        role: 'ADMIN',
      },
    });

  } catch (error: any) {
    console.error('❌ Error setting admin role:', error.message);
    process.exit(1);
  }
}

// Get email from command line arguments
const email = process.argv[2];

if (!email) {
  console.error('❌ Please provide a user email');
  process.exit(1);
}

setAdminRole(email);
