import { db } from "../lib/db";

async function main() {
  const email = process.env.PRIMARY_USER_EMAIL ?? "you@example.com";
  const user = await db.user.upsert({
    where: { email },
    update: {},
    create: { email },
  });
  console.log(`Seeded primary user: ${user.email} (${user.id})`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
