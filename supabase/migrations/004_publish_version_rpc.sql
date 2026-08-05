-- F-06: Atomic publish of induction versions to avoid TOCTOU window
CREATE OR REPLACE FUNCTION publish_induction_version(label text, notes text, publisher uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  new_id uuid;
BEGIN
  -- De-activate the current version
  UPDATE induction_versions
  SET is_current = false
  WHERE is_current = true;

  -- Insert the new version and mark it as current
  INSERT INTO induction_versions (version_label, revision_notes, published_by, is_current)
  VALUES (label, notes, publisher, true)
  RETURNING id INTO new_id;

  RETURN new_id;
END;
$$;
