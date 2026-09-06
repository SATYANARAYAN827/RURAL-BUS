ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "development_password" text;
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "must_change_password" boolean DEFAULT false NOT NULL;
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "phone_verified" boolean DEFAULT true NOT NULL;
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "last_login_at" timestamp with time zone;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "otp_verifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"phone" varchar(20) NOT NULL,
	"otp_hash" text NOT NULL,
	"purpose" varchar(50) NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"max_attempts" integer DEFAULT 5 NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"verified_at" timestamp with time zone,
	"reset_token" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_otp_phone" ON "otp_verifications" USING btree ("phone");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_otp_purpose" ON "otp_verifications" USING btree ("phone","purpose");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_otp_expires" ON "otp_verifications" USING btree ("expires_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_otp_reset_token" ON "otp_verifications" USING btree ("reset_token");
