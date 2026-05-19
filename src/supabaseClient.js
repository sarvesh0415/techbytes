import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://iuiblslgnsslexpgfnin.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml1aWJsc2xnbnNzbGV4cGdmbmluIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU3MzU5MjYsImV4cCI6MjA5MTMxMTkyNn0.ydlhpTyf3LGzxsbgD_5hxmGVCzCEFBbyN-735MSXXFw';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
