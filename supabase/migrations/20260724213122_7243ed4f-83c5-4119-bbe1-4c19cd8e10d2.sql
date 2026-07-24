-- 1. Novo valor de enum
ALTER TYPE public.post_status ADD VALUE IF NOT EXISTS 'ready_for_review';

-- 2. Colunas de vínculo em posts (1:1 via UNIQUE)
ALTER TABLE public.posts
  ADD COLUMN IF NOT EXISTS linked_design_slot_id uuid
    REFERENCES public.design_slots(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS linked_delivery_slot_id uuid
    REFERENCES public.delivery_slots(id) ON DELETE SET NULL;

CREATE UNIQUE INDEX IF NOT EXISTS posts_linked_design_slot_unique
  ON public.posts(linked_design_slot_id) WHERE linked_design_slot_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS posts_linked_delivery_slot_unique
  ON public.posts(linked_delivery_slot_id) WHERE linked_delivery_slot_id IS NOT NULL;

ALTER TABLE public.posts DROP CONSTRAINT IF EXISTS posts_linked_slot_mutex;
ALTER TABLE public.posts ADD CONSTRAINT posts_linked_slot_mutex
  CHECK (linked_design_slot_id IS NULL OR linked_delivery_slot_id IS NULL);

-- 3. Trigger para transição automática
CREATE OR REPLACE FUNCTION public.on_slot_done_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.done = true AND OLD.done IS DISTINCT FROM true THEN
    IF TG_TABLE_NAME = 'design_slots' THEN
      UPDATE public.posts SET status = 'ready_for_review'::post_status
      WHERE linked_design_slot_id = NEW.id AND status = 'planning';
    ELSE
      UPDATE public.posts SET status = 'ready_for_review'::post_status
      WHERE linked_delivery_slot_id = NEW.id AND status = 'planning';
    END IF;
  ELSIF NEW.done = false AND OLD.done = true THEN
    IF TG_TABLE_NAME = 'design_slots' THEN
      UPDATE public.posts SET status = 'planning'::post_status
      WHERE linked_design_slot_id = NEW.id AND status = 'ready_for_review';
    ELSE
      UPDATE public.posts SET status = 'planning'::post_status
      WHERE linked_delivery_slot_id = NEW.id AND status = 'ready_for_review';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS design_slots_done_change ON public.design_slots;
CREATE TRIGGER design_slots_done_change
AFTER UPDATE OF done ON public.design_slots
FOR EACH ROW EXECUTE FUNCTION public.on_slot_done_change();

DROP TRIGGER IF EXISTS delivery_slots_done_change ON public.delivery_slots;
CREATE TRIGGER delivery_slots_done_change
AFTER UPDATE OF done ON public.delivery_slots
FOR EACH ROW EXECUTE FUNCTION public.on_slot_done_change();