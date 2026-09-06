CREATE TYPE "public"."user_role" AS ENUM('PASSENGER', 'PLATFORM_ADMIN');--> statement-breakpoint
CREATE TYPE "public"."operator_status" AS ENUM('ACTIVE', 'SUSPENDED', 'PENDING_VERIFICATION');--> statement-breakpoint
CREATE TYPE "public"."operator_member_role" AS ENUM('OPERATOR_ADMIN', 'DRIVER', 'CONDUCTOR');--> statement-breakpoint
CREATE TYPE "public"."bus_status" AS ENUM('ACTIVE', 'MAINTENANCE', 'DECOMMISSIONED');--> statement-breakpoint
CREATE TYPE "public"."seating_type" AS ENUM('SEATER_2X2', 'SEATER_3X2', 'SLEEPER', 'SEMI_SLEEPER');--> statement-breakpoint
CREATE TYPE "public"."trip_status" AS ENUM('SCHEDULED', 'BOARDING', 'IN_TRANSIT', 'COMPLETED', 'CANCELLED', 'DELAYED');--> statement-breakpoint
CREATE TYPE "public"."booking_status" AS ENUM('HELD', 'CONFIRMED', 'BOARDED', 'CANCELLED', 'EXPIRED');--> statement-breakpoint
CREATE TYPE "public"."ticket_status" AS ENUM('VALID', 'BOARDED', 'EXPIRED', 'CANCELLED');--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" varchar(255),
	"phone" varchar(20),
	"full_name" varchar(150) NOT NULL,
	"password_hash" text NOT NULL,
	"role" "user_role" DEFAULT 'PASSENGER' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email"),
	CONSTRAINT "users_phone_unique" UNIQUE("phone")
);
--> statement-breakpoint
CREATE TABLE "operators" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_name" varchar(200) NOT NULL,
	"business_code" varchar(50) NOT NULL,
	"contact_email" varchar(255) NOT NULL,
	"contact_phone" varchar(20) NOT NULL,
	"status" "operator_status" DEFAULT 'ACTIVE' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "operators_business_code_unique" UNIQUE("business_code")
);
--> statement-breakpoint
CREATE TABLE "operator_members" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"tenant_id" uuid NOT NULL,
	"role" "operator_member_role" NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "operator_members_user_id_tenant_id_unique" UNIQUE("user_id","tenant_id")
);
--> statement-breakpoint
CREATE TABLE "buses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"registration_number" varchar(30) NOT NULL,
	"model" varchar(100) NOT NULL,
	"total_seats" integer NOT NULL,
	"seating_type" "seating_type" DEFAULT 'SEATER_2X2' NOT NULL,
	"status" "bus_status" DEFAULT 'ACTIVE' NOT NULL,
	"amenities" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "buses_tenant_id_registration_number_unique" UNIQUE("tenant_id","registration_number")
);
--> statement-breakpoint
CREATE TABLE "stops" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"name" varchar(150) NOT NULL,
	"code" varchar(20) NOT NULL,
	"latitude" double precision NOT NULL,
	"longitude" double precision NOT NULL,
	"location" geometry(Point, 4326),
	"landmark" varchar(255),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "routes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"route_code" varchar(30) NOT NULL,
	"origin" varchar(150) NOT NULL,
	"destination" varchar(150) NOT NULL,
	"total_distance_km" double precision NOT NULL,
	"estimated_duration_minutes" integer NOT NULL,
	"polyline_coordinates" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"polyline_geometry" geometry(LineString, 4326),
	"stops_data" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "schedules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"route_id" uuid NOT NULL,
	"departure_time" varchar(8) NOT NULL,
	"arrival_time" varchar(8) NOT NULL,
	"days_of_week" jsonb NOT NULL,
	"base_fare" double precision NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "trips" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"route_id" uuid NOT NULL,
	"bus_id" uuid NOT NULL,
	"driver_id" uuid,
	"conductor_id" uuid,
	"departure_time" timestamp with time zone NOT NULL,
	"scheduled_arrival" timestamp with time zone NOT NULL,
	"actual_departure" timestamp with time zone,
	"actual_arrival" timestamp with time zone,
	"status" "trip_status" DEFAULT 'SCHEDULED' NOT NULL,
	"available_seats" integer NOT NULL,
	"total_seats" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bookings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"trip_id" uuid NOT NULL,
	"passenger_id" uuid NOT NULL,
	"seat_number" integer NOT NULL,
	"boarding_stop_id" uuid NOT NULL,
	"dropping_stop_id" uuid NOT NULL,
	"fare_amount" double precision NOT NULL,
	"status" "booking_status" DEFAULT 'HELD' NOT NULL,
	"locked_until" timestamp with time zone,
	"payment_id" varchar(100),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tickets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"booking_id" uuid NOT NULL,
	"trip_id" uuid NOT NULL,
	"passenger_id" uuid NOT NULL,
	"qr_signature" text NOT NULL,
	"status" "ticket_status" DEFAULT 'VALID' NOT NULL,
	"boarded_at" timestamp with time zone,
	"boarded_by_conductor_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "trip_trajectories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"trip_id" uuid NOT NULL,
	"total_distance_km" double precision NOT NULL,
	"total_points" integer NOT NULL,
	"simplified_polyline" jsonb NOT NULL,
	"trajectory_geometry" geometry(LineString, 4326),
	"completed_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "trip_trajectories_trip_id_unique" UNIQUE("trip_id")
);
--> statement-breakpoint
CREATE TABLE "audit_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid,
	"user_id" uuid,
	"action" varchar(100) NOT NULL,
	"entity_type" varchar(50) NOT NULL,
	"entity_id" varchar(100),
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"ip_address" varchar(50),
	"user_agent" varchar(255),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "operator_members" ADD CONSTRAINT "operator_members_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "operator_members" ADD CONSTRAINT "operator_members_tenant_id_operators_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."operators"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "buses" ADD CONSTRAINT "buses_tenant_id_operators_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."operators"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stops" ADD CONSTRAINT "stops_tenant_id_operators_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."operators"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "routes" ADD CONSTRAINT "routes_tenant_id_operators_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."operators"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "schedules" ADD CONSTRAINT "schedules_tenant_id_operators_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."operators"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "schedules" ADD CONSTRAINT "schedules_route_id_routes_id_fk" FOREIGN KEY ("route_id") REFERENCES "public"."routes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trips" ADD CONSTRAINT "trips_tenant_id_operators_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."operators"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trips" ADD CONSTRAINT "trips_route_id_routes_id_fk" FOREIGN KEY ("route_id") REFERENCES "public"."routes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trips" ADD CONSTRAINT "trips_bus_id_buses_id_fk" FOREIGN KEY ("bus_id") REFERENCES "public"."buses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trips" ADD CONSTRAINT "trips_driver_id_users_id_fk" FOREIGN KEY ("driver_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trips" ADD CONSTRAINT "trips_conductor_id_users_id_fk" FOREIGN KEY ("conductor_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_tenant_id_operators_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."operators"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_trip_id_trips_id_fk" FOREIGN KEY ("trip_id") REFERENCES "public"."trips"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_passenger_id_users_id_fk" FOREIGN KEY ("passenger_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_boarding_stop_id_stops_id_fk" FOREIGN KEY ("boarding_stop_id") REFERENCES "public"."stops"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_dropping_stop_id_stops_id_fk" FOREIGN KEY ("dropping_stop_id") REFERENCES "public"."stops"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_tenant_id_operators_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."operators"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_trip_id_trips_id_fk" FOREIGN KEY ("trip_id") REFERENCES "public"."trips"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_passenger_id_users_id_fk" FOREIGN KEY ("passenger_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_boarded_by_conductor_id_users_id_fk" FOREIGN KEY ("boarded_by_conductor_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trip_trajectories" ADD CONSTRAINT "trip_trajectories_tenant_id_operators_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."operators"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trip_trajectories" ADD CONSTRAINT "trip_trajectories_trip_id_trips_id_fk" FOREIGN KEY ("trip_id") REFERENCES "public"."trips"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_tenant_id_operators_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."operators"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_users_email" ON "users" USING btree ("email");--> statement-breakpoint
CREATE INDEX "idx_users_phone" ON "users" USING btree ("phone");--> statement-breakpoint
CREATE INDEX "idx_users_role" ON "users" USING btree ("role");--> statement-breakpoint
CREATE INDEX "idx_operators_code" ON "operators" USING btree ("business_code");--> statement-breakpoint
CREATE INDEX "idx_operators_status" ON "operators" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_op_members_user" ON "operator_members" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_op_members_tenant" ON "operator_members" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "idx_op_members_role" ON "operator_members" USING btree ("tenant_id","role");--> statement-breakpoint
CREATE INDEX "idx_buses_tenant" ON "buses" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "idx_buses_status" ON "buses" USING btree ("tenant_id","status");--> statement-breakpoint
CREATE INDEX "idx_stops_tenant" ON "stops" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "idx_stops_location_gist" ON "stops" USING gist ("location");--> statement-breakpoint
CREATE INDEX "idx_routes_tenant" ON "routes" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "idx_routes_code" ON "routes" USING btree ("tenant_id","route_code");--> statement-breakpoint
CREATE INDEX "idx_schedules_tenant" ON "schedules" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "idx_schedules_route" ON "schedules" USING btree ("tenant_id","route_id");--> statement-breakpoint
CREATE INDEX "idx_trips_tenant" ON "trips" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "idx_trips_route" ON "trips" USING btree ("route_id");--> statement-breakpoint
CREATE INDEX "idx_trips_bus" ON "trips" USING btree ("bus_id");--> statement-breakpoint
CREATE INDEX "idx_trips_driver" ON "trips" USING btree ("driver_id");--> statement-breakpoint
CREATE INDEX "idx_trips_conductor" ON "trips" USING btree ("conductor_id");--> statement-breakpoint
CREATE INDEX "idx_trips_status" ON "trips" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_trips_departure_time" ON "trips" USING btree ("departure_time");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_active_seat" ON "bookings" USING btree ("trip_id","seat_number") WHERE status IN ('HELD', 'CONFIRMED');--> statement-breakpoint
CREATE INDEX "idx_bookings_tenant" ON "bookings" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "idx_bookings_trip" ON "bookings" USING btree ("trip_id");--> statement-breakpoint
CREATE INDEX "idx_bookings_passenger" ON "bookings" USING btree ("passenger_id");--> statement-breakpoint
CREATE INDEX "idx_bookings_status" ON "bookings" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_tickets_tenant" ON "tickets" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "idx_tickets_trip" ON "tickets" USING btree ("trip_id");--> statement-breakpoint
CREATE INDEX "idx_tickets_booking" ON "tickets" USING btree ("booking_id");--> statement-breakpoint
CREATE INDEX "idx_tickets_passenger" ON "tickets" USING btree ("passenger_id");--> statement-breakpoint
CREATE INDEX "idx_tickets_status" ON "tickets" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_trip_trajectories_tenant" ON "trip_trajectories" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "idx_trip_trajectories_trip" ON "trip_trajectories" USING btree ("trip_id");--> statement-breakpoint
CREATE INDEX "idx_audit_logs_tenant" ON "audit_logs" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "idx_audit_logs_user" ON "audit_logs" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_audit_logs_action" ON "audit_logs" USING btree ("action");--> statement-breakpoint
CREATE INDEX "idx_audit_logs_created_at" ON "audit_logs" USING btree ("created_at");