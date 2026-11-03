-- ============================================================================
-- SUPABASE RLS POLICY FIX FOR ALL TABLES
-- ============================================================================
-- Run this SQL in your Supabase SQL Editor to fix 403 Forbidden errors
-- Go to: https://app.supabase.com → SQL Editor → New Query → Paste and Run

-- ============================================================================
-- 1. VEHICLE_EXPENSES TABLE
-- ============================================================================
ALTER TABLE vehicle_expenses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow authenticated users to insert vehicle expenses" ON vehicle_expenses;
DROP POLICY IF EXISTS "Allow authenticated users to read vehicle expenses" ON vehicle_expenses;
DROP POLICY IF EXISTS "Allow authenticated users to update vehicle expenses" ON vehicle_expenses;
DROP POLICY IF EXISTS "Allow authenticated users to delete vehicle expenses" ON vehicle_expenses;

CREATE POLICY "Allow authenticated users to insert vehicle expenses"
ON vehicle_expenses FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Allow authenticated users to read vehicle expenses"
ON vehicle_expenses FOR SELECT TO authenticated USING (true);

CREATE POLICY "Allow authenticated users to update vehicle expenses"
ON vehicle_expenses FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Allow authenticated users to delete vehicle expenses"
ON vehicle_expenses FOR DELETE TO authenticated USING (true);

-- ============================================================================
-- 2. STORE_EXPENSES TABLE
-- ============================================================================
ALTER TABLE store_expenses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow authenticated users to insert store expenses" ON store_expenses;
DROP POLICY IF EXISTS "Allow authenticated users to read store expenses" ON store_expenses;
DROP POLICY IF EXISTS "Allow authenticated users to update store expenses" ON store_expenses;
DROP POLICY IF EXISTS "Allow authenticated users to delete store expenses" ON store_expenses;

CREATE POLICY "Allow authenticated users to insert store expenses"
ON store_expenses FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Allow authenticated users to read store expenses"
ON store_expenses FOR SELECT TO authenticated USING (true);

CREATE POLICY "Allow authenticated users to update store expenses"
ON store_expenses FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Allow authenticated users to delete store expenses"
ON store_expenses FOR DELETE TO authenticated USING (true);

-- ============================================================================
-- 3. CARS TABLE
-- ============================================================================
ALTER TABLE cars ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow authenticated users to insert cars" ON cars;
DROP POLICY IF EXISTS "Allow authenticated users to read cars" ON cars;
DROP POLICY IF EXISTS "Allow authenticated users to update cars" ON cars;
DROP POLICY IF EXISTS "Allow authenticated users to delete cars" ON cars;

CREATE POLICY "Allow authenticated users to insert cars"
ON cars FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Allow authenticated users to read cars"
ON cars FOR SELECT TO authenticated USING (true);

CREATE POLICY "Allow authenticated users to update cars"
ON cars FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Allow authenticated users to delete cars"
ON cars FOR DELETE TO authenticated USING (true);

-- ============================================================================
-- 4. RESERVATIONS TABLE
-- ============================================================================
ALTER TABLE reservations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow authenticated users to insert reservations" ON reservations;
DROP POLICY IF EXISTS "Allow authenticated users to read reservations" ON reservations;
DROP POLICY IF EXISTS "Allow authenticated users to update reservations" ON reservations;
DROP POLICY IF EXISTS "Allow authenticated users to delete reservations" ON reservations;

CREATE POLICY "Allow authenticated users to insert reservations"
ON reservations FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Allow authenticated users to read reservations"
ON reservations FOR SELECT TO authenticated USING (true);

CREATE POLICY "Allow authenticated users to update reservations"
ON reservations FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Allow authenticated users to delete reservations"
ON reservations FOR DELETE TO authenticated USING (true);

-- ============================================================================
-- 5. CLIENTS TABLE
-- ============================================================================
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow authenticated users to insert clients" ON clients;
DROP POLICY IF EXISTS "Allow authenticated users to read clients" ON clients;
DROP POLICY IF EXISTS "Allow authenticated users to update clients" ON clients;
DROP POLICY IF EXISTS "Allow authenticated users to delete clients" ON clients;

