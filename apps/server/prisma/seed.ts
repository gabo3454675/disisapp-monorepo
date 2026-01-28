import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

// Email del Super Admin (configurable)
const SUPER_ADMIN_EMAIL = process.env.SUPER_ADMIN_EMAIL || 'glonga10@gmail.com';
const SUPER_ADMIN_PASSWORD = process.env.SUPER_ADMIN_PASSWORD || '338232gG';

async function main() {
  console.log('🌱 Iniciando seed de base de datos...');
  console.log(`📧 Buscando Super Admin con email: ${SUPER_ADMIN_EMAIL}`);

  // Hash de contraseña para el usuario admin
  const passwordHash = await bcrypt.hash(SUPER_ADMIN_PASSWORD, 10);

  // Crear o actualizar usuario administrador como Super Admin
  const adminUser = await prisma.user.upsert({
    where: { email: SUPER_ADMIN_EMAIL },
    update: {
      isSuperAdmin: true, // Asegurar que es Super Admin
    },
    create: {
      email: SUPER_ADMIN_EMAIL,
      passwordHash,
      fullName: 'Super Administrador del Sistema',
      isSuperAdmin: true, // Marcar como Super Admin
    },
  });

  console.log('✅ Usuario Super Admin creado/actualizado:', adminUser.email);
  console.log(`   isSuperAdmin: ${adminUser.isSuperAdmin}`);

  // Crear las 3 organizaciones fijas y sus empresas legacy correspondientes
  const organizationsData = [
    {
      nombre: 'Monddy',
      slug: 'monddy',
      companyData: {
        name: 'Monddy',
        taxId: 'J-30123456-7',
        address: 'Caracas, Venezuela',
      },
    },
    {
      nombre: 'Davean',
      slug: 'davean',
      companyData: {
        name: 'Davean',
        taxId: 'J-30234567-8',
        address: 'Valencia, Venezuela',
      },
    },
    {
      nombre: 'El Rancho de German',
      slug: 'rancho-german',
      companyData: {
        name: 'El Rancho de German',
        taxId: 'J-30345678-9',
        address: 'Maracaibo, Venezuela',
      },
    },
  ];

  const organizations = [];
  const companies = [];

  for (const orgData of organizationsData) {
    // Crear empresa legacy primero
    let company = await prisma.company.findFirst({
      where: { taxId: orgData.companyData.taxId },
    });

    if (!company) {
      company = await prisma.company.create({
        data: {
          name: orgData.companyData.name,
          taxId: orgData.companyData.taxId,
          currency: 'USD',
          address: orgData.companyData.address,
          isActive: true,
        },
      });
      console.log(`✅ Empresa legacy creada: ${company.name}`);
    } else {
      console.log(`ℹ️ Empresa legacy ya existe: ${company.name}`);
    }
    companies.push(company);

    // Buscar organización existente por slug
    let organization = await prisma.organization.findUnique({
      where: { slug: orgData.slug },
    });

    // Si no existe, crearla
    if (!organization) {
      organization = await prisma.organization.create({
        data: {
          nombre: orgData.nombre,
          slug: orgData.slug,
          plan: 'FREE',
        },
      });
      console.log(`✅ Organización creada: ${organization.nombre} (${organization.slug})`);
    } else {
      // Actualizar nombre si cambió
      organization = await prisma.organization.update({
        where: { id: organization.id },
        data: { nombre: orgData.nombre },
      });
      console.log(`ℹ️ Organización ya existe: ${organization.nombre} (${organization.slug})`);
    }
    organizations.push({ organization, company });
  }

  // Asociar usuario Super Admin con las 3 organizaciones como OWNER
  for (const { organization, company } of organizations) {
    await prisma.member.upsert({
      where: {
        userId_organizationId: {
          userId: adminUser.id,
          organizationId: organization.id,
        },
      },
      update: {
        role: 'OWNER',
        status: 'ACTIVE',
      },
      create: {
        userId: adminUser.id,
        organizationId: organization.id,
        role: 'OWNER',
        status: 'ACTIVE',
      },
    });
    console.log(`✅ Membresía creada: Super Admin → ${organization.nombre}`);

    // Crear categorías de gastos por defecto para cada organización
    const defaultCategories = [
      { name: 'Inventario', description: 'Compras de productos para inventario' },
      { name: 'Servicios', description: 'Servicios profesionales y técnicos' },
      { name: 'Nómina', description: 'Pagos de salarios y beneficios' },
      { name: 'Mantenimiento', description: 'Mantenimiento de equipos e instalaciones' },
      { name: 'Alquiler', description: 'Alquiler de locales y espacios' },
      { name: 'Utilidades', description: 'Servicios públicos (luz, agua, internet)' },
      { name: 'Marketing', description: 'Publicidad y promoción' },
      { name: 'Otros', description: 'Otros gastos operativos' },
    ];

    for (const catData of defaultCategories) {
      const existingCategory = await prisma.expenseCategory.findFirst({
        where: {
          organizationId: organization.id,
          name: catData.name,
        },
      });

      if (!existingCategory) {
        await prisma.expenseCategory.create({
          data: {
            companyId: company.id, // Requerido por el schema
            organizationId: organization.id, // Opcional pero lo proporcionamos
            name: catData.name,
            description: catData.description,
          },
        });
      }
    }
    console.log(`✅ Categorías de gastos creadas para ${organization.nombre}`);
  }

  // Asociar usuario admin con las 3 empresas legacy como OWNER
  for (const { company } of organizations) {
    await prisma.companyMember.upsert({
      where: {
        userId_companyId: {
          userId: adminUser.id,
          companyId: company.id,
        },
      },
      update: {
        role: 'OWNER',
        status: 'ACTIVE',
      },
      create: {
        userId: adminUser.id,
        companyId: company.id,
        role: 'OWNER',
        status: 'ACTIVE',
      },
    });
    console.log(`✅ Membresía legacy creada: Admin → ${company.name}`);

    // Crear categorías de gastos por defecto para cada empresa legacy
    const defaultCategories = [
      { name: 'Inventario', description: 'Compras de productos para inventario' },
      { name: 'Servicios', description: 'Servicios profesionales y técnicos' },
      { name: 'Nómina', description: 'Pagos de salarios y beneficios' },
      { name: 'Mantenimiento', description: 'Mantenimiento de equipos e instalaciones' },
      { name: 'Alquiler', description: 'Alquiler de locales y espacios' },
      { name: 'Utilidades', description: 'Servicios públicos (luz, agua, internet)' },
      { name: 'Marketing', description: 'Publicidad y promoción' },
      { name: 'Otros', description: 'Otros gastos operativos' },
    ];

    for (const catData of defaultCategories) {
      const existingCategory = await prisma.expenseCategory.findFirst({
        where: {
          companyId: company.id,
          name: catData.name,
        },
      });

      if (!existingCategory) {
        await prisma.expenseCategory.create({
          data: {
            companyId: company.id,
            name: catData.name,
            description: catData.description,
          },
        });
      }
    }
    console.log(`✅ Categorías de gastos legacy creadas para ${company.name}`);
  }

  console.log('\n🎉 Seed completado exitosamente!');
  console.log('\n📋 Credenciales de acceso:');
  console.log(`   Email: ${SUPER_ADMIN_EMAIL}`);
  console.log(`   Password: ${SUPER_ADMIN_PASSWORD}`);
  console.log('\n🏢 Organizaciones disponibles:');
  organizations.forEach(({ organization }) => {
    console.log(`   - ${organization.nombre} (${organization.slug})`);
  });
  console.log('\n💡 El Super Admin tiene acceso como OWNER a las 3 organizaciones.');
}

main()
  .catch((e) => {
    console.error('❌ Error en seed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
