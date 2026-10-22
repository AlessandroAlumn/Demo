// Creates the login accounts: `admin` and User1..User20 (linked to donors D0001..D0020), the demo posts
// and the manual Ambassador award. Run after the import (the donors must exist). Idempotent.
//
// There are no passwords in the prototype: the login form's password field is a placeholder.

import { PrismaClient } from "@prisma/client";
import { seedUsers } from "../src/lib/seeding";

const db = new PrismaClient();

seedUsers(db)
  .then((r) =>
    console.log(`Users: ${r.users} total (+${r.created}). Ambassador badge awarded to User15. Demo posts +${r.posts}.`),
  )
  .catch((e) => {
    console.error(e.message ?? e);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