CREATE POLICY "Allow authenticated users to insert clients"
ON clients FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Allow authenticated users to read clients"
ON clients FOR SELECT TO authenticated USING (true);

CREATE POLICY "Allow authenticated users to update clients"
ON clients FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Allow authenticated users to delete clients"
ON clients FOR DELETE TO authenticated USING (true);

-- ============================================================================
-- 6. WORKERS TABLE
-- ============================================================================
ALTER TABLE workers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow authenticated users to insert workers" ON workers;
DROP POLICY IF EXISTS "Allow authenticated users to read workers" ON workers;
DROP POLICY IF EXISTS "Allow authenticated users to update workers" ON workers;
DROP POLICY IF EXISTS "Allow authenticated users to delete workers" ON workers;

CREATE POLICY "Allow authenticated users to insert workers"
ON workers FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Allow authenticated users to read workers"
ON workers FOR SELECT TO authenticated USING (true);

CREATE POLICY "Allow authenticated users to update workers"
ON workers FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Allow authenticated users to delete workers"
ON workers FOR DELETE TO authenticated USING (true);

-- ============================================================================
-- 7. PAYMENTS TABLE
-- ============================================================================
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow authenticated users to insert payments" ON payments;
DROP POLICY IF EXISTS "Allow authenticated users to read payments" ON payments;
DROP POLICY IF EXISTS "Allow authenticated users to update payments" ON payments;
DROP POLICY IF EXISTS "Allow authenticated users to delete payments" ON payments;

CREATE POLICY "Allow authenticated users to insert payments"
ON payments FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Allow authenticated users to read payments"
ON payments FOR SELECT TO authenticated USING (true);

CREATE POLICY "Allow authenticated users to update payments"
ON payments FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Allow authenticated users to delete payments"
ON payments FOR DELETE TO authenticated USING (true);

-- ============================================================================
-- 8. INSPECTION_RESPONSES TABLE
-- ============================================================================
ALTER TABLE inspection_responses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow authenticated users to insert inspection responses" ON inspection_responses;
DROP POLICY IF EXISTS "Allow authenticated users to read inspection responses" ON inspection_responses;
DROP POLICY IF EXISTS "Allow authenticated users to update inspection responses" ON inspection_responses;
DROP POLICY IF EXISTS "Allow authenticated users to delete inspection responses" ON inspection_responses;

CREATE POLICY "Allow authenticated users to insert inspection responses"
ON inspection_responses FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Allow authenticated users to read inspection responses"
ON inspection_responses FOR SELECT TO authenticated USING (true);

CREATE POLICY "Allow authenticated users to update inspection responses"
ON inspection_responses FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Allow authenticated users to delete inspection responses"
ON inspection_responses FOR DELETE TO authenticated USING (true);

-- ============================================================================
-- 9. MAINTENANCE_ALERTS TABLE
-- ============================================================================
ALTER TABLE maintenance_alerts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow authenticated users to insert maintenance alerts" ON maintenance_alerts;
DROP POLICY IF EXISTS "Allow authenticated users to read maintenance alerts" ON maintenance_alerts;
DROP POLICY IF EXISTS "Allow authenticated users to update maintenance alerts" ON maintenance_alerts;
DROP POLICY IF EXISTS "Allow authenticated users to delete maintenance alerts" ON maintenance_alerts;

CREATE POLICY "Allow authenticated users to insert maintenance alerts"
ON maintenance_alerts FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Allow authenticated users to read maintenance alerts"
ON maintenance_alerts FOR SELECT TO authenticated USING (true);

CREATE POLICY "Allow authenticated users to update maintenance alerts"
ON maintenance_alerts FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Allow authenticated users to delete maintenance alerts"
ON maintenance_alerts FOR DELETE TO authenticated USING (true);

-- ============================================================================
-- 10. DOCUMENT_TEMPLATES TABLE
-- ============================================================================
ALTER TABLE document_templates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow authenticated users to insert document templates" ON document_templates;
DROP POLICY IF EXISTS "Allow authenticated users to read document templates" ON document_templates;
DROP POLICY IF EXISTS "Allow authenticated users to update document templates" ON document_templates;
DROP POLICY IF EXISTS "Allow authenticated users to delete document templates" ON document_templates;

