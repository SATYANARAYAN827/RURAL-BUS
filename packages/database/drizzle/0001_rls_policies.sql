-- Phase 5: PostgreSQL Row-Level Security (RLS) Policies for Multi-Tenant Tables

-- 1. Buses
ALTER TABLE "buses" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "buses" FORCE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation_buses" ON "buses"
    FOR ALL TO "ruralbus_app"
    USING (
        tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid
        OR current_setting('app.bypass_rls', true) = 'on'
    )
    WITH CHECK (
        tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid
        OR current_setting('app.bypass_rls', true) = 'on'
    );

--> statement-breakpoint
-- 2. Routes
ALTER TABLE "routes" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "routes" FORCE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation_routes" ON "routes"
    FOR ALL TO "ruralbus_app"
    USING (
        tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid
        OR current_setting('app.bypass_rls', true) = 'on'
    )
    WITH CHECK (
        tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid
        OR current_setting('app.bypass_rls', true) = 'on'
    );

--> statement-breakpoint
-- 3. Stops
ALTER TABLE "stops" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "stops" FORCE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation_stops" ON "stops"
    FOR ALL TO "ruralbus_app"
    USING (
        tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid
        OR current_setting('app.bypass_rls', true) = 'on'
    )
    WITH CHECK (
        tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid
        OR current_setting('app.bypass_rls', true) = 'on'
    );

--> statement-breakpoint
-- 4. Schedules
ALTER TABLE "schedules" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "schedules" FORCE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation_schedules" ON "schedules"
    FOR ALL TO "ruralbus_app"
    USING (
        tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid
        OR current_setting('app.bypass_rls', true) = 'on'
    )
    WITH CHECK (
        tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid
        OR current_setting('app.bypass_rls', true) = 'on'
    );

--> statement-breakpoint
-- 5. Trips
ALTER TABLE "trips" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "trips" FORCE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation_trips" ON "trips"
    FOR ALL TO "ruralbus_app"
    USING (
        tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid
        OR current_setting('app.bypass_rls', true) = 'on'
    )
    WITH CHECK (
        tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid
        OR current_setting('app.bypass_rls', true) = 'on'
    );

--> statement-breakpoint
-- 6. Bookings
ALTER TABLE "bookings" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "bookings" FORCE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation_bookings" ON "bookings"
    FOR ALL TO "ruralbus_app"
    USING (
        tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid
        OR current_setting('app.bypass_rls', true) = 'on'
    )
    WITH CHECK (
        tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid
        OR current_setting('app.bypass_rls', true) = 'on'
    );

--> statement-breakpoint
-- 7. Tickets
ALTER TABLE "tickets" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "tickets" FORCE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation_tickets" ON "tickets"
    FOR ALL TO "ruralbus_app"
    USING (
        tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid
        OR current_setting('app.bypass_rls', true) = 'on'
    )
    WITH CHECK (
        tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid
        OR current_setting('app.bypass_rls', true) = 'on'
    );

--> statement-breakpoint
-- 8. Trip Trajectories
ALTER TABLE "trip_trajectories" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "trip_trajectories" FORCE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation_trip_trajectories" ON "trip_trajectories"
    FOR ALL TO "ruralbus_app"
    USING (
        tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid
        OR current_setting('app.bypass_rls', true) = 'on'
    )
    WITH CHECK (
        tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid
        OR current_setting('app.bypass_rls', true) = 'on'
    );

--> statement-breakpoint
-- 9. Audit Logs
ALTER TABLE "audit_logs" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "audit_logs" FORCE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation_audit_logs" ON "audit_logs"
    FOR ALL TO "ruralbus_app"
    USING (
        tenant_id IS NULL
        OR tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid
        OR current_setting('app.bypass_rls', true) = 'on'
    )
    WITH CHECK (
        tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid
        OR current_setting('app.bypass_rls', true) = 'on'
    );

--> statement-breakpoint
-- 10. Operator Members
ALTER TABLE "operator_members" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "operator_members" FORCE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation_operator_members" ON "operator_members"
    FOR ALL TO "ruralbus_app"
    USING (
        tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid
        OR current_setting('app.bypass_rls', true) = 'on'
    )
    WITH CHECK (
        tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid
        OR current_setting('app.bypass_rls', true) = 'on'
    );
