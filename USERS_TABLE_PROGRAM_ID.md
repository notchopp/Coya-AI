# Users Table - program_id Column

## Answer: YES, the users table needs `program_id`

The `program_id` column in the `users` table is **already being used** and is **required** for the multi-program feature.

### Current Usage:

1. **User Invitation** (`app/api/invite-user/route.ts`):
   - When admins invite users, they can assign them to a specific program
   - The `program_id` is stored in the `users` table (line 109)
   - It's also passed in the auth metadata (line 137)

2. **Program-Specific Access**:
   - Users with a `program_id` should only see data for that specific program
   - Users without a `program_id` (or with `program_id = null`) see all programs for their business

### Database Schema:

The `users` table should have:
```sql
program_id uuid null,
```

With a foreign key constraint:
```sql
CONSTRAINT users_program_id_fkey FOREIGN KEY (program_id) 
  REFERENCES programs(id) ON DELETE SET NULL
```

### Migration:

If the column doesn't exist yet, create it with:
```sql
ALTER TABLE public.users 
ADD COLUMN program_id uuid null;

CREATE INDEX IF NOT EXISTS idx_users_program_id 
ON public.users(program_id);

ALTER TABLE public.users
ADD CONSTRAINT users_program_id_fkey 
FOREIGN KEY (program_id) 
REFERENCES public.programs(id) 
ON DELETE SET NULL;
```






