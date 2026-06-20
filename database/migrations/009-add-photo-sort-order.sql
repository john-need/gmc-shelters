ALTER TABLE photos ADD COLUMN sort_order INTEGER;

UPDATE photos
SET sort_order = (
  SELECT COUNT(*)
  FROM photos AS prior
  WHERE prior.shelter_id = photos.shelter_id
    AND (
      COALESCE(prior.created, '') < COALESCE(photos.created, '')
      OR (
        COALESCE(prior.created, '') = COALESCE(photos.created, '')
        AND prior.id <= photos.id
      )
    )
);