CREATE POLICY "Allow authenticated users to insert document templates"
ON document_templates FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Allow authenticated users to read document templates"
ON document_templates FOR SELECT TO authenticated USING (true);

CREATE POLICY "Allow authenticated users to update document templates"
ON document_templates FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Allow authenticated users to delete document templates"
ON document_templates FOR DELETE TO authenticated USING (true);

-- ============================================================================
-- 11. PROFILES TABLE
-- ============================================================================
ALTER TABLE IF EXISTS profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow authenticated users to insert profiles" ON profiles;
DROP POLICY IF EXISTS "Allow authenticated users to read profiles" ON profiles;
DROP POLICY IF EXISTS "Allow authenticated users to update profiles" ON profiles;
DROP POLICY IF EXISTS "Allow authenticated users to delete profiles" ON profiles;

CREATE POLICY "Allow authenticated users to insert profiles"
ON profiles FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Allow authenticated users to read profiles"
ON profiles FOR SELECT TO authenticated USING (true);

CREATE POLICY "Allow authenticated users to update profiles"
ON profiles FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Allow authenticated users to delete profiles"
ON profiles FOR DELETE TO authenticated USING (true);

-- ============================================================================
-- 12. AGENCIES TABLE
-- ============================================================================
ALTER TABLE IF EXISTS agencies ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow authenticated users to insert agencies" ON agencies;
DROP POLICY IF EXISTS "Allow authenticated users to read agencies" ON agencies;
DROP POLICY IF EXISTS "Allow authenticated users to update agencies" ON agencies;
DROP POLICY IF EXISTS "Allow authenticated users to delete agencies" ON agencies;

CREATE POLICY "Allow authenticated users to insert agencies"
ON agencies FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Allow authenticated users to read agencies"
ON agencies FOR SELECT TO authenticated USING (true);

CREATE POLICY "Allow authenticated users to update agencies"
ON agencies FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Allow authenticated users to delete agencies"
ON agencies FOR DELETE TO authenticated USING (true);

-- ============================================================================
-- 13. WEBSITE_SETTINGS TABLE
-- ============================================================================
ALTER TABLE IF EXISTS website_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow authenticated users to insert website settings" ON website_settings;
DROP POLICY IF EXISTS "Allow authenticated users to read website settings" ON website_settings;
DROP POLICY IF EXISTS "Allow authenticated users to update website settings" ON website_settings;
DROP POLICY IF EXISTS "Allow authenticated users to delete website settings" ON website_settings;

CREATE POLICY "Allow authenticated users to insert website settings"
ON website_settings FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Allow authenticated users to read website settings"
ON website_settings FOR SELECT TO authenticated USING (true);

CREATE POLICY "Allow authenticated users to update website settings"
ON website_settings FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Allow authenticated users to delete website settings"
ON website_settings FOR DELETE TO authenticated USING (true);

-- ============================================================================
-- 14. WEBSITE_CONTACTS TABLE
-- ============================================================================
ALTER TABLE IF EXISTS website_contacts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow authenticated users to insert website contacts" ON website_contacts;
DROP POLICY IF EXISTS "Allow authenticated users to read website contacts" ON website_contacts;
DROP POLICY IF EXISTS "Allow authenticated users to update website contacts" ON website_contacts;
DROP POLICY IF EXISTS "Allow authenticated users to delete website contacts" ON website_contacts;

CREATE POLICY "Allow authenticated users to insert website contacts"
ON website_contacts FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Allow authenticated users to read website contacts"
ON website_contacts FOR SELECT TO authenticated USING (true);

CREATE POLICY "Allow authenticated users to update website contacts"
ON website_contacts FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Allow authenticated users to delete website contacts"
ON website_contacts FOR DELETE TO authenticated USING (true);

