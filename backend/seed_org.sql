-- Backfills organisations.slug on any environment where it's missing.
-- Source of truth: the "organisations" table in the local "cisodashboard" database.
-- Safe to run repeatedly — only touches rows where slug is currently NULL/empty,
-- so it won't clobber a slug that's already set (which may point at a per-org
-- database that already has real data).
--
-- Run with: psql -h <host> -p <port> -U <user> -d cisodashboard -f seed_org_slugs.sql

UPDATE organisations SET slug = 'techsec'    WHERE org_name = 'Techsec Global Private Ltd' AND (slug IS NULL OR slug = '');
UPDATE organisations SET slug = 'pcpl'       WHERE org_name = 'PCPL Construction'          AND (slug IS NULL OR slug = '');
UPDATE organisations SET slug = 'acme'       WHERE org_name = 'Acme Cyber Defense'         AND (slug IS NULL OR slug = '');
UPDATE organisations SET slug = 'northwind'  WHERE org_name = 'Northwind Logistics'        AND (slug IS NULL OR slug = '');
UPDATE organisations SET slug = 'blueshield' WHERE org_name = 'BlueShield Healthcare'      AND (slug IS NULL OR slug = '');

-- Sanity check after running: any orgs still without a slug need a manual
-- decision (see SETUP notes) before they'll resolve via orgMiddleware.
SELECT id, org_name, slug FROM organisations WHERE slug IS NULL OR slug = '';