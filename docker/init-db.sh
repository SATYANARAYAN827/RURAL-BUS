#!/bin/bash
set -e

# Create non-superuser application role for RLS enforcement
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<-EOSQL
    CREATE EXTENSION IF NOT EXISTS postgis;
    CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
    
    DO \$\$
    BEGIN
        IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = '${APP_DB_USER:-ruralbus_app}') THEN
            CREATE ROLE ${APP_DB_USER:-ruralbus_app} WITH LOGIN PASSWORD '${APP_DB_PASSWORD:-app_secure_password}';
        END IF;
    END
    \$\$;

    GRANT ALL PRIVILEGES ON DATABASE ruralbus TO ${APP_DB_USER:-ruralbus_app};
    GRANT ALL ON SCHEMA public TO ${APP_DB_USER:-ruralbus_app};
    ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO ${APP_DB_USER:-ruralbus_app};
    ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO ${APP_DB_USER:-ruralbus_app};
EOSQL
