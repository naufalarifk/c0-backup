# Email Ownership Protection Solution

## Masalah yang Dipecahkan

Kasus: Seseorang mendaftar dengan email milik Anda (`a@gmail.com`), kemudian email verifikasi dikirim ke email Anda. Jika Anda mengklik verifikasi, orang tersebut bisa mengakses akun. Jika tidak, Anda tidak bisa mendaftar karena "User already exists".

## Solusi

### 1. Hooks-based Protection (Real-time)

Menggunakan Better Auth hooks yang berjalan setiap kali ada request sign-up:

```typescript
hooks: {
  before: createAuthMiddleware(async ctx => {
    if (ctx.path === '/sign-up/email' && ctx.body?.email) {
      const email = ctx.body.email;
      const existingUser = await db.query.users.findFirst({
        where: eq(users.email, email)
      });

      if (existingUser) {
        if (existingUser.emailVerified) {
          // User sudah verified, tolak registrasi baru
          throw new APIError('FORBIDDEN', {
            message: 'Account already exists and verified. Please sign in.'
          });
        }

        // Cek grace period (24 jam)
        const gracePeriodExpired = (Date.now() - new Date(existingUser.createdAt).getTime()) > 24 * 60 * 60 * 1000;

        if (gracePeriodExpired) {
          // Hapus akun lama yang expired
          await db.delete(users).where(eq(users.email, email));
          console.log(`Deleted expired unverified account: ${email}`);
        } else {
          // Masih dalam grace period, tolak registrasi
          const hoursLeft = Math.ceil(...);
          throw new APIError('CONFLICT', {
            message: `Unverified account exists. Check email or try again in ${hoursLeft} hours.`
          });
        }
      }
    }
  }),
}
```

### 2. Background Cleanup Service

Service untuk pembersihan berkala dan manajemen:

```typescript
@Injectable()
export class UnverifiedAccountCleanupService {
  // Cleanup otomatis akun unverified yang sudah expired
  async cleanupUnverifiedAccounts() { ... }

  // Manual cleanup untuk admin
  async manualCleanup(olderThanHours: number) { ... }

  // Check status email
  async checkEmailStatus(email: string) { ... }

  // Statistik
  async getCleanupStats() { ... }
}
```

### 3. Management API Endpoints

```
GET /auth/email-ownership/status?email=user@example.com
POST /auth/email-ownership/cleanup
GET /auth/email-ownership/stats
POST /auth/email-ownership/run-cleanup
```

## Cara Kerja

### Skenario 1: Orang lain daftar dengan email Anda
1. Orang lain coba daftar dengan `a@gmail.com`
2. Akun dibuat (belum verified)
3. Email verifikasi dikirim ke `a@gmail.com` (email Anda)
4. Anda punya 24 jam untuk memutuskan

### Skenario 2: Anda tidak mengklik verifikasi
1. Setelah 24 jam, akun tersebut otomatis dianggap expired
2. Ketika Anda daftar dengan `a@gmail.com`, sistem akan:
   - Detect akun lama yang expired
   - Hapus akun lama tersebut
   - Biarkan Anda daftar dengan normal

### Skenario 3: Anda coba daftar dalam 24 jam
1. Sistem akan tolak dengan pesan: "Unverified account exists. Check email or try again in X hours"
2. Anda bisa check email dan klik verifikasi untuk "mengambil alih" akun
3. Atau tunggu sampai expired

### Skenario 4: Akun sudah diverifikasi
1. Jika orang lain sudah verifikasi email (dengan mengklik link di email Anda)
2. Sistem akan tolak registrasi baru: "Account already exists and verified"
3. Anda harus gunakan flow "forgot password" atau hubungi support

## Keamanan Features

1. **Grace Period**: 24 jam untuk verifikasi
2. **Automatic Cleanup**: Scheduled cleanup untuk performa
3. **Clear Error Messages**: User tahu apa yang harus dilakukan
4. **Admin Tools**: Manual cleanup dan monitoring
5. **Audit Logging**: Log semua aktivitas cleanup

## Performance Optimization

1. **Hook hanya berjalan untuk /sign-up/email**: Tidak semua request
2. **Single query check**: Minimal database hit
3. **Batch cleanup**: Background service untuk pembersihan massal
4. **Cascading delete**: Database handle relasi otomatis

## Configuration

```typescript
const EMAIL_OWNERSHIP_CONFIG = {
  unverifiedAccountGracePeriod: 24 * 60 * 60 * 1000, // 24 hours
} as const;
```

## Testing

```bash
# Check email status
curl "http://localhost:3000/auth/email-ownership/status?email=test@example.com"

# Manual cleanup (admin)
curl -X POST "http://localhost:3000/auth/email-ownership/cleanup" \
  -H "Content-Type: application/json" \
  -d '{"olderThanHours": 1}'

# Get statistics
curl "http://localhost:3000/auth/email-ownership/stats"
```

## Benefits

1. ✅ **Mencegah email squatting**
2. ✅ **Grace period yang fair**
3. ✅ **Performance optimal** (minimal queries)
4. ✅ **User-friendly error messages**
5. ✅ **Admin tools untuk monitoring**
6. ✅ **Automatic cleanup**
7. ✅ **Clear audit trail**

## Monitoring

Service menyediakan statistik untuk monitoring:
- Total users
- Verified vs unverified accounts
- Expired accounts yang perlu cleanup
- Grace period usage

Ini solusi yang comprehensive dan production-ready untuk masalah email ownership protection.
