DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'role') THEN
    CREATE TYPE "public"."role" AS ENUM('admin', 'user', 'corporate');
  END IF;
END $$;
--> statement-breakpoint
