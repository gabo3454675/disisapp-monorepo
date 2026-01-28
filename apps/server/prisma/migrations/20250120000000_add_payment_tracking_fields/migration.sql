-- AlterTable: Agregar campos de tracking de pagos y publicToken
-- Esta migración es segura para ejecutar incluso si algunos campos ya existen

-- Agregar publicToken si no existe
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'invoices' AND column_name = 'publicToken'
    ) THEN
        ALTER TABLE "invoices" ADD COLUMN "publicToken" TEXT;
    END IF;
END $$;

-- Crear índices de publicToken solo si no existen
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes 
        WHERE schemaname = 'public' AND tablename = 'invoices' AND indexname = 'invoices_publicToken_key'
    ) THEN
        CREATE UNIQUE INDEX "invoices_publicToken_key" ON "invoices"("publicToken");
    END IF;
    
    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes 
        WHERE schemaname = 'public' AND tablename = 'invoices' AND indexname = 'invoices_publicToken_idx'
    ) THEN
        CREATE INDEX "invoices_publicToken_idx" ON "invoices"("publicToken");
    END IF;
END $$;

-- Agregar campos de tracking de pagos
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'invoices' AND column_name = 'markedAsPaidByClient'
    ) THEN
        ALTER TABLE "invoices" ADD COLUMN "markedAsPaidByClient" BOOLEAN NOT NULL DEFAULT false;
    END IF;
    
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'invoices' AND column_name = 'markedAsPaidAt'
    ) THEN
        ALTER TABLE "invoices" ADD COLUMN "markedAsPaidAt" TIMESTAMP(3);
    END IF;
    
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'invoices' AND column_name = 'markedAsPaidBy'
    ) THEN
        ALTER TABLE "invoices" ADD COLUMN "markedAsPaidBy" TEXT;
    END IF;
    
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'invoices' AND column_name = 'viewCount'
    ) THEN
        ALTER TABLE "invoices" ADD COLUMN "viewCount" INTEGER NOT NULL DEFAULT 0;
    END IF;
    
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'invoices' AND column_name = 'lastViewedAt'
    ) THEN
        ALTER TABLE "invoices" ADD COLUMN "lastViewedAt" TIMESTAMP(3);
    END IF;
END $$;

-- Agregar updatedAt con valor por defecto para filas existentes
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'invoices' AND column_name = 'updatedAt'
    ) THEN
        -- Agregar columna con valor por defecto
        ALTER TABLE "invoices" ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
        -- Actualizar filas existentes (aunque el default ya lo hace, por seguridad)
        UPDATE "invoices" SET "updatedAt" = COALESCE("createdAt", CURRENT_TIMESTAMP) WHERE "updatedAt" IS NULL;
    END IF;
END $$;

-- Crear índice de markedAsPaidByClient solo si no existe
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes 
        WHERE schemaname = 'public' AND tablename = 'invoices' AND indexname = 'invoices_markedAsPaidByClient_idx'
    ) THEN
        CREATE INDEX "invoices_markedAsPaidByClient_idx" ON "invoices"("markedAsPaidByClient");
    END IF;
END $$;