-- ============================================================================
-- 15. AGENCY_SETTINGS TABLE
-- ============================================================================
ALTER TABLE IF EXISTS agency_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow authenticated users to insert agency settings" ON agency_settings;
DROP POLICY IF EXISTS "Allow authenticated users to read agency settings" ON agency_settings;
DROP POLICY IF EXISTS "Allow authenticated users to update agency settings" ON agency_settings;
DROP POLICY IF EXISTS "Allow authenticated users to delete agency settings" ON agency_settings;

CREATE POLICY "Allow authenticated users to insert agency settings"
ON agency_settings FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Allow authenticated users to read agency settings"
ON agency_settings FOR SELECT TO authenticated USING (true);

CREATE POLICY "Allow authenticated users to update agency settings"
ON agency_settings FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Allow authenticated users to delete agency settings"
ON agency_settings FOR DELETE TO authenticated USING (true);

-- ============================================================================
-- 16. VEHICLE_INSPECTIONS TABLE
-- ============================================================================
ALTER TABLE IF EXISTS vehicle_inspections ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow authenticated users to insert vehicle inspections" ON vehicle_inspections;
DROP POLICY IF EXISTS "Allow authenticated users to read vehicle inspections" ON vehicle_inspections;
DROP POLICY IF EXISTS "Allow authenticated users to update vehicle inspections" ON vehicle_inspections;
DROP POLICY IF EXISTS "Allow authenticated users to delete vehicle inspections" ON vehicle_inspections;

CREATE POLICY "Allow authenticated users to insert vehicle inspections"
ON vehicle_inspections FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Allow authenticated users to read vehicle inspections"
ON vehicle_inspections FOR SELECT TO authenticated USING (true);

CREATE POLICY "Allow authenticated users to update vehicle inspections"
ON vehicle_inspections FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Allow authenticated users to delete vehicle inspections"
ON vehicle_inspections FOR DELETE TO authenticated USING (true);

-- ============================================================================
-- 17. INSPECTION_CHECKLIST_ITEMS TABLE
-- ============================================================================
ALTER TABLE IF EXISTS inspection_checklist_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow authenticated users to insert inspection checklist items" ON inspection_checklist_items;
DROP POLICY IF EXISTS "Allow authenticated users to read inspection checklist items" ON inspection_checklist_items;
DROP POLICY IF EXISTS "Allow authenticated users to update inspection checklist items" ON inspection_checklist_items;
DROP POLICY IF EXISTS "Allow authenticated users to delete inspection checklist items" ON inspection_checklist_items;

CREATE POLICY "Allow authenticated users to insert inspection checklist items"
ON inspection_checklist_items FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Allow authenticated users to read inspection checklist items"
ON inspection_checklist_items FOR SELECT TO authenticated USING (true);

CREATE POLICY "Allow authenticated users to update inspection checklist items"
ON inspection_checklist_items FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Allow authenticated users to delete inspection checklist items"
ON inspection_checklist_items FOR DELETE TO authenticated USING (true);

-- ============================================================================
-- 18. RESERVATION_SERVICES TABLE
-- ============================================================================
ALTER TABLE IF EXISTS reservation_services ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow authenticated users to insert reservation services" ON reservation_services;
DROP POLICY IF EXISTS "Allow authenticated users to read reservation services" ON reservation_services;
DROP POLICY IF EXISTS "Allow authenticated users to update reservation services" ON reservation_services;
DROP POLICY IF EXISTS "Allow authenticated users to delete reservation services" ON reservation_services;

CREATE POLICY "Allow authenticated users to insert reservation services"
ON reservation_services FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Allow authenticated users to read reservation services"
ON reservation_services FOR SELECT TO authenticated USING (true);

CREATE POLICY "Allow authenticated users to update reservation services"
ON reservation_services FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Allow authenticated users to delete reservation services"
ON reservation_services FOR DELETE TO authenticated USING (true);

-- ============================================================================
-- 19. SERVICES TABLE
-- ============================================================================
ALTER TABLE IF EXISTS services ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow authenticated users to insert services" ON services;
DROP POLICY IF EXISTS "Allow authenticated users to read services" ON services;
DROP POLICY IF EXISTS "Allow authenticated users to update services" ON services;
DROP POLICY IF EXISTS "Allow authenticated users to delete services" ON services;

