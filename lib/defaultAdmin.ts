import { hashPassword } from '@/lib/auth';
import User from '@/models/User';

const DEFAULT_ADMIN_EMAIL = 'mohammadrezvani2002@gmail.com';
const DEFAULT_ADMIN_PASSWORD = '110682';

export async function ensureDefaultAdminUser() {
  const userCount = await User.estimatedDocumentCount();
  if (userCount > 0) return;

  try {
    await User.create({
      email: DEFAULT_ADMIN_EMAIL,
      passwordHash: hashPassword(DEFAULT_ADMIN_PASSWORD),
      role: 'admin'
    });
  } catch (error) {
    const errorWithCode = error as { code?: number };
    if (errorWithCode.code !== 11000) {
      throw error;
    }
  }
}
