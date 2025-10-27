import 'reflect-metadata';
import * as bcrypt from 'bcrypt';
import { DataSource } from 'typeorm';
import { TenantEntity } from '../database/entities/tenant.entity';
import { UserEntity } from '../database/entities/user.entity';

function resolveDatabaseUrl(): string {
  if (process.env.DATABASE_URL) {
    return process.env.DATABASE_URL;
  }

  const username = process.env.DB_USERNAME ?? 'tourism_user';
  const password = process.env.DB_PASSWORD ?? 'tourism_pass';
  const host = process.env.DB_HOST ?? 'localhost';
  const port = process.env.DB_PORT ?? '5432';
  const database = process.env.DB_NAME ?? 'tourism_db';

  return `postgresql://${username}:${password}@${host}:${port}/${database}`;
}

async function seed() {
  const dataSource = new DataSource({
    type: 'postgres',
    url: resolveDatabaseUrl(),
    entities: [TenantEntity, UserEntity],
    synchronize: true,
    logging: false,
  });

  await dataSource.initialize();

  try {
    const tenantRepository = dataSource.getRepository(TenantEntity);
    const userRepository = dataSource.getRepository(UserEntity);

    let systemTenant = await tenantRepository.findOne({
      where: { code: 'system' },
    });

    if (!systemTenant) {
      systemTenant = tenantRepository.create({
        id: 'system',
        name: 'System Tenant',
        code: 'system',
        isActive: true,
        settings: {},
      });
      await tenantRepository.save(systemTenant);
      console.log('✅ Created system tenant');
    } else if (!systemTenant.isActive) {
      systemTenant.isActive = true;
      await tenantRepository.save(systemTenant);
      console.log('ℹ️ Enabled existing system tenant');
    } else {
      console.log('ℹ️ System tenant already present');
    }

    const adminEmail = 'admin@tourism.ai';
    let adminUser = await userRepository.findOne({
      where: { email: adminEmail },
      relations: ['tenant'],
    });

    if (!adminUser) {
      const passwordHash = await bcrypt.hash('change-me', 12);
      adminUser = userRepository.create({
        email: adminEmail,
        passwordHash,
        roles: ['admin'],
        attributes: {
          firstName: 'Platform',
          lastName: 'Administrator',
        },
        isActive: true,
        tenant: systemTenant,
        tenantId: systemTenant.id,
      });
      await userRepository.save(adminUser);
      console.log(`✅ Created admin user (${adminEmail}) with default password`);
    } else {
      const nextRoles = Array.from(new Set([...(adminUser.roles ?? []), 'admin']));
      adminUser.roles = nextRoles;
      adminUser.tenantId = systemTenant.id;
      adminUser.tenant = systemTenant;
      adminUser.isActive = true;
      await userRepository.save(adminUser);
      console.log(`ℹ️ Updated existing admin user (${adminEmail})`);
    }
  } finally {
    await dataSource.destroy();
  }
}

seed().catch((error) => {
  console.error('❌ Database seeding failed', error);
  process.exit(1);
});
