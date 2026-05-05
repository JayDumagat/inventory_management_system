-- Philippine regulatory compliance: BIR, SEC, DTI, NPC fields
-- BIR (Bureau of Internal Revenue): TIN, VAT registration
ALTER TABLE "tenants" ADD COLUMN "tin_number" text;
ALTER TABLE "tenants" ADD COLUMN "is_vat_registered" boolean DEFAULT false NOT NULL;
-- SEC (Securities and Exchange Commission): corporate registration
ALTER TABLE "tenants" ADD COLUMN "sec_reg_number" text;
-- DTI (Department of Trade and Industry): sole proprietorship registration
ALTER TABLE "tenants" ADD COLUMN "dti_reg_number" text;
-- Local Government Unit (LGU): Mayor's / Business Permit
ALTER TABLE "tenants" ADD COLUMN "business_permit_number" text;
-- Business classification
ALTER TABLE "tenants" ADD COLUMN "business_type" text DEFAULT 'sole_proprietorship';
-- Registered business address
ALTER TABLE "tenants" ADD COLUMN "business_address" text;
ALTER TABLE "tenants" ADD COLUMN "business_city" text;
ALTER TABLE "tenants" ADD COLUMN "business_country" text DEFAULT 'PH';
-- NPC (National Privacy Commission) / Data Privacy Act of 2012 (RA 10173)
ALTER TABLE "customers" ADD COLUMN "data_consent_given" boolean DEFAULT false NOT NULL;
ALTER TABLE "customers" ADD COLUMN "data_consent_date" timestamp;
