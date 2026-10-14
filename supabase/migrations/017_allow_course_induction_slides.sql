-- Older installations may already have an induction_slides.section_id column
-- that is NOT NULL. The course builder now links slides through course_id, so
-- section_id is not applicable to course slides and must be optional.
do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'induction_slides'
      and column_name = 'section_id'
  ) then
    alter table public.induction_slides alter column section_id drop not null;
  end if;
end;
$$;