CREATE POLICY "Allow authenticated users to insert services"
ON services FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Allow authenticated users to read services"
ON services FOR SELECT TO authenticated USING (true);

CREATE POLICY "Allow authenticated users to update services"
ON services FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Allow authenticated users to delete services"
ON services FOR DELETE TO authenticated USING (true);

-- ============================================================================
-- 20. VEHICLE_INSPECTION_PHOTOS TABLE
-- ============================================================================
ALTER TABLE IF EXISTS vehicle_inspection_photos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow authenticated users to insert vehicle inspection photos" ON vehicle_inspection_photos;
DROP POLICY IF EXISTS "Allow authenticated users to read vehicle inspection photos" ON vehicle_inspection_photos;
DROP POLICY IF EXISTS "Allow authenticated users to update vehicle inspection photos" ON vehicle_inspection_photos;
DROP POLICY IF EXISTS "Allow authenticated users to delete vehicle inspection photos" ON vehicle_inspection_photos;

CREATE POLICY "Allow authenticated users to insert vehicle inspection photos"
ON vehicle_inspection_photos FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Allow authenticated users to read vehicle inspection photos"
ON vehicle_inspection_photos FOR SELECT TO authenticated USING (true);

CREATE POLICY "Allow authenticated users to update vehicle inspection photos"
ON vehicle_inspection_photos FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Allow authenticated users to delete vehicle inspection photos"
ON vehicle_inspection_photos FOR DELETE TO authenticated USING (true);

-- ============================================================================
-- 21. MAINTENANCE_COST_ALERTS TABLE
-- ============================================================================
ALTER TABLE IF EXISTS maintenance_cost_alerts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow authenticated users to insert maintenance cost alerts" ON maintenance_cost_alerts;
DROP POLICY IF EXISTS "Allow authenticated users to read maintenance cost alerts" ON maintenance_cost_alerts;
DROP POLICY IF EXISTS "Allow authenticated users to update maintenance cost alerts" ON maintenance_cost_alerts;
DROP POLICY IF EXISTS "Allow authenticated users to delete maintenance cost alerts" ON maintenance_cost_alerts;

CREATE POLICY "Allow authenticated users to insert maintenance cost alerts"
ON maintenance_cost_alerts FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Allow authenticated users to read maintenance cost alerts"
ON maintenance_cost_alerts FOR SELECT TO authenticated USING (true);

CREATE POLICY "Allow authenticated users to update maintenance cost alerts"
ON maintenance_cost_alerts FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Allow authenticated users to delete maintenance cost alerts"
ON maintenance_cost_alerts FOR DELETE TO authenticated USING (true);

-- ============================================================================
-- 22. VEHICLE_EXPENSE_CATEGORIES TABLE
-- ============================================================================
ALTER TABLE IF EXISTS vehicle_expense_categories ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow authenticated users to insert vehicle expense categories" ON vehicle_expense_categories;
DROP POLICY IF EXISTS "Allow authenticated users to read vehicle expense categories" ON vehicle_expense_categories;
DROP POLICY IF EXISTS "Allow authenticated users to update vehicle expense categories" ON vehicle_expense_categories;
DROP POLICY IF EXISTS "Allow authenticated users to delete vehicle expense categories" ON vehicle_expense_categories;

CREATE POLICY "Allow authenticated users to insert vehicle expense categories"
ON vehicle_expense_categories FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Allow authenticated users to read vehicle expense categories"
ON vehicle_expense_categories FOR SELECT TO authenticated USING (true);

CREATE POLICY "Allow authenticated users to update vehicle expense categories"
ON vehicle_expense_categories FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Allow authenticated users to delete vehicle expense categories"
ON vehicle_expense_categories FOR DELETE TO authenticated USING (true);

-- ============================================================================
-- All RLS policies have been updated successfully!
-- ============================================================================
-- Your authenticated users now have full CRUD access to all tables.
-- All 403 Forbidden errors should be resolved.
-- ========================================================================
