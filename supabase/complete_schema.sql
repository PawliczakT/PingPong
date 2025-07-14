-- Skrypt do pełnego eksportu informacji o bazie
echo '=== TABELE I KOLUMNY ==='
copy (SELECT t.table_schema, t.table_name, c.column_name, c.data_type, c.is_nullable, c.column_default FROM information_schema.tables t JOIN information_schema.columns c ON t.table_name = c.table_name WHERE t.table_schema = 'public' ORDER BY t.table_name, c.ordinal_position) TO 'tables_columns.csv' WITH CSV HEADER;

echo '=== CONSTRAINTS ==='
copy (SELECT tc.table_name, tc.constraint_name, tc.constraint_type, kcu.column_name, ccu.table_name AS foreign_table_name, ccu.column_name AS foreign_column_name FROM information_schema.table_constraints tc LEFT JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name LEFT JOIN information_schema.constraint_column_usage ccu ON ccu.constraint_name = tc.constraint_name WHERE tc.table_schema = 'public') TO 'constraints.csv' WITH CSV HEADER;

echo '=== POLITYKI RLS ==='
copy (SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check FROM pg_policies WHERE schemaname IN ('public', 'storage')) TO 'rls_policies.csv' WITH CSV HEADER;

echo '=== FUNKCJE ==='
copy (SELECT n.nspname as schema_name, p.proname as function_name, pg_get_function_result(p.oid) as result_type, pg_get_function_arguments(p.oid) as arguments FROM pg_proc p JOIN pg_namespace n ON p.pronamespace = n.oid WHERE n.nspname = 'public') TO 'functions.csv' WITH CSV HEADER;
